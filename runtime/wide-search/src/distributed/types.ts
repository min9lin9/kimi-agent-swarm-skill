import type {
  BudgetOptions,
  Claim,
  ExecutionProfile,
  SearchDepth,
  Source,
  UsageMetrics,
} from '../types';

export interface DistributedRunOptions {
  enabled: boolean;
  workers?: number;
  maxRetries?: number;
  resumeJobId?: string;
  queueType?: 'memory' | 'redis';
  redisUrl?: string;
  redisPassword?: string;
  redisUsername?: string;
  redisKeyPrefix?: string;
  taskTimeoutMs?: number;
}

export interface DistributedJob {
  jobId: string;
  objective: string;
  executionProfile: ExecutionProfile;
  providerName: string;
  searchDepth: SearchDepth;
  queueType: 'memory' | 'redis';
  status: DistributedJobStatus;
  tasks: DistributedTask[];
  useCache?: boolean;
  budget?: BudgetOptions;
  workDir?: string;
  perTaskMaxResults?: number;
  allowPublicReaderHostnames?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DistributedJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DistributedTask {
  taskId: string;
  jobId: string;
  queryFamily: string;
  query: string;
  status: DistributedTaskStatus;
  attempts: number;
  maxRetries: number;
  workerId?: string;
  result?: WorkerResult;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  leaseToken?: string;
}

export type DistributedTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface WorkerResult {
  sources: Source[];
  usageMetrics: UsageMetrics;
  claims?: Claim[];
}
