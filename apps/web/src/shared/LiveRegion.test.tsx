import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveRegion } from './LiveRegion';

describe('LiveRegion', () => {
  it('is a polite status region carrying the message', () => {
    render(<LiveRegion message="Route cleared" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
    expect(el).toHaveTextContent('Route cleared');
  });
});
