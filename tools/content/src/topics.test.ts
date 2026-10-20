import { describe, expect, it } from 'vitest';
import { TOPICS, topicFor } from './topics';

const DAY_MS = 86_400_000;
const date = (i: number) => new Date(Date.UTC(2026, 9, 19) + i * DAY_MS).toISOString().slice(0, 10);
const take = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i));

describe('topicFor', () => {
  it('gives every topic once across TOPICS.length consecutive dates, and adjacent dates differ', () => {
    const topics = take(TOPICS.length * 2, (i) => topicFor(date(i)));
    expect(new Set(topics.slice(0, TOPICS.length)).size).toBe(TOPICS.length);
    expect(topics.slice(TOPICS.length)).toEqual(topics.slice(0, TOPICS.length));
    topics.slice(1).forEach((t, i) => expect(t).not.toBe(topics[i]));
  });

  it('treats a daily slot id (wp-<date>) like its date', () => {
    expect(topicFor(`wp-${date(3)}`)).toBe(topicFor(date(3)));
  });

  it('cycles through every topic over consecutive unlimited puzzles at one level', () => {
    for (const level of ['easy', 'normal', 'hard']) {
      const topics = take(TOPICS.length, (i) => topicFor(`wp-u-${level}-${i + 1}`));
      expect(new Set(topics).size).toBe(TOPICS.length);
      expect(topicFor(`wp-u-${level}-${TOPICS.length + 1}`)).toBe(topics[0]);
    }
  });

  it('gives the three levels different topics at the same n', () => {
    for (let n = 1; n <= TOPICS.length * 2; n++) {
      const [easy, normal, hard] = ['easy', 'normal', 'hard'].map((l) => topicFor(`wp-u-${l}-${n}`));
      expect(new Set([easy, normal, hard]).size).toBe(3);
    }
  });

  it('is deterministic, and falls back to a stable topic for other keys', () => {
    expect(topicFor('wp-2026-10-19')).toBe(topicFor('wp-2026-10-19'));
    expect(topicFor('something-else')).toBe(topicFor('something-else'));
    expect(TOPICS).toContain(topicFor('something-else'));
  });
});
