import { inferSourceClass, parsePublishedAt } from '../provider-utils';
import type { Source, SourceScores, UsageMetrics } from '../types';
import { fetchWithRetry } from './fetch-utils';
import type { SearchOptions, SearchProvider } from './search-provider';

interface BraveResult {
  title: string;
  url: string;
  description?: string;
  age?: string;
  extra_snippets?: string[];
}

interface BraveResponse {
  web?: {
    results?: BraveResult[];
  };
}

function buildScores(sourceClass: 'primary' | 'secondary', rank: number): SourceScores {
  // Slight relevance decay by rank.
  const relevance = Math.max(2, 5 - Math.floor(rank / 5));
  return {
    relevance,
    authority: sourceClass === 'primary' ? 4 : 3,
    freshness: 4,
    diversity: 3,
    extractionValue: sourceClass === 'primary' ? 4 : 3,
  };
}

function mockResults(objective: string): Source[] {
  const now = new Date().toISOString().split('T')[0];
  return [
    {
      id: 'BRAVE-001',
      url: 'https://example.com/mock/brave-result-1',
      title: `Brave mock result for: ${objective}`,
      sourceClass: 'primary',
      publishedAt: now,
      discoveredBy: 'brave-search-provider-mock',
      scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
      claims: [
        'Brave mock search returned a high-relevance primary source.',
        'This is a deterministic fixture for CI and development.',
      ],
    },
    {
      id: 'BRAVE-002',
      url: 'https://example.com/mock/brave-result-2',
      title: 'Brave mock secondary perspective',
      sourceClass: 'secondary',
      publishedAt: now,
      discoveredBy: 'brave-search-provider-mock',
      scores: { relevance: 3, authority: 3, freshness: 4, diversity: 4, extractionValue: 3 },
      claims: ['Secondary sources broaden coverage in a wide search.'],
    },
  ];
}

export class BraveSearchProvider implements SearchProvider {
  readonly name = 'brave';
  private readonly apiKey: string;
  private readonly metrics?: UsageMetrics;

  constructor(apiKey: string, metrics?: UsageMetrics) {
    this.apiKey = apiKey;
    this.metrics = metrics;
  }

  async search({ objective, maxResults }: SearchOptions): Promise<Source[]> {
    if (this.metrics) {
      this.metrics.providerCalls += 1;
      this.metrics.apiCalls += 1;
    }

    if (process.env.BRAVE_MOCK === '1') {
      return mockResults(objective).slice(0, maxResults);
    }

    if (!this.apiKey) {
      throw new Error(
        'BRAVE_API_KEY environment variable is required for the brave provider (or set BRAVE_MOCK=1 for CI)'
      );
    }

    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', objective);
    url.searchParams.set('count', String(Math.min(Math.max(maxResults, 1), 20)));

    const response = await fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      if (response.status === 429) {
        throw new Error(`Brave API rate limit exceeded (429): ${body}`);
      }
      if (response.status === 401) {
        throw new Error('Brave API unauthorized (401): check BRAVE_API_KEY');
      }
      throw new Error(`Brave API error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as BraveResponse;
    const results = data.web?.results ?? [];

    return results.slice(0, maxResults).map((result, index) => {
      const sourceClass = inferSourceClass(result.url);
      const claim = [result.description, ...(result.extra_snippets ?? [])]
        .filter(Boolean)
        .join(' ');
      return {
        id: `BRAVE-${String(index + 1).padStart(3, '0')}`,
        url: result.url,
        title: result.title,
        sourceClass,
        publishedAt: parsePublishedAt(result.age),
        discoveredBy: 'brave-search-provider',
        scores: buildScores(sourceClass, index),
        claims: [claim || result.title],
      };
    });
  }
}
