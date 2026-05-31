# Kimi Agent Swarm Skill

Codex-only skill for refining rough user intent into a prompt contract, then routing the approved prompt into Kimi Agent Swarm-style research, Kimi Code subagent, Search Swarm+, or OMK-lite workflows.

Status: `v0.1.0-pre`

This repository is **Codex-only**. It is not a Claude Code skill pack, ChatGPT GPT, Gemini Gem, or hosted Kimi Agent Swarm clone.

This project is unofficial and is not affiliated with Moonshot AI, Kimi, or `treylom/prompt-engineering-skills`.

## What It Does

- Turns a rough user request into a structured prompt contract.
- Uses bundled prompt-engineering references before execution.
- Classifies work into `prompt-only`, `wide-search`, `kimi-code`, or `hybrid`.
- Presents an approval card before Kimi, external provider, network-heavy, or write-capable execution.
- Reports command evidence, ledger paths, verification results, and unresolved risks.

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

## Optional Search Swarm+ Harness

For `wide-search` mode, configure a local Search Swarm+ harness:

```bash
export KIMI_SWARM_HARNESS_DIR=/absolute/path/to/search-swarm-plus
```

Expected harness commands:

```bash
npm run doctor
npm run provider-doctor -- --provider command --command /absolute/path/to/provider
npm run run -- "research objective"
npm run verify
npm run inspect
```

If no harness exists, the skill should stop after producing the refined prompt contract and approval card.

## Repo Structure

```text
.
|-- README.md
|-- LICENSE
|-- THIRD_PARTY_NOTICES.md
|-- scripts/
|   |-- install-codex-skill.sh
|   `-- sync-prompt-engineering-upstream.sh
`-- skills/
    `-- kimi-agent-swarm-prompt/
        |-- SKILL.md
        |-- agents/openai.yaml
        |-- references/
        `-- vendor/prompt-engineering-skills/
```

The vendored prompt-engineering snapshot lives inside the skill folder so the Codex install is self-contained.

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
- `scripts/install-codex-skill.sh` installs into a temp `CODEX_HOME`.
- `THIRD_PARTY_NOTICES.md` names upstream repo, license, snapshot commit, and included files.
- README says Codex-only and unofficial.
- GitHub authentication is valid for the target owner.

Detailed release notes and commands are in [docs/GITHUB_RELEASE.md](docs/GITHUB_RELEASE.md).

## License

MIT. See [LICENSE](LICENSE).
