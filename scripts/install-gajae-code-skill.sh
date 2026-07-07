#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_SRC="${REPO_ROOT}/gajae/skills/kimi-agent-swarm"
GJC_HOME="${GJC_CONFIG_DIR:-${HOME}/.gjc}"
SKILLS_DIR="${GJC_HOME}/skills"
DEST_DIR="${SKILLS_DIR}/kimi-agent-swarm"

if [[ ! -f "${SKILL_SRC}/SKILL.md" ]]; then
  echo "Gajae-Code skill source not found at ${SKILL_SRC}" >&2
  exit 1
fi

mkdir -p "${SKILLS_DIR}"
rm -rf "${DEST_DIR}"
cp -R "${SKILL_SRC}" "${DEST_DIR}"

cat <<EOF
Installed Gajae-Code skill to:
  ${DEST_DIR}

Start Gajae-Code in your target project and invoke:
  /skill:kimi-agent-swarm --wide-search "<objective>"

Inspect installed skills with:
  gjc skills list
  gjc skills read kimi-agent-swarm
EOF
