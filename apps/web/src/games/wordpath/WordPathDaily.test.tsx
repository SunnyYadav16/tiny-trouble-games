import { wordpathV1 } from '@ttg/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubLayout } from '../../test/layout';
import { makeTestPuzzle } from '../../test/testPuzzle';
import { saveResult, loadResults } from './results';
import { DAILY, loadActive, saveActive } from './session';
import { WordPathDaily } from './WordPathDaily';

const NOV1 = makeTestPuzzle({ id: 'wp-2026-11-01', date: '2026-11-01' });
const NOV2 = makeTestPuzzle({ id: 'wp-2026-11-02', date: '2026-11-02' });
const solve = (p: wordpathV1.PuzzleBody, size: number) => wordpathV1.parsePuzzle(p)!.solutions[size]!;
const SPA = '<!doctype html><html><body><div id="root"></div></body></html>';

/** Files the stubbed `fetch` serves; anything else is a 404. A string is served as a 200 text body. */
function serve(files: Record<string, unknown>) {
  const fetch = vi.fn<(url: string) => Promise<Response>>(async (url) => {
    if (!(url in files)) return new Response('', { status: 404 });
    const body = files[url];
    return typeof body === 'string' ? new Response(body, { status: 200 }) : Response.json(body);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function open(today = new Date(2026, 10, 2, 9, 30)) {
  const onBack = vi.fn<() => void>();
  const onUnlimited = vi.fn<() => void>();
  const view = render(<WordPathDaily now={() => today} onBack={onBack} onUnlimited={onUnlimited} />);
  const tiles = () => [...view.container.querySelectorAll<HTMLButtonElement>('.tile')];
  return { ...view, onBack, onUnlimited, tiles };
}

beforeEach(() => {
  stubLayout(338, 600, false); // touch: 7×7
});

describe('WordPathDaily', () => {
  it("plays today's puzzle under a header with the date", async () => {
    const fetch = serve({ '/wordpath/2026-11-02.json': NOV2 });
    const { tiles, onBack } = open();
    expect(screen.getByRole('heading', { level: 1, name: 'Word Path' })).toBeInTheDocument();
    expect(screen.getByText('Nov 2')).toBeInTheDocument();
    await screen.findByText(NOV2.clue);
    expect(tiles()).toHaveLength(49);
    expect(fetch).toHaveBeenCalledWith('/wordpath/2026-11-02.json');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('finishes a session started on an earlier day under that day, and records nothing for today', async () => {
    saveActive(DAILY.active, {
      puzzleId: NOV1.id,
      date: '2026-11-01',
      size: 6,
      elapsedMs: 12_000,
      state: wordpathV1.initialState(),
    });
    const fetch = serve({ '/wordpath/2026-11-01.json': NOV1, '/wordpath/2026-11-02.json': NOV2 });
    const user = userEvent.setup();
    const { tiles } = open();
    expect(screen.getByText('Nov 1')).toBeInTheDocument();
    await screen.findByText(NOV1.clue);
    expect(tiles()).toHaveLength(36); // the saved size, not this slot's 7×7
    for (const c of solve(NOV1, 6)) await user.click(tiles()[c]!);

    const results = loadResults(DAILY.results);
    expect(results['wp-2026-11-01']).toMatchObject({ date: '2026-11-01', outcome: 'solved', size: 6 });
    expect(results['wp-2026-11-01']!.timeMs).toBeGreaterThanOrEqual(12_000);
    expect(results['wp-2026-11-02']).toBeUndefined();
    expect(loadActive(DAILY.active)).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith('/wordpath/2026-11-02.json');
    expect(screen.getByRole('heading', { name: 'Solved' })).toBeInTheDocument();
  });

  it("reopens a finished daily on its result, with the board static and no way to replay (R-C4)", async () => {
    saveResult(DAILY.results, {
      id: 'wp-2026-11-02',
      date: '2026-11-02',
      outcome: 'gave-up',
      timeMs: 187_000,
      wrongAttempts: 4,
      size: 7,
      level: 'normal',
    });
    serve({ '/wordpath/2026-11-02.json': NOV2 });
    const { container, tiles } = open();
    expect(await screen.findByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
    expect(screen.getByText(NOV2.clue)).toBeInTheDocument();
    expect(container.querySelector('.board')).toHaveAttribute('data-state', 'revealed');
    expect(tiles()).toHaveLength(49);
    expect(tiles().every((t) => t.getAttribute('aria-disabled') === 'true')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Give up' })).toBeNull();
    await userEvent.click(tiles()[0]!);
    window.dispatchEvent(new Event('pagehide'));
    expect(loadActive(DAILY.active)).toBeNull();
  });

  it('shows the no-puzzle screen when the file is the SPA page served with 200 (R-C5)', async () => {
    serve({ '/wordpath/2026-11-02.json': SPA });
    const user = userEvent.setup();
    const { onBack, onUnlimited, tiles } = open();
    expect(await screen.findByRole('heading', { name: 'No Word Path puzzle today' })).toBeInTheDocument();
    expect(tiles()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Play unlimited' }));
    expect(onUnlimited).toHaveBeenCalledOnce();
    await user.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('starts fresh and plays when the saved session is not valid JSON', async () => {
    localStorage.setItem(DAILY.active, '{oops');
    serve({ '/wordpath/2026-11-02.json': NOV2 });
    const { tiles } = open();
    await screen.findByText(NOV2.clue);
    await userEvent.click(tiles()[solve(NOV2, 7)[0]!]!);
    expect(loadActive(DAILY.active)).toMatchObject({ puzzleId: NOV2.id, date: '2026-11-02', size: 7, state: { route: [solve(NOV2, 7)[0]] } });
  });

  it("removes a resumed session whose file is gone, so it cannot hold later days", async () => {
    saveActive(DAILY.active, { puzzleId: NOV1.id, date: '2026-11-01', size: 7, elapsedMs: 0, state: wordpathV1.initialState() });
    serve({});
    open();
    await screen.findByRole('heading', { name: 'No Word Path puzzle today' });
    expect(localStorage.getItem('ttg:wordpath:active')).toBeNull();
  });

  it.each([
    ['damaged', { ...NOV2, grids: {} }],
    ['from a newer rules version', { ...NOV2, rulesVersion: 'wordpath/v2' }],
  ])('shows a generic error with Back for a file that is %s', async (_, file) => {
    serve({ '/wordpath/2026-11-02.json': file });
    const { onBack } = open();
    expect(await screen.findByRole('heading', { name: "This puzzle won't open" })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play unlimited' })).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    expect(onBack).toHaveBeenCalledOnce();
  });
});
