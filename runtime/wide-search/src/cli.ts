#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBenchmark } from './benchmark';
import {
  EXECUTION_PROFILES,
  EXPORT_FORMATS,
  buildRunOptionsForCli,
  buildVerifyOptionsForCli,
  getBooleanFlag,
  getFlag,
  parseCliArgs,
  validateEnum,
} from './cli-contract';
import { printUsage } from './cli-help';
import { handleLeaderboard } from './cli-leaderboard';
import { handleWorker } from './cli-worker';
import { exportRun, supportedExportFormats } from './export';
import { getInitInstructions, runInit } from './init';
import { defaultLogger, setDefaultLoggerLevel } from './logger';
import { PROVIDER_REGISTRY } from './providers';
import { runWideSearch } from './runtime';
import type { ExecutionProfile, RunWideSearchResult } from './types';
import { verifyRun } from './verifier';

async function inspectRun(runDir: string): Promise<{
  runId: string;
  objective: string;
  executionProfile: ExecutionProfile;
  status: string;
  verificationStatus: string;
  acceptedSources: number;
  rejectedSources: number;
}> {
  const run = JSON.parse(await readFile(join(runDir, 'run.json'), 'utf8')) as {
    runId: string;
    objective: string;
    executionProfile: ExecutionProfile;
    status: string;
  };
  const verification = JSON.parse(
    await readFile(join(runDir, 'verification-report.json'), 'utf8')
  ) as {
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
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const result: RunWideSearchResult = await runWideSearch(await buildRunOptionsForCli(args));
  console.log(JSON.stringify(result, null, 2));
}

async function handleVerify(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const result = await verifyRun(buildVerifyOptionsForCli(args));
  console.log(JSON.stringify(result, null, 2));
}

async function handleInspect(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const runDir = getFlag(parsed, 'run-dir');
  if (!runDir) {
    throw new Error('inspect command requires --run-dir');
  }
  const result = await inspectRun(runDir);
  console.log(JSON.stringify(result, null, 2));
}

async function handleExport(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const runDir = getFlag(parsed, 'run-dir');
  const format = validateEnum('format', getFlag(parsed, 'format'), EXPORT_FORMATS);
  const outPath = getFlag(parsed, 'out');

  if (!runDir) {
    throw new Error('export command requires --run-dir');
  }
  if (!format || !supportedExportFormats().includes(format)) {
    throw new Error('export command requires --format json|csv|html|svg');
  }

  const destination = await exportRun({ runDir, format, outPath });
  console.log(JSON.stringify({ exportedTo: destination }, null, 2));
}

async function handleBenchmark(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const profile = validateEnum('profile', getFlag(parsed, 'profile'), EXECUTION_PROFILES);
  const workDir = getFlag(parsed, 'work-dir') ?? process.cwd();

  if (!profile) {
    throw new Error('benchmark command requires --profile');
  }

  // Golden answers are bundled per fixture for repeatable CI scoring.
  const { goldenAnswers } = await import('../fixtures/golden-answers');
  const golden = goldenAnswers[profile];
  if (!golden) {
    throw new Error(`No golden answer defined for profile: ${profile}`);
  }

  const result = await runBenchmark(profile, golden, workDir);
  console.log(JSON.stringify(result, null, 2));
}

async function handleInit(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const nonInteractive = getBooleanFlag(parsed, 'non-interactive');
  const local = getBooleanFlag(parsed, 'local');
  const workDir = getFlag(parsed, 'work-dir') ?? process.cwd();

  const result = await runInit({
    nonInteractive,
    global: !local,
    workDir,
  });

  console.log(JSON.stringify({ configPath: result.configPath, configured: result.wrote }, null, 2));
  defaultLogger.info(getInitInstructions(result.configPath));
}

function handleProviders(): void {
  const providers = PROVIDER_REGISTRY.map((descriptor) => ({
    name: descriptor.name,
    env: descriptor.envVar || 'none',
    credential: descriptor.credentialTypeLabel,
    note: descriptor.description,
  }));
  console.log(JSON.stringify(providers, null, 2));
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--verbose') || rawArgs.includes('-v')) {
    setDefaultLoggerLevel('debug');
  }
  const filteredArgs = rawArgs.filter((arg) => arg !== '--verbose' && arg !== '-v');
  const [command, ...args] = filteredArgs;

  if (command === 'run' || command === 'research') {
    await handleRun(args);
    return;
  }

  if (command === 'verify') {
    await handleVerify(args);
    return;
  }

  if (command === 'inspect') {
    await handleInspect(args);
    return;
  }

  if (command === 'export') {
    await handleExport(args);
    return;
  }

  if (command === 'benchmark') {
    await handleBenchmark(args);
    return;
  }

  if (command === 'leaderboard') {
    await handleLeaderboard(args);
    return;
  }

  if (command === 'init') {
    await handleInit(args);
    return;
  }

  if (command === 'worker') {
    await handleWorker(args);
    return;
  }

  if (command === 'providers') {
    handleProviders();
    return;
  }

  if (command === '--help' || command === '-h') {
    printUsage(0);
    return;
  }

  if (command === undefined) {
    printUsage();
    return;
  }

  defaultLogger.error(`Unknown command: ${command}`);
  printUsage();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: Error) => {
    defaultLogger.error(error.message);
    process.exitCode = 1;
  });
}
