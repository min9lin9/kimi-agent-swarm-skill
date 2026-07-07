import type {
  DistributedJob,
  DistributedJobStatus,
  DistributedTask,
  DistributedTaskStatus,
  ExecutionProfile,
  SearchDepth,
} from '../types';

const EXECUTION_PROFILES: readonly ExecutionProfile[] = [
  'fixture',
  'fixture-asset-mgmt',
  'fixture-sellside-research',
  'fixture-youtube-niche',
  'fixture-paul-graham-corpus',
  'fixture-github-repo-landscape',
  'fixture-market-scan',
  'local-command',
  'web-search',
];
const SEARCH_DEPTHS: readonly SearchDepth[] = ['light', 'standard', 'deep', 'maximum'];
const QUEUE_TYPES: readonly DistributedJob['queueType'][] = ['memory', 'redis'];
const JOB_STATUSES: readonly DistributedJobStatus[] = ['pending', 'running', 'completed', 'failed'];
const TASK_STATUSES: readonly DistributedTaskStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAllowedValue<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.some((allowedValue) => allowedValue === value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`distributed job ${key} must be a string`);
  return value;
}

function optionalStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`distributed job ${key} must be a string`);
  return value;
}

function optionalNumberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'number') throw new Error(`distributed job ${key} must be a number`);
  return value;
}

function optionalBooleanField(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`distributed job ${key} must be a boolean`);
  return value;
}

function enumField<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const value = stringField(record, key);
  if (!isAllowedValue(value, allowed)) throw new Error(`distributed job ${key} is invalid`);
  return value;
}

function taskFromJson(value: unknown): DistributedTask {
  if (!isRecord(value)) throw new Error('distributed job task must be an object');
  return {
    taskId: stringField(value, 'taskId'),
    jobId: stringField(value, 'jobId'),
    queryFamily: stringField(value, 'queryFamily'),
    query: stringField(value, 'query'),
    status: enumField(value, 'status', TASK_STATUSES),
    attempts: optionalNumberField(value, 'attempts') ?? 0,
    maxRetries: optionalNumberField(value, 'maxRetries') ?? 0,
    workerId: optionalStringField(value, 'workerId'),
    error: optionalStringField(value, 'error'),
    startedAt: optionalStringField(value, 'startedAt'),
    completedAt: optionalStringField(value, 'completedAt'),
    leaseToken: optionalStringField(value, 'leaseToken'),
  };
}

export function distributedJobFromJson(text: string): DistributedJob {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('distributed job must be an object');
  const tasks = parsed.tasks;
  if (!Array.isArray(tasks)) throw new Error('distributed job tasks must be an array');
  return {
    jobId: stringField(parsed, 'jobId'),
    objective: stringField(parsed, 'objective'),
    executionProfile: enumField(parsed, 'executionProfile', EXECUTION_PROFILES),
    providerName: stringField(parsed, 'providerName'),
    searchDepth: enumField(parsed, 'searchDepth', SEARCH_DEPTHS),
    queueType: enumField(parsed, 'queueType', QUEUE_TYPES),
    status: enumField(parsed, 'status', JOB_STATUSES),
    tasks: tasks.map(taskFromJson),
    useCache: optionalBooleanField(parsed, 'useCache'),
    workDir: optionalStringField(parsed, 'workDir'),
    perTaskMaxResults: optionalNumberField(parsed, 'perTaskMaxResults'),
    allowPublicReaderHostnames: optionalBooleanField(parsed, 'allowPublicReaderHostnames'),
    createdAt: stringField(parsed, 'createdAt'),
    updatedAt: stringField(parsed, 'updatedAt'),
  };
}
