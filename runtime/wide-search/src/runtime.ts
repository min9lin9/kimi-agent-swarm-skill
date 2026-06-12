import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadCommandSources } from "./command-provider";
import { verifyRun } from "./verifier";
import type {
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
  Source,
  VerificationReport,
} from "./types";

function makeRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${suffix}`;
}

function scoreDecision(source: Source): Pick<EnrichedSource, "decision" | "reason"> {
  const scores = source.scores ?? {};
  const accepted = (scores.relevance ?? 0) >= 3 && (scores.authority ?? 0) >= 2;
  return {
    decision: accepted ? "accepted" : "rejected",
    reason: accepted ? "meets relevance and authority threshold" : "duplicate or low-value source",
  };
}

function claimConfidence(source: Source): ClaimConfidence {
  const authority = source.scores?.authority ?? 0;
  if (authority >= 4) return "high";
  if (authority >= 2) return "medium";
  return "low";
}

function claimFreshness(source: Source): ClaimFreshness {
  if (!source.publishedAt || source.publishedAt === "unknown") return "unknown";
  return source.publishedAt >= "2026-01-01" ? "current" : "stale";
}

async function loadFixtureSources(): Promise<Source[]> {
  const fixtureUrl = new URL("../fixtures/basic-sources.json", import.meta.url);
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8")) as { sources: Source[] };
  return fixture.sources;
}

async function loadSources({
  profile,
  objective,
  providerCommand,
  providerArgs,
}: LoadSourcesOptions): Promise<Source[]> {
  if (profile === "fixture") {
    return loadFixtureSources();
  }

  if (profile === "local-command") {
    return loadCommandSources({ providerCommand, providerArgs, objective });
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

export async function runWideSearch({
  objective,
  profile = "fixture",
  providerCommand,
  providerArgs = [],
  workDir = process.cwd(),
}: RunWideSearchOptions = {}): Promise<RunWideSearchResult> {
  if (!objective) {
    throw new Error("runWideSearch requires objective");
  }

  const runId = makeRunId();
  const runDir = join(workDir, ".runs", "wide-search", runId);
  await mkdir(runDir, { recursive: true });

  const rawSources = await loadSources({ profile, objective, providerCommand, providerArgs });
  const sources: EnrichedSource[] = rawSources.map((source) => ({
    ...source,
    ...scoreDecision(source),
  }));

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
  };

  const researchPlan: ResearchPlan = {
    objective,
    searchDepth: "standard",
    executionProfile: profile,
    queryFamilies: [profile === "fixture" ? "fixture:agent research" : "local-command provider"],
    sourceTargets: ["official", "community", "secondary"],
    stopConditions: [profile === "fixture" ? "fixture source set exhausted" : "provider output exhausted"],
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

  return {
    runId,
    runDir,
    verification,
  };
}
