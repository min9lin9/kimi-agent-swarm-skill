import { spawn } from 'node:child_process';

import type { Source, UsageMetrics } from '../types';
import type { SearchOptions, SearchProvider } from './search-provider';

interface InsaneSearchPayload {
  ok?: boolean;
  url?: string;
  final_url?: string;
  finalUrl?: string;
  title?: string;
  content?: string;
  text?: string;
  markdown?: string;
  summary?: string;
  stop_reason?: string;
  stopReason?: string;
  error?: string;
  metadata?: {
    title?: string;
    description?: string;
    publishedAt?: string;
  };
}

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function trimTrailingPunctuation(url: string): string {
  return url.replace(/[),.;]+$/, '');
}

function splitArgs(raw: string): string[] {
  return raw.trim() ? raw.trim().split(/\s+/).filter(Boolean) : [];
}

function uniqueUrls(objective: string): string[] {
  const envUrls = splitArgs((process.env.INSANE_SEARCH_URLS ?? '').replace(/,/g, ' '));
  const objectiveUrls = objective.match(URL_PATTERN) ?? [];
  return [...new Set([...envUrls, ...objectiveUrls].map(trimTrailingPunctuation))];
}

function hostnameLabel(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return rawUrl;
  }
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

function truncate(text: string, maxLength = 600): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function isAuthenticationBoundary(text: string): boolean {
  return /auth_required|authentication required|login required|requires login|paywall|subscription required/i.test(
    text
  );
}

function sourceId(index: number): string {
  return `INSANE-${String(index + 1).padStart(3, '0')}`;
}

function payloadText(payload: InsaneSearchPayload): string {
  return (
    normalizeText(payload.content) ??
    normalizeText(payload.markdown) ??
    normalizeText(payload.text) ??
    normalizeText(payload.summary) ??
    normalizeText(payload.metadata?.description) ??
    'insane-search returned public page metadata without extractable body text.'
  );
}

function sourceFromPayload(payload: InsaneSearchPayload, fallbackUrl: string, index: number): Source {
  const url = payload.final_url ?? payload.finalUrl ?? payload.url ?? fallbackUrl;
  const text = payloadText(payload);
  const title =
    normalizeText(payload.title) ??
    normalizeText(payload.metadata?.title) ??
    `insane-search result for ${hostnameLabel(url)}`;

  return {
    id: sourceId(index),
    url,
    title,
    sourceClass: 'unknown',
    publishedAt: payload.metadata?.publishedAt ?? today(),
    discoveredBy: 'insane-search-provider',
    scores: {
      relevance: 5,
      authority: 2,
      freshness: 3,
      diversity: 3,
      extractionValue: 5,
    },
    claims: [truncate(text)],
  };
}

function sourceFromText(text: string, fallbackUrl: string, index: number): Source {
  const normalized = normalizeText(text) ?? 'insane-search returned empty output.';
  return {
    id: sourceId(index),
    url: fallbackUrl,
    title: `insane-search result for ${hostnameLabel(fallbackUrl)}`,
    sourceClass: 'unknown',
    publishedAt: today(),
    discoveredBy: 'insane-search-provider',
    scores: {
      relevance: 5,
      authority: 2,
      freshness: 3,
      diversity: 3,
      extractionValue: 4,
    },
    claims: [truncate(normalized)],
  };
}

function pickJsonCandidate(output: string): string | undefined {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('{') && line.endsWith('}')) {
      return line;
    }
  }

  const trimmed = output.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed : undefined;
}

function sourceFromOutput(output: string, fallbackUrl: string, index: number): Source {
  if (isAuthenticationBoundary(output)) {
    throw new Error(`insane-search stopped at an authentication/paywall boundary for ${fallbackUrl}`);
  }

  const jsonCandidate = pickJsonCandidate(output);
  if (!jsonCandidate) {
    return sourceFromText(output, fallbackUrl, index);
  }

  let payload: InsaneSearchPayload;
  try {
    payload = JSON.parse(jsonCandidate) as InsaneSearchPayload;
  } catch {
    return sourceFromText(output, fallbackUrl, index);
  }

  const stopReason = normalizeText(payload.stop_reason ?? payload.stopReason ?? payload.error) ?? '';
  if (payload.ok === false && isAuthenticationBoundary(stopReason)) {
    throw new Error(`insane-search stopped at an authentication/paywall boundary for ${fallbackUrl}`);
  }
  if (payload.ok === false && stopReason) {
    throw new Error(`insane-search failed for ${fallbackUrl}: ${stopReason}`);
  }

  return sourceFromPayload(payload, fallbackUrl, index);
}

function mockResults(objective: string): Source[] {
  return [
    {
      id: 'INSANE-001',
      url: 'https://example.com/public-page',
      title: `Mock insane-search result for: ${objective}`,
      sourceClass: 'unknown',
      publishedAt: today(),
      discoveredBy: 'insane-search-provider-mock',
      scores: { relevance: 5, authority: 2, freshness: 4, diversity: 3, extractionValue: 5 },
      claims: [
        'Mock public-page extraction result for deterministic tests. Real runs call an insane-search-compatible command.',
      ],
    },
  ];
}

function commandTimeoutMs(): number {
  const value = Number(process.env.INSANE_SEARCH_TIMEOUT_MS ?? '120000');
  return Number.isFinite(value) && value > 0 ? value : 120000;
}

function runInsaneSearchCommand(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = process.env.INSANE_SEARCH_COMMAND ?? 'python3';
    const args = [...splitArgs(process.env.INSANE_SEARCH_ARGS ?? '-m engine --json'), url];
    const cwd = process.env.INSANE_SEARCH_CWD || undefined;
    const timeoutMs = commandTimeoutMs();
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new Error(`insane-search command timed out after ${timeoutMs}ms for ${url}`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`insane-search command exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export class InsaneSearchProvider implements SearchProvider {
  readonly name = 'insane-search';
  private readonly metrics?: UsageMetrics;

  constructor(_credential = '', metrics?: UsageMetrics) {
    this.metrics = metrics;
  }

  async search({ objective, maxResults }: SearchOptions): Promise<Source[]> {
    if (process.env.INSANE_SEARCH_MOCK === '1') {
      if (this.metrics) {
        this.metrics.providerCalls += 1;
        this.metrics.apiCalls += 1;
      }
      return mockResults(objective).slice(0, maxResults);
    }

    const urls = uniqueUrls(objective).slice(0, Math.max(1, maxResults));
    if (urls.length === 0) {
      throw new Error(
        'insane-search provider requires at least one public URL in the objective or INSANE_SEARCH_URLS. Use a normal web-search provider to discover URLs first.'
      );
    }

    const sources: Source[] = [];
    for (const [index, url] of urls.entries()) {
      if (this.metrics) {
        this.metrics.providerCalls += 1;
        this.metrics.apiCalls += 1;
      }
      const output = await runInsaneSearchCommand(url);
      sources.push(sourceFromOutput(output, url, index));
    }

    return sources;
  }
}
