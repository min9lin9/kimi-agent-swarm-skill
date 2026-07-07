import { describe, expect, test } from 'bun:test';

import {
  PublicReaderProvider,
  isPublicInternetIp,
  validatePublicReaderUrl,
} from '../../src/providers/public-reader';

const standardSearch = { depth: 'standard', maxResults: 5 } as const;
const publicHostnameOptions = { resolver: async () => ['93.184.216.34'], allowHostnames: true };

describe('validatePublicReaderUrl', () => {
  test('rejects non-http protocols and private network targets', async () => {
    const resolver = async () => ['203.0.113.10'];

    expect(await validatePublicReaderUrl('file:///tmp/source.txt', resolver)).toEqual({
      ok: false,
      reason: 'unsupported_protocol',
    });
    expect(await validatePublicReaderUrl('http://127.0.0.1/admin', resolver)).toEqual({
      ok: false,
      reason: 'private_address',
    });
    expect(
      await validatePublicReaderUrl('http://169.254.169.254/latest/meta-data', resolver)
    ).toEqual({
      ok: false,
      reason: 'private_address',
    });
    expect(await validatePublicReaderUrl('https://user:pass@example.com/', resolver)).toEqual({
      ok: false,
      reason: 'userinfo_not_supported',
    });
  });

  test('revalidates DNS answers before fetching hostnames', async () => {
    const resolver = async () => ['10.0.0.7'];

    expect(
      await validatePublicReaderUrl('https://example.com/page', resolver, { allowHostnames: true })
    ).toEqual({
      ok: false,
      reason: 'private_address',
    });
  });

  test('rejects hostname fetches by default to avoid DNS rebinding', async () => {
    const resolver = async () => ['93.184.216.34'];

    expect(await validatePublicReaderUrl('https://example.com/page', resolver)).toEqual({
      ok: false,
      reason: 'hostname_not_supported',
    });
  });

  test('accepts hostname fetches only with explicit opt-in', async () => {
    const resolver = async () => ['93.184.216.34'];

    expect(
      await validatePublicReaderUrl('https://example.com/page', resolver, { allowHostnames: true })
    ).toEqual({
      ok: true,
      url: new URL('https://example.com/page'),
    });
  });

  test('rejects blocked hostnames even with opt-in', async () => {
    const resolver = async () => ['93.184.216.34'];

    for (const url of ['https://printer.local/status', 'http://metadata.google.internal/']) {
      expect(await validatePublicReaderUrl(url, resolver, { allowHostnames: true })).toEqual({
        ok: false,
        reason: 'blocked_host',
      });
    }
  });
});

describe('isPublicInternetIp', () => {
  test('accepts public IPs and rejects local or reserved IPs', () => {
    expect(isPublicInternetIp('93.184.216.34')).toBe(true);
    expect(isPublicInternetIp('8.8.8.8')).toBe(true);
    expect(isPublicInternetIp('127.0.0.1')).toBe(false);
    expect(isPublicInternetIp('10.1.2.3')).toBe(false);
    expect(isPublicInternetIp('172.16.0.1')).toBe(false);
    expect(isPublicInternetIp('192.168.1.1')).toBe(false);
    expect(isPublicInternetIp('::1')).toBe(false);
    expect(isPublicInternetIp('::ffff:127.0.0.1')).toBe(false);
    expect(isPublicInternetIp('::ffff:10.0.0.1')).toBe(false);
    expect(isPublicInternetIp('::ffff:93.184.216.34')).toBe(true);
  });

  test('rejects IPv4-mapped IPv6 URLs after URL canonicalization', async () => {
    const resolver = async () => ['93.184.216.34'];

    expect(await validatePublicReaderUrl('http://[::ffff:127.0.0.1]/', resolver)).toEqual({
      ok: false,
      reason: 'private_address',
    });
    expect(await validatePublicReaderUrl('http://[::ffff:169.254.169.254]/', resolver)).toEqual({
      ok: false,
      reason: 'private_address',
    });
  });
});

describe('PublicReaderProvider', () => {
  test('does not fetch hostnames without explicit opt-in', async () => {
    const fetchedUrls: string[] = [];
    const provider = new PublicReaderProvider({
      resolver: async () => ['93.184.216.34'],
      fetcher: async (url) => {
        fetchedUrls.push(url);
        return new Response('should not fetch');
      },
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/research-note for evidence',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchedUrls).toEqual([]);
  });

  test('reads explicit public HTTP hostnames through the validated IP endpoint', async () => {
    const fetchedUrls: string[] = [];
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      fetcher: async (url, init) => {
        fetchedUrls.push(url);
        expect(new Headers(init.headers).get('host')).toBe('example.com');
        return new Response(
          '<html><head><title>Example title</title></head><body>Public text.</body></html>',
          {
            headers: { 'content-type': 'text/html' },
            status: 200,
          }
        );
      },
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/research-note for evidence',
      ...standardSearch,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.id).toBe('PUBLIC-001');
    expect(sources[0]?.url).toBe('http://example.com/research-note');
    expect(sources[0]?.title).toBe('Example title');
    expect(sources[0]?.discoveredBy).toBe('public-reader');
    expect(sources[0]?.claims).toContain('Public text.');
    expect(fetchedUrls).toEqual(['http://93.184.216.34/research-note']);
  });

  test('fails closed for explicit HTTPS hostnames because IP fetch cannot preserve TLS host verification', async () => {
    const fetchedUrls: string[] = [];
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      fetcher: async (url) => {
        fetchedUrls.push(url);
        return new Response('should not fetch');
      },
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/research-note for evidence',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchedUrls).toEqual([]);
  });

  test('revalidates hostname DNS immediately before fetch and blocks rebinding', async () => {
    const resolvedAddresses = ['93.184.216.34', '10.0.0.7'];
    const fetchedUrls: string[] = [];
    const provider = new PublicReaderProvider({
      resolver: async () => [resolvedAddresses.shift() ?? '10.0.0.7'],
      allowHostnames: true,
      fetcher: async (url) => {
        fetchedUrls.push(url);
        return new Response('should not fetch');
      },
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/research-note for evidence',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchedUrls).toEqual([]);
  });

  test('does not fetch auth walls or private redirect targets', async () => {
    const fetchedUrls: string[] = [];
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      fetcher: async (url) => {
        fetchedUrls.push(url);
        return new Response('', {
          headers: { location: 'http://127.0.0.1/internal' },
          status: 302,
        });
      },
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/redirect',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchedUrls).toEqual(['http://93.184.216.34/redirect']);
  });

  test('does not fetch private DNS answers after opt-in', async () => {
    const fetchedUrls: string[] = [];
    const provider = new PublicReaderProvider({
      resolver: async () => ['10.0.0.7'],
      allowHostnames: true,
      fetcher: async (url) => {
        fetchedUrls.push(url);
        return new Response('should not fetch');
      },
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/private-dns',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchedUrls).toEqual([]);
  });

  test('does not fetch past redirect loops', async () => {
    const fetchedUrls: string[] = [];
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      maxRedirects: 1,
      fetcher: async (url) => {
        fetchedUrls.push(url);
        return new Response('', {
          headers: { location: 'http://example.com/redirect' },
          status: 302,
        });
      },
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/redirect',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchedUrls).toEqual(['http://93.184.216.34/redirect', 'http://93.184.216.34/redirect']);
  });

  test('drops auth walls without returning a source', async () => {
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      fetcher: async () => new Response('sign in to continue', { status: 200 }),
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/auth-wall',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
  });

  test('drops oversized responses without buffering them as sources', async () => {
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      maxBytes: 8,
      fetcher: async () => new Response('this response is too large'),
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/large',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
  });
});
