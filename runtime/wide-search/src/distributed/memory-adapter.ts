import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DistributedJob, DistributedTask, WorkerResult } from '../types';
import { deriveJobStatus } from './job-status';
import type { QueueAdapter } from './queue-adapter';

export interface MemoryAdapterOptions {
  workDir?: string;
}

export class MemoryQueueAdapter implements QueueAdapter {
  readonly type = 'memory';
  private readonly jobs = new Map<string, DistributedJob>();
  private readonly workDir: string;

  constructor(options: MemoryAdapterOptions = {}) {
    this.workDir = options.workDir ?? process.cwd();
  }

  private jobFilePath(jobId: string): string {
    return join(this.workDir, '.runs', 'wide-search', 'jobs', `${jobId}.json`);
  }

  async createJob(
    job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>
  ): Promise<DistributedJob> {
    const now = new Date().toISOString();
    const created: DistributedJob = {
      ...job,
      jobId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(created.jobId, created);
    await this.saveJob(created);
    return created;
  }

  async getJob(jobId: string): Promise<DistributedJob | undefined> {
    const cached = this.jobs.get(jobId);
    if (cached) {
      cached.status = deriveJobStatus(cached.tasks);
      return cached;
    }

    try {
      const text = await readFile(this.jobFilePath(jobId), 'utf8');
      const loaded = JSON.parse(text) as DistributedJob;
      loaded.status = deriveJobStatus(loaded.tasks);
      this.jobs.set(jobId, loaded);
      return loaded;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async saveJob(job: DistributedJob): Promise<void> {
    const path = this.jobFilePath(job.jobId);
    await mkdir(join(path, '..'), { recursive: true });
    const updated = { ...job, updatedAt: new Date().toISOString() };
    this.jobs.set(job.jobId, updated);
    await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  }

  async claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined> {
    const job = await this.getJob(jobId);
    if (!job) return undefined;

    const task = job.tasks.find((t) => t.status === 'pending' && t.attempts < t.maxRetries);
    if (!task) return undefined;

    task.status = 'running';
    task.workerId = workerId;
    task.attempts += 1;
    task.startedAt = new Date().toISOString();
    job.status = deriveJobStatus(job.tasks);
    await this.saveJob(job);
    return task;
  }

  async completeTask(taskId: string, result: WorkerResult): Promise<void> {
    const { job, task } = await this.findTask(taskId);
    if (!task || !job) return;

    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date().toISOString();
    task.error = undefined;

    job.status = deriveJobStatus(job.tasks);
    await this.saveJob(job);
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const { job, task } = await this.findTask(taskId);
    if (!task || !job) return;

    task.error = error;
    if (task.attempts >= task.maxRetries) {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
    } else {
      task.status = 'pending';
      task.workerId = undefined;
      task.startedAt = undefined;
    }

    job.status = deriveJobStatus(job.tasks);
    await this.saveJob(job);
  }

  async getPendingTaskCount(jobId: string): Promise<number> {
    const job = await this.getJob(jobId);
    if (!job) return 0;
    return job.tasks.filter((t) => t.status === 'pending').length;
  }

  async getRunningTaskCount(jobId: string): Promise<number> {
    const job = await this.getJob(jobId);
    if (!job) return 0;
    return job.tasks.filter((t) => t.status === 'running').length;
  }

  private async findTask(
    taskId: string
  ): Promise<{ job?: DistributedJob; task?: DistributedTask }> {
    for (const job of this.jobs.values()) {
      const task = job.tasks.find((t) => t.taskId === taskId);
      if (task) {
        return { job, task };
      }
    }
    return {};
  }
}
