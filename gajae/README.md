# Gajae-Code Integration

This directory contains a Gajae-Code skill wrapper for Kimi Agent Swarm-style prompt contracts and wide-search handoffs.

## Install

From this repository:

```bash
./scripts/install-gajae-code-skill.sh
```

The installer copies `gajae/skills/kimi-agent-swarm` into:

```text
${GJC_CONFIG_DIR:-~/.gjc}/skills/kimi-agent-swarm
```

## Use

Start Gajae-Code from the target project:

```bash
gjc
```

Then invoke:

```text
/skill:kimi-agent-swarm --wide-search "Compare open-source AI browser agent repositories"
```

For implementation follow-up, let the skill produce a handoff file, then route that file through GJC's normal reviewed workflow:

```text
/skill:ralplan .gjc/_session-*/specs/kimi-agent-swarm-*.md
gjc ultragoal create-goals --brief-file .gjc/_session-*/specs/kimi-agent-swarm-*.md
```

## Boundary

This wrapper does not modify Gajae-Code itself. It runs beside GJC by providing a skill file and a handoff contract that preserves GJC's planning-before-mutation and evidence-first execution model.
