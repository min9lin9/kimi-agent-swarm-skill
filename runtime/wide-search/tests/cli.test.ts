import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCliJson, runCli } from './cli-test-utils';

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
    expect(stderr).toInclude('--allow-public-reader-hostnames');
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
});
