#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Kimi Code CLI respects KIMI_CODE_HOME; default to ~/.kimi-code
KIMI_CODE_HOME="${KIMI_CODE_HOME:-${HOME}/.kimi-code}"
SKILLS_DIR="${KIMI_CODE_HOME}/skills"

echo "Installing Kimi Code CLI skill into ${SKILLS_DIR}"

mkdir -p "${SKILLS_DIR}"
rm -rf "${SKILLS_DIR}/kimi-agent-swarm-cli"
cp -R "${REPO_ROOT}/skills/kimi-agent-swarm-cli" "${SKILLS_DIR}/"

echo "Installed: ${SKILLS_DIR}/kimi-agent-swarm-cli"
echo "Restart Kimi Code CLI or start a new session to load the skill."
echo "Invoke with: /skill:kimi-agent-swarm-cli <objective>"
