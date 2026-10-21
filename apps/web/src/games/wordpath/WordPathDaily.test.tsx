import { wordpathV1 } from '@ttg/engine';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { stubLayout } from '../../test/layout';
import { makeTestPuzzle } from '../../test/testPuzzle';
import { saveResult, loadResults } from './results';
import { DAILY, loadActive, saveActive } from './session';
import { WordPathDaily } from './WordPathDaily';

const NOV1 = makeTestPuzzle({ id: 'wp-2026-11-01', date: '2026-11-01' });
const NOV2 = makeTestPuzzle({ id: 'wp-2026-11-02', date: '2026-11-02' });
const NOV3 = makeTestPuzzle({ id: 'wp-2026-11-03', date: '2026-11-03' });
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
  // The clue shows while the board is still probing at 6×6; taps before the 7×7 board is up are lost.
  const ready = () => waitFor(() => expect(tiles()).toHaveLength(49));
  return { ...view, onBack, onUnlimited, tiles, ready };
}

beforeEach(() => {
  stubLayout(338, 600, false); // touch: 7×7
});

describe('WordPathDaily', () => {
  it("plays today's puzzle under a header with the date", async () => {
    const fetch = serve({ '/wordpath/2026-11-02.json': NOV2 });
    const { ready, onBack } = open();
    expect(screen.getByRole('heading', { level: 1, name: 'Word Path' })).toBeInTheDocument();
    expect(screen.getByText('Nov 2')).toBeInTheDocument();
    await screen.findByText(NOV2.clue);
    await ready();
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

  it('on a solve: moves focus to the result, shows time and wrong tries, and lifts the header streak', async () => {
    saveResult(DAILY.results, { id: 'wp-2026-11-01', date: '2026-11-01', outcome: 'solved', timeMs: 9000, wrongAttempts: 0, size: 7, level: 'normal' });
    serve({ '/wordpath/2026-11-02.json': NOV2 });
    const user = userEvent.setup();
    const { tiles, ready } = open();
    await ready();
    expect(screen.getByText('1-day streak')).toBeInTheDocument();
    for (const c of solve(NOV2, 7)) await user.click(tiles()[c]!);

    const heading = await screen.findByRole('heading', { name: 'Solved' });
    expect(heading).toHaveFocus();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Wrong tries')).toBeInTheDocument();
    expect(screen.getByText(/Next daily puzzle in/)).toBeInTheDocument();
    expect(screen.getByText('2-day streak')).toBeInTheDocument();
    expect(tiles()).toHaveLength(49); // the board stays on the stage
  });

  it('does not move focus when a finished daily is reopened', async () => {
    saveResult(DAILY.results, { id: 'wp-2026-11-02', date: '2026-11-02', outcome: 'solved', timeMs: 41_000, wrongAttempts: 1, size: 7, level: 'normal' });
    serve({ '/wordpath/2026-11-02.json': NOV2 });
    open();
    expect(await screen.findByRole('heading', { name: 'Solved' })).not.toHaveFocus();
  });

  it('opens Stats from the header and from the result, and Escape returns focus to the opener', async () => {
    saveResult(DAILY.results, { id: 'wp-2026-11-02', date: '2026-11-02', outcome: 'gave-up', timeMs: 187_000, wrongAttempts: 4, size: 7, level: 'normal' });
    serve({ '/wordpath/2026-11-02.json': NOV2 });
    const user = userEvent.setup();
    open();
    await screen.findByRole('heading', { name: 'Gave up' });
    const opener = within(screen.getByRole('banner')).getByRole('button', { name: 'Stats' });
    await user.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Stats' });
    expect(within(dialog).getByRole('region', { name: 'Daily' })).toHaveTextContent('Played1');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();

    await user.click(within(screen.getByRole('main')).getByRole('button', { name: 'Stats' }));
    expect(screen.getByRole('dialog', { name: 'Stats' })).toBeInTheDocument();
  });

  it("offers today's puzzle on the result once midnight passes, and opens it", async () => {
    saveResult(DAILY.results, { id: NOV2.id, date: '2026-11-02', outcome: 'solved', timeMs: 5000, wrongAttempts: 0, size: 7, level: 'normal' });
    serve({ '/wordpath/2026-11-02.json': NOV2, '/wordpath/2026-11-03.json': NOV3 });
    let t = new Date(2026, 10, 2, 23, 59, 59);
    render(<WordPathDaily now={() => t} onBack={() => {}} onUnlimited={() => {}} />);
    await screen.findByRole('heading', { name: 'Solved' });
    t = new Date(2026, 10, 3, 0, 0, 1);
    fireEvent.click(await screen.findByRole('button', { name: "Play today's puzzle" }, { timeout: 3000 }));
    expect(await screen.findByText('Nov 3')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Solved' })).toBeNull());
    expect(await screen.findByRole('button', { name: 'Give up' })).toBeInTheDocument(); // playing today's puzzle
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
    const { tiles, ready } = open();
    await ready();
    await userEvent.click(tiles()[solve(NOV2, 7)[0]!]!);
    expect(loadActive(DAILY.active)).toMatchObject({ puzzleId: NOV2.id, date: '2026-11-02', size: 7, state: { route: [solve(NOV2, 7)[0]] } });
  });

  it("removes an earlier day's session whose file is gone and plays today's puzzle", async () => {
    saveActive(DAILY.active, { puzzleId: NOV1.id, date: '2026-11-01', size: 7, elapsedMs: 0, state: wordpathV1.initialState() });
    serve({ '/wordpath/2026-11-02.json': NOV2 });
    open();
    await screen.findByText(NOV2.clue);
    expect(screen.getByText('Nov 2')).toBeInTheDocument();
    expect(localStorage.getItem('ttg:wordpath:active')).toBeNull();
  });

  it.each([
    ['the network fails', () => Promise.reject(new TypeError('offline'))],
    ['the server answers 503', () => Promise.resolve(new Response('', { status: 503 }))],
  ])("keeps an earlier day's session when %s", async (_, fail) => {
    const route = solve(NOV1, 7).slice(0, 2);
    const state = { ...wordpathV1.initialState(), route, wrongAttempts: 1 };
    saveActive(DAILY.active, { puzzleId: NOV1.id, date: '2026-11-01', size: 7, elapsedMs: 4000, state });
    vi.stubGlobal('fetch', vi.fn(fail));
    open();
    await screen.findByRole('heading', { name: "Couldn't load the puzzle" });
    expect(loadActive(DAILY.active)).toMatchObject({ puzzleId: NOV1.id, elapsedMs: 4000, state: { route, wrongAttempts: 1 } });
  });

  it('removes an earlier day session that is already finished and plays today', async () => {
    saveResult(DAILY.results, { id: NOV1.id, date: '2026-11-01', outcome: 'solved', timeMs: 5000, wrongAttempts: 0, size: 7, level: 'normal' });
    saveActive(DAILY.active, { puzzleId: NOV1.id, date: '2026-11-01', size: 7, elapsedMs: 0, state: wordpathV1.initialState() });
    serve({ '/wordpath/2026-11-01.json': NOV1, '/wordpath/2026-11-02.json': NOV2 });
    open();
    await screen.findByText(NOV2.clue);
    expect(screen.queryByRole('heading', { name: 'Solved' })).toBeNull();
    expect(localStorage.getItem('ttg:wordpath:active')).toBeNull();
  });

  it.each([
    ['the network fails', () => Promise.reject(new TypeError('offline'))],
    ['the server answers 503', () => Promise.resolve(new Response('', { status: 503 }))],
  ])("keeps today's session when %s, and resumes it on the next open", async (_, fail) => {
    const route = solve(NOV2, 7).slice(0, 2);
    const state = { ...wordpathV1.initialState(), route, wrongAttempts: 2 };
    saveActive(DAILY.active, { puzzleId: NOV2.id, date: '2026-11-02', size: 7, elapsedMs: 9000, state });
    vi.stubGlobal('fetch', vi.fn(fail));
    const first = open();
    await screen.findByRole('heading', { name: "Couldn't load the puzzle" });
    expect(loadActive(DAILY.active)).toMatchObject({ elapsedMs: 9000, state: { route, wrongAttempts: 2 } });
    first.unmount();

    serve({ '/wordpath/2026-11-02.json': NOV2 });
    const { tiles } = open();
    await screen.findByText(NOV2.clue);
    expect(tiles().flatMap((t, i) => (t.hasAttribute('data-selected') ? [i] : []))).toEqual(route);
    window.dispatchEvent(new Event('pagehide'));
    expect(loadActive(DAILY.active)).toMatchObject({ state: { route, wrongAttempts: 2 } });
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

  it('opens how to play from the header', async () => {
    serve({ '/wordpath/2026-11-02.json': NOV2 });
    open();
    await screen.findByText(NOV2.clue);
    await userEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
