import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseWordList } from './parse';

/** SCOWL size levels (tuned by the generator benchmark). Answers: common words. Blocking: a broad dictionary. */
const ANSWER_MAX_LEVEL = 40;
const BLOCK_MAX_LEVEL = 95;
/** SCOWL taboo lists (all levels). Their words are never eligible as answers but stay in the blocking list. */
const SCOWL_TABOO = ['offensive.1', 'offensive.2', 'profane.1', 'profane.3'].map((f) => `scowl-2020.12.07/misc/${f}`);
const MIN_LEN = 5;
const MAX_LEN = 7;

const SOURCES = {
  enable: {
    file: 'enable1.txt',
    url: 'https://raw.githubusercontent.com/dolph/dictionary/694bf9529e986f9175dcbf5fe5875d111941b708/enable1.txt',
    sha256: '3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89',
  },
  scowl: {
    file: 'scowl-2020.12.07.tar.gz',
    url: 'https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz',
    sha256: '5587667caa20c4891390c2d42dbb4d5c4c3f41bee77af1457ece3ba23fb859cc',
  },
};
/** SCOWL size levels present in the release; each file holds only the words first appearing at that level. */
const SCOWL_LEVELS = [10, 20, 35, 40, 50, 55, 60, 70, 80, 95];
/** Ordinary words only: no abbreviations, contractions, proper names, or "upper" lists. */
const SCOWL_CATEGORIES = ['english-words', 'american-words'];

const root = resolve(import.meta.dirname, '../../..');
const cacheDir = join(root, 'node_modules/.cache/ttg-wordlists');
const outDir = join(root, 'content/wordlists');
const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

async function fetchSource({ file, url, sha256: expected }: { file: string; url: string; sha256: string }) {
  const path = join(cacheDir, file);
  mkdirSync(cacheDir, { recursive: true });
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  const actual = sha256(readFileSync(path));
  if (actual !== expected) {
    throw new Error(`${file}: sha256 ${actual} does not match pinned ${expected}; delete ${path} to re-download`);
  }
  return path;
}

const tarText = (tarball: string, members: string[]) =>
  execFileSync('tar', ['-xzOf', tarball, ...members], { encoding: 'latin1', maxBuffer: 1 << 28 });

/** SCOWL words from all pinned categories at size levels <= maxLevel. Files are Latin-1: accents are kept and then dropped by the parser. */
function scowlWords(tarball: string, maxLevel: number) {
  const members = SCOWL_CATEGORIES.flatMap((category) =>
    SCOWL_LEVELS.filter((level) => level <= maxLevel).map((level) => `scowl-2020.12.07/final/${category}.${level}`),
  );
  return parseWordList(tarText(tarball, members));
}

const inLengthRange = (word: string) => word.length >= MIN_LEN && word.length <= MAX_LEN;

const enable = readFileSync(await fetchSource(SOURCES.enable), 'utf8');
const scowl = await fetchSource(SOURCES.scowl);
const excluded = new Set([
  // The taboo lists are mixed case; lowercase first or the parser would drop capitalized entries.
  ...parseWordList(tarText(scowl, SCOWL_TABOO).toLowerCase()),
  ...parseWordList(readFileSync(join(outDir, 'exclude-answers.txt'), 'utf8').toLowerCase()),
]);
const candidates = scowlWords(scowl, ANSWER_MAX_LEVEL).filter(inLengthRange);
const answers = candidates.filter((word) => !excluded.has(word));
console.log(`removed ${candidates.length - answers.length} offensive words from answers`);
const blocking = [...new Set([...parseWordList(enable), ...scowlWords(scowl, BLOCK_MAX_LEVEL)])]
  .filter(inLengthRange)
  .sort();

const missing = ['AMONG', 'MANGA', 'MANNA', 'GAMMA', 'MAMMA'].filter((word) => !blocking.includes(word));
if (missing.length > 0) throw new Error(`blocking list is missing ${missing.join(' ')}`);

const readmePath = join(outDir, 'README.md');
let readme = readFileSync(readmePath, 'utf8');
for (const [name, words] of [['answers.txt', answers], ['blocking.txt', blocking]] as const) {
  const text = words.join('\n') + '\n';
  writeFileSync(join(outDir, name), text);
  console.log(`${name}: ${words.length} words`);
  const line = new RegExp(`^- ${name.replace('.', '\\.')}: sha256 [0-9a-f]{64}$`, 'm');
  if (!line.test(readme)) throw new Error(`README.md has no hash line for ${name}`);
  readme = readme.replace(line, `- ${name}: sha256 ${sha256(text)}`);
}
writeFileSync(readmePath, readme);
