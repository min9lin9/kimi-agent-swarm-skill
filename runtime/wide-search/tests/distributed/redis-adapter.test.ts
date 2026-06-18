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

    await adapter.completeTask(
      task!.taskId,
      {
        sources: [],
        usageMetrics: { providerCalls: 1, apiCalls: 1 },
      },
      task!.leaseToken!
    );
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

    await adapter.failTask(task!.taskId, 'boom', task!.leaseToken!);
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(0);

    const retried = await adapter.claimNextTask(job.jobId, 'worker-2');
    expect(retried).toBeDefined();
    expect(retried?.attempts).toBe(2);
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(1);

    await adapter.failTask(retried!.taskId, 'boom again', retried!.leaseToken!);
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(0);

    const failedJob = await adapter.getJob(job.jobId);
    expect(failedJob?.tasks[0].status).toBe('failed');
  });

  test('revokes stale leases and clears running count', async () => {
    const job = await adapter.createJob({
      objective: 'stale lease test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'redis',
      status: 'pending',
      tasks: buildTasksFromPlans('job-stale', [{ queryFamily: 'a', query: 'q1' }], 1),
    });

    const task = await adapter.claimNextTask(job.jobId, 'worker-1');
    expect(task).toBeDefined();
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 30));
    const revoked = await adapter.revokeStaleLeases!(10);

    expect(revoked).toContain(task!.taskId);
    expect(await adapter.getRunningTaskCount(job.jobId)).toBe(0);
  });

  test('quit is idempotent', async () => {
    await adapter.quit();
    await expect(adapter.quit()).resolves.toBeUndefined();
  });
});
