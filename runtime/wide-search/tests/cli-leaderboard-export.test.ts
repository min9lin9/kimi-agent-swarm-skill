import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCliJson, runCli } from './cli-test-utils';

describe('CLI leaderboard and export integration', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'wide-search-cli-output-'));
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
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
