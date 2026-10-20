import { wordpathV1 } from '@ttg/engine';
import { load, remove, save } from '../../shared/storage';

export interface ModeKeys {
  active: string;
  results: string;
}

export const DAILY: ModeKeys = { active: 'ttg:wordpath:active', results: 'ttg:wordpath:results' };

/** One saved puzzle per level; one results list shared by all levels (each record carries its level). */
export const unlimitedKeys = (level: wordpathV1.Level): ModeKeys => ({
  active: `ttg:wordpath:unlimited-active:${level}`,
  results: 'ttg:wordpath:unlimited-results',
});

/** `date` is the puzzle's date for a daily, the play date for unlimited. */
export interface ActiveSession {
  puzzleId: string;
  date: string;
  size: number;
  elapsedMs: number;
  state: wordpathV1.State;
}

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
export const isText = (v: unknown): v is string => typeof v === 'string';
const isCells = (v: unknown): v is number[] => Array.isArray(v) && v.every(isCount);
const isStatus = (v: unknown): v is wordpathV1.State['status'] => v === 'playing' || v === 'won' || v === 'gave-up';

const isWrong = (v: unknown): v is NonNullable<wordpathV1.State['wrong']> =>
  isObject(v) && isCells(v.route) && isText(v.word);

const isState = (v: unknown): v is wordpathV1.State =>
  isObject(v) &&
  isCells(v.route) &&
  isStatus(v.status) &&
  isCount(v.wrongAttempts) &&
  (v.wrong === null || isWrong(v.wrong));

const isActive = (v: unknown): v is ActiveSession =>
  isObject(v) &&
  isText(v.puzzleId) &&
  isText(v.date) &&
  isCount(v.size) &&
  typeof v.elapsedMs === 'number' &&
  Number.isFinite(v.elapsedMs) &&
  v.elapsedMs >= 0 &&
  isState(v.state);

export const loadActive = (key: string): ActiveSession | null => load(key, isActive);
export const saveActive = (key: string, s: ActiveSession): void => save(key, s);
export const clearActive = (key: string): void => remove(key);
