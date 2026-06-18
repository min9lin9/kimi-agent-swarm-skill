import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryJobStore } from '../../src/distributed/job-store';
import { MemoryLeaseStore } from '../../src/distributed/lease-store';

describe('MemoryLeaseStore', () => {
  async function createStore(): Promise<MemoryLeaseStore> {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-lease-'));
    const jobStore = new MemoryJobStore({ workDir });
    return new MemoryLeaseStore({ jobStore });
  }

  test('claimLease returns a unique token', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 1000);

    expect(token).toBeDefined();
    expect(token).toContain('job-1-task-0001');
  });

  test('releaseLease removes the token', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 1000);

    await store.releaseLease(token!);
    const renewed = await store.renewLease(token!, 1000);

    expect(renewed).toBe(false);
  });

  test('renewLease extends a valid lease', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 50);

    await new Promise((resolve) => setTimeout(resolve, 30));
    const renewed = await store.renewLease(token!, 1000);

    expect(renewed).toBe(true);
  });

  test('renewLease rejects an expired lease', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 10);

    await new Promise((resolve) => setTimeout(resolve, 30));
    const renewed = await store.renewLease(token!, 1000);

    expect(renewed).toBe(false);
  });

  test('revokeStaleLeases returns task ids older than the threshold', async () => {
    const store = await createStore();
    await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 10_000);
    await store.claimLease('job-1-task-0002', 'job-1', 'worker-1', 10_000);

    await new Promise((resolve) => setTimeout(resolve, 30));
    // 10ms threshold: both leases are older than 10ms.
    const revoked = await store.revokeStaleLeases(10);
    expect(revoked).toContain('job-1-task-0001');
    expect(revoked).toContain('job-1-task-0002');

    // 100s threshold: neither lease is older than 100s.
    const revokedLater = await store.revokeStaleLeases(100_000);
    expect(revokedLater).toHaveLength(0);
  });
});
