# Wide-Search Mode

Use this reference when mode is `wide-search` or `hybrid`.

Wide-search is for research where the user needs a mapped answer, not a quick reply. Codex should help the user clarify the research target, choose search depth, run or hand off the search, and return a readable synthesis with evidence.

## User Promise

When a user asks for wide-search, they should get:

- a clear research scope before execution
- source quality rules they can understand
- a readable answer, not a dump of URLs
- evidence paths for audit or reuse
- unresolved gaps and next checks

Do not lead with provider, harness, JSONL, or adapter details. Those are implementation details for maintainers.

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

## Conversation Flow

1. Restate the research objective in plain language.
2. Choose a search depth: `light`, `standard`, `deep`, or `maximum`.
3. Ask only blocking questions. Otherwise state safe assumptions.
4. Show an approval card before external, network-heavy, paid, or high-budget execution.
5. Run the available workflow.
6. Return a human-readable synthesis first, then evidence paths.

## Approval Card

Use this shape for users:

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

Quality rules:
- Prefer direct, authoritative, fresh, and diverse sources.
- Reject duplicates, stale claims, and unsupported claims.

Execution:
- <prompt-only | local search | Kimi | hosted/distributed search>
- Approval needed: yes/no

Risks:
- <coverage, freshness, source bias, quota, cost, or unavailable search runtime>
```

## Search Depths

| Depth | Best for | Typical result size | Use when |
| --- | --- | ---: | --- |
| `light` | quick landscape | 8-20 accepted sources | the user needs direction, not exhaustive proof |
| `standard` | normal research | 25-75 accepted sources | the user wants a reliable answer with evidence |
| `deep` | large corpus or serious decision | 75-250 accepted sources | the user approves longer runtime and broader collection |
| `maximum` | provisioned wide swarm | 250+ accepted sources | hosted Kimi Agent Swarm or a real distributed search system is available |

Default to `standard`.

Do not claim `maximum`, 300 subagents, or 4000+ tool calls unless the execution environment actually provides that capacity.

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

## Next Human Check
- <what the user should inspect before acting>
```

If no real search was run, say so plainly and return only the refined prompt contract plus approval card.

## Quality Rules In Plain Language

Use these filters before trusting a source:

- Relevance: does it directly answer the question?
- Authority: is it official, primary, original data, or a credible expert?
- Freshness: is it current enough for this claim?
- Diversity: does it add a new angle, region, source type, or viewpoint?
- Traceability: can important claims point back to source ids?
- Deduplication: does it repeat another source without adding evidence?

Acceptance guideline:

- Accept sources that are directly relevant and at least reasonably authoritative.
- For time-sensitive facts, require dates or mark the claim as stale.
- Treat community posts, comments, and social signals as sentiment unless independently verified.
- Reject duplicates unless they add new data or reveal disagreement.

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

## Common Workload Recipes

### YouTube or Niche Discovery

Return:

- niche name
- audience
- repeated pain point
- evidence signal
- freshness signal
- monetization or product angle if requested
- caveat

Do not treat views, comments, or creator claims as facts. Use them as demand or sentiment signals.

### Essay, Blog, or Article Corpus

Return:

- corpus coverage count
- major themes
- representative source ids
- timeline or topic map if useful
- claims that need external verification

Inventory the corpus first when a canonical index exists.

### GitHub Repo or Tool Landscape

Return:

- repo/tool name
- use case
- license
- maintenance signal
- docs quality
- ecosystem fit
- caveat

Stars and downloads are secondary signals. Recent releases, issues, docs, and real use cases matter more.

### Market or Competitor Scan

Return:

- segment
- key players
- positioning
- pricing or packaging if current
- target user
- evidence strength
- open questions

Verify pricing, availability, and company claims against current sources.

## Evidence Files

When a harness is available, keep machine-readable evidence behind the readable answer:

- research plan: objective, scope, query families, stop conditions
- source ledger: accepted and rejected sources with reasons
- claim ledger: important claims mapped to source ids
- synthesis: human-readable answer
- verification report: checks for missing evidence, stale claims, duplicates, and open risks

The user should not need to read these files to understand the answer. They exist for auditability.

## If Search Execution Is Unavailable

If no Kimi, Search Swarm+, hosted swarm, or external research harness is available:

- produce the refined wide-search prompt
- show the approval card
- list what execution environment is missing
- do not invent source counts, evidence paths, or search results

## Advanced Harness Notes

Only mention these when configuring or debugging execution:

- default harness env var: `$KIMI_SWARM_HARNESS_DIR`
- detailed integration guide: `docs/HARNESS_INTEGRATION.md`
- verification output and evidence files are the source of truth
