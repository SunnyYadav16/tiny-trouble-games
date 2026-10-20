import { beforeEach, describe, expect, it } from 'vitest';
import { DAILY, saveActive, unlimitedKeys } from './session';
import { loadResults, saveResult, type ResultRecord } from './results';

const rec = (over: Partial<ResultRecord> = {}): ResultRecord => ({
  id: 'wp-2026-10-19',
  date: '2026-10-19',
  outcome: 'solved',
  timeMs: 61000,
  wrongAttempts: 0,
  size: 8,
  level: 'normal',
  ...over,
});

describe('results store', () => {
  beforeEach(() => localStorage.clear());

  it('is empty when nothing is saved', () => {
    expect(loadResults('r')).toEqual({});
  });

  it('keeps earlier results when saving another', () => {
    saveResult('r', rec());
    saveResult('r', rec({ id: 'wp-2026-10-20', date: '2026-10-20' }));
    expect(Object.keys(loadResults('r')).sort()).toEqual(['wp-2026-10-19', 'wp-2026-10-20']);
  });

  it('replaces a result saved under the same id', () => {
    saveResult('r', rec());
    saveResult('r', rec({ outcome: 'gave-up', timeMs: 9 }));
    const all = loadResults('r');
    expect(Object.keys(all)).toHaveLength(1);
    expect(all['wp-2026-10-19']).toMatchObject({ outcome: 'gave-up', timeMs: 9 });
  });

  it('drops a corrupt store', () => {
    localStorage.setItem('r', '[1,2]');
    expect(loadResults('r')).toEqual({});
    expect(localStorage.getItem('r')).toBeNull();
    localStorage.setItem('r', '{oops');
    expect(loadResults('r')).toEqual({});
  });

  it('drops a store holding one malformed record', () => {
    saveResult('r', rec());
    const bad = { ...loadResults('r'), x: { id: 'x', outcome: 'lost' } };
    localStorage.setItem('r', JSON.stringify(bad));
    expect(loadResults('r')).toEqual({});
  });

  it('rejects a record stored under a key that is not its id', () => {
    localStorage.setItem('r', JSON.stringify({ other: rec() }));
    expect(loadResults('r')).toEqual({});
  });

  it('unlimited results share one list and carry their level; daily is separate', () => {
    saveResult(DAILY.results, rec());
    saveResult(unlimitedKeys('hard').results, rec({ id: 'h-1', level: 'hard' }));
    saveResult(unlimitedKeys('easy').results, rec({ id: 'e-1', level: 'easy' }));
    saveActive(DAILY.active, {
      puzzleId: 'p',
      date: 'd',
      size: 6,
      elapsedMs: 0,
      state: { route: [], status: 'playing', wrongAttempts: 0, wrong: null },
    });
    const un = loadResults(unlimitedKeys('hard').results);
    expect(Object.keys(un).sort()).toEqual(['e-1', 'h-1']);
    expect(un['h-1']?.level).toBe('hard');
    expect(Object.keys(loadResults(DAILY.results))).toEqual(['wp-2026-10-19']);
  });
});
