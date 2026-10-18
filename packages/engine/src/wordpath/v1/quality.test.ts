import { describe, expect, it } from 'vitest';
import {
  longestRun,
  metrics,
  minLetterCount,
  qualityProblems,
  routeShapeProblems,
} from './quality';

/** A size x size grid of X with `answer` written along `route`. */
function gridWith(size: number, answer: string, route: readonly number[]): string {
  const cells = Array<string>(size * size).fill('X');
  route.forEach((cell, i) => (cells[cell] = answer[i]!));
  return cells.join('');
}

// Every CRANE letter appears six times, so letter balance never interferes.
const balanced = [
  'CRANEC',
  'RANECR',
  'ANECRA',
  'NECRAN',
  'ECRANE',
  'XXXXXX',
].join('');

// A single CRAN near miss (down the left column) next to the solution's own CRAN.
const oneNearMiss = [
  'CRANEX',
  'CXXXXX',
  'RXXXXX',
  'AXXXXX',
  'NXXXXX',
  'XXXXXX',
].join('');

describe('minLetterCount', () => {
  it('is ceil(size^2 / (2 * distinct))', () => {
    expect(minLetterCount(6, 5)).toBe(4);
    expect(minLetterCount(8, 4)).toBe(8);
    expect(minLetterCount(10, 5)).toBe(10);
  });
});

describe('longestRun', () => {
  it('counts the most cells in one straight line', () => {
    expect(longestRun([0, 1, 2, 8], 6)).toBe(3);
    expect(longestRun([0, 6, 12, 13, 14, 15], 6)).toBe(4);
  });

  it('handles tiny routes', () => {
    expect(longestRun([], 6)).toBe(0);
    expect(longestRun([4], 6)).toBe(1);
    expect(longestRun([4, 5], 6)).toBe(2);
  });
});

describe('metrics', () => {
  it('counts near misses, false starts and turns', () => {
    expect(metrics(3, 'CATAXXTXX', 'CAT', [0, 1, 2])).toEqual({
      nearMisses: 1,
      falseStarts: 1,
      routeTurns: 0,
    });
  });

  it('does not count the solution prefix as a near miss', () => {
    expect(metrics(6, oneNearMiss, 'CRANE', [0, 1, 2, 3, 4]).nearMisses).toBe(1);
  });
});

describe('routeShapeProblems', () => {
  it('reports too few turns', () => {
    expect(routeShapeProblems(6, [0, 1, 2, 3, 4], 'easy')).toEqual(['route has 0 turns, needs 1']);
  });

  it('reports a straight run over the level maximum', () => {
    expect(routeShapeProblems(6, [0, 1, 2, 8, 14], 'hard')).toContain(
      'route runs 3 tiles straight, max 2',
    );
  });

  it('never complains about runs on easy', () => {
    expect(routeShapeProblems(6, [0, 1, 2, 3, 9], 'easy')).toEqual([]);
  });

  it('caps required turns at length - 2', () => {
    // 4 letters: hard wants 3 turns but only 2 are possible.
    expect(routeShapeProblems(6, [0, 1, 7, 8], 'hard')).toEqual([]);
  });

  it('uses the desktop column only at size 15', () => {
    const route = [0, 1, 2, 17, 32, 33]; // 2 turns on 15 wide
    expect(routeShapeProblems(15, route, 'normal')).toContain('route has 2 turns, needs 3');
    expect(routeShapeProblems(6, [0, 1, 2, 8, 14, 15], 'normal')).toEqual([]);
  });

  it('needs min(4, 3) turns for a 5-letter answer at hard on 15x15', () => {
    expect(routeShapeProblems(15, [0, 1, 2, 17, 18], 'hard')).toContain('route has 2 turns, needs 3');
    expect(routeShapeProblems(15, [0, 1, 16, 17, 32], 'hard')).toEqual([]);
  });
});

describe('qualityProblems', () => {
  const straight = [0, 1, 2, 3, 4];

  it('flags a straight route on easy', () => {
    expect(qualityProblems(6, balanced, 'CRANE', straight, 'easy')).toContain(
      'route has 0 turns, needs 1',
    );
  });

  it('flags a starved letter', () => {
    const starved = gridWith(6, 'CRANE', [0, 1, 2, 3, 9]);
    expect(qualityProblems(6, starved, 'CRANE', [0, 1, 2, 3, 9], 'easy')).toContain(
      'letter C appears 1 times, needs 4',
    );
  });

  it('flags too few turns on normal', () => {
    expect(qualityProblems(6, balanced, 'CRANE', [0, 1, 2, 3, 9], 'normal')).toContain(
      'route has 1 turns, needs 2',
    );
  });

  it('flags a long straight run on hard', () => {
    expect(qualityProblems(6, balanced, 'CRANE', [0, 1, 2, 8, 14], 'hard')).toContain(
      'route runs 3 tiles straight, max 2',
    );
  });

  it('flags too few near misses on normal', () => {
    expect(qualityProblems(6, oneNearMiss, 'CRANE', [0, 1, 2, 3, 4], 'normal')).toContain(
      '1 near misses, needs 2',
    );
  });

  it('lists problems in a stable order: letters, turns, run, near misses', () => {
    const grid = gridWith(6, 'CRANE', straight);
    const problems = qualityProblems(6, grid, 'CRANE', straight, 'normal');
    expect(problems).toEqual([
      'letter C appears 1 times, needs 4',
      'letter R appears 1 times, needs 4',
      'letter A appears 1 times, needs 4',
      'letter N appears 1 times, needs 4',
      'letter E appears 1 times, needs 4',
      'route has 0 turns, needs 2',
      'route runs 5 tiles straight, max 3',
      '0 near misses, needs 2',
    ]);
  });

  it('passes a good easy puzzle', () => {
    expect(qualityProblems(6, balanced, 'CRANE', [0, 1, 2, 3, 9], 'easy')).toEqual([]);
  });
});
