import { mkdir, readFile, rmdir } from 'node:fs/promises';
import { join } from 'node:path';

import { checkEstimatedBudget, estimateRunCost } from './costs';
import { runDistributedWideSearch } from './distributed/runner';
import { makeRunId } from './shared';
import { finalizeRun, resolveProviderName, runWideSearchTask } from './shared-runtime';
import type {
  ResearchPlan,
  Run,
  RunWideSearchOptions,
  RunWideSearchResult,
  UsageMetrics,
} from './types';

export async function runWideSearch({
  objective,
  profile = 'fixture',
  providerCommand,
  providerArgs = [],
  providerName,
  searchDepth = 'standard',
  workDir = process.cwd(),
  budget = {},
  useCache = false,
  replayRunId,
  distributed,
}: RunWideSearchOptions = {}): Promise<RunWideSearchResult> {
  let replayedFrom: string | undefined;

  if (replayRunId) {
    const previousRunDir = join(workDir, '.runs', 'wide-search', replayRunId);
    const previousRun = JSON.parse(await readFile(join(previousRunDir, 'run.json'), 'utf8')) as Run;
    const previousPlan = JSON.parse(
      await readFile(join(previousRunDir, 'research-plan.json'), 'utf8')
    ) as ResearchPlan;
    objective = objective || previousRun.objective;
    profile = previousRun.executionProfile;
    providerName =
      providerName ?? previousRun.providerName ?? resolveProviderName(previousRun.executionProfile);
    searchDepth = previousPlan.searchDepth ?? searchDepth;
    replayedFrom = replayRunId;
  }

  if (!objective) {
    throw new Error('runWideSearch requires objective');
  }

  const effectiveProviderName = resolveProviderName(profile, providerName);
  const estimate = estimateRunCost(effectiveProviderName, searchDepth);

  const runId = makeRunId();
  const runDir = join(workDir, '.runs', 'wide-search', runId);

  if (distributed?.enabled) {
    if (profile === 'local-command') {
      throw new Error('local-command profile does not support distributed execution');
    }
    return runDistributedWideSearch({
      objective,
      profile,
      providerCommand,
      providerArgs,
      providerName,
      searchDepth,
      workDir,
      budget,
      useCache,
      distributed,
    });
  }

  await mkdir(runDir, { recursive: true });

  const usageMetrics: UsageMetrics = {
    providerCalls: 0,
    apiCalls: 0,
    estimatedCostUsd: estimate.estimatedCostUsd,
  };

  try {
    if (budget.dryRun) {
      const dryRun: Run = {
        runId,
        objective,
        executionProfile: profile,
        status: 'completed',
        createdAt: new Date().toISOString(),
        usageMetrics,
        providerName: effectiveProviderName,
      };
      const { verification } = await finalizeRun({
        run: dryRun,
        objective,
        profile,
        sources: [],
        claims: [],
        usageMetrics,
        runDir,
        budget,
        isDryRun: true,
        providerName: effectiveProviderName,
        estimate,
      });
      await rmdir(runDir).catch(() => {});
      return { runId, runDir, verification };
    }

    checkEstimatedBudget(estimate, budget);

    const {
      sources,
      claims,
      usageMetrics: taskMetrics,
    } = await runWideSearchTask({
      objective,
      profile,
      providerCommand,
      providerArgs,
      providerName,
      searchDepth,
      budget,
      useCache,
      workDir,
      metrics: usageMetrics,
      checkBudget: false,
    });

    const run: Run = {
      runId,
      objective,
      executionProfile: profile,
      status: 'completed',
      createdAt: new Date().toISOString(),
      usageMetrics: taskMetrics,
      replayedFrom,
      cached: useCache && profile === 'web-search' && effectiveProviderName !== 'mock',
      providerName: effectiveProviderName,
    };

    const researchPlan: ResearchPlan = {
      objective,
      searchDepth,
      executionProfile: profile,
      queryFamilies: [
        profile.startsWith('fixture') ? `fixture:${profile}` : 'local-command provider',
      ],
      sourceTargets: ['official', 'community', 'secondary'],
      stopConditions: [
        profile.startsWith('fixture')
          ? 'fixture source set exhausted'
          : 'provider output exhausted',
      ],
    };

    const { verification } = await finalizeRun({
      run,
      objective,
      profile,
      sources,
      claims,
      plan: researchPlan,
      usageMetrics: taskMetrics,
      runDir,
      budget,
      providerName: effectiveProviderName,
    });

    return {
      runId,
      runDir,
      verification,
    };
  } catch (error) {
    await rmdir(runDir).catch(() => {});
    throw error;
  }
}
