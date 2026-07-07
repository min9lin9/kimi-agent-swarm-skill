import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Claim, EnrichedSource } from '../src/types';
import { verifyRun } from '../src/verifier';

async function writeJsonl(path: string, rows: readonly unknown[]): Promise<void> {
  await writeFile(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`);
}

async function makeRunDir(name: string): Promise<string> {
  const runDir = await mkdtemp(join(tmpdir(), name));
  await mkdir(runDir, { recursive: true });
  return runDir;
}

const claimConfidences: ReadonlySet<string> = new Set(['high', 'medium', 'low']);
const claimFreshnesses: ReadonlySet<string> = new Set(['current', 'stale', 'unknown']);
const claimRisks: ReadonlySet<string> = new Set(['low', 'medium', 'high']);
const claimTypes: ReadonlySet<string> = new Set(['fact', 'estimate', 'recommendation', 'opinion']);
const claimQualityRatings: ReadonlySet<string> = new Set(['A', 'B', 'C', 'D', 'E']);
const claimVerificationStatuses: ReadonlySet<string> = new Set([
  'verified',
  'unresolved',
  'refuted',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalSetValue(value: unknown, allowedValues: ReadonlySet<string>): boolean {
  return value === undefined || (typeof value === 'string' && allowedValues.has(value));
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function isClaim(value: unknown): value is Claim {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.claim === 'string' &&
    Array.isArray(value.sourceIds) &&
    value.sourceIds.every((sourceId) => typeof sourceId === 'string') &&
    typeof value.confidence === 'string' &&
    claimConfidences.has(value.confidence) &&
    typeof value.freshness === 'string' &&
    claimFreshnesses.has(value.freshness) &&
    isOptionalSetValue(value.risk, claimRisks) &&
    isOptionalSetValue(value.claimType, claimTypes) &&
    isOptionalBoolean(value.counterSearch) &&
    isOptionalBoolean(value.counterRefuted) &&
    isOptionalBoolean(value.primarySource) &&
    isOptionalSetValue(value.qualityRating, claimQualityRatings) &&
    isOptionalSetValue(value.verificationStatus, claimVerificationStatuses)
  );
}

async function readClaimArray(path: string): Promise<readonly Claim[]> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(parsed) || !parsed.every(isClaim)) {
    throw new Error(`Expected claim array in ${path}`);
  }
  return parsed;
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

    const verified = await readClaimArray(join(runDir, 'verified-claims.json'));
    const unresolved = await readClaimArray(join(runDir, 'unresolved-claims.json'));
    const refuted = await readClaimArray(join(runDir, 'refuted-claims.json'));
    expect(verified?.map((claim) => claim.id)).toEqual(['C001']);
    expect(unresolved?.map((claim) => claim.id)).toEqual(['C002', 'C004']);
    expect(refuted?.map((claim) => claim.id)).toEqual(['C003']);
  });

  test('enriches generated strict claim ledgers before classification', async () => {
    const runDir = await makeRunDir('wide-search-strict-enrichment-');
    const sources: readonly EnrichedSource[] = [
      {
        ...acceptedSources[0],
        claims: [
          'The fixture has published product documentation.',
          'Revenue will increase next quarter.',
        ],
      },
      {
        ...acceptedSources[1],
        claims: ['The fixture has published product documentation.'],
      },
    ];
    const claims: readonly Claim[] = [
      {
        id: 'C001',
        claim: 'The fixture has published product documentation.',
        sourceIds: ['S001', 'S002'],
        confidence: 'high',
        freshness: 'current',
      },
      {
        id: 'C002',
        claim: 'Revenue will increase next quarter.',
        sourceIds: ['S001'],
        confidence: 'high',
        freshness: 'current',
      },
    ];

    await writeJsonl(join(runDir, 'source-ledger.jsonl'), sources);
    await writeJsonl(join(runDir, 'claim-ledger.jsonl'), claims);

    const report = await verifyRun({ runDir, strictClaims: true });

    expect(report.status).toBe('failed');
    expect(report.strictClaims?.verifiedClaimIds).toEqual(['C001']);
    expect(report.strictClaims?.unresolvedClaimIds).toEqual(['C002']);

    const verified = await readClaimArray(join(runDir, 'verified-claims.json'));
    const unresolved = await readClaimArray(join(runDir, 'unresolved-claims.json'));
    expect(verified?.[0]).toMatchObject({
      id: 'C001',
      risk: 'low',
      claimType: 'fact',
      counterSearch: true,
      primarySource: true,
      qualityRating: 'A',
      verificationStatus: 'verified',
    });
    expect(unresolved?.[0]).toMatchObject({
      id: 'C002',
      risk: 'high',
      claimType: 'estimate',
      counterSearch: false,
      primarySource: true,
      qualityRating: 'A',
      verificationStatus: 'unresolved',
    });
    expect(unresolved?.[0]?.verificationStatus).not.toBe('verified');
  });
});
