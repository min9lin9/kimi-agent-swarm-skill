import type { SearchOptions, SearchProvider } from "./search-provider";
import type { Source } from "../types";

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

export class SerperSearchProvider implements SearchProvider {
  readonly name = "serper";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("SerperSearchProvider requires a non-empty API key");
    }
    this.apiKey = apiKey;
  }

  async search({ objective, maxResults }: SearchOptions): Promise<Source[]> {
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
      throw new Error(`Serper API error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as SerperResponse;
    const results = data.organic ?? [];
    const discoveredAt = new Date().toISOString().split("T")[0];

    return results.slice(0, maxResults).map((result, index) => ({
      id: `SERPER-${String(index + 1).padStart(3, "0")}`,
      url: result.link,
      title: result.title,
      sourceClass: "secondary",
      publishedAt: result.date ?? discoveredAt,
      discoveredBy: "serper-search-provider",
      scores: { relevance: 4, authority: 3, freshness: 4, diversity: 3, extractionValue: 3 },
      claims: [result.snippet],
    }));
  }
}
