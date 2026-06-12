import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  Claim,
  ClaimConfidence,
  ClaimFreshness,
  DuplicateClaimGroup,
  EnrichedSource,
  VerificationReport,
} from "./types";

async function readJsonl<T>(path: string): Promise<T[] | null> {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function normalizeClaimText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeClaimText(text).split(" ").filter(Boolean));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
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
      claimIds.forEach((id) => assigned.add(id));
      groups.push({
        representativeClaimId: base.id,
        claimIds,
        similarityReason: "jaccard token similarity >= 0.7 or substring containment",
      });
    }
  }

  return groups;
}

function countByFreshness(claims: Claim[], freshness: ClaimFreshness): number {
  return claims.filter((claim) => claim.freshness === freshness).length;
}

function countByConfidence(claims: Claim[], confidence: ClaimConfidence): number {
  return claims.filter((claim) => claim.confidence === confidence).length;
}

function findCoverageGaps(
  sources: EnrichedSource[],
  acceptedSources: EnrichedSource[],
): string[] {
  const gaps: string[] = [];
  const sourceClasses = new Set(sources.map((s) => s.sourceClass));
  const acceptedClasses = new Set(acceptedSources.map((s) => s.sourceClass));

  if (!acceptedClasses.has("primary-analysis") && sourceClasses.has("primary-analysis")) {
    gaps.push("no accepted primary-analysis sources");
  }
  if (!acceptedClasses.has("secondary") && sourceClasses.has("secondary")) {
    gaps.push("no accepted secondary sources");
  }

  const acceptedRatio = acceptedSources.length / Math.max(sources.length, 1);
  if (acceptedRatio < 0.25) {
    gaps.push("accepted source ratio below 25%");
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
    throw new Error("verifyRun requires runDir");
  }

  const failures: string[] = [];
  const warnings: string[] = [];
  const sources = await readJsonl<EnrichedSource>(join(runDir, "source-ledger.jsonl"));
  const claims = await readJsonl<Claim>(join(runDir, "claim-ledger.jsonl"));

  if (!sources) {
    failures.push("missing source ledger");
  }

  if (!claims) {
    failures.push("missing claim ledger");
  }

  const acceptedSources = sources?.filter((source) => source.decision === "accepted") ?? [];
  const rejectedSources = sources?.filter((source) => source.decision === "rejected") ?? [];

  if (sources && acceptedSources.length < minAcceptedSources) {
    failures.push(
      `accepted source count ${acceptedSources.length} below minimum ${minAcceptedSources}`,
    );
  }

  const unsupportedClaims: string[] = [];
  for (const claim of claims ?? []) {
    if (!Array.isArray(claim.sourceIds) || claim.sourceIds.length === 0) {
      unsupportedClaims.push(claim.id ?? claim.claim ?? "unknown claim");
    }
  }

  if (unsupportedClaims.length > 0) {
    failures.push(`unsupported claims: ${unsupportedClaims.join(", ")}`);
  }

  const duplicateSources =
    sources?.filter((source) => source.reason === "duplicate or low-value source") ?? [];
  if (sources && duplicateSources.length / Math.max(sources.length, 1) > 0.5) {
    warnings.push("duplicate or low-value source ratio is high");
  }

  const staleClaims = countByFreshness(claims ?? [], "stale");
  const unknownFreshnessClaims = countByFreshness(claims ?? [], "unknown");
  const lowConfidenceClaims = countByConfidence(claims ?? [], "low");

  const totalClaims = claims?.length ?? 0;
  if (totalClaims > 0) {
    if (staleClaims / totalClaims > maxStaleRatio) {
      failures.push(
        `stale claim ratio ${(staleClaims / totalClaims).toFixed(2)} exceeds ${maxStaleRatio}`,
      );
    } else if (staleClaims / totalClaims > maxStaleRatio / 2) {
      warnings.push(`stale claim ratio is ${(staleClaims / totalClaims).toFixed(2)}`);
    }

    if (lowConfidenceClaims / totalClaims > maxLowConfidenceRatio) {
      failures.push(
        `low-confidence claim ratio ${(lowConfidenceClaims / totalClaims).toFixed(2)} exceeds ${maxLowConfidenceRatio}`,
      );
    } else if (lowConfidenceClaims / totalClaims > maxLowConfidenceRatio / 2) {
      warnings.push(`low-confidence claim ratio is ${(lowConfidenceClaims / totalClaims).toFixed(2)}`);
    }
  }

  const duplicateClaimGroups = findDuplicateClaims(claims ?? []);
  if (duplicateClaimGroups.length > maxDuplicateClaimGroups) {
    failures.push(
      `duplicate claim groups ${duplicateClaimGroups.length} exceeds ${maxDuplicateClaimGroups}`,
    );
  } else if (duplicateClaimGroups.length > 0) {
    warnings.push(`${duplicateClaimGroups.length} duplicate claim groups detected`);
  }

  const coverageGaps = findCoverageGaps(sources ?? [], acceptedSources);
  if (coverageGaps.length > 0) {
    warnings.push(`coverage gaps: ${coverageGaps.join("; ")}`);
  }

  const sourceIds = new Set(sources?.map((s) => s.id) ?? []);
  const brokenReferences = findBrokenSourceReferences(claims ?? [], sourceIds);
  if (brokenReferences.length > 0) {
    failures.push(`broken source references: ${brokenReferences.join(", ")}`);
  }

  const report: VerificationReport = {
    status: failures.length === 0 ? "passed" : "failed",
    acceptedSources: acceptedSources.length,
    rejectedSources: rejectedSources.length,
    unsupportedClaims: unsupportedClaims.length,
    staleClaims,
    unknownFreshnessClaims,
    lowConfidenceClaims,
    duplicateClaimGroups,
    coverageGaps,
    failures,
    warnings,
  };

  await writeFile(join(runDir, "verification-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}
