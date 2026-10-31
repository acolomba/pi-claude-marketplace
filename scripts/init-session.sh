#!/usr/bin/env bash
set -euo pipefail

# The desktop app runs SessionStart hooks from the main checkout, with
# CLAUDE_PROJECT_DIR set to it, and passes the session's own worktree as the
# input's cwd, so the worktree comes from the input. A run by hand has no input.
cwd=$(node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd' 2>/dev/null) || cwd=$PWD

# only a linked worktree, once: the desktop app copies the main checkout's
# gitignored .claude files into a new worktree, so the marker lives in
# node_modules, which init.sh writes last
top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0

# A Claude Code cloud session, on every start and resume: the VM settings
# that scripts/cloud-env.sh describes, exported for the session's Bash
# commands too. When the environment's setup script ran scripts/init.sh before
# launch, only node_modules is refreshed, because the clone can carry a newer
# package-lock.json than the cached VM. Otherwise everything installs now,
# after launch, and Claude Code reads subagent definitions and starts MCP
# servers only at launch, so GSD's subagents and the codegraph and fallow MCP
# servers wait for the next session.
if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
    cd -- "$top"
    source scripts/cloud-env.sh
    # Claude Code sets CLAUDE_ENV_FILE for a SessionStart hook; a run by hand
    # has none
    if [[ -n ${CLAUDE_ENV_FILE-} ]]; then
        cloud_session_exports >>"$CLAUDE_ENV_FILE"
    fi

    git lfs install --local --skip-smudge >/dev/null
    if [[ -e node_modules/.init-done ]]; then
        npm install --no-audit --no-fund >/dev/null
        echo "scripts/init-session.sh: tools already installed; refreshed node_modules."
        exit 0
    fi

    mkdir -p node_modules
    scripts/init.sh >node_modules/.init.log 2>&1 ||
        echo "scripts/init.sh failed; see $top/node_modules/.init.log" >&2
    echo "scripts/init-session.sh: installed Node 24, pre-commit, npm dependencies, GSD, skills, codegraph, and fallow after Claude Code launched. GSD's subagents (gsd-planner, gsd-executor, ...) and the codegraph and fallow MCP servers are available from the next session on; in this one, /gsd-* commands that spawn subagents fail, so use \`codegraph explore\` and \`npx fallow\` from the shell. To have everything at launch, set the environment's setup script to \`$top/scripts/init.sh\` (see CONTRIBUTING.md). Log: $top/node_modules/.init.log"
    exit 0
fi

[[ $(git -C "$top" rev-parse --path-format=absolute --git-dir) != "$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)" ]] || exit 0
[[ ! -e $top/node_modules/.init-done ]] || exit 0

mkdir -p "$top/node_modules"
"$top/scripts/init.sh" >"$top/node_modules/.init.log" 2>&1 ||
    echo "scripts/init.sh failed; see $top/node_modules/.init.log" >&2
