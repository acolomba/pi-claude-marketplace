#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
cwd=$(printf '%s' "$input" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).cwd')

top=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || exit 0
[[ $top != "$CLAUDE_PROJECT_DIR" ]] || exit 0
common=$(git -C "$top" rev-parse --path-format=absolute --git-common-dir)
root_common=$(git -C "$CLAUDE_PROJECT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || exit 0
[[ $common == "$root_common" ]] || exit 0

cd -- "$top"

# a restarted daemon catches up on the edits it missed; with no index here, the
# launcher would start the enclosing checkout's daemon instead
pid=$(node -p 'JSON.parse(require("fs").readFileSync(".codegraph/daemon.pid", "utf8")).pid' 2>/dev/null) || pid=
if [[ -d .codegraph ]] && ! { [[ $pid =~ ^[1-9][0-9]*$ ]] && kill -0 "$pid" 2>/dev/null; }; then
    (CODEGRAPH_DAEMON_IDLE_TIMEOUT_MS=14400000 setsid codegraph serve --mcp --path "$top" </dev/null >/dev/null 2>&1 &)
fi

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
