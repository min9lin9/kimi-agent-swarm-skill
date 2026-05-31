# GitHub Release Planner Debate

Date: 2026-05-31
Project: `min9lin9/kimi-agent-swarm-skill`
Release intent: public GitHub repository for a Codex-only Kimi swarm prompt skill.

## Decision Summary

The repo should be published as a focused Codex skill package, not as a broad agent framework. The README needs to make three things obvious in the first viewport:

1. This is **Codex-only**.
2. It refines user intent into a prompt contract before routing to Kimi/Search Swarm-style workflows.
3. It bundles a curated MIT-licensed snapshot of `treylom/prompt-engineering-skills` with attribution.

The current README is a good scaffold, but it should be upgraded before public release with clearer install paths, a "what happens when I invoke it" flow, capability boundaries, and a repo map.

## Planner Roles

- Product Planner: positioning, first-time reader clarity, value proposition.
- Developer Experience Planner: install, usage, repo structure, copy-paste commands.
- Trust and Licensing Planner: attribution, license, public disclaimers, safety boundary.
- Distribution Planner: GitHub repo defaults, topics, release checklist, future maintenance.

## Critical Debate

### Round 1: What is the public promise?

Product Planner: The promise should be "Codex turns rough intent into a high-quality prompt contract and routes it to Kimi-style workflows."

Developer Experience Planner: Avoid saying "agent swarm implementation" too early. Users need to understand how to install and invoke it.

Trust and Licensing Planner: Do not imply affiliation with Kimi or upstream prompt-engineering-skills.

Distribution Planner: The GitHub description should be short: "Codex-only skill for Kimi swarm-style prompt refinement and verified workflow routing."

Decision: Lead with Codex-only prompt workflow, not Kimi parity.

### Round 2: Should Search Swarm+ be included?

Product Planner: Not in this repo. It would make the package look like a full runtime.

Developer Experience Planner: The skill can support it through `KIMI_SWARM_HARNESS_DIR`, but the skill repo should remain self-contained.

Trust and Licensing Planner: Keeping runtime separate reduces support and security scope.

Distribution Planner: Link to Search Swarm+ later if it becomes public.

Decision: Keep Search Swarm+ optional. Document the environment variable and graceful fallback.

### Round 3: How much upstream prompt-engineering-skills should be bundled?

Product Planner: Bundle only what improves this skill.

Developer Experience Planner: A curated subset keeps install small and self-contained.

Trust and Licensing Planner: MIT license allows redistribution, but the notice must be prominent.

Distribution Planner: Include snapshot commit and sync script.

Decision: Keep curated vendored subset inside the skill folder so Codex install remains self-contained.

### Round 4: What should README contain?

Product Planner: A strong "What it does" section and usage examples.

Developer Experience Planner: Install commands, invocation examples, optional harness config, and troubleshooting.

Trust and Licensing Planner: License, third-party notices, non-affiliation, parity boundary.

Distribution Planner: Repo map, release checklist, GitHub topics.

Decision: README should be upgraded into a complete first-run guide.

### Round 5: What should be avoided?

Product Planner: Avoid "same as Kimi Agent Swarm."

Developer Experience Planner: Avoid assuming the user's local path.

Trust and Licensing Planner: Avoid hiding upstream references inside vague language.

Distribution Planner: Avoid publishing without checking installation from a clean temp directory.

Decision: The release must be explicit, conservative, and reproducible.

### Round 6: What is missing now?

Product Planner: A clearer value proposition in the first 10 lines.

Developer Experience Planner: A "Workflow" diagram or step list.

Trust and Licensing Planner: More direct "Third-party content included" section.

Distribution Planner: GitHub metadata suggestions and release checklist.

Decision: Add or revise README sections before pushing.

### Round 7: What should the repo root include?

Developer Experience Planner: `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `scripts/`, `skills/`.

Trust and Licensing Planner: Keep upstream license inside vendor path and root notice file.

Distribution Planner: Optional `.github/` can wait. No Actions needed for v0.

Decision: Current root structure is adequate for v0.

### Round 8: What should first public release be called?

Product Planner: `v0.1.0` is appropriate.

Developer Experience Planner: The package is usable but not a broad runtime.

Trust and Licensing Planner: Version should signal early release.

Distribution Planner: Tag after push, once README is polished.

Decision: Use `v0.1.0` after first public push.

## Recommended README Structure

1. Title and one-line Codex-only description.
2. Status badges or plain status line.
3. What it does.
4. What it is not.
5. Install for Codex.
6. Use in Codex.
7. Workflow.
8. Optional Search Swarm+ harness.
9. Repo structure.
10. Third-party prompt engineering references.
11. Safety and capability boundary.
12. Release checklist.
13. License.

## Recommended GitHub Metadata

Description:

`Codex-only skill for Kimi swarm-style prompt refinement and verified workflow routing.`

Topics:

- `codex`
- `codex-skill`
- `kimi`
- `prompt-engineering`
- `agent-workflows`
- `research-agent`
- `ai-agents`

Visibility:

- Public

Default branch:

- `main`

Initial release:

- `v0.1.0`

## README Upgrade Tasks

1. Rewrite top section to state "Codex-only" immediately.
2. Add a concise workflow section:
   - user rough input
   - prompt-engineering refinement
   - prompt contract
   - approval card
   - optional Kimi/Search Swarm execution
   - evidence report
3. Add "What this is not":
   - not hosted Kimi Agent Swarm
   - not a Moonshot/Kimi project
   - not a Claude/GPTs/Gemini skill pack
4. Add clean install commands.
5. Add three usage examples:
   - prompt-only
   - wide-search
   - hybrid research then code
6. Add optional harness configuration with `KIMI_SWARM_HARNESS_DIR`.
7. Add self-contained vendored reference explanation.
8. Add troubleshooting:
   - no harness found
   - Kimi CLI auth/session writes
   - stale model claims
9. Add GitHub release checklist.

## Release Gate

Before pushing public:

- No local absolute paths in repo.
- `openai.yaml` parses as YAML.
- `scripts/install-codex-skill.sh` installs into temp `CODEX_HOME`.
- `THIRD_PARTY_NOTICES.md` names upstream repo, license, commit, and included files.
- README clearly says Codex-only and unofficial.
- Local git repo has clean working tree after commit.
- GitHub authentication is valid for `min9lin9`.

## Final Recommendation

Do not push immediately with the current README. Upgrade the README first, then publish. The package is structurally ready, but public-facing documentation should be stronger because this repo's value is mostly workflow clarity and trust boundaries.

