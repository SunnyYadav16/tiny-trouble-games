import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Reduced motion on and touch-style pointer by default so component tests never wait on tweens.
// Tests override either by re-stubbing window.matchMedia.
const MATCHES_BY_DEFAULT = new Set(['(prefers-reduced-motion: reduce)']);

vi.stubGlobal('matchMedia', (query: string): MediaQueryList => ({
  matches: MATCHES_BY_DEFAULT.has(query),
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// jsdom has no modal dialogs: showModal opens the dialog and focuses its first control, as browsers do.
HTMLDialogElement.prototype.showModal = function showModal() {
  this.setAttribute('open', '');
  this.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus();
};
HTMLDialogElement.prototype.close = function close() {
  this.removeAttribute('open');
};
