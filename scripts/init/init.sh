#!/usr/bin/env bash
# Sets up a checkout of this repository for development, on a local machine or
# in a Claude Code cloud session. Each stage can run alone, because a cloud
# environment keeps the tooling for later sessions but the dependencies follow
# the branch.
set -euo pipefail

usage="usage: scripts/init/init.sh [--tools | --deps]

  --tools  only the agent tooling, which does not depend on the checked-out code
  --deps   only what depends on the checked-out code"
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

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.."

export PATH="$PATH:$HOME/.local/bin"

# empty outside a Claude Code cloud VM, where scripts/init/cloud-env.sh sets it
lfs_install_flags=""
remote=false
if [[ ${CLAUDE_CODE_REMOTE-} == true ]]; then
    remote=true
    source scripts/init/cloud-env.sh
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
        echo "scripts/init/init.sh: install pipx or uv first" >&2
        exit 1
    fi
fi

if $deps; then
    # shellcheck disable=SC2086 -- the variable holds zero or more flags
    git lfs install --local $lfs_install_flags
    pre-commit install

    npm install

    # only the index: `codegraph install` would rewrite the committed agent
    # configs. A sync fails while a running daemon holds the index lock, and
    # that daemon's watcher then keeps the index current
    codegraph=(node_modules/.bin/codegraph init --yes)
    if [[ -d .codegraph ]]; then
        codegraph=(node_modules/.bin/codegraph sync)
    fi
    if $remote; then
        # a new index takes minutes to build. The MCP server loads it once it
        # exists, so the session does not wait for it
        (setsid "${codegraph[@]}" </dev/null >node_modules/.codegraph.log 2>&1 &)
    elif ! "${codegraph[@]}"; then
        echo "scripts/init/init.sh: codegraph ${codegraph[1]} failed; run it again when no CodeGraph process holds the index" >&2
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

    # fallow: only its skill pointers. .mcp.json starts its MCP server, the
    # commit hook runs `npm run fallow`, and AGENTS.md keeps its task map by
    # hand, because the guide step rewrites AGENTS.md. Before the first npm
    # install, npx fetches the version range of the devDependency
    fallow=(npx --no fallow)
    if [[ ! -x node_modules/.bin/fallow ]]; then
        fallow=(npx --yes "fallow@$(node -p 'require("./package.json").devDependencies.fallow')")
    fi
    "${fallow[@]}" agent install --harness claude --harness codex \
        --without hooks --without guide --without mcp --approve

    # normalize AGENTS.md; a fixer that changes it exits 1 too
    pre-commit run --files AGENTS.md ||
        echo "scripts/init/init.sh: pre-commit changed AGENTS.md or failed; see git diff AGENTS.md" >&2
fi

# init-session.sh reads this marker in a linked worktree on a local machine
if $tools && $deps; then
    touch node_modules/.init-done
fi
