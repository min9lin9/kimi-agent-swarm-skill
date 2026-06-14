import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { splitFixtureTasks, splitWebSearchTasks } from '../../src/distributed/task-splitter';

describe('task-splitter', () => {
  test('splitWebSearchTasks returns query families', () => {
    const plans = splitWebSearchTasks('AI browser agents');
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.queryFamily === 'primary')).toBe(true);
    expect(plans[0].query).toBe('AI browser agents');
  });

  test('splitFixtureTasks batches fixture sources', async () => {
    const fixturesDir = join(import.meta.dir, '../../fixtures');
    const plans = await splitFixtureTasks('fixture-paul-graham-corpus', fixturesDir, 5);

    expect(plans.length).toBeGreaterThan(0);
    expect(plans[0].queryFamily).toBe('fixture-batch-1');
    expect(plans[0].query.split(',').length).toBeLessThanOrEqual(5);
  });
});
