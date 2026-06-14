import { join } from 'node:path';

import { getGitCommit, recordEntry } from './leaderboard';
import { runWideSearch } from './runtime';
import { jaccardSimilarity } from './text-utils';
import type { BenchmarkResult, Claim, EnrichedSource, GoldenAnswer } from './types';

function findBestMatch(
  expectedClaim: string,
  actualClaims: Claim[],
  threshold = 0.6
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
  workDir: string = process.cwd()
): Promise<BenchmarkResult> {
  const objective = `Benchmark: ${profile}`;
  const runResult = await runWideSearch({
    objective,
    profile: profile as 'fixture-paul-graham-corpus',
    workDir,
  });

  const { acceptedSources = 0 } = runResult.verification;
  if (acceptedSources === 0) {
    const failed: BenchmarkResult = {
      profile,
      runId: runResult.runId,
      runDir: runResult.runDir,
      precision: 0,
      recall: 0,
      citationAccuracy: 0,
      f1: 0,
      urlCoverage: 0,
      passed: false,
    };
    await recordEntry({
      runId: failed.runId,
      profile,
      runDir: failed.runDir,
      timestamp: new Date().toISOString(),
      gitCommit: await getGitCommit(),
      scores: failed,
    });
    return failed;
  }

  // We only have verification summary here, but the actual claims live in the ledger.
  // Re-read ledger files for scoring.
  const ledgerPath = join(runResult.runDir, 'claim-ledger.jsonl');
  const sourceLedgerPath = join(runResult.runDir, 'source-ledger.jsonl');

  const claimModule = await import('node:fs/promises');
  const claimText = await claimModule.readFile(ledgerPath, 'utf8');
  const sourceText = await claimModule.readFile(sourceLedgerPath, 'utf8');

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
  const recall =
    golden.expectedClaims.length > 0 ? matchedGolden / golden.expectedClaims.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const citedClaims = acceptedClaims.filter(
    (claim) => Array.isArray(claim.sourceIds) && claim.sourceIds.length > 0
  );
  const citationAccuracy =
    acceptedClaims.length > 0 ? citedClaims.length / acceptedClaims.length : 0;

  // Optional URL coverage check
  let urlCoverage = 0;
  let passed = recall >= 0.5 && citationAccuracy >= 0.8;
  const failures: string[] = [];
  if (golden.expectedSourceUrls && golden.expectedSourceUrls.length > 0) {
    const acceptedUrls = new Set(
      sources.filter((s) => s.decision === 'accepted').map((s) => s.url)
    );
    const coveredUrls = golden.expectedSourceUrls.filter((url) => acceptedUrls.has(url));
    urlCoverage = Number((coveredUrls.length / golden.expectedSourceUrls.length).toFixed(4));
    if (urlCoverage < 0.5) {
      passed = false;
      failures.push(
        `URL coverage ${(urlCoverage * 100).toFixed(1)}% below 50% threshold ` +
          `(${coveredUrls.length}/${golden.expectedSourceUrls.length} expected sources)`
      );
    }
  }

  const benchmarkResult: BenchmarkResult = {
    profile,
    runId: runResult.runId,
    runDir: runResult.runDir,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    citationAccuracy: Number(citationAccuracy.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    passed,
    urlCoverage,
    failures: failures.length > 0 ? failures : undefined,
  };

  const gitCommit = await getGitCommit();
  await recordEntry({
    runId: benchmarkResult.runId,
    profile,
    runDir: benchmarkResult.runDir,
    timestamp: new Date().toISOString(),
    gitCommit,
    scores: benchmarkResult,
  });

  return benchmarkResult;
}
