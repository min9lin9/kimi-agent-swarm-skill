import type { Claim, ClaimQualityRating, StrictClaimReport } from './types';

export interface StrictClaimClassification {
  readonly verifiedClaims: Claim[];
  readonly unresolvedClaims: Claim[];
  readonly refutedClaims: Claim[];
  readonly report: StrictClaimReport;
}

const HIGH_QUALITY_RATINGS: ReadonlySet<ClaimQualityRating> = new Set(['A', 'B']);

function hasHighQualityEvidence(claim: Claim): boolean {
  return claim.primarySource === true || HIGH_QUALITY_RATINGS.has(claim.qualityRating ?? 'E');
}

function isHighRiskBlocked(claim: Claim): boolean {
  return (
    claim.risk === 'high' &&
    (new Set(claim.sourceIds).size < 2 ||
      claim.counterSearch !== true ||
      !hasHighQualityEvidence(claim))
  );
}

function isUnclassified(claim: Claim): boolean {
  return claim.risk === undefined;
}

export function classifyStrictClaims(claims: readonly Claim[]): StrictClaimClassification {
  const verifiedClaims: Claim[] = [];
  const unresolvedClaims: Claim[] = [];
  const refutedClaims: Claim[] = [];

  for (const claim of claims) {
    if (claim.counterRefuted === true) {
      refutedClaims.push({ ...claim, verificationStatus: 'refuted' });
    } else if (isUnclassified(claim)) {
      unresolvedClaims.push({ ...claim, verificationStatus: 'unresolved' });
    } else if (isHighRiskBlocked(claim)) {
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
