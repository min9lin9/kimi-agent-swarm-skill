import { afterAll, describe, expect, test } from 'bun:test';

import { RedisQueueAdapter } from '../../src/distributed/redis-adapter';
import { buildTasksFromPlans } from '../../src/distributed/task-splitter';
import { isRedisAvailable } from './redis-availability';

const redisAvailable = await isRedisAvailable();
const describeOrSkip = redisAvailable ? describe : describe.skip;

describeOrSkip('RedisQueueAdapter', () => {
  const prefix = `test:kasw:adapter:${Date.now()}`;
  const adapter = new RedisQueueAdapter({ keyPrefix: prefix });

  afterAll(async () => {
    await adapter.flushKeys();
    await adapter.quit();
  });

  test('creates and retrieves a job', async () => {
    const job = await adapter.createJob({
      objective: 'test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'redis',
      status: 'pending',
      tasks: buildTasksFromPlans('job-1', [{ queryFamily: 'a', query: 'q1' }], 2),
    });

    expect(job.jobId).toBeDefined();
    expect(job.tasks.length).toBe(1);

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.objective).toBe('test');
  });

  test('claim increments and complete decrements running count', async () => {
    const job = await adapter.createJob({
      objective: 'running count test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'redis',
      status: 'pending',
      tasks: buildTasksFromPlans('job-2', [{ queryFamily: 'a', query: 'q1' }], 2),
    });

    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(0);

    const task = await adapter.claimNextTask(job.jobId, 'worker-1');
    expect(task).toBeDefined();
    expect(task?.status).toBe('running');
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(1);

    await adapter.completeTask(task!.taskId, {
      sources: [],
      usageMetrics: { providerCalls: 1, apiCalls: 1 },
    });
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(0);

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.status).toBe('completed');
  });

  test('retries failed tasks and decrements running count', async () => {
    const job = await adapter.createJob({
      objective: 'retry test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'redis',
      status: 'pending',
      tasks: buildTasksFromPlans('job-3', [{ queryFamily: 'a', query: 'q1' }], 2),
    });

    const task = await adapter.claimNextTask(job.jobId, 'worker-1');
    expect(task).toBeDefined();
    expect(task?.attempts).toBe(1);
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(1);

    await adapter.failTask(task!.taskId, 'boom');
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(0);

    const retried = await adapter.claimNextTask(job.jobId, 'worker-2');
    expect(retried).toBeDefined();
    expect(retried?.attempts).toBe(2);
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(1);

    await adapter.failTask(retried!.taskId, 'boom again');
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(0);

    const failedJob = await adapter.getJob(job.jobId);
    expect(failedJob?.tasks[0].status).toBe('failed');
  });

  test('quit is idempotent', async () => {
    await adapter.quit();
    await expect(adapter.quit()).resolves.toBeUndefined();
  });
});
