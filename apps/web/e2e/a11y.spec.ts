import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { TODAY, hit, installPuzzle, installUnlimited, open, tapRoute, toDaily, toWordPath } from './helpers';

/** Scans once motion has settled: the screen's entrance, CSS transitions, the dialog's open. */
async function scan(page: Page) {
  await page.waitForFunction(() => {
    const screen = document.querySelector('.screen');
    return !!screen && getComputedStyle(screen).opacity === '1' && document.getAnimations().every((a) => a.playState !== 'running');
  });
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

let daily: Awaited<ReturnType<typeof installPuzzle>>;
let unlimited: Awaited<ReturnType<typeof installUnlimited>>;
test.beforeEach(async ({ page }) => {
  daily = await installPuzzle(page, TODAY);
  unlimited = await installUnlimited(page, 2);
});

/** The daily solved, its celebration skipped to the end by a key press. */
async function solveDaily(page: Page) {
  await open(page);
  await toDaily(page);
  await tapRoute(page, (await daily.solution()).route);
  await expect(page.getByRole('heading', { level: 2, name: 'Solved' })).toBeVisible();
  await page.keyboard.press('Shift');
}

const screens: [string, (page: Page) => Promise<void>][] = [
  ['Home', (page) => open(page)],
  [
    'the Word Path page',
    async (page) => {
      await open(page);
      await toWordPath(page);
      await expect(page.getByRole('button', { name: 'Play Hard' })).toBeEnabled();
    },
  ],
  [
    'the daily mid-game',
    async (page) => {
      await open(page);
      await toDaily(page);
      await tapRoute(page, (await daily.solution()).route.slice(0, 2));
    },
  ],
  ['the result', solveDaily],
  [
    'the stats dialog',
    async (page) => {
      await solveDaily(page);
      await hit(page.getByRole('main').getByRole('button', { name: 'Stats' }));
      await expect(page.getByRole('dialog', { name: 'Stats' })).toBeVisible();
    },
  ],
  [
    'the how-to dialog',
    async (page) => {
      await open(page, { howToSeen: false });
      await toWordPath(page);
      await expect(page.getByRole('dialog', { name: 'How to play' })).toBeVisible();
    },
  ],
  [
    'unlimited mid-game',
    async (page) => {
      await open(page);
      await toWordPath(page);
      await hit(page.getByRole('button', { name: 'Play Normal' }));
      await tapRoute(page, (await unlimited.solution()).route.slice(0, 2));
    },
  ],
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    for (const [name, reach] of screens) {
      test(`${name} has no axe violations`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await reach(page);
        await scan(page);
      });
    }
  });
}
