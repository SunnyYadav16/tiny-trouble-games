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

// jsdom has no layout, so offsetParent is always null. GSAP reads that as "not rendered" and, to read a transform (clearProps),
// moves the element into <html> and back, which drops focus to <body>. A browser reports the body for an element in the page.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  get(this: HTMLElement) {
    return this.isConnected && this !== document.body ? document.body : null;
  },
});
