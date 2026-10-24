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
[[ $(git -C "$top" rev-parse --path-format=absolute --git-dir) != "$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)" ]] || exit 0
[[ ! -e $top/node_modules/.init-done ]] || exit 0

mkdir -p "$top/node_modules"
"$top/scripts/init.sh" >"$top/node_modules/.init.log" 2>&1 ||
    echo "scripts/init.sh failed; see $top/node_modules/.init.log" >&2
