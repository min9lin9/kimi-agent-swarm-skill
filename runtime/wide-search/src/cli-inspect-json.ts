import { EXECUTION_PROFILES, validateEnum } from './cli-contract';
import type { ExecutionProfile } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') throw new Error(`inspect ${key} must be a string`);
  return value;
}

function numberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number') throw new Error(`inspect ${key} must be a number`);
  return value;
}

export function inspectRunFromJson(text: string): {
  runId: string;
  objective: string;
  executionProfile: ExecutionProfile;
  status: string;
} {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('inspect run must be an object');
  const executionProfile = validateEnum(
    'executionProfile',
    stringField(parsed, 'executionProfile'),
    EXECUTION_PROFILES
  );
  if (!executionProfile) throw new Error('inspect executionProfile is required');
  return {
    runId: stringField(parsed, 'runId'),
    objective: stringField(parsed, 'objective'),
    executionProfile,
    status: stringField(parsed, 'status'),
  };
}

export function inspectVerificationFromJson(text: string): {
  status: string;
  acceptedSources: number;
  rejectedSources: number;
} {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) throw new Error('inspect verification must be an object');
  return {
    status: stringField(parsed, 'status'),
    acceptedSources: numberField(parsed, 'acceptedSources'),
    rejectedSources: numberField(parsed, 'rejectedSources'),
  };
}
