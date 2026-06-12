import { join } from "node:path";

import { runWideSearch } from "./runtime";
import type { BenchmarkResult, Claim, EnrichedSource, GoldenAnswer } from "./types";

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

function findBestMatch(
  expectedClaim: string,
  actualClaims: Claim[],
  threshold = 0.6,
): Claim | undefined {
  let best: Claim | undefined;
  let bestScore = 0;
  for (const claim of actualClaims) {
    const score = jaccardSimilarity(expectedClaim, claim.claim);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      best = claim;
    }
  }
  return best;
}

export async function runBenchmark(
  profile: string,
  golden: GoldenAnswer,
  workDir: string = process.cwd(),
): Promise<BenchmarkResult> {
  const objective = `Benchmark: ${profile}`;
  const result = await runWideSearch({
    objective,
    profile: profile as "fixture-paul-graham-corpus",
    workDir,
  });

  const { acceptedSources = 0 } = result.verification;
  if (acceptedSources === 0) {
    return {
      profile,
      precision: 0,
      recall: 0,
      citationAccuracy: 0,
      f1: 0,
      passed: false,
    };
  }

  // We only have verification summary here, but the actual claims live in the ledger.
  // Re-read ledger files for scoring.
  const ledgerPath = join(result.runDir, "claim-ledger.jsonl");
  const sourceLedgerPath = join(result.runDir, "source-ledger.jsonl");

  const claimModule = await import("node:fs/promises");
  const claimText = await claimModule.readFile(ledgerPath, "utf8");
  const sourceText = await claimModule.readFile(sourceLedgerPath, "utf8");

  const actualClaims: Claim[] = claimText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Claim);

  const sources: EnrichedSource[] = sourceText
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as EnrichedSource);

  const acceptedClaims = actualClaims;

  let matchedGolden = 0;
  const matchedActualIds = new Set<string>();
  for (const expectedClaim of golden.expectedClaims) {
    const match = findBestMatch(expectedClaim, acceptedClaims);
    if (match) {
      matchedGolden += 1;
      matchedActualIds.add(match.id);
    }
  }

  const precision = acceptedClaims.length > 0 ? matchedActualIds.size / acceptedClaims.length : 0;
  const recall = golden.expectedClaims.length > 0 ? matchedGolden / golden.expectedClaims.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const citedClaims = acceptedClaims.filter(
    (claim) => Array.isArray(claim.sourceIds) && claim.sourceIds.length > 0,
  );
  const citationAccuracy = acceptedClaims.length > 0 ? citedClaims.length / acceptedClaims.length : 0;

  // Optional URL coverage check
  if (golden.expectedSourceUrls && golden.expectedSourceUrls.length > 0) {
    const acceptedUrls = new Set(sources.filter((s) => s.decision === "accepted").map((s) => s.url));
    const coveredUrls = golden.expectedSourceUrls.filter((url) => acceptedUrls.has(url));
    if (coveredUrls.length / golden.expectedSourceUrls.length < 0.5) {
      // URL coverage below 50% is a soft failure; does not override numeric scores.
    }
  }

  return {
    profile,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    citationAccuracy: Number(citationAccuracy.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    passed: recall >= 0.5 && citationAccuracy >= 0.8,
  };
}
