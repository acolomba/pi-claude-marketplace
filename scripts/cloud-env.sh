#!/usr/bin/env bash
# Settings for a Claude Code cloud VM. scripts/init.sh and
# scripts/init-session.sh source this file when CLAUDE_CODE_REMOTE is true.
# Sourcing only sets variables and defines functions. cloud_env_install does
# the work and returns non-zero on failure, so each caller decides how to
# report it.
#
# - Node: the VM puts Node 22 on PATH, and the checks need Node 24, the
#   version CI runs. /opt/node24 holds the Node 24 that the image ships, or
#   the `node` npm package when the image has none.
# - Root: the VM runs as root, and root reads a file in any mode. The `node`
#   wrapper drops two capabilities, so a test that denies a file with chmod
#   sees the error. The wrapper is not under HOME, because pre-commit ignores
#   a node there and downloads its own, which the network policy blocks.
# - npm: global installs go to /usr/local, which is on every PATH, so
#   init.sh and the MCP servers find `codegraph`.
# - trufflehog: its Go toolchain download is blocked. SKIP leaves the hook to
#   CI.
# - LFS: the GitHub proxy cannot fetch LFS objects, so `git lfs install`
#   leaves LFS files as pointers.
# - Heap: ESLint over the whole tree needs more than the default V8 heap. The
#   VM's own NODE_OPTIONS stay.
# - Warmup: the first run builds the pre-commit hook environments in the
#   background, so the setup script returns sooner.

node_prefix=/opt/node24
node_real="$node_prefix/bin/node"
wrapper_dir=/opt/pi-claude-marketplace/bin
cloud_env_marker="# pi-claude-marketplace cloud-env"

case ":$PATH:" in
    *":$wrapper_dir:"*) ;;
    *) export PATH="$wrapper_dir:$HOME/.local/bin:$PATH" ;;
esac
export npm_config_prefix=/usr/local
case " ${NODE_OPTIONS-} " in
    *" --max-old-space-size="*) ;;
    *) export NODE_OPTIONS="--max-old-space-size=4096${NODE_OPTIONS:+ $NODE_OPTIONS}" ;;
esac
case ",${SKIP-}," in
    *,trufflehog,*) ;;
    *) export SKIP="trufflehog${SKIP:+,$SKIP}" ;;
esac
lfs_install_flags=--skip-smudge

# The exports for CLAUDE_ENV_FILE, which Claude Code sources before each Bash
# command of the session. The PATH line guards itself, because the file is
# sourced many times.
cloud_session_exports() {
    echo "$cloud_env_marker"
    echo "case \":\$PATH:\" in *\":$wrapper_dir:\"*) ;; *) export PATH=\"$wrapper_dir:\$HOME/.local/bin:\$PATH\" ;; esac"
    printf 'export npm_config_prefix=%q\n' "$npm_config_prefix"
    printf 'export NODE_OPTIONS=%q\n' "$NODE_OPTIONS"
    printf 'export SKIP=%q\n' "$SKIP"
}

# Installs Node 24 when absent, writes the wrapper, and starts the warmup.
# Run from the repository root.
cloud_env_install() {
    if ! command -v setpriv >/dev/null 2>&1; then
        echo "scripts/cloud-env.sh: setpriv is required" >&2
        return 1
    fi

    if [[ ! -x $node_real ]]; then
        npm install --global --prefix "$node_prefix" --no-audit --no-fund node@24 || return 1
    fi

    # written whole, then moved, so a `node` call in between never sees a part
    mkdir -p "$wrapper_dir" || return 1
    cat >"$wrapper_dir/node.tmp" <<WRAPPER || return 1
#!/bin/sh
# written by scripts/cloud-env.sh so that root obeys file modes in Node
exec setpriv --bounding-set=-dac_override,-dac_read_search -- "$node_real" "\$@"
WRAPPER
    chmod +x "$wrapper_dir/node.tmp" || return 1
    mv -f "$wrapper_dir/node.tmp" "$wrapper_dir/node" || return 1
    hash -r
    if ! "$node_real" --version >/dev/null 2>&1; then
        echo "scripts/cloud-env.sh: $node_real does not run" >&2
        return 1
    fi
    if ! "$wrapper_dir/node" --version >/dev/null 2>&1; then
        rm -f "$wrapper_dir/node"
        echo "scripts/cloud-env.sh: the node wrapper cannot run; setpriv cannot drop capabilities here" >&2
        return 1
    fi

    # `pre-commit run` rather than `install-hooks`, which ignores SKIP and
    # would try the blocked trufflehog build. The marker path is relative:
    # both callers run from the repository root. PI_CM_CLOUD_WARMUP limits
    # the hook, which runs this and then init.sh, to one warmup. pre-commit
    # from uv is a shortcut: init.sh installs it when this step fails.
    if [[ ! -e node_modules/.init-done && -z ${PI_CM_CLOUD_WARMUP-} ]]; then
        export PI_CM_CLOUD_WARMUP=1
        if ! command -v pre-commit >/dev/null 2>&1 && command -v uv >/dev/null 2>&1; then
            uv tool install pre-commit || echo "scripts/cloud-env.sh: warmup skipped, uv could not install pre-commit" >&2
        fi
        if command -v pre-commit >/dev/null 2>&1; then
            mkdir -p node_modules
            (pre-commit run --files CONTRIBUTING.md >node_modules/.warmup.log 2>&1 &)
        fi
    fi
}
