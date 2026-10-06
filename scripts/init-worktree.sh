#!/usr/bin/env bash
set -euo pipefail

# a run by hand has no hook input
cwd=$(node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd' 2>/dev/null) || cwd=$PWD

# only linked worktrees of the repository that holds this script: a foreign
# repository must never get an npm install, and a Claude Code session's own
# checkout can be a linked worktree too
top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
[[ $top != "${CLAUDE_PROJECT_DIR-}" ]] || exit 0
common=$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)
[[ $(git -C "$top" rev-parse --path-format=absolute --git-dir) != "$common" ]] || exit 0
root_common=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
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

# the daemon's watcher keeps this index current; SubagentStop stops it, and the
# idle timeout covers a stop that never comes. Codex has no SubagentStop and
# starts its own CodeGraph server in the worktree
if [[ -n ${CLAUDE_PROJECT_DIR-} && -d .codegraph ]] && command -v codegraph >/dev/null 2>&1; then
    (CODEGRAPH_DAEMON_IDLE_TIMEOUT_MS=14400000 setsid codegraph serve --mcp --path "$top" </dev/null >/dev/null 2>&1 &)
fi
