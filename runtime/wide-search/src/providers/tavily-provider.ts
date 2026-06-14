import type { Source, SourceScores, UsageMetrics } from '../types';
import { fetchWithRetry } from './fetch-utils';
import type { SearchOptions, SearchProvider } from './search-provider';

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  query?: string;
  answer?: string;
  results?: TavilyResult[];
}

function inferSourceClass(url: string): 'primary' | 'secondary' {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (
      hostname === 'github.com' ||
      hostname.endsWith('.github.io') ||
      hostname === 'arxiv.org' ||
      hostname.endsWith('.gov') ||
      hostname.endsWith('.edu') ||
      hostname.endsWith('.ac.uk')
    ) {
      return 'primary';
    }
  } catch {
    // invalid URL, fall through to secondary
  }
  return 'secondary';
}

function parsePublishedAt(dateText?: string): string {
  if (!dateText) return new Date().toISOString().split('T')[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return dateText;
  }

  const parsed = new Date(dateText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

function buildScores(tavilyScore: number, sourceClass: 'primary' | 'secondary'): SourceScores {
  const scaledRelevance = Math.max(1, Math.min(5, Math.round(tavilyScore * 5)));
  return {
    relevance: scaledRelevance,
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
      id: 'TAVILY-001',
      url: 'https://example.com/mock/tavily-result-1',
      title: `Tavily mock result for: ${objective}`,
      sourceClass: 'primary',
      publishedAt: now,
      discoveredBy: 'tavily-search-provider-mock',
      scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
      claims: [
        'Tavily mock search returned a high-relevance primary source.',
        'This is a deterministic fixture for CI and development.',
      ],
    },
    {
      id: 'TAVILY-002',
      url: 'https://example.com/mock/tavily-result-2',
      title: 'Tavily mock secondary perspective',
      sourceClass: 'secondary',
      publishedAt: now,
      discoveredBy: 'tavily-search-provider-mock',
      scores: { relevance: 3, authority: 3, freshness: 4, diversity: 4, extractionValue: 3 },
      claims: ['Secondary sources broaden coverage in a wide search.'],
    },
  ];
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily';
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
      if (process.env.TAVILY_MOCK === '1') {
        return mockResults(objective).slice(0, maxResults);
      }
      throw new Error(
        'TAVILY_API_KEY environment variable is required for the tavily provider (or set TAVILY_MOCK=1 for CI)'
      );
    }

    const response = await fetchWithRetry('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query: objective,
        max_results: Math.min(Math.max(maxResults, 1), 100),
        include_answer: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => 'unknown');
      if (response.status === 429) {
        throw new Error(`Tavily API rate limit exceeded (429): ${body}`);
      }
      if (response.status === 401) {
        throw new Error('Tavily API unauthorized (401): check TAVILY_API_KEY');
      }
      throw new Error(`Tavily API error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as TavilyResponse;
    const results = data.results ?? [];

    return results.slice(0, maxResults).map((result, index) => {
      const sourceClass = inferSourceClass(result.url);
      return {
        id: `TAVILY-${String(index + 1).padStart(3, '0')}`,
        url: result.url,
        title: result.title,
        sourceClass,
        publishedAt: parsePublishedAt(result.published_date),
        discoveredBy: 'tavily-search-provider',
        scores: buildScores(result.score, sourceClass),
        claims: [result.content],
      };
    });
  }
}
