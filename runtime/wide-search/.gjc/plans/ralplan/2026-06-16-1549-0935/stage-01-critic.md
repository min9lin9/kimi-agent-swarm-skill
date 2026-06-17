# Critic Evaluation — Plan: Analysis & ADR for distributed/ Architecture Redesign

**Compact Verdict: ITERATE**

**Status:** The plan is directionally correct and well-aligned with the deep-interview spec, but it requires concrete revisions before implementation can begin. The main gaps are an under-specified persistence contract for the memory backend, a deferred worker-pool abstraction, and no measurable fallback gate for Option B.

## Summary

| Criterion | Assessment |
|---|---|
| Clarity | Good scope, principles, drivers, and phases. Missing explicit handling of the duplicated perTaskMaxResults calculation and lease-token semantics. |
| Verifiability | Strong baseline checks (119 tests, typecheck, lint, git diff only docs). ADR-level acceptance criteria could be sharper. |
| Completeness | Missing persistence contract for disk-backed resume, lease revocation details, and Option C integration. Option B fallback lacks a decision gate. |
| Big Picture | Aligns with the spec (document-first, preserve tests/CLI, module-level refactoring). Option A is the right destination but the migration path is under-specified. |
| Principle/Option Consistency | Option A supports adapter purity, single source of truth, and Redis-free testability. The runner/worker-boundary principle is only partly satisfied because Option C is deferred. Backward compatibility is at risk if the memory JobStore loses disk persistence. |
| Alternatives Depth | Options A, B, and C are listed, but Option B is not evaluated as a real incremental path and Option C is treated as optional rather than required. |
| Risk/Verification Rigor | Risk table is reasonable but mitigations are generic. No numeric trigger for fallback or concrete interface validation checklist. |

## Representative Implementation Tasks Simulated

1. **Extract shared perTaskMaxResults helper** — Straightforward refactor touching src/distributed/runner.ts and src/cli.ts handleWorker. The plan identifies the duplication as a driver but never schedules the fix or names the helper. The ADR should include it.

2. **Split QueueAdapter behind a compatibility facade** — Implementing Option A while keeping the existing QueueAdapter surface for callers is feasible. The critical test is tests/distributed/resume.test.ts: a fresh MemoryQueueAdapter instance must load the job from disk. If the new JobStore is purely in-memory, this test and real resume behavior break. The ADR must explicitly state that the memory JobStore remains disk-backed, or define an equivalent persistence contract.

3. **Introduce a lease token** — Adding claimLease/releaseLease with a unique token changes claimNextTask, completeTask, failTask, and the worker loop signature. It also affects external workers invoked via kasw worker. The plan mentions the missing lease contract but does not specify token validation semantics or how pollJobToCompletion will revoke stale leases. This is a large, cross-cutting change that should be modeled in the ADR before implementation.

## Required Fixes Before Approval

1. **Persistence contract**: State explicitly that the memory backend JobStore will remain disk-backed (or provide a migration path) so resume semantics and tests/distributed/resume.test.ts are preserved under Option A.

2. **Lease contract**: Define token-based lease semantics in the ADR: claimLease(taskId, workerId) -> token, completeTask(taskId, token), failTask(taskId, token), and how stale-task timeout revokes the token. If full validation is deferred, document the transition.

3. **Promote Option C**: Move the worker-pool abstraction from future enhancement to part of the target architecture. Include a WorkerPool interface and show how the CLI worker command becomes a thin wrapper around ExternalWorkerPool.runOnce(...). This closes the runner/worker boundary.

4. **Option B decision gate**: Add a measurable fallback trigger, e.g., if the facade PR changes more than N call sites or breaks more than M tests, escalate to Option B.

5. **Concrete ADR acceptance checklist**: Add criteria such as every public interface maps to a test file, every state transition appears in a sequence diagram or table, and the migration sequence preserves CLI flags.

## Verdict

**ITERATE** — Adopt Option A as the target architecture, but revise the ADR to include a compatibility facade, explicit disk-backed persistence for memory, a lease-token contract, a first-class worker-pool abstraction, and a measurable Option B fallback gate. Once these are documented, the plan can be approved for implementation.
