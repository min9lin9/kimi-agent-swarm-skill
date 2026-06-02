import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { runWideSearch } from "../src/runtime.mjs";
import { verifyRun } from "../src/verifier.mjs";

const testDir = dirname(fileURLToPath(import.meta.url));

test("fixture run creates readable synthesis and evidence files", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "wide-search-runtime-"));

  const result = await runWideSearch({
    objective: "Map evidence-backed research workflow requirements",
    profile: "fixture",
    workDir
  });

  assert.equal(result.verification.status, "passed");
  assert.ok(result.runDir.includes(".runs/wide-search/"));

  const synthesis = await readFile(join(result.runDir, "synthesis.md"), "utf8");
  assert.match(synthesis, /## Answer/);
  assert.match(synthesis, /## Evidence/);
  assert.match(synthesis, /S001/);

  const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
  assert.equal(runJson.executionProfile, "fixture");

  const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
  assert.match(sourceLedger, /"decision":"accepted"/);
  assert.match(sourceLedger, /"decision":"rejected"/);
});

test("local-command run ingests JSONL source candidates from command provider", async () => {
  const workDir = await mkdtemp(join(tmpdir(), "wide-search-local-command-"));
  const providerCommand = process.execPath;
  const providerArgs = [join(testDir, "../fixtures/jsonl-provider.mjs")];

  const result = await runWideSearch({
    objective: "Evaluate command-backed source ingestion",
    profile: "local-command",
    providerCommand,
    providerArgs,
    workDir
  });

  assert.equal(result.verification.status, "passed");

  const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
  assert.equal(runJson.executionProfile, "local-command");

  const sourceLedger = await readFile(join(result.runDir, "source-ledger.jsonl"), "utf8");
  assert.match(sourceLedger, /L001/);
  assert.match(sourceLedger, /"decision":"accepted"/);
  assert.match(sourceLedger, /"decision":"rejected"/);
});

test("verifier fails unsupported claims", async () => {
  const runDir = await mkdtemp(join(tmpdir(), "wide-search-bad-run-"));
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "source-ledger.jsonl"), "{\"id\":\"S001\",\"decision\":\"accepted\"}\n");
  await writeFile(join(runDir, "claim-ledger.jsonl"), "{\"id\":\"C001\",\"claim\":\"unsupported\",\"sourceIds\":[]}\n");

  const verification = await verifyRun({ runDir, minAcceptedSources: 1 });

  assert.equal(verification.status, "failed");
  assert.ok(verification.failures.some((failure) => failure.includes("unsupported")));
});
