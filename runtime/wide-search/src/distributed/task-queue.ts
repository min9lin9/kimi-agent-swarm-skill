import type { DistributedTask } from '../types';
import type { JobStore } from './job-store';
import type { RedisClient } from './redis-client';

export interface TaskQueue {
  readonly type: string;

  enqueueTasks(jobId: string, tasks: DistributedTask[]): Promise<void>;
  claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined>;
  requeueTask(task: DistributedTask): Promise<void>;
  updateTask(task: DistributedTask): Promise<void>;
  countPending(jobId: string): Promise<number>;
}

export interface MemoryTaskQueueOptions {
  jobStore: JobStore;
}

export class MemoryTaskQueue implements TaskQueue {
  readonly type = 'memory';
  private readonly jobStore: JobStore;

  constructor(options: MemoryTaskQueueOptions) {
    this.jobStore = options.jobStore;
  }

  async enqueueTasks(jobId: string, tasks: DistributedTask[]): Promise<void> {
    const job = await this.jobStore.getJob(jobId);
    if (!job) return;
    for (const task of tasks) {
      task.jobId = jobId;
      const existing = job.tasks.find((t) => t.taskId === task.taskId);
      if (existing) {
        Object.assign(existing, task);
      } else {
        job.tasks.push(task);
      }
    }
    await this.jobStore.saveJob(job);
  }

  async claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined> {
    const job = await this.jobStore.getJob(jobId);
    if (!job) return undefined;

    const task = job.tasks.find((t) => t.status === 'pending' && t.attempts < t.maxRetries);
    if (!task) return undefined;

    task.status = 'running';
    task.workerId = workerId;
    task.attempts += 1;
    task.startedAt = new Date().toISOString();
    await this.jobStore.saveJob(job);
    return task;
  }

  async requeueTask(task: DistributedTask): Promise<void> {
    const job = await this.jobStore.getJob(task.jobId);
    if (!job) return;

    const existing = job.tasks.find((t) => t.taskId === task.taskId);
    if (!existing) return;

    existing.status = 'pending';
    existing.workerId = undefined;
    existing.startedAt = undefined;
    existing.leaseToken = undefined;
    existing.attempts = task.attempts;
    await this.jobStore.saveJob(job);
  }

  async updateTask(task: DistributedTask): Promise<void> {
    const job = await this.jobStore.getJob(task.jobId);
    if (!job) return;
    const existing = job.tasks.find((t) => t.taskId === task.taskId);
    if (!existing) return;
    Object.assign(existing, task);
    await this.jobStore.saveJob(job);
  }

  async countPending(jobId: string): Promise<number> {
    const job = await this.jobStore.getJob(jobId);
    if (!job) return 0;
    return job.tasks.filter((t) => t.status === 'pending').length;
  }
}

export interface RedisTaskQueueOptions {
  keyPrefix?: string;
  getClient: () => Promise<RedisClient>;
}

export class RedisTaskQueue implements TaskQueue {
  readonly type = 'redis';
  private readonly keyPrefix: string;
  private readonly getClient: () => Promise<RedisClient>;

  constructor(options: RedisTaskQueueOptions) {
    this.keyPrefix = options.keyPrefix ?? 'kasw';
    this.getClient = options.getClient;
  }

  private taskKey(taskId: string): string {
    return `${this.keyPrefix}:task:${taskId}`;
  }

  private queueKey(jobId: string): string {
    return `${this.keyPrefix}:queue:${jobId}`;
  }

  async enqueueTasks(jobId: string, tasks: DistributedTask[]): Promise<void> {
    const client = await this.getClient();
    for (const task of tasks) {
      task.jobId = jobId;
      await client.set(this.taskKey(task.taskId), JSON.stringify(task));
      await client.rpush(this.queueKey(jobId), task.taskId);
    }
  }

  async claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined> {
    const client = await this.getClient();
    const script = `local taskId = redis.call('LPOP', KEYS[1])
if not taskId then return nil end
local taskJson = redis.call('GET', KEYS[2] .. ':' .. taskId)
if not taskJson then return nil end
local task = cjson.decode(taskJson)
task.status = 'running'
task.workerId = ARGV[1]
task.attempts = task.attempts + 1
task.startedAt = ARGV[2]
redis.call('SET', KEYS[2] .. ':' .. taskId, cjson.encode(task))
return cjson.encode(task)`;
    const result = await client.eval(
      script,
      2,
      this.queueKey(jobId),
      `${this.keyPrefix}:task`,
      workerId,
      new Date().toISOString()
    );
    if (!result) return undefined;
    return JSON.parse(result as string) as DistributedTask;
  }

  async requeueTask(task: DistributedTask): Promise<void> {
    const client = await this.getClient();
    task.status = 'pending';
    task.workerId = undefined;
    task.startedAt = undefined;
    task.leaseToken = undefined;
    await client.set(this.taskKey(task.taskId), JSON.stringify(task));
    await client.rpush(this.queueKey(task.jobId), task.taskId);
  }

  async updateTask(task: DistributedTask): Promise<void> {
    const client = await this.getClient();
    await client.set(this.taskKey(task.taskId), JSON.stringify(task));
  }

  async countPending(jobId: string): Promise<number> {
    const client = await this.getClient();
    return client.llen(this.queueKey(jobId));
  }
}
