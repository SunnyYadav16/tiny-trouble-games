import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isAdjacent } from '../../shared/grid';
import { findRoutes } from './routes';
import { spell } from './rules';

// 3x3 numbering: 0 1 2 / 3 4 5 / 6 7 8
const cells = 'CATAXXTXX';

describe('findRoutes', () => {
  it('finds every route spelling a word', () => {
    const found = findRoutes(3, cells, ['CAT']);
    expect(found).toHaveLength(2);
    expect(found.map((r) => r.route)).toEqual(
      expect.arrayContaining([
        [0, 1, 2],
        [0, 3, 6],
      ]),
    );
    expect(found.every((r) => r.word === 'CAT')).toBe(true);
  });

  it('counts reversed routes separately', () => {
    const found = findRoutes(3, cells, ['CAT', 'TAC']);
    expect(found).toHaveLength(4);
    expect(found.filter((r) => r.word === 'TAC').map((r) => r.route)).toEqual(
      expect.arrayContaining([
        [2, 1, 0],
        [6, 3, 0],
      ]),
    );
  });

  it('never reuses a tile', () => {
    expect(findRoutes(3, 'ABXXXXXXX', ['ABA'])).toEqual([]);
  });

  it('never moves diagonally', () => {
    expect(findRoutes(3, 'CXXXAXXXT', ['CAT'])).toEqual([]);
  });

  it('returns nothing for no words', () => {
    expect(findRoutes(3, cells, [])).toEqual([]);
  });

  it('treats duplicate words as one', () => {
    expect(findRoutes(3, cells, ['CAT', 'CAT'])).toHaveLength(2);
  });

  it('returns fresh route arrays', () => {
    const [a] = findRoutes(3, cells, ['CAT']);
    a!.route.push(99);
    expect(findRoutes(3, cells, ['CAT']).every((r) => r.route.length === 3)).toBe(true);
  });

  it('returns distinct, adjacent, no-reuse routes that spell a word', () => {
    const size = 4;
    const words = ['ABA', 'BAB', 'AAB', 'ABB'];
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('A', 'B'), { minLength: size * size, maxLength: size * size }),
        (letters) => {
          const grid = letters.join('');
          const found = findRoutes(size, grid, words);
          const keys = found.map((r) => r.route.join(','));
          expect(new Set(keys).size).toBe(keys.length);
          for (const { word, route } of found) {
            expect(route).toHaveLength(3);
            expect(new Set(route).size).toBe(3);
            expect(words).toContain(word);
            expect(spell(grid, route)).toBe(word);
            for (let i = 1; i < route.length; i++) {
              expect(isAdjacent(route[i - 1]!, route[i]!, size)).toBe(true);
            }
          }
        },
      ),
    );
  });
});
