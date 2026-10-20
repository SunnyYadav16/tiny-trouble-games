import { act, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LayoutInput } from './layout';
import { useLayoutInput } from './useLayoutInput';

const FINE = '(pointer: fine) and (hover: hover)';

function stubMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query === FINE && matches;
    },
    media: query,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return (next: boolean) => {
    matches = next;
    listeners.forEach((fn) => fn());
  };
}

let resize: (w: number, h: number) => void;
function stubResizeObserver() {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private cb: ResizeObserverCallback) {}
      observe(el: Element) {
        resize = (width, height) => this.cb([{ target: el, contentRect: { width, height } } as ResizeObserverEntry], this as never);
      }
      disconnect() {}
      unobserve() {}
    },
  );
}

let seen: LayoutInput;
function Probe({ report }: { report: (input: LayoutInput) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const input = useLayoutInput(ref);
  useEffect(() => report(input), [report, input]);
  return <div ref={ref} />;
}
const report = (input: LayoutInput) => void (seen = input);

afterEach(() => vi.unstubAllGlobals());

describe('useLayoutInput', () => {
  it('starts at zero size and follows the board slot', () => {
    stubMatchMedia(false);
    stubResizeObserver();
    render(<Probe report={report} />);
    expect(seen).toEqual({ width: 0, height: 0, finePointer: false });
    act(() => resize(640, 480));
    expect(seen).toEqual({ width: 640, height: 480, finePointer: false });
  });

  it('re-renders when the pointer changes from coarse to fine', () => {
    const setFine = stubMatchMedia(false);
    stubResizeObserver();
    render(<Probe report={report} />);
    expect(seen.finePointer).toBe(false);
    act(() => setFine(true));
    expect(seen.finePointer).toBe(true);
  });

  it('works without ResizeObserver (jsdom)', () => {
    stubMatchMedia(true);
    render(<Probe report={report} />);
    expect(seen).toEqual({ width: 0, height: 0, finePointer: true });
  });
});
