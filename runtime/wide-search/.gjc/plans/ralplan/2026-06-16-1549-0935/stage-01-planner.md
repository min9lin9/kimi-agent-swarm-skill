# Plan: Analysis & ADR for `distributed/` Architecture Redesign

## Summary
Produce a detailed, implementation-level analysis and ADR/design document for the `kimi-agent-swarm-cli` `distributed/` module. The document will map the current architecture, define target design principles, evaluate viable restructuring options, and provide a concrete migration path for the implementation phase. No source code changes are made in this phase.

## In Scope
- Full analysis of `src/distributed/*` (`runner.ts`, `queue-adapter.ts`, `memory-adapter.ts`, `redis-adapter.ts`, `task-splitter.ts`).
- Analysis of CLI integration in `src/cli.ts` (`--distributed`, `--workers`, `--queue-type`, `worker` command).
- Review of related tests in `tests/distributed/*`, fixtures, and configuration.
- ADR/design document containing principles, decision drivers, options, recommendation, interfaces, state model, error-handling strategy, and migration sequence.
- Preparation for architect/critic review.

## Out of Scope
- Any source code edits or refactors.
- Refactoring of non-distributed modules (`providers/`, `verifier.ts`, `leaderboard.ts`, etc.).
- Quantitative performance benchmarking targets.
- Committing or persisting artifacts under `.gjc/`.

## 3–5 Principles
1. **Adapter purity** — Adapters must expose only queue/job persistence and lease operations. Business logic (budget checks, scoring, claim extraction, task execution) belongs in runner/worker layers.
2. **Single source of truth for state** — Job and task status must be derived from one explicit state model, not recomputed independently in multiple files.
3. **Redis-free testability** — Every distributed execution path must be testable with in-memory/fake adapters; Redis remains an optional dependency and is not required in CI.
4. **Explicit runner/worker boundary** — Orchestration, worker lifecycle, and task execution must have clear ownership boundaries; the CLI `worker` command must not duplicate adapter setup logic.
5. **Backward-compatible surfaces by default** — Public CLI flags and existing test assertions continue to pass unless the ADR explicitly documents and justifies a breaking change.

## Top 3 Decision Drivers
1. **Adapter concern separation** — `QueueAdapter` currently mixes job persistence, task queueing, and running-set tracking. The memory adapter is file-backed and coupled to `workDir`, while the Redis adapter refreshes individual task keys inside `getJob`, leaking implementation details through the shared interface.
2. **Runner/worker responsibility overlap** — `runner.ts` contains adapter factory, metrics accumulation, task execution, in-process worker loop, external-worker polling, and main orchestration. The CLI `worker` command duplicates adapter instantiation and `perTaskMaxResults` calculation.
3. **State model and failure handling** — Job status is recomputed in both adapters via duplicated `updateJobStatus` logic. There is no explicit lease, heartbeat, or stale-task detection contract, making external worker failure modes fragile.

## Viable Options

### Option A: Three-layer adapter split with coordinator
Decompose `QueueAdapter` into three focused abstractions:
- `JobStore`: create, get, save `DistributedJob`.
- `TaskQueue`: enqueue, claimNext, complete, fail, count pending.
- `LeaseStore` / `RunningSet`: claim lease, renew heartbeat, release, detect stale workers.

A `Coordinator` composes these three adapters and owns the state machine.

**Pros**
- Clean separation of concerns; each adapter has a single reason to change.
- Easy to swap backends (memory, Redis, future SQLite/file) per concern.
- Unit testing requires only the adapter layer being tested.

**Cons**
- Larger refactor surface and more interfaces to introduce.
- CLI and runner must assemble multiple adapters, requiring a clear factory.

### Option B: Refined single `QueueAdapter` with explicit lease methods
Keep one `QueueAdapter` interface but:
- Remove file persistence from `MemoryQueueAdapter`; make it purely in-memory.
- Move persistence to a separate `JobRepository` or keep it in a dedicated adapter method.
- Add `claimLease(taskId, workerId)`, `releaseLease(...)`, and `heartbeat(...)` methods.
- Define atomicity expectations explicitly.

**Pros**
- Smaller public API surface than Option A.
- Easier incremental migration from current code.
- Existing tests can adapt with fewer import changes.

**Cons**
- Single interface still mixes queue, job store, and lease concerns.
- Harder to express Redis-specific optimizations without leaking into generic interface.

### Option C: Worker-pool-centric architecture with minimal queue
Introduce a `WorkerPool` abstraction that owns worker lifecycle:
- `InProcessWorkerPool` spawns `workers` loops internally.
- `ExternalWorkerPool` relies on CLI `worker` processes and a coordinator.
- `QueueAdapter` shrinks to job/task queue operations only.

**Pros**
- Runner/worker separation becomes explicit and testable.
- External workers are first-class citizens, not a special `workers === 0` branch.
- CLI `worker` command logic can move into the pool implementation.

**Cons**
- Adds a major new concept and lifecycle ownership questions.
- May overlap with Option A; best considered as a complement or follow-on.

## Recommended Approach for ADR
The ADR should evaluate **Option A** as the primary recommendation because it directly addresses all three decision drivers (adapter purity, state model, runner/worker boundary) while preserving testability. **Option B** should be retained as a fallback if the implementation phase reveals unexpectedly high churn at the CLI adapter-factory boundary. **Option C** should be evaluated as a future enhancement or as a refinement layer on top of Option A.

## Concrete Phases / Steps

### Phase 1: Baseline analysis (Day 1)
1. Read all `src/distributed/*` files, `src/cli.ts` worker/distributed sections, and `src/types.ts`.
2. Build a dependency/call graph of distributed components.
3. Inventory current responsibilities, duplicated logic, and hidden couplings.
4. Document how job/task status transitions currently work in memory vs. Redis.
5. Catalog existing test coverage and identify gaps (e.g., Redis-specific paths are skipped).

### Phase 2: Target architecture exploration (Day 1–2)
1. Define the principles and decision drivers above.
2. Draft interface sketches for each option.
3. Model the unified state machine for job and task statuses.
4. Evaluate each option against the decision drivers and constraints.
5. Decide recommended option and fallback.

### Phase 3: ADR writing (Day 2–3)
1. Write current-state assessment with code references.
2. Document principles, drivers, options, and recommendation.
3. Define detailed module structure and interfaces at implementation level.
4. Document error handling: retries, budget exceeded, stale-task/heartbeat, job disappearance.
5. Document CLI integration changes, if any, with breaking vs. non-breaking classification.
6. Write migration sequence in module/directory units for the implementation phase.

### Phase 4: Review and validation (Day 3–4)
1. Run full verification pipeline to confirm no accidental source changes.
2. Conduct self-review for internal consistency against existing tests and fixtures.
3. Submit ADR to architect/critic review.
4. Incorporate feedback and finalize.

## Testable Acceptance Criteria
1. Analysis document references every file in `src/distributed/*`, the distributed sections of `src/cli.ts`, and all `tests/distributed/*` files.
2. ADR contains 3–5 principles, top 3 decision drivers, and at least 2 viable options with bounded pros/cons.
3. ADR includes a clear recommendation and a justification that maps to the decision drivers.
4. ADR specifies concrete interface definitions and module structure at the implementation level.
5. ADR documents an explicit job/task state model with valid transitions.
6. The repository still passes all 119 existing tests with no source code changes (`bun test`).
7. `bun run typecheck` and `bun run lint` pass with no new errors.
8. Git diff shows changes only in documentation files (no source edits).
9. architect/critic review is completed and feedback is incorporated or explicitly deferred.

## Verification Steps
1. Before starting: run `bun test`, `bun run typecheck`, and `bun run lint` to establish baseline.
2. During analysis: periodically inspect `git diff --name-only` to ensure no source files are modified.
3. After ADR draft: run the full verification pipeline again (`bun test`, `bun run typecheck`, `bun run lint`).
4. Confirm `bun test` reports `119 pass / 8 skip / 0 fail` or equivalent.
5. Validate ADR structure against the acceptance criteria checklist.
6. Request architect/critic review and record review outcome.

## Risks and Mitigations
| Risk | Mitigation |
|------|------------|
| Scope creep into non-distributed modules | Time-box analysis to a few days; explicitly defer provider/verifier/leaderboard refactors to future phases. |
| Hidden coupling between runner and CLI | Produce a dependency graph and trace CLI-to-runner call paths; document any required CLI changes explicitly. |
| ADR recommends an option that is hard to implement incrementally | Define module/directory migration units in the ADR; keep Option B as fallback. |
| architect/critic review deadlocks | Provide structured review questions and decision-driver mappings; schedule review early. |
| Accidental source edits during analysis | Verify via `git diff` and CI-style checks before finalizing. |
