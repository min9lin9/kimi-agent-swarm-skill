#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { runWideSearch } from "./runtime.mjs";
import { verifyRun } from "./verifier.mjs";

function readFlag(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

async function inspectRun(runDir) {
  const run = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));
  const verification = JSON.parse(await readFile(join(runDir, "verification-report.json"), "utf8"));
  return {
    runId: run.runId,
    objective: run.objective,
    executionProfile: run.executionProfile,
    status: run.status,
    verificationStatus: verification.status,
    acceptedSources: verification.acceptedSources,
    rejectedSources: verification.rejectedSources
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (command === "run") {
    const objective = readFlag(args, "--objective") ?? args.join(" ");
    const workDir = readFlag(args, "--work-dir", process.cwd());
    const profile = readFlag(args, "--profile", "fixture");
    const providerCommand = readFlag(args, "--provider-command");
    const providerArgsRaw = readFlag(args, "--provider-args", "");
    const providerArgs = providerArgsRaw ? providerArgsRaw.split(" ").filter(Boolean) : [];
    const result = await runWideSearch({ objective, workDir, profile, providerCommand, providerArgs });
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
    const result = await inspectRun(runDir);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.error("Usage: node src/cli.mjs <run|verify|inspect>");
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
