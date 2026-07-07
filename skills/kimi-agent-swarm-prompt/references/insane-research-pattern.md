# Insane-Research Pattern Reference

Purpose: adapt the useful public contract of `fivetaku/insane-research` for this repository's prompt-contract and wide-search workflows.

Use this reference when the user asks for deep research, market mapping, source-backed comparison, literature scan, technical landscape analysis, or a long-form report.

## Research Shape

1. **Question scoping**
   - Ask only blocking scoping questions.
   - Resolve focus, depth, audience, source class, freshness window, and output shape.
   - If optional details are missing, state safe assumptions and continue.

2. **Retrieval planning**
   - Break the objective into 3-5 research lanes.
   - Each lane should have a query family, source target, and stop condition.
   - Require approval before paid, high-budget, or broad network execution.

3. **Parallel collection**
   - Run lanes in parallel when the host supports subagents or workers.
   - Use read-only agents for web/academic/technical discovery.
   - Use a cross-reference lane for claim verification.

4. **Source quality rating**
   - Grade evidence before synthesis:
     - A: peer-reviewed or primary systematic evidence
     - B: official documentation, standards, policy, company or project source
     - C: expert/industry analysis
     - D: preprint, white paper, vendor blog, or unreviewed technical note
     - E: anecdotal, forum, social, or speculative source
   - Label community sentiment as community sentiment, not fact.

5. **Triangulation**
   - Key factual claims should have at least two independent supporting sources when possible.
   - Record unsupported, stale, or low-confidence claims explicitly.
   - Do not hide coverage gaps.

6. **Synthesis and packaging**
   - Write a readable answer first.
   - Preserve machine-checkable artifacts: `run.json`, `research-plan.json`, `source-ledger.jsonl`, `claim-ledger.jsonl`, `synthesis.md`, and `verification-report.json`.
   - Optional exports can include JSON, CSV, HTML, or SVG.

## Output Contract

The final answer should include:

- executive answer or recommendation;
- ranked findings or comparison table;
- inline source ids or evidence ids;
- source quality and coverage notes;
- verification status;
- unresolved gaps and next human check.
