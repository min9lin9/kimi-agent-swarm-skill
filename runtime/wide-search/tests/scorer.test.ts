import { describe, expect, test } from 'bun:test';
import { calculateWeightedScore, scoreSource } from '../src/scorer';
import type { Source } from '../src/types';

describe('scorer', () => {
  test('high authority domain gets bonus', () => {
    const source: Source = {
      id: 'S001',
      url: 'https://github.com/browser-use/browser-use',
      title: 'Browser Use',
      sourceClass: 'primary',
      publishedAt: '2026-06-12',
      discoveredBy: 'test',
      scores: { relevance: 5, authority: 3, freshness: 4, diversity: 3, extractionValue: 4 },
    };

    const score = calculateWeightedScore(source);
    expect(score).toBeGreaterThan(3.5);
  });

  test('stale source receives penalty', () => {
    const fresh: Source = {
      id: 'S001',
      url: 'https://example.com/fresh',
      title: 'Fresh',
      sourceClass: 'secondary',
      publishedAt: '2026-06-12',
      discoveredBy: 'test',
      scores: { relevance: 4, authority: 3, freshness: 4, diversity: 3, extractionValue: 3 },
    };
    const stale: Source = {
      ...fresh,
      url: 'https://example.com/stale',
      publishedAt: '2022-01-01',
    };

    const freshScore = calculateWeightedScore(fresh);
    const staleScore = calculateWeightedScore(stale);
    expect(staleScore).toBeLessThan(freshScore);
  });

  test('rejects low relevance source', () => {
    const source: Source = {
      id: 'S001',
      url: 'https://example.com/bad',
      title: 'Bad',
      sourceClass: 'secondary',
      publishedAt: '2026-06-12',
      discoveredBy: 'test',
      scores: { relevance: 1, authority: 5, freshness: 5, diversity: 3, extractionValue: 3 },
    };

    const enriched = scoreSource(source);
    expect(enriched.decision).toBe('rejected');
    expect(enriched.reason).toInclude('low relevance');
  });

  test('accepts balanced source', () => {
    const source: Source = {
      id: 'S001',
      url: 'https://example.com/good',
      title: 'Good',
      sourceClass: 'primary',
      publishedAt: '2026-06-12',
      discoveredBy: 'test',
      scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
    };

    const enriched = scoreSource(source);
    expect(enriched.decision).toBe('accepted');
  });
});
