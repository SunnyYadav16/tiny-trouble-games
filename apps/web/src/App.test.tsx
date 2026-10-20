import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import gsap from 'gsap';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { stubLayout } from './test/layout';
import { makeTestPuzzle } from './test/testPuzzle';

beforeEach(() => {
  localStorage.setItem('ttg:wordpath:seen-howto', 'true');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('index.json') ? Response.json({ count: { easy: 4, normal: 4, hard: 4 } }) : new Response('', { status: 404 }))));
});

const page = () => screen.findByRole('heading', { level: 2, name: 'Unlimited' });
/** Plays the screen's entrance to its end now; the end clears the inline styles it set, and focus must outlast that. */
const entered = (c: HTMLElement) => gsap.getTweensOf(c.querySelector('.screen')).forEach((t) => t.progress(1));

describe('App', () => {
  it('goes Home → Word Path page → daily, and Back returns to the page, then Home', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Tiny Trouble Games' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /^Word Path\./ }));
    await page();
    await user.click(screen.getByRole('button', { name: 'Play daily' }));
    expect(await screen.findByRole('heading', { name: 'No Word Path puzzle today' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    await page();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Tiny Trouble Games' })).toBeInTheDocument();
  });

  it('opens an unlimited level from the page, and Back returns to the page', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('link', { name: /^Word Path\./ }));
    const hard = await screen.findByRole('button', { name: /^Play Hard\./ });
    await vi.waitFor(() => expect(hard).toBeEnabled());
    await user.click(hard);
    expect(screen.getByText('Unlimited · Hard')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'No Hard puzzles yet' })).toBeInTheDocument(); // the stub serves no puzzle files
    await user.click(screen.getAllByRole('button', { name: 'Back' }).at(-1)!);
    await page();
  });

  it('shows Continue on the page after leaving a daily that was opened but not played', async () => {
    stubLayout(338, 600, false);
    const puzzle = makeTestPuzzle();
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (url.endsWith('index.json') ? new Response('', { status: 404 }) : Response.json(puzzle))));
    const user = userEvent.setup();
    const { container } = render(<App />);
    await user.click(screen.getByRole('link', { name: /^Word Path\./ }));
    await user.click(await screen.findByRole('button', { name: 'Play daily' }));
    await screen.findByText(puzzle.clue);
    await waitFor(() => expect(container.querySelectorAll('.tile')).toHaveLength(49));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Continue' })).toBeInTheDocument(); // saved as the daily unmounted
  });

  it('moves focus to the new screen\'s heading on each change, but not on the first render', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(document.body).toHaveFocus();
    await user.click(screen.getByRole('link', { name: /^Word Path\./ }));
    await page();
    entered(container);
    expect(screen.getByRole('heading', { level: 1, name: 'Word Path' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    entered(container);
    expect(screen.getByRole('heading', { level: 1, name: 'Tiny Trouble Games' })).toHaveFocus();
  });
});
