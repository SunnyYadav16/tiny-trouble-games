import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import gsap from 'gsap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXAMPLE } from './example';
import { HowToPlay, seenHowTo } from './HowToPlay';

const selected = (c: HTMLElement) => [...c.querySelectorAll('.tile[data-selected]')].map((t) => [...c.querySelectorAll('.tile')].indexOf(t));

/** Turns reduced motion off for one test (the setup file turns it on). */
const withMotion = () =>
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
  );

afterEach(() => vi.restoreAllMocks());

describe('HowToPlay', () => {
  it('is a modal dialog named "How to play" with three steps', () => {
    render(<HowToPlay onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'How to play' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows the example on the 4×4 grid, hidden from keyboard and screen readers', () => {
    const { container } = render(<HowToPlay onClose={() => {}} />);
    const tiles = [...container.querySelectorAll<HTMLElement>('.tile')];
    expect(tiles.map((t) => t.textContent).join('')).toBe(EXAMPLE.cells);
    expect(tiles.every((t) => t.tabIndex === -1 && t.closest('[aria-hidden="true"]'))).toBe(true);
    expect(screen.queryByRole('grid')).toBeNull();
  });

  it('with reduced motion, creates no timeline and shows the final frame', () => {
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container } = render(<HowToPlay onClose={() => {}} />);
    expect(timeline).not.toHaveBeenCalled();
    expect(selected(container)).toEqual(EXAMPLE.solution);
    expect(screen.queryByRole('button', { name: 'Replay example' })).toBeNull(); // nothing to replay
  });

  it('plays the example once through the engine, within 5 s, and Replay plays it again', async () => {
    withMotion();
    const timeline = vi.spyOn(gsap, 'timeline');
    const { container } = render(<HowToPlay onClose={() => {}} />);
    const demo = timeline.mock.results[0]!.value as gsap.core.Timeline;
    expect(demo.duration()).toBeLessThanOrEqual(5);
    expect(selected(container)).toEqual([]);
    act(() => void demo.progress(1));
    expect(selected(container)).toEqual(EXAMPLE.solution);

    await userEvent.click(screen.getByRole('button', { name: 'Replay example' }));
    expect(selected(container)).toEqual([]);
    const again = timeline.mock.results.at(-1)!.value as gsap.core.Timeline;
    expect(again).not.toBe(demo);
    act(() => void again.progress(1));
    expect(selected(container)).toEqual(EXAMPLE.solution);
  });

  it('closes from Got it, Close, and Escape, and closing marks it seen', async () => {
    const onClose = vi.fn<() => void>();
    render(<HowToPlay onClose={onClose} />);
    expect(seenHowTo()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(seenHowTo()).toBe(true);
    expect(localStorage.getItem('ttg:wordpath:seen-howto')).toBe('true');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog', { name: 'How to play' }), cancel);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(cancel.defaultPrevented).toBe(true);
  });
});
