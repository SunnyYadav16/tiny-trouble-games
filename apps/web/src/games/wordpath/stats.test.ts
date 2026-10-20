import { beforeEach, describe, expect, it } from 'vitest';
import { saveResult, type ResultRecord } from './results';
import { DAILY, unlimitedKeys } from './session';
import { byLevel, loadStats, streaks, summarize } from './stats';

let n = 0;
const rec = (over: Partial<ResultRecord> = {}): ResultRecord => ({
  id: `wp-${n++}`,
  date: '2026-11-01',
  outcome: 'solved',
  timeMs: 60_000,
  wrongAttempts: 0,
  size: 7,
  level: 'normal',
  ...over,
});
const day = (date: string, outcome: ResultRecord['outcome'] = 'solved') => rec({ id: `wp-${date}`, date, outcome });

describe('summarize', () => {
  it('counts a give-up as played, not solved, and keeps it out of the time stats', () => {
    const s = summarize([rec({ timeMs: 20_000 }), rec({ timeMs: 40_000 }), rec({ outcome: 'gave-up', timeMs: 500_000 })]);
    expect(s).toMatchObject({ played: 3, solved: 2, avgSolveMs: 30_000 });
    expect(s.solveRate).toBeCloseTo(2 / 3);
  });

  it('gives zeros, not NaN, for no records', () => {
    expect(summarize([])).toEqual({
      played: 0,
      solved: 0,
      solveRate: 0,
      avgSolveMs: 0,
      distribution: [
        { label: 'under 0:30', count: 0 },
        { label: '0:30–1:00', count: 0 },
        { label: '1:00–2:00', count: 0 },
        { label: '2:00–5:00', count: 0 },
        { label: '5:00+', count: 0 },
      ],
    });
  });

  it('puts each solve in one bucket; an edge belongs to the slower bucket; give-ups are not counted', () => {
    const times = [0, 29_999, 30_000, 59_999, 60_000, 119_999, 120_000, 299_999, 300_000, 3_600_000];
    const s = summarize([...times.map((timeMs) => rec({ timeMs })), rec({ outcome: 'gave-up', timeMs: 1000 })]);
    expect(s.distribution.map((d) => d.count)).toEqual([2, 2, 2, 2, 2]);
  });
});

describe('streaks', () => {
  it('counts consecutive solved days ending today', () => {
    expect(streaks([day('2026-11-01'), day('2026-11-02'), day('2026-11-03')], '2026-11-03')).toEqual({ current: 3, best: 3 });
  });

  it('breaks on a missed day', () => {
    expect(streaks([day('2026-11-01'), day('2026-11-03')], '2026-11-03')).toEqual({ current: 1, best: 1 });
  });

  it('keeps the streak when today is not finished yet, counting to yesterday', () => {
    expect(streaks([day('2026-11-01'), day('2026-11-02')], '2026-11-03')).toEqual({ current: 2, best: 2 });
  });

  it('drops to 0 when today was given up, and a give-up earlier breaks the run', () => {
    expect(streaks([day('2026-11-01'), day('2026-11-02'), day('2026-11-03', 'gave-up')], '2026-11-03')).toEqual({ current: 0, best: 2 });
    expect(streaks([day('2026-11-01'), day('2026-11-02', 'gave-up'), day('2026-11-03')], '2026-11-03')).toEqual({ current: 1, best: 1 });
  });

  it('is 0 after a missed day, and remembers the best run across it', () => {
    const run = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((d) => day(d));
    expect(streaks(run, '2026-11-03')).toEqual({ current: 0, best: 4 });
  });

  it('counts across month and year ends', () => {
    expect(streaks([day('2026-12-31'), day('2027-01-01')], '2027-01-01')).toEqual({ current: 2, best: 2 });
  });

  it('is 0 and 0 for no records', () => {
    expect(streaks([], '2026-11-03')).toEqual({ current: 0, best: 0 });
  });
});

describe('byLevel', () => {
  it('summarizes each level apart from the others', () => {
    const by = byLevel([rec({ level: 'easy' }), rec({ level: 'easy', outcome: 'gave-up' }), rec({ level: 'hard', timeMs: 200_000 })]);
    expect(by.easy).toMatchObject({ played: 2, solved: 1 });
    expect(by.normal.played).toBe(0);
    expect(by.hard).toMatchObject({ played: 1, avgSolveMs: 200_000 });
  });
});

describe('loadStats', () => {
  beforeEach(() => localStorage.clear());

  it('reads daily and unlimited results; unlimited never feeds the streak', () => {
    saveResult(DAILY.results, day('2026-11-02'));
    saveResult(unlimitedKeys('hard').results, rec({ level: 'hard', date: '2026-11-03' }));
    const s = loadStats('2026-11-03');
    expect(s.daily).toMatchObject({ played: 1, solved: 1, current: 1, best: 1 });
    expect(s.unlimited.solved).toBe(1);
    expect(s.byLevel.hard.solved).toBe(1);
  });

  it('is all zeros on a fresh browser', () => {
    const s = loadStats('2026-11-03');
    expect(s.daily).toMatchObject({ played: 0, current: 0, best: 0 });
    expect(s.unlimited.played).toBe(0);
  });
});
