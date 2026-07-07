#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

dry_run=false
if [[ "${1:-}" == "--dry-run" ]]; then
  dry_run=true
  shift
fi
if [[ $# -gt 0 ]]; then
  echo "Usage: bash scripts/publish.sh [--dry-run]" >&2
  exit 2
fi

package_name="$(bun -p 'require("./package.json").name')"
package_version="$(bun -p 'require("./package.json").version')"

set +e
published_version="$(npm view "${package_name}@${package_version}" version 2>&1)"
npm_view_status=$?
set -e
if [[ $npm_view_status -ne 0 && "$published_version" != *"E404"* && "$published_version" != *"404"* ]]; then
  echo "$published_version" >&2
  exit "$npm_view_status"
fi
if [[ "$published_version" == "$package_version" ]]; then
  echo "${package_name}@${package_version} is already published on npm." >&2
  echo "Bump runtime/wide-search/package.json, update release docs, then rerun this helper." >&2
  exit 1
fi

echo "Running publish quality gate..."
bun run prepublishOnly

echo "Packing..."
npm pack --dry-run

if [[ "$dry_run" == true ]]; then
  echo "Publish dry-run complete. To publish, run:"
else
  echo "Publish preflight complete. To publish, run:"
fi
echo "  npm publish --access public"
