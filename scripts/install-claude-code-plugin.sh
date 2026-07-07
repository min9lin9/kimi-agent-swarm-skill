#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_SRC="${REPO_ROOT}/claude-plugin"

usage() {
  cat <<'EOF'
Usage: scripts/install-claude-code-plugin.sh [user|project] [project_dir]

Installs the bundled Claude Code plugin as a skill/plugin-compatible directory.

Modes:
  user      Install under ${CLAUDE_HOME:-~/.claude}/plugins/kimi-agent-swarm
  project   Install under <project_dir>/.claude/plugins/kimi-agent-swarm

For one-off development without copying, run:
  claude --plugin-dir ./claude-plugin
EOF
}

MODE="${1:-user}"
PROJECT_DIR="${2:-$PWD}"

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
  usage
  exit 0
fi

if [[ ! -f "${PLUGIN_SRC}/.claude-plugin/plugin.json" ]]; then
  echo "Claude plugin source not found at ${PLUGIN_SRC}" >&2
  exit 1
fi

case "${MODE}" in
  user)
    CLAUDE_HOME="${CLAUDE_HOME:-${HOME}/.claude}"
    DEST_DIR="${CLAUDE_HOME}/plugins/kimi-agent-swarm"
    ;;
  project|local)
    DEST_DIR="${PROJECT_DIR}/.claude/plugins/kimi-agent-swarm"
    ;;
  *)
    echo "Unknown install mode: ${MODE}" >&2
    usage >&2
    exit 1
    ;;
esac

mkdir -p "$(dirname "${DEST_DIR}")"
rm -rf "${DEST_DIR}"
cp -R "${PLUGIN_SRC}" "${DEST_DIR}"

cat <<EOF
Installed Claude Code plugin to:
  ${DEST_DIR}

Restart Claude Code or run /reload-plugins if plugins are already loaded.
For local development without copying, use:
  claude --plugin-dir ${PLUGIN_SRC}
EOF
