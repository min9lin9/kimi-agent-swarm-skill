import { getProviderDescriptor, listProviderNames } from './providers/registry';
import type {
  BudgetOptions,
  CostEstimate,
  ProviderPricing,
  SearchDepth,
  UsageMetrics,
} from './types';

export const PROVIDER_PRICING: Record<string, ProviderPricing> = Object.fromEntries(
  listProviderNames().map((name) => {
    const descriptor = getProviderDescriptor(name);
    return [name, descriptor?.pricing ?? { perCallUsd: 0 }];
  })
);

export function maxResultsForDepth(depth: SearchDepth): number {
  switch (depth) {
    case 'light':
      return 10;
    case 'standard':
      return 25;
    case 'deep':
      return 75;
    case 'maximum':
      return 100;
    default:
      return 25;
  }
}

export function getProviderPricing(providerName: string): ProviderPricing {
  return PROVIDER_PRICING[providerName] ?? { perCallUsd: 0 };
}

export function estimateRunCost(
  providerName: string,
  depth: SearchDepth = 'standard'
): CostEstimate {
  const pricing = getProviderPricing(providerName);
  const estimatedProviderCalls = 1;
  const estimatedApiCalls = 1;
  const estimatedCostUsd = pricing.perCallUsd * estimatedProviderCalls;

  return {
    providerName,
    depth,
    estimatedProviderCalls,
    estimatedApiCalls,
    estimatedCostUsd,
  };
}

export function calculateActualCost(providerName: string, metrics: UsageMetrics): number {
  const pricing = getProviderPricing(providerName);
  const callCost = pricing.perCallUsd * metrics.providerCalls;
  const tokenCost = pricing.per1kTokensUsd
    ? (pricing.per1kTokensUsd * (metrics.estimatedTokens ?? 0)) / 1000
    : 0;
  return Number((callCost + tokenCost).toFixed(6));
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export function checkBudget(
  providerName: string,
  metrics: UsageMetrics,
  budget: BudgetOptions = {}
): void {
  const actualCost = calculateActualCost(providerName, metrics);

  if (budget.maxCostUsd !== undefined && actualCost > budget.maxCostUsd) {
    throw new BudgetExceededError(
      `Actual cost $${actualCost.toFixed(4)} exceeds budget $${budget.maxCostUsd.toFixed(4)}`
    );
  }

  if (budget.maxProviderCalls !== undefined && metrics.providerCalls > budget.maxProviderCalls) {
    throw new BudgetExceededError(
      `Provider calls ${metrics.providerCalls} exceed budget ${budget.maxProviderCalls}`
    );
  }

  if (budget.maxApiCalls !== undefined && metrics.apiCalls > budget.maxApiCalls) {
    throw new BudgetExceededError(
      `API calls ${metrics.apiCalls} exceed budget ${budget.maxApiCalls}`
    );
  }
}

export function checkEstimatedBudget(estimate: CostEstimate, budget: BudgetOptions = {}): void {
  if (budget.maxCostUsd !== undefined && estimate.estimatedCostUsd > budget.maxCostUsd) {
    throw new BudgetExceededError(
      `Estimated cost $${estimate.estimatedCostUsd.toFixed(4)} exceeds budget $${budget.maxCostUsd.toFixed(4)}. Use --dry-run to inspect or raise the budget.`
    );
  }

  if (
    budget.maxProviderCalls !== undefined &&
    estimate.estimatedProviderCalls > budget.maxProviderCalls
  ) {
    throw new BudgetExceededError(
      `Estimated provider calls ${estimate.estimatedProviderCalls} exceed budget ${budget.maxProviderCalls}`
    );
  }

  if (budget.maxApiCalls !== undefined && estimate.estimatedApiCalls > budget.maxApiCalls) {
    throw new BudgetExceededError(
      `Estimated API calls ${estimate.estimatedApiCalls} exceed budget ${budget.maxApiCalls}`
    );
  }
}

export function formatCostReport(providerName: string, metrics: UsageMetrics): string {
  const actualCost = calculateActualCost(providerName, metrics);
  return [
    `Provider: ${providerName}`,
    `Provider calls: ${metrics.providerCalls}`,
    `API calls: ${metrics.apiCalls}`,
    metrics.estimatedTokens !== undefined ? `Estimated tokens: ${metrics.estimatedTokens}` : null,
    `Estimated cost: $${metrics.estimatedCostUsd?.toFixed(4) ?? '0.0000'}`,
    `Actual cost: $${actualCost.toFixed(4)}`,
    metrics.notes ? `Notes: ${metrics.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
