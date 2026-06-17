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
      task!.leaseToken
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

  test('accepts missing lease token in compatibility mode', async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: 'test',
      executionProfile: 'fixture',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks: buildTasksFromPlans('job-compat', [{ queryFamily: 'a', query: 'q1' }], 1),
    });

    const task = await adapter.claimNextTask(job.jobId, 'worker-1');
    await adapter.completeTask(task!.taskId, {
      sources: [],
      usageMetrics: { providerCalls: 1, apiCalls: 1 },
    });

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.status).toBe('completed');
  });
});
