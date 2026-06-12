import { describe, expect, test } from "bun:test";

import { runBenchmark } from "../src/benchmark";
import type { GoldenAnswer } from "../src/types";

describe("runBenchmark", () => {
  const golden: GoldenAnswer = {
    expectedClaims: [
      "Startups should initially do things that don't scale.",
      "The maker's schedule requires long uninterrupted blocks of time.",
    ],
    expectedSourceUrls: ["http://www.paulgraham.com/ds.html"],
  };

  test("fixture-paul-graham-corpus scores above threshold", async () => {
    const result = await runBenchmark("fixture-paul-graham-corpus", golden);

    expect(result.profile).toBe("fixture-paul-graham-corpus");
    expect(result.precision).toBeGreaterThan(0);
    expect(result.recall).toBeGreaterThan(0);
    expect(result.citationAccuracy).toBe(1);
    expect(result.f1).toBeGreaterThan(0);
    expect(result.passed).toBe(true);
  });
});
