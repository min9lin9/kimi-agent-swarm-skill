import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readFile } from 'node:fs/promises';
import { BudgetExceededError } from '../../src/costs';
import { MemoryQueueAdapter } from '../../src/distributed/memory-adapter';
import { runDistributedWideSearch } from '../../src/distributed/runner';
import { buildTasksFromPlans, splitWebSearchTasks } from '../../src/distributed/task-splitter';

describe('runDistributedWideSearch', () => {
  test('fixture distributed run produces accepted sources and verification', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-dist-run-'));

    const result = await runDistributedWideSearch({
      objective: 'Summarize Paul Graham essays',
      profile: 'fixture-paul-graham-corpus',
      workDir,
      distributed: { enabled: true, workers: 2 },
    });

    expect(result.verification.status).toBe('passed');
    expect(result.verification.acceptedSources).toBeGreaterThan(0);

    const runJson = JSON.parse(await readFile(join(result.runDir, 'run.json'), 'utf8'));
    expect(runJson.executionProfile).toBe('fixture-paul-graham-corpus');

    const synthesis = await readFile(join(result.runDir, 'synthesis.md'), 'utf8');
    expect(synthesis).toInclude('Summarize Paul Graham essays');
    expect(synthesis).toInclude(result.runId);
    expect(synthesis).toInclude('## Accepted sources');
    expect(synthesis).toInclude(
      '| Source | Class | Decision | Relevance | Authority | Freshness | Diversity | Extraction |'
    );
    expect(synthesis).toInclude('## Claims');
    expect(synthesis).toInclude('| Claim | Sources | Confidence | Freshness |');
    expect(synthesis).toInclude('## Verification details');
    expect(synthesis).toInclude('**Verification status:** passed');

    const jobJson = JSON.parse(await readFile(join(result.runDir, 'distributed-job.json'), 'utf8'));
    expect(jobJson.status).toBe('completed');
    expect(jobJson.tasks.every((t: { status: string }) => t.status === 'completed')).toBe(true);
  });

  test('web-search distributed run aborts with BudgetExceededError during execution', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-dist-budget-'));

    // Create a job with more tasks than the static estimate so the budget guard
    // is triggered while workers are processing tasks, not during the estimate check.
    const adapter = new MemoryQueueAdapter({ workDir });
    const basePlans = splitWebSearchTasks('AI browser agent repos');
    const plans = [...basePlans, ...basePlans];
    const tasks = buildTasksFromPlans('budget-job', plans, 1);
    const job = await adapter.createJob({
      objective: 'AI browser agent repos',
      executionProfile: 'web-search',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks,
    });

    // The static estimate is 5 provider calls; allow 5 so the estimate passes,
    // then fail on the 6th task during execution.
    await expect(
      runDistributedWideSearch({
        objective: 'AI browser agent repos',
        profile: 'web-search',
        providerName: 'mock',
        workDir,
        distributed: { enabled: true, workers: 1, resumeJobId: job.jobId, queueType: 'memory' },
        budget: { maxProviderCalls: 5 },
      })
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });

  test('resume rejects mixed completed and failed terminal tasks', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-dist-mixed-terminal-'));
    const adapter = new MemoryQueueAdapter({ workDir });
    const tasks = buildTasksFromPlans(
      'mixed-job',
      [
        { queryFamily: 'accepted', query: 'paul-graham-essay-1' },
        { queryFamily: 'failed', query: 'missing-source' },
      ],
      1
    );
    const job = await adapter.createJob({
      objective: 'Summarize mixed terminal job',
      executionProfile: 'fixture-paul-graham-corpus',
      providerName: 'mock',
      searchDepth: 'standard',
      queueType: 'memory',
      status: 'pending',
      tasks,
    });

    const accepted = await adapter.claimNextTask(job.jobId, 'worker-1');
    expect(accepted).toBeDefined();
    if (!accepted) throw new Error('expected first task to be claimable');
    await adapter.completeTask(accepted.taskId, {
      sources: [
        {
          id: 'S001',
          title: 'Accepted source',
          url: 'https://example.test/source',
          sourceClass: 'primary',
          discoveredBy: 'test',
          scores: { relevance: 5, authority: 5 },
          claims: ['A useful source survived before another task failed.'],
        },
      ],
      usageMetrics: { providerCalls: 1, apiCalls: 1 },
    });

    const failed = await adapter.claimNextTask(job.jobId, 'worker-2');
    expect(failed).toBeDefined();
    if (!failed) throw new Error('expected second task to be claimable');
    await adapter.failTask(failed.taskId, 'fixture task failed');

    await expect(
      runDistributedWideSearch({
        objective: 'Summarize mixed terminal job',
        profile: 'fixture-paul-graham-corpus',
        workDir,
        distributed: { enabled: true, workers: 1, resumeJobId: job.jobId, queueType: 'memory' },
      })
    ).rejects.toThrow('Distributed job failed');
  });
});
