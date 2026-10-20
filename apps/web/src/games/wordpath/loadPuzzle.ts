import { wordpathV1 } from '@ttg/engine';

type Level = wordpathV1.Level;

export type LoadResult =
  | { ok: true; puzzle: wordpathV1.PuzzleBody; solutions: Record<number, number[]> }
  | { ok: false; reason: 'missing' | 'invalid' | 'unsupported' };

export type IndexResult =
  | { ok: true; count: Record<Level, number> }
  | { ok: false; reason: 'missing' | 'invalid' };

export const dailyUrl = (date: string) => `/wordpath/${date}.json`;
export const unlimitedUrl = (level: Level, n: number) => `/wordpath/unlimited/${level}/${n}.json`;

/** Network error, non-OK status, or a body that is not JSON (an SPA fallback page) all read as missing. */
async function fetchJson(url: string): Promise<{ data: unknown } | null> {
  try {
    const res = await fetch(url);
    return res.ok ? { data: await res.json() } : null;
  } catch {
    return null;
  }
}

export async function loadPuzzle(url: string): Promise<LoadResult> {
  const body = await fetchJson(url);
  if (!body) return { ok: false, reason: 'missing' };
  const { data } = body;
  const rulesVersion = typeof data === 'object' && data !== null ? (data as { rulesVersion?: unknown }).rulesVersion : undefined;
  if (typeof rulesVersion === 'string' && rulesVersion !== wordpathV1.RULES_VERSION) {
    return { ok: false, reason: 'unsupported' };
  }
  const parsed = wordpathV1.parsePuzzle(data);
  return parsed ? { ok: true, ...parsed } : { ok: false, reason: 'invalid' };
}

export async function loadUnlimitedIndex(): Promise<IndexResult> {
  const body = await fetchJson('/wordpath/unlimited/index.json');
  if (!body) return { ok: false, reason: 'missing' };
  const raw = (body.data as { count?: Record<string, unknown> } | null)?.count;
  const count = {} as Record<Level, number>;
  for (const level of wordpathV1.LEVELS) {
    const n = raw?.[level];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) return { ok: false, reason: 'invalid' };
    count[level] = n;
  }
  return Object.values(count).some((n) => n > 0) ? { ok: true, count } : { ok: false, reason: 'invalid' };
}
