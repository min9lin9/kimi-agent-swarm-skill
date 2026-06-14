import type { ProviderPricing, UsageMetrics } from '../types';
import { BraveSearchProvider } from './brave-provider';
import { GitHubSearchProvider } from './github-provider';
import { MockSearchProvider } from './mock-search-provider';
import type { SearchProvider } from './search-provider';
import { SerperSearchProvider } from './serper-provider';
import { TavilySearchProvider } from './tavily-provider';

export type ProviderCredentialType = 'apiKey' | 'token';

export type ProviderFactory = (credential: string, metrics?: UsageMetrics) => SearchProvider;

export interface ProviderDescriptor {
  name: string;
  factory: ProviderFactory;
  envVar?: string;
  credentialType: ProviderCredentialType;
  credentialTypeLabel: string;
  pricing: ProviderPricing;
  defaultMaxResults: number;
  description: string;
}

export const PROVIDER_REGISTRY: ProviderDescriptor[] = [
  {
    name: 'mock',
    factory: (_credential, metrics) => new MockSearchProvider(metrics),
    envVar: undefined,
    credentialType: 'apiKey',
    credentialTypeLabel: 'none',
    pricing: { perCallUsd: 0 },
    defaultMaxResults: 100,
    description: 'deterministic demo/CI provider',
  },
  {
    name: 'serper',
    factory: (apiKey, metrics) => new SerperSearchProvider(apiKey, metrics),
    envVar: 'SERPER_API_KEY',
    credentialType: 'apiKey',
    credentialTypeLabel: 'API key',
    pricing: { perCallUsd: 0.001 },
    defaultMaxResults: 100,
    description: 'Google Search via Serper.dev',
  },
  {
    name: 'tavily',
    factory: (apiKey, metrics) => new TavilySearchProvider(apiKey, metrics),
    envVar: 'TAVILY_API_KEY',
    credentialType: 'apiKey',
    credentialTypeLabel: 'API key',
    pricing: { perCallUsd: 0.005 },
    defaultMaxResults: 100,
    description: 'AI-native search',
  },
  {
    name: 'brave',
    factory: (apiKey, metrics) => new BraveSearchProvider(apiKey, metrics),
    envVar: 'BRAVE_API_KEY',
    credentialType: 'apiKey',
    credentialTypeLabel: 'API key',
    pricing: { perCallUsd: 0.003 },
    defaultMaxResults: 20,
    description: 'Brave Search API',
  },
  {
    name: 'github',
    factory: (token, metrics) => new GitHubSearchProvider(token, metrics),
    envVar: 'GITHUB_TOKEN',
    credentialType: 'token',
    credentialTypeLabel: 'token',
    pricing: { perCallUsd: 0 },
    defaultMaxResults: 100,
    description: 'GitHub repository search',
  },
];

export const PROVIDER_FACTORY_MAP = new Map<string, ProviderFactory>(
  PROVIDER_REGISTRY.map((descriptor) => [descriptor.name, descriptor.factory])
);

export function getProviderDescriptor(name: string): ProviderDescriptor | undefined {
  return PROVIDER_REGISTRY.find((descriptor) => descriptor.name === name);
}

export function listProviderNames(): string[] {
  return PROVIDER_REGISTRY.map((descriptor) => descriptor.name);
}

export function getProviderEnvVar(name: string): string | undefined {
  return getProviderDescriptor(name)?.envVar;
}
