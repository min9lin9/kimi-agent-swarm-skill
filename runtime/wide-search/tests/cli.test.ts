import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  });

  test('providers prints a valid JSON provider list', async () => {
    const { exitCode, stdout } = await runCli(['providers']);
    expect(exitCode).toBe(0);
    const providers = JSON.parse(stdout);
    expect(Array.isArray(providers)).toBe(true);
    expect(providers.some((p: { name: string }) => p.name === 'mock')).toBe(true);
    expect(providers.some((p: { name: string }) => p.name === 'serper')).toBe(true);
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
});
