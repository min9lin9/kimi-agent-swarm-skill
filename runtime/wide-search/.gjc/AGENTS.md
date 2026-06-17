# GJC PLANNING STATE

## OVERVIEW

`.gjc` holds generated planning/spec state. It is the decision trail for Case B, not the
runtime artifact directory.

## SOURCE ORDER

| Priority | Path | Use |
| --- | --- | --- |
| 1 | `specs/deep-interview-kasw-distributed-refactor.md` | Requirements and constraints. |
| 2 | `plans/ralplan/2026-06-16-1549-0935/pending-approval.md` | Current human-facing final plan, pending approval. |
| 3 | `plans/ralplan/2026-06-16-1549-0935/stage-02-final.md` | Generated final snapshot; same content as pending approval. |
| 4 | `plans/ralplan/2026-06-16-1549-0935/stage-03-architect.md` | ADR cleanup notes only. |
| 5 | `state/active/*.json` | Status pointers; generated and potentially stale. |

## CURRENT CASE B FACTS

- Case B is this workspace: `/Users/burt/Documents/KimiProjects/kimi-agent-swarm-cli`.
- `pending-approval.md` and `stage-02-final.md` have the same observed SHA-256:
  `7ec5457272ebff434403f10149acc0d7221f3cb047d632f5cc255d1436b7c4ac`.
- `state/active/ralplan.json` says phase `final`, summary `persisted final stage 2`,
  and pending `approval`.
- `state/active/deep-interview.json` says phase `handoff`.

## DO NOT HAND-EDIT

- `state/**/*.json`
- `state/**/*.jsonl`
- `plans/**/index.jsonl`
- generated planner stage snapshots unless intentionally preserving a new generated result

## HISTORICAL ONLY

- `plans/ralplan/2026-06-16-1549-0935/stage-01-*`
- `plans/ralplan/2026-06-16-1549-0935/stage-02-planner.md`
- `plans/ralplan/2026-06-16-1549-0935/stage-02-architect.md`
- `plans/ralplan/2026-06-16-1549-0935/stage-02-critic.md`

## ADR CLEANUP ITEMS

Before implementation, tighten these from `stage-03-architect.md`:

- token lease lifecycle and compatibility transition duration
- `releaseLease` relationship to `completeTask` and `failTask`
- `ExternalWorkerPool.run` naming/semantics
- evidence for Option B fallback thresholds

## GOTCHAS

- "Case B" is the user's latest workspace case. It is not the RALPLAN "Option B" fallback.
- `.runs/wide-search/**` is runtime output, not `.gjc` planning state.
- Active-state receipts can expire; use the markdown artifacts for durable decisions.
