import { readFile } from 'node:fs/promises';

import type {
  ClaimConfidence,
  ClaimFreshness,
  ExecutionProfile,
  Source,
  SourceScores,
} from './types';

export const FIXTURE_FILE_MAP: Record<ExecutionProfile, string> = {
  fixture: 'basic-sources.json',
  'fixture-asset-mgmt': 'asset-mgmt-roles.json',
  'fixture-sellside-research': 'sellside-research-roles.json',
  'fixture-youtube-niche': 'youtube-niche.json',
  'fixture-paul-graham-corpus': 'paul-graham-corpus.json',
  'fixture-github-repo-landscape': 'github-repo-landscape.json',
  'fixture-market-scan': 'market-scan.json',
  'local-command': '',
  'web-search': '',
};

export function makeRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${suffix}`;
}

export async function loadFixtureSources(profile: ExecutionProfile): Promise<Source[]> {
  const fileName = FIXTURE_FILE_MAP[profile];
  if (!fileName) {
    throw new Error(`unknown fixture profile: ${profile}`);
  }
  const fixtureUrl = new URL(`../fixtures/${fileName}`, import.meta.url);
  const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as { sources: Source[] };
  return fixture.sources;
}

export function claimConfidence(scores: SourceScores): ClaimConfidence {
  const authority = scores.authority ?? 0;
  if (authority >= 4) return 'high';
  if (authority >= 2) return 'medium';
  return 'low';
}

export function claimFreshness(publishedAt?: string): ClaimFreshness {
  if (!publishedAt || publishedAt === 'unknown') return 'unknown';

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    .toISOString()
    .split('T')[0];

  return publishedAt >= oneYearAgo ? 'current' : 'stale';
}
