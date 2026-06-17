import { defaultLogger } from '../logger';

export interface RedisClient {
	on(event: 'error', listener: (err: Error) => void): this;
	on(event: 'reconnecting', listener: () => void): this;
	connect(): Promise<void>;
	quit(): Promise<'OK'>;
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<'OK'>;
	lpop(key: string): Promise<string | null>;
	rpush(key: string, ...values: string[]): Promise<number>;
	llen(key: string): Promise<number>;
	sadd(key: string, ...members: string[]): Promise<number>;
	srem(key: string, ...members: string[]): Promise<number>;
	scard(key: string): Promise<number>;
	keys(pattern: string): Promise<string[]>;
	del(...keys: string[]): Promise<number>;
}

export interface RedisConnectionOptions {
	redisUrl?: string;
	password?: string;
	username?: string;
	keyPrefix?: string;
	connectTimeout?: number;
}

export class RedisConnection {
	readonly type = 'redis';
	readonly redisUrl: string;
	readonly password?: string;
	readonly username?: string;
	readonly keyPrefix: string;
	private readonly connectTimeout: number;
	private client?: RedisClient;

	constructor(options: RedisConnectionOptions = {}) {
		this.redisUrl = options.redisUrl ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
		this.password = options.password ?? process.env.REDIS_PASSWORD;
		this.username = options.username;
		this.keyPrefix = options.keyPrefix ?? 'kasw';
		this.connectTimeout = options.connectTimeout ?? 10000;
	}

	async getClient(): Promise<RedisClient> {
		if (!this.client) {
			let Redis: (new (url: string, options?: Record<string, unknown>) => RedisClient) | undefined;
			try {
				// ioredis is an optional dependency. Use a variable module name so
				// TypeScript does not require it at compile time.
				const moduleName = 'ioredis';
				const mod = (await import(moduleName)) as unknown as {
					default?: new (url: string, options?: Record<string, unknown>) => RedisClient;
					Redis?: new (url: string, options?: Record<string, unknown>) => RedisClient;
				};
				Redis = mod.default ?? mod.Redis;
				if (!Redis) {
					throw new Error('ioredis export not found');
				}
			} catch {
				throw new Error('Redis adapter requires ioredis. Install it with: bun add ioredis');
			}

			const url = new URL(this.redisUrl);
			if (this.username && !url.username) {
				url.username = this.username;
			}
			if (this.password && !url.password) {
				url.password = this.password;
			}

			const client = new Redis(url.toString(), {
				lazyConnect: true,
				connectTimeout: this.connectTimeout,
				maxRetriesPerRequest: 1,
				enableOfflineQueue: false,
				retryStrategy: (times: number) => Math.min(times * 500, 3000),
			});
			client.on('error', (err: Error) => {
				defaultLogger.error(`Redis adapter connection error: ${err.message}`);
			});
			client.on('reconnecting', () => {
				defaultLogger.error('Redis adapter reconnecting...');
			});

			try {
				await Promise.race([
					client.connect(),
					new Promise<void>((_, reject) => {
						setTimeout(
							() => reject(new Error(`Redis connection timed out after ${this.connectTimeout}ms`)),
							this.connectTimeout
						);
					}),
				]);
				this.client = client;
			} catch (error) {
				this.client = undefined;
				throw error;
			}
		}
		return this.client;
	}

	async quit(): Promise<void> {
		if (this.client) {
			try {
				await this.client.quit();
			} catch {
				// Connection may already be closed; ignore.
			}
			this.client = undefined;
		}
	}

	defaultPattern(): string {
		return `${this.keyPrefix}:*`;
	}

	async flushKeys(pattern?: string): Promise<number> {
		const client = await this.getClient();
		const keys = await client.keys(pattern ?? this.defaultPattern());
		if (keys.length === 0) return 0;
		return client.del(...keys);
	}
}
