# Kimi Agent Swarm Skill

Codex-only skill for turning a rough request into a prompt contract, then routing the approved prompt into Kimi Agent Swarm-style research, Kimi Code subagent, Search Swarm+, or OMK-lite workflows.

This repository is **Codex-only**. It is not a Claude Code skill pack, ChatGPT GPT, Gemini Gem, or hosted Kimi Agent Swarm clone.

It is unofficial and is not affiliated with Moonshot AI, Kimi, or `treylom/prompt-engineering-skills`.

## What It Does

- Refines user input into a structured prompt contract.
- Classifies work into `prompt-only`, `wide-search`, `kimi-code`, or `hybrid`.
- Uses bundled prompt-engineering references from `treylom/prompt-engineering-skills`.
- Requires approval before Kimi, external providers, network-heavy runs, or write-capable code execution.
- Reports command evidence, run ledger paths, verification status, and unresolved risks.

## Install For Codex

```bash
git clone https://github.com/min9lin9/kimi-agent-swarm-skill.git
cd kimi-agent-swarm-skill
./scripts/install-codex-skill.sh
```

Or copy manually:

```bash
mkdir -p ~/.codex/skills
cp -R skills/kimi-agent-swarm-prompt ~/.codex/skills/
```

## Use In Codex

```text
$kimi-agent-swarm-prompt "AI browser agent open-source repos를 조사하고 비교해줘"
```

Codex will:

1. Refine the prompt using bundled prompt-engineering references.
2. Produce a prompt contract and approval card.
3. Ask only blocking questions.
4. Run the selected workflow after approval.
5. Verify artifacts and report evidence.

## Optional Search Swarm+ Harness

For `wide-search` mode, set a local harness directory:

```bash
export KIMI_SWARM_HARNESS_DIR=/absolute/path/to/search-swarm-plus
```

The harness should expose commands such as:

```bash
npm run doctor
npm run provider-doctor -- --provider command --command /absolute/path/to/provider
npm run run -- "research objective"
npm run verify
npm run inspect
```

If no harness exists, the skill should stop after prompt refinement and approval planning.

## Third-Party Prompt Engineering References

This repo includes a curated vendored snapshot from `treylom/prompt-engineering-skills` under `skills/kimi-agent-swarm-prompt/vendor/prompt-engineering-skills`.

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

## Capability Boundary

This skill does not provide hosted Kimi Agent Swarm parity. Hosted claims such as 300 subagents or 4000+ tool calls require hosted Kimi Agent Swarm or a separately provisioned distributed search system.

This repository provides a Codex operator workflow for prompt refinement, routing, evidence contracts, and verification.
