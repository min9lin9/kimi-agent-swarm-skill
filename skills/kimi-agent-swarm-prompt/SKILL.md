---
name: kimi-agent-swarm-prompt
description: Codex-only skill. Use when the user wants Codex to collaboratively refine an input with vendored prompt-engineering references, then route the approved prompt into a Kimi Agent Swarm-style, Kimi Code subagent, Search Swarm+, or OMK-lite workflow for research, wide search, planning, coding, review, or verification.
metadata:
  short-description: Codex-only Kimi swarm prompt workflow
---

# Kimi Agent Swarm Prompt

This is a **Codex-only skill**. Use it when a user wants Codex to turn a rough request into a high-quality prompt contract before using Kimi Agent Swarm-style execution.

This skill is unofficial. It is not affiliated with Moonshot AI, Kimi, or the upstream `treylom/prompt-engineering-skills` project.

## Mandatory Sequence

1. Use the bundled prompt-engineering references first.
   - Read `references/upstream-prompt-engineering.md`.
   - For research/search work, prefer `vendor/prompt-engineering-skills/skills/research-prompt-guide.md` and `context-engineering-collection.md`.
   - For implementation work, use prompt contracts with explicit scope, success criteria, evidence, and verification.
2. Classify the user request:
   - `prompt-only`: refine the prompt and stop.
   - `wide-search`: use Search Swarm+ for collection, classification, scoring, and synthesis.
   - `kimi-code`: use Kimi Code CLI root-agent/subagent assets for local code work.
   - `hybrid`: use wide-search first, then local code work after the refined result is approved.
3. Draft a prompt contract using `references/prompt-contract.md`.
4. Ask only blocking questions. If the missing detail is optional, state the safest assumption and continue.
5. Before executing Kimi or external/network-heavy tooling, show a short approval card unless the user already explicitly requested execution.
6. Run the selected workflow and report:
   - refined prompt contract
   - commands run
   - run ledger / transcript paths
   - verification result
   - unresolved risks or human checks

## Capability Boundary

Do not claim that a local harness equals hosted Kimi Agent Swarm performance. Hosted Swarm-level claims such as 300 subagents, 4000+ tool calls, or proprietary ranking behavior require hosted Kimi Agent Swarm or an explicitly provisioned distributed search system. The local workflow can approximate the pattern with flat subagents, adapters, relevance/authority/freshness scoring, ledgers, and deterministic verification.

## Execution Modes

Read `references/execution-modes.md` before running commands.

Default local Search Swarm+ harness:

`$KIMI_SWARM_HARNESS_DIR`

If the variable is not set, locate a directory containing `search-swarm-plus/package.json`. If no harness is available, stop after producing the prompt contract and approval card.

## Safety Rules

- Treat `kimi --print` as non-interactive automation with approval risk. Use it for read-only or sandboxed work only.
- For code-writing Kimi runs, prefer interactive approval or a disposable worktree.
- In Codex sandboxed sessions, Kimi may need escalation because it writes session/log data under `~/.kimi`.
- Never use hooks, MCP, or shell commands as the final proof. The verifier output and local ledgers are the source of truth.
