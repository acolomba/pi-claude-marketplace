#!/usr/bin/env bash
# Settings for a Claude Code cloud VM. scripts/init.sh and
# scripts/init-session.sh source this file when CLAUDE_CODE_REMOTE is true.
#
# - Node: the VM puts Node 22 on PATH. /opt/node24 holds the Node 24 that the
#   image ships, or the `node` npm package when the image has none.
# - Root: the VM runs as root, and root reads a file in any mode. The `node`
#   wrapper drops two capabilities, so a test that denies a file with chmod
#   sees the error. The wrapper is not under HOME, because pre-commit ignores
#   a node there and downloads its own, which the network policy blocks.
# - npm: global installs go to /usr/local, which is on every PATH.
# - trufflehog: its Go toolchain download is blocked. SKIP leaves the hook to
#   CI.
# - LFS: the GitHub proxy cannot fetch LFS objects, so `git lfs install`
#   skips the smudge.
# - Heap: ESLint over the whole tree needs more than the default V8 heap.

node_prefix=/opt/node24
node_real="$node_prefix/bin/node"
wrapper_dir=/opt/pi-claude-marketplace/bin

export PATH="$wrapper_dir:$HOME/.local/bin:$PATH"
export npm_config_prefix=/usr/local
export NODE_OPTIONS=--max-old-space-size=4096
case ",${SKIP-}," in
    *,trufflehog,*) ;;
    *) export SKIP="trufflehog${SKIP:+,$SKIP}" ;;
esac
lfs_install_flags=--skip-smudge

# the exports for CLAUDE_ENV_FILE, which the session's Bash commands read
cloud_session_exports() {
    echo "export PATH=\"$wrapper_dir:\$PATH\""
    echo "export npm_config_prefix=$npm_config_prefix"
    echo "export NODE_OPTIONS=$NODE_OPTIONS"
    echo "export SKIP=trufflehog"
}

if [[ ! -x $node_real ]]; then
    npm install --global --prefix "$node_prefix" --no-audit --no-fund node@24
fi

mkdir -p "$wrapper_dir"
cat >"$wrapper_dir/node" <<WRAPPER
#!/bin/sh
# written by scripts/cloud-env.sh: root obeys file modes in Node processes
exec setpriv --bounding-set=-dac_override,-dac_read_search -- "$node_real" "\$@"
WRAPPER
chmod +x "$wrapper_dir/node"
hash -r

# A first install builds the pre-commit hook environments in the background,
# so the setup script stays under its five-minute cache budget.
if [[ ! -e node_modules/.init-done ]]; then
    if ! command -v pre-commit >/dev/null 2>&1 && command -v uv >/dev/null 2>&1; then
        uv tool install pre-commit
    fi
    if command -v pre-commit >/dev/null 2>&1; then
        (pre-commit run --files CONTRIBUTING.md >/dev/null 2>&1 &)
    fi
fi
