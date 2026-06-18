import { describe, expect, test } from 'bun:test';

import { deriveJobStatus } from '../../src/distributed/job-status';
import type { DistributedTask } from '../../src/types';

const baseTask = {
  jobId: 'job-1',
  queryFamily: 'family',
  query: 'query',
  attempts: 1,
  maxRetries: 1,
} satisfies Omit<DistributedTask, 'taskId' | 'status'>;

function task(taskId: string, status: DistributedTask['status']): DistributedTask {
  return { ...baseTask, taskId, status };
}

describe('deriveJobStatus', () => {
  test('returns running for an empty task list', () => {
    expect(deriveJobStatus([])).toBe('running');
  });

  test('returns completed when all tasks completed', () => {
    const status = deriveJobStatus([task('task-1', 'completed'), task('task-2', 'completed')]);

    expect(status).toBe('completed');
  });

  test('returns failed when any terminal task failed without pending or running work', () => {
    const status = deriveJobStatus([task('task-1', 'completed'), task('task-2', 'failed')]);

    expect(status).toBe('failed');
  });

  test('returns running while retryable or active work remains', () => {
    const status = deriveJobStatus([task('task-1', 'completed'), task('task-2', 'pending')]);

    expect(status).toBe('running');
  });

  test('returns pending when no task has started', () => {
    const status = deriveJobStatus([task('task-1', 'pending'), task('task-2', 'pending')]);

    expect(status).toBe('pending');
  });
});
