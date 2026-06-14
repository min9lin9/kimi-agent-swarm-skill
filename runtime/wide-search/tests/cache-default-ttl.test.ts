import { describe, expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type CacheEntry,
  cacheKeyHash,
  clearCache,
  getCacheDir,
  getCachedSources,
  setCachedSources,
} from '../src/cache';
import type { CacheKey, Source } from '../src/types';

describe('cache default TTL', () => {
  const key: CacheKey = {
    provider: 'tavily',
    objective: 'default ttl test',
    depth: 'standard',
    maxResults: 10,
  };

  const sources: Source[] = [
    {
      id: 'TTL-001',
      url: 'https://example.com/ttl',
      title: 'TTL test',
      sourceClass: 'primary',
      publishedAt: new Date().toISOString().split('T')[0],
      discoveredBy: 'test',
      scores: { relevance: 5, authority: 4 },
    },
  ];

  test('default TTL returns cached entry immediately', async () => {
    await clearCache();
    await setCachedSources(key, sources);

    const cached = await getCachedSources(key);
    expect(cached).toBeDefined();
    expect(cached?.[0].id).toBe('TTL-001');
  });

  test('default TTL expires entry older than 7 days', async () => {
    await clearCache();
    const cacheDir = getCacheDir();
    await mkdir(cacheDir, { recursive: true });
    const oldEntry: CacheEntry = {
      sources,
      cachedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await writeFile(join(cacheDir, `${cacheKeyHash(key)}.json`), `${JSON.stringify(oldEntry)}\n`);

    const cached = await getCachedSources(key);
    expect(cached).toBeUndefined();
  });

  test('default TTL keeps entry within 7 days', async () => {
    await clearCache();
    await setCachedSources(key, sources);

    const cached = await getCachedSources(key);
    expect(cached).toBeDefined();
    expect(cached?.[0].id).toBe('TTL-001');
  });
});
