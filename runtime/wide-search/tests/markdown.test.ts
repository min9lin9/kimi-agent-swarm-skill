import { describe, expect, test } from "bun:test";

import { renderMarkdownSynthesis } from "../src/markdown";
import type {
  Claim,
  EnrichedSource,
  ExecutionProfile,
  Run,
  VerificationReport,
} from "../src/types";

const baseRun: Run = {
  runId: "2026-01-01T12-00-00-000Z-abc123",
  objective: "Test objective with | pipe and [brackets]",
  executionProfile: "fixture" as ExecutionProfile,
  status: "completed",
  createdAt: "2026-01-01T12:00:00.000Z",
  usageMetrics: { providerCalls: 1, apiCalls: 1 },
};

const baseSource: EnrichedSource = {
  id: "S001",
  url: "https://example.com/source-1",
  title: "Source with | pipe and [brackets]",
  sourceClass: "primary-analysis",
  discoveredBy: "test",
  decision: "accepted",
  reason: "meets threshold",
  scores: {
    relevance: 0.95,
    authority: 0.88,
    freshness: 0.75,
    diversity: 0.6,
    extractionValue: 0.82,
  },
  claims: ["claim one", "claim two"],
  publishedAt: "2026-01-01",
};

const baseClaims: Claim[] = [
  {
    id: "C001",
    claim: "Claim with | pipe and [brackets]",
    sourceIds: ["S001"],
    confidence: "high",
    freshness: "current",
  },
];

const baseVerification: VerificationReport = {
  status: "passed",
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

describe("renderMarkdownSynthesis", () => {
  test("includes title, run metadata, and summary", () => {
    const md = renderMarkdownSynthesis({
      run: baseRun,
      profile: "fixture",
      sources: [baseSource],
      claims: baseClaims,
      verification: baseVerification,
    });

    expect(md).toInclude("# Wide-Search Synthesis: Test objective with");
    expect(md).toInclude("2026-01-01T12-00-00-000Z-abc123");
    expect(md).toInclude("`fixture`");
    expect(md).toInclude("completed");
    expect(md).toInclude("**Accepted sources:** 1");
    expect(md).toInclude("**Rejected sources:** 0");
    expect(md).toInclude("**Total claims:** 1");
    expect(md).toInclude("**Verification status:** passed");
  });

  test("renders accepted source table with link and scores", () => {
    const md = renderMarkdownSynthesis({
      run: baseRun,
      profile: "fixture",
      sources: [baseSource],
      claims: baseClaims,
      verification: baseVerification,
    });

    expect(md).toInclude("## Accepted sources");
    expect(md).toInclude("| Source | Class | Decision | Relevance | Authority | Freshness | Diversity | Extraction |");
    expect(md).toInclude("| --- | --- | --- | --- | --- | --- | --- | --- |");
    expect(md).toInclude("0.95");
    expect(md).toInclude("0.88");
  });

  test("renders claims table", () => {
    const md = renderMarkdownSynthesis({
      run: baseRun,
      profile: "fixture",
      sources: [baseSource],
      claims: baseClaims,
      verification: baseVerification,
    });

    expect(md).toInclude("## Claims");
    expect(md).toInclude("| Claim | Sources | Confidence | Freshness |");
    expect(md).toInclude("| --- | --- | --- | --- |");
    expect(md).toInclude("high");
    expect(md).toInclude("current");
  });

  test("escapes markdown-sensitive characters in free text", () => {
    const md = renderMarkdownSynthesis({
      run: baseRun,
      profile: "fixture",
      sources: [baseSource],
      claims: baseClaims,
      verification: baseVerification,
    });

    expect(md).toInclude("\\| pipe");
    expect(md).toInclude("\\[brackets\\]");
  });

  test("renders verification failures, warnings, duplicates, conflicts, and gaps", () => {
    const verification: VerificationReport = {
      ...baseVerification,
      status: "failed",
      failures: ["failure one"],
      warnings: ["warning one"],
      duplicateClaimGroups: [
        {
          representativeClaimId: "C001",
          claimIds: ["C001", "C002"],
          similarityReason: "similar text",
        },
      ],
      conflictingClaimPairs: [
        {
          claimIdA: "C001",
          claimIdB: "C002",
          entity: "entity",
          reason: "opposing polarity",
        },
      ],
      coverageGaps: ["no accepted secondary sources"],
    };

    const md = renderMarkdownSynthesis({
      run: baseRun,
      profile: "fixture",
      sources: [baseSource],
      claims: baseClaims,
      verification,
    });

    expect(md).toInclude("### Failures");
    expect(md).toInclude("failure one");
    expect(md).toInclude("### Warnings");
    expect(md).toInclude("warning one");
    expect(md).toInclude("### Duplicate claim groups");
    expect(md).toInclude("C001");
    expect(md).toInclude("### Conflicting claim pairs");
    expect(md).toInclude("entity");
    expect(md).toInclude("### Coverage gaps");
    expect(md).toInclude("no accepted secondary sources");
  });

  test("renders next steps section", () => {
    const md = renderMarkdownSynthesis({
      run: baseRun,
      profile: "fixture",
      sources: [baseSource],
      claims: baseClaims,
      verification: baseVerification,
    });

    expect(md).toInclude("## Next steps / human review");
    expect(md).toInclude("Review accepted sources");
    expect(md).toInclude("Rerun with a broader search profile");
  });

  test("handles empty sources and claims gracefully", () => {
    const md = renderMarkdownSynthesis({
      run: baseRun,
      profile: "fixture",
      sources: [],
      claims: [],
    });

    expect(md).toInclude("**Accepted sources:** 0");
    expect(md).toInclude("**Rejected sources:** 0");
    expect(md).toInclude("**Total claims:** 0");
    expect(md).toInclude("*No accepted sources.*");
    expect(md).toInclude("*No claims extracted.*");
    expect(md).toInclude("*No verification report available.*");
  });
});
