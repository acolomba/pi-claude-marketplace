#!/usr/bin/env bash
# The setup of a Claude Code cloud environment: what does not depend on the
# branch. The environment's setup script runs it, and Claude Code starts after
# it, so the agent tooling it installs loads in the session. Claude Code reads
# .claude/agents only at startup.
#
# It installs the machine tools (scripts/cloud-env.sh) and this checkout's agent
# tooling (scripts/init.sh --tools). The dependencies and the CodeGraph index
# depend on the checked-out code, so scripts/init-session.sh installs them at
# every session start.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

source scripts/cloud-env.sh
cloud_env_install
scripts/init.sh --tools
