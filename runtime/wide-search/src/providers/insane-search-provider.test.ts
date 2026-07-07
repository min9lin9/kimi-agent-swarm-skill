import { afterEach, describe, expect, test } from 'bun:test';

import type { UsageMetrics } from '../types';
import { InsaneSearchProvider } from './insane-search-provider';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('InsaneSearchProvider', () => {
  test('returns deterministic mock sources without external command calls', async () => {
    process.env.INSANE_SEARCH_MOCK = '1';
    const metrics: UsageMetrics = { providerCalls: 0, apiCalls: 0 };
    const provider = new InsaneSearchProvider('', metrics);

    const sources = await provider.search({
      objective: 'Read https://example.com/public-page',
      depth: 'light',
      maxResults: 10,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe('INSANE-001');
    expect(sources[0].discoveredBy).toBe('insane-search-provider-mock');
    expect(metrics.providerCalls).toBe(1);
    expect(metrics.apiCalls).toBe(1);
  });

  test('requires a public URL outside mock mode', async () => {
    delete process.env.INSANE_SEARCH_MOCK;
    delete process.env.INSANE_SEARCH_URLS;
    const provider = new InsaneSearchProvider();

    await expect(
      provider.search({ objective: 'keyword-only query', depth: 'light', maxResults: 10 })
    ).rejects.toThrow('requires at least one public URL');
  });
});
