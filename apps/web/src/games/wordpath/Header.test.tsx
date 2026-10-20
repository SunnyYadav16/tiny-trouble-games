import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

function setup(streak: number | null) {
  const on = { onBack: vi.fn<() => void>(), onStats: vi.fn<() => void>(), onHowTo: vi.fn<() => void>() };
  const view = render(<Header title="Word Path" subtitle="Nov 2" streak={streak} {...on} />);
  return { ...view, ...on };
}

describe('Header', () => {
  it('shows the title, subtitle, and streak with a text label; each button calls its handler', async () => {
    const user = userEvent.setup();
    const { onBack, onStats, onHowTo } = setup(4);
    expect(screen.getByRole('heading', { level: 1, name: 'Word Path' })).toBeInTheDocument();
    expect(screen.getByText('Nov 2')).toBeInTheDocument();
    expect(screen.getByText('4-day streak')).toHaveClass('visually-hidden');
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Stats' }));
    await user.click(screen.getByRole('button', { name: 'How to play' }));
    expect([onBack, onStats, onHowTo].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('hides the streak when there is none, and shows no notice while storage works', () => {
    const { container } = setup(null);
    expect(container.querySelector('.streak')).toBeNull();
    expect(screen.queryByText(/isn't saving progress/)).toBeNull();
  });
});
