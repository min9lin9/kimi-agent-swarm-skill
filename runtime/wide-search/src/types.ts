export type SearchDepth = "light" | "standard" | "deep" | "maximum";

export type ExecutionProfile =
  | "fixture"
  | "fixture-asset-mgmt"
  | "fixture-sellside-research"
  | "fixture-youtube-niche"
  | "fixture-paul-graham-corpus"
  | "fixture-github-repo-landscape"
  | "fixture-market-scan"
  | "local-command"
  | "web-search";

export interface SourceScores {
  relevance: number;
  authority: number;
  freshness?: number;
  diversity?: number;
  extractionValue?: number;
}

export interface Source {
  id: string;
  url: string;
  title: string;
  sourceClass: string;
  publishedAt?: string;
  discoveredBy: string;
  scores: SourceScores;
  claims?: string[];
}

export interface EnrichedSource extends Source {
  decision: "accepted" | "rejected";
  reason: string;
}

export type ClaimConfidence = "high" | "medium" | "low";

export type ClaimFreshness = "current" | "stale" | "unknown";

export interface Claim {
  id: string;
  claim: string;
  sourceIds: string[];
  confidence: ClaimConfidence;
  freshness: ClaimFreshness;
}

export interface UsageMetrics {
  providerCalls: number;
  apiCalls: number;
  estimatedTokens?: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  notes?: string;
}

export interface Run {
  runId: string;
  objective: string;
  executionProfile: ExecutionProfile;
  status: "completed" | "failed";
  createdAt: string;
  usageMetrics: UsageMetrics;
}

export interface ResearchPlan {
  objective: string;
  searchDepth: SearchDepth;
  executionProfile: ExecutionProfile;
  queryFamilies: string[];
  sourceTargets: string[];
  stopConditions: string[];
}

export interface DuplicateClaimGroup {
  representativeClaimId: string;
  claimIds: string[];
  similarityReason: string;
}

export interface ConflictingClaimPair {
  claimIdA: string;
  claimIdB: string;
  entity: string;
  reason: string;
}

export interface VerificationReport {
  status: "passed" | "failed";
  acceptedSources: number;
  rejectedSources: number;
  unsupportedClaims: number;
  staleClaims: number;
  unknownFreshnessClaims: number;
  lowConfidenceClaims: number;
  duplicateClaimGroups: DuplicateClaimGroup[];
  conflictingClaimPairs: ConflictingClaimPair[];
  coverageGaps: string[];
  failures: string[];
  warnings: string[];
}

export interface RunWideSearchOptions {
  objective?: string;
  profile?: ExecutionProfile;
  providerCommand?: string;
  providerArgs?: string[];
  providerName?: string;
  searchDepth?: SearchDepth;
  workDir?: string;
  budget?: BudgetOptions;
}

export interface LoadSourcesOptions {
  profile: ExecutionProfile;
  objective: string;
  providerCommand?: string;
  providerArgs?: string[];
  providerName?: string;
  searchDepth?: SearchDepth;
  metrics?: UsageMetrics;
}

export interface VerifyRunOptions {
  runDir?: string;
  minAcceptedSources?: number;
}

export interface RunWideSearchResult {
  runId: string;
  runDir: string;
  verification: VerificationReport;
}

export interface ProviderPricing {
  perCallUsd: number;
  per1kTokensUsd?: number;
}

export interface BudgetOptions {
  maxCostUsd?: number;
  maxProviderCalls?: number;
  maxApiCalls?: number;
  dryRun?: boolean;
}

export type ExportFormat = "json" | "csv";

export interface ExportOptions {
  runDir: string;
  format: ExportFormat;
  outPath?: string;
}

export interface GoldenAnswer {
  expectedClaims: string[];
  expectedSourceUrls?: string[];
}

export interface BenchmarkResult {
  profile: string;
  precision: number;
  recall: number;
  citationAccuracy: number;
  f1: number;
  passed: boolean;
}

export interface CostEstimate {
  providerName: string;
  depth: SearchDepth;
  estimatedProviderCalls: number;
  estimatedApiCalls: number;
  estimatedCostUsd: number;
}
