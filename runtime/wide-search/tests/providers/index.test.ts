import { describe, expect, test } from 'bun:test';

import {
  BraveSearchProvider,
  GitHubSearchProvider,
  MockSearchProvider,
  SerperSearchProvider,
  TavilySearchProvider,
  createSearchProvider,
  getProviderDescriptor,
  listProviderNames,
} from '../../src/providers';

describe('createSearchProvider', () => {
  test('returns correct provider for each known name', () => {
    const cases: Array<{ name: string; expected: unknown }> = [
      { name: 'mock', expected: MockSearchProvider },
      { name: 'serper', expected: SerperSearchProvider },
      { name: 'tavily', expected: TavilySearchProvider },
      { name: 'brave', expected: BraveSearchProvider },
      { name: 'github', expected: GitHubSearchProvider },
    ];

    for (const { name, expected } of cases) {
      const provider = createSearchProvider(name);
      expect(provider).toBeInstanceOf(expected as new (...args: unknown[]) => object);
      expect(provider.name).toBe(name);
    }
  });

  test('unknown provider throws', () => {
    expect(() => createSearchProvider('unknown-provider')).toThrow('Unknown search provider');
  });
});

describe('registry metadata', () => {
  test('listProviderNames matches registry descriptors', () => {
    const names = listProviderNames();
    expect(names).toContain('mock');
    expect(names).toContain('serper');
    expect(names).toContain('tavily');
    expect(names).toContain('brave');
    expect(names).toContain('github');

    for (const name of names) {
      const descriptor = getProviderDescriptor(name);
      expect(descriptor).toBeDefined();
      expect(descriptor?.name).toBe(name);
    }
  });

  test('registry descriptors have required fields', () => {
    for (const name of listProviderNames()) {
      const descriptor = getProviderDescriptor(name);
      expect(descriptor?.factory).toBeDefined();
      expect(descriptor?.pricing).toBeDefined();
      expect(typeof descriptor?.pricing.perCallUsd).toBe('number');
      expect(typeof descriptor?.defaultMaxResults).toBe('number');
    }
  });
});
