import { wordpathV1 } from '@ttg/engine';
import type { Candidate } from './gates';

export interface BuildContext {
  lists: wordpathV1.WordLists;
  version: string;
  id: string;
  seedKey: string;
  level: wordpathV1.Level;
  date?: string;
}

/** Builds all six sizes and verifies them; throws one error listing every problem. Callers run `candidateProblems` first. */
export function buildPuzzle(c: Candidate, ctx: BuildContext): wordpathV1.PuzzleBody {
  const p = wordpathV1.makePuzzle({
    id: ctx.id,
    seedKey: ctx.seedKey,
    date: ctx.date,
    level: ctx.level,
    answer: c.answer,
    clue: c.clue,
    clueSource: c.clueSource,
    blocked: wordpathV1.blockedWords(c.answer, ctx.lists.blocking),
    wordListVersion: ctx.version,
  });
  const problems = wordpathV1.verify(p, ctx.lists);
  if (problems.length > 0) throw new Error(`${ctx.id} failed verification:\n${problems.join('\n')}`);
  return p;
}
