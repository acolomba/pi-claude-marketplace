# Contributing

## General

This project welcomes issues and pull requests.

## Responsible AI contributions

The use of generative AI is welcome, provided these conditions are met:

- **Human ownership:** You as a human are responsible for the contents of your contribution.
- **Human oversight and expertise:** Please review, validate, and revise issues and pull requests with your own expertise so they reflect your personal understanding and voice.

## Development setup

Prerequisites:

- [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm/)
- [git-lfs](https://git-lfs.com/)
- [pipx](https://pipx.pypa.io/stable/)

Run this command to set up development tools and dependencies in a fresh clone or worktree.

```bash
./scripts/init.sh
```

It installs the npm dependencies, including the pinned Pi version, and these tools:

- [pre-commit](https://pre-commit.com/#installation)
- [gsd-core](https://github.com/open-gsd/gsd-core)
- [codegraph](https://github.com/colbymchenry/codegraph)

### Claude Code cloud sessions

A Claude Code cloud session runs in a VM that differs from a developer machine. The VM has no pipx and no Node 24. It runs as root. Its network policy blocks the Go toolchain download that the trufflehog hook needs, and the GitHub proxy cannot fetch the Git LFS objects of this repository. When `CLAUDE_CODE_REMOTE` is `true`, which the VM sets and a developer machine never does, `scripts/init.sh` sources `scripts/cloud-env.sh`, which covers these differences. Its header lists each change.

Set the setup script of the environment to the script below. The environment dialog opens from the cloud environment menu in the title bar of the session, under Edit. The setup script does not run inside the clone, so the path is absolute: the VM clones the repository to `/home/user/pi-claude-marketplace`.

```bash
#!/bin/bash
/home/user/pi-claude-marketplace/scripts/init.sh
```

The setup script runs before Claude Code launches, and the VM is cached with its result. GSD and its subagents, the codegraph and fallow MCP servers, and the pre-commit hooks are then in place when the session starts.

The SessionStart hook in `.claude/settings.json` runs `scripts/init-session.sh` on every start and resume. In a cloud session, the hook exports the VM settings for the session's Bash commands and refreshes `node_modules`. Without the setup script, the hook installs everything after Claude Code has launched. Claude Code reads subagent definitions and starts MCP servers only at launch, so GSD's subagents and the two MCP servers are not available before the next session.

A cloud session exports `SKIP=trufflehog`. When you skip more hooks, keep it: `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files <changed files>`. The CI Lint workflow runs trufflehog.

## Running Pi against the checkout

```bash
scripts/pi.sh --home tmp/pi-home
```

`scripts/pi.sh` starts the pinned Pi with this extension and its companion extensions. `--home PATH` keeps the Pi settings and sessions in a disposable directory. For all options, run `scripts/pi.sh --help`.

Without `--home` or `PI_CODING_AGENT_DIR`, the Pi home is `<prefix>/home`, inside the script's private npm prefix. That home starts without `auth.json` and `models.json`, so log in once with `/login` or set your provider's environment variables.

## Checks

```bash
npm run check          # full local gate: static checks, unit tests, direct coverage for every pair, integration and behavioral tests
npm run test:cucumber  # behavioral tests under features/
npm run check:static   # typecheck, lint, fallow, format check, and gate scripts, in parallel
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --all-files
```

When a commit stages a file that the build or CI reads, the pre-commit hook runs `npm run check:commit`. It runs the static checks, the unit tests that have no source pair, and direct coverage for the staged source-test pairs only, so it is not a full check. Run `npm run check` before you open a pull request and after a merge, because a merge does not run the hook.

`npm run test:integration`, and so `npm run check`, first runs `node scripts/install-test-peers.mjs`. The script installs the optional peers pi-mcp-adapter and pi-subagents at the lowest versions that `package.json` allows. It puts them in `node_modules/.cache/optional-peers`, never in `package.json` or `package-lock.json`. The first run after `npm ci` needs the npm registry. Later runs make no network request. npm runs with `--ignore-scripts` and takes only dependency versions published no later than the newest pinned peer, so every machine and CI install the same versions. A missing or different peer fails the integration tests, and the failure names the script. To force a fresh install, delete `node_modules/.cache/optional-peers`.

Every check fails on a warning, so a passing check prints little. `npm run check:static` prints one line for each step. `npm run check` adds one `Merged LCOV` line that names the merged coverage report. The other commands print nothing when they pass. A failing step prints its full output. In CI, where GitHub Actions sets the `CI` variable, every check prints its full output, including each passing test.
