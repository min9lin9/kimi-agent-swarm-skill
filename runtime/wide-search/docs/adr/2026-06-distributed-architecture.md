# ADR: `distributed/` Architecture Redesign

**Status:** Accepted, implemented, and follow-ups completed  
**Date:** 2026-06-17  
**Deciders:** GJC (Planner/Architect/Critic consensus), user approval  
**Related:** `.gjc/specs/deep-interview-kasw-distributed-refactor.md`, `.gjc/plans/ralplan/2026-06-16-1549-0935/stage-03-final.md`

## Context

`src/distributed/` in `kimi-agent-swarm-cli` implements wide-search job distribution across in-process workers or external worker processes backed by Redis. The original design used a single `QueueAdapter` interface that mixed job persistence, pending-task queueing, running-task tracking, task execution orchestration, and job-status derivation in one contract. As a result:

- `MemoryQueueAdapter` is disk-backed and coupled to `workDir`.
- `RedisQueueAdapter` refreshes individual task keys inside `getJob` and reimplements `updateJobStatus`.
- `runner.ts` contains adapter factory logic, metrics accumulation, task execution, in-process worker loops, external-worker polling, and main orchestration.
- `src/cli.ts` `handleWorker` duplicates adapter instantiation and `perTaskMaxResults` calculation.
- There is no explicit lease contract: an external worker could call `completeTask` after a stale timeout had already requeued the task.

## Decision

Adopt **Option A**: split the internals into `JobStore`, `TaskQueue`, and `LeaseStore`, compose them behind a `QueueAdapter` compatibility facade, and delegate worker lifecycle to a first-class `WorkerPool` abstraction.

### Target architecture

```text
src/distributed/
  job-store.ts        JobStore (memory + Redis)
  task-queue.ts       TaskQueue (memory + Redis)
  lease-store.ts      LeaseStore (memory + Redis)
  redis-client.ts     Shared RedisConnection helper
  queue-adapter.ts    QueueAdapter interface + QueueAdapterFacade
  memory-adapter.ts   MemoryQueueAdapter (facade wrapper)
  redis-adapter.ts    RedisQueueAdapter (facade wrapper)
  coordinator.ts      Coordinator (external-worker polling + stale-task cleanup)
  worker.ts           workerLoop, task execution helpers
  worker-pool.ts      WorkerPool, InProcessWorkerPool, ExternalWorkerPool
  job-status.ts       deriveJobStatus
  job-sizing.ts       computePerTaskMaxResults
  task-splitter.ts    (unchanged)
```

### Principles

1. **Adapter purity** — `JobStore` persists the canonical `DistributedJob`, `TaskQueue` orders/schedules pending tasks, `LeaseStore` tracks claimed tasks and heartbeats. Business logic lives in runner/worker/Coordinator layers.
2. **Single source of truth** — Job status is derived by `deriveJobStatus(job.tasks)`. No backend reimplements it.
3. **Redis-free testability** — Every execution path is testable with in-memory/fake adapters. Redis is isolated behind the adapter layer.
4. **Explicit runner/worker boundary** — Worker lifecycle is owned by `WorkerPool`. `workers === 0` selects `ExternalWorkerPool`; otherwise `InProcessWorkerPool`.
5. **Backward-compatible surfaces** — Public CLI flags and the `QueueAdapter` method surface are preserved in the first implementation PR.

## Decision drivers

| # | Driver | Evidence |
|---|---|---|
| 1 | Adapter concern separation | `QueueAdapter.createJob` / `getJob` / `claimNextTask` / `completeTask` / `failTask` / counts all live in one interface in `src/distributed/queue-adapter.ts`. `MemoryQueueAdapter` mixes `Map` cache, disk writes, task mutation, and status derivation. `RedisQueueAdapter` refreshes task keys inside `getJob` and reimplements `updateJobStatus`. |
| 2 | Runner/worker responsibility overlap | `src/distributed/runner.ts` contains `createQueueAdapter`, `executeTask`, `workerLoop`, `pollJobToCompletion`, and `runDistributedWideSearch`. `src/cli.ts` `handleWorker` instantiates its own adapter and duplicates the `perTaskMaxResults` calculation. |
| 3 | State model and failure handling | Job status is recomputed in both adapters via duplicated `updateJobStatus`. There is no explicit lease, heartbeat, or stale-task detection contract. |

## Considered options

### Option A: Three-layer adapter split + WorkerPool (chosen)

Decompose `QueueAdapter` into `JobStore`, `TaskQueue`, `LeaseStore` plus a compatibility facade and `WorkerPool`.

**Pros:** Clean separation, backends can be mixed/swapped, incremental migration via facade, external workers become first-class.  
**Cons:** More interfaces, requires careful atomicity/persistence contracts, larger initial PR.

### Option B: Refined single `QueueAdapter`

Keep one `QueueAdapter` interface but add lease methods, extract `deriveJobStatus`, and extract `computePerTaskMaxResults`.

**Pros:** Smaller surface, fewer import changes.  
**Cons:** Does not fully separate concerns; Redis-specific optimizations leak back into the generic interface.

### Option C: Worker-pool-centric

Originally framed as a future enhancement, `WorkerPool` was absorbed into Option A as a required component.

## Consequences

- **Positive:** Each adapter has one reason to change; job/task state is derived in one place; external-worker mode is explicit; Redis-free tests are complete.
- **Negative:** More files and interfaces to learn; facade must be maintained until callers are migrated.
- **Risks mitigated:** Disk-backed resume preserved via `MemoryJobStore`; fallback gate keeps churn bounded; lease compatibility mode avoids breaking external workers during transition.

## Detailed design

### TypeScript interfaces

```ts
// job-store.ts
export interface JobStore {
  readonly type: string;
  createJob(job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>): Promise<DistributedJob>;
  getJob(jobId: string): Promise<DistributedJob | undefined>;
  saveJob(job: DistributedJob): Promise<void>;
  findTask(taskId: string): Promise<{ job: DistributedJob; task: DistributedTask } | undefined>;
}

// task-queue.ts
export interface TaskQueue {
  readonly type: string;
  enqueueTasks(jobId: string, tasks: DistributedTask[]): Promise<void>;
  claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined>;
  requeueTask(task: DistributedTask): Promise<void>;
  countPending(jobId: string): Promise<number>;
}

// lease-store.ts
export interface LeaseRecord {
  taskId: string;
  workerId: string;
  issuedAt: number;
  ttlMs: number;
}

export interface LeaseStore {
  readonly type: string;
  claimLease(taskId: string, workerId: string, ttlMs: number): Promise<string | undefined>;
  renewLease(token: string, ttlMs: number): Promise<boolean>;
  releaseLease(token: string): Promise<void>;
  getRunningCount(jobId: string): Promise<number>;
  revokeStaleLeases(ttlMs: number): Promise<string[]>;
}

// queue-adapter.ts (legacy facade)
export interface QueueAdapter {
  readonly type: string;
  createJob(job: Omit<DistributedJob, 'jobId' | 'createdAt' | 'updatedAt'>): Promise<DistributedJob>;
  getJob(jobId: string): Promise<DistributedJob | undefined>;
  saveJob(job: DistributedJob): Promise<void>;
  claimNextTask(jobId: string, workerId: string): Promise<DistributedTask | undefined>;
  completeTask(taskId: string, result: WorkerResult, leaseToken: string): Promise<void>;
  failTask(taskId: string, error: string, leaseToken: string): Promise<void>;
  failStaleTask(taskId: string, error: string): Promise<void>;
  getPendingTaskCount(jobId: string): Promise<number>;
  getRunningTaskCount(jobId: string): Promise<number>;
  quit?(): Promise<void>;
  revokeStaleLeases?(ttlMs?: number): Promise<string[]>;
}

// worker-pool.ts
export interface WorkerPool {
  readonly type: string;
  run(job: DistributedJob, options: WorkerPoolRunOptions): Promise<DistributedJob>;
}

export interface WorkerPoolRunOptions {
  adapter: QueueAdapter;
  workers: number;
  taskTimeoutMs?: number;
  perTaskMaxResults?: number;
  profile: ExecutionProfile;
  providerName: string;
  searchDepth: SearchDepth;
  useCache: boolean;
  budget: BudgetOptions;
  workDir: string;
}
```

### Persistence contract

- `MemoryJobStore` writes/reads `<workDir>/.runs/wide-search/jobs/<jobId>.json`. This preserves `tests/distributed/resume.test.ts`.
- `RedisJobStore` stores the canonical job JSON under `<prefix>:job:<jobId>`.
- `RedisTaskQueue` stores task JSON under `<prefix>:task:<taskId>` and pending task IDs in `<prefix>:queue:<jobId>`.
- `RedisLeaseStore` tracks running task IDs in `<prefix>:running:<jobId>` and lease records under `<prefix>:lease:<token>`.

### Lease token contract

1. `claimLease(taskId, workerId, ttlMs)` returns a unique token when the task is running.
2. `claimNextTask` calls `claimLease` and attaches the token to `task.leaseToken`.
3. `completeTask(taskId, result, leaseToken)` / `failTask(taskId, error, leaseToken)` validate the token:
   - If valid: release the lease and record the result/failure.
   - If invalid/expired: reject (no-op) and log a warning.
   - Missing tokens are rejected.
4. `releaseLease(token)` clears the lease. It is used for abandonment, cancellation, and internal revocation.
5. `failStaleTask(taskId, error)` is a coordinator override that fails a task without token validation, used for stale-task cleanup.
6. `revokeStaleLeases(ttlMs)` is called by `Coordinator` to clean up expired leases.

### `releaseLease` vs `completeTask`/`failTask`

- `completeTask`/`failTask` are the **only public completion paths**. They validate the token and internally release the lease.
- `releaseLease` is reserved for abandonment/revocation and is not a public completion path.

### `ExternalWorkerPool.run` semantics

- `run(job)` means "submit the job for external execution and poll to completion." It prints the job ID and calls `pollJobToCompletion`.
- `runOnce(jobId, workerId)` is the external worker entry point used by the CLI `worker` command. It executes `workerLoop` for one worker.

### Job/task state transitions

| Current task set | Event | New status |
|---|---|---|
| all `completed` | — | `completed` |
| all `failed` | — | `failed` |
| any `running` | — | `running` |
| `pending` only | — | `running` |
| `pending` + `failed` | — | `running` |
| `completed` + `failed` | — | `running` |

### Sequence: in-process worker

```text
runDistributedWideSearch
  -> createQueueAdapter
  -> adapter.createJob(tasks)
  -> InProcessWorkerPool.run(job, options)
       -> spawn N workerLoop promises
            -> adapter.claimNextTask -> task.leaseToken set
            -> executeTask(task)
            -> adapter.completeTask(taskId, result, leaseToken)
       -> adapter.getJob(jobId)
  -> finalizeDistributedRun(completedJob)
```

### Sequence: external worker

```text
runDistributedWideSearch
  -> createQueueAdapter (redis)
  -> adapter.createJob(tasks)
  -> ExternalWorkerPool.run(job)
       -> print {jobId}
       -> Coordinator.runToCompletion(jobId)
            -> revokeStaleLeases
            -> failStaleTask for stale running tasks
            -> return when completed/failed
  -> finalizeDistributedRun(completedJob)

CLI: kasw worker --job-id <id>
  -> ExternalWorkerPool.runOnce(jobId, workerId)
       -> workerLoop -> claim/complete tasks
```

## Implementation phases

| Phase | Work | Verification |
|---|---|---|
| 1 | Extract `deriveJobStatus` and `computePerTaskMaxResults`; remove inline duplication in `runner.ts` and `cli.ts`. | `bun test`, `bun run typecheck`, `bun run lint` |
| 2 | Add `JobStore`/`TaskQueue`/`LeaseStore` and `RedisConnection`; rewrite `QueueAdapter` as facade. | All existing distributed tests pass |
| 3 | Add token-based leases, validation, revocation; `failStaleTask` for coordinator override. | `lease-store.test.ts`, `queue-adapter-facade.test.ts` |
| 4 | Add `WorkerPool`, `InProcessWorkerPool`, `ExternalWorkerPool`; thin CLI worker. | `worker-pool.test.ts` |
| 5 | Finalize ADR, diagrams, review. | ADR check, full test suite |

## Verification matrix

| Check | Command | Result |
|---|---|---|
| Full test suite | `bun test` | 140 pass / 9 skip / 0 fail (2026-06-18) |
| Type check | `bun run typecheck` | clean |
| Lint | `bun run lint` | clean |
| Resume semantics | `bun test tests/distributed/resume.test.ts` | pass |
| Memory-only path | `bun test tests/distributed/memory-adapter.test.ts tests/distributed/runner.test.ts tests/distributed/resume.test.ts` | pass without Redis |
| Lease contract | `bun test tests/distributed/lease-store.test.ts tests/distributed/queue-adapter-facade.test.ts` | pass |
| WorkerPool | `bun test tests/distributed/worker-pool.test.ts` | pass |

## Option B fallback gate

If any of the following triggers during Phase 2, fall back to Option B (keep single `QueueAdapter`, add lease methods, extract helpers, defer internal split):

- More than 8 non-test call sites change their `QueueAdapter` import/usage.
- More than 3 existing tests fail after the facade PR.
- The internal-split PR cannot be completed in a single module/directory unit.

Measured baseline: 4 non-test source files import `QueueAdapter` (`src/cli.ts`, `src/distributed/runner.ts`, `src/distributed/memory-adapter.ts`, `src/distributed/redis-adapter.ts`). The 8-site threshold allows the count to more than double.

## Redis atomic `claimNextTask`

`RedisTaskQueue.claimNextTask` is implemented as a single Redis `EVAL` Lua script:

1. `LPOP` the next task ID from the job queue.
2. `GET` the task JSON from its canonical task key.
3. Decode with `cjson`, set `status='running'`, increment `attempts`, assign `workerId`/`startedAt`.
4. `SET` the updated task JSON back to the task key.
5. Return the updated task JSON.

This removes the read-modify-write race between listing a task as pending and marking it running. The facade then claims the lease and syncs the updated task back into the job blob so `getJob` reflects the latest state.

## Ponytail refactor

After the initial implementation, a Ponytail-style audit was applied to `src/distributed/`:

- Removed the stale Phase-3 compatibility comment from `QueueAdapterFacade`.
- Extracted `validateAndReleaseLease` and `failTaskCore` helpers to eliminate duplication between `completeTask`, `failTask`, and `failStaleTask`.
- Promoted `Coordinator` to the canonical external-worker polling path; `ExternalWorkerPool` now owns a `Coordinator` instance instead of calling `pollJobToCompletion`.
- Removed the now-unused `pollJobToCompletion` helper and its re-export from `runner.ts`.
- Removed unused store re-exports from `memory-adapter.ts` and `redis-adapter.ts`.
- Simplified `finalizeDistributedRun` metric aggregation where the filter already guarantees `result` exists.

All changes preserved the existing test baseline and did not alter distributed behavior.

## Follow-ups

1. **Memory cross-process safety:** Document that memory backend is single-process; external workers require Redis.
2. **CLI usage strings:** Verify no public CLI usage strings changed during the refactor.

## Test map

| Public interface / behavior | Test file |
|---|---|
| `JobStore` memory persistence | `tests/distributed/memory-adapter.test.ts`, `tests/distributed/resume.test.ts` |
| `TaskQueue` claim/requeue | `tests/distributed/memory-adapter.test.ts` |
| `LeaseStore` | `tests/distributed/lease-store.test.ts` |
| `QueueAdapter` facade + token validation | `tests/distributed/queue-adapter-facade.test.ts` |
| `WorkerPool` | `tests/distributed/worker-pool.test.ts` |
| End-to-end distributed run | `tests/distributed/runner.test.ts`, `tests/distributed/redis-runner.test.ts` |
| Job status derivation | `tests/distributed/job-status.test.ts` |
| Per-task max results | `tests/distributed/job-sizing.test.ts` |
