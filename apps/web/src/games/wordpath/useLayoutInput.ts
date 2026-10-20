import { useEffect, useState, type RefObject } from 'react';
import type { LayoutInput } from './layout';

const FINE = '(pointer: fine) and (hover: hover)';

/** Measures the board slot and the pointer type; both update live. */
export function useLayoutInput(ref: RefObject<HTMLElement | null>): LayoutInput {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [finePointer, setFinePointer] = useState(() => window.matchMedia(FINE).matches);

  useEffect(() => {
    const mq = window.matchMedia(FINE);
    const onChange = () => setFinePointer(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return { ...box, finePointer };
}
