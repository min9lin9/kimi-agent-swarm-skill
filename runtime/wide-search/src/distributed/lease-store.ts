import type { JobStore } from './job-store';
import type { RedisClient } from './redis-client';

export interface LeaseStore {
	readonly type: string;

	claimLease(taskId: string, workerId: string, ttlMs: number): Promise<string | undefined>;
	releaseLease(token: string): Promise<void>;
	getRunningCount(jobId: string): Promise<number>;
}

export interface MemoryLeaseStoreOptions {
	jobStore: JobStore;
}

export class MemoryLeaseStore implements LeaseStore {
	readonly type = 'memory';
	private readonly jobStore: JobStore;
	private readonly running = new Map<string, { taskId: string; workerId: string }>();

	constructor(options: MemoryLeaseStoreOptions) {
		this.jobStore = options.jobStore;
	}

	async claimLease(taskId: string, workerId: string, _ttlMs: number): Promise<string | undefined> {
		const token = `${taskId}:${Date.now()}`;
		this.running.set(token, { taskId, workerId });
		return token;
	}

	async releaseLease(token: string): Promise<void> {
		this.running.delete(token);
	}

	async getRunningCount(jobId: string): Promise<number> {
		const job = await this.jobStore.getJob(jobId);
		if (!job) return 0;
		return job.tasks.filter((t) => t.status === 'running').length;
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

	async claimLease(taskId: string, _workerId: string, _ttlMs: number): Promise<string | undefined> {
		const client = await this.getClient();
		const token = `${taskId}:${Date.now()}`;
		// In Phase 2 we rely on the task already being marked running by TaskQueue.
		// Phase 3 will add explicit token validation and stale-lease revocation.
		return token;
	}

	async releaseLease(_token: string): Promise<void> {
		// Phase 2: no-op at token level. TaskQueue updates task status.
		// Phase 3 will track token -> task mapping and clean the running set.
	}

	async getRunningCount(jobId: string): Promise<number> {
		const client = await this.getClient();
		return client.scard(this.runningKey(jobId));
	}
}
