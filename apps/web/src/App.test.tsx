import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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
});
