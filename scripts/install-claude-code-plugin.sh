#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_SRC="${REPO_ROOT}/claude-plugin"
SKILL_SRC="${PLUGIN_SRC}/skills/kimi-agent-swarm"

usage() {
  cat <<'EOF'
Usage: scripts/install-claude-code-plugin.sh [user|project] [project_dir]

Installs the bundled Claude Code skill for short-name invocation.

Modes:
  user      Install under ${CLAUDE_HOME:-~/.claude}/skills/kimi-agent-swarm
  project   Install under <project_dir>/.claude/skills/kimi-agent-swarm

For full plugin development, including the router hook, run:
  claude --plugin-dir ./claude-plugin
EOF
}

MODE="${1:-user}"
PROJECT_DIR="${2:-$PWD}"

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ ! -f "${SKILL_SRC}/SKILL.md" ]]; then
  echo "Claude skill source not found at ${SKILL_SRC}" >&2
  exit 1
fi

case "${MODE}" in
  user)
    CLAUDE_HOME="${CLAUDE_HOME:-${HOME}/.claude}"
    DEST_DIR="${CLAUDE_HOME}/skills/kimi-agent-swarm"
    ;;
  project|local)
    DEST_DIR="${PROJECT_DIR}/.claude/skills/kimi-agent-swarm"
    ;;
  *)
    echo "Unknown install mode: ${MODE}" >&2
    usage >&2
    exit 1
    ;;
esac

mkdir -p "$(dirname "${DEST_DIR}")"
rm -rf "${DEST_DIR}"
cp -R "${SKILL_SRC}" "${DEST_DIR}"

cat <<EOF
Installed Claude Code standalone skill to:
  ${DEST_DIR}

Restart Claude Code or run /reload-plugins if skills are already loaded.
Invoke with:
  /kimi-agent-swarm "<objective>"

For local plugin development with hooks, use:
  claude --plugin-dir ${PLUGIN_SRC}
EOF
