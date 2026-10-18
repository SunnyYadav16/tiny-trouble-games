import { neighbors } from '../../shared/grid';

export interface FoundRoute {
  word: string;
  route: number[];
}

/**
 * Every orthogonal, no-reuse route that spells one of `words`. All words must
 * share one length. A branch is dropped as soon as its letters stop being a
 * prefix of some word.
 */
export function findRoutes(size: number, cells: string, words: readonly string[]): FoundRoute[] {
  const targets = new Set(words);
  const prefixes = new Set<string>();
  for (const word of targets) {
    for (let n = 1; n <= word.length; n++) prefixes.add(word.slice(0, n));
  }
  const length = targets.values().next().value?.length ?? 0;

  const adjacent = Array.from({ length: size * size }, (_, i) => neighbors(i, size));
  const used = new Uint8Array(size * size);
  const route: number[] = [];
  const found: FoundRoute[] = [];

  const walk = (cell: number, prefix: string): void => {
    prefix += cells[cell];
    if (!prefixes.has(prefix)) return;
    route.push(cell);
    if (route.length === length) {
      found.push({ word: prefix, route: [...route] });
    } else {
      used[cell] = 1;
      for (const next of adjacent[cell]!) if (!used[next]) walk(next, prefix);
      used[cell] = 0;
    }
    route.pop();
  };

  for (let i = 0; i < size * size; i++) walk(i, '');
  return found;
}
