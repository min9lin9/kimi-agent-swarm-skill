# kimi-agent-swarm-cli

Evidence-backed wide-search CLI for the Kimi Agent Swarm. It turns a research objective into a structured evidence package: scored sources, extracted claims, verification reports, and exportable synthesis documents.

## Install

Requires [Bun](https://bun.sh) 1.0 or later. The published package runs via Bun, so `npm install -g` only works when `bun` is on your `PATH`.

```bash
# Registry install with Bun (recommended)
bun install -g kimi-agent-swarm-cli

# Local tarball install with Bun
bun add -g kimi-agent-swarm-cli-*.tgz

# Local tarball install with npm (requires bun on PATH)
npm install -g kimi-agent-swarm-cli-*.tgz
```

For local development:

```bash
git clone https://github.com/min9lin9/kimi-agent-swarm-skill.git
cd runtime/wide-search
bun install
```

When running from a local clone, use `bun src/cli.ts` in place of `kasw`.

## Quick start

```bash
# First-run setup (interactive)
kasw init

# Run a fixture benchmark
kasw benchmark --profile fixture-paul-graham-corpus

# Live web search with Tavily (requires TAVILY_API_KEY)
kasw research "AI browser agent repos" --profile web-search --provider tavily

# Distributed execution
kasw research "AI browser agent landscape" --profile web-search --provider tavily --distributed --workers 4

# View the leaderboard
kasw leaderboard --profile fixture-paul-graham-corpus
kasw leaderboard --html --out leaderboard.html
```

## CLI commands and flags

### `research` / `run`

Run a wide search. The two names are aliases.

```bash
kasw research "<objective>" [options]
```

| Flag | Description |
| --- | --- |
| `--profile <profile>` | Execution profile (see below). Default: `fixture` |
| `--provider <name>` | Search provider: `mock`, `serper`, `tavily`, `brave`, `github`. Default: `mock` |
| `--provider-name <name>` | Alias for `--provider` |
| `--provider-command <cmd>` | External command for `local-command` profile |
| `--provider-args <args>` | Space-separated arguments passed to `--provider-command` |
| `--depth <depth>` | `light` \| `standard` (default) \| `deep` \| `maximum` |
| `--work-dir <dir>` | Working directory for runs and local config. Default: current directory |
| `--max-cost-usd <n>` | Abort if estimated/actual cost exceeds budget |
| `--max-provider-calls <n>` | Abort if provider calls exceed budget |
| `--max-api-calls <n>` | Abort if API calls exceed budget |
| `--dry-run` | Print cost estimate without executing or writing run artifacts |
| `--use-cache` | Reuse cached provider responses when available |
| `--replay <run-id>` | Rerun a previous run with the same inputs |
| `--distributed` | Execute using distributed worker tasks |
| `--workers <n>` | Number of in-process workers for distributed runs. Default: `4` |
| `--max-retries <n>` | Max retries per distributed task. Default: `3` |
| `--queue-type <memory\|redis>` | Distributed queue backend. Default: `memory` |
| `--resume-job-id <id>` | Resume a previous distributed job |
| `--redis-url <url>` | Redis URL (defaults to `REDIS_URL` env) |
| `--redis-password <password>` | Redis password (defaults to `REDIS_PASSWORD` env) |
| `--redis-username <username>` | Redis username (defaults to `REDIS_USERNAME` env) |

Pass `--` to stop flag parsing and treat everything after it as the objective:

```bash
kasw research -- "AI -- the future"
```

### `verify`

Verify a previously created run.

```bash
kasw verify --run-dir <run-dir>
```

### `inspect`

Print a concise summary of a run.

```bash
kasw inspect --run-dir <run-dir>
```

### `export`

Export a run to `json`, `csv`, `html`, or `svg`.

```bash
kasw export --run-dir <run-dir> --format <json|csv|html|svg> [--out <path>]
```

If `--out` is omitted, the file is written inside the run directory as `export.<format>`.

### `benchmark`

Run a fixture profile against its bundled golden answers and record the scores.

```bash
kasw benchmark --profile <fixture-profile> [--work-dir <dir>]
```

### `leaderboard`

View benchmark history.

```bash
kasw leaderboard [options]
```

| Flag | Description |
| --- | --- |
| `--profile <profile>` | Filter entries by profile |
| `--compare <id-1>,<id-2>,...` | Compare specific runs |
| `--html` | Generate an HTML report |
| `--out <path>` | Output path for the HTML report. Default: `leaderboard-report.html` |
| `--clear` | Clear all leaderboard entries (requires `--yes`) |
| `--yes` | Confirm destructive operations |
| `--work-dir <dir>` | Working directory for the leaderboard file. Default: current directory |
| `--leaderboard-path <path>` | Custom leaderboard file path |

### `providers`

List available providers and their required environment variables.

```bash
kasw providers
```

### `init`

Create an initial configuration file.

```bash
kasw init [options]
```

| Flag | Description |
| --- | --- |
| `--non-interactive` | Skip prompts and use only existing env vars |
| `--local` | Write `.kasw.json` in the current directory instead of `~/.kasw/config.json` |
| `--work-dir <dir>` | Target directory for local config |

### `worker`

Run an external distributed worker process. Usually invoked automatically by `--distributed`, but can be started manually for multi-machine setups.

```bash
kasw worker --job-id <id> [options]
```

| Flag | Description |
| --- | --- |
| `--job-id <id>` | Required. Job to process |
| `--worker-id <id>` | Worker identifier. Default: `cli-worker` |
| `--work-dir <dir>` | Working directory for memory queue state |
| `--queue-type <memory\|redis>` | Queue backend |
| `--redis-url <url>` | Redis URL (defaults to `REDIS_URL` env) |
| `--redis-password <password>` | Redis password (defaults to `REDIS_PASSWORD` env) |
| `--redis-username <username>` | Redis username (defaults to `REDIS_USERNAME` env) |

## Execution profiles

| Profile | Description |
| --- | --- |
| `fixture` | Deterministic bundled fixture for demos and CI |
| `fixture-asset-mgmt` | Asset management role fixture |
| `fixture-sellside-research` | Sell-side research role fixture |
| `fixture-youtube-niche` | YouTube niche fixture |
| `fixture-paul-graham-corpus` | Paul Graham essays fixture |
| `fixture-github-repo-landscape` | GitHub repository landscape fixture |
| `fixture-market-scan` | Market scan fixture |
| `local-command` | Run an external JSONL provider command |
| `web-search` | Live search using a configured provider |

### `local-command` profile

The `local-command` profile runs an external JSONL provider command instead of the built-in provider registry. The command receives the research objective in the `WIDE_SEARCH_OBJECTIVE` environment variable and should emit one JSON event per line on stdout.

Recognized event types:

- `source_candidate` — contains a single `source` object.
- `complete` — contains a `sources` array (or can be emitted alone to end the stream).
- `error` — contains a `message` string and aborts the run.

Minimal provider example:

```bash
#!/usr/bin/env bun
# my-provider.ts
const sources = [
  {
    id: 'L001',
    url: 'https://example.com/local-command-primary',
    title: 'Local Command Primary Source',
    sourceClass: 'primary',
    publishedAt: '2026-05-22',
    discoveredBy: 'local-command',
    scores: { relevance: 4, authority: 4, freshness: 4, diversity: 3, extractionValue: 4 },
    claims: ['Local command providers feed replayable source candidates into the runtime.'],
  },
];

for (const source of sources) {
  console.log(JSON.stringify({ type: 'source_candidate', source }));
}
console.log(JSON.stringify({ type: 'complete' }));
```

Run it with:

```bash
# If the script is executable (chmod +x)
kasw research "example objective" --profile local-command --provider-command ./my-provider.ts

# Or run it through Bun
kasw research "example objective" --profile local-command --provider-command "bun ./my-provider.ts"

# Run the bundled fixture
kasw research "example objective" --profile local-command --provider-command "bun ./fixtures/jsonl-provider.ts"
```

See `fixtures/jsonl-provider.ts` for a runnable fixture.

## Provider setup

Credentials are resolved in this order: environment variable → config file → provider constructor. At minimum, each live provider needs its API key set.

| Provider | Required env var | Notes |
| --- | --- | --- |
| `mock` | none | Deterministic demo/CI provider |
| `serper` | `SERPER_API_KEY` | Google Search via Serper.dev |
| `tavily` | `TAVILY_API_KEY` | AI-native search |
| `brave` | `BRAVE_API_KEY` | Brave Search API |
| `github` | `GITHUB_TOKEN` | GitHub repository search (token raises rate limits) |

Set keys in your shell:

```bash
export SERPER_API_KEY="..."
export TAVILY_API_KEY="..."
export BRAVE_API_KEY="..."
export GITHUB_TOKEN="..."
```

Or run `kasw init` to write them to `~/.kasw/config.json`.

For CI or development, each live provider can run in deterministic mock mode without an API key by setting the matching environment variable to `1`:

- `TAVILY_MOCK=1`
- `SERPER_MOCK=1`
- `BRAVE_MOCK=1`
- `GITHUB_MOCK=1`

Mock mode returns bundled fixture results and does not call the external API.

## Configuration file

Config files are JSON. Two locations are supported:

- Global: `~/.kasw/config.json`
- Local: `<work-dir>/.kasw.json`

### Precedence

1. Local `.kasw.json`
2. Global `~/.kasw/config.json`
3. Built-in defaults

### Format

```json
{
  "providers": {
    "tavily": { "apiKey": "tvly-..." },
    "github": { "token": "ghp_..." }
  },
  "defaults": {
    "provider": "tavily",
    "depth": "standard",
    "profile": "web-search"
  }
}
```

Provider entries accept either `apiKey` or `token`; both are treated as the credential when resolving provider authentication.

## Cache, replay, and dry-run

### Cache

Enable caching with `--use-cache`. For the `web-search` profile, this stores provider responses in `~/.kasw/cache/<sha256>.json` for 7 days and reuses them for matching `(provider, objective, depth, maxResults)` queries. The mock provider is never cached.

### Replay

`--replay <run-id>` reruns a previous run using the objective, profile, provider, and depth from that run. A new run directory is created and `replayedFrom` is set to the original run ID. If you omit the objective, the previous run's objective is reused automatically.

### Dry-run

`--dry-run` estimates cost and returns a run result without calling any provider. No run artifacts are written. Useful for budget checks and CI validation. Pass `--dry-run=false` to explicitly disable a dry-run configured elsewhere.

## Distributed execution

Distributed mode splits a research job into tasks and processes them in parallel.

### In-process workers (memory queue)

The default memory queue runs workers inside the same CLI process. No extra infrastructure is required.

```bash
kasw research "..." --profile web-search --provider tavily --distributed --workers 4
```

### External workers

Start the CLI with `--distributed` to enqueue a job, then run one or more `worker` processes:

```bash
# Controller
kasw research "..." --profile web-search --provider tavily --distributed --queue-type redis --workers 0

# Workers (can be on other machines)
kasw worker --job-id <job-id> --queue-type redis --redis-url redis://localhost:6379
```

Use `--workers 0` with `--queue-type redis` when you want only external worker processes and no in-process workers.

### Redis setup

Set `REDIS_URL` and, if needed, `REDIS_PASSWORD` and `REDIS_USERNAME`:

```bash
export REDIS_URL="redis://localhost:6379"
export REDIS_USERNAME="..."
export REDIS_PASSWORD="..."
```

Redis is only required when `--queue-type redis` is used. It is an optional runtime dependency (`ioredis`).

### Resuming a job

Use `--resume-job-id <job-id>` with `--distributed` to load an existing job state instead of creating a new one. This is useful for retrying failed tasks or reconnecting workers.

## Benchmarking and leaderboard

Benchmarks compare a fixture run against golden answers and compute precision, recall, F1, citation accuracy, and URL coverage.

```bash
kasw benchmark --profile fixture-paul-graham-corpus
```

Each benchmark result is appended to `<work-dir>/.runs/leaderboard.jsonl` (default work-dir is the current directory). View them with:

```bash
kasw leaderboard
kasw leaderboard --profile fixture-paul-graham-corpus
kasw leaderboard --compare run-id-1,run-id-2
kasw leaderboard --html --out leaderboard.html
```

A benchmark passes when recall ≥ 0.5 and citation accuracy ≥ 0.8. URL coverage ≥ 0.5 is also checked when golden source URLs are defined.

## Exit codes and error handling

| Exit code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Invalid usage, unknown command, validation error, or runtime failure |

Errors print a concise message to `stderr`. Common error cases:

- Missing required flag (e.g., `--run-dir` for `inspect`/`export`)
- Invalid enum value (profile, provider, depth, format)
- Missing provider credential
- Provider command exits non-zero (`local-command` profile)
- Budget exceeded (`BudgetExceededError`)
- Distributed job not found for resume

## Adding a new fixture profile

1. Add the fixture data file to `fixtures/<name>.json` containing a top-level `sources` array.
2. Map the profile name to the fixture file in `FIXTURE_FILE_MAP` in `src/shared.ts`.
3. Add the profile name to `EXECUTION_PROFILES` in `src/cli.ts`.
4. Add golden answers to `fixtures/golden-answers.ts` if you want `kasw benchmark --profile <new-profile>` to score it.

## Adding a new provider

1. Implement `SearchProvider` in `src/providers/<name>-provider.ts`.
2. Add a descriptor entry to `src/providers/registry.ts` with the factory, env var, credential type, pricing, and max-results cap.
3. Export the provider from `src/providers/index.ts`.
4. Add tests in `tests/<name>-provider.test.ts`.

## License

MIT
