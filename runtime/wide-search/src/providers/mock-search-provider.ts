import type { SearchOptions, SearchProvider } from "./search-provider";
import type { Source } from "../types";

export class MockSearchProvider implements SearchProvider {
  readonly name = "mock";

  async search({ objective, depth }: SearchOptions): Promise<Source[]> {
    const now = new Date().toISOString().split("T")[0];
    return [
      {
        id: "MOCK-001",
        url: "https://example.com/mock/result-1",
        title: `Mock result for: ${objective}`,
        sourceClass: "primary-analysis",
        publishedAt: now,
        discoveredBy: "mock-search-provider",
        scores: { relevance: 5, authority: 4, freshness: 5, diversity: 3, extractionValue: 4 },
        claims: [
          `Mock search was executed with depth '${depth}'.`,
          "This is a placeholder result for development and CI.",
          "Replace with a real provider (serper, tavily, etc.) for live searches.",
        ],
      },
      {
        id: "MOCK-002",
        url: "https://example.com/mock/result-2",
        title: "Mock secondary perspective",
        sourceClass: "secondary",
        publishedAt: now,
        discoveredBy: "mock-search-provider",
        scores: { relevance: 3, authority: 2, freshness: 4, diversity: 4, extractionValue: 2 },
        claims: ["Secondary sources can provide alternative viewpoints in a wide search."],
      },
    ];
  }
}
