import { BudgetExceededError, checkBudget } from '../costs';
import { scoreSource } from '../scorer';
import { extractClaims, renumberSources } from '../shared';
import { finalizeRun, runWideSearchTask } from '../shared-runtime';
import type {
	BudgetOptions,
	DistributedJob,
	DistributedTask,
	ExecutionProfile,
	Run,
	ResearchPlan,
	SearchDepth,
  Source,
  Claim,
  EnrichedSource,
  UsageMetrics,
	WorkerResult,
} from '../types';
import { defaultLogger } from '../logger';
import type { QueueAdapter } from './queue-adapter';

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
	budget: BudgetOptions,
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
	budget: BudgetOptions,
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
			await adapter.completeTask(task.taskId, result, task.leaseToken);
		} catch (error) {
			if (error instanceof BudgetExceededError) {
				throw error;
			}
			const message = error instanceof Error ? error.message : String(error);
			await adapter.failTask(task.taskId, message, task.leaseToken);
		}
	}
}

export async function pollJobToCompletion(
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

		if (adapter.revokeStaleLeases) {
			await adapter.revokeStaleLeases(taskTimeoutMs);
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

export async function finalizeDistributedRun(
	completedJob: DistributedJob,
	options: {
		runId: string;
		runDir: string;
		objective: string;
		profile: ExecutionProfile;
		providerName: string;
		searchDepth: SearchDepth;
		useCache: boolean;
		budget: BudgetOptions;
		replayedFrom?: string;
	}
): Promise<{ run: Run; researchPlan: ResearchPlan; sources: EnrichedSource[]; claims: Claim[] }> {
	const { runId, runDir, objective, profile, providerName, searchDepth, useCache, budget, replayedFrom } = options;

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
	const claims: Claim[] = extractClaims(sources);

	const totalMetrics: UsageMetrics = completedJob.tasks
		.filter((t) => t.status === 'completed' && t.result)
		.reduce(
			(acc, t) => ({
				providerCalls: acc.providerCalls + (t.result?.usageMetrics.providerCalls ?? 0),
				apiCalls: acc.apiCalls + (t.result?.usageMetrics.apiCalls ?? 0),
				estimatedCostUsd: acc.estimatedCostUsd,
			}),
			{ providerCalls: 0, apiCalls: 0, estimatedCostUsd: 0 }
		);

	const run: Run = {
		runId,
		objective,
		executionProfile: profile,
		status: 'completed',
		createdAt: new Date().toISOString(),
		usageMetrics: totalMetrics,
		replayedFrom,
		cached: useCache && profile === 'web-search' && providerName !== 'mock',
		providerName,
	};

	const researchPlan: ResearchPlan = {
		objective,
		searchDepth,
		executionProfile: profile,
		queryFamilies: completedJob.tasks.map((t) => t.queryFamily),
		sourceTargets: ['official', 'community', 'secondary'],
		stopConditions: ['all distributed tasks completed'],
	};

	return { run, researchPlan, sources, claims };
}
