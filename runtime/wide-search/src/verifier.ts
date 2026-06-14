import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { jaccardSimilarity, normalizeClaimText } from './text-utils';
import type {
  Claim,
  ClaimConfidence,
  ClaimFreshness,
  ConflictingClaimPair,
  DuplicateClaimGroup,
  EnrichedSource,
  VerificationReport,
} from './types';

async function readJsonl<T>(path: string): Promise<T[] | null> {
  try {
    const text = await readFile(path, 'utf8');
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function findDuplicateClaims(claims: Claim[]): DuplicateClaimGroup[] {
  const groups: DuplicateClaimGroup[] = [];
  const assigned = new Set<string>();
  const sorted = [...claims].sort((a, b) => a.claim.length - b.claim.length);

  for (let i = 0; i < sorted.length; i++) {
    const base = sorted[i];
    if (assigned.has(base.id)) continue;

    const duplicates: Claim[] = [base];
    for (let j = i + 1; j < sorted.length; j++) {
      const other = sorted[j];
      if (assigned.has(other.id)) continue;
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
      const claimIds = duplicates.map((c) => c.id);
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

  // Quoted phrases
  const quoted = claim.match(/"([^"]{3,80})"/g) ?? [];
  entities.push(...quoted.map((m) => m.slice(1, -1)));

  // Capitalized phrases (1-4 words) - likely proper nouns or product names
  const capitalized = claim.match(/\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*){0,3}\b/g) ?? [];
  entities.push(...capitalized);

  // Numbers with units
  const numbers =
    claim.match(
      /\d+(?:\.\d+)?\s*(?:%|percent|bp|basis points|million|billion|trillion|KRW|USD|EUR|GBP)/gi
    ) ?? [];
  entities.push(...numbers);

  return [...new Set(entities.map((e) => e.toLowerCase().trim()))].filter((e) => e.length > 2);
}

function detectPolarity(claim: string): 'positive' | 'negative' | 'neutral' {
  const normalized = normalizeClaimText(claim);
  const positiveHits = POSITIVE_POLARITY.filter((word) => normalized.includes(word)).length;
  const negativeHits = NEGATIVE_POLARITY.filter((word) => normalized.includes(word)).length;

  if (positiveHits > 0 && negativeHits === 0) return 'positive';
  if (negativeHits > 0 && positiveHits === 0) return 'negative';
  return 'neutral';
}

function findConflictingClaims(claims: Claim[]): ConflictingClaimPair[] {
  const pairs: ConflictingClaimPair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < claims.length; i++) {
    const claimA = claims[i];
    const polarityA = detectPolarity(claimA.claim);
    if (polarityA === 'neutral') continue;

    const entitiesA = extractEntities(claimA.claim);
    if (entitiesA.length === 0) continue;

    for (let j = i + 1; j < claims.length; j++) {
      const claimB = claims[j];
      const polarityB = detectPolarity(claimB.claim);
      if (polarityB === 'neutral' || polarityA === polarityB) continue;

      const entitiesB = extractEntities(claimB.claim);
      const sharedEntities = entitiesA.filter((entity) => entitiesB.includes(entity));
      if (sharedEntities.length === 0) continue;

      const pairKey = [claimA.id, claimB.id].sort().join('::');
      if (seen.has(pairKey)) continue;
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

function countByFreshness(claims: Claim[], freshness: ClaimFreshness): number {
  return claims.filter((claim) => claim.freshness === freshness).length;
}

function countByConfidence(claims: Claim[], confidence: ClaimConfidence): number {
  return claims.filter((claim) => claim.confidence === confidence).length;
}

function findCoverageGaps(sources: EnrichedSource[], acceptedSources: EnrichedSource[]): string[] {
  const gaps: string[] = [];
  const sourceClasses = new Set(sources.map((s) => s.sourceClass));
  const acceptedClasses = new Set(acceptedSources.map((s) => s.sourceClass));

  if (!acceptedClasses.has('primary-analysis') && sourceClasses.has('primary-analysis')) {
    gaps.push('no accepted primary-analysis sources');
  }
  if (!acceptedClasses.has('secondary') && sourceClasses.has('secondary')) {
    gaps.push('no accepted secondary sources');
  }

  const acceptedRatio = acceptedSources.length / Math.max(sources.length, 1);
  if (acceptedRatio < 0.25) {
    gaps.push('accepted source ratio below 25%');
  }

  return gaps;
}

function findBrokenSourceReferences(claims: Claim[], sourceIds: Set<string>): string[] {
  const broken: string[] = [];
  for (const claim of claims) {
    for (const sourceId of claim.sourceIds ?? []) {
      if (!sourceIds.has(sourceId)) {
        broken.push(`${claim.id} -> ${sourceId}`);
      }
    }
  }
  return broken;
}

export interface VerifyRunOptions {
  runDir?: string;
  minAcceptedSources?: number;
  maxLowConfidenceRatio?: number;
  maxStaleRatio?: number;
  maxDuplicateClaimGroups?: number;
}

export async function verifyRun({
  runDir,
  minAcceptedSources = 1,
  maxLowConfidenceRatio = 0.5,
  maxStaleRatio = 0.5,
  maxDuplicateClaimGroups = Number.MAX_SAFE_INTEGER,
}: VerifyRunOptions = {}): Promise<VerificationReport> {
  if (!runDir) {
    throw new Error('verifyRun requires runDir');
  }

  const failures: string[] = [];
  const warnings: string[] = [];
  const sources = await readJsonl<EnrichedSource>(join(runDir, 'source-ledger.jsonl'));
  const claims = await readJsonl<Claim>(join(runDir, 'claim-ledger.jsonl'));

  if (!sources) {
    failures.push('missing source ledger');
  }

  if (!claims) {
    failures.push('missing claim ledger');
  }

  const acceptedSources = sources?.filter((source) => source.decision === 'accepted') ?? [];
  const rejectedSources = sources?.filter((source) => source.decision === 'rejected') ?? [];

  if (sources && acceptedSources.length < minAcceptedSources) {
    failures.push(
      `accepted source count ${acceptedSources.length} below minimum ${minAcceptedSources}`
    );
  }

  const unsupportedClaims: string[] = [];
  for (const claim of claims ?? []) {
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      unsupportedClaims.push(claim.id ?? claim.claim ?? 'unknown claim');
    }
  }

  if (unsupportedClaims.length > 0) {
    failures.push(`unsupported claims: ${unsupportedClaims.join(', ')}`);
  }

  const duplicateSources =
    sources?.filter((source) => source.reason === 'duplicate or low-value source') ?? [];
  if (sources && duplicateSources.length / Math.max(sources.length, 1) > 0.5) {
    warnings.push('duplicate or low-value source ratio is high');
  }

  const staleClaims = countByFreshness(claims ?? [], 'stale');
  const unknownFreshnessClaims = countByFreshness(claims ?? [], 'unknown');
  const lowConfidenceClaims = countByConfidence(claims ?? [], 'low');

  const totalClaims = claims?.length ?? 0;
  if (totalClaims > 0) {
    if (staleClaims / totalClaims > maxStaleRatio) {
      failures.push(
        `stale claim ratio ${(staleClaims / totalClaims).toFixed(2)} exceeds ${maxStaleRatio}`
      );
    } else if (staleClaims / totalClaims > maxStaleRatio / 2) {
      warnings.push(`stale claim ratio is ${(staleClaims / totalClaims).toFixed(2)}`);
    }

    if (lowConfidenceClaims / totalClaims > maxLowConfidenceRatio) {
      failures.push(
        `low-confidence claim ratio ${(lowConfidenceClaims / totalClaims).toFixed(2)} exceeds ${maxLowConfidenceRatio}`
      );
    } else if (lowConfidenceClaims / totalClaims > maxLowConfidenceRatio / 2) {
      warnings.push(
        `low-confidence claim ratio is ${(lowConfidenceClaims / totalClaims).toFixed(2)}`
      );
    }
  }

  const duplicateClaimGroups = findDuplicateClaims(claims ?? []);
  if (duplicateClaimGroups.length > maxDuplicateClaimGroups) {
    failures.push(
      `duplicate claim groups ${duplicateClaimGroups.length} exceeds ${maxDuplicateClaimGroups}`
    );
  } else if (duplicateClaimGroups.length > 0) {
    warnings.push(`${duplicateClaimGroups.length} duplicate claim groups detected`);
  }

  const conflictingClaimPairs = findConflictingClaims(claims ?? []);
  if (conflictingClaimPairs.length > 0) {
    warnings.push(
      `${conflictingClaimPairs.length} conflicting claim pairs detected; review needed`
    );
  }

  const coverageGaps = findCoverageGaps(sources ?? [], acceptedSources);
  if (coverageGaps.length > 0) {
    warnings.push(`coverage gaps: ${coverageGaps.join('; ')}`);
  }

  const sourceIds = new Set(sources?.map((s) => s.id) ?? []);
  const brokenReferences = findBrokenSourceReferences(claims ?? [], sourceIds);
  if (brokenReferences.length > 0) {
    failures.push(`broken source references: ${brokenReferences.join(', ')}`);
  }

  const report: VerificationReport = {
    status: failures.length === 0 ? 'passed' : 'failed',
    acceptedSources: acceptedSources.length,
    rejectedSources: rejectedSources.length,
    unsupportedClaims: unsupportedClaims.length,
    staleClaims,
    unknownFreshnessClaims,
    lowConfidenceClaims,
    duplicateClaimGroups,
    conflictingClaimPairs,
    coverageGaps,
    failures,
    warnings,
  };

  await writeFile(join(runDir, 'verification-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
