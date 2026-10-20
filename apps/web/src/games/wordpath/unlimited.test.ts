import { rngFrom } from '@ttg/engine';
import { describe, expect, it } from 'vitest';
import { pickNext, unlimitedId } from './unlimited';

describe('unlimitedId', () => {
  it('names a puzzle by level and number', () => {
    expect(unlimitedId('hard', 7)).toBe('wp-u-hard-7');
  });
});

describe('pickNext', () => {
  it('never returns a seen puzzle until all five are seen, then replays', () => {
    const rng = rngFrom('pick');
    const seen = new Set<string>();
    const order: number[] = [];
    for (let i = 0; i < 5; i++) {
      const { n, replay } = pickNext('easy', 5, seen, rng);
      expect(replay).toBe(false);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(5);
      expect(seen.has(unlimitedId('easy', n))).toBe(false);
      seen.add(unlimitedId('easy', n));
      order.push(n);
    }
    expect([...order].sort()).toEqual([1, 2, 3, 4, 5]);

    const again = pickNext('easy', 5, seen, rng);
    expect(again.replay).toBe(true);
    expect(again.n).toBeGreaterThanOrEqual(1);
    expect(again.n).toBeLessThanOrEqual(5);
  });

  it('only counts seen puzzles of its own level', () => {
    const seen = new Set(['wp-u-easy-1', 'wp-u-normal-2']);
    const picks = new Set(Array.from({ length: 40 }, (_, i) => pickNext('normal', 3, seen, rngFrom(`k${i}`)).n));
    expect([...picks].sort()).toEqual([1, 3]);
  });

  it('reaches every unseen puzzle, including the last number', () => {
    const picks = new Set(Array.from({ length: 60 }, (_, i) => pickNext('hard', 3, new Set(), rngFrom(`r${i}`)).n));
    expect([...picks].sort()).toEqual([1, 2, 3]);
  });
});
