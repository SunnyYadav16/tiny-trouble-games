import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_BYTES = 1_000_000;
const MAX_CHARS = 20_000;
const TEXT_TYPES = new Set(['text/html', 'text/plain']);

/** Loopback, private, link-local (incl. cloud metadata), CGNAT, unique-local, unspecified. IPv4-mapped IPv6 is checked against the IPv4 rules. */
const PRIVATE = new BlockList();
for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16]] as const) {
  PRIVATE.addSubnet(net, bits, 'ipv4');
}
for (const [net, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10]] as const) PRIVATE.addSubnet(net, bits, 'ipv6');

/** Resolves a hostname to every address it has. */
export type Lookup = (host: string) => Promise<string[]>;
const systemLookup: Lookup = async (host) => (await dnsLookup(host, { all: true })).map((a) => a.address);

const isPublicAddress = (address: string) => {
  const family = isIP(address);
  return family !== 0 && !PRIVATE.check(address, family === 6 ? 'ipv6' : 'ipv4');
};

async function isAllowed(url: URL, lookup: Lookup): Promise<boolean> {
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.localhost') || isIP(host) !== 0) return false;
  const addresses = await lookup(host);
  return addresses.length > 0 && addresses.every(isPublicAddress);
}

async function readCapped(body: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  let text = '';
  let bytes = 0;
  for await (const chunk of body) {
    text += decoder.decode(chunk.subarray(0, MAX_BYTES - bytes), { stream: true });
    bytes += chunk.length;
    if (bytes >= MAX_BYTES) break; // leaving the loop cancels the stream
  }
  return text + decoder.decode();
}

/** Each pattern ends at its closer or at the end of the text, so a page of unclosed tags stays linear. */
const stripTags = (html: string) =>
  html
    .replace(/<(script|style|noscript)\b[\s\S]*?(<\/\1\s*>|$)/gi, ' ')
    .replace(/<!--[\s\S]*?(-->|$)/g, ' ')
    .replace(/<[^>]*(>|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Trust boundary: the URL comes from a model. Public https pages only, at most
 * 3 redirects (each re-checked), 10 s, 1 MB, text/html or text/plain. Returns
 * the page's text without tags, cut to 20,000 characters, or null.
 */
export async function fetchSourceText(url: string, fetchFn: typeof fetch = fetch, lookup: Lookup = systemLookup): Promise<string | null> {
  try {
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    let current = new URL(url);
    for (let redirects = 0; ; redirects++) {
      // ponytail: DNS is checked here and resolved again by fetch (rebinding TOCTOU); pin the checked address in a custom dispatcher if this ever runs next to private services.
      if (!(await isAllowed(current, lookup))) return null;
      const res = await fetchFn(current, { redirect: 'manual', signal });
      const location = res.headers.get('location');
      const type = res.headers.get('content-type')?.split(';')[0]!.trim().toLowerCase() ?? '';
      if (res.status >= 300 && res.status < 400 && location !== null && redirects < MAX_REDIRECTS) {
        await res.body?.cancel();
        current = new URL(location, current);
        continue;
      }
      if (res.status !== 200 || !TEXT_TYPES.has(type) || !res.body) {
        await res.body?.cancel();
        return null;
      }
      return stripTags(await readCapped(res.body)).slice(0, MAX_CHARS);
    }
  } catch {
    return null;
  }
}
