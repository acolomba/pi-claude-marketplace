#!/usr/bin/env bash
# Prepares a Claude Code cloud session VM, then runs scripts/init.sh. It is
# for the cloud VM only; scripts/init.sh alone is the setup on a developer
# machine. See "Claude Code cloud sessions" in CONTRIBUTING.md.
#
# Two callers:
# - The environment's setup script, which runs before Claude Code launches
#   and whose result is cached. GSD's subagents, the codegraph and fallow MCP
#   servers, and the pre-commit hooks are then all in place at launch.
# - The SessionStart hook in .claude/settings.json, on every session start
#   and resume, only when CLAUDE_CODE_REMOTE is true. After the setup script,
#   it only refreshes node_modules and the session environment. Without the
#   setup script, it installs everything, but Claude Code loads subagent
#   definitions and starts stdio MCP servers only at launch, so GSD's
#   subagents and the two MCP servers wait for the next session.
#
# The VM differs from a developer machine in four ways that this script
# covers before and after scripts/init.sh:
# - Node 20 to 22 only, below the package.json floor and below GSD's Node 24.
#   Node 24 is installed from the npm registry (the `node` package), which the
#   default network policy allows, into /opt/node24, beside the VM's own
#   /opt/node22. Not into the home directory: pre-commit ignores a node found
#   there and downloads its own from nodejs.org, which the policy denies.
#   The hook prepends /opt/node24/bin to PATH for the session's Bash
#   commands. Hooks and MCP servers that Claude Code starts keep the VM's
#   Node 22, which runs them. npm's global prefix follows the running node,
#   so it is pinned to /usr/local, whose bin directory is on every PATH,
#   which keeps `codegraph` reachable for its MCP server and prompt hook.
# - The session runs as root, which reads a file whatever its mode, so a test
#   that makes a file unreadable never sees the error. /opt/node24/bin/node
#   is a wrapper that drops CAP_DAC_OVERRIDE and CAP_DAC_READ_SEARCH from the
#   bounding set, which every child process inherits, so root obeys file
#   modes in every Node process: npm scripts, tests, GSD tools, codegraph.
# - The trufflehog pre-commit hook builds from source with a Go toolchain
#   that downloads from storage.googleapis.com, which the policy denies.
#   SKIP=trufflehog leaves that hook to the CI Lint workflow.
# - The GitHub proxy cannot fetch Git LFS objects, so a checkout that smudges
#   one fails, and `git worktree add` with it. LFS skips the smudge and leaves
#   the pointer files in place.
# - V8 caps the heap near 2 GB on the VM, and ESLint's typed rules over the
#   whole tree on a cold cache need more, so NODE_OPTIONS raises the cap.
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

# The Node major that CI runs (.github/workflows/ci.yml) and that GSD needs.
node_major=24
node_prefix="/opt/node$node_major"
node_real="$node_prefix/lib/node_modules/node/bin/node"
node_link="$node_prefix/bin/node"
global_prefix=/usr/local
log="${TMPDIR:-/tmp}/pi-claude-marketplace-init-cloud.log"

# As a hook, stdout is context for Claude, so the installers write to the log
# and only the summary lines reach stdout. The setup script keeps full output.
exec 3>&1
if [[ -n ${CLAUDE_ENV_FILE-} ]]; then
    exec >"$log" 2>&1
fi
say() { printf '%s\n' "$*" >&3; }
trap 'say "scripts/init-cloud.sh failed at line $LINENO. Last lines of $log:"; tail -n 20 "$log" >&3 2>/dev/null' ERR

export PATH="$node_prefix/bin:$HOME/.local/bin:$PATH"
export npm_config_prefix="$global_prefix"
export NODE_OPTIONS=--max-old-space-size=4096
case ",${SKIP-}," in
    *,trufflehog,*) ;;
    *) export SKIP="trufflehog${SKIP:+,$SKIP}" ;;
esac

# Bash commands of the session, and so the checks that GSD runs, need the
# same four variables.
if [[ -n ${CLAUDE_ENV_FILE-} ]]; then
    {
        echo "export PATH=\"$node_prefix/bin:\$PATH\""
        echo "export npm_config_prefix=$global_prefix"
        echo 'export NODE_OPTIONS=--max-old-space-size=4096'
        echo 'export SKIP=trufflehog'
    } >>"$CLAUDE_ENV_FILE"
fi

installed() {
    [[ -x $node_real ]] &&
        command -v pre-commit >/dev/null 2>&1 &&
        [[ -x $(git rev-parse --git-path hooks/pre-commit) ]] &&
        [[ -e node_modules/.package-lock.json && -e node_modules/.init-done ]] &&
        [[ -d .agents/skills/humanizer && -d .agents/skills/simple-english ]] &&
        [[ -f .claude/gsd-core/VERSION && -f .codex/gsd-core/VERSION ]] &&
        command -v codegraph >/dev/null 2>&1 && [[ -d .codegraph ]] &&
        [[ -e .claude/skills/fallow ]]
}

if installed; then
    # the clone can carry a newer package-lock.json than the cached snapshot
    npm install --no-audit --no-fund
    git lfs install --local --skip-smudge
    say "scripts/init-cloud.sh: tools already installed; refreshed node_modules."
    exit 0
fi

# The setup script is cached only when it finishes in about five minutes, so
# the three slow, independent installs overlap: Node, pre-commit, and the
# pre-commit hook environments. scripts/init.sh finds pre-commit on PATH and
# skips its own install, and its final pre-commit run waits on the store
# lock if the hook environments are still building.
if [[ ! -x $node_real ]]; then
    npm install --global --prefix "$node_prefix" --no-audit --no-fund "node@$node_major" &
    node_job=$!
fi
if ! command -v pre-commit >/dev/null 2>&1; then
    uv tool install pre-commit
fi
pre-commit run --files CONTRIBUTING.md >/dev/null 2>&1 || true &
hooks_job=$!
if [[ -n ${node_job-} ]]; then
    wait "$node_job"
fi

# npm links $node_link to the binary; the wrapper takes the link's place.
# Writing through the link would overwrite the binary, so remove it first,
# and only ever remove the link or an earlier wrapper.
if [[ -L $node_link ]] || grep -q init-cloud.sh "$node_link" 2>/dev/null; then
    rm -f "$node_link"
elif [[ -e $node_link ]]; then
    echo "scripts/init-cloud.sh: $node_link exists and is not npm's link" >&2
    exit 1
fi
cat >"$node_link" <<EOF
#!/bin/sh
# Written by scripts/init-cloud.sh of pi-claude-marketplace: root obeys file
# modes in every Node process. The header of that script says why.
exec setpriv --bounding-set=-dac_override,-dac_read_search -- "$node_real" "\$@"
EOF
chmod +x "$node_link"
hash -r
node --version

scripts/init.sh

wait "$hooks_job" || true

# after scripts/init.sh, whose `git lfs install` restores the smudge
git lfs install --local --skip-smudge

say "scripts/init-cloud.sh: installed Node $(node --version), pre-commit, npm dependencies, GSD, skills, codegraph, and fallow. Log: $log"
if [[ -n ${CLAUDE_ENV_FILE-} ]]; then
    say "This ran after Claude Code launched, so GSD's subagents (gsd-planner, gsd-executor, ...) and the codegraph and fallow MCP servers are available from the next session on. In this one, /gsd-* commands that spawn subagents fail; use \`codegraph explore\` and \`npx fallow\` from the shell. To have everything at launch, set the environment's setup script to scripts/init-cloud.sh (see CONTRIBUTING.md)."
fi
