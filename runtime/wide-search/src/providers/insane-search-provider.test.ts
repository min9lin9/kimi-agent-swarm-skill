import { afterEach, describe, expect, test } from 'bun:test';

import type { UsageMetrics } from '../types';
import { InsaneSearchProvider } from './insane-search-provider';

const INSANE_SEARCH_ENV_KEYS = [
  'INSANE_SEARCH_MOCK',
  'INSANE_SEARCH_URLS',
  'INSANE_SEARCH_COMMAND',
  'INSANE_SEARCH_ARGS',
  'INSANE_SEARCH_CWD',
  'INSANE_SEARCH_TIMEOUT_MS',
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  INSANE_SEARCH_ENV_KEYS.map((key) => [key, process.env[key]])
) as Record<(typeof INSANE_SEARCH_ENV_KEYS)[number], string | undefined>;

afterEach(() => {
  for (const key of INSANE_SEARCH_ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
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
