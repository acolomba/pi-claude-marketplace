#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

export PATH="$PATH:$HOME/.local/bin:$(npm prefix --global)/bin"

# empty outside a Claude Code cloud VM. There, scripts/cloud-env.sh sets it
# and installs what the VM lacks.
lfs_install_flags=""
if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
    source scripts/cloud-env.sh
    cloud_env_install
fi

# git
export GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never
# shellcheck disable=SC2086 -- the variable holds zero or more flags
git lfs install --local $lfs_install_flags

# pre-commit, with pipx or uv
if ! command -v pre-commit >/dev/null 2>&1; then
    if command -v pipx >/dev/null 2>&1; then
        pipx install pre-commit
        PATH="$PATH:$(pipx environment --value PIPX_BIN_DIR)"
    elif command -v uv >/dev/null 2>&1; then
        uv tool install pre-commit
        PATH="$PATH:$(uv tool dir --bin)"
    else
        echo "scripts/init.sh: install pipx or uv first" >&2
        exit 1
    fi
fi

pre-commit install

# npm
npm install

# skills
npx --yes skills@latest add blader/humanizer -a universal claude-code -y
npx --yes skills@latest add AminBlg/SimpleEnglish -a universal claude-code -y
npx --yes skills@latest add humanlayer/skills --skill show-me -a universal claude-code -y

# gsd
npx --yes @opengsd/gsd-core@latest --install --local --claude --codex --force-statusline
node .codex/gsd-core/bin/gsd-tools.cjs capability install \
    ./gsd-capabilities/discuss-agent-skills \
    --scope project \
    --yes

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

# normalize AGENTS.md; a fixer that changes it exits 1 too
pre-commit run --files AGENTS.md ||
    echo "scripts/init.sh: pre-commit changed AGENTS.md or failed; see git diff AGENTS.md" >&2

# init-session.sh and cloud-env.sh read this marker
touch node_modules/.init-done
