import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryQueueAdapter } from '../../src/distributed/memory-adapter';
import { buildTasksFromPlans } from '../../src/distributed/task-splitter';

describe('QueueAdapterFacade token validation', () => {
  async function createAdapter(): Promise<MemoryQueueAdapter> {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-facade-'));
    return new MemoryQueueAdapter({ workDir });
  }

  test('default lease still completes after the default task timeout', async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: 'test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks: buildTasksFromPlans('job-long-task', [{ queryFamily: 'a', query: 'q1' }], 1),
    });
    const now = Date.now();
    const realNow = Date.now;
    Date.now = () => now;

    try {
      const task = await adapter.claimNextTask(job.jobId, 'worker-1');
      Date.now = () => now + 301_000;
      await adapter.completeTask(
        task!.taskId,
        { sources: [], usageMetrics: { providerCalls: 1, apiCalls: 1 } },
        task!.leaseToken!
      );
    } finally {
      Date.now = realNow;
    }

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.status).toBe('completed');
  });

  test('accepts valid lease token on completeTask', async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: 'test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks: buildTasksFromPlans('job-token', [{ queryFamily: 'a', query: 'q1' }], 1),
    });

    const task = await adapter.claimNextTask(job.jobId, 'worker-1');
    expect(task?.leaseToken).toBeDefined();

    await adapter.completeTask(
      task!.taskId,
      { sources: [], usageMetrics: { providerCalls: 1, apiCalls: 1 } },
      task!.leaseToken!
    );

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.status).toBe('completed');
  });

  test('rejects invalid lease token on completeTask', async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: 'test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks: buildTasksFromPlans('job-bad-token', [{ queryFamily: 'a', query: 'q1' }], 1),
    });

    const task = await adapter.claimNextTask(job.jobId, 'worker-1');

    await adapter.completeTask(
      task!.taskId,
      { sources: [], usageMetrics: { providerCalls: 1, apiCalls: 1 } },
      'invalid-token'
    );

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.status).not.toBe('completed');
  });

  test('rejects missing lease token on completeTask', async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: 'test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks: buildTasksFromPlans('job-missing-token', [{ queryFamily: 'a', query: 'q1' }], 1),
    });

    const task = await adapter.claimNextTask(job.jobId, 'worker-1');
    // Pass an empty string as the missing token; the facade should reject it.
    await adapter.completeTask(
      task!.taskId,
      { sources: [], usageMetrics: { providerCalls: 1, apiCalls: 1 } },
      ''
    );

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.status).not.toBe('completed');
  });
});
