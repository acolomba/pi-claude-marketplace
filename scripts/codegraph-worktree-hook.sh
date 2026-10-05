#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
cwd=$(printf '%s' "$input" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd')

top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
[[ $top != "$CLAUDE_PROJECT_DIR" ]] || exit 0
common=$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)
root_common=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[[ $common == "$root_common" ]] || exit 0

# the MCP server watches only the main checkout, so nothing else updates a
# worktree index
codegraph sync --quiet "$top" >&2 || true

# updatedInput replaces every argument, so carry the original ones through
printf '%s' "$input" | node -e '
const { tool_input: toolInput } = JSON.parse(require("fs").readFileSync(0, "utf8"));
const { projectPath } = toolInput;
if (projectPath === undefined || projectPath === process.env.CLAUDE_PROJECT_DIR) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      updatedInput: { ...toolInput, projectPath: process.argv[1] },
    },
  }));
}
' "$top"
