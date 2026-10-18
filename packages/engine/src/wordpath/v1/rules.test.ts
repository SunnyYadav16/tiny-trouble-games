import { describe, expect, it } from 'vitest';
import {
  initialState,
  RULES_VERSION,
  spell,
  step,
  WRONG_MS,
  type Action,
  type Game,
  type State,
} from './rules';

// 3x3 numbering: 0 1 2 / 3 4 5 / 6 7 8
const game: Game = { size: 3, cells: 'CATXXXXXX', solution: [0, 1, 2] };

const tap = (cell: number): Action => ({ type: 'tap', cell });
const clear: Action = { type: 'clear' };
const giveUp: Action = { type: 'giveUp' };
const settle: Action = { type: 'settle' };

const run = (...actions: Action[]): State =>
  actions.reduce((s, a) => step(game, s, a), initialState());

describe('wordpath v1 rules', () => {
  it('exports constants', () => {
    expect(RULES_VERSION).toBe('wordpath/v1');
    expect(WRONG_MS).toBe(900);
  });

  it('initialState is an empty playing state', () => {
    expect(initialState()).toEqual({ route: [], status: 'playing', wrongAttempts: 0, wrong: null });
  });

  it('spell reads letters along a route', () => {
    expect(spell(game.cells, [0, 1, 2])).toBe('CAT');
    expect(spell(game.cells, [2, 1, 0])).toBe('TAC');
    expect(spell(game.cells, [])).toBe('');
  });

  it('tap appends an adjacent cell', () => expect(run(tap(0), tap(1)).route).toEqual([0, 1]));
  it('tap last removes it', () => expect(run(tap(0), tap(1), tap(1)).route).toEqual([0]));
  it('tap earlier cuts back', () =>
    expect(run(tap(0), tap(1), tap(4), tap(0)).route).toEqual([0]));
  it('non-touching tap starts new route', () => expect(run(tap(0), tap(8)).route).toEqual([8]));
  it('diagonal starts new route', () => expect(run(tap(0), tap(4)).route).toEqual([4]));
  it('first tap on an empty route starts a route', () => expect(run(tap(5)).route).toEqual([5]));

  it('out-of-range tap is a no-op', () => {
    const s = run(tap(0));
    expect(step(game, s, tap(9))).toBe(s);
    expect(step(game, s, tap(-1))).toBe(s);
    expect(step(game, s, tap(1.5))).toBe(s);
  });

  it('wrong full route', () => {
    const s = run(tap(3), tap(4), tap(5));
    expect(s).toMatchObject({
      route: [],
      wrongAttempts: 1,
      status: 'playing',
      wrong: { word: 'XXX', route: [3, 4, 5] },
    });
  });

  it('tap after wrong settles then applies', () => {
    const wrongState = run(tap(3), tap(4), tap(5));
    expect(step(game, wrongState, tap(0))).toMatchObject({
      wrong: null,
      route: [0],
      wrongAttempts: 1,
    });
  });

  it('clear after wrong settles it', () => {
    const wrongState = run(tap(3), tap(4), tap(5));
    expect(step(game, wrongState, clear)).toMatchObject({ wrong: null, route: [] });
  });

  it('solution wins', () => expect(run(tap(0), tap(1), tap(2)).status).toBe('won'));
  it('won keeps the route', () => expect(run(tap(0), tap(1), tap(2)).route).toEqual([0, 1, 2]));

  it('giveUp reveals route', () =>
    expect(run(giveUp)).toMatchObject({ status: 'gave-up', route: [0, 1, 2] }));

  it('giveUp clears a pending wrong', () => {
    const wrongState = run(tap(3), tap(4), tap(5));
    expect(step(game, wrongState, giveUp)).toMatchObject({
      status: 'gave-up',
      route: [0, 1, 2],
      wrong: null,
      wrongAttempts: 1,
    });
  });

  it('settle clears wrong; same object if nothing to clear', () => {
    const wrongState = run(tap(3), tap(4), tap(5));
    expect(step(game, wrongState, settle)).toMatchObject({ wrong: null, route: [] });
    const s = run(tap(0));
    expect(step(game, s, settle)).toBe(s);
  });

  it('clear empties the route and counts nothing', () =>
    expect(run(tap(0), tap(1), clear)).toMatchObject({ route: [], wrongAttempts: 0 }));

  it('clear on an empty route is the same object', () => {
    const s = initialState();
    expect(step(game, s, clear)).toBe(s);
  });

  it('finished states ignore everything', () => {
    const won = run(tap(0), tap(1), tap(2));
    const gaveUp = run(giveUp);
    for (const finished of [won, gaveUp]) {
      expect(step(game, finished, tap(5))).toBe(finished);
      expect(step(game, finished, clear)).toBe(finished);
      expect(step(game, finished, giveUp)).toBe(finished);
      expect(step(game, finished, settle)).toBe(finished);
    }
  });

  it('never mutates the input state', () => {
    const s = run(tap(0), tap(1));
    const frozen = JSON.stringify(s);
    step(game, s, tap(2));
    step(game, s, tap(1));
    step(game, s, clear);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});
