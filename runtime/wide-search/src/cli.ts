#!/usr/bin/env bun
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runBenchmark } from './benchmark';
import {
  EXECUTION_PROFILES,
  EXPORT_FORMATS,
  QUEUE_TYPES,
  buildRunOptionsForCli,
  buildVerifyOptionsForCli,
  getBooleanFlag,
  getFlag,
  parseCliArgs,
  validateEnum,
} from './cli-contract';
import { maxResultsForDepth } from './costs';
import { MemoryQueueAdapter } from './distributed/memory-adapter';
import type { QueueAdapter } from './distributed/queue-adapter';
import { RedisQueueAdapter } from './distributed/redis-adapter';
import { ExternalWorkerPool } from './distributed/worker-pool';
import { exportRun, supportedExportFormats } from './export';
import { getInitInstructions, runInit } from './init';
import { clearLeaderboard, compareRuns, generateHtmlReport, getLeaderboard } from './leaderboard';
import { defaultLogger, setDefaultLoggerLevel } from './logger';
import { PROVIDER_REGISTRY, listProviderNames } from './providers';
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

async function handleLeaderboard(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const profile = validateEnum('profile', getFlag(parsed, 'profile'), EXECUTION_PROFILES);
  const compareRaw = getFlag(parsed, 'compare');
  const html = getBooleanFlag(parsed, 'html');
  const outPath = getFlag(parsed, 'out');
  const shouldClear = getBooleanFlag(parsed, 'clear');
  const workDir = getFlag(parsed, 'work-dir') ?? process.cwd();
  const leaderboardPath = getFlag(parsed, 'leaderboard-path');

  if (shouldClear) {
    if (!getBooleanFlag(parsed, 'yes')) {
      throw new Error('--clear requires --yes');
    }
    await clearLeaderboard(workDir, leaderboardPath);
    console.log(JSON.stringify({ cleared: true }, null, 2));
    return;
  }

  if (compareRaw) {
    const runIds = compareRaw.split(',').map((id) => id.trim());
    const comparison = await compareRuns(runIds, workDir, leaderboardPath);
    if (comparison.missing.length > 0) {
      defaultLogger.warn(`Run IDs not found in leaderboard: ${comparison.missing.join(', ')}`);
    }
    console.log(JSON.stringify(comparison, null, 2));
    return;
  }

  const entries = await getLeaderboard(profile, workDir, leaderboardPath);

  if (html) {
    const destination = outPath ?? 'leaderboard-report.html';
    await generateHtmlReport(entries, destination);
    console.log(JSON.stringify({ report: destination }, null, 2));
    return;
  }

  console.log(JSON.stringify(entries, null, 2));
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

async function handleWorker(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const jobId = getFlag(parsed, 'job-id');
  const workerId = getFlag(parsed, 'worker-id') ?? 'cli-worker';
  const workDir = getFlag(parsed, 'work-dir') ?? process.cwd();
  const queueType = validateEnum('queue-type', getFlag(parsed, 'queue-type'), QUEUE_TYPES);
  const redisUrl = getFlag(parsed, 'redis-url') ?? process.env.REDIS_URL;
  const redisPassword = getFlag(parsed, 'redis-password') ?? process.env.REDIS_PASSWORD;
  const redisUsername = getFlag(parsed, 'redis-username') ?? process.env.REDIS_USERNAME;

  if (!jobId) {
    throw new Error('worker command requires --job-id');
  }

  const adapter: QueueAdapter =
    queueType === 'redis'
      ? new RedisQueueAdapter({ redisUrl, username: redisUsername, password: redisPassword })
      : new MemoryQueueAdapter({ workDir });

  const job = await adapter.getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  try {
    await new ExternalWorkerPool({
      adapter,
      profile: job.executionProfile,
      providerName: job.providerName,
      searchDepth: job.searchDepth,
      perTaskMaxResults:
        job.tasks.length === 0 || job.executionProfile.startsWith('fixture')
          ? undefined
          : Math.ceil(maxResultsForDepth(job.searchDepth) / job.tasks.length),
      useCache: job.useCache ?? false,
      budget: job.budget ?? {},
      workDir,
    }).runOnce(jobId, workerId);
  } finally {
    if (adapter.quit) {
      await adapter.quit();
    }
  }

  console.log(
    JSON.stringify({ workerId, done: true, metrics: { providerCalls: 0, apiCalls: 0 } }, null, 2)
  );
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

function printUsage(exitCode = 1): void {
  defaultLogger.error(
    'Usage: kasw [options] <research|run|verify|inspect|export|benchmark|leaderboard|providers|init|worker>'
  );
  defaultLogger.error('');
  defaultLogger.error('Global options:');
  defaultLogger.error('  --verbose, -v                   enable debug logging');
  defaultLogger.error('');
  defaultLogger.error('  research|run <objective> [options]');
  defaultLogger.error(
    '    --profile <profile>           fixture | fixture-asset-mgmt | fixture-sellside-research |'
  );
  defaultLogger.error(
    '                                  fixture-youtube-niche | fixture-paul-graham-corpus |'
  );
  defaultLogger.error(
    '                                  fixture-github-repo-landscape | fixture-market-scan |'
  );
  defaultLogger.error('                                  local-command | web-search');
  defaultLogger.error(
    `    --provider|--provider-name    ${listProviderNames().join(' | ')} (default: mock)`
  );
  defaultLogger.error(
    '    --depth <depth>               light | standard (default) | deep | maximum'
  );
  defaultLogger.error('    --work-dir <dir>              working directory (default: cwd)');
  defaultLogger.error(
    '    --max-cost-usd <n>            abort if estimated/actual cost exceeds budget'
  );
  defaultLogger.error('    --max-provider-calls <n>      abort if provider calls exceed budget');
  defaultLogger.error('    --max-api-calls <n>           abort if API calls exceed budget');
  defaultLogger.error('    --dry-run                     print cost estimate without executing');
  defaultLogger.error(
    '    --use-cache                   reuse cached provider responses when available'
  );
  defaultLogger.error(
    '    --strict-claims               write strict claim artifacts and gate synthesis'
  );
  defaultLogger.error(
    '    --replay <run-id>             rerun a previous run with the same inputs'
  );
  defaultLogger.error('    --distributed                 execute using distributed worker tasks');
  defaultLogger.error(
    '    --workers <n>                 number of in-process workers; use 0 for external-only (default: 4)'
  );
  defaultLogger.error('    --max-retries <n>             max retries per task (default: 3)');
  defaultLogger.error(
    '    --queue-type <memory|redis>   distributed queue backend (default: memory)'
  );
  defaultLogger.error('    --resume-job-id <id>          resume a previous distributed job');
  defaultLogger.error('    --redis-url <url>             Redis URL (defaults to REDIS_URL env)');
  defaultLogger.error(
    '    --redis-password <password>   Redis password (defaults to REDIS_PASSWORD env)'
  );
  defaultLogger.error(
    '    --redis-username <username>   Redis username (defaults to REDIS_USERNAME env)'
  );
  defaultLogger.error(
    '    --task-timeout-ms <n>         max time a distributed task may stay running (default: 300000)'
  );
  defaultLogger.error('');
  defaultLogger.error('  verify --run-dir <dir> [--strict-claims] [--require-completion-evidence]');
  defaultLogger.error('');
  defaultLogger.error(
    '  worker --job-id <id> [--worker-id <id>] [--work-dir <dir>] [--queue-type <memory|redis>]'
  );
  defaultLogger.error('    --redis-url <url>             Redis URL (defaults to REDIS_URL env)');
  defaultLogger.error(
    '    --redis-password <password>   Redis password (defaults to REDIS_PASSWORD env)'
  );
  defaultLogger.error(
    '    --redis-username <username>   Redis username (defaults to REDIS_USERNAME env)'
  );
  defaultLogger.error('  init [--non-interactive] [--local] [--work-dir <dir>]');
  defaultLogger.error('  verify --run-dir <dir>');
  defaultLogger.error('  inspect --run-dir <dir>');
  defaultLogger.error('  export --run-dir <dir> --format json|csv|html|svg [--out <path>]');
  defaultLogger.error('  benchmark --profile <fixture> [--work-dir <dir>]');
  defaultLogger.error('  leaderboard [options]');
  defaultLogger.error('    --profile <fixture>           filter by profile');
  defaultLogger.error('    --compare <run-id-1>,<run-id-2>  compare specific runs');
  defaultLogger.error('    --html [--out <path>]         generate HTML report');
  defaultLogger.error(
    '    --clear                       clear all leaderboard entries (requires --yes)'
  );
  defaultLogger.error('    --yes                         confirm destructive operations');
  defaultLogger.error('    --work-dir <dir>              working directory (default: cwd)');
  defaultLogger.error('    --leaderboard-path <path>     custom leaderboard file path');
  defaultLogger.error(
    '  providers                      list available providers and required env vars'
  );
  process.exitCode = exitCode;
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
