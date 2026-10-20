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
