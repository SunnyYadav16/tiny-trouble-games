import { useCallback, useEffect, useRef } from 'react';

/** Elapsed play time that counts only while `running` and the page is visible. Read on demand; never re-renders. Uses the monotonic clock, so a wall-clock step cannot make it negative. */
export function useVisibleTimer(initialMs: number, running: boolean): { elapsed: () => number } {
  const acc = useRef(initialMs);
  const since = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const sync = () => {
      const now = performance.now();
      if (document.visibilityState === 'visible') since.current ??= now;
      else if (since.current !== null) {
        acc.current += now - since.current;
        since.current = null;
      }
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      if (since.current !== null) acc.current += performance.now() - since.current;
      since.current = null;
    };
  }, [running]);

  const elapsed = useCallback(() => Math.max(0, acc.current + (since.current === null ? 0 : performance.now() - since.current)), []);
  return { elapsed };
}
