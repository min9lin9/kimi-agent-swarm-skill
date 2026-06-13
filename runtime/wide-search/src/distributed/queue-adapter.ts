import type { DistributedJob, DistributedTask, WorkerResult } from "../types";

export interface QueueAdapter {
  readonly type: string;

  createJob(
    job: Omit<DistributedJob, "jobId" | "createdAt" | "updatedAt">,
  ): Promise<DistributedJob>;

  getJob(jobId: string): Promise<DistributedJob | undefined>;
  saveJob(job: DistributedJob): Promise<void>;

  claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined>;
  completeTask(taskId: string, result: WorkerResult): Promise<void>;
  failTask(taskId: string, error: string): Promise<void>;

  getPendingTaskCount(jobId: string): Promise<number>;
  getRunningTaskCount(jobId: string): Promise<number>;
}

export function makeJobId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `job-${timestamp}-${random}`;
}

export function makeTaskId(jobId: string, index: number): string {
  return `${jobId}-task-${String(index + 1).padStart(4, "0")}`;
}
