# Claude Code and Gajae-Code Integration

This guide explains how to use the repository's Kimi Agent Swarm-style prompt contract, wide-search runtime, and evidence workflow from Claude Code and Gajae-Code.

The integration is intentionally conservative:

- it does not claim hosted Kimi Agent Swarm parity;
- it respects private or restricted access boundaries;
- it preserves host-specific approval and verification boundaries;
- it keeps public web content as untrusted evidence, not instructions.

## Claude Code

Two Claude Code paths are provided:

1. **Full plugin development** via `claude --plugin-dir ./claude-plugin`. This loads the plugin manifest, namespaced skill, and router hook.
2. **Standalone skill install** via `scripts/install-claude-code-plugin.sh`. This copies only the skill into `.claude/skills` for short-name invocation.

### Full plugin development run

From this repository:

```bash
claude --plugin-dir ./claude-plugin
```

Then invoke the namespaced plugin skill in Claude Code:

```text
/kimi-agent-swarm:kimi-agent-swarm --wide-search "Compare open-source AI browser agent repos"
```

The plugin path also loads the lightweight `UserPromptSubmit` router hook.

### User standalone skill install

```bash
./scripts/install-claude-code-plugin.sh user
```

This copies the skill to:

```text
${CLAUDE_HOME:-~/.claude}/skills/kimi-agent-swarm
```

Restart Claude Code or run `/reload-plugins` after install, then invoke:

```text
/kimi-agent-swarm --wide-search "Compare open-source AI browser agent repos"
```

### Project standalone skill install

```bash
./scripts/install-claude-code-plugin.sh project /path/to/project
```

This copies the skill to:

```text
/path/to/project/.claude/skills/kimi-agent-swarm
```

### Claude Code behavior

The plugin package provides:

- `skills/kimi-agent-swarm/SKILL.md`: the main Claude Code skill;
- `hooks/hooks.json`: a lightweight `UserPromptSubmit` router hint;
- `hooks/router.sh`: trigger detection for wide-search, Gajae, blocked URL, verification, and Kimi swarm prompts.

The hook only adds routing context. The skill still requires approval before network-heavy, paid, or write-capable execution.

## Gajae-Code

### Install

```bash
./scripts/install-gajae-code-skill.sh
```

This copies the skill to:

```text
${GJC_CONFIG_DIR:-~/.gjc}/skills/kimi-agent-swarm
```

### Use

Start Gajae-Code from the target project:

```bash
gjc
```

Invoke the skill:

```text
/skill:kimi-agent-swarm --wide-search "Map AI browser agent repositories"
```

For implementation follow-up, route the generated handoff through GJC's reviewed workflow:

```text
/skill:ralplan .gjc/_session-*/specs/kimi-agent-swarm-*.md
gjc ultragoal create-goals --brief-file .gjc/_session-*/specs/kimi-agent-swarm-*.md
```

Use `gjc team ...` only when coordinated tmux workers materially help.

## Insane-Search-Compatible Public URL Fallback

The wide-search runtime now includes an `insane-search` provider. It is designed to wrap a local `fivetaku/insane-search`-compatible command and convert public page extraction output into normal KASW source ledgers.

### Smoke test

```bash
INSANE_SEARCH_MOCK=1 ./bin/kasw research \
  "Read https://example.com/public-page" \
  --profile web-search \
  --provider insane-search
```

### Real local adapter

```bash
export INSANE_SEARCH_COMMAND=python3
export INSANE_SEARCH_ARGS="-m engine --json"
export INSANE_SEARCH_CWD=/absolute/path/to/insane-search

./bin/kasw research \
  "Read https://example.com/public-page" \
  --profile web-search \
  --provider insane-search
```

Optional controls:

```bash
export INSANE_SEARCH_URLS="https://example.com/a https://example.com/b"
export INSANE_SEARCH_TIMEOUT_MS=120000
```

The provider stops when a page requires non-public access.

## Fablize-Style Verification Discipline

For multi-step implementation, debugging, and render/executable artifacts, use the transferable procedure from fablize:

- split multi-step tasks into verifiable stories;
- reproduce and investigate before fixing unknown-cause bugs;
- run or render artifacts whose correctness depends on runtime behavior;
- cite current-session evidence before completion claims.

This is a procedural discipline, not a model-capability upgrade.

## Insane-Research-Style Deep Research Contract

For deep research requests:

1. scope the question;
2. split into 3-5 lanes;
3. collect sources in parallel when possible;
4. grade sources A-E;
5. cross-verify key claims;
6. preserve source ledger, claim ledger, synthesis, and verifier report;
7. surface coverage gaps.

## Expected Evidence

A completed wide-search run should write:

```text
.runs/wide-search/<run-id>/
├── run.json
├── research-plan.json
├── source-ledger.jsonl
├── claim-ledger.jsonl
├── synthesis.md
└── verification-report.json
```

Treat the verifier report and ledgers as the source of truth.
