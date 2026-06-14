import { describe, expect, test } from 'bun:test';

import { GitHubSearchProvider } from '../src/providers/github-provider';
import type { UsageMetrics } from '../src/types';

describe('GitHubSearchProvider', () => {
  test('mock mode returns deterministic sources without a token', async () => {
    process.env.GITHUB_MOCK = '1';
    const provider = new GitHubSearchProvider('');
    const sources = await provider.search({
      objective: 'test query',
      depth: 'standard',
      maxResults: 5,
    });

    expect(sources.length).toBeGreaterThan(0);
    expect(sources[0].id).toBe('GITHUB-001');
    expect(sources[0].discoveredBy).toInclude('github');
    expect(sources[0].sourceClass).toBe('primary');

    delete process.env.GITHUB_MOCK;
  });

  test('throws when token is missing and mock mode is disabled', async () => {
    delete process.env.GITHUB_MOCK;
    const provider = new GitHubSearchProvider('');
    await expect(
      provider.search({ objective: 'test', depth: 'standard', maxResults: 5 })
    ).rejects.toThrow('GITHUB_TOKEN');
  });

  test('increments usage metrics', async () => {
    process.env.GITHUB_MOCK = '1';
    const metrics: UsageMetrics = { providerCalls: 0, apiCalls: 0 };
    const provider = new GitHubSearchProvider('', metrics);
    await provider.search({ objective: 'metrics test', depth: 'light', maxResults: 5 });

    expect(metrics.providerCalls).toBe(1);
    expect(metrics.apiCalls).toBe(1);

    delete process.env.GITHUB_MOCK;
  });

  test('respects maxResults', async () => {
    process.env.GITHUB_MOCK = '1';
    const provider = new GitHubSearchProvider('');
    const sources = await provider.search({
      objective: 'limit test',
      depth: 'standard',
      maxResults: 1,
    });

    expect(sources.length).toBe(1);

    delete process.env.GITHUB_MOCK;
  });
});
