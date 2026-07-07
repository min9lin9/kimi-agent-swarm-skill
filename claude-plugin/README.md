# Kimi Agent Swarm Claude Code Plugin

This directory is a Claude Code plugin package for Kimi Agent Swarm-style prompt contracts, wide-search evidence packages, Gajae-Code handoffs, and public URL fallback through the local `kasw` runtime.

## Develop locally

From the repository root:

```bash
claude --plugin-dir ./claude-plugin
```

Invoke the namespaced plugin skill:

```text
/kimi-agent-swarm:kimi-agent-swarm --wide-search "Compare open-source AI browser agent repos"
```

The plugin path loads both the skill and the router hook.

## Short-name standalone install

For normal user/project installs, use the repository installer. It copies only the skill into `.claude/skills` so the invocation is shorter:

```bash
./scripts/install-claude-code-plugin.sh user
# or
./scripts/install-claude-code-plugin.sh project /path/to/project
```

Then invoke:

```text
/kimi-agent-swarm --wide-search "Compare open-source AI browser agent repos"
```

## Runtime fallback

When the `kasw` CLI is available, the skill can call:

```bash
kasw research "<objective>" --profile web-search --provider <mock|serper|tavily|brave|github|insane-search>
```

Use the `insane-search` provider only for public URLs that need a local public-page fallback adapter.
