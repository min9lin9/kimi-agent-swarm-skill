# Code Review Guide

Use this guide for every change before publishing or tagging a release.

## Review Priorities

Review findings should be ordered by severity:

1. Safety or trust-boundary regressions.
2. Licensing or attribution gaps.
3. Broken install path or non-self-contained skill packaging.
4. Misleading README claims.
5. Missing verification or release checklist drift.
6. Style and clarity issues.

## Review Checklist

### Skill Behavior

- Does `SKILL.md` still say Codex-only?
- Does it refine prompts before execution?
- Does it classify work into `prompt-only`, `wide-search`, `kimi-code`, or `hybrid`?
- Does it ask only blocking questions?
- Does it require an approval card before risky execution?
- Does it report commands, ledgers, verification, and unresolved risks?
- For `wide-search`, does it require source quality filtering, ledgers, synthesis, and deterministic verification?
- For `wide-search`, does it return a readable answer first and keep provider/harness details out of normal user-facing output?

### Safety Boundary

- Does the repo avoid hosted Kimi Agent Swarm parity claims?
- Does it say unofficial and unaffiliated?
- Does it warn about Kimi `--print` and write-capable automation?
- Does it preserve deterministic verification as source of truth?
- Does it avoid assuming a local Search Swarm+ harness exists?
- Does it reject single-search answers for `wide-search` unless the user explicitly asks for a quick scan?

### Packaging

- Does `scripts/install-codex-skill.sh` install only the Codex skill?
- Is the installed skill self-contained?
- Are vendored prompt-engineering files inside the skill folder?
- Are scripts shellcheck-simple and `bash -n` clean?
- Are executable scripts committed with executable mode?
- Does `.github/workflows/quality.yml` run the same core package checks?

### Documentation

- Does README explain install, usage, workflow, optional harness, and limits?
- Does README explain `wide-search` outputs, run depth, and non-parity boundary?
- Does README describe user examples before advanced harness configuration?
- Does `docs/GITHUB_RELEASE.md` match current commands?
- Does `docs/CODE_QUALITY.md` include all required quality gates?
- Do docs avoid local absolute paths and private workspace names?
- Are public claims conservative and accurate?

### Third-Party Content

- Is the upstream MIT license preserved?
- Is `THIRD_PARTY_NOTICES.md` current?
- Is the snapshot commit listed?
- Are included upstream files listed accurately?
- Are upstream commands/instructions clearly treated as references, not Codex-native commands?

## Suggested Review Command Set

```bash
git diff --check
rg "/Users/|/private|Documents/Codex|dmae97" . -g '!docs/GITHUB_RELEASE.md' -g '!docs/CODE_QUALITY.md' -g '!docs/CODE_REVIEW.md' -g '!.github/workflows/quality.yml' || true
ruby -e 'require "yaml"; YAML.load_file("skills/kimi-agent-swarm-prompt/agents/openai.yaml"); puts "openai.yaml ok"'
bash -n scripts/install-codex-skill.sh
bash -n scripts/sync-prompt-engineering-upstream.sh
tmpdir=$(mktemp -d); CODEX_HOME="$tmpdir" scripts/install-codex-skill.sh
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/SKILL.md"
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/references/wide-search-mode.md"
test -f "$tmpdir/skills/kimi-agent-swarm-prompt/vendor/prompt-engineering-skills/LICENSE"
(cd runtime/wide-search && npm test)
git status --short
```

## Review Output Template

```markdown
Findings:
- [P0/P1/P2] <issue with file path and reason>

Open questions:
- <only if blocking>

Verification:
- <commands run and results>

Decision:
- approve | request changes
```
