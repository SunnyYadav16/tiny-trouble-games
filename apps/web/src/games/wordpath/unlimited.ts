import { wordpathV1, type Rng } from '@ttg/engine';
import { loadPuzzle, loadUnlimitedIndex, unlimitedUrl } from './loadPuzzle';
import { clearActive, unlimitedKeys, type ActiveSession } from './session';

type Level = wordpathV1.Level;

export const unlimitedId = (level: Level, n: number): string => `wp-u-${level}-${n}`;
export const levelName = (level: Level): string => level[0]!.toUpperCase() + level.slice(1);

/** A random puzzle number in 1..count whose id is not in `seen`; once every one has been seen, any number, flagged as a replay. */
export function pickNext(level: Level, count: number, seen: ReadonlySet<string>, rng: Rng): { n: number; replay: boolean } {
  const all = Array.from({ length: count }, (_, i) => i + 1);
  const fresh = all.filter((n) => !seen.has(unlimitedId(level, n)));
  const pool = fresh.length ? fresh : all;
  return { n: pool[Math.floor(rng() * pool.length)]!, replay: fresh.length === 0 };
}

export interface Found {
  puzzle: wordpathV1.PuzzleBody;
  solutions: Record<number, number[]>;
  /** The saved attempt this puzzle continues, if any. */
  resume: ActiveSession | null;
  replay: boolean;
}

/** The first pick, then up to three others when a file will not load. */
const TRIES = 4;

/**
 * The puzzle to play at `level`: the saved one if it still loads, else the next pick from the index.
 * Null when there is no index, the level is empty, or every try fails.
 */
export async function findPuzzle(level: Level, saved: ActiveSession | null, seen: ReadonlySet<string>, rng: Rng): Promise<Found | null> {
  if (saved) {
    const n = Number(new RegExp(`^wp-u-${level}-(\\d+)$`).exec(saved.puzzleId)?.[1]);
    const r = n ? await loadPuzzle(unlimitedUrl(level, n)) : null;
    if (r?.ok) return { puzzle: r.puzzle, solutions: r.solutions, resume: saved, replay: false };
    clearActive(unlimitedKeys(level).active); // it cannot be continued, so it must not outlive this open
  }

  const index = await loadUnlimitedIndex();
  if (!index.ok || index.count[level] === 0) return null;
  const tried = new Set(seen); // a pick that fails to load joins it, so the next draw is another
  for (let i = 0; i < TRIES; i++) {
    const { n, replay } = pickNext(level, index.count[level], tried, rng);
    const r = await loadPuzzle(unlimitedUrl(level, n));
    if (r.ok) return { puzzle: r.puzzle, solutions: r.solutions, resume: null, replay };
    tried.add(unlimitedId(level, n));
  }
  return null;
}
