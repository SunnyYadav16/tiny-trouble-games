import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hashSeed, mulberry32, randInt, rngFrom, shuffle } from './rng';

const take = (next: () => number, count: number): number[] => Array.from({ length: count }, next);

describe('seeded rng', () => {
  it('same seed gives the same 20 numbers', () => {
    expect(take(rngFrom('2026-10-18'), 20)).toEqual(take(rngFrom('2026-10-18'), 20));
  });

  it('different seeds give different numbers', () => {
    expect(take(rngFrom('a'), 20)).not.toEqual(take(rngFrom('b'), 20));
  });

  it('hashSeed is FNV-1a 32-bit', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('foobar')).toBe(0xbf9cf968);
  });

  it('floats stay in [0,1)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        for (const x of take(mulberry32(seed), 50)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
        }
      }),
    );
  });

  it('randInt stays in [0,n)', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1, max: 1000 }), (seed, n) => {
        const next = mulberry32(seed);
        for (let i = 0; i < 50; i++) {
          const x = randInt(next, n);
          expect(Number.isInteger(x)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(n);
        }
      }),
    );
  });

  it('shuffle is a permutation and leaves its input alone', () => {
    fc.assert(
      fc.property(fc.integer(), fc.array(fc.integer()), (seed, items) => {
        const before = [...items];
        const out = shuffle(mulberry32(seed), items);
        expect(items).toEqual(before);
        expect(out).not.toBe(items);
        expect([...out].sort((a, b) => a - b)).toEqual([...items].sort((a, b) => a - b));
      }),
    );
  });
});
