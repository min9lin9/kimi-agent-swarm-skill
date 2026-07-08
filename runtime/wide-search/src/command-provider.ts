import { spawn } from 'node:child_process';
import type { Source } from './types';

export interface LoadCommandSourcesOptions {
  providerCommand?: string;
  providerArgs?: string[];
  objective?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
}

interface ProviderEvent {
  type?: string;
  source?: Source;
  sources?: Source[];
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_BYTES = 1_000_000;
const KILL_GRACE_MS = 500;
const textEncoder = new TextEncoder();

export async function loadCommandSources({
  providerCommand,
  providerArgs = [],
  objective,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
}: LoadCommandSourcesOptions = {}): Promise<Source[]> {
  if (!providerCommand) {
    throw new Error('local-command profile requires providerCommand');
  }

  const output = await runProviderCommand({
    providerCommand,
    providerArgs,
    objective,
    timeoutMs,
    maxOutputBytes,
  });
  return parseProviderJsonl(output);
}

function runProviderCommand({
  providerCommand,
  providerArgs,
  objective,
  timeoutMs,
  maxOutputBytes,
}: Required<
  Pick<
    LoadCommandSourcesOptions,
    'providerCommand' | 'providerArgs' | 'timeoutMs' | 'maxOutputBytes'
  >
> &
  Pick<LoadCommandSourcesOptions, 'objective'>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(providerCommand, providerArgs, {
      env: {
        ...process.env,
        WIDE_SEARCH_OBJECTIVE: objective,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let outputBytes = 0;
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;

    const timeout = setTimeout(() => {
      fail(new Error(`provider command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    function fail(error: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      terminateChild();
      reject(error);
    }

    function terminateChild(): void {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, KILL_GRACE_MS);
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      outputBytes += textEncoder.encode(chunk).byteLength;
      if (outputBytes > maxOutputBytes) {
        fail(new Error(`provider command exceeded output limit of ${maxOutputBytes} bytes`));
        return;
      }
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      outputBytes += textEncoder.encode(chunk).byteLength;
      if (outputBytes > maxOutputBytes) {
        fail(new Error(`provider command exceeded output limit of ${maxOutputBytes} bytes`));
        return;
      }
      stderr += chunk;
    });
    child.on('error', (error: Error) => {
      fail(error);
    });
    child.on('close', (code: number | null) => {
      if (killTimer) clearTimeout(killTimer);
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`provider command exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function parseProviderJsonl(output: string): Source[] {
  const sources: Source[] = [];
  const errors: string[] = [];

  for (const [index, line] of output.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let event: ProviderEvent;
    try {
      event = JSON.parse(line) as ProviderEvent;
    } catch {
      errors.push(`line ${index + 1} is not valid JSON`);
      continue;
    }

    if (event.type === 'source_candidate' && event.source) {
      sources.push(event.source);
      continue;
    }

    if (event.type === 'complete' && event.sources) {
      sources.push(...event.sources);
      continue;
    }

    if (event.type === 'error') {
      errors.push(event.message ?? `provider error on line ${index + 1}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`provider output errors: ${errors.join('; ')}`);
  }

  if (sources.length === 0) {
    throw new Error('provider emitted no source events');
  }

  return sources;
}
