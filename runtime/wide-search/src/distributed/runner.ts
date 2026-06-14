import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  BudgetExceededError,
  checkBudget,
  checkEstimatedBudget,
  estimateRunCost,
  getProviderPricing,
  maxResultsForDepth,
} from '../costs';
import { scoreSource } from '../scorer';
import { claimConfidence, claimFreshness, makeRunId } from '../shared';
import { finalizeRun, resolveProviderName, runWideSearchTask } from '../shared-runtime';
import type {
  Claim,
  DistributedJob,
  DistributedRunOptions,
  DistributedTask,
  EnrichedSource,
  ExecutionProfile,
  ResearchPlan,
  Run,
  RunWideSearchOptions,
  RunWideSearchResult,
  SearchDepth,
  Source,
  UsageMetrics,
  WorkerResult,
} from '../types';
import { MemoryQueueAdapter } from './memory-adapter';
import type { QueueAdapter } from './queue-adapter';
import { type RedisAdapterOptions, RedisQueueAdapter } from './redis-adapter';
import { buildTasksFromPlans, splitFixtureTasks, splitWebSearchTasks } from './task-splitter';

function createQueueAdapter(options: DistributedRunOptions, workDir: string): QueueAdapter {
  if (options.queueType === 'redis') {
    const redisOptions: RedisAdapterOptions = {
      redisUrl: options.redisUrl ?? process.env.REDIS_URL,
      password: options.redisPassword ?? process.env.REDIS_PASSWORD,
      username: options.redisUsername ?? process.env.REDIS_USERNAME,
      keyPrefix: options.redisKeyPrefix,
    };
    return new RedisQueueAdapter(redisOptions);
  }
  return new MemoryQueueAdapter({ workDir });
}

async function executeTask(
  task: DistributedTask,
  profile: ExecutionProfile,
  providerName: string,
  searchDepth: SearchDepth,
  maxResults: number | undefined,
  useCache: boolean,
  budget: import('../types').BudgetOptions,
  metrics: UsageMetrics
): Promise<WorkerResult> {
  if (profile.startsWith('fixture')) {
    const sourceIds = task.query.split(',').map((id) => id.trim());
    const result = await runWideSearchTask({
      objective: task.query,
      profile,
      providerName,
      searchDepth,
      useCache,
      metrics,
      sourceIds,
      checkBudget: false,
    });
    return {
      sources: result.sources,
      usageMetrics: result.usageMetrics,
      claims: result.claims,
    };
  }

  const result = await runWideSearchTask({
    objective: task.query,
    profile,
    providerName,
    searchDepth,
    useCache,
    metrics,
    maxResults,
    checkBudget: false,
  });
  return {
    sources: result.sources,
    usageMetrics: result.usageMetrics,
    claims: result.claims,
  };
}

export async function workerLoop(
  adapter: QueueAdapter,
  jobId: string,
  workerId: string,
  profile: ExecutionProfile,
  providerName: string,
  searchDepth: SearchDepth,
  perTaskMaxResults: number | undefined,
  useCache: boolean,
  budget: import('../types').BudgetOptions,
  metrics: UsageMetrics
): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pending = await adapter.getPendingTaskCount(jobId);
    const running = await adapter.getRunningTaskCount(jobId);
    if (pending === 0 && running === 0) {
      return;
    }

    const task = await adapter.claimNextTask(jobId, workerId);
    if (!task) {
      // No task claimed but work may remain; brief backoff.
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }

    try {
      const result = await executeTask(
        task,
        profile,
        providerName,
        searchDepth,
        perTaskMaxResults,
        useCache,
        budget,
        metrics
      );
      checkBudget(providerName, metrics, budget);
      await adapter.completeTask(task.taskId, result);
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      await adapter.failTask(task.taskId, message);
    }
  }
}

export async function runDistributedWideSearch({
  objective,
  profile = 'fixture',
  providerCommand,
  providerArgs,
  providerName,
  searchDepth = 'standard',
  workDir = process.cwd(),
  budget = {},
  useCache = false,
  replayRunId,
  distributed = { enabled: true },
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
    throw new Error('runDistributedWideSearch requires objective');
  }

  const runId = makeRunId();
  const runDir = join(workDir, '.runs', 'wide-search', runId);
  await mkdir(runDir, { recursive: true });

  const effectiveProviderName = resolveProviderName(profile, providerName);
  const maxRetries = distributed.maxRetries ?? 3;
  const workers = distributed.workers ?? 4;

  if (workers === 0 && distributed.queueType !== 'redis') {
    throw new Error('--workers 0 requires --queue-type redis with external worker processes');
  }

  const plans = profile.startsWith('fixture')
    ? await splitFixtureTasks(profile, join(import.meta.dir, '../../fixtures'))
    : splitWebSearchTasks(objective);

  const perTaskMaxResults = profile.startsWith('fixture')
    ? undefined
    : Math.ceil(maxResultsForDepth(searchDepth) / Math.max(1, plans.length));

  const estimatedProviderCalls = profile.startsWith('fixture') ? 0 : plans.length;
  const estimate = {
    ...estimateRunCost(effectiveProviderName, searchDepth),
    estimatedProviderCalls,
    estimatedApiCalls: estimatedProviderCalls,
    estimatedCostUsd: getProviderPricing(effectiveProviderName).perCallUsd * estimatedProviderCalls,
  };

  const usageMetrics: UsageMetrics = {
    providerCalls: 0,
    apiCalls: 0,
    estimatedCostUsd: estimate.estimatedCostUsd,
  };

  if (budget.dryRun) {
    const dryRun: Run = {
      runId,
      objective,
      executionProfile: profile,
      status: 'completed',
      createdAt: new Date().toISOString(),
      usageMetrics,
    };
    const dryPlan: ResearchPlan = {
      objective,
      searchDepth,
      executionProfile: profile,
      queryFamilies: plans.map((p) => p.queryFamily),
      sourceTargets: ['official', 'community', 'secondary'],
      stopConditions: ['dry-run: all distributed tasks planned but not executed'],
    };
    const { verification } = await finalizeRun({
      run: dryRun,
      objective,
      profile,
      sources: [],
      claims: [],
      plan: dryPlan,
      usageMetrics,
      runDir,
      budget,
      isDryRun: true,
      distributed: true,
      providerName: effectiveProviderName,
      estimate,
    });
    return { runId, runDir, verification };
  }

  checkEstimatedBudget(estimate, budget);

  const adapter = createQueueAdapter(distributed, workDir);

  let job: DistributedJob;
  if (distributed.resumeJobId) {
    const loaded = await adapter.getJob(distributed.resumeJobId);
    if (!loaded) {
      throw new Error(`Job not found for resume: ${distributed.resumeJobId}`);
    }
    job = loaded;
  } else {
    const tasks = buildTasksFromPlans('placeholder', plans, maxRetries);
    job = await adapter.createJob({
      objective,
      executionProfile: profile,
      providerName: effectiveProviderName,
      searchDepth,
      queueType: distributed.queueType ?? 'memory',
      status: 'pending',
      tasks: tasks.map((t) => ({ ...t, taskId: `${runId}-${t.taskId}` })),
      useCache,
      budget,
      workDir,
      perTaskMaxResults,
    });
  }

  job.status = 'running';
  await adapter.saveJob(job);

  const workerMetrics: UsageMetrics[] = [];
  const workerPromises: Promise<void>[] = [];
  for (let i = 0; i < workers; i += 1) {
    const metrics: UsageMetrics = { providerCalls: 0, apiCalls: 0 };
    workerMetrics.push(metrics);
    workerPromises.push(
      workerLoop(
        adapter,
        job.jobId,
        `worker-${i + 1}`,
        profile,
        effectiveProviderName,
        searchDepth,
        perTaskMaxResults,
        useCache,
        budget,
        metrics
      )
    );
  }

  await Promise.all(workerPromises);

  const completedJob = await adapter.getJob(job.jobId);
  if (!completedJob) {
    throw new Error('Job disappeared during distributed run');
  }

  const aggregatedSources: Source[] = [];
  for (const task of completedJob.tasks) {
    if (task.status === 'completed' && task.result) {
      aggregatedSources.push(...task.result.sources);
    }
  }

  if (aggregatedSources.length === 0) {
    throw new Error('Distributed run produced no accepted sources');
  }

  const sources: EnrichedSource[] = aggregatedSources.map((source) => scoreSource(source));

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

  const totalMetrics: UsageMetrics = workerMetrics.reduce(
    (acc, m) => ({
      providerCalls: acc.providerCalls + m.providerCalls,
      apiCalls: acc.apiCalls + m.apiCalls,
      estimatedCostUsd: acc.estimatedCostUsd,
    }),
    { providerCalls: 0, apiCalls: 0, estimatedCostUsd: estimate.estimatedCostUsd }
  );

  const run: Run = {
    runId,
    objective,
    executionProfile: profile,
    status: 'completed',
    createdAt: new Date().toISOString(),
    usageMetrics: totalMetrics,
    replayedFrom,
    cached: useCache && profile === 'web-search' && effectiveProviderName !== 'mock',
  };

  const researchPlan: ResearchPlan = {
    objective,
    searchDepth,
    executionProfile: profile,
    queryFamilies: completedJob.tasks.map((t) => t.queryFamily),
    sourceTargets: ['official', 'community', 'secondary'],
    stopConditions: ['all distributed tasks completed'],
  };

  await writeFile(
    join(runDir, 'distributed-job.json'),
    `${JSON.stringify(completedJob, null, 2)}\n`
  );

  const { verification } = await finalizeRun({
    run,
    objective,
    profile,
    sources,
    claims,
    plan: researchPlan,
    usageMetrics: totalMetrics,
    runDir,
    budget,
    distributed: true,
    providerName: effectiveProviderName,
  });

  if (adapter.quit) {
    await adapter.quit();
  }

  return {
    runId,
    runDir,
    verification,
  };
}
