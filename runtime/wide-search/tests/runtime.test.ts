import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runWideSearch } from "../src/runtime";
import { verifyRun } from "../src/verifier";

const testDir = dirname(fileURLToPath(import.meta.url));

describe("runWideSearch", () => {
  test("fixture run creates readable synthesis and evidence files", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-runtime-"));

    const result = await runWideSearch({
      objective: "Map evidence-backed research workflow requirements",
      profile: "fixture",
      workDir,
    });

    expect(result.verification.status).toBe("passed");
    expect(result.runDir).toInclude(".runs/wide-search/");

    const synthesis = await readFile(join(result.runDir, "synthesis.md"), "utf8");
    expect(synthesis).toInclude("## Answer");
    expect(synthesis).toInclude("## Evidence");
    expect(synthesis).toInclude("S001");

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.executionProfile).toBe("fixture");

    const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
    expect(sourceLedger).toInclude('"decision":"accepted"');
    expect(sourceLedger).toInclude('"decision":"rejected"');
  });

  test("fixture-asset-mgmt run processes buyside role fixture", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-asset-mgmt-"));

    const result = await runWideSearch({
      objective: "Analyze asset management roles and responsibilities",
      profile: "fixture-asset-mgmt",
      workDir,
    });

    expect(result.verification.status).toBe("passed");

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.executionProfile).toBe("fixture-asset-mgmt");

    const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
    expect(sourceLedger).toInclude("AM-FO-PM");
    expect(sourceLedger).toInclude('"decision":"accepted"');
    expect(sourceLedger).toInclude('"decision":"rejected"');
  });

  test("fixture-sellside-research run processes sellside role fixture", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-sellside-"));

    const result = await runWideSearch({
      objective: "Analyze sell-side research organization roles",
      profile: "fixture-sellside-research",
      workDir,
    });

    expect(result.verification.status).toBe("passed");

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.executionProfile).toBe("fixture-sellside-research");

    const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
    expect(sourceLedger).toInclude("SS-COVERAGE");
    expect(sourceLedger).toInclude('"decision":"accepted"');
    expect(sourceLedger).toInclude('"decision":"rejected"');
  });

  test("fixture-youtube-niche run processes YouTube niche fixture", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-youtube-niche-"));

    const result = await runWideSearch({
      objective: "Discover YouTube niche opportunities with evidence",
      profile: "fixture-youtube-niche",
      workDir,
    });

    expect(result.verification.status).toBe("passed");

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.executionProfile).toBe("fixture-youtube-niche");

    const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
    expect(sourceLedger).toInclude("YT-NICHE-001");
    expect(sourceLedger).toInclude('"decision":"accepted"');
    expect(sourceLedger).toInclude('"decision":"rejected"');
  });

  test("local-command run ingests JSONL source candidates from command provider", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-local-command-"));
    const providerCommand = process.execPath;
    const providerArgs = [join(testDir, "../fixtures/jsonl-provider.ts")];

    const result = await runWideSearch({
      objective: "Evaluate command-backed source ingestion",
      profile: "local-command",
      providerCommand,
      providerArgs,
      workDir,
    });

    expect(result.verification.status).toBe("passed");

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.executionProfile).toBe("local-command");

    const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
    expect(sourceLedger).toInclude("L001");
    expect(sourceLedger).toInclude('"decision":"accepted"');
    expect(sourceLedger).toInclude('"decision":"rejected"');
  });

  test("fixture-paul-graham-corpus run processes Paul Graham essays", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-paul-graham-"));

    const result = await runWideSearch({
      objective: "Summarize Paul Graham's essays on startups",
      profile: "fixture-paul-graham-corpus",
      workDir,
    });

    expect(result.verification.status).toBe("passed");

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.executionProfile).toBe("fixture-paul-graham-corpus");

    const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
    expect(sourceLedger).toInclude("PG-001");
    expect(sourceLedger).toInclude('"decision":"accepted"');
  });

  test("dry-run writes cost estimate without executing", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-dry-run-"));

    const result = await runWideSearch({
      objective: "Dry run test",
      profile: "fixture",
      workDir,
      budget: { dryRun: true },
    });

    expect(result.verification.status).toBe("passed");
    expect(result.verification.warnings.some((w) => w.includes("dry-run"))).toBeTrue();

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.usageMetrics.estimatedCostUsd).toBe(0);
    expect(runJson.usageMetrics.notes).toInclude("Dry run");
  });
});

describe("verifyRun", () => {
  test("fails unsupported claims", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-bad-run-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, "source-ledger.jsonl"), '{"id":"S001","decision":"accepted"}\n');
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      '{"id":"C001","claim":"unsupported","sourceIds":[],"confidence":"medium","freshness":"current"}\n',
    );

    const verification = await verifyRun({ runDir, minAcceptedSources: 1 });

    expect(verification.status).toBe("failed");
    expect(verification.failures.some((failure) => failure.includes("unsupported"))).toBeTrue();
  });

  test("detects duplicate claims", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-dup-run-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, "source-ledger.jsonl"),
      '{"id":"S001","decision":"accepted","sourceClass":"primary-analysis"}\n',
    );
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      [
        '{"id":"C001","claim":"Portfolio managers make final investment decisions","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
        '{"id":"C002","claim":"Portfolio managers make final investment decisions","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
        '{"id":"C003","claim":"Analysts conduct research but do not decide","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
      ].join("\n") + "\n",
    );

    const verification = await verifyRun({ runDir });

    expect(verification.status).toBe("passed");
    expect(verification.duplicateClaimGroups.length).toBe(1);
    expect(verification.warnings.some((w) => w.includes("duplicate"))).toBeTrue();
  });

  test("warns on stale claim ratio", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-stale-run-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, "source-ledger.jsonl"),
      '{"id":"S001","decision":"accepted","sourceClass":"primary-analysis"}\n',
    );
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      [
        '{"id":"C001","claim":"Old fact","sourceIds":["S001"],"confidence":"high","freshness":"stale"}',
        '{"id":"C002","claim":"Current fact","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
      ].join("\n") + "\n",
    );

    const verification = await verifyRun({ runDir, maxStaleRatio: 0.6 });

    expect(verification.status).toBe("passed");
    expect(verification.staleClaims).toBe(1);
    expect(verification.warnings.some((w) => w.includes("stale"))).toBeTrue();
  });

  test("fails when stale claim ratio exceeds threshold", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-stale-fail-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, "source-ledger.jsonl"),
      '{"id":"S001","decision":"accepted","sourceClass":"primary-analysis"}\n',
    );
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      [
        '{"id":"C001","claim":"Old fact one","sourceIds":["S001"],"confidence":"high","freshness":"stale"}',
        '{"id":"C002","claim":"Old fact two","sourceIds":["S001"],"confidence":"high","freshness":"stale"}',
        '{"id":"C003","claim":"Current fact","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
      ].join("\n") + "\n",
    );

    const verification = await verifyRun({ runDir, maxStaleRatio: 0.5 });

    expect(verification.status).toBe("failed");
    expect(verification.failures.some((f) => f.includes("stale claim ratio"))).toBeTrue();
  });

  test("fails on broken source references", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-broken-ref-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, "source-ledger.jsonl"),
      '{"id":"S001","decision":"accepted","sourceClass":"primary-analysis"}\n',
    );
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      '{"id":"C001","claim":"Fact","sourceIds":["S002"],"confidence":"high","freshness":"current"}\n',
    );

    const verification = await verifyRun({ runDir });

    expect(verification.status).toBe("failed");
    expect(verification.failures.some((f) => f.includes("broken source references"))).toBeTrue();
  });

  test("reports coverage gaps", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-gap-run-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, "source-ledger.jsonl"),
      [
        '{"id":"S001","decision":"accepted","sourceClass":"primary-analysis","reason":"meets relevance and authority threshold"}',
        '{"id":"S002","decision":"rejected","sourceClass":"primary-analysis","reason":"duplicate or low-value source"}',
        '{"id":"S003","decision":"rejected","sourceClass":"secondary","reason":"duplicate or low-value source"}',
      ].join("\n") + "\n",
    );
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      '{"id":"C001","claim":"Fact","sourceIds":["S001"],"confidence":"low","freshness":"unknown"}\n',
    );

    const verification = await verifyRun({ runDir, maxLowConfidenceRatio: 1.0 });

    expect(verification.status).toBe("passed");
    expect(verification.coverageGaps.length).toBeGreaterThan(0);
    expect(verification.lowConfidenceClaims).toBe(1);
    expect(verification.unknownFreshnessClaims).toBe(1);
  });

  test("detects conflicting claims", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-conflict-run-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, "source-ledger.jsonl"),
      '{"id":"S001","decision":"accepted","sourceClass":"primary-analysis"}\n',
    );
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      [
        '{"id":"C001","claim":"Tesla stock will increase next quarter","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
        '{"id":"C002","claim":"Tesla stock will decrease next quarter","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
        '{"id":"C003","claim":"Tesla opened a new factory","sourceIds":["S001"],"confidence":"high","freshness":"current"}',
      ].join("\n") + "\n",
    );

    const verification = await verifyRun({ runDir });

    expect(verification.status).toBe("passed");
    expect(verification.conflictingClaimPairs.length).toBe(1);
    expect(verification.warnings.some((w) => w.includes("conflicting"))).toBeTrue();
  });
});
