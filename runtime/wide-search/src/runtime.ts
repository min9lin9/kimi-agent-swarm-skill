import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadCommandSources } from "./command-provider";
import {
  calculateActualCost,
  checkBudget,
  checkEstimatedBudget,
  estimateRunCost,
  formatCostReport,
  maxResultsForDepth,
} from "./costs";
import { createSearchProvider } from "./providers";
import { scoreSource } from "./scorer";
import { verifyRun } from "./verifier";
import type {
  BudgetOptions,
  Claim,
  ClaimConfidence,
  ClaimFreshness,
  EnrichedSource,
  ExecutionProfile,
  LoadSourcesOptions,
  ResearchPlan,
  Run,
  RunWideSearchOptions,
  RunWideSearchResult,
  SearchDepth,
  Source,
  UsageMetrics,
  VerificationReport,
} from "./types";

function makeRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${suffix}`;
}

function claimConfidence(source: Source): ClaimConfidence {
  const authority = source.scores?.authority ?? 0;
  if (authority >= 4) return "high";
  if (authority >= 2) return "medium";
  return "low";
}

function claimFreshness(source: Source): ClaimFreshness {
  if (!source.publishedAt || source.publishedAt === "unknown") return "unknown";

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    .toISOString()
    .split("T")[0];

  return source.publishedAt >= oneYearAgo ? "current" : "stale";
}

const FIXTURE_FILE_MAP: Record<string, string> = {
  fixture: "basic-sources.json",
  "fixture-asset-mgmt": "asset-mgmt-roles.json",
  "fixture-sellside-research": "sellside-research-roles.json",
  "fixture-youtube-niche": "youtube-niche.json",
  "fixture-paul-graham-corpus": "paul-graham-corpus.json",
};

async function loadFixtureSources(profile: ExecutionProfile): Promise<Source[]> {
  const fileName = FIXTURE_FILE_MAP[profile];
  if (fileName === undefined) {
    throw new Error(`unknown fixture profile: ${profile}`);
  }
  const fixtureUrl = new URL(`../fixtures/${fileName}`, import.meta.url);
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8")) as { sources: Source[] };
  return fixture.sources;
}

async function loadSources({
  profile,
  objective,
  providerCommand,
  providerArgs,
  providerName,
  searchDepth,
  metrics,
}: LoadSourcesOptions): Promise<Source[]> {
  if (profile.startsWith("fixture")) {
    return loadFixtureSources(profile);
  }

  if (profile === "local-command") {
    return loadCommandSources({ providerCommand, providerArgs, objective });
  }

  if (profile === "web-search") {
    const provider = createSearchProvider(providerName ?? "mock", metrics);
    return provider.search({
      objective,
      depth: searchDepth ?? "standard",
      maxResults: maxResultsForDepth(searchDepth ?? "standard"),
    });
  }

  throw new Error(`unsupported execution profile: ${profile}`);
}


function renderSynthesis({
  objective,
  profile,
  sources,
  claims,
  verification,
}: {
  objective: string;
  profile: ExecutionProfile;
  sources: EnrichedSource[];
  claims: Claim[];
  verification: VerificationReport;
}): string {
  const accepted = sources.filter((source) => source.decision === "accepted");
  const rejected = sources.filter((source) => source.decision === "rejected");
  const topRows = claims
    .map(
      (claim) =>
        `| ${claim.claim} | ${claim.sourceIds.join(", ")} | ${claim.confidence} |`,
    )
    .join("\n");

  return `# Wide-Search Synthesis

## Answer
${objective}

The ${profile} run found ${accepted.length} accepted source(s) and ${rejected.length} rejected source(s). The accepted evidence supports ${claims.length} claim(s).

## Top Findings
| Finding | Evidence | Confidence |
| --- | --- | --- |
${topRows}

## Source Coverage
- Accepted sources: ${accepted.length}
- Rejected sources: ${rejected.length}
- Verification status: ${verification.status}

## Evidence
- Source ledger: source-ledger.jsonl
- Claim ledger: claim-ledger.jsonl
- Verification: verification-report.json

## Next Human Check
- Review the accepted sources and rerun with a broader search profile before making production decisions.
`;
}

function resolveProviderName(profile: ExecutionProfile, providerName?: string): string {
  if (profile === "web-search") {
    return providerName ?? "mock";
  }
  return "mock";
}

export async function runWideSearch({
  objective,
  profile = "fixture",
  providerCommand,
  providerArgs = [],
  providerName,
  searchDepth = "standard",
  workDir = process.cwd(),
  budget = {},
}: RunWideSearchOptions = {}): Promise<RunWideSearchResult> {
  if (!objective) {
    throw new Error("runWideSearch requires objective");
  }

  const runId = makeRunId();
  const runDir = join(workDir, ".runs", "wide-search", runId);
  await mkdir(runDir, { recursive: true });

  const effectiveProviderName = resolveProviderName(profile, providerName);
  const estimate = estimateRunCost(effectiveProviderName, searchDepth);

  const usageMetrics: UsageMetrics = {
    providerCalls: 0,
    apiCalls: 0,
    estimatedCostUsd: estimate.estimatedCostUsd,
  };

  checkEstimatedBudget(estimate, budget);

  if (budget.dryRun) {
    usageMetrics.notes = "Dry run: no provider executed.";
    const dryRun: Run = {
      runId,
      objective,
      executionProfile: profile,
      status: "completed",
      createdAt: new Date().toISOString(),
      usageMetrics,
    };
    await writeFile(join(runDir, "run.json"), `${JSON.stringify(dryRun, null, 2)}\n`);
    return {
      runId,
      runDir,
      verification: {
        status: "passed",
        acceptedSources: 0,
        rejectedSources: 0,
        unsupportedClaims: 0,
        staleClaims: 0,
        unknownFreshnessClaims: 0,
        lowConfidenceClaims: 0,
        duplicateClaimGroups: [],
        conflictingClaimPairs: [],
        coverageGaps: [],
        failures: [],
        warnings: ["dry-run: no sources or claims evaluated"],
      },
    };
  }

  const rawSources = await loadSources({
    profile,
    objective,
    providerCommand,
    providerArgs,
    providerName,
    searchDepth,
    metrics: usageMetrics,
  });
  const sources: EnrichedSource[] = rawSources.map((source) => scoreSource(source));

  usageMetrics.actualCostUsd = calculateActualCost(effectiveProviderName, usageMetrics);
  checkBudget(effectiveProviderName, usageMetrics, budget);

  const claims: Claim[] = [];
  for (const source of sources.filter((item) => item.decision === "accepted")) {
    for (const claim of source.claims ?? []) {
      claims.push({
        id: `C${String(claims.length + 1).padStart(3, "0")}`,
        claim,
        sourceIds: [source.id],
        confidence: claimConfidence(source),
        freshness: claimFreshness(source),
      });
    }
  }

  const run: Run = {
    runId,
    objective,
    executionProfile: profile,
    status: "completed",
    createdAt: new Date().toISOString(),
    usageMetrics,
  };

  const researchPlan: ResearchPlan = {
    objective,
    searchDepth,
    executionProfile: profile,
    queryFamilies: [profile.startsWith("fixture") ? `fixture:${profile}` : "local-command provider"],
    sourceTargets: ["official", "community", "secondary"],
    stopConditions: [profile.startsWith("fixture") ? "fixture source set exhausted" : "provider output exhausted"],
  };

  await writeFile(join(runDir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  await writeFile(join(runDir, "research-plan.json"), `${JSON.stringify(researchPlan, null, 2)}\n`);
  await writeFile(
    join(runDir, "source-ledger.jsonl"),
    `${sources.map((source) => JSON.stringify(source)).join("\n")}\n`,
  );
  await writeFile(
    join(runDir, "claim-ledger.jsonl"),
    `${claims.map((claim) => JSON.stringify(claim)).join("\n")}\n`,
  );

  const verification = await verifyRun({ runDir, minAcceptedSources: 1 });
  const synthesis = renderSynthesis({ objective, profile, sources, claims, verification });
  await writeFile(join(runDir, "synthesis.md"), synthesis);

  console.log(formatCostReport(effectiveProviderName, usageMetrics));

  return {
    runId,
    runDir,
    verification,
  };
}
