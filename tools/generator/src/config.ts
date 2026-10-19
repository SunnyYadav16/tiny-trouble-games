/** Dailies are kept filled this many days ahead of today. */
export const AHEAD_DAYS = 30;
/** Unlimited puzzles per level on the first day, then added per day. */
export const UNLIMITED_INITIAL = 40;
export const UNLIMITED_PER_DAY = 7;

const DAY_MS = 86_400_000;

/** Puzzles each level should hold: `started` and `today` are YYYY-MM-DD. */
export function unlimitedTarget(started: string, today: string): number {
  const days = Math.max(0, Math.floor((Date.parse(today) - Date.parse(started)) / DAY_MS));
  return UNLIMITED_INITIAL + UNLIMITED_PER_DAY * days;
}
