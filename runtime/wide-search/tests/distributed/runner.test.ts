import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runDistributedWideSearch } from "../../src/distributed/runner";
import { readFile } from "node:fs/promises";

describe("runDistributedWideSearch", () => {
  test("fixture distributed run produces accepted sources and verification", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-dist-run-"));

    const result = await runDistributedWideSearch({
      objective: "Summarize Paul Graham essays",
      profile: "fixture-paul-graham-corpus",
      workDir,
      distributed: { enabled: true, workers: 2 },
    });

    expect(result.verification.status).toBe("passed");
    expect(result.verification.acceptedSources).toBeGreaterThan(0);

    const runJson = JSON.parse(await readFile(join(result.runDir, "run.json"), "utf8"));
    expect(runJson.executionProfile).toBe("fixture-paul-graham-corpus");

    const synthesis = await readFile(join(result.runDir, "synthesis.md"), "utf8");
    expect(synthesis).toInclude("Summarize Paul Graham essays");
    expect(synthesis).toInclude(result.runId);
    expect(synthesis).toInclude("## Accepted sources");
    expect(synthesis).toInclude("| Source | Class | Decision | Relevance | Authority | Freshness | Diversity | Extraction |");
    expect(synthesis).toInclude("## Claims");
    expect(synthesis).toInclude("| Claim | Sources | Confidence | Freshness |");
    expect(synthesis).toInclude("## Verification details");
    expect(synthesis).toInclude("**Verification status:** passed");

    const jobJson = JSON.parse(await readFile(join(result.runDir, "distributed-job.json"), "utf8"));
    expect(jobJson.status).toBe("completed");
    expect(jobJson.tasks.every((t: { status: string }) => t.status === "completed")).toBe(true);
  });
});
