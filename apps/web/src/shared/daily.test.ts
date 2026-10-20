import { describe, expect, it } from 'vitest';
import { formatDateLabel, formatDuration, localDateKey, msUntilNextMidnight } from './daily';

describe('daily', () => {
  it('localDateKey uses local time', () => {
    expect(localDateKey(new Date(2026, 10, 1, 23, 59))).toBe('2026-11-01');
    expect(localDateKey(new Date(2026, 0, 5, 0, 0))).toBe('2026-01-05');
  });

  it('msUntilNextMidnight counts to local midnight', () => {
    expect(msUntilNextMidnight(new Date(2026, 10, 1, 23, 0))).toBe(3_600_000);
  });

  it('formatDuration as m:ss', () => {
    expect(formatDuration(41_000)).toBe('0:41');
    expect(formatDuration(725_000)).toBe('12:05');
  });

  it('formatDateLabel as short en-US', () => {
    expect(formatDateLabel('2026-11-01')).toBe('Nov 1');
  });
});
