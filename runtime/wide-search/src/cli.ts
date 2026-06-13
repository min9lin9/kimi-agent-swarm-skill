#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { runBenchmark } from "./benchmark";
import { loadConfig } from "./config";
import { exportRun, supportedExportFormats } from "./export";
import { getInitInstructions, runInit } from "./init";
import { runWideSearch } from "./runtime";
import { verifyRun } from "./verifier";
import type { BudgetOptions, ExecutionProfile, ExportFormat, RunWideSearchResult } from "./types";

function readFlag(args: string[], name: string, fallback: string | undefined = undefined): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function readNumberFlag(args: string[], name: string): number | undefined {
  const raw = readFlag(args, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Flag ${name} requires a numeric value`);
  }
  return value;
}

function readBooleanFlag(args: string[], name: string): boolean {
  return args.includes(name);
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

async function handleRun(args: string[]): Promise<void> {
  const workDir = readFlag(args, "--work-dir", process.cwd());
  const config = await loadConfig(workDir);

  const objective = readFlag(args, "--objective") ?? args.join(" ");
  const profile = (readFlag(args, "--profile", config.defaults.profile) ?? "fixture") as ExecutionProfile;
  const providerCommand = readFlag(args, "--provider-command");
  const providerArgsRaw = readFlag(args, "--provider-args", "");
  const providerArgs = providerArgsRaw ? providerArgsRaw.split(" ").filter(Boolean) : [];
  const providerName = readFlag(args, "--provider") ?? readFlag(args, "--provider-name", config.defaults.provider);
  const searchDepth = (readFlag(args, "--depth", config.defaults.depth) ?? "standard") as
    | "light"
    | "standard"
    | "deep"
    | "maximum";

  const replayRunId = readFlag(args, "--replay");
  const useCache = readBooleanFlag(args, "--use-cache");

  if (!objective && !replayRunId) {
    throw new Error("run command requires --objective, a positional objective, or --replay");
  }

  const budget: BudgetOptions = {
    maxCostUsd: readNumberFlag(args, "--max-cost-usd"),
    maxProviderCalls: readNumberFlag(args, "--max-provider-calls"),
    maxApiCalls: readNumberFlag(args, "--max-api-calls"),
    dryRun: readBooleanFlag(args, "--dry-run"),
  };

  const result: RunWideSearchResult = await runWideSearch({
    objective,
    workDir,
    profile,
    providerCommand,
    providerArgs,
    providerName,
    searchDepth,
    budget,
    useCache,
    replayRunId,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function handleVerify(args: string[]): Promise<void> {
  const runDir = readFlag(args, "--run-dir");
  const result = await verifyRun({ runDir });
  console.log(JSON.stringify(result, null, 2));
}

async function handleInspect(args: string[]): Promise<void> {
  const runDir = readFlag(args, "--run-dir");
  if (!runDir) {
    throw new Error("inspect command requires --run-dir");
  }
  const result = await inspectRun(runDir);
  console.log(JSON.stringify(result, null, 2));
}

async function handleExport(args: string[]): Promise<void> {
  const runDir = readFlag(args, "--run-dir");
  const format = readFlag(args, "--format") as ExportFormat | undefined;
  const outPath = readFlag(args, "--out");

  if (!runDir) {
    throw new Error("export command requires --run-dir");
  }
  if (!format || !supportedExportFormats().includes(format)) {
    throw new Error(`export command requires --format json|csv`);
  }

  const destination = await exportRun({ runDir, format, outPath });
  console.log(JSON.stringify({ exportedTo: destination }, null, 2));
}

async function handleBenchmark(args: string[]): Promise<void> {
  const profile = readFlag(args, "--profile");
  const workDir = readFlag(args, "--work-dir", process.cwd());

  if (!profile) {
    throw new Error("benchmark command requires --profile");
  }

  // Golden answers are bundled per fixture for repeatable CI scoring.
  const { goldenAnswers } = await import("../fixtures/golden-answers");
  const golden = goldenAnswers[profile];
  if (!golden) {
    throw new Error(`No golden answer defined for profile: ${profile}`);
  }

  const result = await runBenchmark(profile, golden, workDir);
  console.log(JSON.stringify(result, null, 2));
}

async function handleInit(args: string[]): Promise<void> {
  const nonInteractive = readBooleanFlag(args, "--non-interactive");
  const local = readBooleanFlag(args, "--local");
  const workDir = readFlag(args, "--work-dir", process.cwd());

  const result = await runInit({
    nonInteractive,
    global: !local,
    workDir,
  });

  console.log(JSON.stringify({ configPath: result.configPath, configured: result.wrote }, null, 2));
  console.log(getInitInstructions());
}

function handleProviders(): void {
  const providers = [
    { name: "mock", env: "none", note: "deterministic demo/CI" },
    { name: "serper", env: "SERPER_API_KEY", note: "Google Search via Serper.dev" },
    { name: "tavily", env: "TAVILY_API_KEY", note: "AI-native search" },
    { name: "brave", env: "BRAVE_API_KEY", note: "Brave Search API" },
    { name: "github", env: "GITHUB_TOKEN", note: "GitHub repository search" },
  ];
  console.log(JSON.stringify(providers, null, 2));
}

function printUsage(): void {
  console.error("Usage: kasw <research|run|verify|inspect|export|benchmark|providers|init>");
  console.error("");
  console.error("  research|run <objective> [options]");
  console.error("    --profile <profile>           fixture | fixture-asset-mgmt | fixture-sellside-research |");
  console.error("                                  fixture-youtube-niche | fixture-paul-graham-corpus |");
  console.error("                                  fixture-github-repo-landscape | fixture-market-scan |");
  console.error("                                  local-command | web-search");
  console.error("    --provider|--provider-name    mock (default) | serper | tavily | brave | github");
  console.error("    --depth <depth>               light | standard (default) | deep | maximum");
  console.error("    --work-dir <dir>              working directory (default: cwd)");
  console.error("    --max-cost-usd <n>            abort if estimated/actual cost exceeds budget");
  console.error("    --max-provider-calls <n>      abort if provider calls exceed budget");
  console.error("    --max-api-calls <n>           abort if API calls exceed budget");
  console.error("    --dry-run                     print cost estimate without executing");
  console.error("    --use-cache                   reuse cached provider responses when available");
  console.error("    --replay <run-id>             rerun a previous run with the same inputs");
  console.error("");
  console.error("  init [--non-interactive] [--local] [--work-dir <dir>]");
  console.error("  verify --run-dir <dir>");
  console.error("  inspect --run-dir <dir>");
  console.error("  export --run-dir <dir> --format json|csv [--out <path>]");
  console.error("  benchmark --profile <fixture> [--work-dir <dir>]");
  console.error("  providers                      list available providers and required env vars");
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  if (command === "run" || command === "research") {
    await handleRun(args);
    return;
  }

  if (command === "verify") {
    await handleVerify(args);
    return;
  }

  if (command === "inspect") {
    await handleInspect(args);
    return;
  }

  if (command === "export") {
    await handleExport(args);
    return;
  }

  if (command === "benchmark") {
    await handleBenchmark(args);
    return;
  }

  if (command === "init") {
    await handleInit(args);
    return;
  }

  if (command === "providers") {
    handleProviders();
    return;
  }

  if (command === "--help" || command === "-h" || command === undefined) {
    printUsage();
    return;
  }

  console.error(`Unknown command: ${command}`);
  printUsage();
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
