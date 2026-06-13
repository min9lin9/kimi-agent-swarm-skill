#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Running typecheck and tests..."
bun run typecheck
bun test

echo "Packing..."
npm pack

echo "Publish dry-run complete. To publish, run:"
echo "  npm publish --access public"
