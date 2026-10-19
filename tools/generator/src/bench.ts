import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { rngFrom, shuffle, wordpathV1 } from '@ttg/engine';
import { loadLists } from './io';

const { LEVELS, SIZES } = wordpathV1;
const OUT = join(fileURLToPath(new URL('../../..', import.meta.url)), 'docs/benchmarks/wordpath-v1.md');
const MAX_ATTEMPTS = 1000; // generate's default; named here so the report header states it

interface Call {
  answer: string;
  size: number;
  level: wordpathV1.Level;
  ms: number;
  attempts: number; // 0 when the call failed
  blocked: number;
  error?: string;
}

const pct = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
const table = (head: string[], rows: (string | number)[][]) =>
  [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');

function run(count: number): { calls: Call[]; version: string; totalMs: number } {
  const { lists, version } = loadLists();
  const answers = shuffle(rngFrom('bench-gen-1'), [...lists.answers])
    .filter((a) => wordpathV1.checkAnswer(a, lists).length === 0)
    .slice(0, count);
  const calls: Call[] = [];
  const t0 = performance.now();
  answers.forEach((answer, i) => {
    const blocked = wordpathV1.blockedWords(answer, lists.blocking);
    for (const level of LEVELS) {
      for (const size of SIZES) {
        const seed = wordpathV1.seedFor(`bench-${answer}-${level}`, size);
        const start = performance.now();
        try {
          const { attempts } = wordpathV1.generate({ answer, size, level, blocked, seed });
          calls.push({ answer, size, level, ms: performance.now() - start, attempts, blocked: blocked.length });
        } catch (e) {
          if (!(e instanceof wordpathV1.GenerateError)) throw e;
          calls.push({ answer, size, level, ms: performance.now() - start, attempts: 0, blocked: blocked.length, error: e.message });
        }
      }
    }
    console.error(`${i + 1}/${answers.length} ${answer} (${blocked.length} blocked)`);
  });
  return { calls, version, totalMs: performance.now() - t0 };
}

const f1 = (n: number) => n.toFixed(1);

function stats(calls: Call[]): (string | number)[] {
  const ms = calls.map((c) => c.ms).sort((a, b) => a - b);
  const ok = calls.filter((c) => !c.error).map((c) => c.attempts);
  const failed = calls.length - ok.length;
  return [calls.length, failed, f1((100 * failed) / calls.length), f1(pct(ms, 0.5)), f1(pct(ms, 0.95)), f1(ms.at(-1) ?? 0), f1(mean(ok)), Math.max(0, ...ok)];
}

function report(calls: Call[], version: string, count: number, totalMs: number): string {
  const head = ['calls', 'failures', 'fail %', 'median ms', 'p95 ms', 'max ms', 'mean attempts', 'max attempts'];
  const cell = LEVELS.flatMap((level) =>
    SIZES.map((size) => [level, `${size}x${size}`, ...stats(calls.filter((c) => c.level === level && c.size === size))]),
  );
  const levels = LEVELS.map((level) => {
    const s = calls.filter((c) => c.level === level);
    const failed = s.filter((c) => c.error).length;
    return [level, s.length, failed, f1((100 * failed) / s.length)];
  });
  const lengths = [5, 6, 7].map((n) => {
    const s = calls.filter((c) => c.answer.length === n);
    const hard = s.filter((c) => c.level === 'hard' && c.size === 15);
    return [n, new Set(s.map((c) => c.answer)).size, f1(mean(hard.map((c) => c.ms)))];
  });
  const slowest = [...calls].sort((a, b) => b.ms - a.ms).slice(0, 10).map((c) => [c.answer, `${c.size}x${c.size}`, c.level, c.blocked, c.attempts, f1(c.ms)]);
  const failures = calls.filter((c) => c.error).map((c) => [c.answer, `${c.size}x${c.size}`, c.level, c.error!.replace(/^.*?: /, '')]);
  return [
    '# Word Path v1 generator benchmark',
    '',
    `- Date: ${new Date().toISOString().slice(0, 10)}`,
    `- Generator version: ${wordpathV1.GENERATOR_VERSION}`,
    `- Word list version: ${version}`,
    `- Answers: ${count} (fixed seed bench-gen-1), ${calls.length} generate calls`,
    `- maxAttempts: ${MAX_ATTEMPTS}`,
    `- Total run time: ${(totalMs / 1000).toFixed(1)} s`,
    '',
    '## Per level and size',
    '',
    table(['level', 'size', ...head], cell),
    '',
    '## Per level',
    '',
    table(['level', 'calls', 'failures', 'fail %'], levels),
    '',
    '## By answer length (mean ms at 15x15 hard)',
    '',
    table(['letters', 'answers', 'mean ms'], lengths),
    '',
    '## Slowest calls',
    '',
    table(['answer', 'size', 'level', 'blocked words', 'attempts', 'ms'], slowest),
    '',
    '## Failures',
    '',
    failures.length ? table(['answer', 'size', 'level', 'cause'], failures) : 'None.',
    '',
  ].join('\n');
}

function main(): void {
  const i = process.argv.indexOf('--count');
  const count = i > 0 ? Number(process.argv[i + 1]) : 100;
  if (!Number.isInteger(count) || count < 1) throw new Error('--count needs a positive integer');
  const { calls, version, totalMs } = run(count);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, report(calls, version, count, totalMs));
  console.log(`bench: wrote ${OUT}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
