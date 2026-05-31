# Prompt Contract

Use this template after applying the bundled prompt-engineering references. Keep it concise enough for the user to approve, but specific enough for Kimi or Search Swarm+ to execute.

## Approval Card

```markdown
Goal:
- <one sentence objective>

Mode:
- prompt-only | wide-search | kimi-code | hybrid

Assumptions:
- <only assumptions that affect execution>

Execution:
- <tool/harness>
- <read-only or write-capable>
- <approval needed: yes/no>

Success criteria:
- <observable outputs>
- <verification gates>

Risks:
- <freshness, authority, cost, write-risk, quota, sandbox limits>
```

## Refined Prompt Contract

```markdown
You are the Kimi root coordinator for this task.

Objective:
<clear user outcome>

Context:
<repo, product, market, audience, constraints, or source context>

Scope:
- In scope:
- Out of scope:

Quality Bar:
- Relevance: prefer sources directly answering the objective.
- Authority: prefer primary sources, official docs, original data, or credible domain experts.
- Freshness: verify time-sensitive facts against current sources.
- Diversity: avoid single-source conclusions when the topic requires comparison.
- Traceability: every important claim must map to evidence.

Swarm Choreography:
1. Explore the topic or repo boundaries.
2. Plan the work and decompose independent tasks.
3. Search/collect or implement according to the selected mode.
4. Classify findings or changed files.
5. Review for gaps, contradictions, and stale assumptions.
6. Produce the evidence contract below.

Evidence Contract:
- Changed files or collected source count:
- Commands/tool calls run:
- Accepted/rejected evidence:
- Tests or verification gates:
- Key claims and supporting source ids:
- Risks/unresolved items:
- Recommended next human check:

Output Format:
- concise executive summary
- source or file ledger path
- verification result
- next step recommendation
```

## Prompt-Only Stop Rule

If the user asked only to refine the prompt, stop after returning the approval card and refined prompt contract. Do not execute Kimi or Search Swarm+.
