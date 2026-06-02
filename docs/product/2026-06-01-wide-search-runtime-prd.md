# Wide-Search Runtime PRD

Date: 2026-06-01
Status: draft for v0.3
Owner: Codex skill maintainer

## 1. Problem

The current repository is strong as a Codex skill package, but weak as a full swarm product. `wide-search` is documented as a workflow, yet the repository does not include a runtime that can execute source discovery, classification, scoring, synthesis, and verification.

Users who ask for Kimi Agent Swarm-style research need more than a refined prompt. They need an auditable research run with readable conclusions and evidence files.

## 2. Objective

Ship a local wide-search runtime that can be invoked after `$kimi-agent-swarm-prompt` refines and approves a research task.

The runtime must:

- create a research plan
- collect or ingest source candidates
- score sources for relevance, authority, freshness, diversity, and extraction value
- extract claims and map them to source ids
- synthesize a readable report
- verify that important claims are supported
- produce machine-readable evidence files

## 3. Non-Goals

- Do not claim hosted Kimi Agent Swarm parity.
- Do not require 300 sub-agents for v0.3.
- Do not build a dashboard before the runtime is useful.
- Do not require paid search APIs for local smoke tests.
- Do not hide unsupported or stale claims inside prose.

## 4. Target Users

Primary:

- Codex users who want to turn rough research requests into structured, evidence-backed research runs.

Secondary:

- Developers building local search providers.
- Users who want a bridge between Codex prompt refinement and Kimi-style execution.

## 5. User Stories

1. As a user, I can ask for a broad search and approve a clear scope before execution.
2. As a user, I receive a readable answer first, not a raw source dump.
3. As a user, I can inspect source and claim evidence when I need to audit the answer.
4. As a maintainer, I can run fixture-backed smoke tests without network access.
5. As a maintainer, I can add a real search provider without changing the user-facing workflow.

## 6. Product Flow

```text
User request
  -> Codex skill prompt refinement
  -> approval card
  -> local wide-search runtime
  -> research plan
  -> source collection
  -> source scoring
  -> claim extraction
  -> synthesis report
  -> deterministic verification
  -> readable final answer with evidence paths
```

## 7. Execution Profiles

| Profile | v0.3 status | Purpose |
| --- | --- | --- |
| `fixture` | implemented | deterministic CI and smoke tests |
| `local-command` | implemented | adapter for user-provided source collectors |
| `kimi-cli` | planned | local Kimi Code CLI research handoff |
| `hosted-kimi` | future | hosted Kimi Agent Swarm handoff when available |
| `distributed` | future | high-scale worker pool for 9.3+ target |

## 8. Required Artifacts

Each run must create:

- `run.json`: run metadata, execution profile, status, timings
- `research-plan.json`: scope, query families, source targets, stop conditions
- `source-ledger.jsonl`: source candidates, scores, decisions, rejection reasons
- `claim-ledger.jsonl`: claims mapped to source ids
- `synthesis.md`: readable research answer
- `verification-report.json`: deterministic checks and status

## 9. Quality Requirements

The verifier must fail when:

- no accepted sources exist
- synthesis contains important claims without source ids
- time-sensitive claims lack date or freshness status
- duplicate source rate exceeds the approved threshold
- accepted source count is below the selected search depth requirement
- provider/runtime errors make coverage materially incomplete

The verifier may warn when:

- source diversity is weak
- some source dates are unknown but not material
- community sentiment is used and labeled as sentiment
- the run stopped due to an approved budget limit

## 10. UX Requirements

The final report must show:

- direct answer or recommendation
- top findings
- ranked shortlist or comparison table when relevant
- source coverage
- known gaps
- evidence file paths
- next human check

Provider, JSONL, adapter, queue, and retry details must stay out of the default user-facing answer unless the user asks for implementation details.

## 11. Success Metrics

v0.3 is successful when:

- `fixture` profile passes CI.
- `local-command` profile can ingest a JSONL fixture provider.
- a standard benchmark fixture produces source and claim ledgers.
- verifier catches unsupported claims in a negative fixture.
- README and skill docs tell users what they will get before showing advanced runtime details.

9.3+ product trajectory is credible when:

- benchmark suite covers broad search, corpus search, repo landscape, and market scan.
- live and fixture runs produce comparable evidence shapes.
- execution profile is visible in every run.
- distributed or hosted execution can exceed local runtime limits without changing the user workflow.

## 12. Assumptions

- The repository remains Codex-only.
- Hosted Kimi Agent Swarm access may not be scriptable in v0.3.
- Local CI must work without network access.
- Search quality is judged by evidence coverage and verification, not just number of tool calls.

## 13. Open Questions

- Should v0.3 runtime live under `runtime/`, `packages/runtime/`, or `search-swarm-plus/`?
- Should the first CLI be `npm run wide-search` or a script invoked only by the skill?
- Which live provider should be supported first after fixture and local-command profiles?
