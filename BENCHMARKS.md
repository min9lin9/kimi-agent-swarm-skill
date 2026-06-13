# Benchmarks

This repository tracks reproducible benchmark results for the wide-search runtime. Each benchmark fixture has a golden answer and is scored on precision, recall, citation accuracy, and F1.

## Methodology

A benchmark run executes:

```bash
./bin/kasw benchmark --profile <fixture>
```

Scoring:

- **Precision**: accepted claims matching golden claims / total accepted claims
- **Recall**: golden claims matched / total golden claims
- **Citation accuracy**: claims with valid source references / total claims
- **F1**: harmonic mean of precision and recall
- **Passed**: recall ≥ 0.5 and citation accuracy ≥ 0.8

Claim matching uses Jaccard token similarity with a threshold of 0.6.

## Recorded Results

### fixture-paul-graham-corpus

| Metric | Value |
|--------|-------|
| Precision | 0.1250 |
| Recall | 1.0000 |
| Citation accuracy | 1.0000 |
| F1 | 0.2222 |
| Passed | ✅ |

### fixture-github-repo-landscape

| Metric | Value |
|--------|-------|
| Precision | 0.2069 |
| Recall | 1.0000 |
| Citation accuracy | 1.0000 |
| F1 | 0.3429 |
| Passed | ✅ |

### fixture-market-scan

| Metric | Value |
|--------|-------|
| Precision | 0.2381 |
| Recall | 1.0000 |
| Citation accuracy | 1.0000 |
| F1 | 0.3846 |
| Passed | ✅ |

The relatively low precision across benchmarks reflects a high number of accepted claims from rich corpora; recall and citation accuracy are perfect. Future work will add claim clustering to reduce redundancy and improve precision.

## Fixtures in Progress

- `fixture-github-repo-landscape`
- `fixture-market-scan`

## CI

Benchmarks are run with `bun test` in `runtime/wide-search`. The Paul Graham benchmark is included in the standard test suite.
