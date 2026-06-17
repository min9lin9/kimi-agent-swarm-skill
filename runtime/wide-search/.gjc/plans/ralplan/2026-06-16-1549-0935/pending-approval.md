# RALPLAN Final Plan (Pending Approval): Analysis & ADR for distributed/ Architecture Redesign

## Summary
Produce an implementation-ready ADR for the `kimi-agent-swarm-cli` `src/distributed/` module. This revision incorporates architect/critic feedback from stage 01: it keeps `QueueAdapter` as a thin compatibility facade over new internal adapters in the first PR, preserves the disk-backed resume semantics of the memory backend, defines an explicit lease-token contract, promotes `WorkerPool` to a first-class target-architecture component, centralizes the duplicated `perTaskMaxResults` calculation, and adds a measurable Option B fallback gate. No product source code is changed in this planning phase.

## In Scope
- Full analysis of `src/distributed/*` (`runner.ts`, `queue-adapter.ts`, `memory-adapter.ts`, `redis-adapter.ts`, `task-splitter.ts`) and the distributed sections of `src/cli.ts`.
- Review of `tests/distributed/*`, especially `resume.test.ts`, `runner.test.ts`, `redis-runner.test.ts`, `memory-adapter.test.ts`, `redis-adapter.test.ts`.
- ADR/design document containing principles, decision drivers, viable options, recommended architecture, explicit contracts, state model, migration sequence, and acceptance checklist.
- Preparation for a second architect/critic review.

## Out of Scope
- Source code edits or refactors in this phase.
- Refactoring of non-distributed modules (`providers/`, `verifier.ts`, `leaderboard.ts`, etc.).
- Quantitative performance benchmarks or release planning.

## Principles
1. **Adapter purity** — Internal adapters own exactly one concern: `JobStore` persists `DistributedJob`, `TaskQueue` orders/schedules pending tasks, `LeaseStore` tracks claimed/running tasks and heartbeats. Business logic (budget checks, scoring, task execution, worker lifecycle) belongs in runner/worker/Coordinator layers.
2. **Single source of truth for state** — Job and task status must be derived from one explicit state model. The duplicated `updateJobStatus` logic is replaced by a shared pure function or centralized in the `Coordinator`; it must not be reimplemented per backend.
3. **Redis-free testability** — Every distributed execution path must be testable with in-memory/fake adapters. Redis remains optional in CI and is isolated behind the adapter layer.
4. **Explicit runner/worker boundary** — Worker lifecycle and task execution are owned by a `WorkerPool` abstraction. The CLI `worker` command is a thin wrapper around `ExternalWorkerPool`; the runner delegates to `InProcessWorkerPool` or `ExternalWorkerPool` instead of branching on `workers === 0`.
5. **Backward-compatible surfaces by default** — Public CLI flags (`--distributed`, `--workers`, `--queue-type`, `--resume-job-id`, `worker` command, etc.) and existing test assertions continue to pass unless the ADR explicitly documents and justifies a breaking change. The first implementation PR keeps `QueueAdapter` as a compatibility facade over the new internal adapters so callers do not change.

## Top 3 Decision Drivers
1. **Adapter concern separation** — `QueueAdapter` currently mixes job persistence, task queueing, and running-set tracking. `MemoryQueueAdapter` is file-backed and coupled to `workDir`, while `RedisQueueAdapter` refreshes individual task keys inside `getJob` and reimplements job-status derivation (`updateJobStatus`).
2. **Runner/worker responsibility overlap** — `runner.ts` contains adapter factory, metrics accumulation, task execution, in-process worker loop, external-worker polling, and main orchestration. `src/cli.ts` `handleWorker` duplicates adapter instantiation, job lookup, and the `perTaskMaxResults` calculation (`Math.ceil(maxResultsForDepth(job.searchDepth) / job.tasks.length)`).
3. **State model and failure handling** — Job status is recomputed in both adapters via duplicated `updateJobStatus`. There is no explicit lease, heartbeat, or stale-task detection contract, so an external worker can still call `completeTask` after a stale-task timeout has requeued the task.

## Viable Options

### Option A: Three-layer adapter split + Coordinator + WorkerPool (recommended)
Decompose `QueueAdapter` into three focused internal abstractions:
- `JobStore`: `createJob`, `getJob`, `saveJob`. Persists the canonical `DistributedJob`.
- `TaskQueue`: `enqueueTasks`, `claimNextTask`, `requeueTask`, `countPending`.
- `LeaseStore`: `claimLease(taskId, workerId) -> token`, `renewLease(token)`, `releaseLease(token)`, `getRunningCount`, `revokeStaleLeases()`.

A `Coordinator` composes these three adapters and owns the unified job/task state machine. A `QueueAdapter` compatibility facade wraps the three adapters and preserves the existing public surface for callers in the first PR. A `WorkerPool` abstraction closes the runner/worker boundary.

**Pros**
- Clean separation of concerns; each adapter has one reason to change.
- Backends can be mixed/swapped independently (e.g., disk JobStore + in-memory queue + in-memory leases for memory mode; Redis for all three in Redis mode).
- The facade makes the migration incremental: existing callers and tests keep compiling.
- `WorkerPool` makes external workers first-class and removes the `workers === 0` special case.

**Cons**
- More interfaces and a new factory than Option B.
- Requires careful design of atomicity/persistence contracts across three adapters.
- Larger ADR and initial implementation PR.

### Option B: Refined single `QueueAdapter` with explicit lease methods
Keep one `QueueAdapter` interface but:
- Add `claimLease(taskId, workerId) -> token`, `releaseLease(token)`, `renewLease(token)`.
- Require the token in `completeTask`/`failTask`.
- Extract the duplicated `updateJobStatus` into a shared pure function.
- Extract `computePerTaskMaxResults` into a shared module.

**Pros**
- Smaller public API surface than Option A.
- Fewer import changes for callers.
- Lower risk if Option A facade PR exceeds the churn threshold.

**Cons**
- The single interface still mixes queue, job store, and lease concerns.
- Redis-specific optimizations tend to leak back into the generic interface.
- Does not fully close the runner/worker boundary without also adding `WorkerPool`.

### Option C: Worker-pool-centric architecture (absorbed into Option A)
Originally framed as a future enhancement, the `WorkerPool` abstraction is now promoted to part of the target architecture under Option A:
- `WorkerPool` interface with `run(job, options): Promise<DistributedJob>`.
- `InProcessWorkerPool` spawns N `workerLoop` tasks internally.
- `ExternalWorkerPool` polls the job to completion and assumes external `kasw worker` processes.
- The CLI `worker` command becomes argument parsing + `ExternalWorkerPool.runOnce(jobId, workerId)`.

It is **not a separate migration path**; it is a required component of the recommended Option A design.

## Recommended Approach

### Target architecture: Option A with compatibility facade
1. **Internal split** — Introduce `JobStore`, `TaskQueue`, and `LeaseStore` interfaces (and their memory/Redis implementations) inside `src/distributed/`.
2. **External stability** — Keep `QueueAdapter` as a thin facade over the three internal adapters in the first implementation PR. Existing callers (`runner.ts`, `src/cli.ts`, tests) continue to compile and pass without import changes.
3. **Persistence contract** — The memory `JobStore` **remains disk-backed**, writing to `<workDir>/.runs/wide-search/jobs/<jobId>.json` and loading from disk on `getJob`, exactly as `MemoryQueueAdapter` does today. This preserves `tests/distributed/resume.test.ts` and real resume behavior. For Redis, `JobStore` stores the canonical job JSON in Redis; `TaskQueue` and `LeaseStore` use Redis list/set primitives.
4. **Lease contract** — Define token-based leases:
   - `claimLease(taskId, workerId, ttlMs): Promise<string | undefined>` returns a unique token only when the task is pending; atomically marks the task `running`.
   - `renewLease(token, ttlMs): Promise<boolean>` extends a valid lease.
   - `releaseLease(token): Promise<void>` clears the lease **without producing a result or failure**. It is used for abandonment, explicit cancellation, or internal revocation by `revokeStaleLeases`. It does **not** change task status to `completed` or `failed`.
   - `completeTask(taskId, token, result)` and `failTask(taskId, token, error)` are the **only public completion paths**. They validate the token; if valid, they record the result/failure and internally release the lease. If the token is missing, expired, or revoked, the call is rejected/no-op and logged.
   - `revokeStaleLeases(ttlMs)` is called by the coordinator/poller to requeue tasks whose leases have expired. It uses `releaseLease` internally to clear stale leases and then returns the affected tasks to the pending queue.
   - **Compatibility transition**: Phase 3 introduces token validation in *compatibility mode*. In this mode `completeTask`/`failTask` accept an **optional token**; calls with no token are accepted but emit a deprecation warning and are counted by a metric. Phase 4 (WorkerPool + CLI worker update) makes the token **required** and removes compatibility mode. The transition lasts exactly one PR cycle so no best-effort branch remains long-term.
5. **WorkerPool contract** — Promote `WorkerPool` to first-class:
   ```ts
   export interface WorkerPool {
     run(job: DistributedJob, options: WorkerPoolOptions): Promise<DistributedJob>;
   }
   export interface WorkerPoolOptions {
     workers: number; // 0 => external
     taskTimeoutMs: number;
     perTaskMaxResults?: number;
     // execution context: profile, providerName, useCache, budget, workDir
   }
   ```
   - `InProcessWorkerPool.run` creates N `workerLoop` promises and aggregates metrics.
   - `ExternalWorkerPool.run` **submits the job for external execution and polls to completion**; it does not execute tasks itself. To make this explicit, the method may be named `runAndWait` or the interface may expose `submit(job)` + `waitForCompletion(jobId)`. The CLI `worker` command remains the actual task executor. For ADR purposes the semantic is documented as "submit and poll to completion" even if the exported name stays `run`.
   - CLI `handleWorker` reduces to: parse args -> build `ExternalWorkerPool` -> `runOnce(jobId, workerId)`.
6. **Shared `perTaskMaxResults` helper** — Extract `computePerTaskMaxResults(profile: ExecutionProfile, searchDepth: SearchDepth, taskCount: number): number | undefined` into `src/distributed/shared.ts` and call it from both `runner.ts` and `src/cli.ts` `handleWorker`.
7. **Single source of truth** — Move `updateJobStatus` to a single pure function (e.g., `deriveJobStatus(tasks): DistributedJobStatus`) used by `Coordinator` and both `JobStore` implementations. No backend reimplements it.

### File-level changes (for the ADR to specify)
- **New**
  - `src/distributed/job-store.ts` — `JobStore` interface + memory/Redis implementations.
  - `src/distributed/task-queue.ts` — `TaskQueue` interface + memory/Redis implementations.
  - `src/distributed/lease-store.ts` — `LeaseStore` interface + memory/Redis implementations.
  - `src/distributed/coordinator.ts` — `Coordinator` that composes the three stores and runs `deriveJobStatus`.
  - `src/distributed/worker-pool.ts` — `WorkerPool`, `InProcessWorkerPool`, `ExternalWorkerPool`.
  - `src/distributed/shared.ts` — `computePerTaskMaxResults`, `deriveJobStatus`.
- **Modified**
  - `src/distributed/queue-adapter.ts` — Reduced to a compatibility facade; may move the `makeJobId`/`makeTaskId` helpers to `shared.ts`.
  - `src/distributed/memory-adapter.ts` — Reimplemented as `MemoryJobStore` + `MemoryTaskQueue` + `MemoryLeaseStore` behind the facade.
  - `src/distributed/redis-adapter.ts` — Reimplemented as `RedisJobStore` + `RedisTaskQueue` + `RedisLeaseStore` behind the facade.
  - `src/distributed/runner.ts` — Uses `Coordinator`, `WorkerPool`, and `computePerTaskMaxResults`; removes duplicated adapter factory logic where possible.
  - `src/cli.ts` — `handleWorker` becomes a thin wrapper around `ExternalWorkerPool`; uses `computePerTaskMaxResults` from shared module.
- **Tests**
  - `tests/distributed/job-store.test.ts`
  - `tests/distributed/task-queue.test.ts`
  - `tests/distributed/lease-store.test.ts`
  - `tests/distributed/worker-pool.test.ts`
  - Existing `tests/distributed/resume.test.ts` must continue to pass with disk-backed memory `JobStore`.

### Option B fallback gate
Option B is retained as a fallback if the facade PR proves too invasive. The gate is measurable:
- **Churn gate**: If the facade PR changes more than **8 non-test call sites** that import `QueueAdapter`, or requires changes to public CLI flag parsing/usage strings, escalate to Option B. *Measured baseline*: currently **4 non-test source files** import `QueueAdapter` (`src/cli.ts`, `src/distributed/runner.ts`, `src/distributed/memory-adapter.ts`, `src/distributed/redis-adapter.ts`). The threshold of 8 allows the count to more than double before fallback; if imports drop from 4 to 0 during facade migration, that counts as 4 changed sites, well below the gate.
- **Quality gate**: If more than **3 existing tests fail** after the facade PR (excluding Redis tests skipped in CI), escalate to Option B.
- **Time gate**: If the internal-split PR cannot be completed in a single module/directory unit as defined by the spec, escalate to Option B.

If any gate triggers, the fallback is: keep `QueueAdapter` as the single public interface, add lease methods to it, extract `computePerTaskMaxResults` and `deriveJobStatus`, and introduce `WorkerPool` without splitting the internal adapters.

## Stage 03 ADR Clarifications
The following clarifications were added in response to the Stage 03 Architect review (verdict `WATCH`, recommendation `COMMENT`):

1. **Lease token lifecycle and compatibility transition duration** — Token validation is introduced in *compatibility mode* during Phase 3 (optional token with deprecation warning), then made *required* in Phase 4. The transition is bounded to one PR cycle; no long-term best-effort branch remains.
2. **`releaseLease` vs `completeTask`/`failTask`** — `completeTask`/`failTask` are the sole public completion paths and release the lease internally. `releaseLease` is reserved for abandonment, cancellation, and internal revocation by `revokeStaleLeases`.
3. **`ExternalWorkerPool.run` naming/semantics** — The semantic is "submit and poll to completion"; the ADR documents this explicitly and allows the exported name to be `runAndWait` or `submit`+`waitForCompletion` if the implementer prefers clarity.
4. **Option B fallback thresholds** — The 8-site threshold is grounded in a baseline measurement of 4 non-test `QueueAdapter` import sites, allowing a >100% increase before fallback.

## Concrete Phases / Steps

### Phase 1: Baseline & small safe pre-refactors
1. Run `bun test`, `bun run typecheck`, `bun run lint` and record baseline (`119 pass / 8 skip / 0 fail`).
2. Create `src/distributed/shared.ts` with `computePerTaskMaxResults` and `deriveJobStatus`.
3. Update `src/distributed/runner.ts` and `src/cli.ts` `handleWorker` to import and call `computePerTaskMaxResults`.
4. Run the full verification pipeline; ensure `tests/distributed/resume.test.ts` still passes.

### Phase 2: Internal adapter split with `QueueAdapter` facade
1. Define `JobStore`, `TaskQueue`, and `LeaseStore` interfaces.
2. Implement memory variants:
   - `MemoryJobStore` remains disk-backed (`<workDir>/.runs/wide-search/jobs/<jobId>.json`).
   - `MemoryTaskQueue` orders pending tasks by reading the canonical job state from `JobStore`.
   - `MemoryLeaseStore` tracks running tasks and lease tokens in memory (lost on process restart is acceptable; stale `running` tasks are recovered via the lease timeout in `Coordinator`).
3. Implement Redis variants using the current Redis primitives.
4. Rewrite `QueueAdapter` as a thin facade that delegates to the three internal adapters; preserve every existing method signature.
5. Update `createQueueAdapter` factory to return the facade.
6. Run all tests. If the fallback gate triggers, switch to Option B.

### Phase 3: Lease token contract & stale-task revocation
1. Add token generation to `claimLease` and token validation to `completeTask`/`failTask`.
2. Add `renewLease` and `revokeStaleLeases` to `LeaseStore`.
3. Update `Coordinator`/`pollJobToCompletion` to call `revokeStaleLeases` and fail/requeue stale tasks.
4. Update `workerLoop` to store the token returned by `claimNextTask` and pass it to `completeTask`/`failTask`.
5. Add unit tests for lease revocation and token-mismatch rejection.

### Phase 4: WorkerPool abstraction & CLI worker thinning
1. Define `WorkerPool`, `InProcessWorkerPool`, and `ExternalWorkerPool`.
2. Replace the `workers === 0` branch in `runner.ts` with `ExternalWorkerPool`.
3. Replace the in-process worker spawn loop with `InProcessWorkerPool`.
4. Refactor `src/cli.ts` `handleWorker` to parse args and call `ExternalWorkerPool.runOnce(jobId, workerId)`.
5. Add `tests/distributed/worker-pool.test.ts` covering both pool modes.

### Phase 5: ADR finalization, diagrams, and review
1. Document the current-state assessment with code references.
2. Document principles, drivers, options, recommendation, and fallback gate.
3. Produce a job/task state-transition diagram or table.
4. Produce a sequence diagram for in-process and external worker flows.
5. Confirm every public interface maps to a test file.
6. Submit to architect/critic review and incorporate feedback.

## Sharpened Testable Acceptance Criteria
1. The ADR references every file in `src/distributed/*`, the distributed sections of `src/cli.ts`, and every file in `tests/distributed/*`.
2. The ADR lists 3–5 principles and top 3 decision drivers, each mapped to specific code evidence.
3. The ADR evaluates at least two viable options with bounded pros/cons, and explains why Option A is recommended and how Option B is triggered.
4. The ADR specifies concrete TypeScript interface definitions for `JobStore`, `TaskQueue`, `LeaseStore`, `Coordinator`, `WorkerPool`, `InProcessWorkerPool`, and `ExternalWorkerPool`.
5. The persistence contract is explicit: the memory `JobStore` writes/reads `<workDir>/.runs/wide-search/jobs/<jobId>.json`, and `tests/distributed/resume.test.ts` continues to pass after the refactor.
6. The lease contract is explicit: `claimLease` returns a token; `completeTask`/`failTask` validate the token; stale leases are revoked by `Coordinator`/`pollJobToCompletion`; unit tests cover token mismatch and stale revocation.
7. `computePerTaskMaxResults(profile, searchDepth, taskCount)` lives in a shared module used by both `runner.ts` and `src/cli.ts` `handleWorker`; no inline duplication remains.
8. `WorkerPool` is a first-class target-architecture component with `InProcessWorkerPool` and `ExternalWorkerPool` implementations; the CLI `worker` command is documented as a thin wrapper around `ExternalWorkerPool.runOnce`.
9. The job/task state model is documented as a diagram or table showing all valid status transitions and the event that triggers each.
10. The migration sequence preserves all public CLI flags (`--distributed`, `--workers`, `--queue-type`, `--resume-job-id`, `--redis-*`, `--task-timeout-ms`, `worker` command) unless each exception is explicitly justified in the ADR.
11. The repository still passes all existing tests with no source code changes during the planning phase (`bun test` shows `119 pass / 8 skip / 0 fail`).
12. `bun run typecheck` and `bun run lint` pass with no new errors.
13. `git diff --name-only` during the planning phase shows changes only in documentation files (no source edits).
14. Architect/critic review is completed and all feedback is incorporated or explicitly deferred with rationale.

## Verification Steps
1. **Baseline**: `bun test`, `bun run typecheck`, `bun run lint`.
2. **During analysis**: `git diff --name-only` to confirm no source files are modified.
3. **After each planned implementation phase**: rerun `bun test`, `bun run typecheck`, `bun run lint`.
4. **Resume semantics**: `bun test tests/distributed/resume.test.ts` must pass after any memory-backend change.
5. **Redis-free path**: `bun test tests/distributed/memory-adapter.test.ts tests/distributed/runner.test.ts tests/distributed/resume.test.ts` passes without `ioredis` or a Redis server.
6. **Facade churn check**: count non-test call sites that import `QueueAdapter` before and after the facade PR; if >8 changed, trigger Option B gate.
7. **ADR structure check**: verify the ADR contains interface definitions, state-transition table/diagram, lease contract, persistence contract, WorkerPool design, and migration sequence.

## Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| Memory `JobStore` loses disk persistence and breaks resume | ADR explicitly requires disk-backed `MemoryJobStore`; `resume.test.ts` is a required regression test for every PR. |
| `QueueAdapter` facade leaks internal adapter details or requires caller changes | Keep the existing interface method-for-method; change only the delegation implementation. Gate on >8 changed call sites. |
| Lease token validation is cross-cutting and breaks worker/CLI contract | Document the transition: phase 3 adds token validation with a compatibility mode that accepts old calls for one PR, then removes compatibility after CLI/worker are updated. |
| `WorkerPool` refactor overlaps with adapter split and causes merge conflicts | Implement WorkerPool after the facade is stable; keep the `workers === 0` branch until `ExternalWorkerPool` is ready. |
| Option A becomes too large for a single module/directory unit | Use the Option B fallback gate (time/churn/quality) and ship smaller incremental PRs. |
| Redis-specific behavior diverges from memory behavior | Add contract tests (`task-queue.test.ts`, `lease-store.test.ts`) that run against both backends where Redis is available, and against memory always. |
| Accidental source edits during ADR writing | Verify `git diff --name-only` before each review handoff; reject diffs outside docs/plan files. |
