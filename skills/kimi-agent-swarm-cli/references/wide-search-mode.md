# Wide-Search Mode (Kimi Code CLI)

Use this reference when the execution mode is `wide-search` or `hybrid`.

Wide-search is for research where the user needs a mapped answer, not a quick reply. Help the user clarify the research target, choose search depth, run or hand off the search, and return a readable synthesis with evidence.

## When To Use

Use `wide-search` for:

- finding many candidates, niches, products, repos, papers, videos, essays, or competitors
- comparing sources where freshness, authority, or coverage matters
- building a ranked shortlist with reasons
- turning a large corpus into themes, patterns, and recommendations
- research that must show what was accepted, rejected, and still uncertain

Do not use it for:

- quick definitions
- one official-doc lookup
- local code changes without external research
- prompt-only requests

## Search Depths

| Depth | Best for | Typical result size | Use when |
| --- | --- | ---: | --- |
| `light` | quick landscape | 8-20 accepted sources | the user needs direction, not exhaustive proof |
| `standard` | normal research | 25-75 accepted sources | the user wants a reliable answer with evidence |
| `deep` | large corpus or serious decision | 75-250 accepted sources | the user approves longer runtime and broader collection |
| `maximum` | provisioned wide swarm | 250+ accepted sources | hosted Kimi Agent Swarm or a real distributed search system is available |

Default to `standard`.

Do not claim `maximum`, 300 subagents, or 4000+ tool calls unless the execution environment actually provides that capacity. Kimi Code CLI's `AgentSwarm` is capped at 128 subagents per call.

## Approval Card

Show this shape to the user before execution:

```markdown
Goal:
- <what the user wants to decide or discover>

Search depth:
- light | standard | deep | maximum

Scope:
- Include:
- Exclude:
- Region/language:
- Freshness window:

Output:
- <ranked list, comparison table, market map, source brief, implementation brief, etc.>

Execution:
- Kimi Code CLI AgentSwarm (max 128 subagents)
- Kimi Code CLI /swarm mode
- Local runtime/wide-search harness
- Approval needed: yes/no

Risks:
- <coverage, freshness, source bias, quota, cost, or unavailable runtime>
```

## AgentSwarm Item Design

When using Kimi Code CLI's `AgentSwarm` tool, split the research into distinct items. Each item becomes one subagent prompt.

Examples:

- Different query families: `"AI browser agent 2026"`, `"open-source browser automation"`, `"LLM web agent framework"`
- Different source types: `"GitHub repos"`, `"Hacker News discussions"`, `"academic papers"`
- Different comparison axes: `"license and governance"`, `"maintenance signal"`, `"ecosystem fit"`

Keep items non-overlapping to avoid duplicate work.

## Readable Output Shape

Return the synthesis in this order:

```markdown
## Answer
<direct answer or recommendation>

## Top Findings
| Finding | Why it matters | Evidence | Confidence |
| --- | --- | --- | --- |

## Ranked Shortlist
| Rank | Item | Reason | Best evidence | Caveat |
| ---: | --- | --- | --- | --- |

## Source Coverage
- Accepted sources:
- Rejected sources:
- Freshness coverage:
- Authority mix:
- Known gaps:

## Evidence
- Source ledger:
- Claim ledger:
- Synthesis:
- Verification:

## Usage / Cost
- AgentSwarm subagents launched:
- Provider/API calls:
- Estimated tokens or quota used:
- Paid provider (e.g., Serper) calls:

## Next Human Check
- <what the user should inspect before acting>
```

If no real search was run, say so plainly and return only the refined prompt contract plus approval card.

## Quality Rules

Filter each source before accepting it:

- **Relevance**: does it directly answer the question?
- **Authority**: is it official, primary, original data, or a credible expert?
- **Freshness**: is it current enough for this claim?
- **Diversity**: does it add a new angle, region, source type, or viewpoint?
- **Traceability**: can important claims point back to source ids?
- **Deduplication**: does it repeat another source without adding evidence?

Accept sources that are directly relevant and at least reasonably authoritative. For time-sensitive facts, require dates or mark the claim as stale.

## Verification Checks

After synthesis, run deterministic verification on the ledgers:

- **Minimum accepted sources**: at least one accepted source by default.
- **Unsupported claims**: every claim must reference at least one source id.
- **Broken source references**: every claim's `sourceIds` must exist in the source ledger.
- **Duplicate claims**: flag near-duplicate claims (Jaccard similarity ≥ 0.7 or substring containment).
- **Conflicting claims**: flag claim pairs that share an entity but express opposite polarity (e.g., "X increases" vs "X decreases").
- **Stale claim ratio**: warn if too many claims are stale; fail if the ratio exceeds the threshold.
- **Low-confidence claim ratio**: warn if too many claims are low-confidence; fail if the ratio exceeds the threshold.
- **Coverage gaps**: warn if accepted sources lack primary analysis or if the acceptance ratio is very low.

Verification failures block a "passed" status but still produce the synthesis for human review.

## Evidence Files

When a harness is available, keep machine-readable evidence behind the readable answer:

- `research-plan.json`: objective, scope, query families, stop conditions
- `source-ledger.jsonl`: accepted and rejected sources with reasons
- `claim-ledger.jsonl`: important claims mapped to source ids
- `synthesis.md`: human-readable answer
- `verification-report.json`: checks for missing evidence, stale claims, duplicates, and open risks

The user should not need to read these files to understand the answer. They exist for auditability.

## If Search Execution Is Unavailable

If no `AgentSwarm`, `/swarm` mode, local runtime, or external research harness is available:

- produce the refined wide-search prompt
- show the approval card
- list what execution environment is missing
- do not invent source counts, evidence paths, or search results
