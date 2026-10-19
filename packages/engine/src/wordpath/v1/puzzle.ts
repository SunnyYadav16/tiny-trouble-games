import { isAdjacent, sameRoute } from '../../shared/grid';
import { decodeRoute, encodeRoute } from './check';
import { GENERATOR_VERSION, generate, SIZES, seedFor } from './generate';
import { LEVELS, qualityProblems, type Level } from './quality';
import { findRoutes } from './routes';
import { initialState, RULES_VERSION, spell, step, type Game } from './rules';
import { blockedWords, checkAnswer, type WordLists } from './words';

export interface PuzzleMeta {
  clueSource: string;
  wordListVersion: string;
  generatorVersion: string;
  level: Level;
}

/** The public file. No answer field: it is recoverable from `checks` and the grids. */
export interface PuzzleBody {
  id: string;
  game: 'wordpath';
  rulesVersion: typeof RULES_VERSION;
  clue: string;
  length: number;
  /** Keyed by size as a string: "6" ... "15". */
  grids: Record<string, string>;
  checks: Record<string, string>;
  meta: PuzzleMeta;
  /** Dailies only. */
  date?: string;
}

export interface MakePuzzleInput {
  id: string;
  seedKey: string;
  date?: string;
  level: Level;
  answer: string;
  clue: string;
  clueSource: string;
  blocked: readonly string[];
  wordListVersion: string;
}

/** Throws `GenerateError` naming the first size that cannot be built. */
export function makePuzzle(input: MakePuzzleInput): PuzzleBody {
  const { id, seedKey, date, level, answer, clue, clueSource, blocked, wordListVersion } = input;
  const grids: Record<string, string> = {};
  const checks: Record<string, string> = {};
  for (const size of SIZES) {
    const g = generate({ answer, size, level, blocked, seed: seedFor(seedKey, size) });
    grids[size] = g.cells;
    checks[size] = encodeRoute(g.solution);
  }
  return {
    id,
    game: 'wordpath',
    rulesVersion: RULES_VERSION,
    clue,
    length: answer.length,
    grids,
    checks,
    meta: { clueSource, wordListVersion, generatorVersion: GENERATOR_VERSION, level },
    ...(date === undefined ? {} : { date }),
  };
}

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isText = (x: unknown): x is string => typeof x === 'string' && x !== '';

/**
 * Trust boundary for fetched files (a 200 response may be an HTML page). Returns
 * null for anything but the documented shape; the result is rebuilt from
 * validated fields, so unknown input fields never pass through.
 */
export function parsePuzzle(
  data: unknown,
): { puzzle: PuzzleBody; solutions: Record<number, number[]> } | null {
  if (!isRecord(data) || data.game !== 'wordpath' || data.rulesVersion !== RULES_VERSION) return null;
  const { id, clue, length, date, meta, grids, checks } = data;
  if (!isText(id) || !isText(clue)) return null;
  if (!Number.isInteger(length) || (length as number) < 5 || (length as number) > 7) return null;
  if (date !== undefined && !(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))) return null;
  if (!isRecord(meta) || !isText(meta.clueSource) || !isText(meta.wordListVersion)) return null;
  if (!isText(meta.generatorVersion) || !LEVELS.includes(meta.level as Level)) return null;
  if (!isRecord(grids) || !isRecord(checks)) return null;
  if (Object.keys(grids).length !== SIZES.length || Object.keys(checks).length !== SIZES.length) return null;

  const n = length as number;
  const safeGrids: Record<string, string> = {};
  const safeChecks: Record<string, string> = {};
  const solutions: Record<number, number[]> = {};
  for (const size of SIZES) {
    const grid = grids[size];
    const check = checks[size];
    if (typeof grid !== 'string' || grid.length !== size * size || !/^[A-Z]+$/.test(grid)) return null;
    if (typeof check !== 'string') return null;
    const route = decodeRoute(check);
    const valid =
      route.length === n &&
      encodeRoute(route) === check &&
      new Set(route).size === n &&
      route.every((cell, i) => cell >= 0 && cell < size * size && (i === 0 || isAdjacent(route[i - 1]!, cell, size)));
    if (!valid) return null;
    safeGrids[size] = grid;
    safeChecks[size] = check;
    solutions[size] = route;
  }

  const puzzle: PuzzleBody = {
    id,
    game: 'wordpath',
    rulesVersion: RULES_VERSION,
    clue,
    length: n,
    grids: safeGrids,
    checks: safeChecks,
    meta: {
      clueSource: meta.clueSource,
      wordListVersion: meta.wordListVersion,
      generatorVersion: meta.generatorVersion,
      level: meta.level as Level,
    },
    ...(date === undefined ? {} : { date }),
  };
  return { puzzle, solutions };
}

/** The word spelled by the decoded check route at every size, or null if they disagree. */
export function recoverAnswer(p: PuzzleBody): string | null {
  const words = new Set(SIZES.map((size) => spell(p.grids[size]!, decodeRoute(p.checks[size]!))));
  return words.size === 1 ? [...words][0]! : null;
}

/**
 * End-to-end "does it solve" at every size, through the real rules. The game's
 * solution comes from the grid, not from `checks`, so a stale check is caught.
 */
export function replayProblems(p: PuzzleBody, answer: string): string[] {
  const problems: string[] = [];
  for (const size of SIZES) {
    const fail = (why: string) => problems.push(`${size}×${size} replay: ${why}`);
    const cells = p.grids[size]!;
    const routes = findRoutes(size, cells, [answer]);
    if (routes.length !== 1) {
      fail(`${routes.length} routes spell ${answer}, expected 1`);
      continue;
    }
    const game: Game = { size, cells, solution: routes[0]!.route };
    const checked = decodeRoute(p.checks[size]!);
    const play = (route: readonly number[]) =>
      route.reduce((s, cell) => step(game, s, { type: 'tap', cell }), initialState());

    if (play(checked).status !== 'won') fail('tapping the checks route does not win');
    if (play([...checked].reverse()).status === 'won') fail('tapping the checks route reversed wins');
    const revealed = step(game, initialState(), { type: 'giveUp' }).route;
    if (!sameRoute(revealed, checked)) fail('give up does not reveal the checks route');
  }
  return problems;
}

/** Empty means the puzzle passes. Every problem starts with the puzzle id. */
export function verify(p: PuzzleBody, lists: WordLists): string[] {
  const label = (problem: string) => `${p.id}: ${problem}`;
  const parsed = parsePuzzle(p);
  if (!parsed) return [label('does not parse')];
  const answer = recoverAnswer(parsed.puzzle);
  if (!answer) return [label('answer cannot be recovered: sizes disagree')];

  const problems = checkAnswer(answer, lists).map((problem) => `answer ${answer} ${problem}`);
  const blocked = blockedWords(answer, lists.blocking);
  const letters = new Set(answer);
  for (const size of SIZES) {
    const at = `${size}×${size}`;
    const cells = p.grids[size]!;
    const solution = parsed.solutions[size]!;
    const routes = findRoutes(size, cells, [answer, ...blocked]);
    if (routes.length !== 1 || !sameRoute(routes[0]!.route, solution)) {
      problems.push(`${at}: ${routes.length} routes spell the answer or a blocked word, expected only the checks route`);
    }
    problems.push(...qualityProblems(size, cells, answer, solution, p.meta.level).map((q) => `${at}: ${q}`));
    if (![...cells].every((c) => letters.has(c))) problems.push(`${at}: grid has letters outside the answer`);
  }
  problems.push(...replayProblems(p, answer));
  return problems.map(label);
}
