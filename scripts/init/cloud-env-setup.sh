#!/usr/bin/env bash
# The setup of a Claude Code cloud environment for this repository. The
# environment's setup script runs it. It installs only what does not depend on
# the checked-out code, because the environment keeps the result for later
# sessions.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."

source scripts/init/cloud-env.sh
cloud_env_install
scripts/init/init.sh --tools
