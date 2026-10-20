import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultRecord } from './results';
import { ResultScreen } from './ResultScreen';

const solved: ResultRecord = { id: 'wp-2026-11-02', date: '2026-11-02', outcome: 'solved', timeMs: 41_000, wrongAttempts: 1, size: 7, level: 'normal' };
const gaveUp: ResultRecord = { ...solved, outcome: 'gave-up', timeMs: 187_000, wrongAttempts: 4 };
const CLUE = 'A tropical fruit with a large stone';

function setup(props: Partial<Parameters<typeof ResultScreen>[0]> = {}) {
  const fns = { onUnlimited: vi.fn<() => void>(), onNext: vi.fn<() => void>(), onStats: vi.fn<() => void>(), onToday: vi.fn<() => void>() };
  const view = render(<ResultScreen mode="daily" result={solved} clue={CLUE} answer="MANGO" {...fns} {...props} />);
  return { ...view, ...fns };
}

beforeEach(() => vi.useFakeTimers({ now: new Date(2026, 10, 2, 9, 30, 0), shouldAdvanceTime: false }));
afterEach(() => vi.useRealTimers());

describe('ResultScreen (daily)', () => {
  it('shows the answer, the clue, and time and wrong tries as two separate numbers', () => {
    const { container } = setup();
    expect(screen.getByRole('heading', { name: 'Solved' })).toBeInTheDocument();
    expect([...container.querySelectorAll('.stoneb.solved')].map((s) => s.textContent).join('')).toBe('MANGO');
    expect(screen.getByText(CLUE)).toBeInTheDocument();
    expect(screen.getByText('Time').nextElementSibling).toHaveTextContent('0:41');
    expect(screen.getByText('Wrong tries').nextElementSibling).toHaveTextContent('1');
    expect(container.textContent).not.toMatch(/hint|score|share/i);
  });

  it('reads the answer as one sentence and hides the letter stones from assistive tech', () => {
    const { container } = setup();
    expect(screen.getByText('The answer is MANGO.')).toHaveClass('visually-hidden');
    expect(container.querySelector('.stones')!.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('a gave-up result shows the revealed answer and says the streak is back to 0', () => {
    const { container } = setup({ result: gaveUp });
    expect(screen.getByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
    expect([...container.querySelectorAll('.stoneb.revealed')].map((s) => s.textContent).join('')).toBe('MANGO');
    expect(screen.getByText('Your streak is back to 0. Wrong tries never break it; giving up does.')).toBeInTheDocument();
    expect(screen.getByText('Time').nextElementSibling).toHaveTextContent('3:07');
  });

  it('counts down to the next daily, one second at a time', () => {
    setup();
    expect(screen.getByText('14:30:00')).toBeInTheDocument();
    expect(screen.getByText(/Next daily puzzle in/)).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(1000));
    expect(screen.getByText('14:29:59')).toBeInTheDocument();
  });

  it("swaps the countdown for Play today's puzzle when midnight passes", () => {
    vi.setSystemTime(new Date(2026, 10, 2, 23, 59, 58));
    const { onToday } = setup();
    expect(screen.getByText('0:00:02')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Play today's puzzle" })).toBeNull();
    act(() => void vi.advanceTimersByTime(3000));
    const play = screen.getByRole('button', { name: "Play today's puzzle" });
    expect(screen.queryByText(/Next daily puzzle in/)).toBeNull();
    fireEvent.click(play);
    expect(onToday).toHaveBeenCalledOnce();
  });

  it("offers Play today's puzzle at once for a result from an earlier day", () => {
    setup({ result: { ...solved, date: '2026-11-01' } });
    expect(screen.getByRole('button', { name: "Play today's puzzle" })).toBeInTheDocument();
    expect(screen.queryByText(/Next daily puzzle in/)).toBeNull();
  });

  it('has Play unlimited and Stats, and nothing about sharing', () => {
    const { onUnlimited, onStats } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Play unlimited' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(onUnlimited).toHaveBeenCalledOnce();
    expect(onStats).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /share/i })).toBeNull();
  });

  it('moves focus to the heading for a fresh finish, and not for a reopened result', () => {
    const fresh = setup({ focus: true });
    expect(screen.getByRole('heading', { name: 'Solved' })).toHaveFocus();
    fresh.unmount();
    setup();
    expect(document.body).toHaveFocus();
  });
});

describe('ResultScreen (unlimited)', () => {
  const unl = { mode: 'unlimited' as const, result: { ...solved, level: 'hard' as const } };

  it('offers the next puzzle at the same level and a way back to change level, with no countdown', () => {
    const { onNext, onUnlimited } = setup(unl);
    expect(screen.queryByText(/Next daily puzzle/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stats' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next Hard puzzle' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change level' }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onUnlimited).toHaveBeenCalledOnce();
  });

  it('says nothing about the streak when an unlimited puzzle is given up', () => {
    setup({ ...unl, result: { ...gaveUp, level: 'hard' } });
    expect(screen.getByRole('heading', { name: 'Gave up' })).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).toBeNull();
  });
});
