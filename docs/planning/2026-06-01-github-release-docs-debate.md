# GitHub Release Documentation Debate

Date: 2026-06-01
Project: `min9lin9/kimi-agent-swarm-skill`
Question: What documentation is needed before public GitHub release?

## Planner Panel

- Product Planner: first impression and user promise.
- Developer Experience Planner: install, invocation, troubleshooting.
- Trust Planner: licensing, attribution, non-affiliation, safety.
- Distribution Planner: GitHub metadata, release flow, maintenance.

## Debate Summary

The README should remain the main public landing page, but it should not carry every operational detail. A separate `docs/GITHUB_RELEASE.md` should hold the release checklist, GitHub metadata, tag plan, and maintenance notes.

## Critical Discussion

### Round 1: Does the README already do enough?

Product Planner: It explains the product, but release operators need a checklist.

Developer Experience Planner: README should stay reader-facing. Push commands and tag steps belong in a release guide.

Trust Planner: License and third-party notices are present, but pre-push checks should be documented.

Distribution Planner: Add a GitHub release guide.

Decision: Keep README focused, add `docs/GITHUB_RELEASE.md`.

### Round 2: What should the first viewport say?

Product Planner: "Codex-only" must appear immediately.

Trust Planner: "Unofficial" and "not a hosted Kimi Agent Swarm clone" must be visible early.

Developer Experience Planner: The first command should be install or invocation, not architecture.

Decision: Current README structure is acceptable.

### Round 3: What public claims are safe?

Trust Planner: "Kimi Agent Swarm-style" is acceptable. "Same performance" is not.

Distribution Planner: Add explicit safe and unsafe claim lists in the release guide.

Product Planner: This protects the repo from overpromising.

Decision: Add Public Claims section.

### Round 4: What needs to be reproducible?

Developer Experience Planner: Install into temp `CODEX_HOME`.

Trust Planner: Check no local absolute paths.

Distribution Planner: Check YAML parse and clean git status.

Decision: Add pre-push checklist commands.

### Round 5: What is the release version?

Product Planner: `v0.1.0` is right for first public release.

Distribution Planner: Tag after push, not before auth is fixed.

Trust Planner: Release notes must repeat non-parity boundary.

Decision: Recommend `v0.1.0`.

## Documentation Set

Required for public release:

- `README.md`: user-facing landing page.
- `THIRD_PARTY_NOTICES.md`: upstream attribution and MIT notice.
- `LICENSE`: local repo license.
- `docs/GITHUB_RELEASE.md`: operator release checklist.
- `docs/planning/2026-06-01-github-release-docs-debate.md`: planning record.

## Final Recommendation

Proceed with public GitHub release only after:

1. GitHub auth for `min9lin9` is valid.
2. `docs/GITHUB_RELEASE.md` checks pass.
3. Working tree is clean.
4. README remains explicit about Codex-only, unofficial status, and no hosted Kimi Agent Swarm parity.

