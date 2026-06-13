import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MemoryQueueAdapter } from "../../src/distributed/memory-adapter";
import { buildTasksFromPlans } from "../../src/distributed/task-splitter";
import type { DistributedJob } from "../../src/types";

describe("MemoryQueueAdapter", () => {
  async function createAdapter(): Promise<MemoryQueueAdapter> {
    const workDir = await mkdtemp(join(tmpdir(), "wide-search-dist-"));
    return new MemoryQueueAdapter({ workDir });
  }

  test("creates and retrieves a job", async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: "test",
      executionProfile: "fixture",
      providerName: "mock",
      searchDepth: "standard",
      queueType: "memory",
      status: "pending",
      tasks: buildTasksFromPlans("job-1", [{ queryFamily: "a", query: "q1" }], 2),
    });

    expect(job.jobId).toBeDefined();
    expect(job.tasks.length).toBe(1);

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.objective).toBe("test");
  });

  test("claims, completes, and aggregates tasks", async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: "test",
      executionProfile: "fixture",
      providerName: "mock",
      searchDepth: "standard",
      queueType: "memory",
      status: "pending",
      tasks: buildTasksFromPlans("job-2", [
        { queryFamily: "a", query: "q1" },
        { queryFamily: "b", query: "q2" },
      ], 2),
    });

    const task1 = await adapter.claimNextTask(job.jobId, "worker-1");
    expect(task1).toBeDefined();
    expect(task1?.status).toBe("running");

    await adapter.completeTask(task1!.taskId, {
      sources: [],
      usageMetrics: { providerCalls: 1, apiCalls: 1 },
    });

    const task2 = await adapter.claimNextTask(job.jobId, "worker-1");
    expect(task2).toBeDefined();

    await adapter.completeTask(task2!.taskId, {
      sources: [],
      usageMetrics: { providerCalls: 1, apiCalls: 1 },
    });

    const loaded = await adapter.getJob(job.jobId);
    expect(loaded?.status).toBe("completed");
  });

  test("retries failed tasks up to maxRetries", async () => {
    const adapter = await createAdapter();
    const job = await adapter.createJob({
      objective: "test",
      executionProfile: "fixture",
      providerName: "mock",
      searchDepth: "standard",
      queueType: "memory",
      status: "pending",
      tasks: buildTasksFromPlans("job-3", [{ queryFamily: "a", query: "q1" }], 2),
    });

    const task = await adapter.claimNextTask(job.jobId, "worker-1");
    await adapter.failTask(task!.taskId, "error");

    const retried = await adapter.claimNextTask(job.jobId, "worker-2");
    expect(retried).toBeDefined();
    expect(retried?.attempts).toBe(2);

    await adapter.failTask(retried!.taskId, "error");
    const failedJob = await adapter.getJob(job.jobId);
    expect(failedJob?.tasks[0].status).toBe("failed");
  });
});
