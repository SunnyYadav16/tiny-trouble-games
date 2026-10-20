import { useEffect, useState } from 'react';
import type { LayoutInput } from './layout';
import { useMedia } from './useMedia';

const FINE = '(pointer: fine) and (hover: hover)';

/**
 * Measures the board slot and the pointer type; both update live. The slot is the observed stage's
 * content box minus the frame its CSS keeps around the plot (`--frame-x`, `--frame-y`, plain px).
 * Takes the element, not a ref, so it follows a stage that remounts.
 */
export function useLayoutInput(stage: HTMLElement | null): LayoutInput {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const finePointer = useMedia(FINE);

  useEffect(() => {
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const css = getComputedStyle(stage);
      const frame = (name: string) => parseFloat(css.getPropertyValue(name)) || 0;
      setBox({
        width: Math.max(0, entry.contentRect.width - frame('--frame-x')),
        height: Math.max(0, entry.contentRect.height - frame('--frame-y')),
      });
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [stage]);

  return { ...box, finePointer };
}
