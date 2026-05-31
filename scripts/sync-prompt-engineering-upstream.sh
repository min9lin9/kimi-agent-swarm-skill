#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/prompt-engineering-skills" >&2
  exit 2
fi

UPSTREAM_DIR="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/skills/kimi-agent-swarm-prompt/vendor/prompt-engineering-skills"

mkdir -p "$VENDOR_DIR/skills"
cp "$UPSTREAM_DIR/LICENSE" "$VENDOR_DIR/LICENSE"
cp "$UPSTREAM_DIR/README.md" "$VENDOR_DIR/README.md"
cp "$UPSTREAM_DIR/skills/prompt-engineering-guide.md" "$VENDOR_DIR/skills/"
cp "$UPSTREAM_DIR/skills/research-prompt-guide.md" "$VENDOR_DIR/skills/"
cp "$UPSTREAM_DIR/skills/context-engineering-collection.md" "$VENDOR_DIR/skills/"
cp "$UPSTREAM_DIR/skills/gpt-5.5-prompt-enhancement.md" "$VENDOR_DIR/skills/"

echo "Synced curated prompt-engineering-skills snapshot into $VENDOR_DIR"
