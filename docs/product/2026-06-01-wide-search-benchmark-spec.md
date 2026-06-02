# Wide-Search Benchmark Spec

Date: 2026-06-01
Status: draft for v0.4

## Purpose

Define repeatable benchmarks that show whether the product is improving from a prompt workflow into a credible wide-search system.

The benchmark suite must test:

- source discovery coverage
- source quality scoring
- claim traceability
- freshness handling
- duplicate rejection
- readable synthesis quality
- deterministic verifier behavior

## Benchmark Modes

| Mode | Network | Purpose |
| --- | --- | --- |
| `fixture` | no | deterministic CI |
| `recorded` | no | replay prior live runs |
| `live-light` | yes | small current-source smoke |
| `live-standard` | yes | manual release validation |

CI must run `fixture`. Release candidates should run `fixture` and at least one `recorded` benchmark.

## Benchmark 1: YouTube Niche Discovery

User task:

```text
Find 100 YouTube niche opportunities with audience, pain point, evidence signal, freshness signal, and caveat.
```

Fixture target:

- 120 candidate sources
- 40 accepted sources
- at least 30 unique niches
- sentiment sources labeled separately from factual sources

Checks:

- no niche without evidence source id
- no factual claim sourced only from comments or social sentiment
- duplicates clustered
- final output has ranked shortlist

## Benchmark 2: Paul Graham Essay Corpus

User task:

```text
Classify Paul Graham essays by theme and summarize product/startup lessons with source ids.
```

Fixture target:

- corpus inventory exists
- each essay has title, URL, and theme labels
- synthesis separates direct essay claims from interpretation

Checks:

- corpus inventory must run before synthesis
- representative essays cited for each theme
- no claim about publication chronology without date evidence

## Benchmark 3: GitHub Repo Landscape

User task:

```text
Find GitHub repositories that could support wide-search or multi-agent research workflows.
```

Fixture target:

- official repo sources prioritized
- license and maintenance signal captured
- stars treated as secondary evidence

Checks:

- each repo row includes use case, license, activity signal, caveat
- recent maintenance claims require release or commit evidence
- abandoned candidates are labeled, not silently dropped

## Benchmark 4: Market Or Competitor Scan

User task:

```text
Map competitors for a research-agent product and compare positioning, target user, and trust signals.
```

Fixture target:

- official product pages
- docs/pricing pages when current
- independent reviews or community sources labeled as secondary

Checks:

- pricing and availability are dated
- official claims are separated from third-party claims
- final output includes open questions

## Scoring Rubric

Each run receives a score from 0 to 100:

| Dimension | Weight |
| --- | ---: |
| Source coverage | 20 |
| Source quality | 20 |
| Claim traceability | 20 |
| Freshness handling | 10 |
| Duplicate handling | 10 |
| Readable synthesis | 10 |
| Verification integrity | 10 |

Release threshold:

- v0.3 fixture smoke: 70+
- v0.4 benchmark pass: 82+
- 9.3+ product candidate: 90+ across fixture and recorded suites, plus live-standard manual review

## Negative Fixtures

The suite must include failing inputs:

- synthesis with unsupported claims
- stale current-fact claim
- duplicate-heavy source set
- low-authority-only result
- source ledger without accepted sources

Expected result:

- verifier fails or warns with a clear reason
- final report does not hide the problem

## Output Contract

Every benchmark run should produce:

- benchmark id
- run id
- execution profile
- source count summary
- claim count summary
- verifier status
- score
- report path

## Success Criteria

The benchmark suite is useful when:

- it runs without network in CI
- failures are actionable
- adding a provider does not require changing benchmark assertions
- public examples can be generated from benchmark outputs
