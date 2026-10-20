/** One-stroke inline icons on a 24-unit grid; `|` separates paths. Decorative: a label or text names the control. */
export const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {d.split('|').map((p) => (
      <path key={p} d={p} />
    ))}
  </svg>
);

export const BACK = 'M15 5l-7 7 7 7';
export const FLAME = 'M12 3c1 3.2 4.8 5.2 4.8 10a4.8 4.8 0 0 1-9.6 0c0-2.3 1.1-3.6 2.2-4.6.2 1.6.9 2.6 2 3 0-3 .4-5.6.6-8.4z';
export const STATS = 'M5 19V11M12 19V5M19 19v-6|M3.5 19.5h17';
export const HELP = 'M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0|M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6|M12 17h.01';
export const ALERT = 'M12 4.2l8.6 15H3.4z|M12 10v4.4M12 16.9h.01';
export const INFINITY = 'M8 8.5c-2 0-3.5 1.6-3.5 3.5S6 15.5 8 15.5c3.5 0 4.5-7 8-7 2 0 3.5 1.6 3.5 3.5S18 15.5 16 15.5c-3.5 0-4.5-7-8-7z';
export const CLEAR = 'M6 6l12 12M18 6L6 18';
export const FLAG = 'M6 21V4|M6 4.5h10.5l-2 3.8 2 3.7H6';
export const CHECK = 'M5 12.5l4.5 4.5L19 7.5';
export const NEXT = 'M5 12h13M13 6l6 6-6 6';
export const INFO = 'M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0|M12 11v5.5M12 7.6h.01';
export const REPLAY = 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3|M4.5 4.5v3.8h3.8';

/** The collection's mark: a plot with a lantern path laid across it. Decorative beside the collection's name. */
export const Mark = () => (
  <svg className="mark" viewBox="0 0 32 32" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="26" height="26" rx="7" stroke="currentColor" strokeWidth="2" />
    <path d="M9 23V16h7v-7h7" stroke="var(--lantern)" strokeWidth="2.6" />
    <circle cx="9" cy="23" r="2.4" fill="var(--lantern)" stroke="none" />
  </svg>
);

/** Each level's path shape: one bend, a few bends, a turn at every tile. Same stroke as the other icons. */
const LEVEL_PATH = {
  easy: 'M3 15V8.5Q3 6 5.5 6H15',
  normal: 'M2.5 15h5V10h5V5H16',
  hard: 'M2 14V5.5h4.7V13h4.6V5.5H16',
};
export const LevelIcon = ({ level }: { level: keyof typeof LEVEL_PATH }) => (
  <svg viewBox="0 0 18 18" aria-hidden="true">
    <path d={LEVEL_PATH[level]} />
  </svg>
);
