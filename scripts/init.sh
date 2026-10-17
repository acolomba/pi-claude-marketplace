#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

export PATH="$PATH:$HOME/.local/bin:$(npm prefix --global)/bin"

# git
export GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never
git lfs install --local

# pre-commit
if ! command -v pre-commit >/dev/null 2>&1; then
    pipx install pre-commit
    PATH="$PATH:$(pipx environment --value PIPX_BIN_DIR)"
fi

# the gsd-path guard chains this hook; reinstalling it would drop the guard
grep -qs 'gsd-path guard' .git/hooks/pre-commit || pre-commit install

# npm
npm install

# skills
npx --yes skills@latest add blader/humanizer -a universal claude-code -y
npx --yes skills@latest add AminBlg/SimpleEnglish -a universal claude-code -y

# gsd-path: skills, project contracts, and guard hooks. A first install refuses
# an existing project, so later runs refresh in place
gsd_path_args=(--local --claude --codex --project . --hooks)
[[ ! -e .gsd-path/runtime.json ]] || gsd_path_args=(--update "${gsd_path_args[@]}")
npx --yes @opengsd/gsd-path@latest "${gsd_path_args[@]}"

# codegraph
if ! command -v codegraph >/dev/null 2>&1; then
    npm install --global @colbymchenry/codegraph
fi

codegraph install --target claude,codex --location local --no-permissions --init --yes

# removes the generated per-tool copy, which would shadow the root file
rm -f .claude/CLAUDE.md

# fallow: skill pointers and MCP registration. No commit gate: the commit hook
# already runs `npm run fallow`. No guide: it rewrites AGENTS.md and adds a
# CLAUDE.md import shim. The Fallow task map in AGENTS.md is kept by hand and
# no longer refreshes on fallow upgrades.
npx fallow agent install --harness claude --harness codex --without hooks --without guide --approve
