import { describe, expect, test } from 'bun:test';

import { cacheKeyHash, clearCache, getCachedSources, setCachedSources } from '../src/cache';
import type { CacheKey, Source } from '../src/types';

describe('cache', () => {
  const key: CacheKey = {
    provider: 'tavily',
    objective: 'AI browser agents',
    depth: 'standard',
    maxResults: 10,
  };

  const sources: Source[] = [
    {
      id: 'T-001',
      url: 'https://example.com/1',
      title: 'Example 1',
      sourceClass: 'primary',
      publishedAt: '2026-01-01',
      discoveredBy: 'test',
      scores: { relevance: 5, authority: 4 },
    },
  ];

  test('set and get cached sources', async () => {
    await clearCache();
    await setCachedSources(key, sources);
    const cached = await getCachedSources(key);

    expect(cached).toBeDefined();
    expect(cached?.length).toBe(1);
    expect(cached?.[0].id).toBe('T-001');
  });

  test('cache key hash is deterministic', () => {
    const hash1 = cacheKeyHash(key);
    const hash2 = cacheKeyHash(key);
    expect(hash1).toBe(hash2);
  });

  test('cache key hash differs for different keys', () => {
    const hash1 = cacheKeyHash(key);
    const hash2 = cacheKeyHash({ ...key, maxResults: 20 });
    expect(hash1).not.toBe(hash2);
  });

  test('cache miss returns undefined', async () => {
    await clearCache();
    const cached = await getCachedSources({
      provider: 'brave',
      objective: 'nonexistent query',
      depth: 'light',
      maxResults: 5,
    });
    expect(cached).toBeUndefined();
  });

  test('cache respects TTL', async () => {
    await clearCache();
    await setCachedSources(key, sources);
    const cached = await getCachedSources(key, -1); // expired
    expect(cached).toBeUndefined();
  });
});
