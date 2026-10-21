import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wordpathV1 } from '@ttg/engine';

type Level = wordpathV1.Level;
type PuzzleBody = wordpathV1.PuzzleBody;

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const PUBLIC_DIR = join(ROOT, 'data/public/wordpath');
export const WORDLIST_DIR = join(ROOT, 'content/wordlists');

const words = (file: string) =>
  new Set(readFileSync(join(WORDLIST_DIR, file), 'utf8').split('\n').map((w) => w.trim()).filter(Boolean));

export function loadLists(): { lists: wordpathV1.WordLists; version: string } {
  return {
    lists: { answers: words('answers.txt'), blocking: words('blocking.txt') },
    version: readFileSync(join(WORDLIST_DIR, 'VERSION'), 'utf8').trim(),
  };
}

export interface Store {
  dailies: PuzzleBody[];
  unlimited: Record<Level, PuzzleBody[]>;
  started: string | null;
  /** Each loaded puzzle's path relative to the store dir, e.g. `unlimited/hard/3.json`. */
  paths: Map<PuzzleBody, string>;
  /** `count` from index.json; null when there is no index file. */
  indexCount: Record<Level, number> | null;
}

const DAILY_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;
const byNumber = (a: string, b: string) => parseInt(a, 10) - parseInt(b, 10);

function readPuzzle(path: string): PuzzleBody {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: ${(e as Error).message}`);
  }
  const parsed = wordpathV1.parsePuzzle(data);
  if (!parsed) throw new Error(`${path}: does not parse as a Word Path puzzle`);
  return parsed.puzzle;
}

const jsonFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []);

function readIndex(dir: string): { started: string; count: Record<Level, number> } | null {
  const path = join(dir, 'unlimited/index.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
}

export function loadStore(dir = PUBLIC_DIR): Store {
  const paths = new Map<PuzzleBody, string>();
  const read = (rel: string) => {
    const p = readPuzzle(join(dir, rel));
    paths.set(p, rel);
    return p;
  };
  const dailies = jsonFiles(dir)
    .filter((f) => DAILY_FILE.test(f))
    .sort()
    .map(read);
  const unlimited = Object.fromEntries(
    wordpathV1.LEVELS.map((level) => [
      level,
      jsonFiles(join(dir, 'unlimited', level))
        .sort(byNumber)
        .map((f) => read(`unlimited/${level}/${f}`)),
    ]),
  ) as Record<Level, PuzzleBody[]>;
  const index = readIndex(dir);
  return { dailies, unlimited, started: index?.started ?? null, paths, indexCount: index?.count ?? null };
}

/** Pretty JSON, created exclusively: an existing file is an error, never overwritten. */
function createJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
}

export function saveDaily(p: PuzzleBody, dir = PUBLIC_DIR): void {
  createJson(join(dir, `${p.date}.json`), p);
}

const numberOf = (id: string) => Number(/-(\d+)$/.exec(id)?.[1]);

/** The lowest number no puzzle in the level holds, so a deleted file's slot is refilled before the pool grows. */
export function nextUnlimitedId(store: Store, level: Level): string {
  const taken = new Set(store.unlimited[level].map((p) => numberOf(p.id)));
  let n = 1;
  while (taken.has(n)) n++;
  return `wp-u-${level}-${n}`;
}

/** Writes the file numbered by the puzzle's id (`wp-u-<level>-<n>` is `<n>.json`), then rewrites index.json (`started` is set once). */
export function saveUnlimited(p: PuzzleBody, today: string, dir = PUBLIC_DIR): void {
  const { level } = p.meta;
  const n = numberOf(p.id);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${p.id}: not an unlimited id`);
  createJson(join(dir, 'unlimited', level, `${n}.json`), p);
  const count = Object.fromEntries(
    wordpathV1.LEVELS.map((l) => [l, jsonFiles(join(dir, 'unlimited', l)).length]),
  );
  const started = readIndex(dir)?.started ?? today;
  writeFileSync(join(dir, 'unlimited/index.json'), JSON.stringify({ count, started }, null, 2) + '\n');
}

/** Uppercase answers of every puzzle in the store; a puzzle whose answer cannot be recovered throws. */
export function usedAnswers(store: Store): Set<string> {
  const used = new Set<string>();
  for (const p of [...store.dailies, ...Object.values(store.unlimited).flat()]) {
    const answer = wordpathV1.recoverAnswer(p);
    if (!answer) throw new Error(`${p.id}: answer cannot be recovered`);
    used.add(answer.toUpperCase());
  }
  return used;
}
