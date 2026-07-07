import type { DistributedJob, DistributedTaskStatus } from '../types';

export interface DistributedJobInspectSummary {
  readonly jobId: string;
  readonly status: string;
  readonly queueType: string;
  readonly workerMode: 'external' | 'in-process' | 'unknown';
  readonly taskCounts: Record<DistributedTaskStatus, number>;
  readonly staleRunningTasks: number;
  readonly retryableFailedTasks: number;
  readonly retryExhaustedTasks: number;
  readonly recoveryCommand: string;
}

const STALE_RUNNING_MS = 5 * 60 * 1000;

export function summarizeDistributedJob(
  job: DistributedJob,
  now = new Date()
): DistributedJobInspectSummary {
  const taskCounts: Record<DistributedTaskStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
  let retryableFailedTasks = 0;
  let retryExhaustedTasks = 0;
  let staleRunningTasks = 0;

  for (const task of job.tasks) {
    taskCounts[task.status] += 1;
    if (task.status === 'failed') {
      if (task.attempts >= task.maxRetries) retryExhaustedTasks += 1;
      else retryableFailedTasks += 1;
    }
    if (task.status === 'running' && task.startedAt) {
      const startedAt = Date.parse(task.startedAt);
      if (Number.isFinite(startedAt) && now.getTime() - startedAt > STALE_RUNNING_MS) {
        staleRunningTasks += 1;
      }
    }
  }

  return {
    jobId: job.jobId,
    status: job.status,
    queueType: job.queueType,
    workerMode:
      job.queueType === 'memory'
        ? 'in-process'
        : taskCounts.pending + taskCounts.running > 0
          ? 'external'
          : 'unknown',
    taskCounts,
    staleRunningTasks,
    retryableFailedTasks,
    retryExhaustedTasks,
    recoveryCommand:
      job.status === 'completed'
        ? 'none: distributed job already completed'
        : `kasw research --distributed --resume-job-id ${job.jobId}${job.workDir ? ` --work-dir ${job.workDir}` : ''}`,
  };
}
