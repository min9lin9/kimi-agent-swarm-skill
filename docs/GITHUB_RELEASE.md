# GitHub Release Guide

This guide is for publishing `min9lin9/kimi-agent-swarm-skill` as a public GitHub repository.

## Release Positioning

Use this description:

`Codex-only skill for Kimi swarm-style prompt refinement and verified workflow routing.`

Use these topics:

- `codex`
- `codex-skill`
- `kimi`
- `prompt-engineering`
- `agent-workflows`
- `research-agent`
- `ai-agents`

## Public Claims

Say:

- Codex-only skill.
- Prompt contract first.
- Kimi Agent Swarm-style workflow routing.
- Optional Search Swarm+ harness support.
- Bundled MIT-licensed prompt-engineering references.

Do not say:

- Hosted Kimi Agent Swarm clone.
- Same performance as Kimi Agent Swarm.
- Official Kimi or Moonshot AI project.
- Official `treylom/prompt-engineering-skills` distribution.

## Pre-Push Checklist

Run from the repo root:

```bash
rg "/Users/|/private|Documents/Codex|dmae97" . -g '!docs/GITHUB_RELEASE.md' || true
ruby -e 'require "yaml"; YAML.load_file("skills/kimi-agent-swarm-prompt/agents/openai.yaml"); puts "openai.yaml ok"'
tmpdir=$(mktemp -d); CODEX_HOME="$tmpdir" scripts/install-codex-skill.sh
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/SKILL.md"
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/vendor/prompt-engineering-skills/LICENSE"
git status --short
```

Expected:

- No local absolute path matches.
- YAML parses.
- Temp install succeeds.
- Working tree is clean before push.

## Create Public Repository

After GitHub auth is valid:

```bash
gh auth status
gh repo create min9lin9/kimi-agent-swarm-skill --public --source . --remote origin --push
```

If the remote already exists:

```bash
git remote add origin https://github.com/min9lin9/kimi-agent-swarm-skill.git
git push -u origin main
```

## First Release

Recommended tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Release title:

`v0.1.0 - Codex-only Kimi swarm prompt skill`

Release notes:

```markdown
Initial public release.

- Adds Codex-only `kimi-agent-swarm-prompt` skill.
- Bundles curated MIT-licensed prompt-engineering references.
- Supports prompt-only, wide-search, kimi-code, and hybrid routing.
- Documents optional Search Swarm+ harness integration.
- Includes install and upstream sync scripts.
```

## README Review Criteria

The README should answer these questions without scrolling far:

- Is this for Codex? Yes.
- Is it official Kimi? No.
- What does it do? Refines prompts into contracts and routes workflows.
- How do I install it? One script or manual copy.
- How do I invoke it? `$kimi-agent-swarm-prompt "..."`
- What third-party content is included? Curated MIT snapshot from `treylom/prompt-engineering-skills`.
- What are the limits? No hosted Kimi Agent Swarm parity claim.

## Maintenance Notes

When updating vendored prompt-engineering references:

```bash
./scripts/sync-prompt-engineering-upstream.sh /path/to/prompt-engineering-skills
```

Then update:

- `THIRD_PARTY_NOTICES.md`
- README snapshot commit
- `skills/kimi-agent-swarm-prompt/references/upstream-prompt-engineering.md` if included files change
