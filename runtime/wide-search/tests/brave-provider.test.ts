import { describe, expect, test } from 'bun:test';

import { BraveSearchProvider } from '../src/providers/brave-provider';
import type { UsageMetrics } from '../src/types';

describe('BraveSearchProvider', () => {
  test('mock mode returns deterministic sources without an API key', async () => {
    process.env.BRAVE_MOCK = '1';
    const provider = new BraveSearchProvider('');
    const sources = await provider.search({
      objective: 'test query',
      depth: 'standard',
      maxResults: 5,
    });

    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].id).toBe('BRAVE-001');
    expect(sources[0].discoveredBy).toInclude('brave');

    delete process.env.BRAVE_MOCK;
  });

  test('throws when API key is missing and mock mode is disabled', async () => {
    delete process.env.BRAVE_MOCK;
    const provider = new BraveSearchProvider('');
    await expect(
      provider.search({ objective: 'test', depth: 'standard', maxResults: 5 })
    ).rejects.toThrow('BRAVE_API_KEY');
  });

  test('increments usage metrics', async () => {
    process.env.BRAVE_MOCK = '1';
    const metrics: UsageMetrics = { providerCalls: 0, apiCalls: 0 };
    const provider = new BraveSearchProvider('', metrics);
    await provider.search({ objective: 'metrics test', depth: 'light', maxResults: 5 });

    expect(metrics.providerCalls).toBe(1);
    expect(metrics.apiCalls).toBe(1);

    delete process.env.BRAVE_MOCK;
  });

  test('respects maxResults', async () => {
    process.env.BRAVE_MOCK = '1';
    const provider = new BraveSearchProvider('');
    const sources = await provider.search({
      objective: 'limit test',
      depth: 'standard',
      maxResults: 1,
    });

    expect(sources.length).toBe(1);

    delete process.env.BRAVE_MOCK;
  });
});
