import { describe, expect, test } from 'bun:test';

import { PublicReaderProvider } from '../../src/providers/public-reader';

const standardSearch = { depth: 'standard', maxResults: 5 } as const;
const publicHostnameOptions = { resolver: async () => ['93.184.216.34'], allowHostnames: true };

function recordFetch(response: Response) {
  const fetchedUrls: string[] = [];
  return {
    fetchedUrls,
    fetcher: async (url: string) => {
      fetchedUrls.push(url);
      return response;
    },
  };
}

describe('PublicReaderProvider', () => {
  test('does not fetch hostnames without explicit opt-in', async () => {
    const fetchLog = recordFetch(new Response('should not fetch'));
    const provider = new PublicReaderProvider({
      resolver: async () => ['93.184.216.34'],
      fetcher: fetchLog.fetcher,
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/research-note for evidence',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchLog.fetchedUrls).toEqual([]);
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
    const fetchLog = recordFetch(new Response('should not fetch'));
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      fetcher: fetchLog.fetcher,
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/research-note for evidence',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchLog.fetchedUrls).toEqual([]);
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
    const fetchLog = recordFetch(
      new Response('', {
        headers: { location: 'http://127.0.0.1/internal' },
        status: 302,
      })
    );
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      fetcher: fetchLog.fetcher,
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/redirect',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchLog.fetchedUrls).toEqual(['http://93.184.216.34/redirect']);
  });

  test('does not fetch private DNS answers after opt-in', async () => {
    const fetchLog = recordFetch(new Response('should not fetch'));
    const provider = new PublicReaderProvider({
      resolver: async () => ['10.0.0.7'],
      allowHostnames: true,
      fetcher: fetchLog.fetcher,
    });

    const sources = await provider.search({
      objective: 'Read https://example.com/private-dns',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchLog.fetchedUrls).toEqual([]);
  });

  test('does not fetch past redirect loops', async () => {
    const fetchLog = recordFetch(
      new Response('', {
        headers: { location: 'http://example.com/redirect' },
        status: 302,
      })
    );
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      maxRedirects: 1,
      fetcher: fetchLog.fetcher,
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/redirect',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchLog.fetchedUrls).toEqual([
      'http://93.184.216.34/redirect',
      'http://93.184.216.34/redirect',
    ]);
  });

  test('drops auth walls without returning a source', async () => {
    const fetchLog = recordFetch(new Response('sign in to continue', { status: 200 }));
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      fetcher: fetchLog.fetcher,
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/auth-wall',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchLog.fetchedUrls).toEqual(['http://93.184.216.34/auth-wall']);
  });

  test('drops oversized responses without buffering them as sources', async () => {
    const fetchLog = recordFetch(new Response('this response is too large'));
    const provider = new PublicReaderProvider({
      ...publicHostnameOptions,
      maxBytes: 8,
      fetcher: fetchLog.fetcher,
    });

    const sources = await provider.search({
      objective: 'Read http://example.com/large',
      ...standardSearch,
    });

    expect(sources).toEqual([]);
    expect(fetchLog.fetchedUrls).toEqual(['http://93.184.216.34/large']);
  });
});
