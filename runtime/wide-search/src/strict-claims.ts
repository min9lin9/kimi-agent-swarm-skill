import type {
  Claim,
  ClaimQualityRating,
  ClaimRisk,
  ClaimType,
  EnrichedSource,
  StrictClaimReport,
} from './types';

export interface StrictClaimClassification {
  readonly verifiedClaims: Claim[];
  readonly unresolvedClaims: Claim[];
  readonly refutedClaims: Claim[];
  readonly report: StrictClaimReport;
}

const HIGH_QUALITY_RATINGS: ReadonlySet<ClaimQualityRating> = new Set(['A', 'B']);
const HIGH_RISK_TEXT =
  /\b(revenue|forecast|market|pricing|legal|medical|security|vulnerability|compliance|investment|stock|financial|next quarter)\b/i;
const ESTIMATE_TEXT =
  /\b(estimate|estimated|forecast|projected|projection|expected|will|next quarter)\b/i;
const RECOMMENDATION_TEXT = /\b(should|recommend|recommendation|must|need|best practice)\b/i;
const OPINION_TEXT = /\b(best|worst|believe|opinion|likely|unlikely)\b/i;

function hasHighQualityEvidence(claim: Claim): boolean {
  return claim.primarySource === true || HIGH_QUALITY_RATINGS.has(claim.qualityRating ?? 'E');
}

function isStrictBlocked(claim: Claim): boolean {
  return (
    (claim.risk === 'high' &&
      (new Set(claim.sourceIds).size < 2 ||
        claim.counterSearch !== true ||
        !hasHighQualityEvidence(claim))) ||
    (claim.risk === 'medium' && !hasHighQualityEvidence(claim))
  );
}

function isUnclassified(claim: Claim): boolean {
  return claim.risk === undefined;
}

function qualityRatingForSources(
  sources: readonly EnrichedSource[]
): ClaimQualityRating | undefined {
  if (sources.length === 0) {
    return undefined;
  }
  const best = Math.max(
    ...sources.map((source) => source.scores.relevance + source.scores.authority)
  );
  const normalized = best > 2 ? best / 10 : best / 2;
  if (normalized >= 0.9) return 'A';
  if (normalized >= 0.7) return 'B';
  if (normalized >= 0.5) return 'C';
  if (normalized >= 0.25) return 'D';
  return 'E';
}

function inferClaimType(text: string): ClaimType {
  if (RECOMMENDATION_TEXT.test(text)) return 'recommendation';
  if (ESTIMATE_TEXT.test(text)) return 'estimate';
  if (OPINION_TEXT.test(text)) return 'opinion';
  return 'fact';
}

function inferRisk(
  claim: Claim,
  claimType: ClaimType,
  supportedSourceCount: number
): ClaimRisk | undefined {
  if (supportedSourceCount === 0) {
    return undefined;
  }
  if (
    claimType === 'estimate' ||
    claimType === 'recommendation' ||
    HIGH_RISK_TEXT.test(claim.claim)
  ) {
    return 'high';
  }
  if (claimType === 'opinion' || claim.confidence !== 'high' || claim.freshness !== 'current') {
    return 'medium';
  }
  return 'low';
}

function sourceSupportsClaim(source: EnrichedSource, claim: Claim): boolean {
  return source.claims?.some((sourceClaim) => sourceClaim === claim.claim) ?? false;
}

export function enrichStrictClaims(
  claims: readonly Claim[],
  sources: readonly EnrichedSource[]
): Claim[] {
  const acceptedSourcesById = new Map(
    sources.filter((source) => source.decision === 'accepted').map((source) => [source.id, source])
  );

  return claims.map((claim) => {
    const supportingSources = claim.sourceIds
      .map((sourceId) => acceptedSourcesById.get(sourceId))
      .filter(
        (source): source is EnrichedSource =>
          source !== undefined && sourceSupportsClaim(source, claim)
      );
    const claimType = claim.claimType ?? inferClaimType(claim.claim);
    const primarySource =
      claim.primarySource ??
      supportingSources.some(
        (source) => source.sourceClass === 'primary' || source.sourceClass === 'primary-analysis'
      );

    return {
      ...claim,
      risk: claim.risk ?? inferRisk(claim, claimType, supportingSources.length),
      claimType,
      counterSearch:
        claim.counterSearch ?? new Set(supportingSources.map((source) => source.id)).size > 1,
      primarySource,
      qualityRating: claim.qualityRating ?? qualityRatingForSources(supportingSources),
    };
  });
}

export function classifyStrictClaims(
  claims: readonly Claim[],
  sources: readonly EnrichedSource[] = []
): StrictClaimClassification {
  const enrichedClaims = enrichStrictClaims(claims, sources);
  const verifiedClaims: Claim[] = [];
  const unresolvedClaims: Claim[] = [];
  const refutedClaims: Claim[] = [];

  for (const claim of enrichedClaims) {
    if (claim.counterRefuted === true) {
      refutedClaims.push({ ...claim, verificationStatus: 'refuted' });
    } else if (isUnclassified(claim)) {
      unresolvedClaims.push({ ...claim, verificationStatus: 'unresolved' });
    } else if (isStrictBlocked(claim)) {
      unresolvedClaims.push({ ...claim, verificationStatus: 'unresolved' });
    } else {
      verifiedClaims.push({ ...claim, verificationStatus: 'verified' });
    }
  }

  return {
    verifiedClaims,
    unresolvedClaims,
    refutedClaims,
    report: {
      enabled: true,
      verified: verifiedClaims.length,
      unresolved: unresolvedClaims.length,
      refuted: refutedClaims.length,
      verifiedClaimIds: verifiedClaims.map((claim) => claim.id),
      unresolvedClaimIds: unresolvedClaims.map((claim) => claim.id),
      refutedClaimIds: refutedClaims.map((claim) => claim.id),
    },
  };
}
