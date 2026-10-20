import { wordpathV1 } from '@ttg/engine';
import { describe, expect, it } from 'vitest';
import { EXAMPLE } from './example';

describe('EXAMPLE', () => {
  it('has exactly one route spelling its word, and that route is its solution', () => {
    const found = wordpathV1.findRoutes(EXAMPLE.size, EXAMPLE.cells, [EXAMPLE.word]);
    expect(found.map((f) => f.route)).toEqual([EXAMPLE.solution]);
    expect(wordpathV1.spell(EXAMPLE.cells, EXAMPLE.solution)).toBe(EXAMPLE.word);
  });

  it('is solved by tapping its route through the engine', () => {
    const game = { size: EXAMPLE.size, cells: EXAMPLE.cells, solution: EXAMPLE.solution };
    const end = EXAMPLE.solution.reduce((s, cell) => wordpathV1.step(game, s, { type: 'tap', cell }), wordpathV1.initialState());
    expect(end.status).toBe('won');
  });
});
