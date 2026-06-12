#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { runWideSearch } from "./runtime";
import { verifyRun } from "./verifier";
import type { ExecutionProfile, RunWideSearchResult } from "./types";

function readFlag(args: string[], name: string, fallback: string | undefined = undefined): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

async function inspectRun(runDir: string): Promise<{
  runId: string;
  objective: string;
  executionProfile: ExecutionProfile;
  status: string;
  verificationStatus: string;
  acceptedSources: number;
  rejectedSources: number;
}> {
  const run = JSON.parse(await readFile(join(runDir, "run.json"), "utf8")) as {
    runId: string;
    objective: string;
    executionProfile: ExecutionProfile;
    status: string;
  };
  const verification = JSON.parse(await readFile(join(runDir, "verification-report.json"), "utf8")) as {
    status: string;
    acceptedSources: number;
    rejectedSources: number;
  };
  return {
    runId: run.runId,
    objective: run.objective,
    executionProfile: run.executionProfile,
    status: run.status,
    verificationStatus: verification.status,
    acceptedSources: verification.acceptedSources,
    rejectedSources: verification.rejectedSources,
  };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "run") {
    const objective = readFlag(args, "--objective") ?? args.join(" ");
    const workDir = readFlag(args, "--work-dir", process.cwd());
    const profile = (readFlag(args, "--profile", "fixture") ?? "fixture") as ExecutionProfile;
    const providerCommand = readFlag(args, "--provider-command");
    const providerArgsRaw = readFlag(args, "--provider-args", "");
    const providerArgs = providerArgsRaw ? providerArgsRaw.split(" ").filter(Boolean) : [];

    if (!objective) {
      throw new Error("run command requires --objective or a positional objective");
    }

    const result: RunWideSearchResult = await runWideSearch({
      objective,
      workDir,
      profile,
      providerCommand,
      providerArgs,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "verify") {
    const runDir = readFlag(args, "--run-dir");
    const result = await verifyRun({ runDir });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "inspect") {
    const runDir = readFlag(args, "--run-dir");
    if (!runDir) {
      throw new Error("inspect command requires --run-dir");
    }
    const result = await inspectRun(runDir);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error("Usage: bun run src/cli.ts <run|verify|inspect>");
  console.error("Profiles: fixture, fixture-asset-mgmt, fixture-sellside-research, local-command");
  process.exitCode = 1;
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
