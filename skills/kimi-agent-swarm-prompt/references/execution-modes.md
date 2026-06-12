# Execution Modes

## Mode: wide-search

Use `wide-search` for source-heavy research, niche discovery, source collection, classification, scoring, and synthesis.

Read `wide-search-mode.md` before running this mode. It defines the user-facing approval card, search depths, readable output shape, source quality rules, evidence files, and stop conditions.

Required user-facing outputs:

- direct answer or recommendation
- top findings with evidence ids
- ranked shortlist or comparison table when useful
- source coverage and known gaps
- evidence paths and verification result

Default profile: `standard`.

Escalate to `deep` or `maximum` only after approval. `maximum` requires a hosted or explicitly provisioned distributed search system and must not be described as equivalent to hosted Kimi Agent Swarm unless the hosted system is actually used.

Advanced search harness directory:

```bash
$KIMI_SWARM_HARNESS_DIR
```

If `KIMI_SWARM_HARNESS_DIR` is not set, locate a local directory containing `search-swarm-plus/package.json`. If no harness is available, stop after producing the refined prompt contract.

Recommended advanced command sequence from the harness directory:

```bash
npm run doctor
npm run run -- "<refined prompt contract or compact objective>"
npm run verify
npm run inspect
```

Notes:
- `run` executes planning, source collection, source scoring, claim synthesis, and verification report creation.
- `debate` and `debate-run` remain advanced planning steps. `debate-run` invokes Kimi and may require Codex escalation because Kimi writes to `~/.kimi`.
- `verify` is the deterministic acceptance gate.
- If no harness exists, return the refined prompt contract, approval card, and harness requirements. Do not invent search results.
- Provider and adapter details belong in `docs/HARNESS_INTEGRATION.md`.

Do not expose these command details in the normal user answer unless the user asks how to configure the harness.

Built-in runtime profiles (Search Swarm+ or Kimi Code CLI `runtime/wide-search`):

- `fixture`: deterministic test profile
- `fixture-asset-mgmt`: buyside asset management roles benchmark
- `fixture-sellside-research`: sell-side research organization roles benchmark
- `local-command`: local JSONL command profile
- `web-search`: live web search via a configured provider (e.g., `serper` with `SERPER_API_KEY`)

When using the Kimi Code CLI `runtime/wide-search` harness:

```bash
cd runtime/wide-search
bun run src/cli.ts run \
  --profile web-search \
  --provider-name serper \
  --depth standard \
  --objective "<refined objective>" \
  --work-dir <work-dir>
```

If no harness or runtime is available, stop after producing the refined prompt contract and approval card.

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
