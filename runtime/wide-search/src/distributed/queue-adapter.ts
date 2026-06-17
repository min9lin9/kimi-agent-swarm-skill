import { defaultLogger } from '../logger';
import { deriveJobStatus } from './job-status';
import type { JobStore } from './job-store';
import type { LeaseStore } from './lease-store';
import type { TaskQueue } from './task-queue';
import type { DistributedJob, DistributedTask, WorkerResult } from '../types';

export interface QueueAdapter {
  readonly type: string;

  createJob(
    job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>
  ): Promise<DistributedJob>;

  getJob(jobId: string): Promise<DistributedJob | undefined>;
  saveJob(job: DistributedJob): Promise<void>;

  claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined>;
  completeTask(taskId: string, result: WorkerResult, leaseToken?: string): Promise<void>;
  failTask(taskId: string, error: string, leaseToken?: string): Promise<void>;

  getPendingTaskCount(jobId: string): Promise<number>;
  getRunningTaskCount(jobId: string): Promise<number>;
  quit?(): Promise<void>;
  revokeStaleLeases?(ttlMs?: number): Promise<string[]>;
}

export function makeJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `job-${timestamp}-${random}`;
}

export function makeTaskId(jobId: string, index: number): string {
  return `${jobId}-task-${String(index + 1).padStart(4, '0')}`;
}

export interface QueueAdapterFacadeOptions {
  type: string;
  jobStore: JobStore;
  taskQueue: TaskQueue;
  leaseStore: LeaseStore;
}

/**
 * Compatibility facade that exposes the legacy `QueueAdapter` interface while
 * delegating persistence, queueing, and lease tracking to focused internal stores.
 *
 * Lease token validation is in compatibility mode during Phase 3: a missing token
 * is accepted but logged as a deprecation warning. Phase 4 will make tokens required.
 */
export class QueueAdapterFacade implements QueueAdapter {
  readonly type: string;
  private readonly jobStore: JobStore;
  private readonly taskQueue: TaskQueue;
  private readonly leaseStore: LeaseStore;
  private readonly leaseTtlMs = 30_000;

  constructor(options: QueueAdapterFacadeOptions) {
    this.type = options.type;
    this.jobStore = options.jobStore;
    this.taskQueue = options.taskQueue;
    this.leaseStore = options.leaseStore;
  }

  async createJob(
    job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>
  ): Promise<DistributedJob> {
    const created = await this.jobStore.createJob(job);
    await this.taskQueue.enqueueTasks(created.jobId, created.tasks);
    return created;
  }

  async getJob(jobId: string): Promise<DistributedJob | undefined> {
    const job = await this.jobStore.getJob(jobId);
    if (job) {
      job.status = deriveJobStatus(job.tasks);
    }
    return job;
  }

  async saveJob(job: DistributedJob): Promise<void> {
    return this.jobStore.saveJob(job);
  }

  async claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined> {
    const task = await this.taskQueue.claimNextTask(jobId, workerId);
    if (task) {
      const token = await this.leaseStore.claimLease(task.taskId, workerId, this.leaseTtlMs);
      task.leaseToken = token;
    }
    return task;
  }

  async completeTask(taskId: string, result: WorkerResult, leaseToken?: string): Promise<void> {
    const found = await this.jobStore.findTask(taskId);
    if (!found) return;

    const { job, task } = found;

    if (leaseToken !== undefined) {
      const renewed = await this.leaseStore.renewLease(leaseToken, this.leaseTtlMs);
      if (!renewed) {
        defaultLogger.warn(`completeTask rejected for ${taskId}: invalid or expired lease token`);
        return;
      }
      await this.leaseStore.releaseLease(leaseToken);
    } else {
      defaultLogger.warn(
        `completeTask called without lease token for ${taskId}; accepting in compatibility mode`
      );
    }

    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date().toISOString();
    task.error = undefined;

    job.status = deriveJobStatus(job.tasks);
    await this.jobStore.saveJob(job);
  }

  async failTask(taskId: string, error: string, leaseToken?: string): Promise<void> {
    const found = await this.jobStore.findTask(taskId);
    if (!found) return;

    const { job, task } = found;

    if (leaseToken !== undefined) {
      const renewed = await this.leaseStore.renewLease(leaseToken, this.leaseTtlMs);
      if (!renewed) {
        defaultLogger.warn(`failTask rejected for ${taskId}: invalid or expired lease token`);
        return;
      }
      await this.leaseStore.releaseLease(leaseToken);
    } else {
      defaultLogger.warn(
        `failTask called without lease token for ${taskId}; accepting in compatibility mode`
      );
    }

    task.error = error;
    if (task.attempts >= task.maxRetries) {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
    } else {
      await this.taskQueue.requeueTask(task);
    }

    job.status = deriveJobStatus(job.tasks);
    await this.jobStore.saveJob(job);
  }

  async getPendingTaskCount(jobId: string): Promise<number> {
    return this.taskQueue.countPending(jobId);
  }

  async getRunningTaskCount(jobId: string): Promise<number> {
    return this.leaseStore.getRunningCount(jobId);
  }

  async revokeStaleLeases(ttlMs = this.leaseTtlMs): Promise<string[]> {
    return this.leaseStore.revokeStaleLeases(ttlMs);
  }
}
