// Its own file: canPersist() caches its first probe per module, so storage must be blocked before anything asks.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { PlayPage } from './PlayPage';

afterEach(() => vi.restoreAllMocks());

it('when storage is blocked, the how-to dialog opens once on the Word Path page and stays closed on return', async () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
  const open = () => render(<PlayPage now={() => new Date(2026, 10, 2, 9)} onBack={() => {}} onDaily={() => {}} onUnlimited={() => {}} />);

  const first = open();
  expect(screen.getByRole('dialog', { name: 'How to play' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
  first.unmount();

  open();
  expect(screen.queryByRole('dialog')).toBeNull();
});
