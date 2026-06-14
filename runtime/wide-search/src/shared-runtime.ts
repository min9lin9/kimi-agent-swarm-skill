import { getCachedSources, setCachedSources } from './cache';
import { loadCommandSources } from './command-provider';
import { loadConfig, resolveProviderCredential } from './config';
import { calculateActualCost, checkBudget, maxResultsForDepth } from './costs';
import { createSearchProvider } from './providers';
import { scoreSource } from './scorer';
import { claimConfidence, claimFreshness, loadFixtureSources } from './shared';
import type {
  BudgetOptions,
  Claim,
  EnrichedSource,
  ExecutionProfile,
  LoadSourcesOptions,
  SearchDepth,
  Source,
  UsageMetrics,
} from './types';

export interface RunWideSearchTaskOptions {
  objective: string;
  profile: ExecutionProfile;
  providerName?: string;
  providerCommand?: string;
  providerArgs?: string[];
  searchDepth?: SearchDepth;
  useCache?: boolean;
  budget?: BudgetOptions;
  metrics?: UsageMetrics;
  maxResults?: number;
  sourceIds?: string[];
  workDir?: string;
  checkBudget?: boolean;
}

export interface RunWideSearchTaskResult {
  sources: EnrichedSource[];
  claims: Claim[];
  usageMetrics: UsageMetrics;
}

export function resolveProviderName(profile: ExecutionProfile, providerName?: string): string {
  if (profile === 'web-search') {
    return providerName ?? 'mock';
  }
  return 'mock';
}

export async function loadSources({
  profile,
  objective,
  providerCommand,
  providerArgs,
  providerName,
  searchDepth,
  maxResults,
  metrics,
  useCache,
  sourceIds,
  workDir,
}: LoadSourcesOptions): Promise<Source[]> {
  if (profile.startsWith('fixture')) {
    const allSources = await loadFixtureSources(profile);
    if (sourceIds && sourceIds.length > 0) {
      return allSources.filter((s) => sourceIds.includes(s.id));
    }
    return allSources;
  }

  if (profile === 'local-command') {
    return loadCommandSources({ providerCommand, providerArgs, objective });
  }

  if (profile === 'web-search') {
    const depth = searchDepth ?? 'standard';
    const resolvedMaxResults = maxResults ?? maxResultsForDepth(depth);
    const effectiveProvider = providerName ?? 'mock';
    const cacheKey = {
      provider: effectiveProvider,
      objective,
      depth,
      maxResults: resolvedMaxResults,
    };

    if (useCache && effectiveProvider !== 'mock') {
      const cached = await getCachedSources(cacheKey);
      if (cached) {
        if (metrics) {
          metrics.notes = metrics.notes ? `${metrics.notes}; cache hit` : 'cache hit';
        }
        return cached;
      }
    }

    const config = await loadConfig(workDir);
    const credential = resolveProviderCredential(config, effectiveProvider);
    const provider = createSearchProvider(effectiveProvider, { credential, metrics });
    const sources = await provider.search({
      objective,
      depth,
      maxResults: resolvedMaxResults,
    });

    if (useCache && effectiveProvider !== 'mock') {
      await setCachedSources(cacheKey, sources);
    }

    return sources;
  }

  throw new Error(`unsupported execution profile: ${profile}`);
}

export async function runWideSearchTask({
  objective,
  profile,
  providerName,
  providerCommand,
  providerArgs,
  searchDepth = 'standard',
  useCache = false,
  budget = {},
  metrics,
  maxResults,
  sourceIds,
  workDir,
  checkBudget: shouldCheckBudget = true,
}: RunWideSearchTaskOptions): Promise<RunWideSearchTaskResult> {
  const effectiveProviderName = resolveProviderName(profile, providerName);
  const usageMetrics: UsageMetrics = metrics ?? {
    providerCalls: 0,
    apiCalls: 0,
  };

  const rawSources = await loadSources({
    profile,
    objective,
    providerCommand,
    providerArgs,
    providerName: effectiveProviderName,
    searchDepth,
    maxResults,
    metrics: usageMetrics,
    useCache,
    sourceIds,
    workDir,
  });

  const sources: EnrichedSource[] = rawSources.map((source) => scoreSource(source));
  usageMetrics.actualCostUsd = calculateActualCost(effectiveProviderName, usageMetrics);
  if (shouldCheckBudget) {
    checkBudget(effectiveProviderName, usageMetrics, budget);
  }

  const claims: Claim[] = [];
  for (const source of sources.filter((item) => item.decision === 'accepted')) {
    for (const claim of source.claims ?? []) {
      claims.push({
        id: `C${String(claims.length + 1).padStart(3, '0')}`,
        claim,
        sourceIds: [source.id],
        confidence: claimConfidence(source.scores),
        freshness: claimFreshness(source.publishedAt),
      });
    }
  }

  return { sources, claims, usageMetrics };
}
