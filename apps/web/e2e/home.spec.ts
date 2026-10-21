import { expect, test, type Page } from '@playwright/test';
import { TODAY, board, hit, hitOver, installPuzzle, installUnlimited, open, toWordPath } from './helpers';

const h1 = (page: Page) => page.getByRole('heading', { level: 1 });
const wordPathPage = (page: Page) => page.getByRole('heading', { level: 2, name: "Today's puzzle" });
const back = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Back' });

/** Each new screen takes focus on its heading. */
async function onScreen(page: Page, title: string) {
  await expect(h1(page)).toHaveText(title);
  await expect(h1(page)).toBeFocused();
}

test.describe('screens', () => {
  let unlimited: Awaited<ReturnType<typeof installUnlimited>>;
  test.beforeEach(async ({ page }) => {
    await installPuzzle(page, TODAY);
    unlimited = await installUnlimited(page, 2);
    await open(page);
  });

  test('Home shows the Word Path card with its example board', async ({ page }) => {
    await expect(h1(page)).toHaveText('Tiny Trouble Games');
    await expect(page.getByRole('heading', { level: 2, name: 'Word Path' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Play Word Path' })).toHaveAccessibleDescription('Tuesday, November 10 Not played yet');
    await expect(page.locator('.gamecard .board')).toBeVisible();
    await expect(page.locator('.gamecard .board .tile')).toHaveCount(16);
    await expect(page.getByText('TRAIL, in one path')).toBeVisible();
  });

  test('the whole card is one click target: its art and its text open the Word Path page too', async ({ page }) => {
    const card = page.locator('.gamecard');
    for (const over of [page.locator('.gamecard .gc-art .board'), page.locator('.gamecard h2'), page.locator('.gamecard .desc')]) {
      await hitOver(card, over);
      await expect(wordPathPage(page)).toBeVisible();
      await hit(back(page));
      await expect(h1(page)).toHaveText('Tiny Trouble Games');
    }
  });

  test('the card opens the Word Path page; Play daily opens the daily and Back returns to the page', async ({ page }) => {
    await toWordPath(page);
    await onScreen(page, 'Word Path');
    await hit(page.getByRole('button', { name: 'Play daily' }));
    await expect(page.getByText('Nov 10', { exact: true })).toBeVisible();
    await expect(board(page)).toBeVisible();
    await onScreen(page, 'Word Path');
    await hit(back(page));
    await expect(wordPathPage(page)).toBeVisible();
    await onScreen(page, 'Word Path');
  });

  test('Hard opens a Hard puzzle; Back returns to the page, and Back from there returns Home', async ({ page }) => {
    await toWordPath(page);
    await hit(page.getByRole('button', { name: 'Play Hard' }));
    await expect(page.getByText('Unlimited · Hard')).toBeVisible();
    await expect(board(page)).toBeVisible();
    expect(unlimited.current().meta.level).toBe('hard');
    await onScreen(page, 'Word Path');
    await hit(back(page));
    await expect(wordPathPage(page)).toBeVisible();
    await onScreen(page, 'Word Path');
    await hit(back(page));
    await onScreen(page, 'Tiny Trouble Games');
  });
});

test.describe('dialogs', () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
    await toWordPath(page);
  });

  /** Outside the centered panel: the dialog's backdrop. */
  const backdrop = (page: Page) => (test.info().project.use.hasTouch ? page.touchscreen.tap(4, 4) : page.mouse.click(4, 4));

  for (const [opener, title] of [
    ['Stats', 'Stats'],
    ['How to play', 'How to play'],
  ] as const) {
    test(`${title} closes on Escape and on the backdrop, not on a click inside, and gives focus back`, async ({ page }) => {
      const button = page.getByRole('banner').getByRole('button', { name: opener });
      const dialog = page.getByRole('dialog', { name: title });
      const openIt = async () => {
        await hit(button);
        await expect(dialog).toBeVisible();
      };
      const closed = async () => {
        await expect(dialog).toBeHidden();
        await expect(button).toBeFocused();
      };

      await openIt();
      await page.keyboard.press('Escape');
      await closed();

      await openIt();
      await hit(dialog.getByRole('heading', { name: title }));
      await expect(dialog).toBeVisible();
      await backdrop(page);
      await closed();
    });
  }
});

test('How to play opens by itself on the first visit to the Word Path page, then not again', async ({ page }) => {
  await open(page, { howToSeen: false });
  await toWordPath(page);
  const dialog = page.getByRole('dialog', { name: 'How to play' });
  await expect(dialog).toBeVisible();
  await hit(dialog.getByRole('button', { name: 'Got it' }));
  await expect(dialog).toBeHidden();
  await page.reload();
  await toWordPath(page);
  await expect(page.getByRole('button', { name: 'Play daily' })).toBeVisible();
  await expect(dialog).toHaveCount(0);
});
