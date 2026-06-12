# Roadmap

This roadmap tracks the path from Codex prompt skill to evidence-backed wide-search product.

## Current State: v0.3+ (post-migration)

Strengths:

- Kimi Code CLI skill using built-in `AgentSwarm` and subagents
- Bun + TypeScript wide-search runtime
- fixture, fixture-asset-mgmt, fixture-sellside-research, fixture-youtube-niche profiles
- local-command and web-search profiles
- mock + Serper providers
- source scorer with weighted scoring, domain authority, and freshness penalties
- verifier with duplicate, conflict, freshness, confidence, broken-reference, and coverage-gap checks
- usage metrics in `run.json`
- GitHub Actions quality gate passing

Limits:

- only 2 live providers (mock, serper)
- benchmark pack partially complete (3 of 6 planned fixtures)
- no single-entry CLI product (`bin/kasw`)
- no cost estimator or budget enforcement
- no replay / caching / distributed execution
- TUI `/swarm` usage not yet validated with real users

## Target: 9.8+ Repeatable Open Source Product

See [9.8+ Product Excellence Plan](product/9.8-plus-product-excellence-plan.md) for the full strategy.

North star metric: **Weekly Active Users running at least 3 wide-search runs (WAU3)**.

A 9.8+ product must provide:

- zero-config first run with mock provider
- transparent cost estimation and budget enforcement
- 5+ stable search providers
- complete benchmark suite with golden answers
- reproducible runs and replay
- shareable output formats (Markdown, JSON, CSV, Notion)
- community-driven provider registry
- distributed execution profile for large jobs
- reliable CI/CD and documentation

## Sequence

1. Product planning
   - [docs/planning/2026-06-01-9-3-swarm-product-planner-debate.md](planning/2026-06-01-9-3-swarm-product-planner-debate.md)
   - [docs/product/2026-06-01-wide-search-runtime-prd.md](product/2026-06-01-wide-search-runtime-prd.md)
   - [docs/product/2026-06-01-wide-search-benchmark-spec.md](product/2026-06-01-wide-search-benchmark-spec.md)
   - [docs/product/2026-06-01-v0.3-implementation-plan.md](product/2026-06-01-v0.3-implementation-plan.md)
   - [docs/product/9.8-plus-product-excellence-plan.md](product/9.8-plus-product-excellence-plan.md)
2. v0.2 hardening ✓
   - GitHub Actions quality gate
   - README and skill docs aligned around user-first wide-search
   - release checklist updated
3. v0.3 local runtime ✓
   - fixture profiles
   - local-command profile
   - source and claim ledgers
   - synthesis and verification
   - scorer and usage metrics
4. v0.4 benchmark pack (in progress)
   - YouTube niche fixture ✓
   - Paul Graham corpus fixture
   - GitHub repo landscape fixture
   - market scan fixture
5. v0.5 product packaging
   - single-entry CLI (`bin/kasw`)
   - first-run wizard
   - cost estimator and budget enforcement
   - Tavily + Brave + GitHub providers
6. v0.6-v0.8 scale & integrations
   - replay and caching
   - in-process then Redis-backed distributed queue
   - JSON/CSV/Notion export
   - benchmark scoring and leaderboards
7. v1.0 distributed profile
   - worker queue
   - retries and resume
   - caching and budgets
   - recorded/live benchmark reporting
   - community provider registry
