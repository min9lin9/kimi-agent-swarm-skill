import { describe, expect, test } from 'bun:test';

import { renderMarkdownSynthesis } from '../src/markdown';
import type { Claim, EnrichedSource, Run, VerificationReport } from '../src/types';

const baseRun: Run = {
  runId: '2026-01-01T12-00-00-000Z-abc123',
  objective: 'Strict markdown objective',
  executionProfile: 'fixture',
  status: 'completed',
  createdAt: '2026-01-01T12:00:00.000Z',
  usageMetrics: { providerCalls: 1, apiCalls: 1 },
};

const baseSource: EnrichedSource = {
  id: 'S001',
  url: 'https://example.com/source-1',
  title: 'Strict source',
  sourceClass: 'primary-analysis',
  discoveredBy: 'test',
  decision: 'accepted',
  reason: 'meets threshold',
  scores: {
    relevance: 0.95,
    authority: 0.88,
    freshness: 0.75,
    diversity: 0.6,
    extractionValue: 0.82,
  },
  claims: ['claim one'],
  publishedAt: '2026-01-01',
};

const baseVerification: VerificationReport = {
  status: 'passed',
  acceptedSources: 1,
  rejectedSources: 0,
  unsupportedClaims: 0,
  staleClaims: 0,
  unknownFreshnessClaims: 0,
  lowConfidenceClaims: 0,
  duplicateClaimGroups: [],
  conflictingClaimPairs: [],
  coverageGaps: [],
  failures: [],
  warnings: [],
};

describe('renderMarkdownSynthesis strict claims', () => {
  test('renders only verified high-risk claims as definitive in strict mode', () => {
    const claims: readonly Claim[] = [
      {
        id: 'C001',
        claim: 'Verified high-risk claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
        risk: 'high',
      },
      {
        id: 'C002',
        claim: 'Unresolved high-risk claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
        risk: 'high',
      },
      {
        id: 'C003',
        claim: 'Refuted high-risk claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
        risk: 'high',
      },
      {
        id: 'C004',
        claim: 'Unclassified fallback claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
      },
    ];
    const verification: VerificationReport = {
      ...baseVerification,
      status: 'failed',
      failures: ['unresolved strict claims: C002'],
      strictClaims: {
        enabled: true,
        verified: 1,
        unresolved: 1,
        refuted: 1,
        verifiedClaimIds: ['C001'],
        unresolvedClaimIds: ['C002'],
        refutedClaimIds: ['C003'],
      },
    };

    const markdown = renderMarkdownSynthesis({
      run: baseRun,
      profile: 'fixture',
      sources: [baseSource],
      claims: [...claims],
      verification,
    });

    const definitiveClaims = markdown.slice(
      markdown.indexOf('## Claims'),
      markdown.indexOf('## Verification details')
    );
    expect(definitiveClaims).toInclude('Verified high-risk claim');
    expect(definitiveClaims).not.toInclude('Unresolved high-risk claim');
    expect(definitiveClaims).not.toInclude('Refuted high-risk claim');
    expect(definitiveClaims).not.toInclude('Unclassified fallback claim');
    expect(markdown).toInclude('Strict claim artifacts');
  });
});
