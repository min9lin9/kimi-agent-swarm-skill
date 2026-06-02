# Harness Integration

Audience: maintainers and harness authors.

Normal users should start with the README and `skills/kimi-agent-swarm-prompt/references/wide-search-mode.md`. This file is only for wiring a compatible local or external search system into the skill.

This repository ships a Codex skill. It does not ship a hosted search swarm or distributed crawler.

`wide-search` can execute only when Codex can find a compatible local or external harness. Otherwise the skill should stop after producing the refined prompt contract and approval card.

## Expected Environment

```bash
export KIMI_SWARM_HARNESS_DIR=/absolute/path/to/search-swarm-plus
```

The directory should contain a Node package with these commands:

```bash
npm run doctor
npm run provider-doctor -- --provider command --command /absolute/path/to/provider
npm run run -- "research objective or prompt contract"
npm run verify
npm run inspect
```

## Built-In Runtime

This repository also includes an early local runtime at `runtime/wide-search`.

Supported profiles:

- `fixture`: uses bundled deterministic sources
- `local-command`: executes a local command that emits JSONL events

Example local-command run:

```bash
cd runtime/wide-search
node src/cli.mjs run \
  --profile local-command \
  --provider-command node \
  --provider-args fixtures/jsonl-provider.mjs \
  --objective "Evaluate command-backed source ingestion"
```

## Expected Artifacts

A compatible harness should create a run directory containing:

- `research-plan.json`
- `source-ledger.jsonl` or `source-ledger.json`
- `claim-ledger.jsonl` or `claim-ledger.json`
- `synthesis.md`
- `verification-report.json`

Codex should treat the verification report and ledgers as the source of truth, not the model's prose summary.

## Provider Contract

This section is intentionally advanced. Do not surface it in normal user-facing answers unless the user is configuring or debugging a harness.

Command providers should be deterministic enough to inspect and replay. JSONL is preferred.

Recommended event types:

- `source_candidate`: discovered source metadata
- `source_fetch`: fetched or extracted source content metadata
- `claim`: extracted claim linked to source ids
- `metric`: budget, timing, or quality metric
- `error`: provider or fetch failure with retry status

Minimum source fields:

- `url` or stable source id
- `title`
- `sourceClass`
- `publishedAt` or `unknown`
- `discoveredBy`
- `snippet` or extraction pointer

Minimum claim fields:

- `claim`
- `sourceIds`
- `confidence`
- `freshness`

## Verification Expectations

The harness verifier should fail when:

- no source ledger exists
- no claim ledger exists for synthesis tasks
- accepted source count is below the approved profile target
- important claims lack source ids
- time-sensitive claims lack dates or freshness markings
- duplicate rate is high enough to distort coverage
- provider errors hide a material coverage gap

Warnings are acceptable for:

- low source diversity
- unknown publication dates on non-time-sensitive claims
- community-only evidence that is labeled as sentiment
- partially completed deep searches where the user approved a time or budget stop

## Safety Boundary

Do not run write-capable tools, broad network crawlers, paid APIs, or high-budget provider calls without approval.

Do not describe a local harness as equivalent to hosted Kimi Agent Swarm unless hosted Kimi Agent Swarm, or an explicitly provisioned distributed system with comparable capacity, was actually used.
