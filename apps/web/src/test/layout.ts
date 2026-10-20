import { act } from '@testing-library/react';
import { vi } from 'vitest';

const FINE = '(pointer: fine) and (hover: hover)';
const REDUCED = '(prefers-reduced-motion: reduce)';

/**
 * Tests only: every observed element measures `width × height` (jsdom has no CSS, so the stage's frame
 * reads as 0 and this is the board slot itself), and the pointer is fine or coarse. Reduced motion stays on.
 */
export function stubLayout(width: number, height: number, fine: boolean) {
  let box = { width, height };
  let isFine = fine;
  const observers = new Map<object, () => void>();
  const pointer = new Set<() => void>();

  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(el: Element) {
        const fire = () => this.cb([{ target: el, contentRect: { ...box } } as unknown as ResizeObserverEntry], this as never);
        observers.set(this, fire);
        fire();
      }
      unobserve() {}
      disconnect() {
        observers.delete(this);
      }
    },
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === FINE ? isFine : query === REDUCED;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => query === FINE && pointer.add(fn),
    removeEventListener: (_: string, fn: () => void) => pointer.delete(fn),
  }));

  return {
    resize(w: number, h: number) {
      box = { width: w, height: h };
      act(() => observers.forEach((fire) => fire()));
    },
    setFine(next: boolean) {
      isFine = next;
      act(() => pointer.forEach((fn) => fn()));
    },
  };
}
