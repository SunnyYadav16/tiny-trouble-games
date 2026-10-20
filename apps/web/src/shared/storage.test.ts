import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const isNum = (v: unknown): v is number => typeof v === 'number';

async function fresh() {
  vi.resetModules();
  return import('./storage');
}

describe('storage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a value', async () => {
    const s = await fresh();
    s.save('k', 5);
    expect(s.load('k', isNum)).toBe(5);
    s.remove('k');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('returns null for a missing key', async () => {
    const s = await fresh();
    expect(s.load('nope', isNum)).toBeNull();
  });

  it('returns null and removes the key for invalid JSON', async () => {
    const s = await fresh();
    localStorage.setItem('k', '{oops');
    expect(s.load('k', isNum)).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('returns null and removes the key when the guard fails', async () => {
    const s = await fresh();
    localStorage.setItem('k', '"text"');
    expect(s.load('k', isNum)).toBeNull();
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('never throws when localStorage access throws', async () => {
    const s = await fresh();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(s.load('k', isNum)).toBeNull();
    expect(() => s.save('k', 1)).not.toThrow();
    expect(() => s.remove('k')).not.toThrow();
  });

  it('canPersist is true normally and removes its probe', async () => {
    const s = await fresh();
    expect(s.canPersist()).toBe(true);
    expect(localStorage.getItem('ttg:probe')).toBeNull();
  });

  it('canPersist is false when access throws', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const s = await fresh();
    expect(s.canPersist()).toBe(false);
  });

  it('canPersist flips to false after a save hits a quota error', async () => {
    const s = await fresh();
    expect(s.canPersist()).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    s.save('k', 1);
    expect(s.canPersist()).toBe(false);
  });
});
