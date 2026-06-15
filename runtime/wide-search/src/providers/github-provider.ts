import type { Source, SourceScores, UsageMetrics } from '../types';
import { fetchWithRetry } from './fetch-utils';
import type { SearchOptions, SearchProvider } from './search-provider';

interface GitHubRepoItem {
  full_name: string;
  html_url: string;
  description?: string | null;
  stargazers_count: number;
  updated_at: string;
  language?: string | null;
}

interface GitHubResponse {
  items?: GitHubRepoItem[];
}

function parseUpdatedAt(dateText?: string): string {
  if (!dateText) return new Date().toISOString().split('T')[0];
  const parsed = new Date(dateText);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return parsed.toISOString().split('T')[0];
}

function authorityFromStars(stars: number): number {
  if (stars >= 50000) return 5;
  if (stars >= 10000) return 4;
  if (stars >= 1000) return 3;
  if (stars >= 100) return 2;
  return 1;
}

function buildScores(stars: number): SourceScores {
  return {
    relevance: 5,
    authority: authorityFromStars(stars),
    freshness: 4,
    diversity: 3,
    extractionValue: 5,
  };
}

function mockResults(objective: string): Source[] {
  const now = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'GITHUB-001',
      url: 'https://github.com/mock/example-agent',
      title: `Mock repo for: ${objective}`,
      sourceClass: 'primary',
      publishedAt: now,
      discoveredBy: 'github-search-provider-mock',
      scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 5 },
      claims: [
        'Mock GitHub repository for CI and development.',
        'Language: TypeScript, Stars: 15000.',
      ],
    },
    {
      id: 'GITHUB-002',
      url: 'https://github.com/mock/secondary-agent',
      title: 'Mock secondary agent repo',
      sourceClass: 'primary',
      publishedAt: now,
      discoveredBy: 'github-search-provider-mock',
      scores: { relevance: 4, authority: 3, freshness: 4, diversity: 4, extractionValue: 4 },
      claims: ['Secondary mock repository with lower star count.'],
    },
  ];
}

export class GitHubSearchProvider implements SearchProvider {
  readonly name = 'github';
  private readonly token: string;
  private readonly metrics?: UsageMetrics;

  constructor(token: string, metrics?: UsageMetrics) {
    this.token = token;
    this.metrics = metrics;
  }

  async search({ objective, maxResults }: SearchOptions): Promise<Source[]> {
    if (this.metrics) {
      this.metrics.providerCalls += 1;
      this.metrics.apiCalls += 1;
    }

    if (process.env.GITHUB_MOCK === '1') {
      return mockResults(objective).slice(0, maxResults);
    }

    if (!this.token) {
      throw new Error(
        'GITHUB_TOKEN environment variable is required for the github provider (or set GITHUB_MOCK=1 for CI)'
      );
    }

    const url = new URL('https://api.github.com/search/repositories');
    url.searchParams.set('q', objective);
    url.searchParams.set('per_page', String(Math.min(Math.max(maxResults, 1), 100)));
    url.searchParams.set('sort', 'stars');
    url.searchParams.set('order', 'desc');

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetchWithRetry(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      if (response.status === 403 || response.status === 429) {
        throw new Error(`GitHub API rate limit exceeded (${response.status}): ${body}`);
      }
      if (response.status === 401) {
        throw new Error('GitHub API unauthorized (401): check GITHUB_TOKEN');
      }
      throw new Error(`GitHub API error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as GitHubResponse;
    const results = data.items ?? [];

    return results.slice(0, maxResults).map((result, index) => {
      const description = result.description ?? '';
      const language = result.language ?? 'unknown';
      const stars = result.stargazers_count ?? 0;
      return {
        id: `GITHUB-${String(index + 1).padStart(3, '0')}`,
        url: result.html_url,
        title: result.full_name,
        sourceClass: 'primary',
        publishedAt: parseUpdatedAt(result.updated_at),
        discoveredBy: 'github-search-provider',
        scores: buildScores(stars),
        claims: [
          [description, `Language: ${language}`, `Stars: ${stars.toLocaleString()}`]
            .filter(Boolean)
            .join(' '),
        ],
      };
    });
  }
}
