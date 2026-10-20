import { wordpathV1 } from '@ttg/engine';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubLayout } from '../../test/layout';
import { makeTestPuzzle } from '../../test/testPuzzle';
import { loadResults, saveResult } from './results';
import { DAILY, loadActive, unlimitedKeys } from './session';
import { UnlimitedScreen } from './UnlimitedScreen';

const NOV2 = () => new Date(2026, 10, 2, 9);
const UNLIMITED = 'ttg:wordpath:unlimited-results';

/** Serves the index and `wp-u-<level>-<n>` puzzles; `broken` numbers 404. Records every request. */
function serve(count: Record<string, number> | null, broken: number[] = []) {
  const requested: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requested.push(url);
      if (url.endsWith('/index.json')) return count ? Response.json({ count }) : new Response('', { status: 404 });
      const m = /unlimited\/(\w+)\/(\d+)\.json$/.exec(url);
      if (!m || broken.includes(Number(m[2]))) return new Response('', { status: 404 });
      return Response.json(makeTestPuzzle({ id: `wp-u-${m[1]}-${m[2]}`, seedKey: m[1], level: m[1] as wordpathV1.Level }));
    }),
  );
  return requested;
}

/** Every test puzzle of a level shares its grid (seeded by level), so one route solves any of them. */
const routes = (level: wordpathV1.Level) => wordpathV1.parsePuzzle(makeTestPuzzle({ seedKey: level, level }))!.solutions[7]!;
const solution = routes('hard');
const tilesOf = (c: HTMLElement) => [...c.querySelectorAll<HTMLButtonElement>('.tile')];
const ready = (c: HTMLElement) => waitFor(() => expect(tilesOf(c)).toHaveLength(49)); // past the 6×6 probe

async function tap(c: HTMLElement, cells: number[]) {
  for (const cell of cells) await userEvent.click(tilesOf(c)[cell]!);
}

function open(level: wordpathV1.Level = 'hard') {
  const onBack = vi.fn<() => void>();
  const view = render(<UnlimitedScreen level={level} now={NOV2} onBack={onBack} />);
  return { ...view, onBack };
}

beforeEach(() => {
  localStorage.setItem('ttg:wordpath:seen-howto', 'true');
  stubLayout(338, 600, false);
  serve({ easy: 4, normal: 4, hard: 4 });
});

describe('UnlimitedScreen', () => {
  it('reads "Unlimited · Hard" with no streak, and loads only Hard puzzles', async () => {
    const requested = serve({ easy: 4, normal: 4, hard: 4 });
    const { container } = open();
    expect(screen.getByRole('heading', { level: 1, name: 'Word Path' })).toBeInTheDocument();
    expect(screen.getByText('Unlimited · Hard')).toBeInTheDocument();
    await ready(container);
    expect(container.querySelector('.streak')).toBeNull();
    const files = requested.filter((u) => !u.endsWith('index.json'));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\/unlimited\/hard\/[1-4]\.json$/);
  });

  it('Back calls onBack with the puzzle still saved', async () => {
    const { container, onBack } = open();
    await ready(container);
    await tap(container, solution.slice(0, 2));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(loadActive(unlimitedKeys('hard').active)?.state.route).toEqual(solution.slice(0, 2));
  });

  it('solves three puzzles in a row with Next puzzle, recording only under unlimited-results', async () => {
    const { container } = open();
    for (let i = 0; i < 3; i++) {
      if (i > 0) await userEvent.click(screen.getByRole('button', { name: /^Next Hard puzzle/ }));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Solved' })).toBeNull());
      await ready(container);
      await tap(container, solution);
      expect(await screen.findByRole('heading', { name: 'Solved' })).toBeInTheDocument();
    }
    expect(Object.keys(loadResults(UNLIMITED))).toHaveLength(3);
    expect(Object.keys(loadResults(UNLIMITED)).every((id) => /^wp-u-hard-[1-4]$/.test(id))).toBe(true);
    expect(localStorage.getItem('ttg:wordpath:results')).toBeNull();
    expect(localStorage.getItem(DAILY.active)).toBeNull();
    expect(loadActive(unlimitedKeys('hard').active)).toBeNull();
  });

  it('says "the answer", not "today\'s answer", for a wrong route', async () => {
    const { container } = open();
    await ready(container);
    await tap(container, [...solution].reverse());
    expect(await screen.findByText(/is not the answer$/)).toBeInTheDocument();
    expect(screen.queryByText(/today's answer/)).toBeNull();
  });

  it('shows the result with "the answer", Next Hard puzzle, and Change level, which calls onBack', async () => {
    const { container, onBack } = open();
    await ready(container);
    await tap(container, solution);
    await screen.findByRole('heading', { name: 'Solved' });
    expect(screen.getByText('The answer is MANGO.')).toBeInTheDocument();
    expect(screen.queryByText(/today's/)).toBeNull();
    expect(screen.queryByText(/Next daily puzzle/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Change level' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('restores the route and counters after a reload mid-puzzle', async () => {
    const first = open();
    await ready(first.container);
    await tap(first.container, solution.slice(0, 2));
    const id = loadActive(unlimitedKeys('hard').active)!.puzzleId;
    first.unmount();

    const requested = serve({ easy: 4, normal: 4, hard: 4 });
    const again = open();
    await ready(again.container);
    expect(again.container.querySelectorAll('.tile[data-selected]')).toHaveLength(2);
    expect(requested.some((u) => u.endsWith('/index.json'))).toBe(false); // resumed, not picked
    expect(requested.filter((u) => u.endsWith('.json'))).toEqual([`/wordpath/unlimited/hard/${id.split('-').at(-1)}.json`]);
  });

  it('leaving Normal mid-route, playing Hard, then opening Normal again restores the Normal puzzle', async () => {
    const normal = open('normal');
    await ready(normal.container);
    await tap(normal.container, routes('normal').slice(0, 3));
    const saved = loadActive(unlimitedKeys('normal').active)!;
    normal.unmount();

    const hard = open('hard');
    await ready(hard.container);
    await tap(hard.container, solution.slice(0, 1));
    hard.unmount();
    expect(loadActive(unlimitedKeys('normal').active)).toMatchObject({ puzzleId: saved.puzzleId, state: saved.state });

    const back = open('normal');
    await ready(back.container);
    expect(back.container.querySelectorAll('.tile[data-selected]')).toHaveLength(3);
    expect(loadActive(unlimitedKeys('normal').active)!.puzzleId).toBe(saved.puzzleId);
  });

  it('shows "No Hard puzzles yet" with a way back when there is no index', async () => {
    serve(null);
    const { onBack } = open();
    expect(await screen.findByRole('heading', { name: 'No Hard puzzles yet' })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows the same message when this level has no puzzles', async () => {
    serve({ easy: 4, normal: 4, hard: 0 });
    open();
    expect(await screen.findByRole('heading', { name: 'No Hard puzzles yet' })).toBeInTheDocument();
  });

  it('skips a broken puzzle file and loads another', async () => {
    serve({ easy: 0, normal: 0, hard: 2 }, [1]);
    const { container, unmount } = open();
    await ready(container);
    expect(screen.getByText(makeTestPuzzle().clue)).toBeInTheDocument();
    unmount(); // leaving saves where it stood
    expect(loadActive(unlimitedKeys('hard').active)?.puzzleId).toBe('wp-u-hard-2');
  });

  it('gives up after four failed files and shows the message', async () => {
    const requested = serve({ easy: 0, normal: 0, hard: 9 }, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    open();
    expect(await screen.findByRole('heading', { name: 'No Hard puzzles yet' })).toBeInTheDocument();
    expect(requested.filter((u) => u.endsWith('.json') && !u.endsWith('index.json'))).toHaveLength(4);
  });

  it('is not fooled by a saved session for a puzzle it cannot load: it picks a new one', async () => {
    localStorage.setItem(unlimitedKeys('hard').active, JSON.stringify({ puzzleId: 'wp-u-hard-9', date: '2026-11-01', size: 7, elapsedMs: 1000, state: wordpathV1.initialState() }));
    serve({ easy: 0, normal: 0, hard: 2 }, [9]);
    const { container, unmount } = open();
    await ready(container);
    unmount();
    expect(loadActive(unlimitedKeys('hard').active)?.puzzleId).toMatch(/^wp-u-hard-[12]$/);
  });

  it('labels a replay once every puzzle has been seen', async () => {
    serve({ easy: 0, normal: 0, hard: 2 });
    for (const n of [1, 2]) {
      saveResult(UNLIMITED, { id: `wp-u-hard-${n}`, date: '2026-11-01', outcome: 'solved', timeMs: 30_000, wrongAttempts: 0, size: 7, level: 'hard' });
    }
    const { container } = open();
    await ready(container);
    expect(screen.getByText("You've played every puzzle. New ones arrive daily, so here's one again.")).toBeInTheDocument();
  });

  it('prefers a puzzle not yet played', async () => {
    serve({ easy: 0, normal: 0, hard: 2 });
    saveResult(UNLIMITED, { id: 'wp-u-hard-1', date: '2026-11-01', outcome: 'solved', timeMs: 30_000, wrongAttempts: 0, size: 7, level: 'hard' });
    const { container } = open();
    await ready(container);
    expect(screen.queryByText(/played every puzzle/)).toBeNull();
    await tap(container, solution);
    await screen.findByRole('heading', { name: 'Solved' });
    expect(Object.keys(loadResults(UNLIMITED)).sort()).toEqual(['wp-u-hard-1', 'wp-u-hard-2']);
  });

  it('opens Stats and How to play from the header', async () => {
    const { container } = open();
    await ready(container);
    await userEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(within(screen.getByRole('dialog', { name: 'Stats' })).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await userEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeInTheDocument();
  });
});
