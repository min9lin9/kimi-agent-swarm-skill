import type { DistributedJob } from '../types';
import type { QueueAdapter } from './queue-adapter';

export interface CoordinatorOptions {
  taskTimeoutMs?: number;
  pollIntervalMs?: number;
  totalTimeoutMs?: number;
}

/**
 * Coordinator owns the job lifecycle for external-worker mode:
 * polling the job to completion, revoking stale leases, and failing
 * tasks that have exceeded the per-task timeout.
 */
export class Coordinator {
  private readonly adapter: QueueAdapter;
  private readonly taskTimeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly totalTimeoutMs: number;

  constructor(adapter: QueueAdapter, options: CoordinatorOptions = {}) {
    this.adapter = adapter;
    this.taskTimeoutMs = options.taskTimeoutMs ?? 5 * 60 * 1000;
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
    this.totalTimeoutMs = options.totalTimeoutMs ?? 30 * 60 * 1000;
  }

  async runToCompletion(jobId: string): Promise<DistributedJob> {
    const start = Date.now();
    while (Date.now() - start < this.totalTimeoutMs) {
      const current = await this.adapter.getJob(jobId);
      if (!current) {
        throw new Error('Job disappeared during distributed run');
      }

      if (this.adapter.revokeStaleLeases) {
        await this.adapter.revokeStaleLeases(this.taskTimeoutMs);
      }

      const now = Date.now();
      for (const task of current.tasks) {
        if (task.status === 'running' && task.startedAt) {
          const elapsed = now - new Date(task.startedAt).getTime();
          if (elapsed > this.taskTimeoutMs) {
            await this.adapter.failStaleTask(
              task.taskId,
              `stale task timeout after ${this.taskTimeoutMs}ms (worker may have died)`
            );
          }
        }
      }

      if (current.status === 'completed' || current.status === 'failed') {
        return current;
      }
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }
    throw new Error('Timed out waiting for external workers to complete the job');
  }
}
