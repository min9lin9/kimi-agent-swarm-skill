import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { deriveJobStatus } from '../../src/distributed/job-status';
import { MemoryQueueAdapter } from '../../src/distributed/memory-adapter';
import { buildTasksFromPlans, splitFixtureTasks } from '../../src/distributed/task-splitter';
import { ExternalWorkerPool, InProcessWorkerPool } from '../../src/distributed/worker-pool';

describe('WorkerPool', () => {
  async function createAdapter(): Promise<MemoryQueueAdapter> {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-worker-pool-'));
    return new MemoryQueueAdapter({ workDir });
  }

  async function createFixtureJob(
    adapter: MemoryQueueAdapter
  ): Promise<ReturnType<typeof adapter.createJob>> {
    const plans = await splitFixtureTasks(
      'fixture-paul-graham-corpus',
      join(import.meta.dir, '../../fixtures'),
      5
    );
    return adapter.createJob({
      objective: 'test',
      executionProfile: 'fixture-paul-graham-corpus',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks: buildTasksFromPlans('job-pool', plans.slice(0, 2), 1),
      useCache: false,
      budget: {},
      workDir: process.cwd(),
    });
  }

  test('InProcessWorkerPool runs fixture tasks to completion', async () => {
    const adapter = await createAdapter();
    const job = await createFixtureJob(adapter);

    const pool = new InProcessWorkerPool();
    const completed = await pool.run(job, {
      adapter,
      workers: 2,
      profile: job.executionProfile,
      providerName: job.providerName,
      searchDepth: job.searchDepth,
      perTaskMaxResults: undefined,
      useCache: false,
      budget: {},
      workDir: process.cwd(),
    });

    expect(deriveJobStatus(completed.tasks)).toBe('completed');
  }, 10000);

  test('ExternalWorkerPool.runOnce processes one task', async () => {
    const adapter = await createAdapter();
    const job = await createFixtureJob(adapter);

    const pool = new ExternalWorkerPool({
      adapter,
      profile: job.executionProfile,
      providerName: job.providerName,
      searchDepth: job.searchDepth,
      perTaskMaxResults: undefined,
      useCache: false,
      budget: {},
      workDir: process.cwd(),
    });

    await pool.runOnce(job.jobId, 'external-worker-1');

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.tasks.some((t) => t.status === 'completed')).toBe(true);
  }, 10000);
});
