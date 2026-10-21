import { wordpathV1 } from '@ttg/engine';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubLayout } from '../../test/layout';
import { makeTestPuzzle } from '../../test/testPuzzle';
import { PuzzlePlayer } from './PuzzlePlayer';
import { loadResults, saveResult, type ResultRecord } from './results';
import { DAILY, loadActive, saveActive, type ActiveSession } from './session';

const DATE = '2026-11-01';
const puzzle = makeTestPuzzle({ id: `wp-${DATE}`, date: DATE });
const { solutions } = wordpathV1.parsePuzzle(puzzle)!;

type Props = ComponentProps<typeof PuzzlePlayer>;

function play(props: Partial<Props> = {}) {
  const onDone = vi.fn<(r: ResultRecord) => void>();
  const view = render(
    <PuzzlePlayer keys={DAILY} puzzle={puzzle} solutions={solutions} date={DATE} resume={null} onDone={onDone} {...props} />,
  );
  const tiles = () => [...view.container.querySelectorAll<HTMLButtonElement>('.tile')];
  const tile = () => parseFloat(view.container.querySelector<HTMLElement>('.plot')!.style.getPropertyValue('--t'));
  const selected = () => tiles().flatMap((t, i) => (t.hasAttribute('data-selected') ? [i] : []));
  return { ...view, onDone, tiles, tile, selected };
}

/** A straight run along one row that is not the solution: always adjacent, always wrong. */
function wrongRoute(size: number): number[] {
  for (let r = 0; r < size; r++) {
    const route = [0, 1, 2, 3, 4].map((c) => r * size + c);
    if (route.join() !== solutions[size]!.join()) return route;
  }
  throw new Error('no wrong route');
}

afterEach(() => vi.useRealTimers());

describe('PuzzlePlayer board size (N8)', () => {
  it('locks 15×15 from the first mouse measurement; resizing and pointer changes only rescale the tile', () => {
    const layout = stubLayout(940, 700, true);
    const { tiles, tile } = play();
    expect(tiles()).toHaveLength(225);
    expect(tile()).toBeCloseTo(700 / 15);

    layout.resize(600, 400);
    expect(tiles()).toHaveLength(225);
    expect(tile()).toBeCloseTo(400 / 15);

    layout.setFine(false);
    expect(tiles()).toHaveLength(225);
    expect(tile()).toBeCloseTo(600 / 15);
  });

  it('falls back to 10×10 when a mouse slot is too short for 15×15', () => {
    stubLayout(940, 500, true);
    expect(play().tiles()).toHaveLength(100);
  });

  it('gives a 338px touch slot 7×7 at 48px', () => {
    stubLayout(338, 600, false);
    const { tiles, tile } = play();
    expect(tiles()).toHaveLength(49);
    expect(tile()).toBe(48);
  });

  it('waits for a real measurement: nothing is playable or saved before the slot has a width', async () => {
    const layout = stubLayout(0, 0, true);
    const { container, tiles } = play();
    expect(container.querySelector('.play')).toHaveAttribute('data-probe');
    expect(container.querySelector('.play')).toHaveAttribute('inert');
    layout.resize(940, 700);
    expect(container.querySelector('.play')).not.toHaveAttribute('data-probe');
    expect(tiles()).toHaveLength(225);
    await userEvent.click(tiles()[0]!);
    expect(loadActive(DAILY.active)?.size).toBe(15);
  });
});

describe('PuzzlePlayer saving', () => {
  it('comes back after unmount with the same route, counters, and size', async () => {
    const layout = stubLayout(940, 700, true);
    const user = userEvent.setup();
    const first = play();
    const sol = solutions[15]!;
    for (const c of wrongRoute(15)) await user.click(first.tiles()[c]!);
    await user.click(first.tiles()[sol[0]!]!);
    await user.click(first.tiles()[sol[1]!]!);
    const saved = loadActive(DAILY.active)!;
    expect(saved).toMatchObject({ puzzleId: puzzle.id, date: DATE, size: 15, state: { route: sol.slice(0, 2), wrongAttempts: 1 } });
    first.unmount();

    // A slot that would pick another size: the saved size wins.
    layout.resize(338, 600);
    layout.setFine(false);
    const second = play({ resume: loadActive(DAILY.active) });
    expect(second.tiles()).toHaveLength(225);
    expect(second.selected()).toEqual([...sol.slice(0, 2)].sort((a, b) => a - b));
    await user.click(second.tiles()[sol[2]!]!);
    const again = loadActive(DAILY.active)!;
    expect(again).toMatchObject({ size: 15, state: { route: sol.slice(0, 3), wrongAttempts: 1 } });
    expect(again.elapsedMs).toBeGreaterThanOrEqual(saved.elapsedMs);
  });

  it('saves the clock when the page hides', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubLayout(940, 700, true);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { tiles } = play();
    await user.click(tiles()[solutions[15]![0]!]!);
    vi.advanceTimersByTime(30_000);
    window.dispatchEvent(new Event('pagehide'));
    expect(loadActive(DAILY.active)!.elapsedMs).toBeGreaterThanOrEqual(30_000);
  });

  it('on a solve stores the result, clears the session, and reports it', async () => {
    stubLayout(338, 600, false);
    const user = userEvent.setup();
    const { tiles, onDone } = play();
    for (const c of solutions[7]!) await user.click(tiles()[c]!);
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone.mock.lastCall![0]).toMatchObject({ id: puzzle.id, date: DATE, outcome: 'solved', wrongAttempts: 0, size: 7, level: 'normal' });
    expect(JSON.parse(localStorage.getItem(DAILY.results)!)[puzzle.id]).toEqual(onDone.mock.lastCall![0]);
    expect(loadActive(DAILY.active)).toBeNull();
  });
});

describe('PuzzlePlayer clock', () => {
  it('a solve after the wall clock steps backward saves a valid result and keeps the existing ones', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubLayout(338, 600, false);
    const earlier: ResultRecord = { id: 'wp-2026-10-31', date: '2026-10-31', outcome: 'solved', timeMs: 9000, wrongAttempts: 0, size: 7, level: 'normal' };
    saveResult(DAILY.results, earlier);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { tiles, onDone } = play();
    const route = solutions[7]!;
    await user.click(tiles()[route[0]!]!);
    vi.advanceTimersByTime(5000);
    vi.setSystemTime(Date.now() - 3_600_000);
    for (const c of route.slice(1)) await user.click(tiles()[c]!);
    expect(onDone.mock.lastCall![0].timeMs).toBeGreaterThanOrEqual(5000);
    expect(loadResults(DAILY.results)).toEqual({ [earlier.id]: earlier, [puzzle.id]: onDone.mock.lastCall![0] });
  });
});

describe('PuzzlePlayer resume guard (R-C9)', () => {
  const session = (over: Partial<ActiveSession>): ActiveSession => ({
    puzzleId: puzzle.id,
    date: DATE,
    size: 15,
    elapsedMs: 5000,
    state: { route: [0, 1], status: 'playing', wrongAttempts: 2, wrong: null },
    ...over,
  });

  it.each([
    ['another puzzle', session({ puzzleId: 'wp-2026-10-31' })],
    ['a size the engine does not build', session({ size: 11 })],
    ['a route cell off the board', session({ size: 6, state: { route: [35, 36], status: 'playing', wrongAttempts: 0, wrong: null } })],
    ['a wrong-route cell off the board', session({ size: 6, state: { route: [], status: 'playing', wrongAttempts: 1, wrong: { route: [40], word: 'M' } } })],
  ])('drops a saved session for %s and starts fresh', (_, bad) => {
    stubLayout(940, 700, true);
    saveActive(DAILY.active, bad);
    const { tiles, selected } = play({ resume: bad });
    expect(loadActive(DAILY.active)).toBeNull();
    expect(tiles()).toHaveLength(225);
    expect(selected()).toEqual([]);
  });
});
