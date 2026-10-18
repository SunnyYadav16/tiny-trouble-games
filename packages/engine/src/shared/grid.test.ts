import { describe, expect, it } from 'vitest';
import { isAdjacent, neighbors, sameRoute, turns } from './grid';

// 3x3 numbering: 0 1 2 / 3 4 5 / 6 7 8
describe('grid helpers', () => {
  it('neighbors', () => {
    expect(neighbors(0, 3).sort()).toEqual([1, 3]);
    expect(neighbors(4, 3).sort()).toEqual([1, 3, 5, 7]);
  });

  it('isAdjacent', () => {
    expect(isAdjacent(2, 3, 3)).toBe(false); // no row wrap
    expect(isAdjacent(0, 4, 3)).toBe(false); // no diagonal
    expect(isAdjacent(0, 1, 3)).toBe(true);
    expect(isAdjacent(1, 4, 3)).toBe(true);
  });

  it('sameRoute', () => {
    expect(sameRoute([0, 1, 2], [2, 1, 0])).toBe(false);
    expect(sameRoute([0, 1, 2], [0, 1, 2])).toBe(true);
    expect(sameRoute([0, 1], [0, 1, 2])).toBe(false);
  });

  it('turns', () => {
    expect(turns([0, 1, 2, 3, 4], 6)).toBe(0); // straight
    expect(turns([0, 1, 7, 8], 6)).toBe(2); // right, down, right
  });
});
