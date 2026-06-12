# Execution Modes

This skill supports four execution modes. Choose one before producing the approval card.

## `prompt-only`

Refine the user's request into a prompt contract and stop. No external execution.

Use when:
- The user only wants a better prompt.
- No runtime or search harness is available.
- The task is not yet ready for execution.

## `wide-search`

Run parallel research using Kimi Code CLI's `AgentSwarm` tool or `/swarm` mode.

Use when:
- The user needs many candidates, sources, or comparisons.
- Coverage, authority, freshness, or diversity matters.
- The answer must show evidence and audit paths.

Tools:
- `AgentSwarm` with `explore` subagents
- `WebSearch`, `FetchURL` for verification
- `Bash` to invoke `runtime/wide-search` harness if configured

## `kimi-code`

Use Kimi Code CLI's built-in subagents (`coder`, `explore`, `plan`) for local code work.

Use when:
- The task is about reading, editing, or refactoring code.
- No broad external research is needed.

## `hybrid`

Run `wide-search` first, then `kimi-code` after the refined result is approved.

Use when:
- The user needs market/landscape research before implementation.
- The implementation depends on research findings.

## Runtime Discovery

The local wide-search runtime lives under `runtime/wide-search` in this repository. If the skill is invoked from a different working directory, locate the runtime via:

1. `${KIMI_SKILL_DIR}/../../runtime/wide-search`
2. `runtime/wide-search` relative to the current working directory
3. The `KIMI_SWARM_HARNESS_DIR` environment variable

If no runtime is available, stop after producing the prompt contract and approval card.
