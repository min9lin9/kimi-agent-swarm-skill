import type { QueueAdapter } from "./queue-adapter";
import type { DistributedJob, DistributedTask, WorkerResult } from "../types";

export interface RedisAdapterOptions {
  redisUrl?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Redis: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Redis = require("ioredis");
} catch {
  Redis = undefined;
}

export class RedisQueueAdapter implements QueueAdapter {
  readonly type = "redis";
  private readonly redisUrl: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client?: any;

  constructor(options: RedisAdapterOptions = {}) {
    this.redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? "redis://localhost:6379";
    if (!Redis) {
      throw new Error(
        "Redis adapter requires ioredis. Install it with: bun add ioredis",
      );
    }
  }

  private async getClient() {
    if (!this.client) {
      this.client = new Redis(this.redisUrl);
    }
    return this.client;
  }

  private jobKey(jobId: string): string {
    return `kasw:job:${jobId}`;
  }

  private taskKey(taskId: string): string {
    return `kasw:task:${taskId}`;
  }

  private queueKey(jobId: string): string {
    return `kasw:queue:${jobId}`;
  }

  async createJob(
    job: Omit<DistributedJob, "jobId" | "createdAt" | "updatedAt">,
  ): Promise<DistributedJob> {
    const client = await this.getClient();
    const now = new Date().toISOString();
    const created: DistributedJob = {
      ...job,
      jobId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };

    await client.set(this.jobKey(created.jobId), JSON.stringify(created));
    for (const task of created.tasks) {
      await client.set(this.taskKey(task.taskId), JSON.stringify(task));
      await client.rpush(this.queueKey(created.jobId), task.taskId);
    }

    return created;
  }

  async getJob(jobId: string): Promise<DistributedJob | undefined> {
    const client = await this.getClient();
    const text = await client.get(this.jobKey(jobId));
    if (!text) return undefined;
    return JSON.parse(text) as DistributedJob;
  }

  async saveJob(job: DistributedJob): Promise<void> {
    const client = await this.getClient();
    const updated = { ...job, updatedAt: new Date().toISOString() };
    await client.set(this.jobKey(job.jobId), JSON.stringify(updated));
    for (const task of updated.tasks) {
      await client.set(this.taskKey(task.taskId), JSON.stringify(task));
    }
  }

  async claimNextTask(
    jobId: string,
    workerId: string,
  ): Promise<DistributedTask | undefined> {
    const client = await this.getClient();
    const taskId = await client.lpop(this.queueKey(jobId));
    if (!taskId) return undefined;

    const taskText = await client.get(this.taskKey(taskId));
    if (!taskText) return undefined;

    const task = JSON.parse(taskText) as DistributedTask;
    task.status = "running";
    task.workerId = workerId;
    task.attempts += 1;
    task.startedAt = new Date().toISOString();

    await client.set(this.taskKey(task.taskId), JSON.stringify(task));
    return task;
  }

  async completeTask(taskId: string, result: WorkerResult): Promise<void> {
    const client = await this.getClient();
    const taskText = await client.get(this.taskKey(taskId));
    if (!taskText) return;

    const task = JSON.parse(taskText) as DistributedTask;
    task.status = "completed";
    task.result = result;
    task.completedAt = new Date().toISOString();
    task.error = undefined;
    await client.set(this.taskKey(taskId), JSON.stringify(task));

    const job = await this.getJob(task.jobId);
    if (job) {
      const idx = job.tasks.findIndex((t) => t.taskId === taskId);
      if (idx >= 0) {
        job.tasks[idx] = task;
        this.updateJobStatus(job);
        await this.saveJob(job);
      }
    }
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const client = await this.getClient();
    const taskText = await client.get(this.taskKey(taskId));
    if (!taskText) return;

    const task = JSON.parse(taskText) as DistributedTask;
    task.error = error;

    if (task.attempts >= task.maxRetries) {
      task.status = "failed";
      task.completedAt = new Date().toISOString();
    } else {
      task.status = "pending";
      task.workerId = undefined;
      task.startedAt = undefined;
      await client.rpush(this.queueKey(task.jobId), task.taskId);
    }

    await client.set(this.taskKey(taskId), JSON.stringify(task));

    const job = await this.getJob(task.jobId);
    if (job) {
      const idx = job.tasks.findIndex((t) => t.taskId === taskId);
      if (idx >= 0) {
        job.tasks[idx] = task;
        this.updateJobStatus(job);
        await this.saveJob(job);
      }
    }
  }

  async getPendingTaskCount(jobId: string): Promise<number> {
    const client = await this.getClient();
    return client.llen(this.queueKey(jobId));
  }

  async getRunningTaskCount(_jobId: string): Promise<number> {
    // Running tasks are not tracked separately in this simple Redis adapter.
    return 0;
  }

  private updateJobStatus(job: DistributedJob): void {
    if (job.tasks.every((t) => t.status === "completed")) {
      job.status = "completed";
    } else if (job.tasks.some((t) => t.status === "running")) {
      job.status = "running";
    } else if (job.tasks.every((t) => t.status === "failed")) {
      job.status = "failed";
    } else {
      job.status = "running";
    }
  }
}
