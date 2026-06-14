import { afterEach, describe, expect, mock, test } from 'bun:test';

import { FetchTimeoutError, fetchWithRetry } from '../../src/providers/fetch-utils';

describe('fetchWithRetry', () => {
  let server: ReturnType<typeof Bun.serve> | undefined;

  afterEach(() => {
    server?.stop();
    server = undefined;
  });

  test('successful fetch returns response', async () => {
    server = Bun.serve({
      port: 0,
      fetch: () => new Response('ok', { status: 200 }),
    });

    const result = await fetchWithRetry(`${server.url}test`);
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('ok');
  });

  test('timeout throws FetchTimeoutError', async () => {
    server = Bun.serve({
      port: 0,
      fetch: () => new Promise<Response>(() => {}),
    });

    await expect(
      fetchWithRetry(`${server.url}slow`, { timeoutMs: 50, retryDelayMs: 10 })
    ).rejects.toBeInstanceOf(FetchTimeoutError);
  });

  test('retries on failure with exponential backoff and eventually succeeds', async () => {
    // Network failures (rejected promises) are retried; non-2xx responses are not.
    const originalFetch = global.fetch;
    let calls = 0;

    try {
      // @ts-expect-error overriding global fetch for testing
      global.fetch = mock(() => {
        calls += 1;
        if (calls < 3) {
          throw new Error(`network error ${calls}`);
        }
        return Promise.resolve(new Response('success', { status: 200 }));
      });

      const result = await fetchWithRetry('http://localhost/flaky', {
        retries: 3,
        retryDelayMs: 5,
      });
      expect(result.status).toBe(200);
      expect(calls).toBe(3);
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('non-2xx responses are returned and not retried', async () => {
    let calls = 0;
    server = Bun.serve({
      port: 0,
      fetch: () => {
        calls += 1;
        return new Response('not found', { status: 404 });
      },
    });

    const result = await fetchWithRetry(`${server.url}missing`);
    expect(result.status).toBe(404);
    expect(calls).toBe(1);
  });
});
