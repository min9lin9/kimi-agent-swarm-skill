import {
  QUEUE_TYPES,
  getBooleanFlag,
  getFlag,
  parseCliArgs,
  validateEnum,
  warnDeprecatedRedisCredentialFlags,
} from './cli-contract';
import { printUsage } from './cli-help';
import { maxResultsForDepth } from './costs';
import { MemoryQueueAdapter } from './distributed/memory-adapter';
import type { QueueAdapter } from './distributed/queue-adapter';
import { RedisQueueAdapter } from './distributed/redis-adapter';
import { ExternalWorkerPool } from './distributed/worker-pool';

export async function handleWorker(args: string[]): Promise<void> {
  const parsed = parseCliArgs(args);
  warnDeprecatedRedisCredentialFlags(parsed);
  if (getBooleanFlag(parsed, 'help')) {
    printUsage(0);
    return;
  }
  const jobId = getFlag(parsed, 'job-id');
  const workerId = getFlag(parsed, 'worker-id') ?? 'cli-worker';
  const workDir = getFlag(parsed, 'work-dir') ?? process.cwd();
  const queueType = validateEnum('queue-type', getFlag(parsed, 'queue-type'), QUEUE_TYPES);
  const redisUrl = getFlag(parsed, 'redis-url') ?? process.env.REDIS_URL;
  const redisPassword = getFlag(parsed, 'redis-password') ?? process.env.REDIS_PASSWORD;
  const redisUsername = getFlag(parsed, 'redis-username') ?? process.env.REDIS_USERNAME;

  if (!jobId) {
    throw new Error('worker command requires --job-id');
  }

  const adapter: QueueAdapter =
    queueType === 'redis'
      ? new RedisQueueAdapter({ redisUrl, username: redisUsername, password: redisPassword })
      : new MemoryQueueAdapter({ workDir });

  const job = await adapter.getJob(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }

  try {
    await new ExternalWorkerPool({
      adapter,
      profile: job.executionProfile,
      providerName: job.providerName,
      searchDepth: job.searchDepth,
      perTaskMaxResults:
        job.tasks.length === 0 || job.executionProfile.startsWith('fixture')
          ? undefined
          : Math.ceil(maxResultsForDepth(job.searchDepth) / job.tasks.length),
      useCache: job.useCache ?? false,
      budget: job.budget ?? {},
      workDir,
      allowPublicReaderHostnames: job.allowPublicReaderHostnames ?? false,
    }).runOnce(jobId, workerId);
  } finally {
    if (adapter.quit) {
      await adapter.quit();
    }
  }

  console.log(
    JSON.stringify({ workerId, done: true, metrics: { providerCalls: 0, apiCalls: 0 } }, null, 2)
  );
}
