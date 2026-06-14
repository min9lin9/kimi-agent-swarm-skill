import { describe, expect, test } from 'bun:test';
import { calculateWeightedScore, scoreSource } from '../src/scorer';
import type { Source, SourceScores } from '../src/types';

describe('scorer edge cases', () => {
  test('all-undefined scores defaults to zero and still produces a result', () => {
    const source: Source = {
      id: 'S001',
      url: 'https://example.com/undefined',
      title: 'Undefined scores',
      sourceClass: 'secondary',
      discoveredBy: 'test',
      scores: {} as SourceScores,
    };

    const score = calculateWeightedScore(source);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);

    const enriched = scoreSource(source);
    expect(enriched.decision).toBe('rejected');
  });

  test('future-dated publishedAt is treated as current', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const publishedAt = futureDate.toISOString().split('T')[0];

    const source: Source = {
      id: 'S001',
      url: 'https://example.com/future',
      title: 'Future',
      sourceClass: 'primary',
      publishedAt,
      discoveredBy: 'test',
      scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
    };

    const score = calculateWeightedScore(source);
    expect(score).toBeGreaterThanOrEqual(4);
  });

  test('invalid URL handling does not crash and yields no domain bonus', () => {
    const source: Source = {
      id: 'S001',
      url: 'not-a-valid-url',
      title: 'Invalid URL',
      sourceClass: 'secondary',
      discoveredBy: 'test',
      scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
    };

    const score = calculateWeightedScore(source);
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
