import { wordpathV1 } from '@ttg/engine';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayPage } from './PlayPage';
import { saveResult, type ResultRecord } from './results';
import { DAILY, saveActive, unlimitedKeys } from './session';

const NOV2 = new Date(2026, 10, 2, 9, 30);
const SEEN = 'ttg:wordpath:seen-howto';
const rec = (over: Partial<ResultRecord>): ResultRecord => ({
  id: 'x', date: '2026-11-02', outcome: 'solved', timeMs: 52_000, wrongAttempts: 0, size: 7, level: 'normal', ...over,
});
const session = (date: string) => ({ puzzleId: 'p', date, size: 7, elapsedMs: 5_000, state: wordpathV1.initialState() });

/** Serves the unlimited index (or a 404 when `count` is null). */
function serveIndex(count: Record<string, number> | null) {
  vi.stubGlobal('fetch', vi.fn(async () => (count ? Response.json({ count }) : new Response('', { status: 404 }))));
}

function open() {
  const on = { onBack: vi.fn<() => void>(), onDaily: vi.fn<() => void>(), onUnlimited: vi.fn<(l: wordpathV1.Level) => void>() };
  const view = render(<PlayPage now={() => NOV2} {...on} />);
  return { ...view, ...on };
}

const today = () => screen.getByRole('region', { name: "Today's puzzle" });
const level = (name: RegExp) => screen.getByRole('button', { name });
const levels = () => ['Easy', 'Normal', 'Hard'].map((n) => level(new RegExp(`^(Play|Continue)? ?${n}\\.`)));

beforeEach(() => {
  localStorage.setItem(SEEN, 'true');
  serveIndex({ easy: 40, normal: 40, hard: 40 });
});

describe('PlayPage', () => {
  it('has a header with Back (to Home), the title, stats, and how to play', async () => {
    const { onBack } = open();
    expect(screen.getByRole('heading', { level: 1, name: 'Word Path' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.getByRole('dialog', { name: 'Stats' })).toBeInTheDocument();
  });

  it('offers Play daily before today is started', async () => {
    const { onDaily } = open();
    expect(within(today()).getByText('Not played yet')).toBeInTheDocument();
    await userEvent.click(within(today()).getByRole('button', { name: 'Play daily' }));
    expect(onDaily).toHaveBeenCalledOnce();
  });

  it('offers Continue for a saved daily', async () => {
    saveActive(DAILY.active, session('2026-11-02'));
    const { onDaily } = open();
    expect(within(today()).getByText('In progress')).toBeInTheDocument();
    await userEvent.click(within(today()).getByRole('button', { name: 'Continue' }));
    expect(onDaily).toHaveBeenCalledOnce();
  });

  it('labels an earlier day\'s saved daily with that day', () => {
    saveActive(DAILY.active, session('2026-10-19'));
    open();
    expect(within(today()).getByText('Mon, Oct 19')).toBeInTheDocument();
  });

  it('offers See result for a finished daily, with the streak', async () => {
    saveResult(DAILY.results, rec({ id: 'wp-2026-11-01', date: '2026-11-01' }));
    saveResult(DAILY.results, rec({ id: 'wp-2026-11-02', timeMs: 41_000 }));
    const { onDaily } = open();
    expect(within(today()).getByText('Solved in 0:41')).toBeInTheDocument();
    expect(today().querySelector('.streak')).toHaveTextContent(/^2-day streak$/);
    await userEvent.click(within(today()).getByRole('button', { name: 'See result' }));
    expect(onDaily).toHaveBeenCalledOnce();
  });

  it('lists the levels in order, each calling onUnlimited with its level', async () => {
    const { onUnlimited } = open();
    await waitFor(() => expect(levels().every((b) => !(b as HTMLButtonElement).disabled)).toBe(true));
    for (const b of levels()) await userEvent.click(b);
    expect(onUnlimited.mock.calls.map(([l]) => l)).toEqual(['easy', 'normal', 'hard']);
    expect(level(/^Play Easy\./)).toHaveAccessibleName(/A gentle path with a bend or two, and plain clues\./);
    expect(level(/^Play Normal\./)).toHaveAccessibleName(/Twistier paths, a few false trails, and clues that hint\. Same as the daily\./);
    expect(level(/^Play Hard\./)).toHaveAccessibleName(/The path turns at every tile, with many false trails and clues from an odd angle\./);
  });

  it('reads Continue with "In progress" for a level with a saved puzzle', async () => {
    saveActive(unlimitedKeys('normal').active, session('2026-11-02'));
    open();
    const normal = await screen.findByRole('button', { name: /^Continue Normal\./ });
    expect(within(normal.closest('.lvl')!).getByText('In progress')).toBeInTheDocument();
    expect(within(level(/^Play Easy\./).closest('.lvl')!).queryByText('In progress')).toBeNull();
  });

  it('shows solved count and average time per level', () => {
    const results = unlimitedKeys('easy').results;
    saveResult(results, rec({ id: 'e1', level: 'easy', timeMs: 52_000 }));
    saveResult(results, rec({ id: 'e2', level: 'easy', timeMs: 60_000 }));
    saveResult(results, rec({ id: 'e3', level: 'easy', outcome: 'gave-up' }));
    saveResult(results, rec({ id: 'h1', level: 'hard', timeMs: 245_000 }));
    open();
    expect(level(/^Play Easy\./)).toHaveAccessibleName(/2 solved, average 0:56\.$/);
    expect(level(/^Play Normal\./)).toHaveAccessibleName(/None solved yet\.$/);
    expect(level(/^Play Hard\./)).toHaveAccessibleName(/1 solved, average 4:05\.$/);
  });

  it('disables a level with no puzzles as "Coming soon"', async () => {
    serveIndex({ easy: 40, normal: 40, hard: 0 });
    open();
    const hard = await screen.findByRole('button', { name: /^Hard\..*Coming soon\.$/ });
    await waitFor(() => expect(level(/^Play Easy\./)).toBeEnabled());
    expect(hard).toBeDisabled();
    expect(within(hard).getByText('Coming soon')).toBeInTheDocument();
    expect(screen.queryByText("Unlimited puzzles aren't ready yet")).toBeNull();
  });

  it('disables all three when there is no unlimited index', async () => {
    serveIndex(null);
    open();
    expect(await screen.findByText("Unlimited puzzles aren't ready yet")).toBeInTheDocument();
    expect(levels().map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, true, true]);
  });

  it('draws each level as a blank 4×4 plot, hidden from screen readers', () => {
    const { container } = open();
    const minis = [...container.querySelectorAll<HTMLElement>('.mini')];
    expect(minis).toHaveLength(3);
    for (const m of minis) {
      expect(m).toHaveAttribute('aria-hidden', 'true');
      expect(m.querySelectorAll('.tile')).toHaveLength(16);
      expect(m.textContent?.trim()).toBe('');
    }
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('opens how to play on the first visit; closing it sets the flag, and the next visit stays closed', async () => {
    localStorage.removeItem(SEEN);
    const first = open();
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(SEEN)).toBe('true');
    first.unmount();

    open();
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeInTheDocument();
  });
});
