import { act, render } from '@testing-library/react';
import { useEffect, useState, type CSSProperties } from 'react';
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
function Probe({ report, frame }: { report: (input: LayoutInput) => void; frame?: [string, string] }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const input = useLayoutInput(el);
  useEffect(() => report(input), [report, input]);
  const style = frame && ({ '--frame-x': frame[0], '--frame-y': frame[1] } as CSSProperties);
  return <div ref={setEl} style={style} />;
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

  it('subtracts the frame the stage declares around the plot', () => {
    stubMatchMedia(true);
    stubResizeObserver();
    render(<Probe report={report} frame={['100px', '135px']} />);
    act(() => resize(970, 836));
    expect(seen).toEqual({ width: 870, height: 701, finePointer: true });
    act(() => resize(60, 60));
    expect(seen).toEqual({ width: 0, height: 0, finePointer: true });
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
