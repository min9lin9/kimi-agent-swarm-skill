import { MockSearchProvider } from "./mock-search-provider";
import { SerperSearchProvider } from "./serper-provider";
import type { SearchProvider } from "./search-provider";

export * from "./search-provider";
export { MockSearchProvider } from "./mock-search-provider";
export { SerperSearchProvider } from "./serper-provider";

export function createSearchProvider(name: string): SearchProvider {
  switch (name) {
    case "mock":
      return new MockSearchProvider();
    case "serper": {
      const apiKey = process.env.SERPER_API_KEY;
      if (!apiKey) {
        throw new Error(
          "SERPER_API_KEY environment variable is required for the serper provider",
        );
      }
      return new SerperSearchProvider(apiKey);
    }
    default:
      throw new Error(`Unknown search provider: ${name}`);
  }
}
