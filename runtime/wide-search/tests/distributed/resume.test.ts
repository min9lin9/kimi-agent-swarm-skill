import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryQueueAdapter } from '../../src/distributed/memory-adapter';
import { runDistributedWideSearch } from '../../src/distributed/runner';
import { buildTasksFromPlans } from '../../src/distributed/task-splitter';

describe('distributed resume with memory queue', () => {
  test('resumes a partially completed job and finishes with passing verification', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-resume-'));
    const adapter = new MemoryQueueAdapter({ workDir });

    const tasks = buildTasksFromPlans(
      'resume-job',
      [
        { queryFamily: 'primary', query: 'resume test query 1' },
        { queryFamily: 'latest', query: 'resume test query 2' },
      ],
      1
    );

    const job = await adapter.createJob({
      objective: 'Resume test',
      executionProfile: 'web-search',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks,
      workDir,
    });

    // Complete the first task manually to simulate partial progress.
    const firstTask = await adapter.claimNextTask(job.jobId, 'manual-worker');
    expect(firstTask).toBeDefined();
    await adapter.completeTask(
      firstTask!.taskId,
      {
        sources: [],
        usageMetrics: { providerCalls: 0, apiCalls: 0 },
      },
      firstTask!.leaseToken!
    );

    const result = await runDistributedWideSearch({
      objective: 'Resume test',
      profile: 'web-search',
      workDir,
      distributed: { enabled: true, workers: 2, resumeJobId: job.jobId },
    });

    expect(result.verification.status).toBe('passed');
    expect(result.verification.acceptedSources).toBeGreaterThan(0);

    // Use a fresh adapter to read persisted job state.
    const freshAdapter = new MemoryQueueAdapter({ workDir });
    const resumedJob = await freshAdapter.getJob(job.jobId);
    expect(resumedJob?.status).toBe('completed');
    expect(resumedJob?.tasks.every((t) => t.status === 'completed')).toBe(true);
  });

  test('requeues persisted running tasks on resume', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-resume-running-'));
    const adapter = new MemoryQueueAdapter({ workDir });
    const job = await adapter.createJob({
      objective: 'Resume running task',
      executionProfile: 'fixture-paul-graham-corpus',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'running',
      tasks: buildTasksFromPlans(
        'resume-running-job',
        [
          { queryFamily: 'done', query: 'PG-001' },
          { queryFamily: 'running', query: 'PG-002' },
        ],
        1
      ),
      workDir,
    });

    const done = await adapter.claimNextTask(job.jobId, 'worker-1');
    expect(done).toBeDefined();
    await adapter.completeTask(
      done!.taskId,
      {
        sources: [
          {
            id: 'S001',
            title: 'How to Start a Startup',
            url: 'http://www.paulgraham.com/start.html',
            sourceClass: 'primary',
            publishedAt: '2026-01-01',
            discoveredBy: 'paul-graham-corpus',
            scores: { relevance: 5, authority: 5, freshness: 3, diversity: 4, extractionValue: 5 },
            claims: ['A startup is a company designed to grow fast.'],
          },
        ],
        usageMetrics: { providerCalls: 1, apiCalls: 1 },
      },
      done!.leaseToken!
    );
    expect(await adapter.claimNextTask(job.jobId, 'worker-2')).toBeDefined();

    const result = await runDistributedWideSearch({
      objective: 'Resume running task',
      profile: 'fixture-paul-graham-corpus',
      workDir,
      distributed: { enabled: true, workers: 1, resumeJobId: job.jobId },
    });

    expect(result.verification.status).toBe('passed');
    const freshAdapter = new MemoryQueueAdapter({ workDir });
    const resumedJob = await freshAdapter.getJob(job.jobId);
    expect(resumedJob?.tasks.every((t) => t.status === 'completed')).toBe(true);
  });
});
