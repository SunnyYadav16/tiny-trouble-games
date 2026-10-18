import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { randInt, rngFrom } from '../../shared/rng';
import { generate, routesNear, SIZES } from './generate';
import { LEVELS, qualityProblems } from './quality';
import { findRoutes } from './routes';
import { spell } from './rules';

const BLOCKED = ['AMONG', 'GAMMA', 'MAMMA', 'MANGA', 'MANNA'];

describe('generate', () => {
  it('builds a grid where only the solution spells the answer or a blocked word', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom(...SIZES),
        fc.constantFrom(...LEVELS),
        (seed, size, level) => {
          const g = generate({ answer: 'MANGO', size, level, blocked: BLOCKED, seed });
          expect(g.cells).toHaveLength(size * size);
          expect(spell(g.cells, g.solution)).toBe('MANGO');
          expect(findRoutes(size, g.cells, ['MANGO', ...BLOCKED]).map((r) => r.route)).toEqual([
            g.solution,
          ]);
          expect(qualityProblems(size, g.cells, 'MANGO', g.solution, level)).toEqual([]);
        },
      ),
      { numRuns: 1000 },
    );
  }, 120_000);

  it('returns the same grid for the same input', () => {
    const input = { answer: 'MANGO', size: 8, level: 'hard', blocked: BLOCKED, seed: '2026-10-18|8|gen-1' } as const;
    expect(generate(input)).toEqual(generate(input));
  });

  it('refuses a palindrome', () => {
    expect(() => generate({ answer: 'LEVEL', size: 6, level: 'normal', blocked: [], seed: 's' })).toThrow(
      /palindrome/,
    );
  });

  it('refuses an answer whose reverse is blocked', () => {
    expect(() =>
      generate({ answer: 'STRAP', size: 6, level: 'normal', blocked: ['PARTS'], seed: 's' }),
    ).toThrow(/PARTS/);
  });

  it('names the attempt limit when every attempt fails', () => {
    expect(() =>
      generate({ answer: 'MANGO', size: 6, level: 'hard', blocked: BLOCKED, seed: 's', maxAttempts: 1, maxChanges: 0 }),
    ).toThrow('MANGO at 6×6: no valid grid in 1 attempts');
  });
});

describe('routesNear', () => {
  // Short words over many letters, and long words over two letters so routes are dense.
  const WORD_SETS = [['MANGO', ...BLOCKED], ['ABABAAB', 'BAABABA']];

  it('ranks a cell’s letters exactly as a whole-grid count does', () => {
    fc.assert(
      fc.property(fc.string(), fc.constantFrom(...SIZES), fc.constantFrom(...WORD_SETS), (seed, size, words) => {
        const rng = rngFrom(seed);
        const letters = [...new Set(words.join(''))];
        const grid = Array.from({ length: size * size }, () => letters[randInt(rng, letters.length)]!);
        const cell = randInt(rng, grid.length);
        const outside = letters.map((letter) => {
          grid[cell] = letter;
          return findRoutes(size, grid.join(''), words).length - routesNear(size, grid, cell, words);
        });
        expect(new Set(outside).size).toBe(1);
      }),
      { numRuns: 300 },
    );
  });
});
