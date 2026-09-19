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
# the installer refreshes each hash in skills-lock.json to whatever it fetched.
# updating a skill is a deliberate step (see CONTRIBUTING.md), so a lock that
# was clean before the install is restored after it.
lock_clean=0
git diff --quiet -- skills-lock.json && lock_clean=1
npx --yes skills@latest experimental_install
if [[ $lock_clean == 1 ]]; then
    git checkout -- skills-lock.json
fi

# gsd
npx --yes @opengsd/gsd-core@latest --install --local --claude --codex --force-statusline

# codegraph
if ! command -v codegraph >/dev/null 2>&1; then
    npm install --global @colbymchenry/codegraph
fi

codegraph install --target claude,codex --location local --no-permissions --init --yes

# removes the generated per-tool copy, which would shadow the root file
rm -f .claude/CLAUDE.md
