import { wordpathV1 } from '@ttg/engine';

export interface Candidate {
  answer: string;
  clue: string;
}

/** One-line rejection reasons, fed back to the proposer. Empty means the candidate passes. */
export function candidateProblems(c: Candidate, ctx: { lists: wordpathV1.WordLists; used: ReadonlySet<string> }): string[] {
  const answer = c.answer.toUpperCase();
  const clue = c.clue.trim();
  const problems = wordpathV1.checkAnswer(answer, ctx.lists);
  if (ctx.used.has(answer)) problems.push(`${answer} already used`);
  if (clue === '') problems.push('clue is empty');
  else if (clue.toLowerCase().includes(answer.slice(0, 5).toLowerCase())) problems.push('clue contains the answer');
  return problems;
}
