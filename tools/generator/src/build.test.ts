import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { wordpathV1 } from '@ttg/engine';
import { buildPuzzle } from './build';
import { unlimitedTarget } from './config';
import type { Candidate } from './gates';
import { loadLists, loadStore, nextUnlimitedId, saveDaily, saveUnlimited, usedAnswers } from './io';

const BLOCKED = ['AMONG', 'GAMMA', 'MAMMA', 'MANGA', 'MANNA'];
const lists = { answers: new Set(['MANGO', 'CLOUD']), blocking: new Set([...BLOCKED, 'MANGO', 'CLOUD']) };
const mango: Candidate = { answer: 'MANGO', clue: 'A tropical fruit with a large stone', clueSource: 'https://example.com/mango' };
const cloud: Candidate = { answer: 'CLOUD', clue: 'It drifts overhead and may bring rain', clueSource: 'https://example.com/cloud' };
const make = (c: Candidate, id: string, level: wordpathV1.Level = 'normal', date?: string) =>
  buildPuzzle(c, { lists, version: 'test-1', id, seedKey: id, level, date });

describe('buildPuzzle', () => {
  it('returns a puzzle that verifies at all six sizes and recovers the answer', () => {
    const p = make(mango, 'wp-2026-11-01', 'normal', '2026-11-01');
    expect(Object.keys(p.grids)).toHaveLength(6);
    expect(wordpathV1.verify(p, lists)).toEqual([]);
    expect(wordpathV1.recoverAnswer(p)).toBe('MANGO');
    expect(p.meta.wordListVersion).toBe('test-1');
  });

  it('throws one error listing every problem', () => {
    // ARRAY has 3 distinct letters and is missing from the answer list: two problems.
    const array = { ...mango, answer: 'ARRAY' };
    const run = () => buildPuzzle(array, { lists: { answers: new Set(), blocking: new Set() }, version: 'v', id: 'x', seedKey: 'x', level: 'normal' });
    expect(run).toThrow(/x failed verification/);
    expect(run).toThrow(/4 distinct letters/);
    expect(run).toThrow(/answer list/);
  });
});

describe('unlimitedTarget', () => {
  it('starts at 40 per level and adds 7 per whole day', () => {
    expect(unlimitedTarget('2026-10-20', '2026-10-20')).toBe(40);
    expect(unlimitedTarget('2026-10-20', '2026-10-22')).toBe(54);
    expect(unlimitedTarget('2026-10-20', '2026-10-19')).toBe(40);
  });
});

describe('loadLists', () => {
  it('reads the committed word lists', () => {
    const { lists: real, version } = loadLists();
    expect(version).toMatch(/^wl-/);
    expect(real.answers.size).toBeGreaterThan(0);
    expect(real.blocking.size).toBeGreaterThan(0);
  });
});

describe('store', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ttg-store-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('loads a missing directory as an empty store', () => {
    expect(loadStore(join(dir, 'nope'))).toEqual({
      dailies: [],
      unlimited: { easy: [], normal: [], hard: [] },
      started: null,
      paths: new Map(),
      indexCount: null,
    });
  });

  it('round-trips a daily as pretty JSON with a trailing newline', () => {
    const p = make(mango, 'wp-2026-11-01', 'normal', '2026-11-01');
    saveDaily(p, dir);
    const text = readFileSync(join(dir, '2026-11-01.json'), 'utf8');
    expect(text).toBe(JSON.stringify(p, null, 2) + '\n');
    const loaded = loadStore(dir);
    expect(loaded.dailies).toEqual([p]);
    expect(loaded.paths.get(loaded.dailies[0]!)).toBe('2026-11-01.json');
  });

  it('never overwrites a daily or an unlimited file', () => {
    const p = make(mango, 'wp-2026-11-01', 'normal', '2026-11-01');
    saveDaily(p, dir);
    expect(() => saveDaily(p, dir)).toThrow(join(dir, '2026-11-01.json'));

    // One file already present, so the next number (2) is taken by a stray 2.json.
    const taken = join(dir, 'unlimited/normal/2.json');
    mkdirSync(join(dir, 'unlimited/normal'), { recursive: true });
    writeFileSync(taken, 'keep me');
    expect(() => saveUnlimited(make(cloud, 'wp-u-normal-2'), '2026-10-20', dir)).toThrow(taken);
    expect(readFileSync(taken, 'utf8')).toBe('keep me');
  });

  it('numbers unlimited puzzles per level and writes the index', () => {
    const a = make(mango, 'wp-u-normal-1');
    const b = make(cloud, 'wp-u-normal-2');
    saveUnlimited(a, '2026-10-20', dir);
    saveUnlimited(b, '2026-10-21', dir);
    expect(readFileSync(join(dir, 'unlimited/normal/2.json'), 'utf8')).toBe(JSON.stringify(b, null, 2) + '\n');
    expect(JSON.parse(readFileSync(join(dir, 'unlimited/index.json'), 'utf8'))).toEqual({
      count: { easy: 0, normal: 2, hard: 0 },
      started: '2026-10-20',
    });
    const hard = { ...a, id: 'wp-u-hard-1', meta: { ...a.meta, level: 'hard' as const } };
    saveUnlimited(hard, '2026-10-22', dir);
    expect(readFileSync(join(dir, 'unlimited/hard/1.json'), 'utf8')).toBe(JSON.stringify(hard, null, 2) + '\n');
    const store = loadStore(dir);
    expect(store.unlimited.normal).toEqual([a, b]);
    expect(store.started).toBe('2026-10-20');
    expect(store.indexCount).toEqual({ easy: 0, normal: 2, hard: 1 });
    expect(store.paths.get(store.unlimited.normal[1]!)).toBe('unlimited/normal/2.json');
    expect(nextUnlimitedId(store, 'normal')).toBe('wp-u-normal-3');
    expect(nextUnlimitedId(store, 'easy')).toBe('wp-u-easy-1');
  });

  it('collects uppercase answers of dailies and unlimited', () => {
    saveDaily(make(mango, 'wp-2026-11-01', 'normal', '2026-11-01'), dir);
    saveUnlimited(make(cloud, 'wp-u-normal-1'), '2026-10-20', dir);
    expect(usedAnswers(loadStore(dir))).toEqual(new Set(['MANGO', 'CLOUD']));
  });

  it('throws naming the path of an unparseable file', () => {
    saveDaily(make(mango, 'wp-2026-11-01', 'normal', '2026-11-01'), dir);
    const path = join(dir, '2026-11-02.json');
    writeFileSync(path, '<html>not a puzzle</html>');
    expect(() => loadStore(dir)).toThrow(path);
  });

  it('refuses to report used answers when one cannot be recovered', () => {
    const p = make(mango, 'wp-2026-11-01', 'normal', '2026-11-01');
    const bad = { ...p, checks: { ...p.checks, '8': [...p.checks['8']!].reverse().join('') } };
    expect(() => usedAnswers({ dailies: [bad], unlimited: { easy: [], normal: [], hard: [] }, started: null, paths: new Map(), indexCount: null })).toThrow(
      /wp-2026-11-01/,
    );
  });
});
