import { mkdir, readFile, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
	BudgetExceededError,
	checkEstimatedBudget,
	estimateRunCost,
	getProviderPricing,
} from '../costs';
import { computePerTaskMaxResults } from './job-sizing';
import { extractClaims, makeRunId, renumberSources } from '../shared';
import { finalizeRun, resolveProviderName } from '../shared-runtime';
import type {
	DistributedJob,
	DistributedRunOptions,
	EnrichedSource,
	ResearchPlan,
	Run,
	RunWideSearchOptions,
	RunWideSearchResult,
	SearchDepth,
	Source,
	UsageMetrics,
} from '../types';
import { MemoryQueueAdapter } from './memory-adapter';
import type { QueueAdapter } from './queue-adapter';
import { type RedisAdapterOptions, RedisQueueAdapter } from './redis-adapter';
import { buildTasksFromPlans, splitFixtureTasks, splitWebSearchTasks } from './task-splitter';
import { ExternalWorkerPool, InProcessWorkerPool } from './worker-pool';
import { finalizeDistributedRun } from './worker';

export { workerLoop } from './worker';

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

	const perTaskMaxResults = computePerTaskMaxResults(profile, searchDepth, plans.length);

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

		const workerPool =
			workers === 0
				? new ExternalWorkerPool({
						adapter,
						taskTimeoutMs: distributed.taskTimeoutMs,
						perTaskMaxResults,
						profile,
						providerName: effectiveProviderName,
						searchDepth,
						useCache,
						budget,
						workDir,
				  })
				: new InProcessWorkerPool();

		const completedJob = await workerPool.run(job, {
			adapter,
			workers,
			taskTimeoutMs: distributed.taskTimeoutMs,
			perTaskMaxResults,
			profile,
			providerName: effectiveProviderName,
			searchDepth,
			useCache,
			budget,
			workDir,
		});

		const { run, researchPlan, sources, claims } = await finalizeDistributedRun(completedJob, {
			runId,
			runDir,
			objective,
			profile,
			providerName: effectiveProviderName,
			searchDepth,
			useCache,
			budget,
			replayedFrom,
		});

		await writeFile(join(runDir, 'distributed-job.json'), `${JSON.stringify(completedJob, null, 2)}\n`);

		const { verification } = await finalizeRun({
			run,
			objective,
			profile,
			sources,
			claims,
			plan: researchPlan,
			usageMetrics: run.usageMetrics,
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
