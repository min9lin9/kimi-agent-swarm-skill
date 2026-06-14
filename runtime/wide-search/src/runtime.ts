import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { checkEstimatedBudget, estimateRunCost, formatCostReport } from './costs';
import { runDistributedWideSearch } from './distributed/runner';
import { defaultLogger } from './logger';
import { renderMarkdownSynthesis } from './markdown';
import { makeRunId } from './shared';
import { resolveProviderName, runWideSearchTask } from './shared-runtime';
import type {
  BudgetOptions,
  ResearchPlan,
  Run,
  RunWideSearchOptions,
  RunWideSearchResult,
  UsageMetrics,
} from './types';
import { verifyRun } from './verifier';

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
    objective = objective ?? previousRun.objective;
    profile = previousRun.executionProfile;
    providerName = providerName ?? resolveProviderName(previousRun.executionProfile);
    searchDepth = previousPlan.searchDepth ?? searchDepth;
    replayedFrom = replayRunId;
  }

  if (!objective) {
    throw new Error('runWideSearch requires objective');
  }

  if (distributed?.enabled) {
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

  const runId = makeRunId();
  const runDir = join(workDir, '.runs', 'wide-search', runId);
  await mkdir(runDir, { recursive: true });

  const effectiveProviderName = resolveProviderName(profile, providerName);
  const estimate = estimateRunCost(effectiveProviderName, searchDepth);

  const usageMetrics: UsageMetrics = {
    providerCalls: 0,
    apiCalls: 0,
    estimatedCostUsd: estimate.estimatedCostUsd,
  };

  checkEstimatedBudget(estimate, budget);

  if (budget.dryRun) {
    usageMetrics.notes = 'Dry run: no provider executed.';
    const dryRun: Run = {
      runId,
      objective,
      executionProfile: profile,
      status: 'completed',
      createdAt: new Date().toISOString(),
      usageMetrics,
    };
    await writeFile(join(runDir, 'run.json'), `${JSON.stringify(dryRun, null, 2)}\n`);
    return {
      runId,
      runDir,
      verification: {
        status: 'passed',
        acceptedSources: 0,
        rejectedSources: 0,
        unsupportedClaims: 0,
        staleClaims: 0,
        unknownFreshnessClaims: 0,
        lowConfidenceClaims: 0,
        duplicateClaimGroups: [],
        conflictingClaimPairs: [],
        coverageGaps: [],
        failures: [],
        warnings: ['dry-run: no sources or claims evaluated'],
      },
    };
  }

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
      profile.startsWith('fixture') ? 'fixture source set exhausted' : 'provider output exhausted',
    ],
  };

  await writeFile(join(runDir, 'run.json'), `${JSON.stringify(run, null, 2)}\n`);
  await writeFile(join(runDir, 'research-plan.json'), `${JSON.stringify(researchPlan, null, 2)}\n`);
  await writeFile(
    join(runDir, 'source-ledger.jsonl'),
    `${sources.map((source) => JSON.stringify(source)).join('\n')}\n`
  );
  await writeFile(
    join(runDir, 'claim-ledger.jsonl'),
    `${claims.map((claim) => JSON.stringify(claim)).join('\n')}\n`
  );

  const verification = await verifyRun({ runDir, minAcceptedSources: 1 });
  const synthesis = renderMarkdownSynthesis({ run, profile, sources, claims, verification });
  await writeFile(join(runDir, 'synthesis.md'), synthesis);

  defaultLogger.info(formatCostReport(effectiveProviderName, taskMetrics));

  return {
    runId,
    runDir,
    verification,
  };
}
