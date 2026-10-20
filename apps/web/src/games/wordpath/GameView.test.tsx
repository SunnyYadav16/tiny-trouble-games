import { wordpathV1 } from '@ttg/engine';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeTestPuzzle } from '../../test/testPuzzle';
import { GameView } from './GameView';

const { WRONG_MS, initialState, spell } = wordpathV1;

const puzzle = makeTestPuzzle();
const parsed = wordpathV1.parsePuzzle(puzzle)!;
const SIZE = 6;
const game: wordpathV1.Game = { size: SIZE, cells: puzzle.grids[SIZE]!, solution: parsed.solutions[SIZE]! };
const ANSWER = spell(game.cells, game.solution);

/** A straight run along one row that is not the solution: always adjacent, always wrong. */
const wrong = (() => {
  for (let r = 0; r < SIZE; r++) {
    const route = [0, 1, 2, 3, 4].map((c) => r * SIZE + c);
    if (route.join() !== game.solution.join()) return route;
  }
  throw new Error('no wrong route');
})();
const WRONG_WORD = spell(game.cells, wrong);

type Props = ComponentProps<typeof GameView>;

function setup(props: Partial<Props> = {}) {
  const onChange = vi.fn<(s: wordpathV1.State) => void>();
  const onFinish = vi.fn<(s: wordpathV1.State) => void>();
  const user = userEvent.setup({ delay: null });
  const all: Props = { game, clue: puzzle.clue, length: ANSWER.length, tile: 46, onChange, onFinish, ...props };
  const view = render(<GameView {...all} />);
  const tiles = () => [...view.container.querySelectorAll<HTMLButtonElement>('.tile')];
  const tile = (cell: number) => tiles()[cell]!;
  const tapRoute = async (route: readonly number[]) => {
    for (const c of route) await user.click(tile(c));
  };
  return { ...view, user, onChange, onFinish, tiles, tile, tapRoute };
}

const stones = (c: HTMLElement) => [...c.querySelectorAll('.stoneb')].map((s) => s.textContent);
const resline = (c: HTMLElement) => c.querySelector('.resline')!;

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => vi.useRealTimers());

describe('GameView', () => {
  it('shows the clue under a "Clue" label and one empty stone per letter, without writing out the length', () => {
    const { container } = setup();
    expect(screen.getByText('Clue')).toBeInTheDocument();
    expect(screen.getByText(puzzle.clue)).toBeInTheDocument();
    expect(stones(container)).toEqual(['', '', '', '', '']);
    expect(container.textContent).not.toMatch(/\b5\b|five|letters/i);
  });

  it('fills the stones from the route as tiles are tapped', async () => {
    const { container, tapRoute } = setup();
    await tapRoute(game.solution.slice(0, 2));
    expect(stones(container)).toEqual([ANSWER[0], ANSWER[1], '', '', '']);
  });

  it('has no Hint button', () => {
    setup();
    expect(screen.queryByRole('button', { name: /hint/i })).toBeNull();
  });

  it('calls onChange after every tap', async () => {
    const { onChange, tapRoute } = setup();
    await tapRoute(game.solution.slice(0, 3));
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange.mock.lastCall![0].route).toEqual(game.solution.slice(0, 3));
  });

  it('shows no result line before an attempt finishes', async () => {
    const { container, tapRoute } = setup();
    await tapRoute(game.solution.slice(0, 2));
    expect(resline(container)).toBeEmptyDOMElement();
  });

  describe('solving', () => {
    it('calls onFinish once with status won, shows the solved stones with a check, and says Solved', async () => {
      const { container, tapRoute, onFinish, tiles, user } = setup();
      await tapRoute(game.solution);
      expect(onFinish).toHaveBeenCalledOnce();
      expect(onFinish.mock.lastCall![0]).toMatchObject({ status: 'won', route: game.solution });
      expect(stones(container)).toEqual([...ANSWER]);
      expect(container.querySelectorAll('.stoneb.solved')).toHaveLength(5);
      expect(container.querySelector('.stones .ok')).toHaveTextContent('Solved');
      expect(resline(container)).toHaveTextContent('Solved');
      expect(screen.getByRole('status')).toHaveTextContent('Solved');
      await user.click(tiles()[0]!);
      expect(onFinish).toHaveBeenCalledOnce();
    });

    it('keeps the same board mounted so it can celebrate', async () => {
      const { container, tapRoute } = setup();
      const board = container.querySelector('.board');
      await tapRoute(game.solution);
      expect(container.querySelector('.board')).toBe(board);
      expect(board).toHaveAttribute('data-state', 'solved');
    });
  });

  describe('a wrong route', () => {
    it('shows the spelled word in the stones and result line, then clears after WRONG_MS', async () => {
      const { container, tapRoute, tiles } = setup();
      await tapRoute(wrong);
      expect(stones(container)).toEqual([...WRONG_WORD]);
      expect(container.querySelector('.stoneb.solved')).toBeNull();
      expect(within(resline(container) as HTMLElement).getByText(WRONG_WORD)).toHaveClass('word');
      expect(resline(container)).toHaveTextContent(`${WRONG_WORD} is not today's answer`);
      expect(screen.getByRole('status')).toHaveTextContent(`${WRONG_WORD} is not the answer`);
      expect(container.querySelector('.board')).toHaveAttribute('data-state', 'wrong');
      expect(tiles().filter((t) => t.hasAttribute('data-selected'))).toHaveLength(5);

      act(() => void vi.advanceTimersByTime(WRONG_MS - 100));
      expect(stones(container)).toEqual([...WRONG_WORD]);
      act(() => void vi.advanceTimersByTime(100));
      expect(stones(container)).toEqual(['', '', '', '', '']);
      expect(resline(container)).toBeEmptyDOMElement();
      expect(container.querySelector('.board')).toHaveAttribute('data-state', 'active');
      expect(tiles().filter((t) => t.hasAttribute('data-selected'))).toHaveLength(0);
    });

    it('says "the answer" in unlimited', async () => {
      const { container, tapRoute } = setup({ unlimited: true });
      await tapRoute(wrong);
      expect(resline(container)).toHaveTextContent(`${WRONG_WORD} is not the answer`);
    });

    it('lets the next tap start a new route at once and stops the old timer', async () => {
      const { container, tapRoute, tile, onChange } = setup();
      await tapRoute(wrong);
      await tapRoute([game.solution[0]!]);
      expect(stones(container)).toEqual([ANSWER[0], '', '', '', '']);
      const calls = onChange.mock.calls.length;
      act(() => void vi.advanceTimersByTime(WRONG_MS * 2));
      expect(onChange.mock.calls.length).toBe(calls);
      expect(tile(game.solution[0]!)).toHaveAttribute('data-selected');
    });
  });

  describe('Clear and Escape', () => {
    it('Escape empties the route', async () => {
      const { container, tapRoute, user } = setup();
      await tapRoute(game.solution.slice(0, 3));
      await user.keyboard('{Escape}');
      expect(stones(container)).toEqual(['', '', '', '', '']);
      expect(screen.getByRole('status')).toHaveTextContent('Route cleared');
    });

    it('the Clear button empties the route', async () => {
      const { container, tapRoute, user } = setup();
      await tapRoute(game.solution.slice(0, 3));
      await user.click(screen.getByRole('button', { name: 'Clear' }));
      expect(stones(container)).toEqual(['', '', '', '', '']);
    });
  });

  describe('Give up', () => {
    it('asks first: No keeps playing and returns to the Give up button', async () => {
      const { onFinish, user, tapRoute } = setup();
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      expect(screen.getByText('Give up? Your streak resets.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Give up' })).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Keep playing' }));
      expect(onFinish).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Give up' })).toHaveFocus();
      await tapRoute([0]);
      expect(screen.getByRole('status')).toHaveTextContent('selected, 1 of 5');
    });

    it('Escape while asking dismisses the confirm, keeps the route, and returns to Give up', async () => {
      const { container, user, tapRoute, onChange } = setup();
      await tapRoute(game.solution.slice(0, 2));
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      const calls = onChange.mock.calls.length;
      await user.keyboard('{Escape}');
      expect(screen.queryByText('Give up? Your streak resets.')).toBeNull();
      expect(screen.getByRole('button', { name: 'Give up' })).toHaveFocus();
      expect(stones(container)).toEqual([ANSWER[0], ANSWER[1], '', '', '']);
      expect(onChange.mock.calls.length).toBe(calls);
    });

    it('Give up swaps back in with motion only after the confirm, never on first render', async () => {
      const { user } = setup();
      expect(screen.getByRole('button', { name: 'Give up' })).not.toHaveAttribute('data-returned');
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(screen.getByRole('button', { name: 'Keep playing' }));
      expect(screen.getByRole('button', { name: 'Give up' })).toHaveAttribute('data-returned');
    });

    it('unlimited asks a different question', async () => {
      const { user } = setup({ unlimited: true });
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      expect(screen.getByText('Give up? The answer will be shown.')).toBeInTheDocument();
    });

    it('Yes shows the answer, finishes once with gave-up, and ignores board taps', async () => {
      const { container, user, onFinish, onChange, tiles } = setup();
      await user.click(screen.getByRole('button', { name: 'Give up' }));
      await user.click(screen.getByRole('button', { name: 'Yes, show answer' }));
      expect(onFinish).toHaveBeenCalledOnce();
      expect(onFinish.mock.lastCall![0]).toMatchObject({ status: 'gave-up', route: game.solution });
      expect(stones(container)).toEqual([...ANSWER]);
      expect(container.querySelectorAll('.stoneb.revealed')).toHaveLength(5);
      expect(resline(container)).toHaveTextContent(`Gave up. The answer is ${ANSWER}`);
      expect(screen.getByRole('status')).toHaveTextContent('Gave up');
      expect(container.querySelector('.board')).toHaveAttribute('data-state', 'revealed');

      const calls = onChange.mock.calls.length;
      await user.click(tiles()[0]!);
      await user.keyboard('{Escape}');
      expect(onChange.mock.calls.length).toBe(calls);
      expect(stones(container)).toEqual([...ANSWER]);
    });
  });

  it('announces each selection with its place in the route', async () => {
    const { tapRoute } = setup();
    await tapRoute([game.solution[0]!]);
    expect(screen.getByRole('status')).toHaveTextContent(`${ANSWER[0]} selected, 1 of 5`);
    await tapRoute([game.solution[1]!]);
    expect(screen.getByRole('status')).toHaveTextContent(`${ANSWER[1]} selected, 2 of 5`);
  });

  describe('opening a finished attempt', () => {
    it('shows a won game as solved with no onFinish', () => {
      const initial: wordpathV1.State = { ...initialState(), route: [...game.solution], status: 'won' };
      const { container, onFinish } = setup({ initial });
      expect(container.querySelector('.board')).toHaveAttribute('data-state', 'solved');
      expect(container.querySelectorAll('.stoneb.solved')).toHaveLength(5);
      expect(resline(container)).toHaveTextContent('Solved');
      expect(onFinish).not.toHaveBeenCalled();
    });

    it('shows a given-up game as revealed', () => {
      const initial: wordpathV1.State = { ...initialState(), route: [...game.solution], status: 'gave-up' };
      const { container } = setup({ initial });
      expect(container.querySelector('.board')).toHaveAttribute('data-state', 'revealed');
      expect(resline(container)).toHaveTextContent(`Gave up. The answer is ${ANSWER}`);
    });

    it('resumes a saved route and settles a saved wrong route', () => {
      const saved: wordpathV1.State = {
        ...initialState(),
        wrongAttempts: 1,
        wrong: { route: wrong, word: WRONG_WORD },
      };
      const { container } = setup({ initial: saved });
      expect(stones(container)).toEqual([...WRONG_WORD]);
      act(() => void vi.advanceTimersByTime(WRONG_MS));
      expect(stones(container)).toEqual(['', '', '', '', '']);
    });
  });

  describe('shortcut hints', () => {
    it('are absent by default', () => {
      const { container } = setup();
      expect(container.querySelector('kbd')).toBeNull();
      expect(screen.queryByText(/Arrow keys move/)).toBeNull();
    });

    it('with showShortcuts, Clear shows Esc and one line explains the keys', () => {
      const { container } = setup({ showShortcuts: true });
      const clear = screen.getByRole('button', { name: 'Clear' });
      expect(clear).toHaveTextContent('Esc');
      expect(clear).toHaveAttribute('aria-keyshortcuts', 'Escape');
      expect(container.querySelector('.kbdline')).toBeInTheDocument();
      expect(screen.getByText(/Arrow keys move, Enter or Space selects/)).toBeInTheDocument();
    });
  });

  it('gives the board stage to the caller as the measured slot, with no padding', () => {
    const ref = { current: null as HTMLDivElement | null };
    const { container } = setup({ stageRef: ref });
    expect(ref.current).toBe(container.querySelector('.stage'));
    expect(ref.current!.contains(container.querySelector('.board'))).toBe(true);
  });
});
