import { neighbors, sameRoute } from '../../shared/grid';
import { randInt, rngFrom, shuffle, type Rng } from '../../shared/rng';
import { qualityProblems, routeShapeProblems, type Level } from './quality';
import { findRoutes } from './routes';
import { reverse } from './words';

export const GENERATOR_VERSION = 'gen-1';
export const SIZES = [6, 7, 8, 9, 10, 15] as const;

const RANDOM_LETTER_CHANCE = 0.12;
const WALK_DRAWS = 50;

/** `key` is a date or an unlimited puzzle id. */
export function seedFor(key: string, size: number): string {
  return `${key}|${size}|${GENERATOR_VERSION}`;
}

export interface GenerateInput {
  answer: string;
  size: number;
  level: Level;
  blocked: readonly string[];
  seed: string;
  maxChanges?: number;
  maxAttempts?: number;
}

export interface Generated {
  cells: string;
  solution: number[];
  attempts: number;
}

export class GenerateError extends Error {}

/** A grid where only `solution` spells the answer or any blocked word. Same input, same grid. */
export function generate(input: GenerateInput): Generated {
  const { answer, size, level, blocked, seed, maxChanges = 3000, maxAttempts = 1000 } = input;
  const fail = (cause: string) => new GenerateError(`${answer} at ${size}×${size}: ${cause}`);
  const reversed = reverse(answer);
  if (reversed === answer) throw fail('palindrome');
  if (blocked.includes(reversed)) throw fail(`reverse ${reversed} is blocked`);

  const rng = rngFrom(seed);
  const words = [answer, ...blocked];
  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const grid = attempt(rng, size, answer, words, level, maxChanges);
    if (grid) return { ...grid, attempts };
  }
  throw fail(`no valid grid in ${maxAttempts} attempts`);
}

function attempt(
  rng: Rng,
  size: number,
  answer: string,
  words: readonly string[],
  level: Level,
  maxChanges: number,
): Omit<Generated, 'attempts'> | undefined {
  const letters = [...new Set(answer)];
  const grid = Array.from({ length: size * size }, () => letters[randInt(rng, letters.length)]!);
  const solution = shapedWalk(rng, size, answer.length, level);
  if (!solution) return undefined;
  solution.forEach((cell, i) => (grid[cell] = answer[i]!));
  const locked = new Set(solution);

  for (let changes = 0; ; changes++) {
    const cells = grid.join('');
    const others = findRoutes(size, cells, words).filter((r) => !sameRoute(r.route, solution));
    if (others.length === 0) {
      return qualityProblems(size, cells, answer, solution, level).length ? undefined : { cells, solution };
    }
    if (changes === maxChanges) return undefined;
    const free = others[randInt(rng, others.length)]!.route.filter((cell) => !locked.has(cell));
    if (free.length === 0) return undefined;
    const cell = free[randInt(rng, free.length)]!;
    // Shuffled, so options[0] is a random letter and the first minimum breaks ties randomly.
    const options = shuffle(rng, letters.filter((letter) => letter !== grid[cell]));
    if (rng() < RANDOM_LETTER_CHANCE) {
      grid[cell] = options[0]!;
      continue;
    }
    const counts = options.map((letter) => {
      grid[cell] = letter;
      return routesNear(size, grid, cell, words);
    });
    grid[cell] = options[counts.indexOf(Math.min(...counts))]!;
  }
}

/**
 * Route count inside the square window holding every cell within answer-length - 1
 * steps of `cell`. Only routes through `cell` change with its letter, and they all
 * lie in the window, so letters rank exactly as on the whole grid, with fewer cells
 * to search.
 */
export function routesNear(size: number, grid: readonly string[], cell: number, words: readonly string[]): number {
  const reach = words[0]!.length - 1;
  const side = Math.min(size, 2 * reach + 1);
  const start = (at: number) => Math.min(Math.max(at - reach, 0), size - side);
  const top = start(Math.floor(cell / size));
  const left = start(cell % size);
  let cells = '';
  for (let row = top; row < top + side; row++) {
    cells += grid.slice(row * size + left, row * size + left + side).join('');
  }
  return findRoutes(side, cells, words).length;
}

/** A random self-avoiding walk whose shape meets the level, or undefined after WALK_DRAWS tries. */
function shapedWalk(rng: Rng, size: number, length: number, level: Level): number[] | undefined {
  for (let draw = 0; draw < WALK_DRAWS; draw++) {
    const walk = randomWalk(rng, size, length);
    if (routeShapeProblems(size, walk, level).length === 0) return walk;
  }
  return undefined;
}

function randomWalk(rng: Rng, size: number, length: number): number[] {
  const walk: number[] = [];
  const extend = (cell: number): boolean => {
    walk.push(cell);
    if (walk.length === length) return true;
    for (const next of shuffle(rng, neighbors(cell, size))) {
      if (!walk.includes(next) && extend(next)) return true;
    }
    walk.pop();
    return false;
  };
  extend(randInt(rng, size * size));
  return walk;
}
