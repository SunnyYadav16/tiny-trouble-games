import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wordpathV1 } from '@ttg/engine';
import { buildPuzzle } from './build';
import type { Store } from './io';
import { listHashProblems, storeProblems } from './verify';

// Thresholds of 1 keep the healthy store to four distinct answers; the code only compares against them.
vi.mock('./config', () => ({ AHEAD_DAYS: 1, UNLIMITED_INITIAL: 1 }));

type Level = wordpathV1.Level;
type PuzzleBody = wordpathV1.PuzzleBody;

const ANSWERS = ['STORM', 'CLOUD', 'PLANT', 'BRICK', 'GRAPE'];
const lists = { answers: new Set(ANSWERS), blocking: new Set(ANSWERS) };
const TODAY = '2026-11-01';
const make = (answer: string, id: string, level: Level, date?: string): PuzzleBody =>
  buildPuzzle(
    { answer, clue: 'A clue that is long enough to pass', clueSource: 'https://example.com/clue' },
    { lists, version: 'test-1', id, seedKey: id, level, date },
  );

/** Store with the file layout the loader would produce; indexCount defaults to the true counts. */
function storeOf(dailies: PuzzleBody[], unlimited: Partial<Record<Level, PuzzleBody[]>>, indexCount?: Store['indexCount']): Store {
  const full = { easy: [], normal: [], hard: [], ...unlimited } as Record<Level, PuzzleBody[]>;
  const paths = new Map<PuzzleBody, string>();
  for (const d of dailies) paths.set(d, `${d.date}.json`);
  for (const level of wordpathV1.LEVELS) full[level].forEach((p, i) => paths.set(p, `unlimited/${level}/${i + 1}.json`));
  const count = Object.fromEntries(wordpathV1.LEVELS.map((l) => [l, full[l].length])) as Record<Level, number>;
  return { dailies, unlimited: full, started: TODAY, paths, indexCount: indexCount === undefined ? count : indexCount };
}

let daily: PuzzleBody, easy: PuzzleBody, normal: PuzzleBody, hard: PuzzleBody;
const healthy = () => storeOf([daily], { easy: [easy], normal: [normal], hard: [hard] });
const problems = (s: Store, version = 'test-1', today = TODAY) => storeProblems(s, lists, version, today);

beforeEach(() => {
  daily ??= make('STORM', 'wp-2026-11-01', 'normal', TODAY);
  easy ??= make('CLOUD', 'wp-u-easy-1', 'easy');
  normal ??= make('PLANT', 'wp-u-normal-1', 'normal');
  hard ??= make('BRICK', 'wp-u-hard-1', 'hard');
});

describe('storeProblems', () => {
  it('reports nothing for a healthy store', () => {
    expect(problems(healthy())).toEqual([]);
  });

  it('passes engine problems through, e.g. a tampered grid', () => {
    const tampered = { ...daily, checks: { ...daily.checks, '8': [...daily.checks['8']!].reverse().join('') } };
    const found = problems(storeOf([tampered], { easy: [easy], normal: [normal], hard: [hard] }));
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => p.startsWith('wp-2026-11-01'))).toBe(true);
  });

  it('flags puzzles built against another word list version', () => {
    expect(problems(healthy(), 'test-2')).toEqual([
      'wp-2026-11-01: regenerate: word list changed',
      'wp-u-easy-1: regenerate: word list changed',
      'wp-u-normal-1: regenerate: word list changed',
      'wp-u-hard-1: regenerate: word list changed',
    ]);
  });

  it('flags a daily whose date differs from its file name', () => {
    const s = healthy();
    s.paths.set(daily, '2026-11-02.json');
    expect(problems(s)).toEqual(['2026-11-02.json: date is 2026-11-01']);
  });

  it('flags a daily whose id is not wp-<date>', () => {
    const odd = { ...daily, id: 'wp-2026-11-09' };
    expect(problems(storeOf([odd], { easy: [easy], normal: [normal], hard: [hard] }))).toEqual([
      '2026-11-01.json: id is wp-2026-11-09, expected wp-2026-11-01',
    ]);
  });

  it('flags a daily that is not normal', () => {
    const notNormal = make('GRAPE', 'wp-2026-11-01', 'easy', TODAY);
    expect(problems(storeOf([notNormal], { easy: [easy], normal: [normal], hard: [hard] }))).toEqual([
      '2026-11-01.json: daily is easy, must be normal',
    ]);
  });

  it('flags an unlimited file whose meta.level disagrees with its folder', () => {
    const wrong = make('GRAPE', 'wp-u-easy-1', 'hard');
    expect(problems(storeOf([daily], { easy: [wrong], normal: [normal], hard: [hard] }))).toEqual([
      'unlimited/easy/1.json: meta.level is hard, folder is easy',
    ]);
  });

  it('flags unlimited files that are not numbered 1..count with matching ids', () => {
    const s = healthy();
    s.paths.set(normal, 'unlimited/normal/3.json');
    const odd = { ...normal, id: 'wp-u-normal-4' };
    s.unlimited.normal = [odd];
    s.paths.set(odd, 'unlimited/normal/3.json');
    expect(problems(s)).toEqual([
      'unlimited/normal/3.json: expected unlimited/normal/1.json',
      'unlimited/normal/3.json: id is wp-u-normal-4, expected wp-u-normal-1',
    ]);
  });

  it('flags an index.json count that disagrees with the files', () => {
    expect(problems(storeOf([daily], { easy: [easy], normal: [normal], hard: [hard] }, { easy: 1, normal: 1, hard: 5 }))).toEqual([
      'index.json: count.hard is 5, files 1',
    ]);
  });

  it('flags a missing index.json', () => {
    expect(problems(storeOf([daily], { easy: [easy], normal: [normal], hard: [hard] }, null))).toEqual([
      'index.json: count.easy is missing, files 1',
      'index.json: count.normal is missing, files 1',
      'index.json: count.hard is missing, files 1',
    ]);
  });

  it('flags an answer used twice across dailies and unlimited', () => {
    const dup = make('STORM', 'wp-u-easy-1', 'easy');
    expect(problems(storeOf([daily], { easy: [dup], normal: [normal], hard: [hard] }))).toEqual([
      'answer STORM used by wp-2026-11-01 and wp-u-easy-1',
    ]);
  });

  it('counts only dailies dated today or later', () => {
    expect(problems(healthy(), 'test-1', '2026-11-02')).toEqual(['only 0 dailies from 2026-11-02, need 1']);
  });

  it('wants the initial unlimited puzzles in every level', () => {
    expect(problems(storeOf([daily], { easy: [easy], normal: [normal] }))).toEqual(['hard: 0 unlimited puzzles, need 1']);
  });
});

describe('listHashProblems', () => {
  const sha = (text: string) => createHash('sha256').update(text).digest('hex');
  let dir: string;
  const write = (answers: string, blocking: string, readme: string) => {
    writeFileSync(join(dir, 'answers.txt'), answers);
    writeFileSync(join(dir, 'blocking.txt'), blocking);
    writeFileSync(join(dir, 'README.md'), readme);
  };
  const readme = (a: string, b: string) => `# Lists\n\n- answers.txt: sha256 ${sha(a)}\n- blocking.txt: sha256 ${sha(b)}\n`;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ttg-lists-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('accepts files that match the README', () => {
    write('MANGO\n', 'AMONG\n', readme('MANGO\n', 'AMONG\n'));
    expect(listHashProblems(dir)).toEqual([]);
  });

  it('flags a list file edited after the README was written', () => {
    write('MANGO\nCLOUD\n', 'AMONG\n', readme('MANGO\n', 'AMONG\n'));
    expect(listHashProblems(dir)).toEqual([`answers.txt: sha256 is ${sha('MANGO\nCLOUD\n')}, README says ${sha('MANGO\n')}`]);
  });

  it('flags a README without a hash line', () => {
    write('MANGO\n', 'AMONG\n', `- answers.txt: sha256 ${sha('MANGO\n')}\n`);
    expect(listHashProblems(dir)).toEqual(['README.md: no sha256 line for blocking.txt']);
  });

  it('matches the committed word lists', () => {
    expect(listHashProblems()).toEqual([]);
  });
});
