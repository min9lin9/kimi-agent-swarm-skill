import { defaultLogger } from '../logger';
import type { DistributedJob, DistributedTask, WorkerResult } from '../types';
import type { QueueAdapter } from './queue-adapter';

export interface RedisAdapterOptions {
  redisUrl?: string;
  password?: string;
  username?: string;
  keyPrefix?: string;
}

interface RedisClient {
  on(event: 'error', listener: (err: Error) => void): this;
  on(event: 'reconnecting', listener: () => void): this;
  quit(): Promise<'OK'>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK'>;
  lpop(key: string): Promise<string | null>;
  rpush(key: string, ...values: string[]): Promise<number>;
  llen(key: string): Promise<number>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  scard(key: string): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  del(...keys: string[]): Promise<number>;
}

export class RedisQueueAdapter implements QueueAdapter {
  readonly type = 'redis';
  private readonly redisUrl: string;
  private readonly password?: string;
  private readonly username?: string;
  private readonly keyPrefix: string;
  private client?: RedisClient;

  constructor(options: RedisAdapterOptions = {}) {
    this.redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.password = options.password ?? process.env.REDIS_PASSWORD;
    this.username = options.username;
    this.keyPrefix = options.keyPrefix ?? 'kasw';
  }

  private async getClient(): Promise<RedisClient> {
    if (!this.client) {
      let Redis: (new (url: string) => RedisClient) | undefined;
      try {
        // ioredis is an optional dependency. Use a variable module name so
        // TypeScript does not require it at compile time.
        const moduleName = 'ioredis';
        const mod = (await import(moduleName)) as unknown as {
          default?: new (url: string) => RedisClient;
          Redis?: new (url: string) => RedisClient;
        };
        Redis = mod.default ?? mod.Redis;
        if (!Redis) {
          throw new Error('ioredis export not found');
        }
      } catch {
        throw new Error('Redis adapter requires ioredis. Install it with: bun add ioredis');
      }

      const url = new URL(this.redisUrl);
      if (this.username && !url.username) {
        url.username = this.username;
      }
      if (this.password && !url.password) {
        url.password = this.password;
      }

      this.client = new Redis(url.toString());
      this.client.on('error', (err: Error) => {
        defaultLogger.error(`Redis adapter connection error: ${err.message}`);
      });
      this.client.on('reconnecting', () => {
        defaultLogger.error('Redis adapter reconnecting...');
      });
    }
    return this.client;
  }

  async quit(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = undefined;
    }
  }

  private jobKey(jobId: string): string {
    return `${this.keyPrefix}:job:${jobId}`;
  }

  private taskKey(taskId: string): string {
    return `${this.keyPrefix}:task:${taskId}`;
  }

  private queueKey(jobId: string): string {
    return `${this.keyPrefix}:queue:${jobId}`;
  }

  private runningKey(jobId: string): string {
    return `${this.keyPrefix}:running:${jobId}`;
  }

  private defaultPattern(): string {
    return `${this.keyPrefix}:*`;
  }

  async flushKeys(pattern?: string): Promise<number> {
    const client = await this.getClient();
    const keys = await client.keys(pattern ?? this.defaultPattern());
    if (keys.length === 0) return 0;
    return client.del(...keys);
  }

  async createJob(
    job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>
  ): Promise<DistributedJob> {
    const client = await this.getClient();
    const now = new Date().toISOString();
    const created: DistributedJob = {
      ...job,
      jobId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };

    for (const task of created.tasks) {
      task.jobId = created.jobId;
    }

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
    const job = JSON.parse(text) as DistributedJob;

    // Refresh tasks from their individual keys so getJob always reflects the
    // latest task statuses, avoiding read-modify-write races between workers.
    const refreshed: DistributedTask[] = [];
    for (const t of job.tasks) {
      const taskText = await client.get(this.taskKey(t.taskId));
      refreshed.push(taskText ? (JSON.parse(taskText) as DistributedTask) : t);
    }
    job.tasks = refreshed;
    this.updateJobStatus(job);
    return job;
  }

  async saveJob(job: DistributedJob): Promise<void> {
    const client = await this.getClient();
    const updated = { ...job, updatedAt: new Date().toISOString() };
    await client.set(this.jobKey(job.jobId), JSON.stringify(updated));
  }

  async claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined> {
    const client = await this.getClient();
    const taskId = await client.lpop(this.queueKey(jobId));
    if (!taskId) return undefined;

    const taskText = await client.get(this.taskKey(taskId));
    if (!taskText) return undefined;

    const task = JSON.parse(taskText) as DistributedTask;
    task.status = 'running';
    task.workerId = workerId;
    task.attempts += 1;
    task.startedAt = new Date().toISOString();

    await client.set(this.taskKey(task.taskId), JSON.stringify(task));
    await client.sadd(this.runningKey(jobId), taskId);
    return task;
  }

  async completeTask(taskId: string, result: WorkerResult): Promise<void> {
    const client = await this.getClient();
    const taskText = await client.get(this.taskKey(taskId));
    if (!taskText) return;

    const task = JSON.parse(taskText) as DistributedTask;
    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date().toISOString();
    task.error = undefined;
    await client.set(this.taskKey(taskId), JSON.stringify(task));
    await client.srem(this.runningKey(task.jobId), taskId);
  }

  async failTask(taskId: string, error: string): Promise<void> {
    const client = await this.getClient();
    const taskText = await client.get(this.taskKey(taskId));
    if (!taskText) return;

    const task = JSON.parse(taskText) as DistributedTask;
    task.error = error;
    await client.srem(this.runningKey(task.jobId), taskId);

    if (task.attempts >= task.maxRetries) {
      task.status = 'failed';
      task.completedAt = new Date().toISOString();
    } else {
      task.status = 'pending';
      task.workerId = undefined;
      task.startedAt = undefined;
      await client.rpush(this.queueKey(task.jobId), task.taskId);
    }

    await client.set(this.taskKey(taskId), JSON.stringify(task));
  }

  async getPendingTaskCount(jobId: string): Promise<number> {
    const client = await this.getClient();
    return client.llen(this.queueKey(jobId));
  }

  async getRunningTaskCount(jobId: string): Promise<number> {
    const client = await this.getClient();
    return client.scard(this.runningKey(jobId));
  }

  private updateJobStatus(job: DistributedJob): void {
    if (job.tasks.every((t) => t.status === 'completed')) {
      job.status = 'completed';
    } else if (job.tasks.some((t) => t.status === 'running')) {
      job.status = 'running';
    } else if (job.tasks.every((t) => t.status === 'failed')) {
      job.status = 'failed';
    } else {
      job.status = 'running';
    }
  }
}
