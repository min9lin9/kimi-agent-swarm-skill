import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "../src/config";
import { runInit } from "../src/init";

describe("runInit", () => {
  test("non-interactive init writes empty global config", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-init-"));
    const result = await runInit({ nonInteractive: true, global: false, workDir });

    expect(result.configPath).toEndWith(".kasw.json");
    expect(result.wrote.length).toBe(0);

    const config = await loadConfig(workDir);
    expect(config.defaults.provider).toBe("mock");
  });

  test("non-interactive init picks up env vars", async () => {
    process.env.TAVILY_API_KEY = "test-tavily-key";
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-init-env-"));

    const result = await runInit({ nonInteractive: true, global: false, workDir });

    expect(result.wrote).toContain("tavily (from TAVILY_API_KEY)");

    const config = await loadConfig(workDir);
    expect(config.providers.tavily?.apiKey).toBe("test-tavily-key");

    delete process.env.TAVILY_API_KEY;
  });
});
