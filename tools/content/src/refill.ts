import { wordpathV1 } from '@ttg/engine';
import { buildPuzzle } from '@ttg/generator/build';
import { AHEAD_DAYS, unlimitedTarget } from '@ttg/generator/config';
import { candidateProblems, type Candidate } from '@ttg/generator/gates';
import { loadStore, nextUnlimitedId, saveDaily, saveUnlimited, usedAnswers } from '@ttg/generator/io';
import { LlmAuthError, type Llm } from './llm';
import { topicFor } from './topics';

type Level = wordpathV1.Level;

export type Stage = 'propose' | 'gates' | 'review' | 'solve' | 'build';

export interface RefillReport {
  created: string[];
  failed: { id: string; reasons: string[] }[];
  /** Failed tries per stage, to show what the run cost and where it was strict. */
  rejections: Record<Stage, number>;
  /** Set when the provider refused the API key or its daily quota ran out: the run stopped there. */
  aborted?: string;
}

export interface RefillOptions {
  llm: Llm;
  /** YYYY-MM-DD */
  today: string;
  lists: wordpathV1.WordLists;
  version: string;
  dir?: string;
  maxTries?: number;
  /** Stop once this many new puzzles are saved in this run (a cheap trial). */
  limit?: number;
  /** Called once per try as it finishes, with the seconds each stage took. */
  log?: (line: string) => void;
}

interface Slot {
  id: string;
  level: Level;
  date?: string;
}

const DAY_MS = 86_400_000;
export const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);

/**
 * Fills missing dailies (today onward, earliest first, always normal), then each
 * level's unlimited shortfall. A slot is saved only after every stage passes;
 * existing files are never touched.
 */
export async function refill(opts: RefillOptions): Promise<RefillReport> {
  const { today, dir } = opts;
  const store = loadStore(dir);
  const used = usedAnswers(store);
  const report: RefillReport = { created: [], failed: [], rejections: { propose: 0, gates: 0, review: 0, solve: 0, build: 0 } };
  const fill = async (slot: Slot, save: (p: wordpathV1.PuzzleBody) => void): Promise<boolean> => {
    const result = await fillSlot(slot, used, opts, report);
    if (!result) return false;
    save(result.puzzle);
    used.add(result.answer);
    report.created.push(slot.id);
    result.logSaved();
    return true;
  };
  const capped = () => report.created.length >= (opts.limit ?? Infinity);

  try {
    const dates = new Set(store.dailies.map((p) => p.date));
    for (let i = 0; i < AHEAD_DAYS && !capped(); i++) {
      const date = addDays(today, i);
      if (!dates.has(date)) await fill({ id: `wp-${date}`, level: 'normal', date }, (p) => saveDaily(p, dir));
    }

    const target = unlimitedTarget(store.started ?? today, today);
    for (const level of wordpathV1.LEVELS) {
      while (!capped() && store.unlimited[level].length < target) {
        const id = nextUnlimitedId(store, level);
        const saved = await fill({ id, level }, (p) => {
          saveUnlimited(p, today, dir);
          store.unlimited[level].push(p);
        });
        // Files are numbered in order, so a failed slot ends this level for the run.
        if (!saved) break;
      }
    }
  } catch (e) {
    // A refused key, no credits, or a used-up daily quota fails every later call too, so the run stops instead of burning maxTries per slot.
    if (!(e instanceof LlmAuthError)) throw e;
    report.aborted = e.message;
  }
  return report;
}

const normalize = (c: Candidate): Candidate => ({
  answer: c.answer.trim().toUpperCase(),
  clue: c.clue.trim(),
});

async function fillSlot(
  slot: Slot,
  used: ReadonlySet<string>,
  { llm, lists, version, maxTries = 6, log }: RefillOptions,
  report: RefillReport,
): Promise<{ puzzle: wordpathV1.PuzzleBody; answer: string; logSaved: () => void } | null> {
  const rejected: { answer: string; reason: string }[] = [];
  const reasons: string[] = [];
  for (let i = 0; i < maxTries; i++) {
    let stage: Stage = 'propose';
    let c: Candidate | undefined;
    let built: { puzzle: wordpathV1.PuzzleBody; answer: string } | undefined;
    // Wall-clock seconds per finished stage, for the progress line.
    const timings: string[] = [];
    let t = performance.now();
    const lap = () => {
      timings.push(`${stage} ${((performance.now() - t) / 1000).toFixed(1)}s`);
      t = performance.now();
    };
    const progress = (outcome: string) => log?.(`${slot.id} try ${i + 1}: ${[...timings, outcome].join(' → ')}`);
    try {
      c = normalize(await llm.propose({ topic: topicFor(slot.id), level: slot.level, avoid: [...used], rejected: [...rejected] }));

      lap();
      stage = 'gates';
      const problems = candidateProblems(c, { lists, used });
      if (problems.length > 0) throw new Error(problems.join('; '));

      stage = 'review';
      const review = await llm.review({ candidate: c });
      const issues: string[] = [];
      if (!review.accurate) issues.push('clue is inaccurate');
      if (review.offensive) issues.push('offensive');
      if (review.plainDefinition && slot.level !== 'easy') issues.push('clue is a plain definition');
      if (issues.length > 0) throw new Error(`${issues.join(', ')}: ${review.reason}`);

      lap();
      stage = 'solve';
      const letters = [...new Set(c.answer)].sort().join('');
      const [guess] = await llm.solve({ clue: c.clue, length: c.answer.length, letters });
      if (guess !== c.answer) throw new Error(guess ? `reviewer solved it as ${guess}` : 'reviewer could not solve it');

      lap();
      stage = 'build';
      // The engine's seed key: the date for a daily, the id for unlimited.
      const puzzle = buildPuzzle(c, { lists, version, id: slot.id, seedKey: slot.date ?? slot.id, level: slot.level, date: slot.date });
      lap();
      built = { puzzle, answer: c.answer };
    } catch (e) {
      const reason = (e as Error).message;
      if (stage !== 'gates') lap(); // gates is synchronous and not timed
      if (e instanceof LlmAuthError) {
        progress(`aborted: ${reason}`);
        throw e;
      }
      progress(`rejected at ${stage}: ${reason}`);
      report.rejections[stage]++;
      reasons.push(c ? `${stage} (${c.answer}): ${reason}` : `${stage}: ${reason}`);
      if (c) rejected.push({ answer: c.answer, reason });
    }
    // Outside the try, and logged by the caller after the save: a throwing logger must not turn a built puzzle into a rejection or lose it.
    if (built) return { ...built, logSaved: () => progress('saved') };
  }
  report.failed.push({ id: slot.id, reasons });
  return null;
}
