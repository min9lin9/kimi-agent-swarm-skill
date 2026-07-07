import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findConflictingClaims, findDuplicateClaims } from './claim-analysis';
import { validateCompletionEvidence } from './completion-evidence';
import { classifyStrictClaims } from './strict-claims';
import type {
  Claim,
  ClaimConfidence,
  ClaimFreshness,
  EnrichedSource,
  StrictClaimReport,
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

async function readJson(path: string): Promise<unknown | null> {
  try {
    const text = await readFile(path, 'utf8');
    const parsed: unknown = JSON.parse(text);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
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
  strictClaims?: boolean;
  requireCompletionEvidence?: boolean;
}

export async function verifyRun({
  runDir,
  minAcceptedSources = 1,
  maxLowConfidenceRatio = 0.5,
  maxStaleRatio = 0.5,
  maxDuplicateClaimGroups = Number.MAX_SAFE_INTEGER,
  strictClaims = false,
  requireCompletionEvidence = false,
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

  let strictClaimReport: StrictClaimReport | undefined;
  if (strictClaims) {
    const strictResult = classifyStrictClaims(claims ?? []);
    strictClaimReport = strictResult.report;
    if (strictResult.unresolvedClaims.length > 0) {
      failures.push(
        `unresolved strict claims: ${strictResult.unresolvedClaims.map((claim) => claim.id).join(', ')}`
      );
    }
    if (strictResult.refutedClaims.length > 0) {
      failures.push(
        `refuted strict claims: ${strictResult.refutedClaims.map((claim) => claim.id).join(', ')}`
      );
    }
    await writeJson(join(runDir, 'verified-claims.json'), strictResult.verifiedClaims);
    await writeJson(join(runDir, 'unresolved-claims.json'), strictResult.unresolvedClaims);
    await writeJson(join(runDir, 'refuted-claims.json'), strictResult.refutedClaims);
  }

  if (requireCompletionEvidence) {
    const evidence = await readJson(join(runDir, 'completion-evidence.json'));
    if (evidence === null) {
      failures.push('missing completion evidence');
    } else {
      failures.push(...validateCompletionEvidence(evidence));
    }
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
    strictClaims: strictClaimReport,
  };

  await writeFile(join(runDir, 'verification-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
