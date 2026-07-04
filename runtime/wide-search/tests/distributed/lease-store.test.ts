import { describe, expect, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MemoryJobStore } from '../../src/distributed/job-store';
import { MemoryLeaseStore, RedisLeaseStore } from '../../src/distributed/lease-store';
import type { RedisClient } from '../../src/distributed/redis-client';

describe('MemoryLeaseStore', () => {
  async function createStore(): Promise<MemoryLeaseStore> {
    const workDir = await mkdtemp(join(tmpdir(), 'wide-search-lease-'));
    const jobStore = new MemoryJobStore({ workDir });
    return new MemoryLeaseStore({ jobStore });
  }

  test('claimLease returns a unique token', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 1000);

    expect(token).toContain('job-1-task-0001');
  });

  test('releaseLease removes the token', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 1000);

    await store.releaseLease(token);
    const renewed = await store.renewLease(token, 1000);

    expect(renewed).toBe(false);
  });

  test('renewLease extends a valid lease', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 50);

    await new Promise((resolve) => setTimeout(resolve, 30));
    const renewed = await store.renewLease(token, 1000);

    expect(renewed).toBe(true);
  });

  test('renewLease rejects an expired lease', async () => {
    const store = await createStore();
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 10);

    await new Promise((resolve) => setTimeout(resolve, 30));
    const renewed = await store.renewLease(token, 1000);

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

class FakeRedisClient implements RedisClient {
  private readonly values = new Map<string, string>();
  private readonly sets = new Map<string, Set<string>>();

  on(): this {
    return this;
  }

  async connect(): Promise<void> {}

  async quit(): Promise<'OK'> {
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.values.set(key, value);
    return 'OK';
  }

  async lpop(): Promise<string | null> {
    return null;
  }

  async rpush(): Promise<number> {
    return 0;
  }

  async llen(): Promise<number> {
    return 0;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    const before = set.size;
    for (const member of members) {
      set.add(member);
    }
    this.sets.set(key, set);
    return set.size - before;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) {
      if (set.delete(member)) {
        removed += 1;
      }
    }
    return removed;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async keys(pattern: string): Promise<string[]> {
    const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    return [...this.values.keys()].filter((key) => key.startsWith(prefix));
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.values.delete(key)) {
        removed += 1;
      }
      if (this.sets.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }

  async eval(): Promise<unknown> {
    return null;
  }
}

describe('RedisLeaseStore', () => {
  test('renewLease clears running count when the lease already expired', async () => {
    const client = new FakeRedisClient();
    const store = new RedisLeaseStore({ keyPrefix: 'test', getClient: async () => client });
    const token = await store.claimLease('job-1-task-0001', 'job-1', 'worker-1', 10);

    await new Promise((resolve) => setTimeout(resolve, 30));
    const renewed = await store.renewLease(token, 1000);

    expect(renewed).toBe(false);
    expect(await store.getRunningCount('job-1')).toBe(0);
  });
});
