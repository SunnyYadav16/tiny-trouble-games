import { expect, test, type Page } from '@playwright/test';
import { TODAY, board, hit, installPuzzle, open, selected, tapRoute, tile, toDaily, wrongRoute } from './helpers';

const solvedHeading = (page: Page) => page.getByRole('heading', { level: 2, name: 'Solved' });

let solution: Awaited<ReturnType<typeof installPuzzle>>['solution'];
test.beforeEach(async ({ page }) => {
  ({ solution } = await installPuzzle(page, TODAY));
  await open(page);
  await toDaily(page);
  await expect(board(page)).toBeVisible();
});

test('a full solve by clicking (tapping on the phone)', async ({ page }) => {
  const { route, word } = await solution();
  await tapRoute(page, route);
  await expect(solvedHeading(page)).toBeVisible();
  await expect(page.getByText(`The answer is ${word}.`)).toBeAttached();
  await expect(page.getByRole('status').filter({ hasText: 'Solved' })).toBeAttached();
});

test('a full solve by keyboard: Tab reaches the board, arrows move, Enter and Space select', async ({ page }) => {
  const { size, route } = await solution();
  // Focus starts on the screen's heading; Tab walks the header and the controls into the board.
  for (let i = 0; i < 10 && !(await tile(page, 0).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(tile(page, 0)).toBeFocused();

  let at = 0;
  for (const [i, cell] of route.entries()) {
    const [dr, dc] = [Math.floor(cell / size) - Math.floor(at / size), (cell % size) - (at % size)];
    for (let k = 0; k < Math.abs(dr); k++) await page.keyboard.press(dr > 0 ? 'ArrowDown' : 'ArrowUp');
    for (let k = 0; k < Math.abs(dc); k++) await page.keyboard.press(dc > 0 ? 'ArrowRight' : 'ArrowLeft');
    await expect(tile(page, cell)).toBeFocused();
    await page.keyboard.press(i % 2 ? 'Space' : 'Enter');
    at = cell;
  }
  await expect(solvedHeading(page)).toBeVisible();
});

test('a wrong route shows its word, then clears on its own', async ({ page }) => {
  const wrong = wrongRoute(await solution());
  await tapRoute(page, wrong.route);
  const line = page.getByText(`${wrong.word} is not today's answer`);
  await expect(line).toBeVisible();
  await expect(line).toBeHidden(); // after WRONG_MS
  await expect(selected(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible(); // still playing
});

test('there is no Hint button', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();
  await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0);
});

test('Clear empties the route', async ({ page }) => {
  const { route } = await solution();
  await tapRoute(page, route.slice(0, 2));
  await expect(selected(page)).toHaveCount(2);
  await hit(page.getByRole('button', { name: 'Clear' }));
  await expect(selected(page)).toHaveCount(0);
});

test('Escape empties the route', async ({ page }) => {
  const { route } = await solution();
  await tapRoute(page, route.slice(0, 2));
  await expect(selected(page)).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(selected(page)).toHaveCount(0);
});

test('Escape closes the Give up prompt and keeps the route', async ({ page }) => {
  const { route } = await solution();
  await tapRoute(page, route.slice(0, 2));
  await hit(page.getByRole('button', { name: 'Give up' }));
  await expect(page.getByText('Give up? Your streak resets.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Give up? Your streak resets.')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Give up' })).toBeFocused();
  await expect(selected(page)).toHaveCount(2);
});

test('Give up asks first, then reveals the answer route', async ({ page }) => {
  const { route, word } = await solution();
  await hit(page.getByRole('button', { name: 'Give up' }));
  await expect(page.getByText('Give up? Your streak resets.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep playing' })).toBeFocused();
  await hit(page.getByRole('button', { name: 'Keep playing' }));
  await expect(page.getByRole('button', { name: 'Clear' })).toBeVisible();

  await hit(page.getByRole('button', { name: 'Give up' }));
  await hit(page.getByRole('button', { name: 'Yes, show answer' }));
  await expect(page.getByRole('heading', { level: 2, name: 'Gave up' })).toBeVisible();
  await expect(page.getByText(`The answer is ${word}.`)).toBeAttached();
  await expect(page.getByText('Your streak is back to 0.', { exact: false })).toBeVisible();
  await expect(selected(page)).toHaveCount(route.length);
  for (const cell of route) await expect(tile(page, cell)).toHaveAccessibleName(/, selected$/);
});
