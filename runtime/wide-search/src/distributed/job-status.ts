import type { DistributedJobStatus, DistributedTask } from '../types';

/**
 * Derive the canonical job status from the status of all its tasks.
 *
 * Rules:
 * - completed: every task is completed
 * - failed: every task is failed
 * - running: any other combination (including pending-only, or pending/running/failed mixes)
 */
export function deriveJobStatus(tasks: readonly DistributedTask[]): DistributedJobStatus {
	if (tasks.length === 0) {
		return 'running';
	}

	let allCompleted = true;
	let allFailed = true;

	for (const task of tasks) {
		if (task.status !== 'completed') {
			allCompleted = false;
		}
		if (task.status !== 'failed') {
			allFailed = false;
		}
		// Early exit: if neither all-completed nor all-failed is possible anymore,
		// the result must be running.
		if (!allCompleted && !allFailed) {
			return 'running';
		}
	}

	if (allCompleted) {
		return 'completed';
	}
	if (allFailed) {
		return 'failed';
	}
	return 'running';
}
