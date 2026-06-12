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
});

describe("verifyRun", () => {
  test("fails unsupported claims", async () => {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-bad-run-"));
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, "source-ledger.jsonl"), '{"id":"S001","decision":"accepted"}\n');
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      '{"id":"C001","claim":"unsupported","sourceIds":[]}\n',
    );

    const verification = await verifyRun({ runDir, minAcceptedSources: 1 });

    expect(verification.status).toBe("failed");
    expect(verification.failures.some((failure) => failure.includes("unsupported"))).toBeTrue();
  });
});
