import type {
  BudgetOptions,
  Claim,
  CostEstimate,
  EnrichedSource,
  ExecutionProfile,
  ResearchPlan,
  Run,
  SearchDepth,
  UsageMetrics,
} from './types';

export interface RunWideSearchTaskOptions {
  objective: string;
  profile: ExecutionProfile;
  providerName?: string;
  providerCommand?: string;
  providerArgs?: string[];
  searchDepth?: SearchDepth;
  useCache?: boolean;
  budget?: BudgetOptions;
  metrics?: UsageMetrics;
  maxResults?: number;
  sourceIds?: string[];
  workDir?: string;
  checkBudget?: boolean;
  allowPublicReaderHostnames?: boolean;
}

export interface RunWideSearchTaskResult {
  sources: EnrichedSource[];
  claims: Claim[];
  usageMetrics: UsageMetrics;
}

export interface FinalizeRunOptions {
  run: Run;
  objective: string;
  profile: ExecutionProfile;
  sources: EnrichedSource[];
  claims: Claim[];
  plan?: ResearchPlan;
  usageMetrics: UsageMetrics;
  runDir: string;
  budget?: BudgetOptions;
  isDryRun?: boolean;
  distributed?: boolean;
  providerName: string;
  estimate?: CostEstimate;
  strictClaims?: boolean;
}
