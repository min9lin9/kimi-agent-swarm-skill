import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import type { Source, UsageMetrics } from '../types';
import { isPublicInternetIp } from './public-reader-address';
import type { SearchOptions, SearchProvider } from './search-provider';

export { isPublicInternetIp } from './public-reader-address';

type UrlBlockReason =
  | 'invalid_url'
  | 'unsupported_protocol'
  | 'private_address'
  | 'blocked_host'
  | 'userinfo_not_supported'
  | 'hostname_not_supported';

type PublicUrlCheck =
  | { readonly ok: true; readonly url: URL }
  | { readonly ok: false; readonly reason: UrlBlockReason };

type Resolver = (hostname: string) => Promise<readonly string[]>;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
type FetchTarget = { readonly url: URL; readonly headers: Headers };

export interface PublicReaderProviderOptions {
  readonly resolver?: Resolver;
  readonly fetcher?: Fetcher;
  readonly metrics?: UsageMetrics;
  readonly maxBytes?: number;
  readonly maxRedirects?: number;
  readonly allowHostnames?: boolean;
}

interface PublicReaderUrlOptions {
  readonly allowHostnames?: boolean;
}

const DEFAULT_MAX_BYTES = 200_000;
const DEFAULT_MAX_REDIRECTS = 3;
const ACCEPT_HEADER = 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1';

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal']);

function normalizeHost(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

async function defaultResolver(hostname: string): Promise<readonly string[]> {
  const answers = await lookup(hostname, { all: true });
  return answers.map((answer) => answer.address);
}

async function resolveHostname(hostname: string, resolver: Resolver): Promise<readonly string[]> {
  try {
    return await resolver(hostname);
  } catch {
    return [];
  }
}

function isBlockedHostname(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return BLOCKED_HOSTS.has(host) || host.endsWith('.local');
}

function formatIpHost(address: string): string {
  return isIP(address) === 6 ? `[${address}]` : address;
}

function urlForAddress(url: URL, address: string): URL {
  const port = url.port ? `:${url.port}` : '';
  return new URL(`${url.protocol}//${formatIpHost(address)}${port}${url.pathname}${url.search}`);
}

export async function validatePublicReaderUrl(
  rawUrl: string,
  resolver: Resolver = defaultResolver,
  options: PublicReaderUrlOptions = {}
): Promise<PublicUrlCheck> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'unsupported_protocol' };
  }

  if (url.username || url.password) {
    return { ok: false, reason: 'userinfo_not_supported' };
  }

  const host = normalizeHost(url.hostname);
  if (isBlockedHostname(host)) {
    return { ok: false, reason: 'blocked_host' };
  }

  if (isIP(host)) {
    return isPublicInternetIp(host) ? { ok: true, url } : { ok: false, reason: 'private_address' };
  }

  if (options.allowHostnames !== true) {
    return { ok: false, reason: 'hostname_not_supported' };
  }

  const addresses = await resolveHostname(host, resolver);
  if (addresses.length === 0 || addresses.some((address) => !isPublicInternetIp(address))) {
    return { ok: false, reason: 'private_address' };
  }

  return { ok: true, url };
}

function extractUrls(text: string, maxResults: number): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')]+/g) ?? [];
  return [...new Set(matches)].slice(0, maxResults);
}

function titleFromHtml(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || fallback;
}

function textFromHtml(html: string): string {
  return html
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, ' ')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAuthWall(response: Response, body: string): boolean {
  if (response.status === 401 || response.status === 403) {
    return true;
  }
  const lower = body.toLowerCase();
  return lower.includes('login required') || lower.includes('sign in to continue');
}

async function readCappedText(response: Response, maxBytes: number): Promise<string | undefined> {
  if (!response.body) {
    const text = await response.text();
    return text.length <= maxBytes ? text : undefined;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';

  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }
    text += decoder.decode(next.value, { stream: true });
    if (text.length > maxBytes) {
      await reader.cancel();
      return undefined;
    }
  }

  text += decoder.decode();
  return text.length <= maxBytes ? text : undefined;
}

export class PublicReaderProvider implements SearchProvider {
  readonly name = 'public-reader';
  private readonly resolver: Resolver;
  private readonly fetcher: Fetcher;
  private readonly metrics?: UsageMetrics;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;
  private readonly allowHostnames: boolean;

  constructor(options: PublicReaderProviderOptions = {}) {
    this.resolver = options.resolver ?? defaultResolver;
    this.fetcher = options.fetcher ?? fetch;
    this.metrics = options.metrics;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    this.allowHostnames = options.allowHostnames ?? false;
  }

  async search({ objective, maxResults }: SearchOptions): Promise<Source[]> {
    if (this.metrics) {
      this.metrics.providerCalls += 1;
      this.metrics.apiCalls += 1;
    }

    const sources: Source[] = [];
    for (const rawUrl of extractUrls(objective, maxResults)) {
      const source = await this.readSource(rawUrl, sources.length + 1);
      if (source) {
        sources.push(source);
      }
    }
    return sources;
  }

  private async readSource(rawUrl: string, index: number): Promise<Source | undefined> {
    const checked = await validatePublicReaderUrl(rawUrl, this.resolver, {
      allowHostnames: this.allowHostnames,
    });
    if (!checked.ok) {
      return undefined;
    }

    const response = await this.fetchPublicUrl(checked.url, 0);
    if (!response) {
      return undefined;
    }

    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > this.maxBytes) {
      return undefined;
    }

    const html = await readCappedText(response, this.maxBytes);
    if (!html || isAuthWall(response, html)) {
      return undefined;
    }

    const bodyText = textFromHtml(html);
    if (!bodyText) {
      return undefined;
    }

    return {
      id: `PUBLIC-${String(index).padStart(3, '0')}`,
      url: rawUrl,
      title: titleFromHtml(html, checked.url.hostname),
      sourceClass: 'unknown',
      discoveredBy: 'public-reader',
      scores: { relevance: 3, authority: 2, freshness: 2, diversity: 3, extractionValue: 3 },
      claims: [bodyText.slice(0, 500)],
    };
  }

  private async fetchPublicUrl(url: URL, redirectCount: number): Promise<Response | undefined> {
    const target = await this.fetchTargetFor(url);
    if (!target) {
      return undefined;
    }

    let response: Response;
    try {
      response = await this.fetcher(target.url.href, {
        headers: target.headers,
        redirect: 'manual',
      });
    } catch {
      return undefined;
    }

    if (response.status >= 300 && response.status < 400) {
      if (redirectCount >= this.maxRedirects) {
        return undefined;
      }
      const location = response.headers.get('location');
      if (!location) {
        return undefined;
      }
      const nextUrl = new URL(location, url);
      const checked = await validatePublicReaderUrl(nextUrl.href, this.resolver, {
        allowHostnames: this.allowHostnames,
      });
      return checked.ok ? this.fetchPublicUrl(checked.url, redirectCount + 1) : undefined;
    }

    return response.ok ? response : undefined;
  }

  private async fetchTargetFor(url: URL): Promise<FetchTarget | undefined> {
    const headers = new Headers({ accept: ACCEPT_HEADER });
    const host = normalizeHost(url.hostname);
    if (isIP(host)) {
      return { url, headers };
    }

    if (url.protocol === 'https:') {
      return undefined;
    }

    const addresses = await resolveHostname(host, this.resolver);
    const address = addresses[0];
    if (!address || addresses.some((candidate) => !isPublicInternetIp(candidate))) {
      return undefined;
    }

    headers.set('host', url.host);
    return { url: urlForAddress(url, address), headers };
  }
}
