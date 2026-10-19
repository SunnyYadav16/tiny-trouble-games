import { wordpathV1 } from '@ttg/engine';
import { buildPuzzle } from '@ttg/generator/build';
import { AHEAD_DAYS, unlimitedTarget } from '@ttg/generator/config';
import { candidateProblems, type Candidate } from '@ttg/generator/gates';
import { loadStore, nextUnlimitedId, saveDaily, saveUnlimited, usedAnswers } from '@ttg/generator/io';
import { LlmAuthError, type Llm } from './llm';
import type { fetchSourceText } from './source';
import { topicFor } from './topics';

type Level = wordpathV1.Level;

export type Stage = 'propose' | 'gates' | 'source' | 'review' | 'solve' | 'build';

export interface RefillReport {
  created: string[];
  failed: { id: string; reasons: string[] }[];
  /** Failed tries per stage, to show what the run cost and where it was strict. */
  rejections: Record<Stage, number>;
  /** Set when a model rejected the API key: the run stopped there. */
  aborted?: string;
}

export interface RefillOptions {
  llm: Llm;
  /** YYYY-MM-DD */
  today: string;
  lists: wordpathV1.WordLists;
  version: string;
  fetchSource: typeof fetchSourceText;
  dir?: string;
  maxTries?: number;
  /** Stop once this many new puzzles are saved in this run (a cheap trial). */
  limit?: number;
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
  const report: RefillReport = { created: [], failed: [], rejections: { propose: 0, gates: 0, source: 0, review: 0, solve: 0, build: 0 } };
  const fill = async (slot: Slot, save: (p: wordpathV1.PuzzleBody) => void): Promise<boolean> => {
    const result = await fillSlot(slot, used, opts, report);
    if (!result) return false;
    save(result.puzzle);
    used.add(result.answer);
    report.created.push(slot.id);
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
    // A refused key (or no credits) fails every later call too, so the run stops instead of burning maxTries per slot.
    if (!(e instanceof LlmAuthError)) throw e;
    report.aborted = e.message;
  }
  return report;
}

/** Google Search grounding cites through redirect links; meta.clueSource must name the page itself. */
const SEARCH_REDIRECT = /vertexaisearch\.cloud\.google\.com|grounding-api-redirect/i;

const normalize = (c: Candidate): Candidate => ({
  answer: c.answer.trim().toUpperCase(),
  clue: c.clue.trim(),
  clueSource: c.clueSource.trim(),
});

async function fillSlot(
  slot: Slot,
  used: ReadonlySet<string>,
  { llm, lists, version, fetchSource, maxTries = 6 }: RefillOptions,
  report: RefillReport,
): Promise<{ puzzle: wordpathV1.PuzzleBody; answer: string } | null> {
  const rejected: { answer: string; reason: string }[] = [];
  const reasons: string[] = [];
  for (let i = 0; i < maxTries; i++) {
    let stage: Stage = 'propose';
    let c: Candidate | undefined;
    try {
      c = normalize(await llm.propose({ topic: topicFor(slot.id), level: slot.level, avoid: [...used], rejected: [...rejected] }));

      stage = 'gates';
      const problems = candidateProblems(c, { lists, used });
      if (problems.length > 0) throw new Error(problems.join('; '));

      stage = 'source';
      if (SEARCH_REDIRECT.test(c.clueSource)) throw new Error("source is a search redirect link, not the page itself; give the page's direct URL");
      const text = await fetchSource(c.clueSource);
      if (text === null) throw new Error(`source could not be fetched: ${c.clueSource}`);
      if (!text.toUpperCase().includes(c.answer)) throw new Error(`source does not contain ${c.answer}`);

      stage = 'review';
      const review = await llm.review({ candidate: c, sourceText: text });
      const issues: string[] = [];
      if (!review.supported) issues.push('clue not supported by the source');
      if (review.offensive) issues.push('offensive');
      if (review.plainDefinition && slot.level !== 'easy') issues.push('clue is a plain definition');
      if (issues.length > 0) throw new Error(`${issues.join(', ')}: ${review.reason}`);

      stage = 'solve';
      const letters = [...new Set(c.answer)].sort().join('');
      const [guess] = await llm.solve({ clue: c.clue, length: c.answer.length, letters });
      if (guess !== c.answer) throw new Error(guess ? `reviewer solved it as ${guess}` : 'reviewer could not solve it');

      stage = 'build';
      // The engine's seed key: the date for a daily, the id for unlimited.
      const puzzle = buildPuzzle(c, { lists, version, id: slot.id, seedKey: slot.date ?? slot.id, level: slot.level, date: slot.date });
      return { puzzle, answer: c.answer };
    } catch (e) {
      if (e instanceof LlmAuthError) throw e;
      const reason = (e as Error).message;
      report.rejections[stage]++;
      reasons.push(c ? `${stage} (${c.answer}): ${reason}` : `${stage}: ${reason}`);
      if (c) rejected.push({ answer: c.answer, reason });
    }
  }
  report.failed.push({ id: slot.id, reasons });
  return null;
}
