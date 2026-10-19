import { describe, expect, it, vi } from 'vitest';
import { fetchSourceText } from './source';

const PUBLIC = async () => ['93.184.216.34'];
const page = (body: ConstructorParameters<typeof Response>[0], init: ResponseInit = {}) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });
/** A fetch stub answering each call with the next response; never touches the network. */
const stub = (...responses: Response[]) => vi.fn<typeof fetch>(async () => responses.shift()!);

describe('fetchSourceText', () => {
  it.each(['http://example.com/mango', 'https://localhost/mango', 'https://127.0.0.1/mango', 'https://[::1]/mango', 'not a url'])(
    'refuses %s without fetching',
    async (url) => {
      const fetchFn = stub(page('MANGO'));
      expect(await fetchSourceText(url, fetchFn, PUBLIC)).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it.each([
    ...['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1'],
    // NAT64, IPv4-compatible, site-local, 6to4, and the reserved 240/4 with broadcast.
    ...['64:ff9b::7f00:1', '::7f00:1', 'fec0::1', '2002:7f00:1::1', '240.0.0.1', '255.255.255.255'],
  ])(
    'refuses a hostname resolving to %s',
    async (address) => {
      const fetchFn = stub(page('MANGO'));
      expect(await fetchSourceText('https://example.com/', fetchFn, async () => ['93.184.216.34', address])).toBeNull();
      expect(fetchFn).not.toHaveBeenCalled();
    },
  );

  it('returns tag-stripped text capped at 20,000 characters', async () => {
    const html = `<html><head><style>p { color: red }</style><script>var x = "<p>";</script></head><body><p>Mango <b>tree</b></p>${'<p>fruit</p>'.repeat(5000)}</body></html>`;
    const fetchFn = stub(page(html));
    const text = await fetchSourceText('https://example.com/mango', fetchFn, PUBLIC);
    expect(text).toHaveLength(20_000);
    expect(text!.startsWith('Mango tree fruit fruit')).toBe(true);
    expect(text).not.toMatch(/[<>]|color|var x/);
    expect(fetchFn).toHaveBeenCalledWith(new URL('https://example.com/mango'), expect.objectContaining({ redirect: 'manual' }));
  });

  it('stops reading a body after 1 MB', async () => {
    const endless = new ReadableStream<Uint8Array>({ pull: (c) => c.enqueue(new TextEncoder().encode('mango '.repeat(10_000))) });
    expect(await fetchSourceText('https://example.com/', stub(page(endless)), PUBLIC)).toHaveLength(20_000);
  });

  it('returns null on a non-200, a non-text type, or a thrown fetch', async () => {
    expect(await fetchSourceText('https://example.com/', stub(page('MANGO', { status: 404 })), PUBLIC)).toBeNull();
    const pdf = page('MANGO', { headers: { 'content-type': 'application/pdf' } });
    expect(await fetchSourceText('https://example.com/', stub(pdf), PUBLIC)).toBeNull();
    const throwing = vi.fn<typeof fetch>(async () => Promise.reject(new Error('network down')));
    expect(await fetchSourceText('https://example.com/', throwing, PUBLIC)).toBeNull();
    expect(await fetchSourceText('https://example.com/', stub(page('MANGO')), async () => Promise.reject(new Error('ENOTFOUND')))).toBeNull();
  });

  it('accepts text/plain', async () => {
    const plain = page('A mango is a fruit.', { headers: { 'content-type': 'text/plain' } });
    expect(await fetchSourceText('https://example.com/', stub(plain), PUBLIC)).toBe('A mango is a fruit.');
  });

  it('follows up to 3 redirects, checking each target', async () => {
    const hops = [redirect('/a'), redirect('https://other.example/b'), redirect('c'), page('mango')];
    const fetchFn = stub(...hops);
    expect(await fetchSourceText('https://example.com/start', fetchFn, PUBLIC)).toBe('mango');
    expect(fetchFn.mock.calls.map(([url]) => String(url))).toEqual([
      'https://example.com/start',
      'https://example.com/a',
      'https://other.example/b',
      'https://other.example/c',
    ]);

    const tooMany = stub(redirect('/1'), redirect('/2'), redirect('/3'), redirect('/4'), page('mango'));
    expect(await fetchSourceText('https://example.com/', tooMany, PUBLIC)).toBeNull();
    expect(tooMany).toHaveBeenCalledTimes(4);
  });

  it('refuses a redirect to a private address or to http', async () => {
    for (const location of ['https://169.254.169.254/latest/meta-data/', 'http://example.com/']) {
      const fetchFn = stub(redirect(location), page('mango'));
      expect(await fetchSourceText('https://example.com/', fetchFn, PUBLIC)).toBeNull();
      expect(fetchFn).toHaveBeenCalledTimes(1);
    }
  });
});
