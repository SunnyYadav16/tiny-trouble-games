import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { wordpathV1 } from '@ttg/engine';
import { AHEAD_DAYS, UNLIMITED_INITIAL } from './config';
import { loadLists, loadStore, WORDLIST_DIR, type Store } from './io';

/** One line per problem in the whole store; an empty array means it is healthy. */
export function storeProblems(store: Store, lists: wordpathV1.WordLists, version: string, today: string): string[] {
  const problems: string[] = [];
  const pathOf = (p: wordpathV1.PuzzleBody) => store.paths.get(p) ?? p.id;
  const all = [...store.dailies, ...wordpathV1.LEVELS.flatMap((l) => store.unlimited[l])];
  for (const p of all) {
    problems.push(...wordpathV1.verify(p, lists));
    if (p.meta.wordListVersion !== version) problems.push(`${p.id}: regenerate: word list changed`);
  }

  for (const p of store.dailies) {
    const path = pathOf(p);
    if (path !== `${p.date}.json`) problems.push(`${path}: date is ${p.date}`);
    if (p.id !== `wp-${p.date}`) problems.push(`${path}: id is ${p.id}, expected wp-${p.date}`);
    if (p.meta.level !== 'normal') problems.push(`${path}: daily is ${p.meta.level}, must be normal`);
  }

  for (const level of wordpathV1.LEVELS) {
    const puzzles = store.unlimited[level];
    puzzles.forEach((p, i) => {
      const path = pathOf(p);
      const n = i + 1;
      if (path !== `unlimited/${level}/${n}.json`) problems.push(`${path}: expected unlimited/${level}/${n}.json`);
      if (p.id !== `wp-u-${level}-${n}`) problems.push(`${path}: id is ${p.id}, expected wp-u-${level}-${n}`);
      if (p.meta.level !== level) problems.push(`${path}: meta.level is ${p.meta.level}, folder is ${level}`);
    });
    const indexed = store.indexCount?.[level];
    if (indexed !== puzzles.length) problems.push(`index.json: count.${level} is ${indexed ?? 'missing'}, files ${puzzles.length}`);
    if (puzzles.length < UNLIMITED_INITIAL) problems.push(`${level}: ${puzzles.length} unlimited puzzles, need ${UNLIMITED_INITIAL}`);
  }

  const owner = new Map<string, string>();
  for (const p of all) {
    const answer = wordpathV1.recoverAnswer(p)?.toUpperCase(); // verify already reports an unrecoverable answer
    if (!answer) continue;
    const first = owner.get(answer);
    if (first) problems.push(`answer ${answer} used by ${first} and ${p.id}`);
    else owner.set(answer, p.id);
  }

  const ahead = store.dailies.filter((p) => (p.date ?? '') >= today).length;
  if (ahead < AHEAD_DAYS) problems.push(`only ${ahead} dailies from ${today}, need ${AHEAD_DAYS}`);
  return problems;
}

/** Recomputes each list file's SHA-256 and compares it with the README's `- <file>: sha256 <hex>` line. */
export function listHashProblems(dir = WORDLIST_DIR): string[] {
  const readme = readFileSync(join(dir, 'README.md'), 'utf8');
  return ['answers.txt', 'blocking.txt'].flatMap((file) => {
    const expected = readme.match(new RegExp(`^- ${file.replace('.', '\\.')}: sha256 ([0-9a-f]{64})$`, 'm'))?.[1];
    if (!expected) return [`README.md: no sha256 line for ${file}`];
    const actual = createHash('sha256').update(readFileSync(join(dir, file))).digest('hex');
    return actual === expected ? [] : [`${file}: sha256 is ${actual}, README says ${expected}`];
  });
}

function main(): void {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in the local zone
  let problems: string[];
  try {
    const { lists, version } = loadLists();
    problems = [...listHashProblems(), ...storeProblems(loadStore(), lists, version, today)];
  } catch (e) {
    problems = [(e as Error).message];
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    console.error(`${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log('verify: OK');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
