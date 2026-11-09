#!/usr/bin/env bash
set -euo pipefail

# The desktop app runs SessionStart hooks from the main checkout and passes
# the session's worktree as the input's cwd, so the worktree comes from the
# input. A run by hand has no input, and an input without cwd prints the
# string `undefined`. Hook processes inherit CLAUDE_CODE_SESSION_ID; the
# input's session_id stands in when they do not.
input=$(cat 2>/dev/null) || input=
field() { printf '%s' "$input" | node -p "JSON.parse(require('fs').readFileSync(0, 'utf8')).$1 ?? ''" 2>/dev/null; }
cwd=$(field cwd) || cwd=$PWD
[[ -n $cwd && $cwd != undefined && $cwd != null ]] || cwd=$PWD
session_id=${CLAUDE_CODE_SESSION_ID:-$(field session_id || true)}

if ! top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null); then
    if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
        echo "scripts/init-session.sh: $cwd is not in a git repository. Nothing set up."
    fi
    exit 0
fi

# A Claude Code cloud VM: export its settings for the session's Bash commands
# first, then install what depends on the checked-out code. The environment's
# setup installed the rest (scripts/cloud-env-setup.sh); the environment cache
# can hold node_modules and an index from an older checkout, so they are
# refreshed in every session. Every message goes to stdout: stdout reaches the
# session, stderr of a hook that exits 0 does not.
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

    # an environment whose setup did not run cloud-env-setup.sh. Its tooling
    # installs now, but Claude Code read the agents and skills already
    if [[ ! -x $wrapper_dir/node || ! -e .claude/gsd-core/bin/gsd-tools.cjs ]]; then
        if scripts/cloud-env-setup.sh >>"$log" 2>&1; then
            echo "scripts/init-session.sh ran scripts/cloud-env-setup.sh, which the environment's setup script should run. Its agents and skills load at the next session. See CONTRIBUTING.md."
        else
            echo "scripts/cloud-env-setup.sh failed. See $log"
            tail -n 5 "$log"
            exit 0
        fi
    fi

    if ! scripts/init.sh --deps >>"$log" 2>&1; then
        echo "scripts/init.sh --deps failed. See $log"
        tail -n 5 "$log"
        exit 0
    fi

    # scripts/mcp-server.sh waits for this session's id here, so an MCP server
    # never starts from node_modules that the install above is replacing
    printf '%s\n' "$session_id" >node_modules/.session-ready
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
