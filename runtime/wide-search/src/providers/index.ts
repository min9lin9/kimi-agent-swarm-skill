import type { UsageMetrics } from '../types';
import { PROVIDER_REGISTRY, getProviderDescriptor, listProviderNames } from './registry';
import type { SearchProvider } from './search-provider';

export * from './search-provider';
export { BraveSearchProvider } from './brave-provider';
export { GitHubSearchProvider } from './github-provider';
export { MockSearchProvider } from './mock-search-provider';
export {
  PROVIDER_REGISTRY,
  getProviderDescriptor,
  listProviderNames,
} from './registry';
export { SerperSearchProvider } from './serper-provider';
export { TavilySearchProvider } from './tavily-provider';

export interface CreateSearchProviderOptions {
  credential?: string;
  metrics?: UsageMetrics;
}

export function createSearchProvider(
  name: string,
  options: CreateSearchProviderOptions = {}
): SearchProvider {
  const descriptor = getProviderDescriptor(name);
  if (!descriptor) {
    throw new Error(`Unknown search provider: ${name}`);
  }

  const { credential, metrics } = options;
  const resolvedCredential =
    credential ?? (descriptor.envVar ? process.env[descriptor.envVar] : '');

  return descriptor.factory(resolvedCredential ?? '', metrics);
}
