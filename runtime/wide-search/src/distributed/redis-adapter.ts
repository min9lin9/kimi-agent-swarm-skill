import { RedisJobStore } from './job-store';
import { RedisLeaseStore } from './lease-store';
import { QueueAdapterFacade } from './queue-adapter';
import { RedisConnection } from './redis-client';
import { RedisTaskQueue } from './task-queue';

export interface RedisAdapterOptions {
  redisUrl?: string;
  password?: string;
  username?: string;
  keyPrefix?: string;
}

export class RedisQueueAdapter extends QueueAdapterFacade {
  private readonly connection: RedisConnection;

  constructor(options: RedisAdapterOptions = {}) {
    const connection = new RedisConnection({
      redisUrl: options.redisUrl,
      password: options.password,
      username: options.username,
      keyPrefix: options.keyPrefix,
    });
    const keyPrefix = options.keyPrefix ?? 'kasw';
    super({
      type: 'redis',
      jobStore: new RedisJobStore({ keyPrefix, getClient: () => connection.getClient() }),
      taskQueue: new RedisTaskQueue({ keyPrefix, getClient: () => connection.getClient() }),
      leaseStore: new RedisLeaseStore({ keyPrefix, getClient: () => connection.getClient() }),
    });
    this.connection = connection;
  }

  async quit(): Promise<void> {
    await this.connection.quit();
  }

  async flushKeys(pattern?: string): Promise<number> {
    return this.connection.flushKeys(pattern);
  }
}
