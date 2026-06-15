import { mkdir, readFile, rmdir, writeFile } from 'node:fs/promises';
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
import { extractClaims, makeRunId, renumberSources } from '../shared';
import { finalizeRun, resolveProviderName, runWideSearchTask } from '../shared-runtime';
import type {
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

function accumulateMetrics(into: UsageMetrics, from: UsageMetrics): void {
  into.providerCalls += from.providerCalls;
  into.apiCalls += from.apiCalls;
  into.estimatedTokens = (into.estimatedTokens ?? 0) + (from.estimatedTokens ?? 0);
  into.actualCostUsd = (into.actualCostUsd ?? 0) + (from.actualCostUsd ?? 0);
}

async function executeTask(
  task: DistributedTask,
  profile: ExecutionProfile,
  providerName: string,
  searchDepth: SearchDepth,
  maxResults: number | undefined,
  useCache: boolean,
  budget: import('../types').BudgetOptions,
  metrics: UsageMetrics,
  workDir: string
): Promise<WorkerResult> {
  const taskMetrics: UsageMetrics = { providerCalls: 0, apiCalls: 0 };
  const baseOptions = {
    objective: task.query,
    profile,
    providerName,
    searchDepth,
    useCache,
    metrics: taskMetrics,
    workDir,
    checkBudget: false,
  };

  const result = profile.startsWith('fixture')
    ? await runWideSearchTask({
        ...baseOptions,
        sourceIds: task.query.split(',').map((id) => id.trim()),
      })
    : await runWideSearchTask({ ...baseOptions, maxResults });

  accumulateMetrics(metrics, result.usageMetrics);
  return result;
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
  metrics: UsageMetrics,
  workDir: string
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
        metrics,
        workDir
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

async function pollJobToCompletion(
  adapter: QueueAdapter,
  jobId: string,
  timeoutMs = 30 * 60 * 1000,
  pollIntervalMs = 1000,
  taskTimeoutMs = 5 * 60 * 1000
): Promise<DistributedJob> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await adapter.getJob(jobId);
    if (!current) {
      throw new Error('Job disappeared during distributed run');
    }

    const now = Date.now();
    for (const task of current.tasks) {
      if (task.status === 'running' && task.startedAt) {
        const elapsed = now - new Date(task.startedAt).getTime();
        if (elapsed > taskTimeoutMs) {
          await adapter.failTask(
            task.taskId,
            `stale task timeout after ${taskTimeoutMs}ms (worker may have died)`
          );
        }
      }
    }

    if (current.status === 'completed' || current.status === 'failed') {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error('Timed out waiting for external workers to complete the job');
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
    providerName =
      providerName ?? previousRun.providerName ?? resolveProviderName(previousRun.executionProfile);
    searchDepth = previousPlan.searchDepth ?? searchDepth;
    replayedFrom = replayRunId;
  }

  if (!objective) {
    throw new Error('runDistributedWideSearch requires objective');
  }

  const runId = makeRunId();
  const runDir = join(workDir, '.runs', 'wide-search', runId);

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

  await mkdir(runDir, { recursive: true });

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
      providerName: effectiveProviderName,
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
    await rmdir(runDir).catch(() => {});
    return { runId, runDir, verification };
  }

  checkEstimatedBudget(estimate, budget);

  const adapter = createQueueAdapter(distributed, workDir);

  try {
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

    let completedJob: DistributedJob;
    if (workers === 0) {
      console.log(JSON.stringify({ jobId: job.jobId }));
      completedJob = await pollJobToCompletion(
        adapter,
        job.jobId,
        undefined,
        undefined,
        distributed.taskTimeoutMs
      );
    } else {
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
            metrics,
            workDir
          )
        );
      }

      await Promise.all(workerPromises);

      const loaded = await adapter.getJob(job.jobId);
      if (!loaded) {
        throw new Error('Job disappeared during distributed run');
      }
      completedJob = loaded;
    }

    const aggregatedSources: Source[] = [];
    for (const task of completedJob.tasks) {
      if (task.status === 'completed' && task.result) {
        aggregatedSources.push(...task.result.sources);
      }
    }

    if (aggregatedSources.length === 0) {
      const failures = completedJob.tasks
        .filter((t) => t.status === 'failed' && t.error)
        .map((t) => `[${t.queryFamily}] ${t.error}`);
      const suffix = failures.length > 0 ? `; task failures: ${failures.join('; ')}` : '';
      throw new Error(`Distributed run produced no accepted sources${suffix}`);
    }

    const renumberedSources = renumberSources(aggregatedSources);
    const sources: EnrichedSource[] = renumberedSources.map((source) => scoreSource(source));
    const claims = extractClaims(sources);

    const totalMetrics: UsageMetrics = completedJob.tasks
      .filter((t) => t.status === 'completed' && t.result)
      .reduce(
        (acc, t) => ({
          providerCalls: acc.providerCalls + (t.result?.usageMetrics.providerCalls ?? 0),
          apiCalls: acc.apiCalls + (t.result?.usageMetrics.apiCalls ?? 0),
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
      providerName: effectiveProviderName,
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

    return {
      runId,
      runDir,
      verification,
    };
  } catch (error) {
    await rmdir(runDir).catch(() => {});
    throw error;
  } finally {
    if (adapter.quit) {
      await adapter.quit();
    }
  }
}
