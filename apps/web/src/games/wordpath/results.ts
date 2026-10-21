import { wordpathV1 } from '@ttg/engine';
import { load, save } from '../../shared/storage';
import { isCount, isObject, isText } from './session';

/** `level` is `normal` for every daily. A daily's id is `wp-<date>`. */
export interface ResultRecord {
  id: string;
  date: string;
  outcome: 'solved' | 'gave-up';
  timeMs: number;
  wrongAttempts: number;
  size: number;
  level: wordpathV1.Level;
}

const isRecord = (v: unknown): v is ResultRecord =>
  isObject(v) &&
  isText(v.id) &&
  isText(v.date) &&
  (v.outcome === 'solved' || v.outcome === 'gave-up') &&
  isCount(v.timeMs) &&
  isCount(v.wrongAttempts) &&
  (wordpathV1.SIZES as readonly unknown[]).includes(v.size) &&
  wordpathV1.LEVELS.includes(v.level as wordpathV1.Level);

/** One bad record, or a record filed under a key other than its id, discards the whole store. */
const isStore = (v: unknown): v is Record<string, ResultRecord> =>
  isObject(v) && Object.entries(v).every(([id, r]) => isRecord(r) && r.id === id);

export const loadResults = (key: string): Record<string, ResultRecord> => load(key, isStore) ?? {};

export const saveResult = (key: string, r: ResultRecord): void => save(key, { ...loadResults(key), [r.id]: r });
