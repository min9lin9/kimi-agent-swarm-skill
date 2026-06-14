import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readFile } from 'node:fs/promises';
import { RedisQueueAdapter } from '../../src/distributed/redis-adapter';
import { runDistributedWideSearch, workerLoop } from '../../src/distributed/runner';
import { isRedisAvailable } from './redis-availability';

const redisAvailable = await isRedisAvailable();
const describeOrSkip = redisAvailable ? describe : describe.skip;

describeOrSkip('runDistributedWideSearch with redis queue', () => {
  const prefix = `test:kasw:runner:${Date.now()}`;
  let workDir: string | undefined;

  afterAll(async () => {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
    const cleanupAdapter = new RedisQueueAdapter({ keyPrefix: prefix });
    await cleanupAdapter.flushKeys();
    await cleanupAdapter.quit();
  });

  test('fixture distributed run produces accepted sources and verification', async () => {
    workDir = await mkdtemp(join(tmpdir(), 'wide-search-redis-run-'));

    const result = await runDistributedWideSearch({
      objective: 'Summarize Paul Graham essays',
      profile: 'fixture-paul-graham-corpus',
      workDir,
      distributed: {
        enabled: true,
        workers: 2,
        queueType: 'redis',
        redisKeyPrefix: prefix,
      },
    });

    expect(result.verification.status).toBe('passed');
    expect(result.verification.acceptedSources).toBeGreaterThan(0);

    const runJson = JSON.parse(await readFile(join(result.runDir, 'run.json'), 'utf8'));
    expect(runJson.executionProfile).toBe('fixture-paul-graham-corpus');

    const jobJson = JSON.parse(await readFile(join(result.runDir, 'distributed-job.json'), 'utf8'));
    expect(jobJson.status).toBe('completed');
    expect(jobJson.tasks.every((t: { status: string }) => t.status === 'completed')).toBe(true);
  });

  test('workers 0 emits job id and completes via external worker', async () => {
    workDir = await mkdtemp(join(tmpdir(), 'wide-search-redis-external-'));

    const profile = 'fixture-paul-graham-corpus';
    const providerName = 'mock';
    const searchDepth = 'standard';

    const setupAdapter = new RedisQueueAdapter({ keyPrefix: prefix });
    const job = await setupAdapter.createJob({
      objective: 'Summarize Paul Graham essays',
      executionProfile: profile,
      providerName,
      searchDepth,
      queueType: 'redis',
      status: 'pending',
      tasks: [
        {
          taskId: 'external-task-1',
          jobId: 'placeholder',
          queryFamily: 'fixture',
          query: 'PG-001,PG-002',
          status: 'pending',
          attempts: 0,
          maxRetries: 1,
        },
      ],
      workDir,
    });
    await setupAdapter.quit();

    const workerPromise = (async () => {
      const workerAdapter = new RedisQueueAdapter({ keyPrefix: prefix });
      const metrics = { providerCalls: 0, apiCalls: 0 };
      await workerLoop(
        workerAdapter,
        job.jobId,
        'external-worker',
        profile,
        providerName,
        searchDepth,
        undefined,
        false,
        {},
        metrics,
        workDir
      );
      await workerAdapter.quit();
    })();

    const result = await runDistributedWideSearch({
      objective: 'Summarize Paul Graham essays',
      profile,
      workDir,
      distributed: {
        enabled: true,
        workers: 0,
        queueType: 'redis',
        redisKeyPrefix: prefix,
        resumeJobId: job.jobId,
      },
    });

    await workerPromise;

    expect(result.verification.status).toBe('passed');
    expect(result.verification.acceptedSources).toBeGreaterThan(0);

    const jobJson = JSON.parse(await readFile(join(result.runDir, 'distributed-job.json'), 'utf8'));
    expect(jobJson.status).toBe('completed');
    expect(jobJson.tasks.every((t: { status: string }) => t.status === 'completed')).toBe(true);
  });
});
