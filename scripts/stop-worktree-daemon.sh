#!/usr/bin/env bash
set -euo pipefail

cwd=$(node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd') || exit 0

top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
[[ $top != "$CLAUDE_PROJECT_DIR" ]] || exit 0
common=$(git -C "$top" rev-parse --path-format=absolute --git-common-dir) || exit 0
root_common=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[[ $common == "$root_common" ]] || exit 0

cd -- "$top" || exit 0

# the pid file can outlive the daemon and its pid can be reused, so signal only
# a process whose own command line is this worktree's daemon
pid=$(node -p 'JSON.parse(require("fs").readFileSync(".codegraph/daemon.pid", "utf8")).pid' 2>/dev/null) || exit 0
[[ $pid =~ ^[1-9][0-9]*$ && $pid -gt 1 ]] || exit 0
args=$(ps -ww -o args= -p "$pid" 2>/dev/null) || exit 0
[[ "$args " == *" serve --mcp --path $top "* ]] || exit 0
kill "$pid" 2>/dev/null || true
