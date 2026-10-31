#!/usr/bin/env bash
set -euo pipefail

# The desktop app runs SessionStart hooks from the main checkout and passes
# the session's worktree as the input's cwd. A run by hand has no input.
cwd=$(node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd' 2>/dev/null) || cwd=$PWD

top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0

# A Claude Code cloud VM: apply its settings, export them for the session's
# Bash commands, and run init.sh unless a run has completed in this clone.
if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
    cd -- "$top"
    source scripts/cloud-env.sh
    if [[ -n ${CLAUDE_ENV_FILE-} ]]; then
        cloud_session_exports >>"$CLAUDE_ENV_FILE"
    fi

    git lfs install --local --skip-smudge >/dev/null
    if [[ -e node_modules/.init-done ]]; then
        npm install --no-audit --no-fund >/dev/null
        exit 0
    fi

    mkdir -p node_modules
    scripts/init.sh >node_modules/.init.log 2>&1 ||
        echo "scripts/init.sh failed; see $top/node_modules/.init.log" >&2
    echo "scripts/init-session.sh ran scripts/init.sh. Subagents and MCP servers load at the next session."
    exit 0
fi

# A linked worktree, once: the desktop app copies the main checkout's
# gitignored .claude files into a new worktree, so the marker lives in
# node_modules, which init.sh writes last.
[[ $(git -C "$top" rev-parse --path-format=absolute --git-dir) != "$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)" ]] || exit 0
[[ ! -e $top/node_modules/.init-done ]] || exit 0

mkdir -p "$top/node_modules"
"$top/scripts/init.sh" >"$top/node_modules/.init.log" 2>&1 ||
    echo "scripts/init.sh failed; see $top/node_modules/.init.log" >&2
