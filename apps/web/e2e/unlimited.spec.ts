import { expect, test, type Page } from '@playwright/test';
import { TODAY, board, hit, hitOver, installPuzzle, installUnlimited, open, selected, stored, tapRoute, tile, toWordPath } from './helpers';

const solvedHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Solved' });
const level = (page: Page, action: 'Play' | 'Continue', name: string) => page.getByRole('button', { name: `${action} ${name}`, exact: true });
/** The level's row: its "In progress" tag is text for the eye beside the button. */
const row = (page: Page, name: string) => page.locator('.lvl').filter({ has: level(page, 'Continue', name) });

let unlimited: Awaited<ReturnType<typeof installUnlimited>>;
test.beforeEach(async ({ page }) => {
  unlimited = await installUnlimited(page, 3);
});

test('the whole level row is one click target: its description text opens the level too', async ({ page }) => {
  await open(page);
  await toWordPath(page);
  for (const name of ['Easy', 'Normal']) {
    const lvl = page.locator('.lvl').filter({ has: level(page, 'Play', name) });
    await hitOver(lvl, lvl.locator('.desc'));
    await expect(page.getByText(`Unlimited · ${name}`)).toBeVisible();
    await hit(page.getByRole('banner').getByRole('button', { name: 'Back' }));
    await expect(page.getByRole('heading', { level: 2, name: "Today's puzzle" })).toBeVisible();
  }
});

test('two puzzles back to back with Next puzzle', async ({ page }) => {
  await open(page);
  await toWordPath(page);
  await hit(level(page, 'Play', 'Normal'));
  await tapRoute(page, (await unlimited.solution()).route);
  const first = unlimited.current().id;
  await expect(solvedHeading(page)).toBeVisible();

  await hit(page.getByRole('button', { name: 'Next Normal puzzle' }));
  await expect.poll(() => unlimited.current().id).not.toBe(first);
  const second = unlimited.current().id;
  await expect(solvedHeading(page)).toBeHidden();
  await expect(selected(page)).toHaveCount(0);
  await tapRoute(page, (await unlimited.solution()).route);
  await expect(solvedHeading(page)).toBeVisible();
  expect(Object.keys((await stored(page, 'ttg:wordpath:unlimited-results')) as object).sort()).toEqual([first, second].sort());
});

test('reload mid-puzzle restores it', async ({ page }) => {
  await open(page);
  await toWordPath(page);
  await hit(level(page, 'Play', 'Normal'));
  const { route } = await unlimited.solution();
  const id = unlimited.current().id;
  await tapRoute(page, route.slice(0, 2));

  await page.reload();
  await toWordPath(page);
  await expect(row(page, 'Normal')).toContainText('In progress');
  await hit(level(page, 'Continue', 'Normal'));
  await expect(board(page)).toBeVisible();
  expect(unlimited.current().id).toBe(id);
  await expect(selected(page)).toHaveCount(2);
  for (const cell of route.slice(0, 2)) await expect(tile(page, cell)).toHaveAccessibleName(/, selected$/);
});

test('a level keeps its puzzle while another level is played, and the daily is untouched', async ({ page }) => {
  await installPuzzle(page, TODAY);
  await open(page);
  // Yesterday's and today's dailies solved: a 2-day streak.
  const daily = Object.fromEntries(
    ['2026-11-09', TODAY].map((date) => [`wp-${date}`, { id: `wp-${date}`, date, outcome: 'solved', timeMs: 65_000, wrongAttempts: 0, size: 7, level: 'normal' }]),
  );
  await page.evaluate((d) => localStorage.setItem('ttg:wordpath:results', JSON.stringify(d)), daily);
  await page.reload();
  await toWordPath(page);
  const today = page.getByRole('region', { name: "Today's puzzle" });
  await expect(today).toContainText('Solved in 1:05');
  await expect(today).toContainText('2-day streak');

  await hit(level(page, 'Play', 'Normal'));
  const { route } = await unlimited.solution();
  const normal = unlimited.current().id;
  await tapRoute(page, route.slice(0, 2));
  await hit(page.getByRole('banner').getByRole('button', { name: 'Back' }));

  await hit(level(page, 'Play', 'Hard'));
  await expect(page.getByText('Unlimited · Hard')).toBeVisible();
  await tapRoute(page, (await unlimited.solution()).route);
  expect(unlimited.current().meta.level).toBe('hard');
  await expect(solvedHeading(page)).toBeVisible();
  await hit(page.getByRole('button', { name: 'Change level' }));

  await expect(row(page, 'Normal')).toContainText('In progress');
  await hit(level(page, 'Continue', 'Normal'));
  await expect(board(page)).toBeVisible();
  expect(unlimited.current().id).toBe(normal);
  await expect(selected(page)).toHaveCount(2);
  for (const cell of route.slice(0, 2)) await expect(tile(page, cell)).toHaveAccessibleName(/, selected$/);

  await hit(page.getByRole('banner').getByRole('button', { name: 'Back' }));
  await expect(today).toContainText('Solved in 1:05');
  await expect(today).toContainText('2-day streak');
  expect(await stored(page, 'ttg:wordpath:results')).toEqual(daily);
});
