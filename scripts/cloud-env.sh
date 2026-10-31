#!/usr/bin/env bash
# Sourced, never run: the settings a Claude Code cloud session VM needs. Two
# callers source it when CLAUDE_CODE_REMOTE is true, the variable the VM
# carries and a developer machine never does: scripts/init.sh, which the
# environment's setup script runs by absolute path before Claude Code
# launches, and
# scripts/init-session.sh, on every session start and resume. See "Claude Code
# cloud sessions" in CONTRIBUTING.md.
#
# The VM differs from a developer machine in these ways:
# - Node 20 to 22 only, below the package.json floor and below GSD's Node 24.
#   Node 24 is installed from the npm registry (the `node` package), which the
#   default network policy allows, into /opt/node24, beside the VM's own
#   /opt/node22. Not into the home directory: pre-commit ignores a node found
#   there and downloads its own from nodejs.org, which the policy denies.
#   PATH starts with /opt/node24/bin for the caller and, through
#   cloud_session_exports, for the session's Bash commands. Hooks and MCP
#   servers that Claude Code starts keep the VM's Node 22, which runs them.
#   npm's global prefix follows the running node, so it is pinned to
#   /usr/local, whose bin directory is on every PATH, which keeps `codegraph`
#   reachable for its MCP server and prompt hook.
# - The session runs as root, which reads a file whatever its mode, so a test
#   that makes a file unreadable never sees the error. /opt/node24/bin/node
#   is a wrapper that drops CAP_DAC_OVERRIDE and CAP_DAC_READ_SEARCH from the
#   bounding set, which every child process inherits, so root obeys file
#   modes in every Node process: npm scripts, tests, GSD tools, codegraph.
# - The trufflehog pre-commit hook builds from source with a Go toolchain
#   that downloads from storage.googleapis.com, which the policy denies.
#   SKIP=trufflehog leaves that hook to the CI Lint workflow.
# - The GitHub proxy cannot fetch Git LFS objects, so a checkout that smudges
#   one fails, and `git worktree add` with it. lfs_install_flags makes
#   `git lfs install` skip the smudge and leave the pointer files in place.
# - V8 caps the heap near 2 GB on the VM, and ESLint's typed rules over the
#   whole tree on a cold cache need more, so NODE_OPTIONS raises the cap.

# The Node major that CI runs (.github/workflows/ci.yml) and that GSD needs.
node_major=24
node_prefix="/opt/node$node_major"
node_real="$node_prefix/lib/node_modules/node/bin/node"
node_link="$node_prefix/bin/node"
global_prefix=/usr/local

export PATH="$node_prefix/bin:$HOME/.local/bin:$PATH"
export npm_config_prefix="$global_prefix"
export NODE_OPTIONS=--max-old-space-size=4096
case ",${SKIP-}," in
    *,trufflehog,*) ;;
    *) export SKIP="trufflehog${SKIP:+,$SKIP}" ;;
esac
lfs_install_flags=--skip-smudge

# Prints the export lines for CLAUDE_ENV_FILE, which the session's Bash
# commands, and so the checks that GSD runs, read.
cloud_session_exports() {
    echo "export PATH=\"$node_prefix/bin:\$PATH\""
    echo "export npm_config_prefix=$global_prefix"
    echo 'export NODE_OPTIONS=--max-old-space-size=4096'
    echo 'export SKIP=trufflehog'
}

if [[ ! -x $node_real ]]; then
    npm install --global --prefix "$node_prefix" --no-audit --no-fund "node@$node_major"
fi

# npm links $node_link to the binary; the wrapper takes the link's place.
# Writing through the link would overwrite the binary, so remove it first,
# and only ever remove the link or an earlier wrapper.
if [[ -L $node_link ]] || grep -q cloud-env.sh "$node_link" 2>/dev/null; then
    rm -f "$node_link"
elif [[ -e $node_link ]]; then
    echo "scripts/cloud-env.sh: $node_link exists and is not npm's link" >&2
    exit 1
fi
cat >"$node_link" <<WRAPPER
#!/bin/sh
# Written by scripts/cloud-env.sh of pi-claude-marketplace: root obeys file
# modes in every Node process. The header of that script says why.
exec setpriv --bounding-set=-dac_override,-dac_read_search -- "$node_real" "\$@"
WRAPPER
chmod +x "$node_link"
hash -r

# The setup script is cached only when it finishes in about five minutes, so
# on a first install the pre-commit hook environments build in the background
# while scripts/init.sh installs the rest. Its final pre-commit run waits on
# the store lock if they are still building.
if [[ ! -e node_modules/.init-done ]]; then
    if ! command -v pre-commit >/dev/null 2>&1; then
        uv tool install pre-commit
    fi
    (pre-commit run --files CONTRIBUTING.md >/dev/null 2>&1 &)
fi
