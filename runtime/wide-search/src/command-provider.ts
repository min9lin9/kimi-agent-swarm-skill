import { spawn } from 'node:child_process';
import type { Source } from './types';

export interface LoadCommandSourcesOptions {
  providerCommand?: string;
  providerArgs?: string[];
  objective?: string;
}

interface ProviderEvent {
  type?: string;
  source?: Source;
  sources?: Source[];
  message?: string;
}

export async function loadCommandSources({
  providerCommand,
  providerArgs = [],
  objective,
}: LoadCommandSourcesOptions = {}): Promise<Source[]> {
  if (!providerCommand) {
    throw new Error('local-command profile requires providerCommand');
  }

  const output = await runProviderCommand({ providerCommand, providerArgs, objective });
  return parseProviderJsonl(output);
}

function runProviderCommand({
  providerCommand,
  providerArgs,
  objective,
}: Required<Pick<LoadCommandSourcesOptions, 'providerCommand' | 'providerArgs'>> &
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

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
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
