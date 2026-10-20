import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App placeholder', () => {
  it('starts on home and moves through the views', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Tiny Trouble Games' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Word Path' }));
    expect(screen.getByText('wordpath')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Word Path' })).toBeInTheDocument();
  });

  it('opens the daily, and its Back returns to the Word Path page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Daily' }));
    expect(await screen.findByRole('heading', { name: 'No Word Path puzzle today' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    expect(screen.getByText('wordpath')).toBeInTheDocument();
  });
});
