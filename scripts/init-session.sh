#!/usr/bin/env bash
set -euo pipefail

# The desktop app runs SessionStart hooks from the main checkout and passes
# the session's worktree as the input's cwd, so the worktree comes from the
# input. A run by hand has no input, and an input without cwd prints the
# string `undefined`.
cwd=$(node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd ?? ""' 2>/dev/null) || cwd=$PWD
[[ -n $cwd && $cwd != undefined && $cwd != null ]] || cwd=$PWD

if ! top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null); then
    if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
        echo "scripts/init-session.sh: $cwd is not in a git repository. Nothing set up."
    fi
    exit 0
fi

# A Claude Code cloud VM: export its settings for the session's Bash commands
# first, then install, then run init.sh unless a run has completed in this
# clone. Every message goes to stdout: stdout reaches the session, stderr of
# a hook that exits 0 does not.
if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
    log=$top/node_modules/.init.log
    # The trap writes to a copy of the hook's stdout, because the failing
    # command can have redirected its own. set -E extends the trap to the
    # sourced functions.
    exec 3>&1
    set -E
    trap 'echo "scripts/init-session.sh: aborted at line $LINENO. See $log" >&3; exit 0' ERR
    cd -- "$top"
    source scripts/cloud-env.sh
    mkdir -p node_modules
    if [[ -z ${CLAUDE_ENV_FILE-} ]]; then
        echo "scripts/init-session.sh: CLAUDE_ENV_FILE is unset. Run 'source scripts/cloud-env.sh' from the repository root before Node commands."
    elif ! grep -qsF "$cloud_env_marker" "$CLAUDE_ENV_FILE"; then
        cloud_session_exports >>"$CLAUDE_ENV_FILE"
    fi

    if ! cloud_env_install >>"$log" 2>&1; then
        echo "scripts/cloud-env.sh failed. See $log"
        tail -n 5 "$log"
        exit 0
    fi

    if [[ -e node_modules/.init-done ]]; then
        # shellcheck disable=SC2086 -- the variable holds zero or more flags
        if ! { git lfs install --local $lfs_install_flags && npm install --no-audit --no-fund; } >>"$log" 2>&1; then
            echo "scripts/init-session.sh: the node_modules refresh failed. See $log"
        fi

        exit 0
    fi

    if scripts/init.sh >>"$log" 2>&1; then
        echo "scripts/init-session.sh ran scripts/init.sh. Subagents and MCP servers load at the next session."
    else
        echo "scripts/init.sh failed. See $log"
        tail -n 5 "$log"
    fi

    exit 0
fi

# A linked worktree, once: the desktop app copies the main checkout's
# gitignored .claude files into a new worktree, so the marker lives in
# node_modules, which init.sh writes last.
[[ $(git -C "$top" rev-parse --path-format=absolute --git-dir) != "$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)" ]] || exit 0
[[ ! -e $top/node_modules/.init-done ]] || exit 0

mkdir -p "$top/node_modules"
"$top/scripts/init.sh" >"$top/node_modules/.init.log" 2>&1 ||
    echo "scripts/init.sh failed. See $top/node_modules/.init.log"
