#!/usr/bin/env bash
set -euo pipefail

cwd=$(node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd')

# only linked worktrees of this repository: a foreign repository must never
# get an npm install
top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
[[ $top != "$CLAUDE_PROJECT_DIR" ]] || exit 0
common=$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)
root_common=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[[ $common == "$root_common" ]] || exit 0

cd -- "$top"

# .worktreeinclude creates node_modules/ before this hook runs, so test npm's
# own marker; npm ci would delete the copied tsbuildinfo
if [[ ! -e node_modules/.package-lock.json ]]; then
    npm install >&2
fi

if [[ ! -d .codegraph ]] && command -v codegraph >/dev/null 2>&1; then
    codegraph init --yes . >&2
fi
