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

if [[ -z $(git config --get core.hooksPath || true) ]]; then
    pre-commit install
fi

# npm
npm install

# gsd
npx --yes @opengsd/gsd-core@latest --install --local --claude --codex --force-statusline

# codegraph
if ! command -v codegraph >/dev/null 2>&1; then
    npm install --global @colbymchenry/codegraph
fi

codegraph install --target claude,codex --location local --no-permissions --init --yes

# keeps codegraph changes visible to codex/pi
[[ -f .claude/CLAUDE.md ]] && { grep -q CODEGRAPH_START CLAUDE.md || cat .claude/CLAUDE.md >>CLAUDE.md; } && rm .claude/CLAUDE.md
rm -f AGENTS.md
