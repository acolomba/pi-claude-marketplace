#!/usr/bin/env bash
# Starts an MCP server from this checkout's node_modules: the bin name, then its
# arguments. In a Claude Code cloud session, node_modules is still installing
# when Claude Code starts the MCP servers, and Claude Code does not retry a
# server that fails to start. So the script waits until init-session.sh marks
# node_modules ready for this session. MCP_TIMEOUT in .claude/settings.json is
# longer than this wait.
set -euo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
bin=$root/node_modules/.bin/$1
shift

if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
    ready=$root/node_modules/.session-ready
    for ((waited = 0; waited < 270; waited++)); do
        if [[ -n ${CLAUDE_CODE_SESSION_ID-} ]]; then
            [[ $(cat "$ready" 2>/dev/null) == "$CLAUDE_CODE_SESSION_ID" ]] && break
        elif [[ -x $bin && -e $root/node_modules/.package-lock.json ]]; then
            break
        fi
        sleep 1
    done
fi

exec "$bin" "$@"
