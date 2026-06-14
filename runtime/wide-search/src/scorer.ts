import type { EnrichedSource, Source } from './types';

const SCORE_WEIGHTS = {
  relevance: 0.35,
  authority: 0.25,
  freshness: 0.2,
  diversity: 0.1,
  extractionValue: 0.1,
};

const HIGH_AUTHORITY_DOMAINS = new Set([
  'github.com',
  'arxiv.org',
  'ssrn.com',
  'crunchbase.com',
  'sec.gov',
  'who.int',
  'imf.org',
  'worldbank.org',
  'bloomberg.com',
  'reuters.com',
  'ft.com',
  'wsj.com',
  'economist.com',
  'nature.com',
  'science.org',
]);

function extractDomain(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function domainAuthorityBonus(url: string): number {
  const domain = extractDomain(url);
  if (!domain) return 0;

  if (HIGH_AUTHORITY_DOMAINS.has(domain)) return 0.5;
  if (domain.endsWith('.edu') || domain.endsWith('.gov') || domain.endsWith('.ac.uk')) {
    return 0.4;
  }
  if (domain.endsWith('.org')) return 0.15;
  return 0;
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function freshnessPenalty(publishedAt?: string): number {
  if (!publishedAt || publishedAt === 'unknown') return -0.3;
  if (publishedAt >= dateDaysAgo(365)) return 0;
  if (publishedAt >= dateDaysAgo(365 * 2)) return -0.2;
  if (publishedAt >= dateDaysAgo(365 * 3)) return -0.5;
  return -0.8;
}

export function calculateWeightedScore(source: Source): number {
  const scores = source.scores ?? {};
  const baseScore =
    (scores.relevance ?? 0) * SCORE_WEIGHTS.relevance +
    (scores.authority ?? 0) * SCORE_WEIGHTS.authority +
    (scores.freshness ?? 0) * SCORE_WEIGHTS.freshness +
    (scores.diversity ?? 0) * SCORE_WEIGHTS.diversity +
    (scores.extractionValue ?? 0) * SCORE_WEIGHTS.extractionValue;

  const domainBonus = domainAuthorityBonus(source.url);
  const freshness = freshnessPenalty(source.publishedAt);

  return Math.max(0, Math.min(5, baseScore + domainBonus + freshness));
}

export function scoreSource(source: Source): EnrichedSource {
  const weightedScore = calculateWeightedScore(source);
  const scores = source.scores ?? {};
  const relevance = scores.relevance ?? 0;
  const authority = scores.authority ?? 0;

  let reason: string;
  let accepted: boolean;

  if (weightedScore >= 3.0 && relevance >= 2 && authority >= 2) {
    accepted = true;
    reason = `weighted score ${weightedScore.toFixed(2)} meets acceptance threshold`;
  } else if (relevance < 2) {
    accepted = false;
    reason = 'low relevance';
  } else if (authority < 2) {
    accepted = false;
    reason = 'low authority';
  } else if (weightedScore < 3.0) {
    accepted = false;
    reason = `weighted score ${weightedScore.toFixed(2)} below acceptance threshold`;
  } else {
    accepted = false;
    reason = 'duplicate or low-value source';
  }

  return {
    ...source,
    decision: accepted ? 'accepted' : 'rejected',
    reason,
  };
}
