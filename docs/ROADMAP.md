# Roadmap

This roadmap tracks the path from Codex prompt skill to evidence-backed wide-search product.

## Current State: v0.1

Strengths:

- Codex-only skill packaging
- prompt refinement before execution
- wide-search mode documentation
- third-party prompt-engineering references bundled with notices
- install and release checklists

Limits:

- no built-in wide-search runtime
- no benchmark pack
- no distributed execution profile
- no hosted Kimi Agent Swarm handoff

## Target: 9.3+ Full Swarm Product Candidate

A 9.3+ candidate must provide:

- executable wide-search runtime
- readable report first, audit files second
- source and claim ledgers
- relevance, authority, freshness, diversity, and dedupe checks
- deterministic verification
- fixture and recorded benchmarks
- visible execution profile
- honest non-parity boundary unless hosted Kimi Agent Swarm is actually used

## Sequence

1. Product planning
   - [docs/planning/2026-06-01-9-3-swarm-product-planner-debate.md](planning/2026-06-01-9-3-swarm-product-planner-debate.md)
   - [docs/product/2026-06-01-wide-search-runtime-prd.md](product/2026-06-01-wide-search-runtime-prd.md)
   - [docs/product/2026-06-01-wide-search-benchmark-spec.md](product/2026-06-01-wide-search-benchmark-spec.md)
   - [docs/product/2026-06-01-v0.3-implementation-plan.md](product/2026-06-01-v0.3-implementation-plan.md)
2. v0.2 hardening
   - GitHub Actions quality gate
   - README and skill docs aligned around user-first wide-search
   - release checklist updated
3. v0.3 local runtime
   - fixture profile: started
   - local-command profile: started
   - source and claim ledgers: started
   - synthesis and verification: started
4. v0.4 benchmark pack
   - YouTube niche fixture
   - Paul Graham corpus fixture
   - GitHub repo landscape fixture
   - market scan fixture
5. v0.5 execution routing
   - Kimi CLI handoff where useful
   - hosted Kimi Agent Swarm handoff if available
6. v1.0 distributed profile
   - worker queue
   - retries and resume
   - caching and budgets
   - recorded/live benchmark reporting
