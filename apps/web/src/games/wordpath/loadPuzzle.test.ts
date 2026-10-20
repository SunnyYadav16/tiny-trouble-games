import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeTestPuzzle } from '../../test/testPuzzle';
import { dailyUrl, loadPuzzle, loadUnlimitedIndex, unlimitedUrl } from './loadPuzzle';

const reply = (body: string, status = 200) => vi.fn<() => Promise<Response>>(async () => new Response(body, { status }));
const json = (x: unknown, status = 200) => reply(JSON.stringify(x), status);

let puzzle: ReturnType<typeof makeTestPuzzle>;
beforeAll(() => {
  puzzle = makeTestPuzzle({ date: '2026-11-01' });
});
afterEach(() => vi.unstubAllGlobals());

describe('urls', () => {
  it('builds daily and unlimited paths', () => {
    expect(dailyUrl('2026-11-01')).toBe('/wordpath/2026-11-01.json');
    expect(unlimitedUrl('hard', 7)).toBe('/wordpath/unlimited/hard/7.json');
  });
});

describe('loadPuzzle', () => {
  it('loads a valid puzzle with decoded solutions at every size', async () => {
    vi.stubGlobal('fetch', json(puzzle));
    const r = await loadPuzzle(dailyUrl('2026-11-01'));
    expect(r).toMatchObject({ ok: true, puzzle });
    const solutions = (r as Extract<typeof r, { ok: true }>).solutions;
    expect(Object.keys(solutions)).toEqual(['6', '7', '8', '9', '10', '15']);
    expect(solutions[6]).toHaveLength(5);
  });

  it('missing: 404, HTML body, network error', async () => {
    vi.stubGlobal('fetch', reply('Not found', 404));
    expect(await loadPuzzle('/x')).toEqual({ ok: false, reason: 'missing' });
    vi.stubGlobal('fetch', reply('<!doctype html><html></html>'));
    expect(await loadPuzzle('/x')).toEqual({ ok: false, reason: 'missing' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    expect(await loadPuzzle('/x')).toEqual({ ok: false, reason: 'missing' });
  });

  it('unsupported: unknown rulesVersion', async () => {
    vi.stubGlobal('fetch', json({ ...puzzle, rulesVersion: 'wordpath/v9' }));
    expect(await loadPuzzle('/x')).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('invalid: junk JSON or a broken puzzle', async () => {
    vi.stubGlobal('fetch', json({ hello: 'world' }));
    expect(await loadPuzzle('/x')).toEqual({ ok: false, reason: 'invalid' });
    vi.stubGlobal('fetch', json([1, 2]));
    expect(await loadPuzzle('/x')).toEqual({ ok: false, reason: 'invalid' });
    vi.stubGlobal('fetch', json({ ...puzzle, checks: { ...puzzle.checks, '6': 'zzzz' } }));
    expect(await loadPuzzle('/x')).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('loadUnlimitedIndex', () => {
  it('ok with per-level counts', async () => {
    vi.stubGlobal('fetch', json({ count: { easy: 3, normal: 3, hard: 0 } }));
    expect(await loadUnlimitedIndex()).toEqual({ ok: true, count: { easy: 3, normal: 3, hard: 0 } });
  });

  it('invalid: bad count shapes, all zero', async () => {
    for (const body of [
      { count: 3 },
      { count: { easy: '3', normal: 3, hard: 3 } },
      { count: { easy: 1, normal: 1 } },
      { count: { easy: -1, normal: 2, hard: 2 } },
      { count: { easy: 1.5, normal: 2, hard: 2 } },
      { count: { easy: 0, normal: 0, hard: 0 } },
    ]) {
      vi.stubGlobal('fetch', json(body));
      expect(await loadUnlimitedIndex()).toEqual({ ok: false, reason: 'invalid' });
    }
  });

  it('missing: 404, HTML, network error', async () => {
    vi.stubGlobal('fetch', reply('', 404));
    expect(await loadUnlimitedIndex()).toEqual({ ok: false, reason: 'missing' });
    vi.stubGlobal('fetch', reply('<html>'));
    expect(await loadUnlimitedIndex()).toEqual({ ok: false, reason: 'missing' });
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('x'))));
    expect(await loadUnlimitedIndex()).toEqual({ ok: false, reason: 'missing' });
  });
});
