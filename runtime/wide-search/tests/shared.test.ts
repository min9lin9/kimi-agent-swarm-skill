import { describe, expect, test } from 'bun:test';

import { extractClaims } from '../src/shared';
import type { EnrichedSource } from '../src/types';

describe('extractClaims', () => {
  test('extracts claims only from accepted sources and renumbers sequentially', () => {
    const sources: EnrichedSource[] = [
      {
        id: 'S001',
        url: 'https://example.com/accepted',
        title: 'Accepted',
        sourceClass: 'primary',
        discoveredBy: 'test',
        decision: 'accepted',
        reason: 'meets threshold',
        scores: { relevance: 4, authority: 4 },
        claims: ['Claim one', 'Claim two'],
      },
      {
        id: 'S002',
        url: 'https://example.com/rejected',
        title: 'Rejected',
        sourceClass: 'secondary',
        discoveredBy: 'test',
        decision: 'rejected',
        reason: 'low value',
        scores: { relevance: 1, authority: 1 },
        claims: ['Ignored claim'],
      },
    ];

    const claims = extractClaims(sources);
    expect(claims).toHaveLength(2);
    expect(claims[0].id).toBe('C001');
    expect(claims[0].claim).toBe('Claim one');
    expect(claims[0].sourceIds).toEqual(['S001']);
    expect(claims[1].id).toBe('C002');
    expect(claims[1].claim).toBe('Claim two');
  });

  test('returns an empty array when no sources are accepted', () => {
    const sources: EnrichedSource[] = [
      {
        id: 'S001',
        url: 'https://example.com/rejected',
        title: 'Rejected',
        sourceClass: 'secondary',
        discoveredBy: 'test',
        decision: 'rejected',
        reason: 'low value',
        scores: { relevance: 1, authority: 1 },
        claims: ['Ignored claim'],
      },
    ];

    const claims = extractClaims(sources);
    expect(claims).toHaveLength(0);
  });
});
