## Compact Verdict

**Architectural Status:** `WATCH`
**Code Review Recommendation:** `REQUEST CHANGES`

The plan is directionally correct and well-scoped to the spec, but it needs revisions before it can be approved for implementation. The primary risk is that the recommended three-layer adapter split (Option A) does not explicitly preserve the disk-backed resume semantics that existing tests depend on, and it leaves the runner/worker boundary incomplete by deferring the worker-pool abstraction (Option C) to a future phase.

---

## Summary

The Planner plan correctly diagnoses the three main problems in `src/distributed/*`: (1) `QueueAdapter` mixes queue, job-store, and running-set concerns; (2) `runner.ts` and `src/cli.ts` duplicate adapter setup and `perTaskMaxResults` calculation; and (3) job status is recomputed in two places with no explicit lease/heartbeat contract. The proposed Option A (JobStore + TaskQueue + LeaseStore + Coordinator) is a sound long-term target architecture.

However, the plan under-specifies the migration boundary. It treats Option B (a refined single `QueueAdapter`) as a fallback without explicit decision gates, defers Option C (worker-pool abstraction) even though it is required to eliminate CLI worker duplication, and does not commit to preserving the on-disk persistence behavior that `tests/distributed/resume.test.ts` exercises. These gaps create implementation risk and could violate the `Backward-compatible surfaces` principle.

---

## Analysis

### Current-state evidence

1. **Adapter concern leakage is real.**
   - `MemoryQueueAdapter` (`src/distributed/memory-adapter.ts`) stores jobs in a private `Map` and serializes them to `<workDir>/.runs/wide-search/jobs/<jobId>.json` via `saveJob`. File I/O is not a queue/lease concern.
   - `RedisQueueAdapter` (`src/distributed/redis-adapter.ts`) refreshes every task from its own Redis key inside `getJob` to avoid read-modify-write races. This is a backend-specific optimization leaking through the shared interface.
   - Both adapters contain an identical `updateJobStatus` helper, so the job-status truth is recomputed independently in two files (`src/distributed/memory-adapter.ts`, `src/distributed/redis-adapter.ts`).

2. **Runner/worker boundary is blurred.**
   - `runner.ts` contains adapter factory (`createQueueAdapter`), task execution (`executeTask`), in-process worker loop (`workerLoop`), external-worker polling (`pollJobToCompletion`), and main orchestration (`runDistributedWideSearch`).
   - `src/cli.ts` `handleWorker` duplicates adapter instantiation, job lookup, and `perTaskMaxResults` calculation (`Math.ceil(maxResultsForDepth(job.searchDepth) / job.tasks.length)`), which is also computed in `runDistributedWideSearch`.

3. **Lease/heartbeat contract is missing.**
   - `pollJobToCompletion` marks tasks as failed after `taskTimeoutMs`, but there is no lease revocation. An external worker that was processing the task can still call `completeTask` after the timeout, because the task key is not protected by a lease token.
   - `workerLoop` exits only when `pending === 0 && running === 0`. With the current Redis implementation a stale-task timeout will requeue the task and decrement the running count, so the loop can finish, but the semantics are implicit rather than explicit.

4. **Resume semantics depend on disk persistence.**
   - `tests/distributed/resume.test.ts` creates a job with one `MemoryQueueAdapter` instance, completes a task, then instantiates a *fresh* `MemoryQueueAdapter({ workDir })` and reads the job back. This test only passes because `MemoryQueueAdapter` falls back to `readFile` when the job is not in its in-memory `Map`.
   - If Option A removes file persistence from the memory adapter without an explicit `JobStore` that preserves disk semantics, this test will fail.

### Spec compliance

The plan aligns with the deep-interview spec on scope (document-only, no code changes), constraints (preserve 119 tests, preserve CLI flags, Bun/TS), and deliverables (analysis + ADR with interfaces and implementation detail). It satisfies the acceptance criteria for the planning phase except for the gaps noted below.

---

## Root Cause

The root cause is not simply `the adapter interface is too big`. It is that **the persistence, queueing, and coordination contracts were never explicitly separated**, so each implementation grew its own workaround:

- Memory solved `resume across processes` by writing JSON to disk inside the queue adapter.
- Redis solved `racy task reads` by refreshing individual task keys inside `getJob`.
- The runner solved `external worker lifecycle` by branching on `workers === 0` and polling the job object directly.

Because these workarounds live inside the same interface, the duplicated state logic (`updateJobStatus`) and the duplicated CLI setup became inevitable. A clean architecture requires separating the contracts first, then moving the workarounds to the layer that actually owns them (persistence -> `JobStore`, atomic claim -> `TaskQueue`+`LeaseStore`, lifecycle -> `Coordinator`/`WorkerPool`).

---

## Findings

### 1. HIGH — Disk-backed resume semantics are not explicitly preserved in Option A
- **Severity:** HIGH
- **Reference:** `tests/distributed/resume.test.ts`, `src/distributed/memory-adapter.ts` `getJob`/`saveJob`
- **Impact:** Implementing Option A naively will break the existing resume test and any real-world scenario where a fresh process resumes a memory-queue job.
- **Fix suggestion:** In the ADR, state that the `JobStore` for the memory backend *will* remain disk-backed (or define an equivalent persistence contract), and show how a fresh `JobStore` instance can load a previously saved job. Do not assume `memory` means `purely in-memory`.

### 2. MEDIUM — `perTaskMaxResults` calculation is duplicated between runner and CLI worker
- **Severity:** MEDIUM
- **Reference:** `src/distributed/runner.ts` `runDistributedWideSearch`, `src/cli.ts` `handleWorker`
- **Impact:** A future change to result allocation (e.g., per-query weighting) must be edited in two places; divergence will cause external workers to use a different `maxResults` than in-process workers.
- **Fix suggestion:** Move the calculation into a shared pure function such as `computePerTaskMaxResults(profile, searchDepth, taskCount)` in `src/distributed/shared.ts` (or similar), and call it from both the runner and the CLI worker command.

### 3. MEDIUM — Stale-task timeout lacks lease revocation
- **Severity:** MEDIUM
- **Reference:** `src/distributed/runner.ts` `pollJobToCompletion`, `src/distributed/redis-adapter.ts` `completeTask`, `src/distributed/memory-adapter.ts` `completeTask`
- **Impact:** A task that exceeds `taskTimeoutMs` is marked failed and requeued, but an external worker that holds the old task reference can still complete it. This corrupts job status and metrics.
- **Fix suggestion:** Define a lease contract with a unique lease token per claim. `completeTask` must validate the lease token (or check that the task is still assigned to the calling worker). Document this explicitly in the ADR even if full revocation is deferred.

### 4. MEDIUM — Option B fallback has no decision gate
- **Severity:** MEDIUM
- **Reference:** Planner plan, `Viable Options` section
- **Impact:** Without a measurable threshold, the team may fall back to Option B simply because Option A feels like too much work, perpetuating the mixed-concern interface.
- **Fix suggestion:** Add a decision gate: `If the adapter-factory changes touch more than N call sites or require changes to public CLI flags, escalate to Option B.` Better yet, start with a thin `QueueAdapter` facade over the three new adapters so callers do not change at all.

### 5. LOW/MEDIUM — Option C is deferred even though it is needed to close the runner/worker boundary
- **Severity:** LOW/MEDIUM
- **Reference:** Planner plan, `Recommended Approach for ADR`
- **Impact:** The primary recommendation leaves the CLI `worker` command duplicating adapter setup and `perTaskMaxResults` logic. Deferring the worker-pool abstraction means the `Explicit runner/worker boundary` principle is only half-satisfied.
- **Fix suggestion:** Promote Option C from `future enhancement` to part of the target architecture in Phase 2. Define a `WorkerPool` interface with `InProcessWorkerPool` and `ExternalWorkerPool` implementations, and show how the CLI `worker` command becomes a thin wrapper around `ExternalWorkerPool.executeWorker(...)`.

---

## Recommendations

1. **Keep Option A as the target architecture**, but add a `QueueAdapter` facade/bridge in the first implementation PR so existing callers (`runner.ts`, CLI, tests) do not have to change immediately. This preserves backward compatibility while the internals are split.
2. **Explicitly preserve disk-backed `JobStore` semantics for the memory backend** in the ADR, and show the resume test continuing to pass.
3. **Extract `computePerTaskMaxResults`** into a shared module and update both `runner.ts` and `src/cli.ts` `handleWorker` to use it. This is a small, safe refactor that can be done before the larger adapter split.
4. **Define the lease contract in the ADR**: `claimLease(taskId, workerId, token, ttl)`, `renewLease(token)`, `releaseLease(token)`, and require the token for `completeTask`/`failTask`. If full token validation is too large for the first phase, document the planned transition.
5. **Promote Option C** to the target architecture (not future work) and include a `WorkerPool` interface in the ADR. Show how the CLI `worker` command will be reduced to argument parsing + `ExternalWorkerPool.runOnce(...)`.
6. **Add an explicit Option B fallback gate** based on measured churn (e.g., number of changed call sites, failing tests after the facade PR).

---

## Trade-offs

| Concern | Option A (three-layer split + coordinator) | Option B (refined single QueueAdapter) |
|---|---|---|
| Separation of concerns | Strong — each adapter has one reason to change. | Weak — queue, job store, and lease still mixed. |
| Migration risk | Higher — more interfaces and a new factory. | Lower — fewer import and test changes. |
| Redis-specific optimizations | Can live in `LeaseStore`/`TaskQueue` without leaking. | Tend to leak back into the generic interface. |
| External worker first-class | Requires Option C (worker pool) to fully realize. | Still possible, but boundary remains fuzzy. |
| Backward compatibility | Needs a facade/bridge and explicit persistence contract. | Easier to keep existing `QueueAdapter` surface. |

The real tension is **adapter purity vs. incremental migration safety**. A three-layer split is the right destination, but the plan must show a concrete, compatibility-preserving path to get there.

---

## Strongest Steelman Antithesis

The best argument against Option A is that it is premature abstraction for a working CLI.

The system already passes 119 tests, supports both in-process and external workers, and has a Redis backend that is optional in CI. The actual defects are small and localized:

- `updateJobStatus` is duplicated -> extract a shared pure function.
- `perTaskMaxResults` is duplicated -> extract a shared helper.
- Memory adapter does file I/O -> rename it to `FileBackedMemoryQueueAdapter` or move the file logic into a small `JobRepository` that still exposes the same `QueueAdapter` interface.
- External worker setup is duplicated -> extract a `createWorkerAdapter(options, workDir)` factory.

A minimal Option B plus targeted extractions would fix the pain points in one or two PRs without introducing a `Coordinator`, three new interfaces, and a worker-pool abstraction. The added layers of Option A create more code to maintain, more tests to write, and more cognitive overhead for future contributors who just want to add a queue backend.

This antithesis is strongest if the team values `works and is simple` over `theoretically clean`. It is weakest if the real goal is to make Redis, SQLite, or cloud queue backends trivial to add later.

---

## Synthesis / Recommended Changes

I recommend adopting **Option A as the documented target architecture** but implementing it through a compatibility-preserving facade:

1. **Internal split**: introduce `JobStore`, `TaskQueue`, and `LeaseStore` interfaces (or equivalent) inside `src/distributed/`.
2. **External stability**: keep `QueueAdapter` as a thin facade over the three internal adapters in the first PR. Existing callers and tests continue to compile and pass.
3. **Persistence contract**: the memory `JobStore` remains disk-backed so resume semantics are preserved.
4. **Lease contract**: define it in the ADR and implement token validation in `claimNextTask`/`completeTask`/`failTask`.
5. **Worker pool**: include `WorkerPool` in the target architecture so the CLI `worker` command stops duplicating setup logic.
6. **Decision gate**: if the facade PR requires changes to more than a handful of call sites, escalate to Option B.

This synthesis captures the architectural benefit of Option A while mitigating its migration risk.

---

## Principle Violations Flagged

1. **Current code violates `Adapter purity`**
   - `MemoryQueueAdapter` writes job JSON to disk inside the queue adapter.
   - `RedisQueueAdapter` refreshes task keys inside `getJob` to work around racy reads.
   - These are correctly identified in the plan and should be resolved by Option A.

2. **Current code violates `Single source of truth for state`**
   - `updateJobStatus` is duplicated in both adapters.
   - The plan identifies this; fix by centralizing state derivation in the `Coordinator` or a shared pure function.

3. **Plan risks violating `Backward-compatible surfaces by default`**
   - Option A as currently described could remove disk persistence from the memory backend, breaking `tests/distributed/resume.test.ts` and real resume behavior.
   - Fix: explicitly commit to a disk-backed `JobStore` for memory mode, or define a compatibility-preserving migration.

4. **Plan partially violates `Explicit runner/worker boundary`**
   - Deferring Option C means the CLI `worker` command continues to duplicate adapter setup and `perTaskMaxResults` calculation.
   - Fix: promote `WorkerPool` to the target architecture, not a future enhancement.

---

## Architectural Status

`WATCH`

## Code Review Recommendation

`REQUEST CHANGES`
