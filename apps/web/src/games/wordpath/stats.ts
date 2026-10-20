import { wordpathV1 } from '@ttg/engine';
import { localDateKey } from '../../shared/daily';
import { loadResults, type ResultRecord } from './results';
import { DAILY, unlimitedKeys } from './session';

export interface Summary {
  played: number;
  solved: number;
  /** 0 to 1; 0 when nothing was played. */
  solveRate: number;
  avgSolveMs: number;
  /** Solved puzzles only, by solve time. */
  distribution: { label: string; count: number }[];
}

/** A solve time belongs to the first bucket whose limit it is under, so an edge goes to the slower one. */
const BUCKETS: [label: string, under: number][] = [
  ['under 0:30', 30_000],
  ['0:30–1:00', 60_000],
  ['1:00–2:00', 120_000],
  ['2:00–5:00', 300_000],
  ['5:00+', Infinity],
];

export function summarize(records: ResultRecord[]): Summary {
  const solves = records.filter((r) => r.outcome === 'solved');
  const distribution = BUCKETS.map(([label]) => ({ label, count: 0 }));
  for (const r of solves) distribution[BUCKETS.findIndex(([, under]) => r.timeMs < under)]!.count++;
  return {
    played: records.length,
    solved: solves.length,
    solveRate: records.length ? solves.length / records.length : 0,
    avgSolveMs: solves.length ? Math.round(solves.reduce((sum, r) => sum + r.timeMs, 0) / solves.length) : 0,
    distribution,
  };
}

const shift = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  return localDateKey(new Date(y!, m! - 1, d! + days));
};

/**
 * §9.6: a streak is consecutive dates solved. A missed date or a give-up ends it. Today unfinished does not,
 * so counting starts at yesterday; today given up counts as a break, so the current streak is 0.
 */
export function streaks(daily: ResultRecord[], today: string): { current: number; best: number } {
  const solved = new Set(daily.filter((r) => r.outcome === 'solved').map((r) => r.date));
  let current = 0;
  for (let d = daily.some((r) => r.date === today) ? today : shift(today, -1); solved.has(d); d = shift(d, -1)) current++;
  let best = 0;
  for (const d of solved) {
    if (solved.has(shift(d, -1))) continue; // not the first day of a run
    let run = 0;
    for (let e = d; solved.has(e); e = shift(e, 1)) run++;
    best = Math.max(best, run);
  }
  return { current, best };
}

export const byLevel = (records: ResultRecord[]): Record<wordpathV1.Level, Summary> =>
  Object.fromEntries(wordpathV1.LEVELS.map((l) => [l, summarize(records.filter((r) => r.level === l))])) as Record<wordpathV1.Level, Summary>;

export interface Stats {
  daily: Summary & { current: number; best: number };
  unlimited: Summary;
  byLevel: Record<wordpathV1.Level, Summary>;
}

/** Everything the stats dialog and the header streak show, read from this browser's saved results. */
export function loadStats(today: string): Stats {
  const daily = Object.values(loadResults(DAILY.results));
  const unlimited = Object.values(loadResults(unlimitedKeys('normal').results)); // one list holds every level
  return { daily: { ...summarize(daily), ...streaks(daily, today) }, unlimited: summarize(unlimited), byLevel: byLevel(unlimited) };
}
