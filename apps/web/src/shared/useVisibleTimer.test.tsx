import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisibleTimer } from './useVisibleTimer';

const probe: { elapsed: () => number } = { elapsed: () => NaN };
function Probe({ initial, running }: { initial: number; running: boolean }) {
  const timer = useVisibleTimer(initial, running);
  useEffect(() => {
    probe.elapsed = timer.elapsed;
  }, [timer]);
  return null;
}
const elapsed = () => probe.elapsed();

let visibility: DocumentVisibilityState = 'visible';
function setVisibility(v: DocumentVisibilityState) {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useVisibleTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('counts visible time only: 3s visible + 5s hidden + 2s visible = 5000', () => {
    render(<Probe initial={0} running />);
    act(() => void vi.advanceTimersByTime(3000));
    act(() => setVisibility('hidden'));
    act(() => void vi.advanceTimersByTime(5000));
    act(() => setVisibility('visible'));
    act(() => void vi.advanceTimersByTime(2000));
    expect(elapsed()).toBe(5000);
  });

  it('starts from the initial elapsed time', () => {
    render(<Probe initial={1200} running />);
    act(() => void vi.advanceTimersByTime(800));
    expect(elapsed()).toBe(2000);
  });

  it('accrues nothing while not running', () => {
    render(<Probe initial={700} running={false} />);
    act(() => void vi.advanceTimersByTime(4000));
    expect(elapsed()).toBe(700);
  });

  it('stops accruing when running turns false and resumes when true again', () => {
    const { rerender } = render(<Probe initial={0} running />);
    act(() => void vi.advanceTimersByTime(1000));
    rerender(<Probe initial={0} running={false} />);
    act(() => void vi.advanceTimersByTime(3000));
    expect(elapsed()).toBe(1000);
    rerender(<Probe initial={0} running />);
    act(() => void vi.advanceTimersByTime(500));
    expect(elapsed()).toBe(1500);
  });

  it('does not start counting if the page is hidden at mount', () => {
    visibility = 'hidden';
    render(<Probe initial={0} running />);
    act(() => void vi.advanceTimersByTime(2000));
    expect(elapsed()).toBe(0);
    act(() => setVisibility('visible'));
    act(() => void vi.advanceTimersByTime(1000));
    expect(elapsed()).toBe(1000);
  });
});
