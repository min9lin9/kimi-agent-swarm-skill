# Code Quality Guide

This repository is a Codex-only skill package. Quality checks focus on installability, prompt-safety, licensing, and reproducible packaging rather than application runtime tests.

## Quality Gates

Run from the repository root:

```bash
rg "/Users/|/private|Documents/Codex|dmae97" . -g '!docs/GITHUB_RELEASE.md' || true
ruby -e 'require "yaml"; YAML.load_file("skills/kimi-agent-swarm-prompt/agents/openai.yaml"); puts "openai.yaml ok"'
bash -n scripts/install-codex-skill.sh
bash -n scripts/sync-prompt-engineering-upstream.sh
tmpdir=$(mktemp -d); CODEX_HOME="$tmpdir" scripts/install-codex-skill.sh
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/SKILL.md"
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/vendor/prompt-engineering-skills/LICENSE"
```

Expected result:

- No local absolute path matches.
- `openai.yaml` parses.
- Shell scripts pass syntax checks.
- Clean temp install succeeds.
- Vendored prompt-engineering license is included in the installed skill.

## Skill Quality Checklist

- `SKILL.md` frontmatter has clear `name` and `description`.
- The description says this is Codex-only.
- `SKILL.md` is concise and routes detailed material to `references/`.
- References avoid local absolute paths.
- Execution instructions require approval before Kimi, network-heavy, external provider, or write-capable runs.
- Capability boundary says this is not hosted Kimi Agent Swarm parity.
- Installed skill is self-contained.

## Documentation Quality Checklist

- README says Codex-only in the first viewport.
- README says unofficial and not affiliated with Moonshot AI, Kimi, or `treylom/prompt-engineering-skills`.
- README includes install commands and invocation examples.
- README links to `THIRD_PARTY_NOTICES.md`.
- README links to `docs/GITHUB_RELEASE.md`.
- `docs/GITHUB_RELEASE.md` includes GitHub metadata, release steps, and release notes.
- `docs/CODE_REVIEW.md` contains the review checklist for future changes.

## Third-Party Quality Checklist

- Upstream MIT license is preserved under `skills/kimi-agent-swarm-prompt/vendor/prompt-engineering-skills/LICENSE`.
- `THIRD_PARTY_NOTICES.md` names the upstream repo, license, snapshot commit, included files, and modification status.
- Vendored files remain unmodified unless the notice file is updated.
- Model availability, model rankings, pricing, benchmark, and "latest" claims are treated as stale by default.

## Release Quality Rule

Do not tag or push a public release until:

- Quality gates pass.
- Code review checklist passes.
- Working tree is clean.
- GitHub auth is valid for the target owner.

