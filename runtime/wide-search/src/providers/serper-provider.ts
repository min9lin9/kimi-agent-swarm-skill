import { inferSourceClass, parsePublishedAt } from '../provider-utils';
import type { Source, SourceScores, UsageMetrics } from '../types';
import { fetchWithRetry } from './fetch-utils';
import type { SearchOptions, SearchProvider } from './search-provider';

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  searchParameters?: {
    q: string;
  };
}

function buildScores(sourceClass: 'primary' | 'secondary'): SourceScores {
  return {
    relevance: 4,
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
      id: 'SERPER-001',
      url: 'https://example.com/mock/serper-result-1',
      title: `Serper mock result for: ${objective}`,
      sourceClass: 'primary',
      publishedAt: now,
      discoveredBy: 'serper-search-provider-mock',
      scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
      claims: [
        'Serper mock search returned a high-relevance primary source.',
        'This is a deterministic fixture for CI and development.',
      ],
    },
    {
      id: 'SERPER-002',
      url: 'https://example.com/mock/serper-result-2',
      title: 'Serper mock secondary perspective',
      sourceClass: 'secondary',
      publishedAt: now,
      discoveredBy: 'serper-search-provider-mock',
      scores: { relevance: 3, authority: 3, freshness: 4, diversity: 4, extractionValue: 3 },
      claims: ['Secondary sources broaden coverage in a wide search.'],
    },
  ];
}

export class SerperSearchProvider implements SearchProvider {
  readonly name = 'serper';
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

    if (!this.apiKey) {
      if (process.env.SERPER_MOCK === '1') {
        return mockResults(objective).slice(0, maxResults);
      }
      throw new Error(
        'SERPER_API_KEY environment variable is required for the serper provider (or set SERPER_MOCK=1 for CI)'
      );
    }

    const response = await fetchWithRetry('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: objective,
        num: Math.min(Math.max(maxResults, 1), 100),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      if (response.status === 429) {
        throw new Error(`Serper API rate limit exceeded (429): ${body}`);
      }
      if (response.status === 401) {
        throw new Error('Serper API unauthorized (401): check SERPER_API_KEY');
      }
      throw new Error(`Serper API error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as SerperResponse;
    const results = data.organic ?? [];

    return results.slice(0, maxResults).map((result, index) => {
      const sourceClass = inferSourceClass(result.link);
      return {
        id: `SERPER-${String(index + 1).padStart(3, '0')}`,
        url: result.link,
        title: result.title,
        sourceClass,
        publishedAt: parsePublishedAt(result.date ?? ''),
        discoveredBy: 'serper-search-provider',
        scores: buildScores(sourceClass),
        claims: [result.snippet],
      };
    });
  }
}
