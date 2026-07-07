import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { renderMarkdownSynthesis } from '../src/markdown';
import type { Claim, EnrichedSource, Run, VerificationReport } from '../src/types';
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
  {
    id: 'S002',
    url: 'https://example.com/secondary',
    title: 'Secondary source',
    sourceClass: 'secondary',
    discoveredBy: 'test',
    scores: { relevance: 0.9, authority: 0.8 },
    decision: 'accepted',
    reason: 'meets threshold',
  },
];

describe('strict claim verification', () => {
  test('writes verified unresolved and refuted claim artifacts', async () => {
    const runDir = await makeRunDir('wide-search-strict-claims-');
    const claims: readonly Claim[] = [
      {
        id: 'C001',
        claim: 'A high-risk verified claim',
        sourceIds: ['S001', 'S002'],
        confidence: 'high',
        freshness: 'current',
        risk: 'high',
        counterSearch: true,
        primarySource: true,
        qualityRating: 'A',
      },
      {
        id: 'C002',
        claim: 'A high-risk unresolved claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
        risk: 'high',
        counterSearch: false,
        qualityRating: 'C',
      },
      {
        id: 'C003',
        claim: 'A refuted claim',
        sourceIds: ['S001', 'S002'],
        confidence: 'high',
        freshness: 'current',
        risk: 'medium',
        counterSearch: true,
        counterRefuted: true,
      },
      {
        id: 'C004',
        claim: 'An unclassified claim',
        sourceIds: ['S001', 'S002'],
        confidence: 'high',
        freshness: 'current',
      },
    ];

    await writeJsonl(join(runDir, 'source-ledger.jsonl'), acceptedSources);
    await writeJsonl(join(runDir, 'claim-ledger.jsonl'), claims);

    const report = await verifyRun({ runDir, strictClaims: true });

    expect(report.status).toBe('failed');
    expect(report.strictClaims?.verified).toBe(1);
    expect(report.strictClaims?.unresolved).toBe(2);
    expect(report.strictClaims?.refuted).toBe(1);
    expect(report.failures.some((failure) => failure.includes('unresolved strict claims'))).toBe(
      true
    );

    const verified = JSON.parse(await readFile(join(runDir, 'verified-claims.json'), 'utf8'));
    const unresolved = JSON.parse(await readFile(join(runDir, 'unresolved-claims.json'), 'utf8'));
    const refuted = JSON.parse(await readFile(join(runDir, 'refuted-claims.json'), 'utf8'));
    expect(verified.map((claim: Claim) => claim.id)).toEqual(['C001']);
    expect(unresolved.map((claim: Claim) => claim.id)).toEqual(['C002', 'C004']);
    expect(refuted.map((claim: Claim) => claim.id)).toEqual(['C003']);
  });

  test('strict synthesis renders only verified high-risk claims as definitive', () => {
    const claims: readonly Claim[] = [
      {
        id: 'C001',
        claim: 'Verified high-risk claim',
        sourceIds: ['S001', 'S002'],
        confidence: 'high',
        freshness: 'current',
        risk: 'high',
      },
      {
        id: 'C002',
        claim: 'Unresolved high-risk claim',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
        risk: 'high',
      },
    ];
    const run: Run = {
      runId: 'strict-run',
      objective: 'Strict synthesis',
      executionProfile: 'fixture',
      status: 'completed',
      createdAt: '2026-01-01T00:00:00.000Z',
      usageMetrics: { providerCalls: 1, apiCalls: 1 },
    };
    const verification: VerificationReport = {
      status: 'failed',
      acceptedSources: 2,
      rejectedSources: 0,
      unsupportedClaims: 0,
      staleClaims: 0,
      unknownFreshnessClaims: 0,
      lowConfidenceClaims: 0,
      duplicateClaimGroups: [],
      conflictingClaimPairs: [],
      coverageGaps: [],
      failures: ['unresolved strict claims: C002'],
      warnings: [],
      strictClaims: {
        enabled: true,
        verified: 1,
        unresolved: 1,
        refuted: 0,
        verifiedClaimIds: ['C001'],
        unresolvedClaimIds: ['C002'],
        refutedClaimIds: [],
      },
    };

    const markdown = renderMarkdownSynthesis({
      run,
      profile: 'fixture',
      sources: [...acceptedSources],
      claims: [...claims],
      verification,
    });

    const definitiveClaims = markdown.slice(
      markdown.indexOf('## Claims'),
      markdown.indexOf('## Verification details')
    );
    expect(definitiveClaims).toInclude('Verified high-risk claim');
    expect(definitiveClaims).not.toInclude('Unresolved high-risk claim');
    expect(markdown).toInclude('Strict claim artifacts');
    expect(markdown).toInclude('unresolved-claims.json');
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
          commands: [{ command: 'bun test', exitCode: 0, output: 'OPENAI_API_KEY=secret' }],
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
          OPENAI_API_KEY: 'sk-should-not-be-recorded',
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
