import type { DistributedJobStatus, DistributedTask } from '../types';

export function deriveJobStatus(tasks: readonly DistributedTask[]): DistributedJobStatus {
  if (tasks.every((task) => task.status === 'completed')) return 'completed';
  if (tasks.some((task) => task.status === 'pending' || task.status === 'running')) {
    return tasks.some((task) => task.status !== 'pending') ? 'running' : 'pending';
  }
  return 'failed';
}
