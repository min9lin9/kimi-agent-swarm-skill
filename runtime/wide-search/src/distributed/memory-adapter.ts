import { MemoryJobStore } from './job-store';
import { MemoryLeaseStore } from './lease-store';
import { QueueAdapterFacade } from './queue-adapter';
import { MemoryTaskQueue } from './task-queue';

export interface MemoryAdapterOptions {
  workDir?: string;
}

export class MemoryQueueAdapter extends QueueAdapterFacade {
  constructor(options: MemoryAdapterOptions = {}) {
    const jobStore = new MemoryJobStore(options);
    super({
      type: 'memory',
      jobStore,
      taskQueue: new MemoryTaskQueue({ jobStore }),
      leaseStore: new MemoryLeaseStore({ jobStore }),
    });
  }
}
