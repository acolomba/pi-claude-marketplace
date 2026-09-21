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

# skills
npx --yes skills@latest add blader/humanizer -a universal claude-code -y
npx --yes skills@latest add AminBlg/SimpleEnglish -a universal claude-code -y

# gsd
npx --yes @opengsd/gsd-core@latest --install --local --claude --codex --force-statusline

# codegraph
if ! command -v codegraph >/dev/null 2>&1; then
    npm install --global @colbymchenry/codegraph
fi

codegraph install --target claude,codex --location local --no-permissions --init --yes

# removes the generated per-tool copy, which would shadow the root file
rm -f .claude/CLAUDE.md

# fallow: AGENTS.md task map, skill pointers, MCP registration (no commit gate;
# pre-commit already runs the full `npm run fallow`)
npx fallow agent install --harness claude --harness codex --without hooks --approve

# removes the generated `@AGENTS.md` import shim; AGENTS.md is the canonical file
rm -f CLAUDE.md

# normalize AGENTS.md
SKIP=trufflehog pre-commit run --files AGENTS.md || true
