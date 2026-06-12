import type { SearchOptions, SearchProvider } from "./search-provider";
import type { Source, SourceScores, UsageMetrics } from "../types";

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

function parseRelativeDate(dateText: string): string | undefined {
  const normalized = dateText.toLowerCase().trim();
  const now = new Date();

  const dayMatch = normalized.match(/^(\d+)\s+day(?:s)?\s+ago$/);
  if (dayMatch) {
    const days = Number.parseInt(dayMatch[1], 10);
    const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return date.toISOString().split("T")[0];
  }

  const monthMatch = normalized.match(/^(\d+)\s+month(?:s)?\s+ago$/);
  if (monthMatch) {
    const months = Number.parseInt(monthMatch[1], 10);
    const date = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return date.toISOString().split("T")[0];
  }

  const yearMatch = normalized.match(/^(\d+)\s+year(?:s)?\s+ago$/);
  if (yearMatch) {
    const years = Number.parseInt(yearMatch[1], 10);
    const date = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
    return date.toISOString().split("T")[0];
  }

  return undefined;
}

function parsePublishedAt(dateText: string): string {
  if (!dateText) return new Date().toISOString().split("T")[0];

  // ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    return dateText;
  }

  // Relative date
  const relative = parseRelativeDate(dateText);
  if (relative) return relative;

  // Month Day, Year (e.g., "May 14, 2026")
  const parsed = new Date(dateText);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return new Date().toISOString().split("T")[0];
}

function inferSourceClass(url: string): "primary" | "secondary" {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    // Treat official code repos, major docs, and government/regulator sites as primary-ish
    if (
      hostname === "github.com" ||
      hostname.endsWith(".github.io") ||
      hostname === "arxiv.org" ||
      hostname.endsWith(".gov")
    ) {
      return "primary";
    }
  } catch {
    // invalid URL, fall through to secondary
  }
  return "secondary";
}

function buildScores(sourceClass: "primary" | "secondary"): SourceScores {
  return {
    relevance: 4,
    authority: sourceClass === "primary" ? 4 : 3,
    freshness: 4,
    diversity: 3,
    extractionValue: sourceClass === "primary" ? 4 : 3,
  };
}

export class SerperSearchProvider implements SearchProvider {
  readonly name = "serper";
  private readonly apiKey: string;
  private readonly metrics?: UsageMetrics;

  constructor(apiKey: string, metrics?: UsageMetrics) {
    if (!apiKey) {
      throw new Error("SerperSearchProvider requires a non-empty API key");
    }
    this.apiKey = apiKey;
    this.metrics = metrics;
  }

  async search({ objective, maxResults }: SearchOptions): Promise<Source[]> {
    if (this.metrics) {
      this.metrics.providerCalls += 1;
      this.metrics.apiCalls += 1;
    }

    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: objective,
        num: Math.min(Math.max(maxResults, 1), 100),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "unknown");
      if (response.status === 429) {
        throw new Error(`Serper API rate limit exceeded (429): ${body}`);
      }
      if (response.status === 401) {
        throw new Error(`Serper API unauthorized (401): check SERPER_API_KEY`);
      }
      throw new Error(`Serper API error: ${response.status} ${body}`);
    }

    const data = (await response.json()) as SerperResponse;
    const results = data.organic ?? [];

    return results.slice(0, maxResults).map((result, index) => {
      const sourceClass = inferSourceClass(result.link);
      return {
        id: `SERPER-${String(index + 1).padStart(3, "0")}`,
        url: result.link,
        title: result.title,
        sourceClass,
        publishedAt: parsePublishedAt(result.date ?? ""),
        discoveredBy: "serper-search-provider",
        scores: buildScores(sourceClass),
        claims: [result.snippet],
      };
    });
  }
}
