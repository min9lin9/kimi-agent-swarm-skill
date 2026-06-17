# Distributed Refactor Handoff

## Status

**Implemented.** The distributed refactor has completed Phases 1–4 and the final ADR is in `docs/adr/2026-06-distributed-architecture.md`.

Historical planning artifacts remain in `.gjc/` for audit:

- Requirement spec: `.gjc/specs/deep-interview-kasw-distributed-refactor.md`
- Consensus plan: `.gjc/plans/ralplan/2026-06-16-1549-0935/stage-03-final.md`
- Architect review notes: `.gjc/plans/ralplan/2026-06-16-1549-0935/stage-03-architect.md`

## Start here

1. `docs/adr/2026-06-distributed-architecture.md` for the authoritative architecture description.
2. `docs/distributed-refactor-handoff.md` for routing and next steps.
3. `src/distributed/AGENTS.md` and `tests/distributed/AGENTS.md` for scoped code/test notes.

## What changed

- `src/distributed/job-store.ts` — `JobStore` (memory + Redis)
- `src/distributed/task-queue.ts` — `TaskQueue` (memory + Redis)
- `src/distributed/coordinator.ts` — `Coordinator` for external-worker polling
- `src/distributed/lease-store.ts` — `LeaseStore` (memory + Redis)
- `src/distributed/redis-client.ts` — shared `RedisConnection`
- `src/distributed/queue-adapter.ts` — `QueueAdapter` interface + `QueueAdapterFacade`
- `src/distributed/memory-adapter.ts` / `redis-adapter.ts` — thin facade wrappers
- `src/distributed/worker.ts` — `workerLoop`, `pollJobToCompletion`, task execution helpers
- `src/distributed/worker-pool.ts` — `WorkerPool`, `InProcessWorkerPool`, `ExternalWorkerPool`
- `src/distributed/job-status.ts` — `deriveJobStatus`
- `src/distributed/job-sizing.ts` — `computePerTaskMaxResults`
- `src/distributed/runner.ts` — simplified orchestration using `WorkerPool`
- `src/cli.ts` — `handleWorker` now uses `ExternalWorkerPool.runOnce`

## Verification

- `bun test`: 140 pass / 8 skip / 0 fail
- `bun run typecheck`: clean
- `bun run lint`: clean
- `bun test tests/distributed/resume.test.ts`: pass

## Follow-ups

See the ADR "Follow-ups" section. The most important are:

1. Phase 4 completion: make lease tokens required and remove compatibility mode.
2. Implement full `RedisLeaseStore.revokeStaleLeases` with lease-key scanning.
3. Promote `Coordinator` if more orchestration is added.
4. Decide whether to ignore `.gjc` runtime state in Biome config.
