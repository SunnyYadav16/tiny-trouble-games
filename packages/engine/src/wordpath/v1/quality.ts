import { sameRoute, turns } from '../../shared/grid';
import { findRoutes } from './routes';

export const LEVELS = ['easy', 'normal', 'hard'] as const;
export type Level = (typeof LEVELS)[number];

/** Each pair is [small boards, 15x15 desktop board]. */
export const LEVEL_RULES: Record<
  Level,
  { turns: [small: number, desktop: number]; maxRun: number; nearMisses: [small: number, desktop: number] }
> = {
  easy: { turns: [1, 1], maxRun: Infinity, nearMisses: [0, 0] },
  normal: { turns: [2, 3], maxRun: 3, nearMisses: [2, 6] },
  hard: { turns: [3, 4], maxRun: 2, nearMisses: [4, 12] },
};

const DESKTOP_SIZE = 15;
export const column = (size: number): 0 | 1 => (size === DESKTOP_SIZE ? 1 : 0);

export function minLetterCount(size: number, distinct: number): number {
  return Math.ceil((size * size) / (2 * distinct));
}

/** Most cells in one straight line of consecutive steps. */
export function longestRun(route: readonly number[]): number {
  if (route.length < 2) return route.length;
  let best = 2;
  let run = 2;
  for (let i = 2; i < route.length; i++) {
    const same = route[i]! - route[i - 1]! === route[i - 1]! - route[i - 2]!;
    run = same ? run + 1 : 2;
    if (run > best) best = run;
  }
  return best;
}

export interface Metrics {
  nearMisses: number;
  falseStarts: number;
  routeTurns: number;
}

export function metrics(
  size: number,
  cells: string,
  answer: string,
  solution: readonly number[],
): Metrics {
  const prefix = solution.slice(0, answer.length - 1);
  const nearMisses = findRoutes(size, cells, [answer.slice(0, -1)]).filter(
    (found) => !sameRoute(found.route, prefix),
  ).length;
  return {
    nearMisses,
    falseStarts: [...cells].filter((letter) => letter === answer[0]).length,
    routeTurns: turns(solution),
  };
}

/** Turn count and straight-run limits for a route, before any letters exist. */
export function routeShapeProblems(size: number, route: readonly number[], level: Level): string[] {
  const rules = LEVEL_RULES[level];
  const problems: string[] = [];
  const neededTurns = Math.min(rules.turns[column(size)], route.length - 2);
  const routeTurns = turns(route);
  if (routeTurns < neededTurns) problems.push(`route has ${routeTurns} turns, needs ${neededTurns}`);
  const run = longestRun(route);
  if (run > rules.maxRun) problems.push(`route runs ${run} tiles straight, max ${rules.maxRun}`);
  return problems;
}

/** Empty means the grid passes every quality check for this level. */
export function qualityProblems(
  size: number,
  cells: string,
  answer: string,
  solution: readonly number[],
  level: Level,
): string[] {
  const problems: string[] = [];
  const distinct = [...new Set(answer)];
  const needed = minLetterCount(size, distinct.length);
  for (const letter of distinct) {
    const count = [...cells].filter((c) => c === letter).length;
    if (count < needed) problems.push(`letter ${letter} appears ${count} times, needs ${needed}`);
  }
  problems.push(...routeShapeProblems(size, solution, level));
  const neededMisses = LEVEL_RULES[level].nearMisses[column(size)];
  const { nearMisses } = metrics(size, cells, answer, solution);
  if (nearMisses < neededMisses) problems.push(`${nearMisses} near misses, needs ${neededMisses}`);
  return problems;
}
