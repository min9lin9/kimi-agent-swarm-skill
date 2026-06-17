## Summary
The revised plan addresses the vast majority of the Stage 01 Architect and Critic feedback. It now explicitly preserves disk-backed resume semantics, defines a lease-token contract, promotes WorkerPool to first-class, extracts the duplicated perTaskMaxResults helper, and adds measurable Option B fallback gates. The plan is ready to guide ADR authorship, with minor ADR-level clarifications still to be tightened.

## Analysis
### Feedback addressed well
1. **Disk-backed resume semantics preserved** — The revised plan explicitly states the memory `JobStore` remains disk-backed, writing to `<workDir>/.runs/wide-search/jobs/<jobId>.json` and loading from disk on `getJob`. It directly references `tests/distributed/resume.test.ts` as a required regression test. This resolves the Stage 01 Architect HIGH finding and the Critic required fix #1.
2. **Lease-token contract defined** — The plan defines `claimLease(taskId, workerId, ttlMs) -> token`, `renewLease(token)`, `releaseLease(token)`, `completeTask(taskId, token, result)`, `failTask(taskId, token, error)`, and `revokeStaleLeases(ttlMs)`. Token validation is required and stale-task revocation is explicit. This resolves the Stage 01 Architect MEDIUM finding and the Critic required fix #2.
3. **WorkerPool promoted to first-class target architecture** — Option C is absorbed into Option A. The plan defines `WorkerPool`, `InProcessWorkerPool`, and `ExternalWorkerPool`, and documents the CLI `worker` command as a thin wrapper around `ExternalWorkerPool.runOnce(jobId, workerId)`. This resolves the Stage 01 Architect LOW/MEDIUM finding and the Critic required fix #3.
4. **Duplicated perTaskMaxResults calculation centralized** — `computePerTaskMaxResults(profile, searchDepth, taskCount)` is placed in `src/distributed/shared.ts` and called from both `runner.ts` and `src/cli.ts` `handleWorker`. This resolves the Stage 01 Architect MEDIUM finding and the Critic simulated task #1.
5. **QueueAdapter compatibility facade** — The plan keeps `QueueAdapter` as a thin facade over the new internal adapters in the first PR, preserving existing method signatures and caller imports. This was the core synthesis recommendation from the Stage 01 Architect review.
6. **Measurable Option B fallback gate** — Gates are now explicit: >8 changed non-test call sites, >3 failing existing tests (excluding Redis tests skipped in CI), or inability to complete the internal-split PR within a single module/directory unit. This resolves the Stage 01 Architect MEDIUM finding and the Critic required fix #4.
7. **Sharpened acceptance criteria** — 14 specific, testable criteria cover interface definitions, persistence contract, lease contract, WorkerPool design, state model diagram, migration sequence, and verification steps. This addresses the Critic required fix #5.

### Remaining gaps / new concerns
1. **LOW — Lease compatibility transition is under-specified.** The plan says Phase 3 will add token validation "with a compatibility mode that accepts old calls for one PR, then removes compatibility after CLI/worker are updated," but it does not define what that compatibility mode looks like (optional token? logged warning? no-op rejection?) or the exact duration of the transition. The ADR should make this explicit so implementers do not leave a long-term best-effort branch in place.
2. **LOW — `releaseLease` vs `completeTask`/`failTask` relationship is ambiguous.** The contract states `releaseLease(token)` "clears the lease and updates task status via `completeTask`/`failTask`," yet also defines `completeTask(taskId, token, result)` separately. This creates two possible paths to complete a task. The ADR should clarify whether `releaseLease` is only for abandonment/heartbeat failure and whether `completeTask`/`failTask` are the sole task-completion paths that internally release the lease.
3. **LOW — `ExternalWorkerPool.run` semantic mismatch.** The `WorkerPool` interface defines `run(job, options): Promise<DistributedJob>`, but `ExternalWorkerPool` does not actually execute tasks—it submits/polls an externally executed job. The naming may mislead implementers. The ADR should document that `run` in external mode means "submit and poll to completion" or consider a more precise name such as `runAndWait`.
4. **LOW — Option B fallback thresholds are not evidenced.** The thresholds (8 call sites, 3 tests) are reasonable heuristics but are not derived from a current codebase measurement. The ADR should either include the current count of `QueueAdapter` call sites to justify the threshold or frame the gate relative to the current state (e.g., >50% of call sites).

## Root Cause
The root cause identified in Stage 01 remains valid: the persistence, queueing, and coordination contracts were never explicitly separated, so each backend grew its own workaround inside the single `QueueAdapter` interface. The revised plan now supplies the explicit contract boundaries (`JobStore`, `TaskQueue`, `LeaseStore`), the unified state derivation (`deriveJobStatus`), the worker lifecycle abstraction (`WorkerPool`), and an incremental migration path (compatibility facade + fallback gates). This positions the team to fix the root cause rather than hide it.

## Findings
| # | Severity | Reference | Impact | Fix suggestion |
|---|----------|-----------|--------|----------------|
| 1 | LOW | Revised plan Phase 3, Risks table | Lease transition may leave an untimed compatibility shim or undocumented behavior. | In the ADR, define the compatibility mode precisely: optional token with deprecation log during Phase 3, required token from Phase 4 onward; include a test for the warning/rejection. |
| 2 | LOW | Revised plan Lease contract section | Two possible task-completion paths (`releaseLease` vs `completeTask`/`failTask`) can confuse implementers. | Clarify that `completeTask`/`failTask` are the only public completion paths and that they release the lease internally; `releaseLease` is for abandonment/revocation only. |
| 3 | LOW | Revised plan WorkerPool contract section | `run` implies execution, but external mode only polls. | Document semantics explicitly or rename external method to `runAndWait` / `waitForCompletion`. |
| 4 | LOW | Revised plan Option B fallback gate section | Thresholds are plausible but not grounded in current call-site counts. | Measure current `QueueAdapter` call sites and justify the 8-site threshold, or make the gate relative. |

## Recommendations
1. **Proceed with Option A as the target architecture.** The revised plan is sound and addresses the core architectural defects.
2. **Tighten lease semantics in the ADR** before implementation begins: define token lifecycle, compatibility transition, and the relationship between `releaseLease` and `completeTask`/`failTask`.
3. **Ground the Option B fallback thresholds** with current codebase measurements or relative criteria.
4. **Keep the `QueueAdapter` facade through at least the first implementation PR** and do not remove it until all callers are migrated and tested.
5. **Ensure the ADR includes concrete TypeScript interface definitions** for `JobStore`, `TaskQueue`, `LeaseStore`, `Coordinator`, `WorkerPool`, `InProcessWorkerPool`, and `ExternalWorkerPool` as required by acceptance criterion #4.

## Architectural Status
WATCH

## Code Review Recommendation
COMMENT

## Trade-offs
| Concern | Revised Option A (facade + internal split) | Option B fallback |
|---|---|---|
| Separation of concerns | Strong; each adapter has one reason to change. | Weaker; queue/job/lease concerns remain mixed. |
| Migration risk | Managed by compatibility facade and measurable fallback gates. | Lower churn but perpetuates the current design. |
| Resume/test continuity | Preserved via disk-backed `JobStore` and facade. | Preserved with fewer interface changes. |
| Lease safety | Strong token contract and stale-lease revocation. | Token contract added to single interface. |
| Implementation size | Larger ADR and initial PR. | Smaller initial PR, more deferred cleanup. |

## Synthesis
The revised Planner plan is a substantial improvement over Stage 01. It adopts the key synthesis from the first Architect review (Option A behind a compatibility facade), incorporates every Critic-required fix (persistence contract, lease contract, WorkerPool promotion, fallback gate, sharpened acceptance criteria), and keeps the plan aligned with the deep-interview spec (document-first, preserve tests/CLI, module-level refactoring). The remaining issues are minor ADR-level clarifications rather than architectural blockers. The plan can move forward to ADR authorship with the LOW findings noted above addressed in the ADR text.
