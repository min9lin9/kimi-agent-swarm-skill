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

## How to Invoke This Skill

### Recommended: inside Kimi Code CLI TUI with `/swarm` mode

1. Start Kimi Code CLI interactively:
   ```bash
   cd <project>
   kimi
   ```
2. Activate swarm mode so the assistant treats the request as a delegation task:
   ```text
   /swarm
   ```
3. Request the skill with an objective and mode:
   ```text
   /skill:kimi-agent-swarm-cli "Compare open-source AI browser agent repos at light depth" mode=wide-search
   ```
   Or simply describe the wide-search task after `/swarm`; the skill file will be loaded automatically if it matches the request.

### Alternative: Kimi Code CLI TUI without `/swarm`

```text
/skill:kimi-agent-swarm-cli "Analyze global sell-side research roles" mode=wide-search
```

### Non-interactive (`kimi -p`) limitation

`kimi -p` runs a single prompt and may fail to invoke a non-inline skill through the `Skill` tool. If that happens, the model should read this file directly and follow the workflow manually. For reliable non-interactive wide-search, prefer running the local harness:

```bash
cd runtime/wide-search
bun run src/cli.ts run --profile fixture \
  --objective "Compare AI browser agent repos" \
  --work-dir ../../
```

## `/swarm` Mode vs. `AgentSwarm` Tool

- `/swarm` is a **Kimi Code CLI TUI slash command** that injects a system reminder encouraging parallel delegation. It must be entered by the user; a skill cannot programmatically activate it.
- `AgentSwarm` is the **built-in tool** that actually launches subagents. In `/swarm` mode, the assistant is more likely to choose `AgentSwarm` automatically.
- This skill bridges the two: it tells the assistant when to use `AgentSwarm`, how to design items, and what evidence to produce.

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
   - For `wide-search` in the TUI, first suggest `/swarm` to the user, then use the `AgentSwarm` tool with `explore` subagents. If the user already typed `/swarm`, skip the suggestion.
   - For `wide-search` outside the TUI, use `AgentSwarm` directly or fall back to the local `runtime/wide-search` harness.
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

## AgentSwarm Example: Asset Management Roles Research

For the objective `"자산운용사의 역할과 업무를 구조적으로 분석해줘"`, design the swarm like this:

```json
{
  "description": "Research asset management roles by functional area",
  "subagent_type": "explore",
  "prompt_template": "Research the following functional area in asset management: {{item}}. Return a structured summary with: (1) key roles and titles, (2) why each role exists, (3) core responsibilities and typical deliverables, (4) main collaboration partners, (5) common KPIs or success metrics, (6) caveats or regional variations. Be concise and evidence-based. Use WebSearch if needed.",
  "items": [
    "Front Office roles in asset management: PM, Analyst, Quant, Trader, Sales",
    "Middle Office roles in asset management: Risk, Compliance, Performance, Legal",
    "Back Office roles in asset management: Fund Accounting, Operations, Settlement, IT/Data",
    "Product and Client-facing roles: Product Manager, Client Service, IR, RFP, Marketing",
    "External ecosystem: custodian, fund administrator, distributor, auditor",
    "Firm-type differences: large综合운용사, boutique, ETF/index shop, alternative investment manager"
  ]
}
```

After the swarm returns, synthesize the subagent outputs into:

- a ranked role list or comparison table
- a handoff matrix across Front/Middle/Back Office
- a firm-type comparison
- source/claim ledgers if external sources were used

## AgentSwarm Example: Sell-Side Research Roles Research

For the objective `"글로벌 sell-side 리서치 조직의 역할과 업무를 분석해줘"`, design the swarm like this:

```json
{
  "description": "Research sell-side research organization roles",
  "subagent_type": "explore",
  "prompt_template": "Research the following role family in global sell-side research organizations: {{item}}. Return: (1) specific roles and titles, (2) mission and existence reason, (3) main task clusters and deliverables, (4) key stakeholders and handoffs, (5) frequency (universal/common/specialized), (6) caveats or firm-type variations. Use WebSearch if needed.",
  "items": [
    "Leadership and org design: Global Head, Regional Head, Sector Head, COO of Research",
    "Top-down research: Equity Strategy, Macro, FI/Credit, FX/Commodities, Quant/AA/Derivatives",
    "Bottom-up research: Sector Research, Company Coverage Analysts, Research Associates",
    "Research support infrastructure: Data, Modeling, Research Platform, Alternative Data",
    "Editorial and publishing: Editor, Production Coordinator, Publication Manager, Visualization",
    "Client and sales interface: Research Sales, Distribution, Corporate Access, Sales-Trading liaison",
    "Compliance and regulation: Research Compliance, Supervisory Analyst, Information Barrier Manager",
    "Specialized functions: ESG, Policy, Thematic, Multimedia, Expert Network, Survey"
  ]
}
```

## Safety Rules

- Prefer `/swarm` mode (when in the TUI) or `AgentSwarm` for parallel research; do not fake parallelism with sequential calls.
- If the user wants wide-search but `/swarm` is not active, suggest it explicitly before launching `AgentSwarm`.
- Do not satisfy a `wide-search` request with a single web search unless the user explicitly downgrades to `light`.
- Keep provider, JSONL, and adapter details out of the user-facing answer unless the user is configuring the harness.
- Use verifier output and local ledgers as the source of truth, not LLM summaries.
- For code-writing tasks, prefer interactive approval or a disposable worktree.
- Do not claim the skill can activate `/swarm` programmatically; only the user can type `/swarm` in the TUI.
