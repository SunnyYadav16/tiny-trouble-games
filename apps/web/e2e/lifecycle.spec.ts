import { expect, test, type Page } from '@playwright/test';
import { formatDuration } from '../src/shared/daily';
import { TODAY, board, hidePage, hit, installPuzzle, open, selected, showPage, stored, tapRoute, tile, toDaily, wrongRoute } from './helpers';

const solvedHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Solved' });
const ledger = (page: Page, term: string) => page.locator('.ledger div', { hasText: term }).getByRole('definition');
const results = async (page: Page) => (await stored(page, 'ttg:wordpath:results')) as Record<string, { date: string; timeMs: number }>;
const tileWidth = (page: Page) => tile(page, 0).evaluate((el) => el.getBoundingClientRect().width);

test('reload mid-puzzle restores the route and the wrong tries', async ({ page }) => {
  const { solution } = await installPuzzle(page, TODAY);
  await open(page);
  await toDaily(page);
  const sol = await solution();
  const wrong = wrongRoute(sol);
  await tapRoute(page, wrong.route);
  await expect(page.getByText(`${wrong.word} is not today's answer`)).toBeVisible();
  await expect(page.getByText(`${wrong.word} is not today's answer`)).toBeHidden();
  await tapRoute(page, sol.route.slice(0, 2));

  await page.reload();
  await toDaily(page, 'Continue');
  await expect(selected(page)).toHaveCount(2);
  for (const cell of sol.route.slice(0, 2)) await expect(tile(page, cell)).toHaveAccessibleName(/, selected$/);
  await tapRoute(page, sol.route.slice(2));
  await expect(solvedHeading(page)).toBeVisible();
  await expect(ledger(page, 'Wrong tries')).toHaveText('1');
});

test('a daily started before midnight and resumed after it is filed under its start date', async ({ page }) => {
  const start = await installPuzzle(page, '2026-11-10');
  await installPuzzle(page, '2026-11-11');
  await open(page, { at: '2026-11-10T23:58:00' });
  await toDaily(page);
  await expect(page.getByText('Nov 10', { exact: true })).toBeVisible();
  const sol = await start.solution();
  await tapRoute(page, sol.route.slice(0, 2));

  await page.clock.fastForward('05:00'); // now 00:03 on Nov 11
  await page.reload();
  await toDaily(page, 'Continue');
  await expect(page.getByText('Nov 10', { exact: true })).toBeVisible();
  await expect(selected(page)).toHaveCount(2);
  await tapRoute(page, sol.route.slice(2));
  await expect(solvedHeading(page)).toBeVisible();
  const saved = await results(page);
  expect(Object.keys(saved)).toEqual(['wp-2026-11-10']);
  expect(saved['wp-2026-11-10']!.date).toBe('2026-11-10');

  // The new day's puzzle is one click away, fresh.
  await hit(page.getByRole('button', { name: "Play today's puzzle" }));
  await expect(page.getByText('Nov 11', { exact: true })).toBeVisible();
  await expect(board(page)).toBeVisible();
  await expect(selected(page)).toHaveCount(0);
});

test('a hidden tab pauses the timer', async ({ page }) => {
  const { solution } = await installPuzzle(page, TODAY);
  await open(page);
  await toDaily(page);
  const sol = await solution();
  await tapRoute(page, sol.route.slice(0, 1));
  await hidePage(page);
  await page.clock.fastForward('10:00');
  await showPage(page);
  await tapRoute(page, sol.route.slice(1));
  await expect(solvedHeading(page)).toBeVisible();
  const { timeMs } = (await results(page))[`wp-${TODAY}`]!;
  expect(timeMs).toBeLessThan(60_000);
  await expect(ledger(page, 'Time')).toHaveText(formatDuration(timeMs));
});

test('resizing the window mid-puzzle keeps the board size; only the tiles scale', async ({ page, isMobile }) => {
  const { solution } = await installPuzzle(page, TODAY);
  await open(page);
  await toDaily(page);
  const { size, route } = await solution();
  await tapRoute(page, route.slice(0, 2));
  const before = await tileWidth(page);

  // Small enough that a fresh start would pick a smaller board.
  await page.setViewportSize(isMobile ? { width: 320, height: 700 } : { width: 1000, height: 560 });
  await expect.poll(() => tileWidth(page)).toBeLessThan(before);
  await expect(board(page).getByRole('row')).toHaveCount(size);
  await expect(selected(page)).toHaveCount(2);
});

test('the board is 15×15 with a mouse, and at most 10×10 with 44–48px tiles on touch', async ({ page, isMobile }) => {
  const { solution } = await installPuzzle(page, TODAY);
  await open(page);
  await toDaily(page);
  const { size } = await solution();
  const width = await tileWidth(page);
  if (isMobile) {
    expect(size).toBeGreaterThanOrEqual(6);
    expect(size).toBeLessThanOrEqual(10);
    expect(width).toBeGreaterThanOrEqual(44);
  } else {
    expect(size).toBe(15);
    expect(width).toBeGreaterThanOrEqual(36);
  }
  expect(width).toBeLessThanOrEqual(48);
});

test('a missing daily shows the friendly message, and Back returns to the Word Path page', async ({ page }) => {
  await page.route(`**/wordpath/${TODAY}.json`, (r) => r.fulfill({ status: 404 }));
  await open(page);
  await toDaily(page);
  await expect(page.getByRole('heading', { level: 2, name: 'No Word Path puzzle today' })).toBeVisible();
  await expect(page.getByText("Today's plot isn't ready yet.", { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play unlimited' })).toBeVisible();
  await hit(page.getByRole('main').getByRole('button', { name: 'Back' }));
  await expect(page.getByRole('heading', { level: 2, name: "Today's puzzle" })).toBeVisible();
});
