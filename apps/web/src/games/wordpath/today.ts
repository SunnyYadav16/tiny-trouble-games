import { formatDuration } from '../../shared/daily';
import { loadResults, type ResultRecord } from './results';
import { DAILY, loadActive, type ActiveSession } from './session';

interface Plan {
  date: string;
  /** The session to resume, or null for a fresh start. */
  active: ActiveSession | null;
  done: ResultRecord | null;
  /** A saved session that must not outlive this open: it is already finished. */
  drop: boolean;
}

/** R-C16: a session from an earlier day is finished first, under its own date, unless its result is already stored. */
export function pickDaily(today: string): Plan {
  const saved = loadActive(DAILY.active);
  const results = loadResults(DAILY.results);
  const drop = !!saved && !!results[`wp-${saved.date}`];
  const active = drop ? null : saved;
  const date = active && active.date < today ? active.date : today;
  return { date, active, done: results[`wp-${date}`] ?? null, drop };
}

/** "Sunday, November 1", or "Sun, Nov 1" where room is short. */
export const dayLabel = (d: Date, long: boolean): string =>
  d.toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });

/** What opening the daily will do, and a one-line status, as Home and the Word Path page show it. */
export function dailyStatus(today: string): { action: 'Play daily' | 'Continue' | 'See result'; status: string } {
  const { active, done } = pickDaily(today);
  if (active) return { action: 'Continue', status: 'In progress' };
  if (!done) return { action: 'Play daily', status: 'Not played yet' };
  return { action: 'See result', status: done.outcome === 'solved' ? `Solved in ${formatDuration(done.timeMs)}` : 'Gave up' };
}
