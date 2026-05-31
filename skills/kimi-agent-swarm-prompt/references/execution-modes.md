# Execution Modes

## Mode: wide-search

Use Search Swarm+ for research, wide search, niche discovery, source collection, classification, scoring, and synthesis.

Default harness directory:

```bash
$KIMI_SWARM_HARNESS_DIR
```

If `KIMI_SWARM_HARNESS_DIR` is not set, locate a local directory containing `search-swarm-plus/package.json`. If no harness is available, stop after producing the refined prompt contract.

Recommended command sequence from the harness directory:

```bash
npm run doctor
npm run run -- "<refined prompt contract or compact objective>"
npm run verify
npm run inspect
```

Notes:
- `run` executes plan, provider retrieval, source scoring, claim synthesis, and verification report creation.
- Before a real provider run, use `npm run provider-doctor -- --provider command --command /absolute/path/to/provider` to validate the wrapper.
- Use `--provider command --command /absolute/path/to/provider` for real command-backed retrieval.
- Wrapper development can start with `node examples/providers/jsonl-fixture-provider.mjs`.
- `debate` and `debate-run` remain advanced planning steps. `debate-run` invokes Kimi and may require Codex escalation because Kimi writes to `~/.kimi`.
- `verify` is the deterministic acceptance gate.

## Mode: kimi-code

Use Kimi Code CLI root-agent/subagent assets or OMK-lite for local implementation, review, and QA.

Default order:

1. Present the refined prompt contract and approval card.
2. Prefer interactive Kimi for write-capable work.
3. Use read-only Kimi or `--print` only for analysis/review unless a disposable worktree is active.
4. After the Kimi run, execute deterministic verification such as tests, lint, typecheck, and diff checks.

## Mode: hybrid

Use `wide-search` first for external knowledge or large-source collection. Convert its verified synthesis into a smaller `kimi-code` prompt before touching the local repo.

## Final Response Checklist

Report:

- refined prompt contract path or inline prompt
- Kimi/Search Swarm+ run id
- source ledger, claim ledger, transcript, or decision paths
- commands run
- verification result
- unresolved risks
