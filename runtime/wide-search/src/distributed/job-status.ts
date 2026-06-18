import type { DistributedJobStatus, DistributedTask } from '../types';

export function deriveJobStatus(tasks: readonly DistributedTask[]): DistributedJobStatus {
  if (tasks.every(({ status }) => status === 'completed'))
    return tasks.length ? 'completed' : 'running';
  if (tasks.every((task) => task.status === 'pending')) return 'pending';
  if (tasks.every(({ status }) => status !== 'pending' && status !== 'running')) return 'failed';
  return 'running';
}
