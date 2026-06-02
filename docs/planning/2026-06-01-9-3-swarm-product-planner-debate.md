# 9.3+ Swarm Product Planner Debate

Date: 2026-06-01

Goal: decide what must change for this repository to move from a `6.5/10` full swarm product to `9.3+`.

Context:

- Current strength: Codex-only skill, prompt refinement, safe Kimi-style routing, clear non-affiliation boundary, readable wide-search docs.
- Current gap: no built-in wide-search runtime, no benchmark pack, no distributed execution profile, no evidence-quality scoring in CI.
- Official Kimi context: Kimi docs describe hosted Agent Swarm as a large-scale agent product for 300+ sub-agents and 4000 parallel tool calls. Kimi Code CLI subagents are useful for local orchestration, but the CLI subagent model is not the same as hosted Agent Swarm.

## Round 1: What does 9.3+ mean?

Product Planner: A 9.3+ score means the user can run a real wide-search workflow, not just read a prompt template.

Research Planner: It must produce source coverage, ranked findings, and evidence files from an actual run.

Trust Planner: It must never imply hosted Kimi parity unless hosted Kimi Agent Swarm or an equivalent distributed system is actually used.

Decision: 9.3+ means verified wide-search product, not better docs.

## Round 2: Is Kimi CLI subagent orchestration enough?

Kimi Integration Planner: No. Kimi Code CLI subagents are good for local coding and focused research, but not enough to claim 300-agent search scale.

Infra Planner: CLI subagents can be one backend, but there must be an execution abstraction that can route to hosted Kimi, local runtime, or distributed workers.

Decision: Treat Kimi CLI as a supported execution profile, not the whole swarm product.

## Round 3: What is the minimum runtime?

Engineering Planner: The minimum runtime needs query planning, source collection, scoring, claim extraction, synthesis, and verification.

Research Planner: It also needs rejection reasons and duplicate handling.

Decision: Runtime MVP must include source and claim ledgers.

## Round 4: What makes search quality credible?

Search Quality Planner: Relevance, authority, freshness, diversity, dedupe, and unsupported-claim checks must be explicit and machine-checked.

UX Planner: The user should see a readable answer first, then evidence paths.

Decision: Quality score and readable output are both required.

## Round 5: What should benchmarks cover?

Research Planner: Use workloads that represent the user's stated ambition: YouTube niches, Paul Graham corpus, GitHub repo landscape, and market scan.

QA Planner: Include fixture providers so CI can run without paid APIs.

Decision: Benchmark pack must include fixtures and optional live profiles.

## Round 6: How should execution scale?

Infra Planner: Start local and resumable, then add distributed workers. Avoid pretending local runs equal hosted Agent Swarm.

Product Planner: Make scale profiles visible: `local`, `kimi-cli`, `hosted-kimi`, `distributed`.

Decision: Execution profile is part of every run report.

## Round 7: What is v0.3?

Engineering Planner: v0.3 should ship the minimal local wide-search runtime.

Product Planner: It should still feel like a skill to the user: `$kimi-agent-swarm-prompt` refines, then calls the runtime if available.

Decision: v0.3 is local runtime plus evidence files, not distributed scale.

## Round 8: What is v0.4?

QA Planner: v0.4 is benchmark and quality scoring.

Trust Planner: Public examples should include both successful and partially failed runs.

Decision: v0.4 proves the runtime with repeatable benchmark tasks.

## Round 9: What is v0.5?

Kimi Integration Planner: v0.5 should add hosted Kimi Agent Swarm handoff where available and Kimi CLI profile where appropriate.

Trust Planner: Handoff must record whether hosted Kimi, Kimi CLI, or local runtime was used.

Decision: v0.5 is execution routing, not a parity claim.

## Round 10: What is v1.0?

Infra Planner: v1.0 adds distributed workers, queueing, retries, caching, budgets, and resume.

Product Planner: v1.0 should expose a simple command and a readable report, not an operations console first.

Decision: v1.0 is the first plausible 9.3+ product candidate.

## Round 11: What must be avoided?

Trust Planner: Avoid claims like "same as Kimi Agent Swarm" unless the hosted feature is used.

Research Planner: Avoid unsourced summaries.

Engineering Planner: Avoid building UI before the runtime is credible.

Decision: Accuracy and auditability come before appearance.

## Round 12: Final Recommendation

Build in this order:

1. PRD for local wide-search runtime.
2. Benchmark spec for wide-search quality.
3. v0.3 implementation plan.
4. Minimal runtime implementation.
5. Benchmark fixtures and CI.
6. Hosted/distributed execution profiles.

Success condition:

- The project moves from "Codex prompt skill" to "Codex-triggered, evidence-backed wide-search product with honest execution profiles."
