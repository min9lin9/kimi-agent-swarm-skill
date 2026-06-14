import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FIXTURE_FILE_MAP } from '../shared';
import type { DistributedTask, ExecutionProfile, Source } from '../types';

export interface TaskPlan {
  queryFamily: string;
  query: string;
}

export function splitWebSearchTasks(objective: string): TaskPlan[] {
  const queries: TaskPlan[] = [
    { queryFamily: 'primary', query: objective },
    { queryFamily: 'best-of', query: `best ${objective}` },
    { queryFamily: 'comparison', query: `${objective} comparison` },
    { queryFamily: 'github', query: `${objective} github` },
    { queryFamily: 'latest', query: `${objective} ${new Date().getFullYear()}` },
  ];

  // Deduplicate while preserving order.
  const seen = new Set<string>();
  return queries.filter((q) => {
    if (seen.has(q.query)) return false;
    seen.add(q.query);
    return true;
  });
}

export async function splitFixtureTasks(
  profile: ExecutionProfile,
  fixturesDir: string,
  batchSize = 5
): Promise<TaskPlan[]> {
  const fileName = FIXTURE_FILE_MAP[profile];
  if (!fileName) {
    throw new Error(`No fixture file mapping for profile: ${profile}`);
  }

  const text = await readFile(join(fixturesDir, fileName), 'utf8');
  const { sources } = JSON.parse(text) as { sources: Source[] };

  const tasks: TaskPlan[] = [];
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    tasks.push({
      queryFamily: `fixture-batch-${Math.floor(i / batchSize) + 1}`,
      query: batch.map((s) => s.id).join(','),
    });
  }

  return tasks;
}

export function buildTasksFromPlans(
  jobId: string,
  plans: TaskPlan[],
  maxRetries: number
): DistributedTask[] {
  return plans.map((plan, index) => ({
    taskId: `${jobId}-task-${String(index + 1).padStart(4, '0')}`,
    jobId,
    queryFamily: plan.queryFamily,
    query: plan.query,
    status: 'pending',
    attempts: 0,
    maxRetries,
  }));
}
