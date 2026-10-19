import { beforeAll, describe, expect, it } from 'vitest';
import { decodeRoute, encodeRoute } from './check';
import { GenerateError, SIZES } from './generate';
import { makePuzzle, parsePuzzle, recoverAnswer, replayProblems, verify, type MakePuzzleInput, type PuzzleBody } from './puzzle';
import type { WordLists } from './words';

const BLOCKED = ['AMONG', 'GAMMA', 'MAMMA', 'MANGA', 'MANNA'];
const lists: WordLists = { answers: new Set(['MANGO']), blocking: new Set([...BLOCKED, 'MANGO']) };
const input: MakePuzzleInput = {
  id: 'wp-2026-11-01',
  seedKey: '2026-11-01',
  date: '2026-11-01',
  level: 'normal',
  answer: 'MANGO',
  clue: 'A tropical fruit with a large stone',
  blocked: BLOCKED,
  wordListVersion: 'test-1',
};

let p: PuzzleBody;
beforeAll(() => {
  p = makePuzzle(input);
});

const clone = (): any => JSON.parse(JSON.stringify(p));

describe('makePuzzle', () => {
  it('has the documented shape and no answer', () => {
    expect(Object.keys(p)).not.toContain('answer');
    expect(Object.values(p)).not.toContain('MANGO');
    expect(Object.keys(p.grids)).toEqual(SIZES.map(String));
    expect(p).toMatchObject({ game: 'wordpath', rulesVersion: 'wordpath/v1', length: 5, date: '2026-11-01' });
    expect(p.meta).toEqual({ wordListVersion: 'test-1', generatorVersion: 'gen-1', level: 'normal' });
  });

  it('leaves date off unlimited puzzles', () => {
    const { date: _date, ...rest } = input;
    expect(Object.keys(makePuzzle({ ...rest, id: 'u-1', seedKey: 'u-1' }))).not.toContain('date');
  });

  it('is deterministic', () => {
    expect(makePuzzle(input)).toEqual(makePuzzle(input));
  });

  it('throws GenerateError naming the answer when a size cannot be built', () => {
    expect(() => makePuzzle({ ...input, answer: 'LEVEL' })).toThrow(GenerateError);
  });
});

describe('recoverAnswer', () => {
  it('returns MANGO', () => expect(recoverAnswer(p)).toBe('MANGO'));

  it('returns null when sizes disagree', () => {
    const bad = clone();
    bad.checks['8'] = encodeRoute(decodeRoute(bad.checks['8']).reverse());
    expect(recoverAnswer(bad)).toBeNull();
  });
});

describe('parsePuzzle', () => {
  it('round-trips through JSON and recovers solutions', () => {
    const parsed = parsePuzzle(JSON.parse(JSON.stringify(p)));
    expect(parsed?.puzzle).toEqual(p);
    for (const size of SIZES) expect(parsed?.solutions[size]).toEqual(decodeRoute(p.checks[size]!));
  });

  it('builds the result from validated fields only', () => {
    const raw = clone();
    raw.extra = 1;
    raw.meta.source = 'https://example.com/old';
    expect(parsePuzzle(raw)?.puzzle).toEqual(p);
  });

  it.each<[string, (d: any) => void]>([
    ['wrong rulesVersion', (d) => (d.rulesVersion = 'wordpath/v9')],
    ['wrong game', (d) => (d.game = 'other')],
    ['empty id', (d) => (d.id = '')],
    ['non-string clue', (d) => (d.clue = 5)],
    ['length 4', (d) => (d.length = 4)],
    ['length 8', (d) => (d.length = 8)],
    ['fractional length', (d) => (d.length = 5.5)],
    ['bad date', (d) => (d.date = '11/01/2026')],
    ['unknown level', (d) => (d.meta.level = 'insane')],
    ['missing meta field', (d) => delete d.meta.generatorVersion],
    ['missing meta', (d) => delete d.meta],
    ['a missing grid size', (d) => delete d.grids['9']],
    ['a missing check size', (d) => delete d.checks['9']],
    ['an extra grid size', (d) => (d.grids['11'] = 'A'.repeat(121))],
    ['an extra check size', (d) => (d.checks['11'] = d.checks['6'])],
    ['a short grid', (d) => (d.grids['8'] = d.grids['8'].slice(1))],
    ['a lowercase grid', (d) => (d.grids['8'] = d.grids['8'].toLowerCase())],
    ['junk checks', (d) => (d.checks['8'] = 'zzzz')],
    ['empty checks', (d) => (d.checks['8'] = '')],
    ['checks with trailing junk', (d) => (d.checks['8'] += '!')],
    ['checks with a repeated cell', (d) => {
      const r = decodeRoute(d.checks['8']);
      r[2] = r[0];
      d.checks['8'] = encodeRoute(r);
    }],
    ['checks out of range', (d) => (d.checks['6'] = encodeRoute([0, 1, 2, 3, 99]))],
    ['checks that are not adjacent', (d) => (d.checks['6'] = encodeRoute([0, 1, 2, 3, 35]))],
    ['checks of the wrong length', (d) => (d.checks['6'] = encodeRoute([0, 1, 2, 3]))],
  ])('rejects %s', (_name, mutate) => {
    const d = clone();
    mutate(d);
    expect(parsePuzzle(d)).toBeNull();
  });

  it.each([null, undefined, 5, '<!doctype html>', [], {}])('rejects junk %j', (junk) => {
    expect(parsePuzzle(junk)).toBeNull();
  });
});

describe('replayProblems', () => {
  it('is empty for a fresh puzzle', () => expect(replayProblems(p, 'MANGO')).toEqual([]));

  it('flags checks that do not match the grid', () => {
    const bad = clone();
    const route = decodeRoute(bad.checks['8']);
    // Another valid adjacent route of the same length: shift the whole route if it fits, else walk a row.
    const other = route.every((c: number) => c % 8 < 7) ? route.map((c: number) => c + 1) : [0, 1, 2, 3, 4];
    bad.checks['8'] = encodeRoute(other);
    expect(replayProblems(bad, 'MANGO')).toContainEqual(expect.stringContaining('replay'));
  });

  it('flags a grid where the answer has no single route', () => {
    const bad = clone();
    bad.grids['6'] = 'A'.repeat(36);
    const problems = replayProblems(bad, 'MANGO');
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) expect(problem).toContain('replay');
  });
});

describe('verify', () => {
  it('passes a fresh puzzle at all six sizes', () => expect(verify(p, lists)).toEqual([]));

  it('catches a tampered grid', () => {
    const bad = clone();
    const cell = decodeRoute(bad.checks['8'])[0]!;
    const grid: string[] = [...bad.grids['8']];
    grid[cell] = grid[cell] === 'Z' ? 'Y' : 'Z';
    bad.grids['8'] = grid.join('');
    const problems = verify(bad, lists);
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) expect(problem).toMatch(/^wp-2026-11-01: /);
  });

  it('reports an extra route spelling a blocked word', () => {
    const bad = clone();
    // Spell AMONG along a 6×6 row the solution does not touch, so the answer stays recoverable.
    const rows = new Set(decodeRoute(bad.checks['6']).map((cell) => Math.floor(cell / 6)));
    const start = 6 * [0, 1, 2, 3, 4, 5].find((row) => !rows.has(row))!;
    bad.grids['6'] = bad.grids['6'].slice(0, start) + 'AMONG' + bad.grids['6'].slice(start + 5);
    expect(verify(bad, lists).join('\n')).toMatch(/6×6/);
  });

  it('reports an answer that fails the eligibility check', () => {
    const noAnswers: WordLists = { answers: new Set(), blocking: lists.blocking };
    expect(verify(p, noAnswers).join('\n')).toContain('not in the answer list');
  });

  it('reports junk instead of throwing', () => {
    expect(verify({ ...clone(), rulesVersion: 'nope' }, lists)).toEqual([expect.stringMatching(/^wp-2026-11-01: .*parse/)]);
  });
});
