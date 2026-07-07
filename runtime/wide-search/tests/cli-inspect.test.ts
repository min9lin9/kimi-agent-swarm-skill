import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCliJson, runCli } from './cli-test-utils';

describe('CLI inspect integration', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'wide-search-cli-inspect-'));
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  test('inspect summarizes distributed job recovery without leaking secrets', async () => {
    const runDir = join(workDir, 'distributed-inspect-fixture');
    await rm(runDir, { recursive: true, force: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, 'run.json'),
      `${JSON.stringify({
        runId: 'run-distributed-inspect',
        objective: 'inspect distributed recovery',
        executionProfile: 'fixture',
        status: 'failed',
      })}\n`
    );
    await writeFile(
      join(runDir, 'verification-report.json'),
      `${JSON.stringify({
        status: 'failed',
        acceptedSources: 1,
        rejectedSources: 2,
      })}\n`
    );
    await writeFile(
      join(runDir, 'distributed-job.json'),
      `${JSON.stringify({
        jobId: 'job-dist-inspect',
        objective: 'inspect distributed recovery',
        executionProfile: 'fixture',
        providerName: 'mock',
        searchDepth: 'standard',
        queueType: 'redis',
        redisUrl: 'redis://user:pass@example.com:6379',
        redisPassword: 'secret-value',
        status: 'running',
        workDir,
        createdAt: '2026-07-07T00:00:00.000Z',
        updatedAt: '2026-07-07T00:00:00.000Z',
        tasks: [
          {
            taskId: 'task-completed',
            jobId: 'job-dist-inspect',
            queryFamily: 'family',
            query: 'query',
            status: 'completed',
            attempts: 1,
            maxRetries: 2,
          },
          {
            taskId: 'task-running',
            jobId: 'job-dist-inspect',
            queryFamily: 'family',
            query: 'query',
            status: 'running',
            attempts: 1,
            maxRetries: 2,
            workerId: 'worker-1',
            startedAt: '1970-01-01T00:00:00.000Z',
          },
          {
            taskId: 'task-failed',
            jobId: 'job-dist-inspect',
            queryFamily: 'family',
            query: 'query',
            status: 'failed',
            attempts: 2,
            maxRetries: 2,
            error: 'failed with pass and secret-value',
          },
        ],
      })}\n`
    );

    const { exitCode, stdout } = await runCli(['inspect', '--run-dir', runDir]);

    expect(exitCode).toBe(0);
    const parsed = parseCliJson(stdout) as {
      runId: string;
      objective: string;
      distributedJob?: {
        jobId: string;
        status: string;
        queueType: string;
        workerMode: string;
        taskCounts: Record<string, number>;
        staleRunningTasks: number;
        retryableFailedTasks: number;
        retryExhaustedTasks: number;
        recoveryCommand: string;
      };
    };
    expect(parsed.runId).toBe('run-distributed-inspect');
    expect(parsed.objective).toBe('inspect distributed recovery');
    expect(parsed.distributedJob).toEqual({
      jobId: 'job-dist-inspect',
      status: 'running',
      queueType: 'redis',
      workerMode: 'external',
      taskCounts: { pending: 0, running: 1, completed: 1, failed: 1 },
      staleRunningTasks: 1,
      retryableFailedTasks: 0,
      retryExhaustedTasks: 1,
      recoveryCommand: `kasw research --distributed --resume-job-id job-dist-inspect --work-dir ${workDir}`,
    });
    expect(stdout).not.toInclude('redis://user:pass@example.com:6379');
    expect(stdout).not.toInclude('pass');
    expect(stdout).not.toInclude('secret-value');
  });

  test('inspect reports in-process worker mode for memory distributed jobs', async () => {
    const runDir = join(workDir, 'distributed-memory-inspect-fixture');
    await rm(runDir, { recursive: true, force: true });
    await mkdir(runDir, { recursive: true });
    await writeFile(
      join(runDir, 'run.json'),
      `${JSON.stringify({
        runId: 'run-memory-distributed-inspect',
        objective: 'inspect memory distributed worker mode',
        executionProfile: 'fixture',
        status: 'completed',
      })}\n`
    );
    await writeFile(
      join(runDir, 'verification-report.json'),
      `${JSON.stringify({
        status: 'passed',
        acceptedSources: 1,
        rejectedSources: 0,
      })}\n`
    );
    await writeFile(
      join(runDir, 'distributed-job.json'),
      `${JSON.stringify({
        jobId: 'job-memory-inspect',
        objective: 'inspect memory distributed worker mode',
        executionProfile: 'fixture',
        providerName: 'mock',
        searchDepth: 'standard',
        queueType: 'memory',
        status: 'completed',
        workDir,
        createdAt: '2026-07-07T00:00:00.000Z',
        updatedAt: '2026-07-07T00:00:00.000Z',
        tasks: [
          {
            taskId: 'task-completed',
            jobId: 'job-memory-inspect',
            queryFamily: 'family',
            query: 'query',
            status: 'completed',
            attempts: 1,
            maxRetries: 2,
            workerId: 'in-process-0',
          },
        ],
      })}\n`
    );

    const { exitCode, stdout } = await runCli(['inspect', '--run-dir', runDir]);

    expect(exitCode).toBe(0);
    const parsed = parseCliJson(stdout) as {
      distributedJob?: {
        queueType: string;
        workerMode: string;
        taskCounts: Record<string, number>;
        recoveryCommand: string;
      };
    };
    expect(parsed.distributedJob?.queueType).toBe('memory');
    expect(parsed.distributedJob?.workerMode).toBe('in-process');
    expect(parsed.distributedJob?.taskCounts.completed).toBe(1);
    expect(parsed.distributedJob?.recoveryCommand).toBe('none: distributed job already completed');
  });
});
