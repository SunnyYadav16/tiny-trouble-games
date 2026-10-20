// Its own file: canPersist() caches its first probe per module, so storage must be blocked before anything asks.
import { wordpathV1 } from '@ttg/engine';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { stubLayout } from '../../test/layout';
import { makeTestPuzzle } from '../../test/testPuzzle';
import { WordPathDaily } from './WordPathDaily';

const NOTICE = "This browser isn't saving progress. You can still play, but your result and streak won't be kept.";

afterEach(() => vi.restoreAllMocks());

it('says progress is not saved when storage throws, still plays to a solve, and Dismiss hides the notice', async () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
  }
  const puzzle = makeTestPuzzle({ id: 'wp-2026-11-02', date: '2026-11-02' });
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(puzzle)));
  stubLayout(338, 600, false);
  const user = userEvent.setup();

  const { container } = render(<WordPathDaily now={() => new Date(2026, 10, 2, 9)} onBack={() => {}} onUnlimited={() => {}} />);
  expect(screen.getByText(NOTICE)).toBeInTheDocument();
  await screen.findByText(puzzle.clue);
  const tiles = [...container.querySelectorAll<HTMLButtonElement>('.tile')];
  for (const c of wordpathV1.parsePuzzle(puzzle)!.solutions[7]!) await user.click(tiles[c]!);
  expect(screen.getByRole('heading', { name: 'Solved' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByText(NOTICE)).toBeNull();
});
