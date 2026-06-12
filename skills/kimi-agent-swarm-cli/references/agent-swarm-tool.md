# AgentSwarm Tool in Kimi Code CLI

Kimi Code CLI exposes a built-in `AgentSwarm` tool that launches multiple subagents from one prompt template. Use it when many subagents should run the same kind of task over different inputs.

## When to Use

- Wide research across many queries or candidates
- Parallel review of multiple files or modules
- Batch generation or classification
- Any task that can be split into independent, similar subtasks

## Input Schema

```json
{
  "description": "Short description for the whole swarm.",
  "subagent_type": "explore",
  "prompt_template": "Research {{item}} and summarize findings.",
  "items": ["query A", "query B", "query C"],
  "resume_agent_ids": {}
}
```

### Fields

| Field | Required | Description |
| --- | --- | --- |
| `description` | yes | Short summary of the whole swarm. |
| `subagent_type` | no | Subagent profile: `coder`, `explore`, or `plan`. Defaults to `coder`. |
| `prompt_template` | yes when `items` provided | Template with exactly one `{{item}}` placeholder. |
| `items` | no | Values that replace `{{item}}`. Each launches one subagent. Max 128. |
| `resume_agent_ids` | no | Map of existing subagent `agent_id` to resume prompt. |

## Important Constraints

- **Max 128 subagents per call.**
- **The call must be the only tool call in the response.** Do not combine `AgentSwarm` with other tool calls in the same turn.
- Subagents are launched with throttled concurrency: the first 5 start immediately, then 1 more every ~700 ms while queued work remains.
- Each subagent runs in an isolated context and returns only its final summary to the parent agent.
- Built-in subagent profiles are limited to `coder`, `explore`, and `plan`.

## Example

```json
{
  "description": "Research AI browser agent open-source repos",
  "subagent_type": "explore",
  "prompt_template": "Research {{item}} for open-source AI browser agent projects. Report repo URL, license, maintenance signal, docs quality, ecosystem fit, and caveats.",
  "items": [
    "AI browser agent 2026",
    "open-source browser automation framework",
    "web agent LLM open source"
  ]
}
```

## Resuming Failed Subagents

If some subagents fail or time out, the result includes `agent_id` values. Use `resume_agent_ids` to continue them:

```json
{
  "description": "Resume unfinished research",
  "resume_agent_ids": {
    "agent-id-1": "continue",
    "agent-id-2": "continue with extra focus on license"
  }
}
```

## Combining with `/swarm` Mode

You can also activate Kimi Code CLI's `/swarm` slash command before running a wide task. `/swarm` injects a system reminder that encourages the model to delegate work to `AgentSwarm` automatically.

```text
/swarm Research AI browser agent open-source repos and compare them
```
