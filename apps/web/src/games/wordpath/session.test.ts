import { beforeEach, describe, expect, it } from 'vitest';
import { wordpathV1 } from '@ttg/engine';
import { DAILY, clearActive, loadActive, saveActive, unlimitedKeys, type ActiveSession } from './session';

const state = (over: Partial<wordpathV1.State> = {}): wordpathV1.State => ({
  route: [0, 1, 7],
  status: 'playing',
  wrongAttempts: 1,
  wrong: null,
  ...over,
});
const session = (over: Partial<ActiveSession> = {}): ActiveSession => ({
  puzzleId: 'wp-2026-10-19',
  date: '2026-10-19',
  size: 8,
  elapsedMs: 4200,
  state: state(),
  ...over,
});

describe('keys', () => {
  it('daily and per-level unlimited keys', () => {
    expect(DAILY).toEqual({ active: 'ttg:wordpath:active', results: 'ttg:wordpath:results' });
    expect(unlimitedKeys('hard')).toEqual({
      active: 'ttg:wordpath:unlimited-active:hard',
      results: 'ttg:wordpath:unlimited-results',
    });
  });
});

describe('active session', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips, including a wrong attempt in flight', () => {
    const s = session({ state: state({ wrong: { route: [0, 1], word: 'AB' } }) });
    saveActive('k', s);
    expect(loadActive('k')).toEqual(s);
  });

  it('returns null for a missing key', () => {
    expect(loadActive('k')).toBeNull();
  });

  it('returns null and clears for corrupt JSON', () => {
    localStorage.setItem('k', '{oops');
    expect(loadActive('k')).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('returns null and clears for a wrong-shape object', () => {
    localStorage.setItem('k', JSON.stringify({ puzzleId: 'x' }));
    expect(loadActive('k')).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it.each<[string, unknown]>([
    ['route not an array', { state: { ...state(), route: 'abc' } }],
    ['route with a negative', { state: state({ route: [0, -1] }) }],
    ['route with a fraction', { state: state({ route: [0, 1.5] }) }],
    ['route with a string', { state: { ...state(), route: [0, '1'] } }],
    ['bad status', { state: { ...state(), status: 'lost' } }],
    ['negative wrongAttempts', { state: state({ wrongAttempts: -1 }) }],
    ['fractional wrongAttempts', { state: state({ wrongAttempts: 1.5 }) }],
    ['wrong is undefined', { state: { ...state(), wrong: undefined } }],
    ['wrong missing word', { state: { ...state(), wrong: { route: [1] } } }],
    ['wrong with bad route', { state: { ...state(), wrong: { route: [-1], word: 'A' } } }],
    ['negative elapsedMs', { elapsedMs: -5 }],
    ['non-finite elapsedMs', { elapsedMs: null }],
    ['non-integer size', { size: 7.5 }],
    ['non-text puzzleId', { puzzleId: 7 }],
    ['non-text date', { date: null }],
  ])('rejects %s', (_name, patch) => {
    localStorage.setItem('k', JSON.stringify({ ...session(), ...(patch as object) }));
    expect(loadActive('k')).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('clearActive removes the key', () => {
    saveActive('k', session());
    clearActive('k');
    expect(localStorage.getItem('k')).toBeNull();
  });
});

describe('mode isolation', () => {
  beforeEach(() => localStorage.clear());

  it('unlimited hard leaves daily and easy active untouched, and the reverse', () => {
    const daily = session({ puzzleId: 'wp-2026-10-19' });
    const easy = session({ puzzleId: 'easy-1' });
    saveActive(DAILY.active, daily);
    saveActive(unlimitedKeys('easy').active, easy);
    saveActive(unlimitedKeys('hard').active, session({ puzzleId: 'hard-1' }));
    clearActive(unlimitedKeys('hard').active);
    expect(loadActive(DAILY.active)).toEqual(daily);
    expect(loadActive(unlimitedKeys('easy').active)).toEqual(easy);
    expect(loadActive(unlimitedKeys('hard').active)).toBeNull();

    clearActive(DAILY.active);
    expect(loadActive(unlimitedKeys('easy').active)).toEqual(easy);
  });
});
