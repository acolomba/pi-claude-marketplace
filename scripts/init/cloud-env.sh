#!/usr/bin/env bash
# The settings that this repository needs on a Claude Code cloud VM, and the
# function that installs the machine tools for them. The other init scripts
# source this file when they run on such a VM. Sourcing only sets variables and
# defines functions.

node_prefix=/opt/node24
node_real="$node_prefix/bin/node"
# not under HOME: pre-commit ignores a node there and downloads its own, which
# the network policy blocks
wrapper_dir=/opt/pi-claude-marketplace/bin
cloud_env_marker="# pi-claude-marketplace cloud-env"

case ":$PATH:" in
    *":$wrapper_dir:"*) ;;
    *) export PATH="$wrapper_dir:$HOME/.local/bin:$PATH" ;;
esac
# ESLint over the whole tree needs more than the default V8 heap
case " ${NODE_OPTIONS-} " in
    *" --max-old-space-size="*) ;;
    *) export NODE_OPTIONS="--max-old-space-size=4096${NODE_OPTIONS:+ $NODE_OPTIONS}" ;;
esac
# the network policy blocks the Go toolchain that the trufflehog hook needs, so
# CI runs that hook
case ",${SKIP-}," in
    *,trufflehog,*) ;;
    *) export SKIP="trufflehog${SKIP:+,$SKIP}" ;;
esac
# the GitHub proxy cannot fetch LFS objects, so LFS files stay pointers
lfs_install_flags=--skip-smudge

# The exports for CLAUDE_ENV_FILE, which Claude Code sources before each Bash
# command of the session. The PATH line guards itself, because Claude Code
# sources the file many times.
cloud_session_exports() {
    echo "$cloud_env_marker"
    echo "case \":\$PATH:\" in *\":$wrapper_dir:\"*) ;; *) export PATH=\"$wrapper_dir:\$HOME/.local/bin:\$PATH\" ;; esac"
    printf 'export NODE_OPTIONS=%q\n' "$NODE_OPTIONS"
    printf 'export SKIP=%q\n' "$SKIP"
}

# Installs the machine tools. It writes nothing in the checkout, and it returns
# non-zero on failure, so that each caller reports the failure in its own way.
cloud_env_install() {
    if ! command -v setpriv >/dev/null 2>&1; then
        echo "scripts/init/cloud-env.sh: setpriv is required" >&2
        return 1
    fi

    # the VM puts Node 22 on PATH, and the checks need Node 24, the version CI
    # runs. The image usually ships it in /opt/node24
    if [[ ! -x $node_real ]]; then
        npm install --global --prefix "$node_prefix" --no-audit --no-fund node@24 || return 1
    fi

    # The VM runs as root, and root reads a file in any mode. The wrapper drops
    # two capabilities, so a test that denies a file with chmod sees the error.
    # It is written whole and then moved, so a `node` call in between never
    # sees a part of it.
    mkdir -p "$wrapper_dir" || return 1
    cat >"$wrapper_dir/node.tmp" <<WRAPPER || return 1
#!/bin/sh
# written by scripts/init/cloud-env.sh so that root obeys file modes in Node
exec setpriv --bounding-set=-dac_override,-dac_read_search -- "$node_real" "\$@"
WRAPPER
    chmod +x "$wrapper_dir/node.tmp" || return 1
    mv -f "$wrapper_dir/node.tmp" "$wrapper_dir/node" || return 1
    hash -r
    if ! "$node_real" --version >/dev/null 2>&1; then
        echo "scripts/init/cloud-env.sh: $node_real does not run" >&2
        return 1
    fi
    if ! "$wrapper_dir/node" --version >/dev/null 2>&1; then
        rm -f "$wrapper_dir/node"
        echo "scripts/init/cloud-env.sh: the node wrapper cannot run; setpriv cannot drop capabilities here" >&2
        return 1
    fi

    if ! command -v pre-commit >/dev/null 2>&1; then
        if command -v uv >/dev/null 2>&1; then
            uv tool install pre-commit || return 1
        elif command -v pipx >/dev/null 2>&1; then
            pipx install pre-commit || return 1
        else
            echo "scripts/init/cloud-env.sh: install pipx or uv first" >&2
            return 1
        fi
    fi
}
