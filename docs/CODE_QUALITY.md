# Code Quality Guide

This repository started as a Codex-only skill package and has grown into an evidence-backed wide-search runtime product. Quality checks cover both skill packaging and runtime correctness.

## Quality Gates

Run from the repository root:

```bash
rg "/Users/|/private|Documents/Codex|dmae97" . -g '!docs/GITHUB_RELEASE.md' -g '!docs/CODE_QUALITY.md' -g '!docs/CODE_REVIEW.md' -g '!.github/workflows/quality.yml' || true
ruby -e 'require "yaml"; YAML.load_file("skills/kimi-agent-swarm-prompt/agents/openai.yaml"); puts "openai.yaml ok"'
bash -n scripts/install-codex-skill.sh
bash -n scripts/sync-prompt-engineering-upstream.sh
tmpdir=$(mktemp -d); CODEX_HOME="$tmpdir" scripts/install-codex-skill.sh
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/SKILL.md"
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/references/wide-search-mode.md"
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/vendor/prompt-engineering-skills/LICENSE"
(cd runtime/wide-search && npm test)
```

Expected result:

- No local absolute path matches.
- `openai.yaml` parses.
- Shell scripts pass syntax checks.
- Clean temp install succeeds.
- Wide-search reference is included in the installed skill.
- Vendored prompt-engineering license is included in the installed skill.
- Wide-search runtime fixture tests pass.

## Continuous Integration

The same packaging checks run in GitHub Actions via `.github/workflows/quality.yml` on pull requests, pushes to `main`, and manual dispatch.

CI is intentionally network-free. It verifies the skill package, docs-safe metadata, shell scripts, temp `CODEX_HOME` install, and fixture-backed wide-search runtime tests without calling Kimi, hosted Agent Swarm, or external providers.

## Skill Quality Checklist

- `SKILL.md` frontmatter has clear `name` and `description`.
- The description says this is Codex-only.
- `SKILL.md` is concise and routes detailed material to `references/`.
- References avoid local absolute paths.
- Execution instructions require approval before Kimi, network-heavy, external provider, or write-capable runs.
- Capability boundary says this is not hosted Kimi Agent Swarm parity.
- `wide-search` has explicit source quality filters, ledger requirements, run profiles, and no-result fallback behavior.
- User-facing `wide-search` docs lead with goals, search depth, readable outputs, and evidence paths before provider or harness details.
- Installed skill is self-contained.

## Documentation Quality Checklist

- README says Codex-only in the first viewport.
- README says unofficial and not affiliated with Moonshot AI, Kimi, or `treylom/prompt-engineering-skills`.
- README includes install commands and invocation examples.
- README explains what `wide-search` produces in user-readable terms and keeps provider details in advanced docs.
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
- GitHub Actions quality workflow passes.
- Code review checklist passes.
- Working tree is clean.
- GitHub auth is valid for the target owner.
