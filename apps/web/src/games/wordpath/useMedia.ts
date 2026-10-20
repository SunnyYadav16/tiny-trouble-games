import { useEffect, useState } from 'react';

/** Whether a media query matches, kept live. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** The two-column desktop layout's breakpoint; fixed-size boards (Home, how to play, level plots) pick their tile from it. */
export const WIDE = '(min-width: 900px)';
