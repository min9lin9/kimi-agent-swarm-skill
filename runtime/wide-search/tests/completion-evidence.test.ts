import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { EnrichedSource } from '../src/types';
import { verifyRun } from '../src/verifier';

async function writeJsonl(path: string, rows: readonly unknown[]): Promise<void> {
  await writeFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

async function makeRunDir(name: string): Promise<string> {
  const runDir = await mkdtemp(join(tmpdir(), name));
  await mkdir(runDir, { recursive: true });
  return runDir;
}

const acceptedSources: readonly EnrichedSource[] = [
  {
    id: 'S001',
    url: 'https://example.com/primary',
    title: 'Primary source',
    sourceClass: 'primary',
    discoveredBy: 'test',
    scores: { relevance: 1, authority: 1 },
    decision: 'accepted',
    reason: 'meets threshold',
  },
];

describe('completion evidence verification', () => {
  test('rejects redis url api key authorization and sk shaped completion evidence', async () => {
    const runDir = await makeRunDir('wide-search-completion-evidence-secrets-');
    await writeJsonl(join(runDir, 'source-ledger.jsonl'), acceptedSources);
    await writeJsonl(join(runDir, 'claim-ledger.jsonl'), [
      {
        id: 'C001',
        claim: 'Covered claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
      },
    ]);

    const secretValues = [
      ['redis://', 'user', ':', 'pass', '@localhost:6379'].join(''),
      ['redis://', ':', 'pass', '@localhost:6379'].join(''),
      ['rediss://', 'user', ':', 'pass', '@localhost:6379'].join(''),
      ['rediss://', ':', 'pass', '@localhost:6379'].join(''),
      ['OPENAI', '_API_KEY', '=', 'secret'].join(''),
      ['Authorization', ': Bearer ', 'abcdefgh'].join(''),
      ['sk', '-1234567890abcdef'].join(''),
    ];

    for (const secret of secretValues) {
      await writeFile(
        join(runDir, 'completion-evidence.json'),
        `${JSON.stringify(
          {
            changedFiles: ['src/verifier.ts'],
            commands: [{ command: 'bun test', exitCode: 0, output: secret }],
          },
          null,
          2
        )}\n`
      );

      const report = await verifyRun({ runDir, requireCompletionEvidence: true });
      const persisted = await readFile(join(runDir, 'verification-report.json'), 'utf8');

      expect(report.status).toBe('failed');
      expect(report.failures).toContain(
        'unsafe completion evidence contains secret-shaped content'
      );
      expect(persisted).not.toInclude(secret);
    }
  });

  test('requires completion evidence and rejects secret-shaped evidence on demand', async () => {
    const runDir = await makeRunDir('wide-search-completion-evidence-');
    await writeJsonl(join(runDir, 'source-ledger.jsonl'), acceptedSources);
    await writeJsonl(join(runDir, 'claim-ledger.jsonl'), [
      {
        id: 'C001',
        claim: 'Covered claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
      },
    ]);

    const missingEvidence = await verifyRun({ runDir, requireCompletionEvidence: true });
    expect(missingEvidence.status).toBe('failed');
    expect(
      missingEvidence.failures.some((failure) => failure.includes('missing completion evidence'))
    ).toBe(true);

    await writeFile(
      join(runDir, 'completion-evidence.json'),
      `${JSON.stringify(
        {
          changedFiles: ['src/verifier.ts'],
          commands: [
            {
              command: 'bun test',
              exitCode: 0,
              output: ['OPENAI', '_API_KEY', '=', 'secret'].join(''),
            },
          ],
        },
        null,
        2
      )}\n`
    );

    const unsafeEvidence = await verifyRun({ runDir, requireCompletionEvidence: true });
    expect(unsafeEvidence.status).toBe('failed');
    expect(
      unsafeEvidence.failures.some((failure) => failure.includes('unsafe completion evidence'))
    ).toBe(true);

    await writeFile(
      join(runDir, 'completion-evidence.json'),
      `${JSON.stringify(
        {
          changedFiles: ['src/verifier.ts'],
          commands: [{ command: 'bun test', exitCode: 0 }],
          [['OPENAI', '_API_KEY'].join('')]: ['sk', '-should-not-be-recorded'].join(''),
        },
        null,
        2
      )}\n`
    );

    const unsafeStructuredEvidence = await verifyRun({
      runDir,
      requireCompletionEvidence: true,
    });
    expect(unsafeStructuredEvidence.status).toBe('failed');
    expect(
      unsafeStructuredEvidence.failures.some((failure) =>
        failure.includes('unsafe completion evidence')
      )
    ).toBe(true);
  });
});
