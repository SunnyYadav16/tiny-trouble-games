export interface WordLists {
  answers: ReadonlySet<string>;
  blocking: ReadonlySet<string>;
}

export function reverse(s: string): string {
  return [...s].reverse().join('');
}

/** Every reason `answer` (uppercase) cannot be a puzzle answer. Empty means eligible. */
export function checkAnswer(answer: string, lists: WordLists): string[] {
  const problems: string[] = [];
  const reversed = reverse(answer);
  if (!/^[A-Z]{5,7}$/.test(answer)) problems.push('must be 5-7 letters, A-Z only');
  if (new Set(answer).size < 4) problems.push('needs at least 4 distinct letters');
  if (answer === reversed) problems.push('is a palindrome');
  if (!lists.answers.has(answer)) problems.push('is not in the answer list');
  if (lists.blocking.has(reversed)) problems.push(`reverse ${reversed} is a word`);
  return problems;
}

/**
 * Words that must have no route on the grid: same length as `answer`, spelled
 * only with its letters, and not the answer itself.
 */
export function blockedWords(answer: string, blocking: Iterable<string>): string[] {
  const letters = new Set(answer);
  const blocked = new Set<string>();
  for (const word of blocking) {
    if (word !== answer && word.length === answer.length && [...word].every((c) => letters.has(c))) {
      blocked.add(word);
    }
  }
  return [...blocked].sort();
}
