import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Board } from './Board';

// 3 × 3 board, row-major:  A B C / D E F / G H I
const CELLS = 'ABCDEFGHI';
type Props = ComponentProps<typeof Board>;

function setup(props: Partial<Props> = {}) {
  const onTap = vi.fn<(cell: number) => void>();
  const all: Props = { size: 3, tile: 46, cells: CELLS, route: [], routeState: 'active', disabled: false, onTap, ...props };
  const view = render(<Board {...all} />);
  const rerender = (next: Partial<Props>) => view.rerender(<Board {...all} {...next} />);
  return { ...view, onTap, rerender };
}

const tiles = () => screen.getAllByRole('button');

/** Turns reduced motion off for one test (the setup file turns it on). */
function withMotion() {
  return vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
  );
}

describe('Board', () => {
  it('labels every tile with its letter, row, and column', () => {
    setup();
    expect(tiles().map((t) => t.getAttribute('aria-label'))).toEqual([
      'A, row 1, column 1', 'B, row 1, column 2', 'C, row 1, column 3',
      'D, row 2, column 1', 'E, row 2, column 2', 'F, row 2, column 3',
      'G, row 3, column 1', 'H, row 3, column 2', 'I, row 3, column 3',
    ]);
  });

  it('is a grid of rows of cells', () => {
    setup();
    const grid = screen.getByRole('grid');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getAllByRole('gridcell')).toHaveLength(9);
    expect(grid).toHaveAccessibleName();
  });

  it('marks route tiles as selected in the label and a data attribute, not only by color', () => {
    setup({ route: [0, 1, 4] });
    expect(screen.getByRole('button', { name: 'E, row 2, column 2, selected' })).toHaveAttribute('data-selected');
    expect(screen.getByRole('button', { name: 'A, row 1, column 1, selected' })).toHaveAttribute('data-selected');
    expect(screen.getByRole('button', { name: 'C, row 1, column 3' })).not.toHaveAttribute('data-selected');
  });

  it('gives a checkerboard parity to every tile', () => {
    setup();
    expect(tiles().map((t) => t.dataset.parity)).toEqual(['0', '1', '0', '1', '0', '1', '0', '1', '0']);
  });

  it('has exactly one tab stop', () => {
    setup();
    expect(tiles().filter((t) => t.tabIndex === 0)).toHaveLength(1);
  });

  it('moves focus with the arrow keys and stops at the edges', async () => {
    const user = userEvent.setup();
    setup();
    await user.tab();
    expect(document.activeElement).toBe(tiles()[0]);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tiles()[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(tiles()[0]);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(tiles()[1]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(tiles()[4]);
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(tiles()[5]);
    expect(tiles().filter((t) => t.tabIndex === 0)).toEqual([tiles()[5]]);
  });

  it('Enter and Space each tap the focused tile once', async () => {
    const user = userEvent.setup();
    const { onTap } = setup();
    await user.tab();
    await user.keyboard('{ArrowRight}{Enter}');
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenLastCalledWith(1);
    await user.keyboard('{ArrowDown} ');
    expect(onTap).toHaveBeenCalledTimes(2);
    expect(onTap).toHaveBeenLastCalledWith(4);
  });

  it('a click taps the tile', async () => {
    const user = userEvent.setup();
    const { onTap } = setup();
    await user.click(screen.getByRole('button', { name: 'I, row 3, column 3' }));
    expect(onTap).toHaveBeenCalledExactlyOnceWith(8);
  });

  it('disabled blocks taps and leaves no tab stop', async () => {
    const user = userEvent.setup();
    const { onTap } = setup({ disabled: true });
    await user.click(tiles()[0]!);
    tiles()[4]!.focus();
    await user.keyboard('{Enter} ');
    expect(onTap).not.toHaveBeenCalled();
    expect(tiles().filter((t) => t.tabIndex === 0)).toHaveLength(0);
    expect(tiles()[0]).toHaveAttribute('aria-disabled', 'true');
  });

  it('draws the route line through one point per route cell', () => {
    const { container } = setup({ route: [0, 1, 4, 7] });
    const points = container.querySelector('polyline')!.getAttribute('points')!.trim().split(/\s+/);
    expect(points).toEqual(['23,23', '69,23', '69,69', '69,115']);
  });

  it('shows the route state on the board', () => {
    const { container, rerender } = setup({ route: [0, 1, 4], routeState: 'wrong' });
    const board = container.firstElementChild!;
    expect(board).toHaveAttribute('data-state', 'wrong');
    rerender({ routeState: 'revealed' });
    expect(board).toHaveAttribute('data-state', 'revealed');
    expect(container.querySelector('polyline')).toBeNull();
  });

  it('draws a revealed route as one dot per segment, at the midpoint between tile centres', () => {
    const { container } = setup({ route: [0, 1, 4, 7], routeState: 'revealed' });
    const dots = [...container.querySelectorAll('.route circle')].map((c) => [c.getAttribute('cx'), c.getAttribute('cy')]);
    expect(dots).toEqual([['46', '23'], ['69', '46'], ['69', '92']]);
  });

  describe('solve celebration', () => {
    it('has no petals under reduced motion', () => {
      const { container, rerender } = setup({ route: [0, 1] });
      rerender({ route: [0, 1, 4], routeState: 'solved', disabled: true });
      expect(container.querySelector('.petals, .petal')).toBeNull();
    });

    it('plays on an aria-hidden petal layer and a key jumps to the final frame', () => {
      const spy = withMotion();
      const { container, rerender } = setup({ route: [0, 1] });
      rerender({ route: [0, 1, 4], routeState: 'solved', disabled: true });
      const layer = container.querySelector('.petals');
      expect(layer).toHaveAttribute('aria-hidden', 'true');
      expect(layer!.querySelectorAll('.petal').length).toBeGreaterThan(0);

      act(() => void fireEvent.keyDown(window, { key: 'Enter' }));
      expect(container.querySelector('.petals, .petal')).toBeNull();
      expect(container.firstElementChild).toHaveAttribute('data-state', 'solved');
      expect(tiles().filter((t) => t.hasAttribute('data-selected')).map((t) => t.textContent)).toEqual(['A', 'B', 'E']);
      spy.mockRestore();
    });

    it('does not play for a board that opens already solved', () => {
      const spy = withMotion();
      const { container } = setup({ route: [0, 1, 4], routeState: 'solved', disabled: true });
      expect(container.querySelector('.petals')).toBeNull();
      spy.mockRestore();
    });
  });
});
