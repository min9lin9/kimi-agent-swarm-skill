import { BraveSearchProvider } from "./brave-provider";
import { GitHubSearchProvider } from "./github-provider";
import { MockSearchProvider } from "./mock-search-provider";
import { SerperSearchProvider } from "./serper-provider";
import { TavilySearchProvider } from "./tavily-provider";
import type { SearchProvider } from "./search-provider";
import type { UsageMetrics } from "../types";

export * from "./search-provider";
export { BraveSearchProvider } from "./brave-provider";
export { GitHubSearchProvider } from "./github-provider";
export { MockSearchProvider } from "./mock-search-provider";
export { SerperSearchProvider } from "./serper-provider";
export { TavilySearchProvider } from "./tavily-provider";

export function createSearchProvider(
  name: string,
  metrics?: UsageMetrics,
): SearchProvider {
  switch (name) {
    case "mock":
      return new MockSearchProvider(metrics);
    case "serper": {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "SERPER_API_KEY environment variable is required for the serper provider",
        );
      }
      return new SerperSearchProvider(apiKey, metrics);
    }
    case "tavily": {
      const apiKey = process.env.TAVILY_API_KEY ?? "";
      return new TavilySearchProvider(apiKey, metrics);
    }
    case "brave": {
      const apiKey = process.env.BRAVE_API_KEY ?? "";
      return new BraveSearchProvider(apiKey, metrics);
    }
    case "github": {
      const token = process.env.GITHUB_TOKEN ?? "";
      return new GitHubSearchProvider(token, metrics);
    }
    default:
      throw new Error(`Unknown search provider: ${name}`);
  }
}
