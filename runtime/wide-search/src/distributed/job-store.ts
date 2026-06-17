import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { DistributedJob, DistributedTask } from '../types';
import type { RedisClient } from './redis-client';

export interface JobStore {
	readonly type: string;

	createJob(
		job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>
	): Promise<DistributedJob>;

	getJob(jobId: string): Promise<DistributedJob | undefined>;
	saveJob(job: DistributedJob): Promise<void>;

	/**
	 * Find the job that contains the given taskId and return both.
	 * This is a pragmatic lookup used by the legacy QueueAdapter facade.
	 */
	findTask(taskId: string): Promise<{ job: DistributedJob; task: DistributedTask } | undefined>;
}

export interface MemoryJobStoreOptions {
	workDir?: string;
}

export class MemoryJobStore implements JobStore {
	readonly type = 'memory';
	private readonly jobs = new Map<string, DistributedJob>();
	private readonly workDir: string;

	constructor(options: MemoryJobStoreOptions = {}) {
		this.workDir = options.workDir ?? process.cwd();
	}

	private jobFilePath(jobId: string): string {
		return join(this.workDir, '.runs', 'wide-search', 'jobs', `${jobId}.json`);
	}

	async createJob(
		job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>
	): Promise<DistributedJob> {
		const now = new Date().toISOString();
		const created: DistributedJob = {
			...job,
			jobId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
			createdAt: now,
			updatedAt: now,
		};
		this.jobs.set(created.jobId, created);
		await this.saveJob(created);
		return created;
	}

	async getJob(jobId: string): Promise<DistributedJob | undefined> {
		const cached = this.jobs.get(jobId);
		if (cached) {
			return cached;
		}

		try {
			const text = await readFile(this.jobFilePath(jobId), 'utf8');
			const loaded = JSON.parse(text) as DistributedJob;
			this.jobs.set(jobId, loaded);
			return loaded;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				return undefined;
			}
			throw error;
		}
	}

	async saveJob(job: DistributedJob): Promise<void> {
		const path = this.jobFilePath(job.jobId);
		await mkdir(join(path, '..'), { recursive: true });
		const updated = { ...job, updatedAt: new Date().toISOString() };
		this.jobs.set(job.jobId, updated);
		await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
	}

	async findTask(taskId: string): Promise<{ job: DistributedJob; task: DistributedTask } | undefined> {
		for (const job of this.jobs.values()) {
			const task = job.tasks.find((t) => t.taskId === taskId);
			if (task) return { job, task };
		}
		return undefined;
	}
}

export interface RedisJobStoreOptions {
	keyPrefix?: string;
	getClient: () => Promise<RedisClient>;
}

export class RedisJobStore implements JobStore {
	readonly type = 'redis';
	private readonly keyPrefix: string;
	private readonly getClient: () => Promise<RedisClient>;

	constructor(options: RedisJobStoreOptions) {
		this.keyPrefix = options.keyPrefix ?? 'kasw';
		this.getClient = options.getClient;
	}

	private jobKey(jobId: string): string {
		return `${this.keyPrefix}:job:${jobId}`;
	}

	async createJob(
		job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>
	): Promise<DistributedJob> {
		const client = await this.getClient();
		const now = new Date().toISOString();
		const created: DistributedJob = {
			...job,
			jobId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
			createdAt: now,
			updatedAt: now,
		};
		await client.set(this.jobKey(created.jobId), JSON.stringify(created));
		return created;
	}

	async getJob(jobId: string): Promise<DistributedJob | undefined> {
		const client = await this.getClient();
		const text = await client.get(this.jobKey(jobId));
		if (!text) return undefined;
		return JSON.parse(text) as DistributedJob;
	}

	async saveJob(job: DistributedJob): Promise<void> {
		const client = await this.getClient();
		const updated = { ...job, updatedAt: new Date().toISOString() };
		await client.set(this.jobKey(job.jobId), JSON.stringify(updated));
	}

	async findTask(taskId: string): Promise<{ job: DistributedJob; task: DistributedTask } | undefined> {
		const client = await this.getClient();
		const taskText = await client.get(this.taskKey(taskId));
		if (!taskText) return undefined;
		const task = JSON.parse(taskText) as DistributedTask;
		const job = await this.getJob(task.jobId);
		if (!job) return undefined;
		return { job, task };
	}

	private taskKey(taskId: string): string {
		return `${this.keyPrefix}:task:${taskId}`;
	}
}
