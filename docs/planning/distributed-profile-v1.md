# Distributed Wide-Search Profile v1.0 — Design Draft

## Goal

Enable `wide-search` to run across multiple workers when a single machine or a single `AgentSwarm` call cannot finish the job within time, cost, or concurrency limits. The v1.0 distributed profile targets hosted Kimi Agent Swarm parity in **pattern**, not in proprietary ranking or scale claims.

## Non-Goals

- Do not claim 300 subagents / 4000+ tool calls unless the backend actually supports it.
- Do not replace Kimi Code CLI's built-in `AgentSwarm`; complement it for jobs that exceed one call.
- Do not build a general-purpose multi-agent runtime; stay focused on the wide-search pipeline.

## When to Use

| Trigger | Example |
|---|---|
| Objective needs > 128 parallel angles | "Map every open-source LLM inference engine" |
| Estimated runtime > 10 minutes per stage | Deep corpus analysis across languages |
| Need geographic or provider diversity | Search from multiple regions/data sources |
| Need fault isolation | Some subagents are expected to fail or time out |

## Architecture

```text
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Planner   │────▶│  Task Queue  │────▶│  Worker Pool    │
│  (1 agent)  │     │              │     │  (N workers)    │
└──────────────┘     └──────────────┘     └─────────────────┘
       │                                          │
       │                                          ▼
       │                                ┌─────────────────┐
       │                                │  Result Store   │
       │                                │  (JSONL/DB)     │
       │                                └─────────────────┘
       │                                          │
       ▼                                          ▼
┌──────────────┐                       ┌─────────────────┐
│ Synthesizer  │◀──────────────────────│  Aggregator     │
│  (1 agent)   │                       │                 │
└──────────────┘                       └─────────────────┘
```

### Components

1. **Planner**
   - Receives the prompt contract.
   - Breaks the objective into independent task groups.
   - Assigns each group a query family, source target, and stop condition.
   - Estimates token/subagent budget.

2. **Task Queue**
   - In-memory queue for v1.0 MVP; later backed by Redis/SQS.
   - Tasks are idempotent and self-describing.
   - Retry metadata: `maxAttempts`, `backoffMs`, `timeoutMs`.

3. **Worker Pool**
   - Each worker is either:
     - a local process/thread, or
     - a remote function/edge endpoint.
   - Workers call the same `SearchProvider` interface used by `web-search`.
   - Workers do not synthesize; they return raw sources/claims.

4. **Result Store**
   - Append-only JSONL per task group.
   - Stores source candidates, worker logs, and errors.

5. **Aggregator**
   - Merges results, deduplicates sources, normalizes claim ids.
   - Runs the existing `scoreSource()` and `verifyRun()` logic.

6. **Synthesizer**
   - Produces readable synthesis from accepted sources and claims.
   - Writes the same evidence files as the local runtime.

## Task Unit

```ts
interface DistributedTask {
  taskId: string;
  runId: string;
  queryFamily: string;
  objective: string;
  searchDepth: SearchDepth;
  providerName: string;
  maxResults: number;
  attempt: number;
  maxAttempts: number;
}
```

## Worker Responsibilities

- Fetch sources via the configured provider.
- Score and accept/reject sources locally.
- Extract claims.
- Return a partial ledger.
- Report `UsageMetrics` per task.

## Retry and Resume

- Failed tasks are re-queued with exponential backoff.
- A run can be resumed by reading the result store and re-queuing incomplete tasks.
- Resume key: `runId`.

## Caching

- Cache provider responses by `(providerName, query, depth)` with a TTL.
- Default TTL: 1 hour for `light`, 6 hours for `standard`, 24 hours for `deep`.
- Cache invalidation is manual in v1.0.

## Budgets

| Budget | Default | Behavior on exceed |
|---|---|---|
| maxSubagents | 128 per swarm call | Spawn next worker batch |
| maxProviderCalls | 100 | Pause and ask for approval |
| maxTokensEstimate | 1,000,000 | Pause and ask for approval |
| maxRuntimeMs | 600,000 (10 min) | Fail remaining tasks |
| maxCostUsd | 5.00 | Pause and ask for approval |

## Implementation Path

1. **v0.6** — Worker queue abstraction in-process.
2. **v0.7** — Redis-backed queue and multi-process workers.
3. **v0.8** — Resume and caching.
4. **v0.9** — Budget enforcement and cost tracking.
5. **v1.0** — Distributed worker pool (remote functions or containers) + recorded benchmark reporting.

## Open Questions

- Should the distributed profile reuse `AgentSwarm` as the worker mechanism, or use a lower-level task queue?
- How should cost be estimated when providers charge per 1,000 calls or per token?
- Should the planner itself be a subagent, or a deterministic decomposition based on query families?
- What is the minimum viable backend for v1.0: Redis, SQLite queue, or plain files?
