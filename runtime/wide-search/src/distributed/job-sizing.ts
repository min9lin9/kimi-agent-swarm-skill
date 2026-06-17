import { maxResultsForDepth } from '../costs';
import type { ExecutionProfile, SearchDepth } from '../types';

/**
 * Compute the max results budget per task for a distributed job.
 *
 * - Returns `undefined` for fixture-backed profiles (no per-task web search limit).
 * - Returns `undefined` when `taskCount` is zero or negative.
 * - Otherwise returns `ceil(maxResultsForDepth(searchDepth) / taskCount)`.
 */
export function computePerTaskMaxResults(
	profile: ExecutionProfile,
	searchDepth: SearchDepth,
	taskCount: number,
): number | undefined {
	if (taskCount <= 0) {
		return undefined;
	}
	if (typeof profile === 'string' && profile.startsWith('fixture')) {
		return undefined;
	}
	return Math.ceil(maxResultsForDepth(searchDepth) / taskCount);
}
