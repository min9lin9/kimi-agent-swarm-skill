import { describe, expect, mock, test } from 'bun:test';

import { SerperSearchProvider } from '../src/providers/serper-provider';
import type { UsageMetrics } from '../src/types';

describe('SerperSearchProvider', () => {
  const originalApiKey = process.env.SERPER_API_KEY;
  const originalMock = process.env.SERPER_MOCK;

  function restoreEnv(): void {
    if (originalApiKey === undefined) {
      delete process.env.SERPER_API_KEY;
    } else {
      process.env.SERPER_API_KEY = originalApiKey;
    }
    if (originalMock === undefined) {
      delete process.env.SERPER_MOCK;
    } else {
      process.env.SERPER_MOCK = originalMock;
    }
  }

  test('mock mode returns deterministic sources without an API key', async () => {
    try {
      delete process.env.SERPER_API_KEY;
      process.env.SERPER_MOCK = '1';
      const provider = new SerperSearchProvider('');
      const sources = await provider.search({
        objective: 'test query',
        depth: 'standard',
        maxResults: 5,
      });

      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0].id).toBe('SERPER-001');
      expect(sources[0].discoveredBy).toInclude('serper');
    } finally {
      restoreEnv();
    }
  });

  test('throws when API key is missing and mock mode is disabled', async () => {
    try {
      delete process.env.SERPER_API_KEY;
      delete process.env.SERPER_MOCK;
      const provider = new SerperSearchProvider('');
      await expect(
        provider.search({ objective: 'test', depth: 'standard', maxResults: 5 })
      ).rejects.toThrow('SERPER_API_KEY');
    } finally {
      restoreEnv();
    }
  });

  test('increments usage metrics', async () => {
    try {
      delete process.env.SERPER_API_KEY;
      process.env.SERPER_MOCK = '1';
      const metrics: UsageMetrics = { providerCalls: 0, apiCalls: 0 };
      const provider = new SerperSearchProvider('', metrics);
      await provider.search({ objective: 'metrics test', depth: 'light', maxResults: 5 });

      expect(metrics.providerCalls).toBe(1);
      expect(metrics.apiCalls).toBe(1);
    } finally {
      restoreEnv();
    }
  });

  test('respects maxResults', async () => {
    try {
      delete process.env.SERPER_API_KEY;
      process.env.SERPER_MOCK = '1';
      const provider = new SerperSearchProvider('');
      const sources = await provider.search({
        objective: 'limit test',
        depth: 'standard',
        maxResults: 1,
      });

      expect(sources.length).toBe(1);
    } finally {
      restoreEnv();
    }
  });

  test('retries on fetch failure and propagates timeout error', async () => {
    const originalFetch = global.fetch;
    try {
      delete process.env.SERPER_MOCK;
      process.env.SERPER_API_KEY = 'test-key';

      const fetchMock = mock(() => {
        throw new Error('network failure');
      });
      // @ts-expect-error overriding global fetch for testing
      global.fetch = fetchMock;

      const provider = new SerperSearchProvider('test-key');
      await expect(
        provider.search({ objective: 'retry test', depth: 'standard', maxResults: 5 })
      ).rejects.toThrow('failed after');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    } finally {
      global.fetch = originalFetch;
      restoreEnv();
    }
  });
});
