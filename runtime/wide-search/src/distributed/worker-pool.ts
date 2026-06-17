import type { BudgetOptions, DistributedJob, ExecutionProfile, SearchDepth, UsageMetrics } from '../types';
import type { QueueAdapter } from './queue-adapter';
import { workerLoop, pollJobToCompletion } from './worker';

export interface WorkerPoolRunOptions {
  adapter: QueueAdapter;
  workers: number;
  taskTimeoutMs?: number;
  perTaskMaxResults?: number;
  profile: ExecutionProfile;
  providerName: string;
  searchDepth: SearchDepth;
  useCache: boolean;
  budget: BudgetOptions;
  workDir: string;
}

export interface WorkerPool {
  readonly type: string;
  run(job: DistributedJob, options: WorkerPoolRunOptions): Promise<DistributedJob>;
}

export class InProcessWorkerPool implements WorkerPool {
  readonly type = 'in-process';

  async run(job: DistributedJob, options: WorkerPoolRunOptions): Promise<DistributedJob> {
    const {
      adapter,
      workers,
      perTaskMaxResults,
      profile,
      providerName,
      searchDepth,
      useCache,
      budget,
      workDir,
    } = options;

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
          providerName,
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
    return loaded;
  }
}

export interface ExternalWorkerPoolOptions {
  adapter: QueueAdapter;
  taskTimeoutMs?: number;
  perTaskMaxResults?: number;
  profile: ExecutionProfile;
  providerName: string;
  searchDepth: SearchDepth;
  useCache: boolean;
  budget: BudgetOptions;
  workDir: string;
}

export class ExternalWorkerPool implements WorkerPool {
  readonly type = 'external';
  private readonly options: ExternalWorkerPoolOptions;

  constructor(options: ExternalWorkerPoolOptions) {
    this.options = options;
  }

  async run(job: DistributedJob): Promise<DistributedJob> {
    console.log(JSON.stringify({ jobId: job.jobId }));
    return pollJobToCompletion(
      this.options.adapter,
      job.jobId,
      undefined,
      undefined,
      this.options.taskTimeoutMs
    );
  }

  async runOnce(jobId: string, workerId: string): Promise<void> {
    const {
      adapter,
      perTaskMaxResults,
      profile,
      providerName,
      searchDepth,
      useCache,
      budget,
      workDir,
    } = this.options;

    await workerLoop(
      adapter,
      jobId,
      workerId,
      profile,
      providerName,
      searchDepth,
      perTaskMaxResults,
      useCache,
      budget,
      { providerCalls: 0, apiCalls: 0 },
      workDir
    );
  }
}
