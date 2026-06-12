import { MockSearchProvider } from "./mock-search-provider";
import { SerperSearchProvider } from "./serper-provider";
import type { SearchProvider } from "./search-provider";
import type { UsageMetrics } from "../types";

export * from "./search-provider";
export { MockSearchProvider } from "./mock-search-provider";
export { SerperSearchProvider } from "./serper-provider";

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
    default:
      throw new Error(`Unknown search provider: ${name}`);
  }
}
