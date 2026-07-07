import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('..', import.meta.url));

function parseCliJson(stdout: string): unknown {
  const lines = stdout.split(/\r?\n/);
  const startIndex = lines.findIndex(
    (line) => line.trim().startsWith('{') || line.trim().startsWith('[')
  );
  if (startIndex === -1) {
    throw new Error('No JSON object found in CLI stdout');
  }
  return JSON.parse(lines.slice(startIndex).join('\n'));
}

function runCli(
  args: string[],
  options: { cwd?: string } = {}
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli.ts', ...args], {
      cwd: options.cwd ?? rootDir,
      env: process.env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}

describe('CLI integration', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'wide-search-cli-'));
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  test('no command prints usage and exits with code 1', async () => {
    const { exitCode, stderr } = await runCli([]);
    expect(exitCode).toBe(1);
    expect(stderr).toInclude('Usage:');
  });

  test('--help prints usage and exits with code 0', async () => {
    const { exitCode, stderr } = await runCli(['--help']);
    expect(exitCode).toBe(0);
    expect(stderr).toInclude('Usage:');
    expect(stderr).toInclude('--strict-claims');
    expect(stderr).toInclude('--require-completion-evidence');
    expect(stderr).toInclude('--task-timeout-ms');
    expect(stderr).toInclude('public-reader');
  });

  test('providers prints a valid JSON provider list', async () => {
    const { exitCode, stdout } = await runCli(['providers']);
    expect(exitCode).toBe(0);
    const providers = JSON.parse(stdout);
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.some((p: { name: string }) => p.name === 'mock')).toBe(true);
    expect(providers.some((p: { name: string }) => p.name === 'serper')).toBe(true);
    expect(providers.some((p: { name: string }) => p.name === 'public-reader')).toBe(true);
  });

  test('run with objective parses it correctly and returns dry-run result', async () => {
    const { exitCode, stdout } = await runCli([
      'run',
      'test objective',
      '--profile',
      'fixture',
      '--dry-run',
      '--work-dir',
      workDir,
    ]);

    expect(exitCode).toBe(0);
    const result = parseCliJson(stdout) as { runDir: string; verification: { status: string } };
    expect(result.runDir).toBeDefined();
    expect(result.verification.status).toBe('passed');

    await expect(readFile(join(result.runDir, 'run.json'))).rejects.toThrow('ENOENT');
  });

  test('run with -- terminator treats remaining args as the objective', async () => {
    const { exitCode, stdout } = await runCli([
      'run',
      '--work-dir',
      workDir,
      '--',
      'test',
      'objective',
      '--profile',
      'fixture',
      '--dry-run',
    ]);

    expect(exitCode).toBe(0);
    const result = parseCliJson(stdout) as { runDir: string };
    const runJson = JSON.parse(await readFile(join(result.runDir, 'run.json'), 'utf8'));
    expect(runJson.objective).toBe('test objective --profile fixture --dry-run');
  });

  test('run with invalid profile returns a clear enum error', async () => {
    const { exitCode, stderr } = await runCli([
      'run',
      '--profile',
      'invalid-profile',
      'test',
      '--dry-run',
      '--work-dir',
      workDir,
    ]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toInclude('Invalid --profile');
  });

  test('export formats a previously created fixture run', async () => {
    const runResult = await runCli([
      'run',
      'export fixture run',
      '--profile',
      'fixture',
      '--work-dir',
      workDir,
    ]);

    expect(runResult.exitCode).toBe(0);
    const { runDir } = parseCliJson(runResult.stdout) as { runDir: string };

    const outPath = join(workDir, 'export.json');
    const exportResult = await runCli([
      'export',
      '--run-dir',
      runDir,
      '--format',
      'json',
      '--out',
      outPath,
    ]);

    expect(exportResult.exitCode).toBe(0);
    const exported = JSON.parse(await readFile(outPath, 'utf8'));
    expect(exported.runId).toBeDefined();
    expect(exported.objective).toBe('export fixture run');
    expect(Array.isArray(exported.sources)).toBe(true);
    expect(Array.isArray(exported.claims)).toBe(true);
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

  test('leaderboard --html writes an HTML report', async () => {
    const outPath = join(workDir, 'leaderboard-report.html');
    const { exitCode, stdout } = await runCli(['leaderboard', '--html', '--out', outPath]);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.report).toBe(outPath);

    const html = await readFile(outPath, 'utf8');
    expect(html).toInclude('<html');
    expect(html).toInclude('KASW Benchmark Leaderboard');
  });

  test('subcommand --help prints usage and exits with code 0', async () => {
    const { exitCode, stderr } = await runCli(['worker', '--help']);
    expect(exitCode).toBe(0);
    expect(stderr).toInclude('Usage:');
  });

  test('--dry-run=false executes the run instead of dry-running', async () => {
    const { exitCode, stdout } = await runCli([
      'run',
      'test objective',
      '--profile',
      'fixture',
      '--dry-run=false',
      '--work-dir',
      workDir,
    ]);

    expect(exitCode).toBe(0);
    const result = parseCliJson(stdout) as { runDir: string };
    const runJson = await readFile(join(result.runDir, 'run.json'), 'utf8');
    expect(runJson).toBeDefined();
  });

  test('negative --workers value returns a clear error', async () => {
    const { exitCode, stderr } = await runCli([
      'run',
      'test objective',
      '--profile',
      'fixture',
      '--distributed',
      '--workers=-1',
      '--work-dir',
      workDir,
    ]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toInclude('--workers');
  });

  test('leaderboard --clear requires --yes', async () => {
    const { exitCode, stderr } = await runCli(['leaderboard', '--clear', '--work-dir', workDir]);

    expect(exitCode).not.toBe(0);
    expect(stderr).toInclude('--yes');
  });

  test('leaderboard honors --work-dir for jsonl file', async () => {
    await runCli(['leaderboard', '--clear', '--yes', '--work-dir', workDir]);
    const { exitCode, stdout } = await runCli(['leaderboard', '--work-dir', workDir]);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });
});
