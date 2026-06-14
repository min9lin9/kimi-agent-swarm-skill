import { describe, expect, test } from 'bun:test';

import { goldenAnswers } from '../fixtures/golden-answers';
import { runBenchmark } from '../src/benchmark';
import type { GoldenAnswer } from '../src/types';

describe('runBenchmark', () => {
  test('fixture-paul-graham-corpus scores above threshold', async () => {
    const golden = goldenAnswers['fixture-paul-graham-corpus'];
    const result = await runBenchmark('fixture-paul-graham-corpus', golden);

    expect(result.profile).toBe('fixture-paul-graham-corpus');
    expect(result.precision).toBeGreaterThan(0);
    expect(result.recall).toBeGreaterThan(0);
    expect(result.citationAccuracy).toBe(1);
    expect(result.f1).toBeGreaterThan(0);
    expect(result.urlCoverage).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
    expect(result.urlCoverage).toBeGreaterThanOrEqual(0.5);
  });

  test('fixture-github-repo-landscape scores above threshold', async () => {
    const golden = goldenAnswers['fixture-github-repo-landscape'];
    const result = await runBenchmark('fixture-github-repo-landscape', golden);

    expect(result.profile).toBe('fixture-github-repo-landscape');
    expect(result.precision).toBeGreaterThan(0);
    expect(result.recall).toBeGreaterThan(0);
    expect(result.citationAccuracy).toBe(1);
    expect(result.f1).toBeGreaterThan(0);
    expect(result.urlCoverage).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
    expect(result.urlCoverage).toBeGreaterThanOrEqual(0.5);
  });

  test('fixture-market-scan scores above threshold', async () => {
    const golden = goldenAnswers['fixture-market-scan'];
    const result = await runBenchmark('fixture-market-scan', golden);

    expect(result.profile).toBe('fixture-market-scan');
    expect(result.precision).toBeGreaterThan(0);
    expect(result.recall).toBeGreaterThan(0);
    expect(result.citationAccuracy).toBe(1);
    expect(result.f1).toBeGreaterThan(0);
    expect(result.urlCoverage).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
    expect(result.urlCoverage).toBeGreaterThanOrEqual(0.5);
  });

  test('fixture-youtube-niche scores above threshold', async () => {
    const golden = goldenAnswers['fixture-youtube-niche'];
    const result = await runBenchmark('fixture-youtube-niche', golden);

    expect(result.profile).toBe('fixture-youtube-niche');
    expect(result.precision).toBeGreaterThan(0);
    expect(result.recall).toBeGreaterThan(0);
    expect(result.citationAccuracy).toBe(1);
    expect(result.f1).toBeGreaterThan(0);
    expect(result.urlCoverage).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
    expect(result.urlCoverage).toBeGreaterThanOrEqual(0.5);
  });
});
