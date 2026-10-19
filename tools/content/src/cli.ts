import { wordpathV1 } from '@ttg/engine';
import { UNLIMITED_INITIAL } from '@ttg/generator/config';
import { loadLists, loadStore } from '@ttg/generator/io';
import { chooseProvider } from './provider';
import { addDays, refill } from './refill';
import { fetchSourceText } from './source';

const MUST_HAVE_DAYS = 7;

if (process.argv[2] !== 'refill') {
  console.error('usage: pnpm content refill');
  process.exit(1);
}
let provider: ReturnType<typeof chooseProvider>;
try {
  provider = chooseProvider(process.env);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
// Names and model IDs only: never a key or a request header.
console.log(`provider ${provider.name}: proposer ${provider.proposer}, reviewer ${provider.reviewer}`);

const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
const { lists, version } = loadLists();
const report = await refill({ llm: provider.create(), today, lists, version, fetchSource: fetchSourceText });

for (const id of report.created) console.log(`created ${id}`);
for (const { id, reasons } of report.failed) console.log(`failed ${id}\n  ${reasons.join('\n  ')}`);
console.log(`rejections: ${Object.entries(report.rejections).map(([stage, n]) => `${stage} ${n}`).join(', ')}`);
if (report.aborted) {
  console.error(`stopped: ${report.aborted}`);
  process.exit(1);
}

const store = loadStore();
const dates = new Set(store.dailies.map((p) => p.date));
const missing = Array.from({ length: MUST_HAVE_DAYS }, (_, i) => addDays(today, i)).filter((d) => !dates.has(d));
const short = wordpathV1.LEVELS.filter((l) => store.unlimited[l].length < UNLIMITED_INITIAL);
if (missing.length > 0) console.error(`missing dailies: ${missing.join(', ')}`);
if (short.length > 0) console.error(`fewer than ${UNLIMITED_INITIAL} unlimited puzzles: ${short.join(', ')}`);
if (missing.length > 0 || short.length > 0) process.exit(1);
