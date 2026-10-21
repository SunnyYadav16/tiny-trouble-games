import { wordpathV1 } from '@ttg/engine';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import gsap from 'gsap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE } from './example';
import { Home } from './Home';
import { saveResult, type ResultRecord } from './results';
import { DAILY, saveActive } from './session';

const NOV2 = new Date(2026, 10, 2, 9, 30);
const rec = (date: string, over: Partial<ResultRecord> = {}): ResultRecord => ({
  id: `wp-${date}`, date, outcome: 'solved', timeMs: 41_000, wrongAttempts: 0, size: 7, level: 'normal', ...over,
});

function open() {
  const onOpen = vi.fn<() => void>();
  const view = render(<Home now={() => NOV2} onOpen={onOpen} />);
  return { ...view, onOpen, card: () => screen.getByRole('link') };
}

afterEach(() => vi.restoreAllMocks());

describe('Home', () => {
  it('shows one game card, titled, with a 16-tile preview hidden from keyboard and screen readers', () => {
    const { container } = open();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Word Path' })).toBeInTheDocument();
    const tiles = [...container.querySelectorAll<HTMLElement>('.tile')];
    expect(tiles.map((t) => t.textContent).join('')).toBe(EXAMPLE.cells);
    expect(tiles.every((t) => t.tabIndex === -1 && t.closest('[aria-hidden="true"]'))).toBe(true);
    expect(screen.queryByRole('grid')).toBeNull(); // no game board
    expect(screen.getByText('More puzzles from this collection are on the way.')).toBeInTheDocument();
  });

  it('is a single link with no buttons inside it, and opening it calls onOpen', async () => {
    const { card, onOpen } = open();
    expect(within(card()).queryAllByRole('button')).toEqual([]);
    expect(card().querySelectorAll('button, input, select, textarea, a')).toHaveLength(0);
    await userEvent.click(card());
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('reads "Not played yet" before today is started, with no streak', () => {
    const { card } = open();
    expect(screen.getByText('Not played yet')).toBeInTheDocument();
    expect(card()).toHaveAccessibleName('Play Word Path'); // WCAG 2.5.3: the name is the link's visible text
    expect(card()).toHaveAccessibleDescription('Mon, Nov 2 Not played yet');
  });

  it('reads "In progress" when today is saved unfinished', () => {
    saveActive(DAILY.active, { puzzleId: 'wp-2026-11-02', date: '2026-11-02', size: 7, elapsedMs: 9_000, state: wordpathV1.initialState() });
    const { card } = open();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(card()).toHaveAccessibleDescription('Mon, Nov 2 In progress');
  });

  it('labels an earlier day\'s unfinished session with that day, not today', () => {
    saveActive(DAILY.active, { puzzleId: 'wp-2026-10-19', date: '2026-10-19', size: 7, elapsedMs: 9_000, state: wordpathV1.initialState() });
    const { card } = open();
    expect(card()).toHaveAccessibleDescription('Mon, Oct 19 In progress');
    expect(screen.getByText('Mon, Oct 19')).toBeInTheDocument();
  });

  it('reads "Solved in 0:41" with the streak once today is solved', () => {
    saveResult(DAILY.results, rec('2026-11-01', { timeMs: 70_000 }));
    saveResult(DAILY.results, rec('2026-11-02'));
    const { card } = open();
    expect(screen.getByText('Solved in 0:41')).toBeInTheDocument();
    expect(card()).toHaveAccessibleDescription('Mon, Nov 2 Solved in 0:41 2-day streak');
  });

  it('reads "Gave up" for a given-up daily', () => {
    saveResult(DAILY.results, rec('2026-11-02', { outcome: 'gave-up' }));
    const { card } = open();
    expect(screen.getByText('Gave up')).toBeInTheDocument();
    expect(card()).toHaveAccessibleDescription('Mon, Nov 2 Gave up');
  });

  it('opens how to play from the top bar', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'How to play' }));
    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('traces the example route when it first shows, and again on focus once the first trace is done', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
    );
    const timeline = vi.spyOn(gsap, 'timeline');
    const { card } = open();
    expect(timeline).toHaveBeenCalledTimes(1);
    const first = timeline.mock.results[0]!.value as gsap.core.Timeline;
    fireEvent.mouseEnter(card()); // still tracing: no restart
    expect(timeline).toHaveBeenCalledTimes(1);
    act(() => void first.progress(1));
    fireEvent.focus(card());
    expect(timeline).toHaveBeenCalledTimes(2);
  });

  it('with reduced motion, shows the traced route and never animates', () => {
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container, card } = open();
    fireEvent.mouseEnter(card());
    expect(timeline).not.toHaveBeenCalled();
    expect(container.querySelectorAll('.tile[data-selected]')).toHaveLength(EXAMPLE.solution.length);
  });
});
