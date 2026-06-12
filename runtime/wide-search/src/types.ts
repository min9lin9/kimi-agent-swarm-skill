export type SearchDepth = "light" | "standard" | "deep" | "maximum";

export type ExecutionProfile = "fixture" | "local-command";

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

export interface Run {
  runId: string;
  objective: string;
  executionProfile: ExecutionProfile;
  status: "completed" | "failed";
  createdAt: string;
}

export interface ResearchPlan {
  objective: string;
  searchDepth: SearchDepth;
  executionProfile: ExecutionProfile;
  queryFamilies: string[];
  sourceTargets: string[];
  stopConditions: string[];
}

export interface VerificationReport {
  status: "passed" | "failed";
  acceptedSources: number;
  rejectedSources: number;
  unsupportedClaims: number;
  failures: string[];
  warnings: string[];
}

export interface RunWideSearchOptions {
  objective?: string;
  profile?: ExecutionProfile;
  providerCommand?: string;
  providerArgs?: string[];
  workDir?: string;
}

export interface LoadSourcesOptions {
  profile: ExecutionProfile;
  objective: string;
  providerCommand?: string;
  providerArgs?: string[];
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
