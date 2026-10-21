import { expect, test, type Locator, type Page } from '@playwright/test';
import { sameRoute, wordpathV1 } from '@ttg/engine';
import { unlimitedId } from '../src/games/wordpath/unlimited';
import { makeTestPuzzle } from '../src/test/testPuzzle';

type Body = wordpathV1.PuzzleBody;

/** Every spec plays on this local date unless it sets its own clock. Far from any DST change. */
export const TODAY = '2026-11-10';

/** Installs the clock at local time `at` (it then runs on), marks how to play as seen unless told not to, and opens Home. */
export async function open(page: Page, { at = `${TODAY}T10:00:00`, howToSeen = true } = {}) {
  await page.clock.install({ time: new Date(at) });
  if (howToSeen) await page.addInitScript(() => localStorage.setItem('ttg:wordpath:seen-howto', 'true'));
  await page.goto('/');
}

/** A tap on the phone project, a click on desktop. */
export const hit = (l: Locator) => (test.info().project.use.hasTouch ? l.tap() : l.click());

/** The play screen's board, once it has measured its slot and locked its size. */
export const board = (page: Page) => page.locator('main.play:not([data-probe])').getByRole('grid');
export const tile = (page: Page, cell: number) => board(page).getByRole('button').nth(cell);
export const selected = (page: Page) => board(page).getByRole('button', { name: /, selected$/ });

export async function tapRoute(page: Page, cells: readonly number[]) {
  for (const cell of cells) await hit(tile(page, cell));
}

/** The answer route for the size the board shows (its row count), decoded from the puzzle's checks. */
async function solutionOf(page: Page, body: Body) {
  const rows = board(page).getByRole('row');
  await expect(rows.first()).toBeVisible();
  const size = await rows.count();
  const route = wordpathV1.decodeRoute(body.checks[size]!);
  const cells = body.grids[size]!;
  return { size, route, cells, word: wordpathV1.spell(cells, route) };
}

/** Serves `/wordpath/<date>.json` with an engine-built daily. `solution()` reads the board's size, so call it once the board shows. */
export async function installPuzzle(page: Page, date: string) {
  const body = makeTestPuzzle({ id: `wp-${date}`, date });
  await page.route(`**/wordpath/${date}.json`, (r) => r.fulfill({ json: body }));
  return { solution: () => solutionOf(page, body) };
}

/** Serves the Unlimited index with `count` puzzles per level, and each puzzle file. `current()` is the last file served: the one on screen once the board shows. */
export async function installUnlimited(page: Page, count: number) {
  let last: Body | undefined;
  await page.route('**/wordpath/unlimited/index.json', (r) => r.fulfill({ json: { count: { easy: count, normal: count, hard: count } } }));
  await page.route('**/wordpath/unlimited/*/*.json', (r) => {
    const [, level, n] = /\/unlimited\/(\w+)\/(\d+)\.json$/.exec(r.request().url()) ?? [];
    if (!wordpathV1.LEVELS.includes(level as wordpathV1.Level) || !(Number(n) >= 1 && Number(n) <= count)) return r.fulfill({ status: 404 });
    last = makeTestPuzzle({ id: unlimitedId(level as wordpathV1.Level, Number(n)), level: level as wordpathV1.Level });
    return r.fulfill({ json: last });
  });
  const current = () => last!;
  /** Waits for the board, so the file on screen has been served. */
  const solution = async () => {
    await expect(board(page)).toBeVisible();
    return solutionOf(page, current());
  };
  return { current, solution };
}

/** A full-length route along the top row (or the next one) that is not the answer. */
export function wrongRoute({ size, route, cells }: Awaited<ReturnType<typeof solutionOf>>) {
  const row = (r: number) => Array.from({ length: route.length }, (_, i) => r * size + i);
  const wrong = sameRoute(row(0), route) ? row(1) : row(0);
  return { route: wrong, word: wordpathV1.spell(cells, wrong) };
}

const setVisibility = (page: Page, state: 'hidden' | 'visible') =>
  page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => s });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => s === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
export const hidePage = (page: Page) => setVisibility(page, 'hidden');
export const showPage = (page: Page) => setVisibility(page, 'visible');

/** Home → the Word Path page. */
export async function toWordPath(page: Page) {
  await hit(page.getByRole('link', { name: 'Play Word Path' }));
  await expect(page.getByRole('heading', { level: 2, name: "Today's puzzle" })).toBeVisible();
}

/** Home → the Word Path page → today's daily. */
export async function toDaily(page: Page, action: 'Play daily' | 'Continue' = 'Play daily') {
  await toWordPath(page);
  await hit(page.getByRole('button', { name: action }));
}

/** A parsed localStorage value, or null. */
export const stored = (page: Page, key: string): Promise<unknown> => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
