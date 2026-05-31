#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST_DIR="${CODEX_HOME:-$HOME/.codex}/skills"

mkdir -p "$DEST_DIR"
cp -R "$ROOT_DIR/skills/kimi-agent-swarm-prompt" "$DEST_DIR/"

echo "Installed Codex-only skill to $DEST_DIR/kimi-agent-swarm-prompt"

