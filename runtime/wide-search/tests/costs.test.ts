import { describe, expect, test } from 'bun:test';

import {
  BudgetExceededError,
  calculateActualCost,
  checkBudget,
  checkEstimatedBudget,
  estimateRunCost,
  formatCostReport,
  getProviderPricing,
  maxResultsForDepth,
} from '../src/costs';
import type { UsageMetrics } from '../src/types';

describe('costs', () => {
  test('maxResultsForDepth returns expected limits', () => {
    expect(maxResultsForDepth('light')).toBe(10);
    expect(maxResultsForDepth('standard')).toBe(25);
    expect(maxResultsForDepth('deep')).toBe(75);
    expect(maxResultsForDepth('maximum')).toBe(100);
  });

  test('estimateRunCost returns positive cost for priced providers', () => {
    const serper = estimateRunCost('serper', 'standard');
    expect(serper.estimatedCostUsd).toBeGreaterThan(0);
    expect(serper.estimatedProviderCalls).toBe(1);

    const tavily = estimateRunCost('tavily', 'deep');
    expect(tavily.estimatedCostUsd).toBeGreaterThan(serper.estimatedCostUsd);
  });

  test('mock provider has zero cost', () => {
    const estimate = estimateRunCost('mock', 'maximum');
    expect(estimate.estimatedCostUsd).toBe(0);
  });

  test('calculateActualCost sums provider calls', () => {
    const metrics: UsageMetrics = { providerCalls: 3, apiCalls: 3 };
    const pricing = getProviderPricing('serper');
    expect(calculateActualCost('serper', metrics)).toBe(pricing.perCallUsd * 3);
  });

  test('checkBudget throws when cost exceeds maxCostUsd', () => {
    const metrics: UsageMetrics = { providerCalls: 1000, apiCalls: 1000 };
    expect(() => checkBudget('serper', metrics, { maxCostUsd: 0.5 })).toThrow(BudgetExceededError);
  });

  test('checkBudget throws when provider calls exceed limit', () => {
    const metrics: UsageMetrics = { providerCalls: 5, apiCalls: 5 };
    expect(() => checkBudget('mock', metrics, { maxProviderCalls: 2 })).toThrow(
      BudgetExceededError
    );
  });

  test('checkEstimatedBudget throws when estimated cost exceeds budget', () => {
    const estimate = estimateRunCost('tavily', 'standard');
    expect(() => checkEstimatedBudget(estimate, { maxCostUsd: 0.001 })).toThrow(
      BudgetExceededError
    );
  });

  test('formatCostReport includes provider and cost', () => {
    const metrics: UsageMetrics = {
      providerCalls: 1,
      apiCalls: 1,
      estimatedCostUsd: 0.005,
      estimatedTokens: 1000,
    };
    const report = formatCostReport('tavily', metrics);
    expect(report).toInclude('tavily');
    expect(report).toInclude('Provider calls: 1');
    expect(report).toInclude('Actual cost:');
  });
});
