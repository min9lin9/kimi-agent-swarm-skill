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

export interface CreateSearchProviderOptions {
  credential?: string;
  metrics?: UsageMetrics;
}

export function createSearchProvider(
  name: string,
  options: CreateSearchProviderOptions = {},
): SearchProvider {
  const { credential, metrics } = options;

  switch (name) {
    case "mock":
      return new MockSearchProvider(metrics);
    case "serper": {
      const apiKey = credential ?? process.env.SERPER_API_KEY ?? "";
      return new SerperSearchProvider(apiKey, metrics);
    }
    case "tavily": {
      const apiKey = credential ?? process.env.TAVILY_API_KEY ?? "";
      return new TavilySearchProvider(apiKey, metrics);
    }
    case "brave": {
      const apiKey = credential ?? process.env.BRAVE_API_KEY ?? "";
      return new BraveSearchProvider(apiKey, metrics);
    }
    case "github": {
      const token = credential ?? process.env.GITHUB_TOKEN ?? "";
      return new GitHubSearchProvider(token, metrics);
    }
    default:
      throw new Error(`Unknown search provider: ${name}`);
  }
}
