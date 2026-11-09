#!/usr/bin/env bash
# Sets up this checkout. With no option, it runs both stages, as a fresh clone or
# worktree needs:
#
#   --tools  the agent tooling, which does not depend on the checked-out code:
#            the third-party skills, gsd-core, and fallow's skill pointers.
#            Claude Code reads agents and skills only at startup.
#   --deps   what depends on the checked-out code: git hooks, the npm
#            dependencies, and the CodeGraph index.
#
# A Claude Code cloud session runs the stages at different times: the
# environment's setup runs --tools (scripts/cloud-env-setup.sh), and every
# session start runs --deps (scripts/init-session.sh).
set -euo pipefail

usage="usage: scripts/init.sh [--tools | --deps]"
case ${1-} in
    "") tools=true deps=true ;;
    --tools) tools=true deps=false ;;
    --deps) tools=false deps=true ;;
    -h | --help)
        echo "$usage"
        exit 0
        ;;
    *)
        echo "$usage" >&2
        exit 2
        ;;
esac

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."

export PATH="$PATH:$HOME/.local/bin"

# empty outside a Claude Code cloud VM. There, scripts/cloud-env.sh sets it
# and installs what the VM lacks.
lfs_install_flags=""
remote=false
if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
    remote=true
    source scripts/cloud-env.sh
    cloud_env_install
fi

export GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never

# pre-commit, with pipx or uv
if ! command -v pre-commit >/dev/null 2>&1; then
    if command -v pipx >/dev/null 2>&1; then
        pipx install pre-commit
        PATH="$PATH:$(pipx environment --value PIPX_BIN_DIR)"
    elif command -v uv >/dev/null 2>&1; then
        uv tool install pre-commit
        PATH="$PATH:$(uv tool dir --bin)"
    else
        echo "scripts/init.sh: install pipx or uv first" >&2
        exit 1
    fi
fi

if $deps; then
    # shellcheck disable=SC2086 -- the variable holds zero or more flags
    git lfs install --local $lfs_install_flags
    pre-commit install

    npm install

    # codegraph: the devDependency. The agent configs that call it are
    # committed, so `codegraph install` is not run: it would rewrite them. A
    # sync that cannot take the index lock, because a running daemon holds it,
    # is left to that daemon's watcher
    codegraph=(node_modules/.bin/codegraph init --yes)
    if [[ -d .codegraph ]]; then
        codegraph=(node_modules/.bin/codegraph sync)
    fi
    if $remote; then
        # a new session's index takes minutes to build. The MCP server loads it
        # once it exists, so the session does not wait for it
        (setsid "${codegraph[@]}" </dev/null >node_modules/.codegraph.log 2>&1 &)
    elif ! "${codegraph[@]}"; then
        echo "scripts/init.sh: codegraph ${codegraph[1]} failed; run it again when no CodeGraph process holds the index" >&2
    fi
fi

if $tools; then
    # skills
    npx --yes skills@latest add blader/humanizer -a universal claude-code -y
    npx --yes skills@latest add AminBlg/SimpleEnglish -a universal claude-code -y
    npx --yes skills@latest add humanlayer/skills --skill show-me -a universal claude-code -y

    # gsd
    npx --yes @opengsd/gsd-core@latest --install --local --claude --codex --force-statusline
    node .codex/gsd-core/bin/gsd-tools.cjs capability install \
        ./gsd-capabilities/discuss-agent-skills \
        --scope project \
        --yes

    # fallow: skill pointers. No MCP registration: .mcp.json starts it through
    # scripts/mcp-server.sh. No commit gate: the commit hook already runs
    # `npm run fallow`. No guide: it rewrites AGENTS.md and adds a CLAUDE.md
    # import shim. The Fallow task map in AGENTS.md is kept by hand and no
    # longer refreshes on fallow upgrades. --tools can run before
    # node_modules exists, so npx then fetches the devDependency's range
    fallow=(npx --no fallow)
    if [[ ! -x node_modules/.bin/fallow ]]; then
        fallow=(npx --yes "fallow@$(node -p 'require("./package.json").devDependencies.fallow')")
    fi
    "${fallow[@]}" agent install --harness claude --harness codex \
        --without hooks --without guide --without mcp --approve

    # normalize AGENTS.md; a fixer that changes it exits 1 too
    pre-commit run --files AGENTS.md ||
        echo "scripts/init.sh: pre-commit changed AGENTS.md or failed; see git diff AGENTS.md" >&2
fi

# init-session.sh reads this marker in a linked worktree on a local machine
if $tools && $deps; then
    touch node_modules/.init-done
fi
