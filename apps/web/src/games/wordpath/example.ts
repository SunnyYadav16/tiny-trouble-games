import { wordpathV1 } from '@ttg/engine';

/**
 * The fixed 4×4 example on the Home card and in how to play. Row-major:
 * T R I A / L A I T / R T L A / A I R L. Only one route spells TRAIL (example.test.ts).
 */
export const EXAMPLE: { size: 4; cells: string; solution: number[]; word: string } = {
  size: 4,
  cells: 'TRIALAITRTLAAIRL',
  solution: [0, 1, 5, 6, 10],
  word: 'TRAIL',
};

// The demo is the engine playing the example: each frame is the state after one more tap, so it cannot drift from the rules.
const GAME: wordpathV1.Game = { size: EXAMPLE.size, cells: EXAMPLE.cells, solution: EXAMPLE.solution };
export const EXAMPLE_FRAMES: readonly wordpathV1.State[] = EXAMPLE.solution.reduce(
  (frames, cell) => [...frames, wordpathV1.step(GAME, frames.at(-1)!, { type: 'tap', cell })],
  [wordpathV1.initialState()],
);
export const EXAMPLE_LAST = EXAMPLE_FRAMES.length - 1;
