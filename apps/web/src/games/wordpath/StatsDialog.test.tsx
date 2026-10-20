import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { StatsDialog } from './StatsDialog';
import { summarize, type Stats } from './stats';
import type { ResultRecord } from './results';

const rec = (over: Partial<ResultRecord>): ResultRecord => ({ id: 'x', date: '2026-11-01', outcome: 'solved', timeMs: 84_000, wrongAttempts: 0, size: 7, level: 'normal', ...over });
const stats: Stats = {
  daily: { ...summarize([rec({ timeMs: 20_000 }), rec({ timeMs: 90_000 }), rec({ outcome: 'gave-up' })]), current: 4, best: 9 },
  unlimited: summarize([rec({ level: 'easy', timeMs: 52_000 }), rec({ level: 'hard', timeMs: 245_000 })]),
  byLevel: {
    easy: summarize([rec({ level: 'easy', timeMs: 52_000 })]),
    normal: summarize([]),
    hard: summarize([rec({ level: 'hard', timeMs: 245_000 })]),
  },
};

describe('StatsDialog', () => {
  it('is a modal dialog named by its heading, with focus inside it', () => {
    render(<StatsDialog {...stats} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Stats' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('shows Daily with streaks and Unlimited without them', () => {
    render(<StatsDialog {...stats} onClose={() => {}} />);
    const daily = screen.getByRole('region', { name: 'Daily' });
    expect(within(daily).getByText('Current streak').nextElementSibling).toHaveTextContent('4');
    expect(within(daily).getByText('Best streak').nextElementSibling).toHaveTextContent('9');
    expect(within(daily).getByText('Played').nextElementSibling).toHaveTextContent('3');
    expect(within(daily).getByText('Solve rate').nextElementSibling).toHaveTextContent('67%');
    expect(within(daily).getByText('Average time').nextElementSibling).toHaveTextContent('0:55');
    const unlimited = screen.getByRole('region', { name: 'Unlimited' });
    expect(within(unlimited).queryByText(/streak/i)).toBeNull();
    expect(within(unlimited).getAllByText('Solved')[0]!.nextElementSibling).toHaveTextContent('2');
  });

  it('gives each distribution bar a label and a text count', () => {
    render(<StatsDialog {...stats} onClose={() => {}} />);
    const daily = screen.getByRole('region', { name: 'Daily' });
    const rows = within(daily).getAllByRole('listitem').map((li) => li.textContent);
    expect(rows).toEqual(['under 0:301', '0:30–1:000', '1:00–2:001', '2:00–5:000', '5:00+0']);
  });

  it('lists one row per level in Unlimited, with solved count and average time', () => {
    render(<StatsDialog {...stats} onClose={() => {}} />);
    const table = within(screen.getByRole('region', { name: 'Unlimited' })).getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1).map((r) => [...r.querySelectorAll('th, td')].map((c) => c.textContent));
    expect(rows).toEqual([['Easy', '1', '0:52'], ['Normal', '0', '–'], ['Hard', '1', '4:05']]);
  });

  it('ends with the saved-in-this-browser footnote', () => {
    render(<StatsDialog {...stats} onClose={() => {}} />);
    expect(screen.getByText('Saved in this browser only. Clearing your browser data, or using a private window, starts your stats fresh.')).toBeInTheDocument();
  });

  it('shows zeros and dashes for a fresh browser', () => {
    const empty = summarize([]);
    render(<StatsDialog daily={{ ...empty, current: 0, best: 0 }} unlimited={empty} byLevel={{ easy: empty, normal: empty, hard: empty }} onClose={() => {}} />);
    const daily = screen.getByRole('region', { name: 'Daily' });
    expect(within(daily).getByText('Solve rate').nextElementSibling).toHaveTextContent('0%');
    expect(within(daily).getByText('Average time').nextElementSibling).toHaveTextContent('–');
  });

  it('closes from the button, from Escape (cancel), and from a click on the backdrop', async () => {
    const onClose = vi.fn<() => void>();
    render(<StatsDialog {...stats} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const dialog = screen.getByRole('dialog', { name: 'Stats' });
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(cancel.defaultPrevented).toBe(true); // the parent unmounts it; the browser must not also close it

    await userEvent.click(within(dialog).getByRole('heading', { name: 'Stats' }));
    expect(onClose).toHaveBeenCalledTimes(2);
    await userEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('returns focus to the control that opened it', async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open && <StatsDialog {...stats} onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
});
