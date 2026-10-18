import { isAdjacent, sameRoute } from '../../shared/grid';

export const RULES_VERSION = 'wordpath/v1';
/** How long the UI shows a wrong route before dispatching `settle`. */
export const WRONG_MS = 900;

export interface Game {
  size: number;
  /** One letter per cell, row-major. */
  cells: string;
  solution: readonly number[];
}

export interface State {
  route: number[];
  status: 'playing' | 'won' | 'gave-up';
  wrongAttempts: number;
  wrong: { route: number[]; word: string } | null;
}

export type Action =
  | { type: 'tap'; cell: number }
  | { type: 'clear' }
  | { type: 'giveUp' }
  | { type: 'settle' };

export function initialState(): State {
  return { route: [], status: 'playing', wrongAttempts: 0, wrong: null };
}

export function spell(cells: string, route: readonly number[]): string {
  return route.map((cell) => cells[cell]).join('');
}

/** Returns the same object when nothing changes. Never mutates `s`. */
export function step(game: Game, s: State, a: Action): State {
  if (s.status !== 'playing') return s;
  if (a.type === 'giveUp') {
    return { ...s, status: 'gave-up', route: [...game.solution], wrong: null };
  }
  const settled = s.wrong ? { ...s, wrong: null } : s;
  if (a.type === 'settle') return settled;
  if (a.type === 'clear') return settled.route.length ? { ...settled, route: [] } : settled;
  return tap(game, settled, a.cell);
}

function tap(game: Game, s: State, cell: number): State {
  const { size, cells, solution } = game;
  if (!Number.isInteger(cell) || cell < 0 || cell >= size * size) return s;

  const { route } = s;
  const at = route.indexOf(cell);
  let next: number[];
  if (at >= 0) {
    // Last cell: remove it. Earlier cell: cut back so the route ends there.
    next = route.slice(0, at === route.length - 1 ? at : at + 1);
  } else if (route.length > 0 && isAdjacent(route[route.length - 1]!, cell, size)) {
    next = [...route, cell];
  } else {
    next = [cell];
  }

  if (next.length < solution.length) return { ...s, route: next };
  if (sameRoute(next, solution)) return { ...s, route: next, status: 'won' };
  return {
    ...s,
    route: [],
    wrongAttempts: s.wrongAttempts + 1,
    wrong: { route: next, word: spell(cells, next) },
  };
}
