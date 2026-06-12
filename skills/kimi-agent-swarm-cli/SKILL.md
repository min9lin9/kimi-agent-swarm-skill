---
name: kimi-agent-swarm-cli
description: Kimi Code CLI skill for turning a rough request into a prompt contract, then running Kimi Agent Swarm-style parallel research using the built-in AgentSwarm tool and subagents.
type: flow
whenToUse: When the user wants to run wide research, compare many sources, or delegate parallel work inside Kimi Code CLI using AgentSwarm or subagents.
disableModelInvocation: false
arguments:
  - objective
  - mode
---

# Kimi Agent Swarm CLI Skill

Use this skill inside **Kimi Code CLI** to turn a rough request into a structured prompt contract and then execute it with Kimi Code CLI's native parallel agent tools.

This skill is unofficial and not affiliated with Moonshot AI or Kimi.

## Capability Boundary

This skill uses **Kimi Code CLI's built-in tools only** (`AgentSwarm`, `Agent`, `WebSearch`, `FetchURL`, `Read`, `Write`, `Bash`, etc.). It does **not** call the hosted Kimi Agent Swarm web/API service. Do not claim 300 subagents, 4000+ tool calls, or proprietary ranking behavior unless the user explicitly switches to hosted Kimi Agent Swarm.

Kimi Code CLI's `AgentSwarm` tool supports:

- up to **128 subagents per call**
- built-in subagent profiles: `coder`, `explore`, `plan`
- `prompt_template` with `{{item}}` placeholder
- `resume_agent_ids` to retry failed subagents
- the call must be the **only tool call** in the response

Read `references/agent-swarm-tool.md` before using `AgentSwarm`.

## Mandatory Sequence

1. **Classify the request**. Choose one of:
   - `prompt-only`: refine the prompt and stop.
   - `wide-search`: use AgentSwarm or `/swarm` mode for parallel source discovery, scoring, synthesis, and verification.
   - `kimi-code`: use Kimi Code CLI's built-in subagents (`coder`, `explore`, `plan`) for local code work.
   - `hybrid`: wide-search first, then local code work after the refined result is approved.

2. **Draft a prompt contract**. Use `references/prompt-contract.md`. For `wide-search` or `hybrid`, append the wide-search addendum from `references/wide-search-mode.md`.

3. **Ask only blocking questions**. If a missing detail is optional, state the safest assumption and continue.

4. **Show an approval card** before executing AgentSwarm, web searches, network-heavy commands, or write-capable code work, unless the user already explicitly approved execution.

5. **Execute the selected workflow**:
   - For `wide-search`, prefer activating `/swarm` mode or using the `AgentSwarm` tool directly with `explore` subagents.
   - For `kimi-code`, dispatch the appropriate built-in subagent (`coder`, `explore`, or `plan`).
   - For `hybrid`, run wide-search first and wait for approval before code changes.

6. **Report results**:
   - refined prompt contract
   - commands or tool calls used
   - readable answer first
   - evidence paths (source ledger, claim ledger, synthesis, verification)
   - unresolved risks or human checks

## Wide-Search Workflow in Kimi Code CLI

When the mode is `wide-search`:

1. Read `references/wide-search-mode.md`.
2. Define research scope, search depth (`light` / `standard` / `deep` / `maximum`), and output shape.
3. Build an `AgentSwarm` call with:
   - `description`: short summary of the whole swarm
   - `subagent_type`: usually `explore` for read-only research
   - `prompt_template`: a clear instruction containing `{{item}}`
   - `items`: distinct search angles, queries, or candidate groups
4. Run the swarm. Each subagent returns a summary; synthesize the summaries.
5. Optionally run `WebSearch`/`FetchURL` directly or through subagents to verify claims.
6. Write evidence files under `.runs/wide-search/<run-id>/`:
   - `run.json`
   - `research-plan.json`
   - `source-ledger.jsonl`
   - `claim-ledger.jsonl`
   - `synthesis.md`
   - `verification-report.json`

If the local `runtime/wide-search` harness is available, you may also invoke it via `Bash`:

```bash
cd runtime/wide-search
bun run src/cli.ts run --profile local-command \
  --provider-command <provider> --provider-args <args> \
  --objective "$objective" --work-dir <work-dir>
```

## Safety Rules

- Prefer `/swarm` mode or `AgentSwarm` for parallel research; do not fake parallelism with sequential calls.
- Do not satisfy a `wide-search` request with a single web search unless the user explicitly downgrades to `light`.
- Keep provider, JSONL, and adapter details out of the user-facing answer unless the user is configuring the harness.
- Use verifier output and local ledgers as the source of truth, not LLM summaries.
- For code-writing tasks, prefer interactive approval or a disposable worktree.
