import { describe, expect, test } from "bun:test";

import {
  clearLeaderboard,
  compareRuns,
  generateHtmlReport,
  getLeaderboard,
  recordEntry,
} from "../src/leaderboard";
import type { BenchmarkResult, LeaderboardEntry } from "../src/types";

describe("leaderboard", () => {
  function makeEntry(runId: string, profile: string, f1: number): LeaderboardEntry {
    const scores: BenchmarkResult = {
      profile,
      runId,
      runDir: `/tmp/${runId}`,
      precision: 0.1,
      recall: 1,
      citationAccuracy: 1,
      f1,
      passed: true,
    };
    return {
      runId,
      profile,
      runDir: `/tmp/${runId}`,
      timestamp: new Date().toISOString(),
      scores,
    };
  }

  test("records and retrieves entries", async () => {
    await clearLeaderboard();
    await recordEntry(makeEntry("r1", "fixture-paul-graham-corpus", 0.2));
    await recordEntry(makeEntry("r2", "fixture-github-repo-landscape", 0.3));

    const all = await getLeaderboard();
    expect(all.length).toBe(2);

    const filtered = await getLeaderboard("fixture-paul-graham-corpus");
    expect(filtered.length).toBe(1);
    expect(filtered[0].runId).toBe("r1");
  });

  test("compareRuns returns requested entries", async () => {
    await clearLeaderboard();
    await recordEntry(makeEntry("r1", "fixture-paul-graham-corpus", 0.2));
    await recordEntry(makeEntry("r2", "fixture-paul-graham-corpus", 0.25));
    await recordEntry(makeEntry("r3", "fixture-market-scan", 0.3));

    const comparison = await compareRuns(["r1", "r2"]);
    expect(comparison.entries.length).toBe(2);
    expect(comparison.entries.map((e) => e.runId).sort()).toEqual(["r1", "r2"]);
  });

  test("generateHtmlReport writes valid HTML", async () => {
    await clearLeaderboard();
    await recordEntry(makeEntry("r1", "fixture-paul-graham-corpus", 0.2));

    const outPath = `/tmp/kasw-leaderboard-test-${Date.now()}.html`;
    const result = await generateHtmlReport(await getLeaderboard(), outPath);
    expect(result).toBe(outPath);

    const content = await Bun.file(outPath).text();
    expect(content).toInclude("<!DOCTYPE html>");
    expect(content).toInclude("fixture-paul-graham-corpus");
  });
});
