import { jaccardSimilarity, normalizeClaimText } from './text-utils';
import type { Claim, ConflictingClaimPair, DuplicateClaimGroup } from './types';

export function findDuplicateClaims(claims: readonly Claim[]): DuplicateClaimGroup[] {
  const groups: DuplicateClaimGroup[] = [];
  const assigned = new Set<string>();
  const sorted = [...claims].sort((a, b) => a.claim.length - b.claim.length);

  for (let i = 0; i < sorted.length; i++) {
    const base = sorted[i];
    if (assigned.has(base.id)) {
      continue;
    }

    const duplicates: Claim[] = [base];
    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j];
      if (assigned.has(other.id)) {
        continue;
      }
      const similarity = jaccardSimilarity(base.claim, other.claim);
      const normalizedBase = normalizeClaimText(base.claim);
      const normalizedOther = normalizeClaimText(other.claim);
      const isSubstring =
        normalizedBase.length > 10 &&
        (normalizedOther.includes(normalizedBase) || normalizedBase.includes(normalizedOther));
      if (similarity >= 0.7 || isSubstring) {
        duplicates.push(other);
      }
    }

    if (duplicates.length > 1) {
      const claimIds = duplicates.map((claim) => claim.id);
      for (const id of claimIds) {
        assigned.add(id);
      }
      groups.push({
        representativeClaimId: base.id,
        claimIds,
        similarityReason: 'jaccard token similarity >= 0.7 or substring containment',
      });
    }
  }

  return groups;
}

const POSITIVE_POLARITY = [
  'increase',
  'increases',
  'increased',
  'rising',
  'rises',
  'rose',
  'grows',
  'grew',
  'growth',
  'up',
  'higher',
  'more',
  'positive',
  'good',
  'bullish',
  'strong',
  'buy',
  'outperform',
  'above',
  'exceeds',
];

const NEGATIVE_POLARITY = [
  'decrease',
  'decreases',
  'decreased',
  'falling',
  'falls',
  'fell',
  'shrinks',
  'shrank',
  'shrunk',
  'down',
  'lower',
  'less',
  'negative',
  'bad',
  'bearish',
  'weak',
  'sell',
  'underperform',
  'below',
  'misses',
];

function extractEntities(claim: string): string[] {
  const entities: string[] = [];
  const quoted = claim.match(/"([^"]{3,80})"/g) ?? [];
  entities.push(...quoted.map((match) => match.slice(1, -1)));

  const capitalized = claim.match(/\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*){0,3}\b/g) ?? [];
  entities.push(...capitalized);

  const numbers =
    claim.match(
      /\d+(?:\.\d+)?\s*(?:%|percent|bp|basis points|million|billion|trillion|KRW|USD|EUR|GBP)/gi
    ) ?? [];
  entities.push(...numbers);

  return [...new Set(entities.map((entity) => entity.toLowerCase().trim()))].filter(
    (entity) => entity.length > 2
  );
}

function detectPolarity(claim: string): 'positive' | 'negative' | 'neutral' {
  const normalized = normalizeClaimText(claim);
  const positiveHits = POSITIVE_POLARITY.filter((word) => normalized.includes(word)).length;
  const negativeHits = NEGATIVE_POLARITY.filter((word) => normalized.includes(word)).length;

  if (positiveHits > 0 && negativeHits === 0) {
    return 'positive';
  }
  if (negativeHits > 0 && positiveHits === 0) {
    return 'negative';
  }
  return 'neutral';
}

export function findConflictingClaims(claims: readonly Claim[]): ConflictingClaimPair[] {
  const pairs: ConflictingClaimPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < claims.length; i++) {
    const claimA = claims[i];
    const polarityA = detectPolarity(claimA.claim);
    if (polarityA === 'neutral') {
      continue;
    }

    const entitiesA = extractEntities(claimA.claim);
    if (entitiesA.length === 0) {
      continue;
    }

    for (let j = i + 1; j < claims.length; j++) {
      const claimB = claims[j];
      const polarityB = detectPolarity(claimB.claim);
      if (polarityB === 'neutral' || polarityA === polarityB) {
        continue;
      }

      const entitiesB = extractEntities(claimB.claim);
      const sharedEntities = entitiesA.filter((entity) => entitiesB.includes(entity));
      if (sharedEntities.length === 0) {
        continue;
      }

      const pairKey = [claimA.id, claimB.id].sort().join('::');
      if (seen.has(pairKey)) {
        continue;
      }
      seen.add(pairKey);

      pairs.push({
        claimIdA: claimA.id,
        claimIdB: claimB.id,
        entity: sharedEntities[0],
        reason: `opposing polarity (${polarityA} vs ${polarityB}) on shared entity "${sharedEntities[0]}"`,
      });
    }
  }

  return pairs;
}
