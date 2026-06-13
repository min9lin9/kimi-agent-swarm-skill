# Kimi Agent Swarm Skill

[![quality](https://github.com/min9lin9/kimi-agent-swarm-skill/actions/workflows/quality.yml/badge.svg)](https://github.com/min9lin9/kimi-agent-swarm-skill/actions/workflows/quality.yml)

Skill pack for refining rough user intent into a prompt contract, then routing the approved prompt into Kimi Agent Swarm-style research, Kimi Code subagent, Search Swarm+, or OMK-lite workflows.

Status: `v0.7.0`

Includes:

- `kimi-agent-swarm-prompt`: Codex-only skill.
- `kimi-agent-swarm-cli`: Kimi Code CLI skill using the built-in `AgentSwarm` tool and subagents.
- `runtime/wide-search`: local wide-search runtime with scorer, verifier, provider registry, caching, replay, distributed execution, and benchmark leaderboard.
- `bin/kasw`: single-entry CLI for research, export, benchmark, leaderboard, init, and distributed worker workflows.
- Published on npm as `kimi-agent-swarm-cli`.

This project is unofficial and is not a Claude Code skill pack, ChatGPT GPT, Gemini Gem, or hosted Kimi Agent Swarm clone. It is not affiliated with Moonshot AI, Kimi, or `treylom/prompt-engineering-skills`.

## What It Does

- Turns a rough user request into a structured prompt contract.
- Uses bundled prompt-engineering references before execution.
- Classifies work into `prompt-only`, `wide-search`, `kimi-code`, or `hybrid`.
- Presents an approval card before Kimi, external research, network-heavy, or write-capable execution.
- Reports command evidence, ledger paths, verification results, and unresolved risks.

## Wide-Search Mode

Use `wide-search` when you need a researched answer, ranked shortlist, or source map that is broader than a normal one-shot search.

Good requests:

- `"AI browser agent 오픈소스 repo를 조사하고 비교해줘"`
- `"YouTube niche 100개를 찾고 근거와 리스크를 표로 정리해줘"`
- `"Paul Graham 글 전체를 주제별로 분류하고 제품 아이디어 관점에서 요약해줘"`
- `"Kimi Agent Swarm 수준 wide search가 가능한 GitHub repo 후보를 찾아줘"`

Codex should first show a short approval card:

```markdown
Goal:
- What we are trying to discover or decide

Search depth:
- light | standard | deep | maximum

Scope:
- include / exclude / language / region / freshness window

Output:
- ranked list, comparison table, source map, market map, or implementation brief

Execution:
- prompt-only, local search, Kimi, or hosted/distributed search
```

The final answer should be readable first:

- direct answer or recommendation
- top findings with evidence ids
- ranked shortlist or comparison table
- source coverage and known gaps
- evidence paths for audit
- next human check

Behind the readable answer, the workflow may create evidence files such as a research plan, source ledger, claim ledger, synthesis report, and verification report.

Default search depth is `standard`. Use `deep` only after approval. Use `maximum` only with hosted Kimi Agent Swarm or an explicitly provisioned distributed search system. This repository does not claim hosted Kimi Agent Swarm parity.

## What It Is Not

- Not hosted Kimi Agent Swarm.
- Not a claim of 300 subagents or 4000+ tool-call parity.
- Not an official Kimi or Moonshot AI project.
- Not a replacement for deterministic verification.
- Not a general multi-agent runtime by itself.

## Install For Codex

```bash
git clone https://github.com/min9lin9/kimi-agent-swarm-skill.git
cd kimi-agent-swarm-skill
./scripts/install-codex-skill.sh
```

Manual install:

```bash
mkdir -p ~/.codex/skills
cp -R skills/kimi-agent-swarm-prompt ~/.codex/skills/
```

## Install For Kimi Code CLI

```bash
git clone https://github.com/min9lin9/kimi-agent-swarm-skill.git
cd kimi-agent-swarm-skill
./scripts/install-kimi-code-skill.sh
```

Manual install:

```bash
mkdir -p ~/.kimi-code/skills
cp -R skills/kimi-agent-swarm-cli ~/.kimi-code/skills/
```

Restart Kimi Code CLI or start a new session to load the skill.

## Use In Codex

Prompt refinement plus workflow routing:

```text
$kimi-agent-swarm-prompt "AI browser agent open-source repos를 조사하고 비교해줘"
```

Prompt-only mode:

```text
$kimi-agent-swarm-prompt "프롬프트만 고도화하고 실행은 하지 마: YouTube niche 100개를 찾는 리서치 프롬프트"
```

Hybrid mode:

```text
$kimi-agent-swarm-prompt "먼저 시장 조사를 하고, 승인 후 로컬 repo에서 README와 skill 패키징을 개선해줘"
```

## Use In Kimi Code CLI

The skill works best inside an interactive Kimi Code CLI session. For wide-search tasks, first activate swarm mode so the assistant treats the request as a parallel-delegation task:

```text
/swarm
/skill:kimi-agent-swarm-cli "AI browser agent open-source repos를 조사하고 비교해줘" mode=wide-search
```

If you do not activate `/swarm`, invoke the skill directly:

```text
/skill:kimi-agent-swarm-cli "AI browser agent open-source repos를 조사하고 비교해줘"
```

Prompt-only mode:

```text
/skill:kimi-agent-swarm-cli "프롬프트만 고도화하고 실행은 하지 마: YouTube niche 100개를 찾는 리서치 프롬프트"
```

Hybrid mode:

```text
/skill:kimi-agent-swarm-cli "먼저 시장 조사를 하고, 승인 후 로컬 repo에서 README와 skill 패키징을 개선해줘"
```

> Note: `/swarm` is a TUI slash command; it cannot be activated from `kimi -p` non-interactive mode. For automation, use the local `runtime/wide-search` harness or call the `AgentSwarm` tool directly.

### Testing `/swarm` Interactively

1. Install the skill (see "Install For Kimi Code CLI" above).
2. Start a new Kimi Code CLI session in the project directory:
   ```bash
   cd kimi-agent-swarm-skill
   kimi
   ```
3. Activate swarm mode:
   ```text
   /swarm
   ```
   You should see a system reminder encouraging parallel delegation.
4. Invoke the skill with a wide-search objective:
   ```text
   /skill:kimi-agent-swarm-cli "AI browser agent open-source repos를 조사하고 비교해줘" mode=wide-search
   ```
5. Approve the prompt contract if asked.
6. Confirm that `AgentSwarm` launches and writes evidence to `.runs/wide-search/<run-id>/`.
7. Inspect `synthesis.md`, `source-ledger.jsonl`, `claim-ledger.jsonl`, and `verification-report.json`.

If the skill is not recognized, restart Kimi Code CLI or check that `~/.kimi-code/skills/kimi-agent-swarm-cli/SKILL.md` exists and frontmatter parses as YAML.

## Workflow

```text
User input
  -> Codex loads kimi-agent-swarm-prompt
  -> bundled prompt-engineering references
  -> prompt contract
  -> approval card
  -> selected mode
       prompt-only | wide-search | kimi-code | hybrid
  -> optional Kimi/Search Swarm execution
  -> evidence and verification report
```

Codex should ask only blocking questions. If a missing detail is optional, it should state a safe assumption and continue.

## Product Roadmap

The current repo is a Codex skill package. The path toward a fuller wide-search product is tracked in [docs/ROADMAP.md](docs/ROADMAP.md).

Planning artifacts:

- [9.3+ planner debate](docs/planning/2026-06-01-9-3-swarm-product-planner-debate.md)
- [wide-search runtime PRD](docs/product/2026-06-01-wide-search-runtime-prd.md)
- [wide-search benchmark spec](docs/product/2026-06-01-wide-search-benchmark-spec.md)
- [v0.3 implementation plan](docs/product/2026-06-01-v0.3-implementation-plan.md)

## Advanced: Search Execution

The skill can run `wide-search` only when Codex can access Kimi, a local Search Swarm+ harness, hosted Kimi Agent Swarm, or another approved search system. Without one, it should stop after producing the refined prompt and approval card.

For a local Search Swarm+ harness:

```bash
export KIMI_SWARM_HARNESS_DIR=/absolute/path/to/search-swarm-plus
```

Expected commands:

```bash
./bin/kasw doctor        # future health check command
./bin/kasw research "research objective"
./bin/kasw verify --run-dir .runs/wide-search/<run-id>
./bin/kasw inspect --run-dir .runs/wide-search/<run-id>
./bin/kasw benchmark --profile fixture-paul-graham-corpus
```

Provider, JSONL, and adapter details are intentionally kept out of the main README. They are for harness authors, not normal skill users.

Detailed integration expectations are in [docs/HARNESS_INTEGRATION.md](docs/HARNESS_INTEGRATION.md). The skill-level wide-search operating contract is in [skills/kimi-agent-swarm-prompt/references/wide-search-mode.md](skills/kimi-agent-swarm-prompt/references/wide-search-mode.md).

## Install

Requires [Bun](https://bun.sh) 1.0 or later.

```bash
npm install -g kimi-agent-swarm-cli
# or
bun install -g kimi-agent-swarm-cli
```

Then run:

```bash
kasw init
kasw benchmark --profile fixture-paul-graham-corpus
```

## Local Wide-Search Runtime

This repo now includes an early local runtime under `runtime/wide-search`. A single entry script at `bin/kasw` lets you run it from the repo root without `cd`.

Supported profiles:

- `fixture`: deterministic smoke tests and CI
- `fixture-asset-mgmt`: buyside asset management roles benchmark
- `fixture-sellside-research`: sell-side research organization roles benchmark
- `fixture-youtube-niche`: YouTube niche opportunities benchmark
- `fixture-paul-graham-corpus`: Paul Graham essays benchmark
- `fixture-github-repo-landscape`: AI repo landscape benchmark
- `fixture-market-scan`: market landscape benchmark
- `local-command`: reads source candidates from a local JSONL command
- `web-search`: live web search via a configured provider

Providers:

- `mock`: deterministic demo/CI provider (default)
- `serper`: Serper.dev Google Search API (requires `SERPER_API_KEY`)
- `tavily`: Tavily AI search API (requires `TAVILY_API_KEY`, or `TAVILY_MOCK=1` for CI)
- `brave`: Brave Search API (requires `BRAVE_API_KEY`, or `BRAVE_MOCK=1` for CI)
- `github`: GitHub repository search (requires `GITHUB_TOKEN`, or `GITHUB_MOCK=1` for CI)

Examples:

```bash
# From the repo root
./bin/kasw research "Map evidence-backed research workflow requirements"

# Buyside roles benchmark
./bin/kasw research "Analyze asset management roles and responsibilities" \
  --profile fixture-asset-mgmt

# Sellside research roles benchmark
./bin/kasw research "Analyze sell-side research organization roles" \
  --profile fixture-sellside-research

# Paul Graham benchmark
./bin/kasw benchmark --profile fixture-paul-graham-corpus

# GitHub repo landscape benchmark
./bin/kasw benchmark --profile fixture-github-repo-landscape

# Market scan benchmark
./bin/kasw benchmark --profile fixture-market-scan

# List available providers
./bin/kasw providers

# Live web search with Serper (requires SERPER_API_KEY)
./bin/kasw research "AI browser agent open-source repos" \
  --profile web-search \
  --provider serper \
  --depth standard

# Live web search with Tavily (requires TAVILY_API_KEY)
./bin/kasw research "AI browser agent open-source repos" \
  --profile web-search \
  --provider tavily \
  --depth light

# Live web search with Brave (requires BRAVE_API_KEY)
./bin/kasw research "AI browser agent open-source repos" \
  --profile web-search \
  --provider brave \
  --depth light

# GitHub repo search (requires GITHUB_TOKEN)
./bin/kasw research "AI browser agent repos" \
  --profile web-search \
  --provider github \
  --depth standard
```

Cost control:

```bash
# See the cost estimate before executing
./bin/kasw research "AI browser agent open-source repos" \
  --profile web-search --provider serper --dry-run

# Enforce a budget
./bin/kasw research "AI browser agent open-source repos" \
  --profile web-search --provider serper \
  --max-cost-usd 0.10 --max-provider-calls 5
```

Export results:

```bash
RUN_DIR=$(ls -d .runs/wide-search/* | tail -1)
./bin/kasw export --run-dir "$RUN_DIR" --format json
./bin/kasw export --run-dir "$RUN_DIR" --format csv
```

First-run setup:

```bash
./bin/kasw init
# or non-interactively using existing env vars
./bin/kasw init --non-interactive
```

Configuration cascade: `~/.kasw/config.json` → project `.kasw.json` → env vars → CLI flags.

Caching and replay:

```bash
# Cache provider responses for faster/cheaper reruns
./bin/kasw research "AI browser agent repos" \
  --profile web-search --provider tavily --use-cache

# Replay a previous run with the same inputs
RUN_ID=$(ls -d .runs/wide-search/* | tail -1 | xargs basename)
./bin/kasw research --replay "$RUN_ID"
```

Distributed execution:

```bash
# In-process distributed run with 4 workers
./bin/kasw research "AI browser agent landscape" \
  --profile web-search --provider tavily --distributed --workers 4

# External worker (for multi-machine setups with Redis)
./bin/kasw worker --job-id <job-id> --worker-id machine-1

# Resume a previous distributed job
./bin/kasw research --resume-job-id <job-id> --distributed
```

The runtime writes `.runs/wide-search/<run-id>/` with `run.json`, `research-plan.json`, `source-ledger.jsonl`, `claim-ledger.jsonl`, `synthesis.md`, `verification-report.json`, `distributed-job.json`, and optionally `export.json`/`export.csv`.

Benchmark results are tracked in [BENCHMARKS.md](BENCHMARKS.md) and the live leaderboard:

```bash
# Show all recorded benchmark runs
kasw leaderboard

# Filter by profile
kasw leaderboard --profile fixture-paul-graham-corpus

# Compare specific runs
kasw leaderboard --compare <run-id-1>,<run-id-2>

# Generate an HTML report with trend charts
kasw leaderboard --html --out leaderboard-report.html
```

Every `kasw benchmark` run is automatically recorded to `~/.kasw/leaderboard.jsonl`.

Contributions are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## Repo Structure

```text
.
|-- README.md
|-- LICENSE
|-- CONTRIBUTING.md
|-- THIRD_PARTY_NOTICES.md
|-- .github/
|   |-- workflows/
|   |-- ISSUE_TEMPLATE/
|   `-- PULL_REQUEST_TEMPLATE.md
|-- docs/
|   |-- CODE_QUALITY.md
|   |-- CODE_REVIEW.md
|   `-- GITHUB_RELEASE.md
|-- runtime/
|   `-- wide-search/
|-- scripts/
|   |-- install-codex-skill.sh
|   |-- install-kimi-code-skill.sh
|   `-- sync-prompt-engineering-upstream.sh
`-- skills/
    |-- kimi-agent-swarm-prompt/
    |   |-- SKILL.md
    |   |-- agents/openai.yaml
    |   |-- references/
    |   `-- vendor/prompt-engineering-skills/
    `-- kimi-agent-swarm-cli/
        |-- SKILL.md
        `-- references/
```

The vendored prompt-engineering snapshot lives inside the Codex skill folder so the Codex install is self-contained. The Kimi Code CLI skill references the same contract shapes without duplicating the upstream vendor snapshot.

## Third-Party Prompt Engineering References

This repo includes a curated vendored snapshot from `treylom/prompt-engineering-skills`.

Snapshot commit:

`74830708c75d78e72f2e48b05ea49db4ac094968`

Included subset:

- `skills/prompt-engineering-guide.md`
- `skills/research-prompt-guide.md`
- `skills/context-engineering-collection.md`
- `skills/gpt-5.5-prompt-enhancement.md`
- upstream `README.md`
- upstream `LICENSE`

The upstream project is MIT-licensed. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Safety Notes

- Treat current model rankings, pricing, availability, and benchmark claims as stale by default.
- Verify current claims against official sources before presenting them as current facts.
- Treat `kimi --print` as non-interactive automation with approval risk.
- Prefer interactive Kimi or disposable worktrees for write-capable code tasks.
- Use verifier output and local ledgers as source of truth, not LLM summaries.

## GitHub Release Checklist

Before publishing:

- No local absolute paths in the repo.
- `skills/kimi-agent-swarm-prompt/agents/openai.yaml` parses as YAML.
- `skills/kimi-agent-swarm-cli/SKILL.md` frontmatter parses as YAML.
- `scripts/install-codex-skill.sh` installs into a temp `CODEX_HOME`.
- `scripts/install-kimi-code-skill.sh` installs into a temp `KIMI_CODE_HOME`.
- `THIRD_PARTY_NOTICES.md` names upstream repo, license, snapshot commit, and included files.
- README says unofficial and does not claim hosted Kimi Agent Swarm parity.
- [docs/CODE_QUALITY.md](docs/CODE_QUALITY.md) quality gates pass.
- [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md) review checklist passes.
- GitHub authentication is valid for the target owner.

Detailed release notes and commands are in [docs/GITHUB_RELEASE.md](docs/GITHUB_RELEASE.md).

## License

MIT. See [LICENSE](LICENSE).
