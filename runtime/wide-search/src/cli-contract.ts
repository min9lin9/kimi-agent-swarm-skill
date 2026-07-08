import { loadConfig } from './config';
import { defaultLogger } from './logger';
import { listProviderNames } from './providers';
import type {
  BudgetOptions,
  DistributedRunOptions,
  ExecutionProfile,
  ExportFormat,
  RunWideSearchOptions,
  SearchDepth,
} from './types';
import type { VerifyRunOptions } from './verifier';

export const EXECUTION_PROFILES: ExecutionProfile[] = [
  'fixture',
  'fixture-asset-mgmt',
  'fixture-sellside-research',
  'fixture-youtube-niche',
  'fixture-paul-graham-corpus',
  'fixture-github-repo-landscape',
  'fixture-market-scan',
  'local-command',
  'web-search',
];

export const SEARCH_DEPTHS: SearchDepth[] = ['light', 'standard', 'deep', 'maximum'];

export const PROVIDER_NAMES = listProviderNames();

export const QUEUE_TYPES: Array<'memory' | 'redis'> = ['memory', 'redis'];

export const EXPORT_FORMATS: ExportFormat[] = ['json', 'csv', 'html', 'svg'];

export interface ParsedArgs {
  flags: Record<string, string | true>;
  positional: string[];
}

export function parseCliArgs(args: string[]): ParsedArgs {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  let terminated = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (terminated) {
      positional.push(arg);
      continue;
    }
    if (arg === '--') {
      terminated = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        const name = arg.slice(2, eqIndex);
        flags[name] = arg.slice(eqIndex + 1);
      } else {
        const name = arg.slice(2);
        const next = args[i + 1];
        if (next !== undefined && next !== '--' && !next.startsWith('-')) {
          flags[name] = next;
          i += 1;
        } else {
          flags[name] = true;
        }
      }
      continue;
    }
    positional.push(arg);
  }

  return { flags, positional };
}

export function getFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags[name];
  if (value === true) return undefined;
  return value;
}

export function getBooleanFlag(parsed: ParsedArgs, name: string): boolean {
  const value = parsed.flags[name];
  if (value === undefined) return false;
  if (value === 'false') return false;
  return true;
}

export function getNumberFlag(parsed: ParsedArgs, name: string): number | undefined {
  const raw = getFlag(parsed, name);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`Flag --${name} requires a numeric value`);
  }
  if (value < 0) {
    throw new Error(`Flag --${name} must be non-negative`);
  }
  return value;
}

export function warnDeprecatedRedisCredentialFlags(parsed: ParsedArgs): void {
  if (
    parsed.flags['redis-password'] === undefined &&
    parsed.flags['redis-username'] === undefined
  ) {
    return;
  }
  defaultLogger.warn(
    'Deprecated: pass Redis credentials with REDIS_URL, REDIS_PASSWORD, or REDIS_USERNAME instead of --redis-password/--redis-username.'
  );
}

function isAllowedValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.some((allowedValue) => allowedValue === value);
}

export function validateEnum<T extends string>(
  name: string,
  value: string | undefined,
  allowed: readonly T[]
): T | undefined {
  if (value === undefined) return undefined;
  if (!isAllowedValue(value, allowed)) {
    throw new Error(`Invalid --${name}: "${value}". Allowed values: ${allowed.join(', ')}`);
  }
  return value;
}

export async function buildRunOptionsForCli(
  args: string[],
  env: Record<string, string | undefined> = process.env
): Promise<RunWideSearchOptions> {
  const parsed = parseCliArgs(args);
  warnDeprecatedRedisCredentialFlags(parsed);
  const workDir = getFlag(parsed, 'work-dir') ?? process.cwd();
  const config = await loadConfig(workDir);

  const replayRunId = getFlag(parsed, 'replay');
  let objective: string | undefined = getFlag(parsed, 'objective') ?? parsed.positional.join(' ');
  if (replayRunId && objective === '') {
    objective = undefined;
  }
  const profile =
    validateEnum(
      'profile',
      getFlag(parsed, 'profile') ?? config.defaults.profile,
      EXECUTION_PROFILES
    ) ?? 'fixture';
  const providerCommand = getFlag(parsed, 'provider-command');
  const providerArgsRaw = getFlag(parsed, 'provider-args') ?? '';
  const providerArgs = providerArgsRaw ? providerArgsRaw.split(' ').filter(Boolean) : [];

  if (profile === 'local-command' && !providerCommand) {
    throw new Error('local-command profile requires --provider-command');
  }

  if (profile !== 'local-command' && providerCommand) {
    throw new Error('--provider-command is only valid with --profile local-command');
  }

  if (profile !== 'local-command' && providerArgsRaw) {
    throw new Error('--provider-args is only valid with --profile local-command');
  }

  const providerName =
    validateEnum(
      'provider',
      getFlag(parsed, 'provider') ?? getFlag(parsed, 'provider-name') ?? config.defaults.provider,
      PROVIDER_NAMES
    ) ?? 'mock';
  const searchDepth =
    validateEnum('depth', getFlag(parsed, 'depth') ?? config.defaults.depth, SEARCH_DEPTHS) ??
    'standard';

  const useCache = getBooleanFlag(parsed, 'use-cache');
  const strictClaims = getBooleanFlag(parsed, 'strict-claims');
  const allowPublicReaderHostnames =
    getBooleanFlag(parsed, 'allow-public-reader-hostnames') ||
    config.providers['public-reader']?.allowHostnames === true;
  const distributedEnabled = getBooleanFlag(parsed, 'distributed');
  const workers = getNumberFlag(parsed, 'workers');
  const maxRetries = getNumberFlag(parsed, 'max-retries');
  const queueType = validateEnum('queue-type', getFlag(parsed, 'queue-type'), QUEUE_TYPES);
  const resumeJobId = getFlag(parsed, 'resume-job-id');
  const redisUrl = getFlag(parsed, 'redis-url') ?? env.REDIS_URL;
  const redisPassword = getFlag(parsed, 'redis-password') ?? env.REDIS_PASSWORD;
  const redisUsername = getFlag(parsed, 'redis-username') ?? env.REDIS_USERNAME;
  const taskTimeoutMs = getNumberFlag(parsed, 'task-timeout-ms');

  if (!objective && !replayRunId && !resumeJobId) {
    throw new Error(
      'run command requires --objective, a positional objective, --replay, or --resume-job-id'
    );
  }

  const budget: BudgetOptions = {
    maxCostUsd: getNumberFlag(parsed, 'max-cost-usd'),
    maxProviderCalls: getNumberFlag(parsed, 'max-provider-calls'),
    maxApiCalls: getNumberFlag(parsed, 'max-api-calls'),
    dryRun: getBooleanFlag(parsed, 'dry-run'),
  };

  const distributed: DistributedRunOptions | undefined = distributedEnabled
    ? {
        enabled: true,
        workers,
        maxRetries,
        queueType,
        resumeJobId,
        redisUrl,
        redisPassword,
        redisUsername,
        taskTimeoutMs,
      }
    : undefined;

  return {
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
    distributed,
    strictClaims,
    allowPublicReaderHostnames,
  };
}

export function buildVerifyOptionsForCli(args: string[]): VerifyRunOptions {
  const parsed = parseCliArgs(args);
  return {
    runDir: getFlag(parsed, 'run-dir'),
    strictClaims: getBooleanFlag(parsed, 'strict-claims'),
    requireCompletionEvidence: getBooleanFlag(parsed, 'require-completion-evidence'),
  };
}
