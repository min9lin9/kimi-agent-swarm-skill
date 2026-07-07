import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runWideSearch } from '../../src/runtime';

describe('distributed run contract', () => {
  test('forwards options into the job artifact', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-runtime-distributed-contract-'));

    const result = await runWideSearch({
      objective: 'Distributed contract',
      profile: 'fixture',
      workDir,
      budget: { maxProviderCalls: 9 },
      useCache: true,
      distributed: { enabled: true, workers: 1, maxRetries: 5, queueType: 'memory' },
    });

    const job = JSON.parse(await readFile(join(result.runDir, 'distributed-job.json'), 'utf8'));
    expect(job.queueType).toBe('memory');
    expect(job.useCache).toBe(true);
    expect(job.budget.maxProviderCalls).toBe(9);
    expect(job.tasks.every((task: { maxRetries: number }) => task.maxRetries === 5)).toBe(true);
  });
});
