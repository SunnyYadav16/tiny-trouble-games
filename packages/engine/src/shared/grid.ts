/** Cells are numbered row-major: 0..size*size-1. */

export function neighbors(i: number, size: number): number[] {
  const row = Math.floor(i / size);
  const col = i % size;
  const out: number[] = [];
  if (row > 0) out.push(i - size);
  if (row < size - 1) out.push(i + size);
  if (col > 0) out.push(i - 1);
  if (col < size - 1) out.push(i + 1);
  return out;
}

export function isAdjacent(a: number, b: number, size: number): boolean {
  return neighbors(a, size).includes(b);
}

export function sameRoute(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((cell, i) => cell === b[i]);
}

/** Number of direction changes along a route of adjacent cells; the step between cells (+-1 or +-size) is the direction. */
export function turns(route: readonly number[]): number {
  let count = 0;
  for (let i = 2; i < route.length; i++) {
    if (route[i]! - route[i - 1]! !== route[i - 1]! - route[i - 2]!) count++;
  }
  return count;
}
