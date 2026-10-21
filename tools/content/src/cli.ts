import { parseArgs } from 'node:util';
import { wordpathV1 } from '@ttg/engine';
import { UNLIMITED_INITIAL } from '@ttg/generator/config';
import { loadLists, loadStore } from '@ttg/generator/io';
import type { Llm } from './llm';
import { chooseProvider } from './provider';
import { addDays, refill } from './refill';

const MUST_HAVE_DAYS = 7;

let limit: number | undefined;
let level: wordpathV1.Level | undefined;
try {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { limit: { type: 'string' }, level: { type: 'string' } } });
  if (positionals.join(' ') !== 'refill' || (values.limit !== undefined && !/^[1-9]\d*$/.test(values.limit))) throw new Error();
  if (values.level !== undefined && !(wordpathV1.LEVELS as readonly string[]).includes(values.level)) throw new Error();
  limit = values.limit === undefined ? undefined : Number(values.limit);
  level = values.level as wordpathV1.Level | undefined;
} catch {
  console.error('usage: pnpm content refill [--level easy|normal|hard] [--limit N]   (level: only that Unlimited level, no dailies; N: stop after N new puzzles, for a trial run)');
  process.exit(1);
}
let provider: ReturnType<typeof chooseProvider>;
let llm: Llm;
try {
  provider = chooseProvider(process.env);
  llm = provider.create();
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
// Names and model IDs only: never a key or a request header.
console.log(`provider ${provider.name}: proposer ${provider.proposer}, reviewer ${provider.reviewer}`);

const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const { lists, version } = loadLists();
const report = await refill({ llm, today, lists, version, limit, level, log: console.log });

for (const id of report.created) console.log(`created ${id}`);
for (const { id, reasons } of report.failed) console.log(`failed ${id}\n  ${reasons.join('\n  ')}`);
console.log(`rejections: ${Object.entries(report.rejections).map(([stage, n]) => `${stage} ${n}`).join(', ')}`);
if (llm.spent) {
  const usd = (n: number) => `$${n.toFixed(4)}`;
  const total = Object.values(llm.spent).reduce((a, b) => a + b, 0);
  console.log(`cost: ${Object.entries(llm.spent).map(([stage, n]) => `${stage} ${usd(n)}`).join(', ')}, total ${usd(total)}`);
}
if (report.aborted) {
  console.error(`stopped: ${report.aborted}; ${report.created.length} puzzles saved this run`);
  process.exit(1);
}

const store = loadStore();
const dates = new Set(store.dailies.map((p) => p.date));
const missing = Array.from({ length: MUST_HAVE_DAYS }, (_, i) => addDays(today, i)).filter((d) => !dates.has(d));
const short = wordpathV1.LEVELS.filter((l) => store.unlimited[l].length < UNLIMITED_INITIAL);
if (missing.length > 0) console.error(`missing dailies: ${missing.join(', ')}`);
if (short.length > 0) console.error(`fewer than ${UNLIMITED_INITIAL} unlimited puzzles: ${short.join(', ')}`);
if (missing.length > 0 || short.length > 0) {
  if (limit) console.error(`this is expected after --limit ${limit}; run without --limit to fill the rest`);
  if (level) console.error(`this is expected after --level ${level}; run without --level to fill the rest`);
  // A level-only run is fine unless a slot failed; the other checks are not its job.
  process.exit(level && report.failed.length === 0 ? 0 : 1);
}
