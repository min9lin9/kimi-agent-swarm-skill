import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exportRun } from "../src/export";
import type { Run } from "../src/types";

describe("exportRun", () => {
  async function createRunDir(): Promise<string> {
    const runDir = await mkdtemp(join(tmpdir(), "wide-search-export-"));
    const run: Run = {
      runId: "RUN-001",
      objective: "Test export",
      executionProfile: "fixture",
      status: "completed",
      createdAt: new Date().toISOString(),
      usageMetrics: { providerCalls: 1, apiCalls: 1 },
    };
    await writeFile(join(runDir, "run.json"), JSON.stringify(run));
    await writeFile(
      join(runDir, "source-ledger.jsonl"),
      JSON.stringify({
        id: "S001",
        url: "https://example.com/source",
        title: "Source",
        sourceClass: "primary",
        discoveredBy: "test",
        decision: "accepted",
        reason: "test",
        scores: { relevance: 5, authority: 5 },
      }) + "\n",
    );
    await writeFile(
      join(runDir, "claim-ledger.jsonl"),
      JSON.stringify({
        id: "C001",
        claim: "Exported claim",
        sourceIds: ["S001"],
        confidence: "high",
        freshness: "current",
      }) + "\n",
    );
    return runDir;
  }

  test("exports JSON with run, sources, and claims", async () => {
    const runDir = await createRunDir();
    const outPath = await exportRun({ runDir, format: "json" });

    expect(outPath).toEndWith("export.json");
    const content = JSON.parse(await readFile(outPath, "utf8"));
    expect(content.runId).toBe("RUN-001");
    expect(content.sources.length).toBe(1);
    expect(content.claims.length).toBe(1);
  });

  test("exports CSV with claim rows", async () => {
    const runDir = await createRunDir();
    const outPath = await exportRun({ runDir, format: "csv" });

    expect(outPath).toEndWith("export.csv");
    const content = await readFile(outPath, "utf8");
    expect(content).toStartWith("claim_id,claim,source_ids,confidence,freshness,url");
    expect(content).toInclude("Exported claim");
    expect(content).toInclude("https://example.com/source");
  });

  test("exports HTML synthesis report", async () => {
    const runDir = await createRunDir();
    const outPath = await exportRun({ runDir, format: "html" });

    expect(outPath).toEndWith("export.html");
    const content = await readFile(outPath, "utf8");
    expect(content).toInclude("<!DOCTYPE html>");
    expect(content).toInclude("Test export");
    expect(content).toInclude("Exported claim");
    expect(content).toInclude("Source");
  });

  test("exports SVG source-claim graph", async () => {
    const runDir = await createRunDir();
    const outPath = await exportRun({ runDir, format: "svg" });

    expect(outPath).toEndWith("export.svg");
    const content = await readFile(outPath, "utf8");
    expect(content).toStartWith("<?xml version=\"1.0\"");
    expect(content).toInclude("<svg");
    expect(content).toInclude("Test export");
    expect(content).toInclude("Source");
    expect(content).toInclude("Exported claim");
    expect(content).toInclude("Source ↔ Claim Graph");
  });

  test("throws for unsupported format", async () => {
    const runDir = await createRunDir();
    await expect(
      // @ts-expect-error intentionally invalid format for test
      exportRun({ runDir, format: "xml" }),
    ).rejects.toThrow("Unsupported export format");
  });
});
