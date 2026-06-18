import type { JobStore } from './job-store';
import type { RedisClient } from './redis-client';

export interface LeaseRecord {
  taskId: string;
  jobId: string;
  workerId: string;
  issuedAt: number;
  ttlMs: number;
}

export interface LeaseStore {
  readonly type: string;

  claimLease(taskId: string, jobId: string, workerId: string, ttlMs: number): Promise<string>;
  renewLease(token: string, ttlMs: number): Promise<boolean>;
  releaseLease(token: string): Promise<void>;
  getRunningCount(jobId: string): Promise<number>;
  revokeStaleLeases(ttlMs: number): Promise<string[]>;
}

export interface MemoryLeaseStoreOptions {
  jobStore: JobStore;
}

export class MemoryLeaseStore implements LeaseStore {
  readonly type = 'memory';
  private readonly jobStore: JobStore;
  private readonly leases = new Map<string, LeaseRecord>();

  constructor(options: MemoryLeaseStoreOptions) {
    this.jobStore = options.jobStore;
  }

  async claimLease(
    taskId: string,
    jobId: string,
    workerId: string,
    ttlMs: number
  ): Promise<string> {
    const token = `${taskId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    this.leases.set(token, { taskId, jobId, workerId, issuedAt: Date.now(), ttlMs });
    return token;
  }

  async renewLease(token: string, ttlMs: number): Promise<boolean> {
    const lease = this.leases.get(token);
    if (!lease) return false;
    if (Date.now() > lease.issuedAt + lease.ttlMs) {
      this.leases.delete(token);
      return false;
    }
    lease.issuedAt = Date.now();
    lease.ttlMs = ttlMs;
    return true;
  }

  async releaseLease(token: string): Promise<void> {
    this.leases.delete(token);
  }

  async getRunningCount(jobId: string): Promise<number> {
    const job = await this.jobStore.getJob(jobId);
    if (!job) return 0;
    return job.tasks.filter((t) => t.status === 'running').length;
  }

  async revokeStaleLeases(ttlMs: number): Promise<string[]> {
    const now = Date.now();
    const revoked: string[] = [];
    for (const [token, lease] of this.leases.entries()) {
      if (now > lease.issuedAt + ttlMs) {
        this.leases.delete(token);
        revoked.push(lease.taskId);
      }
    }
    return revoked;
  }
}

export interface RedisLeaseStoreOptions {
  keyPrefix?: string;
  getClient: () => Promise<RedisClient>;
}

export class RedisLeaseStore implements LeaseStore {
  readonly type = 'redis';
  private readonly keyPrefix: string;
  private readonly getClient: () => Promise<RedisClient>;

  constructor(options: RedisLeaseStoreOptions) {
    this.keyPrefix = options.keyPrefix ?? 'kasw';
    this.getClient = options.getClient;
  }

  private runningKey(jobId: string): string {
    return `${this.keyPrefix}:running:${jobId}`;
  }

  private leaseKey(token: string): string {
    return `${this.keyPrefix}:lease:${token}`;
  }

  async claimLease(
    taskId: string,
    jobId: string,
    workerId: string,
    ttlMs: number
  ): Promise<string> {
    const client = await this.getClient();
    const token = `${taskId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    await client.sadd(this.runningKey(jobId), taskId);
    await client.set(
      this.leaseKey(token),
      JSON.stringify({ taskId, jobId, workerId, issuedAt: Date.now(), ttlMs })
    );
    return token;
  }

  async renewLease(token: string, ttlMs: number): Promise<boolean> {
    const client = await this.getClient();
    const text = await client.get(this.leaseKey(token));
    if (!text) return false;
    const lease = JSON.parse(text) as LeaseRecord;
    if (Date.now() > lease.issuedAt + lease.ttlMs) {
      await client.del(this.leaseKey(token));
      return false;
    }
    await client.set(
      this.leaseKey(token),
      JSON.stringify({ ...lease, issuedAt: Date.now(), ttlMs })
    );
    return true;
  }

  async releaseLease(token: string): Promise<void> {
    const client = await this.getClient();
    const text = await client.get(this.leaseKey(token));
    await client.del(this.leaseKey(token));
    if (!text) return;
    const lease = JSON.parse(text) as LeaseRecord;
    await client.srem(this.runningKey(lease.jobId), lease.taskId);
  }

  async getRunningCount(jobId: string): Promise<number> {
    const client = await this.getClient();
    return client.scard(this.runningKey(jobId));
  }

  async revokeStaleLeases(ttlMs: number): Promise<string[]> {
    const client = await this.getClient();
    const now = Date.now();
    const leasePattern = `${this.keyPrefix}:lease:*`;
    const keys = await client.keys(leasePattern);
    const revoked: string[] = [];

    for (const key of keys) {
      const text = await client.get(key);
      if (!text) continue;

      const lease = JSON.parse(text) as LeaseRecord;
      if (now > lease.issuedAt + ttlMs) {
        await client.srem(this.runningKey(lease.jobId), lease.taskId);
        await client.del(key);
        revoked.push(lease.taskId);
      }
    }

    return revoked;
  }
}
