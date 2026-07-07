import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildRunOptionsForCli, buildVerifyOptionsForCli } from '../src/cli-contract';

describe('CLI command contract', () => {
  let workDir: string;

  beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'wide-search-cli-contract-'));
  });

  afterAll(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  test('run command maps flags into RunWideSearchOptions', async () => {
    const providerFlags = ['--provider', '--provider-name'];

    for (const providerFlag of providerFlags) {
      const options = await buildRunOptionsForCli([
        'contract objective',
        '--profile',
        'web-search',
        providerFlag,
        'public-reader',
        '--depth',
        'deep',
        '--work-dir',
        workDir,
        '--max-cost-usd',
        '1.5',
        '--max-provider-calls',
        '7',
        '--max-api-calls',
        '9',
        '--dry-run=false',
        '--use-cache',
        '--strict-claims',
        '--distributed',
        '--workers',
        '2',
        '--max-retries',
        '5',
        '--queue-type',
        'memory',
        '--resume-job-id',
        'job-123',
        '--task-timeout-ms',
        '1234',
      ]);

      expect(options).toEqual({
        objective: 'contract objective',
        workDir,
        profile: 'web-search',
        providerCommand: undefined,
        providerArgs: [],
        providerName: 'public-reader',
        searchDepth: 'deep',
        budget: {
          maxCostUsd: 1.5,
          maxProviderCalls: 7,
          maxApiCalls: 9,
          dryRun: false,
        },
        useCache: true,
        replayRunId: undefined,
        distributed: {
          enabled: true,
          workers: 2,
          maxRetries: 5,
          queueType: 'memory',
          resumeJobId: 'job-123',
          redisUrl: undefined,
          redisPassword: undefined,
          redisUsername: undefined,
          taskTimeoutMs: 1234,
        },
        strictClaims: true,
      });
    }
  });

  test('verify command maps flags into VerifyRunOptions', () => {
    const options = buildVerifyOptionsForCli([
      '--run-dir',
      '/tmp/wide-search-run',
      '--strict-claims',
      '--require-completion-evidence',
    ]);

    expect(options).toEqual({
      runDir: '/tmp/wide-search-run',
      strictClaims: true,
      requireCompletionEvidence: true,
    });
  });
});
