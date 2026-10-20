import { useCallback, useEffect, useRef } from 'react';

/** Elapsed play time that counts only while `running` and the page is visible. Read on demand; never re-renders. */
export function useVisibleTimer(initialMs: number, running: boolean): { elapsed: () => number } {
  const acc = useRef(initialMs);
  const since = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const sync = () => {
      const now = Date.now();
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
      if (since.current !== null) acc.current += Date.now() - since.current;
      since.current = null;
    };
  }, [running]);

  const elapsed = useCallback(() => acc.current + (since.current === null ? 0 : Date.now() - since.current), []);
  return { elapsed };
}
