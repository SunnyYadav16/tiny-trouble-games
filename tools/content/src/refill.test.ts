import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wordpathV1 } from '@ttg/engine';
import { buildPuzzle } from '@ttg/generator/build';
import type { Candidate } from '@ttg/generator/gates';
import { loadStore, saveDaily, saveUnlimited, usedAnswers } from '@ttg/generator/io';
import { LlmAuthError, LlmQuotaError, type Llm, type Review } from './llm';
import { addDays, refill } from './refill';

type Level = wordpathV1.Level;

const TODAY = '2026-11-01';
// Words that build at every level with these lists. MANGO is the answer of every seeded puzzle.
const POOL = ('CLOUD PLANT TIGER RIVER STORM PIANO TRAIN BREAD HONEY LEMON OCEAN EAGLE CHAIR TABLE SUGAR CANDY FROST ' +
  'WHALE ZEBRA HORSE MOUSE SNAKE ROBIN PEACH GRAPE MELON OLIVE BACON PASTA PIZZA SALAD TOAST WAFFLE PICKLE ' +
  'CARROT POTATO TOMATO GARLIC GINGER BUTTER CHEESE YOGURT CEREAL MUFFIN COOKIE CHERRY ORANGE WALNUT ALMOND CASHEW').split(' ');
const lists = { answers: new Set([...POOL, 'MANGO']), blocking: new Set([...POOL, 'MANGO']) };
const mango: Candidate = { answer: 'MANGO', clue: 'A tropical fruit with a large stone' };
const base = buildPuzzle(mango, { lists, version: 'test-1', id: 'base', seedKey: 'base', level: 'normal' });

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ttg-refill-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Fills the store with copies of one MANGO puzzle: every daily except `skip` (offsets from today), and `counts` per level. */
function seed({ skip = [] as number[], counts = { easy: 40, normal: 40, hard: 40 } as Record<Level, number>, started = TODAY } = {}) {
  for (let i = 0; i < 30; i++) {
    const date = addDays(TODAY, i);
    if (!skip.includes(i)) saveDaily({ ...base, id: `wp-${date}`, date }, dir);
  }
  for (const level of wordpathV1.LEVELS) {
    for (let n = 1; n <= counts[level]; n++) {
      saveUnlimited({ ...base, id: `wp-u-${level}-${n}`, meta: { ...base.meta, level } }, started, dir);
    }
  }
}

interface Script {
  propose?: Partial<Candidate>[];
  review?: Partial<Review>[];
  solve?: string[][];
}

/** A fake Llm. Each call takes the next scripted value, then falls back to a passing default. */
function fakes(script: Script = {}) {
  const log: string[] = [];
  const answerOf = new Map<string, string>();
  let n = 0;
  const llm = {
    propose: vi.fn<Llm['propose']>(async (r) => {
      log.push('propose');
      const answer = POOL.find((w) => !r.avoid.includes(w) && !r.rejected.some((x) => x.answer === w))!;
      const c = { answer, clue: `Puzzle clue number ${++n}`, ...script.propose?.shift() };
      answerOf.set(c.clue.trim(), c.answer.trim().toUpperCase());
      return c;
    }),
    review: vi.fn<Llm['review']>(async () => {
      log.push('review');
      return { accurate: true, offensive: false, plainDefinition: false, reason: 'fine', ...script.review?.shift() };
    }),
    solve: vi.fn<Llm['solve']>(async (r) => {
      log.push('solve');
      return script.solve?.shift() ?? [answerOf.get(r.clue)!];
    }),
  };
  const run = (extra: { maxTries?: number; limit?: number; log?: (line: string) => void } = {}) => refill({ llm, today: TODAY, lists, version: 'test-1', dir, ...extra });
  return { llm, log, run };
}

const reasons = (f: ReturnType<typeof fakes>) => f.llm.propose.mock.calls.at(-1)![0].rejected.map((x) => x.reason);

describe('refill', () => {
  it('fills exactly the missing dailies and the unlimited shortfall, dailies first', async () => {
    seed({ skip: [0, 5], counts: { easy: 39, normal: 40, hard: 38 } });
    const f = fakes();
    const report = await f.run();
    expect(report.created).toEqual([
      `wp-${TODAY}`,
      `wp-${addDays(TODAY, 5)}`,
      'wp-u-easy-40',
      'wp-u-hard-39',
      'wp-u-hard-40',
    ]);
    expect(report.failed).toEqual([]);
    expect(existsSync(join(dir, `${addDays(TODAY, 5)}.json`))).toBe(true);
    expect(existsSync(join(dir, 'unlimited/hard/40.json'))).toBe(true);

    const again = fakes();
    expect(await again.run()).toEqual({ created: [], failed: [], rejections: { propose: 0, gates: 0, review: 0, solve: 0, build: 0 } });
    expect(again.log).toEqual([]);
  });

  it('adds exactly 14 per level two days after the start', async () => {
    seed({ started: addDays(TODAY, -2) });
    const report = await fakes().run();
    for (const level of wordpathV1.LEVELS) {
      expect(report.created.filter((id) => id.startsWith(`wp-u-${level}-`))).toEqual(
        Array.from({ length: 14 }, (_, i) => `wp-u-${level}-${41 + i}`),
      );
    }
    expect(report.created).toHaveLength(42);
  });

  it('passes each slot its level and saves it in meta.level under its folder', async () => {
    seed({ skip: [3], counts: { easy: 39, normal: 39, hard: 39 } });
    const f = fakes();
    await f.run();
    expect(f.llm.propose.mock.calls.map(([r]) => r.level)).toEqual(['normal', 'easy', 'normal', 'hard']);
    const store = loadStore(dir);
    expect(store.dailies.find((p) => p.date === addDays(TODAY, 3))!.meta.level).toBe('normal');
    for (const level of wordpathV1.LEVELS) {
      const saved = JSON.parse(readFileSync(join(dir, `unlimited/${level}/40.json`), 'utf8'));
      expect(saved).toMatchObject({ id: `wp-u-${level}-40`, meta: { level } });
    }
  });

  it('runs the stages in order and stops at the first failure', async () => {
    seed({ skip: [0] });
    const f = fakes({ propose: [{ answer: 'QUART' }] });
    await f.run();
    expect(f.log).toEqual(['propose', 'propose', 'review', 'solve']);
  });

  it('retries a candidate that fails a gate, with its reason in rejected', async () => {
    seed({ skip: [0] });
    const f = fakes({ propose: [{ answer: 'QUART' }] });
    const report = await f.run();
    expect(report.created).toEqual([`wp-${TODAY}`]);
    expect(f.llm.propose.mock.calls[1]![0].rejected).toEqual([{ answer: 'QUART', reason: expect.stringMatching(/answer list/) }]);
    expect(f.llm.review).toHaveBeenCalledTimes(1);
    expect(report.rejections.gates).toBe(1);
  });

  it('normalizes the proposal before the gates and the build', async () => {
    seed({ skip: [0] });
    const f = fakes({ propose: [{ answer: ' cloud ', clue: '  Puzzle clue number 1 ' }] });
    await f.run();
    expect(f.llm.review).toHaveBeenCalledWith({ candidate: { answer: 'CLOUD', clue: 'Puzzle clue number 1' } });
    const daily = loadStore(dir).dailies.find((p) => p.date === TODAY)!;
    expect(wordpathV1.recoverAnswer(daily)).toBe('CLOUD');
    expect(daily.clue).toBe('Puzzle clue number 1');
  });

  it('rejects a review that is inaccurate, offensive, or (at normal) a plain definition', async () => {
    seed({ skip: [0] });
    const f = fakes({ review: [{ accurate: false, reason: 'the fruit is not blue' }, { offensive: true }, { plainDefinition: true }] });
    const report = await f.run();
    expect(report.created).toEqual([`wp-${TODAY}`]);
    expect(reasons(f)).toEqual([
      'clue is inaccurate: the fruit is not blue',
      expect.stringMatching(/offensive/),
      expect.stringMatching(/plain definition/),
    ]);
    expect(report.rejections.review).toBe(3);
    // A review rejection ends the try: solve runs only for the one candidate that passed.
    expect(f.log).toEqual(['propose', 'review', 'propose', 'review', 'propose', 'review', 'propose', 'review', 'solve']);
    expect(f.llm.solve).toHaveBeenCalledTimes(1);
  });

  it('accepts a plain definition at easy only', async () => {
    seed({ counts: { easy: 39, normal: 40, hard: 39 } });
    const f = fakes({ review: Array.from({ length: 3 }, () => ({ plainDefinition: true })) });
    const report = await f.run({ maxTries: 2 });
    expect(report.created).toEqual(['wp-u-easy-40']);
    expect(report.failed).toEqual([{ id: 'wp-u-hard-40', reasons: [expect.stringMatching(/plain definition/), expect.stringMatching(/plain definition/)] }]);
  });

  it('rejects a blind solve whose first guess is not the answer, naming the guess', async () => {
    seed({ skip: [0] });
    const f = fakes({ solve: [['TIGER'], [], ['STORM', 'TIGER']] });
    const report = await f.run();
    expect(report.created).toEqual([`wp-${TODAY}`]);
    expect(reasons(f)).toEqual(['reviewer solved it as TIGER', 'reviewer could not solve it', 'reviewer solved it as STORM']);
    expect(report.rejections.solve).toBe(3);
  });

  it('gives solve only the clue, the length, and the letters', async () => {
    seed({ skip: [0] });
    const f = fakes();
    await f.run();
    const [request] = f.llm.solve.mock.calls[0]!;
    expect(request).toStrictEqual({ clue: 'Puzzle clue number 1', length: 5, letters: 'CDLOU' });
    expect(JSON.stringify(request)).not.toMatch(/CLOUD/i);
  });

  it('never uses an answer twice, across dailies and unlimited', async () => {
    seed({ skip: [0], counts: { easy: 39, normal: 40, hard: 40 } });
    const f = fakes({ propose: [{ answer: 'MANGO' }, { answer: 'CLOUD' }, { answer: 'CLOUD' }] });
    const report = await f.run();
    expect(report.created).toEqual([`wp-${TODAY}`, 'wp-u-easy-40']);
    expect(f.llm.propose.mock.calls[2]![0].avoid).toEqual(expect.arrayContaining(['MANGO', 'CLOUD']));
    expect(reasons(f)).toEqual(['CLOUD already used']);
    const store = loadStore(dir);
    expect(wordpathV1.recoverAnswer(store.unlimited.easy.at(-1)!)).not.toBe('CLOUD');
    expect(usedAnswers(store).size).toBe(3);
  });

  it('reports a slot that fails maxTries times and writes nothing for it', async () => {
    seed({ skip: [0], counts: { easy: 40, normal: 40, hard: 38 } });
    const f = fakes({ propose: Array.from({ length: 4 }, () => ({ answer: 'QUART' })) });
    const report = await f.run({ maxTries: 2 });
    expect(report.created).toEqual([]);
    // A failed unlimited slot ends its level for this run, so numbering never skips.
    expect(report.failed.map((s) => s.id)).toEqual([`wp-${TODAY}`, 'wp-u-hard-39']);
    expect(report.failed[0]!.reasons).toHaveLength(2);
    expect(f.llm.propose).toHaveBeenCalledTimes(4);
    expect(report.rejections.gates).toBe(4);
    expect(existsSync(join(dir, `${TODAY}.json`))).toBe(false);
    expect(existsSync(join(dir, 'unlimited/hard/39.json'))).toBe(false);
  });

  it('stops the whole run on the first rejected key', async () => {
    seed({ skip: [0, 1], counts: { easy: 39, normal: 39, hard: 39 } });
    const f = fakes();
    f.llm.propose.mockRejectedValueOnce(new LlmAuthError('Gemini rejected the API key: HTTP 401'));
    const report = await f.run();
    expect(report).toMatchObject({ created: [], failed: [], aborted: 'Gemini rejected the API key: HTTP 401' });
    expect(f.llm.propose).toHaveBeenCalledTimes(1);
    expect(f.log).toEqual([]);
    expect(loadStore(dir).dailies).toHaveLength(28);
  });

  it('stops at the daily quota after saving what it made, calling nothing more', async () => {
    seed({ skip: [0, 1], counts: { easy: 39, normal: 39, hard: 39 } });
    const f = fakes();
    const first = f.llm.propose.getMockImplementation()!;
    f.llm.propose.mockImplementationOnce(first).mockRejectedValueOnce(new LlmQuotaError('OpenRouter free daily limit reached'));
    const report = await f.run();
    expect(report).toMatchObject({ created: [`wp-${TODAY}`], failed: [], aborted: expect.stringMatching(/daily limit/) });
    expect(f.llm.propose).toHaveBeenCalledTimes(2);
    expect(loadStore(dir).dailies).toHaveLength(29);
  });

  it('stops after --limit new puzzles are saved, dailies first, failed slots not counted', async () => {
    seed({ skip: [0, 1, 2], counts: { easy: 39, normal: 39, hard: 39 } });
    const f = fakes({ propose: Array.from({ length: 2 }, () => ({ answer: 'QUART' })) });
    const report = await f.run({ maxTries: 2, limit: 2 });
    expect(report.failed.map((s) => s.id)).toEqual([`wp-${TODAY}`]);
    expect(report.created).toEqual([`wp-${addDays(TODAY, 1)}`, `wp-${addDays(TODAY, 2)}`]);
    expect(f.llm.propose).toHaveBeenCalledTimes(4);
    expect(loadStore(dir).unlimited.easy).toHaveLength(39);
  });

  it('caps dailies too: --limit 1 with several missing dailies fills only the first', async () => {
    seed({ skip: [0, 1, 2] });
    const f = fakes();
    const report = await f.run({ limit: 1 });
    expect(report.created).toEqual([`wp-${TODAY}`]);
    expect(f.llm.propose).toHaveBeenCalledTimes(1);
  });

  it('logs one progress line per try, with stage seconds and the outcome', async () => {
    seed({ skip: [0] });
    const f = fakes({ review: [{ accurate: false, reason: 'the fruit is not blue' }] });
    const lines: string[] = [];
    await f.run({ log: (l) => lines.push(l) });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(new RegExp(`^wp-${TODAY} try 1: propose \\d+\\.\\ds → review \\d+\\.\\ds → rejected at review: clue is inaccurate: the fruit is not blue$`));
    expect(lines[1]).toMatch(new RegExp(`^wp-${TODAY} try 2: propose \\d+\\.\\ds → review \\d+\\.\\ds → solve \\d+\\.\\ds → build \\d+\\.\\ds → saved$`));
  });

  it('logs a gate rejection without timing the stages it never reached', async () => {
    seed({ skip: [0] });
    const lines: string[] = [];
    await fakes({ propose: [{ answer: 'QUART' }] }).run({ log: (l) => lines.push(l) });
    expect(lines[0]).toMatch(new RegExp(`^wp-${TODAY} try 1: propose \\d+\\.\\ds → rejected at gates: `));
    expect(lines[0]).not.toMatch(/review/);
  });

  it('logs a line when the run aborts', async () => {
    seed({ skip: [0] });
    const f = fakes();
    f.llm.propose.mockRejectedValueOnce(new LlmQuotaError('OpenRouter free daily limit reached'));
    const lines: string[] = [];
    await f.run({ log: (l) => lines.push(l) });
    expect(lines).toEqual([expect.stringMatching(/^wp-.* try 1: propose \d+\.\ds → aborted: OpenRouter free daily limit reached$/)]);
  });

  it('records a thrown model error as a failed try', async () => {
    seed({ skip: [0] });
    const f = fakes();
    f.llm.review.mockRejectedValueOnce(new Error('reply is not the expected JSON'));
    const report = await f.run();
    expect(report.created).toEqual([`wp-${TODAY}`]);
    expect(reasons(f)).toEqual(['reply is not the expected JSON']);
    expect(report.rejections.review).toBe(1);
  });
});
