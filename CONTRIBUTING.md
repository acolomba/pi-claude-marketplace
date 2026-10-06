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

## Running Pi against the checkout

```bash
scripts/pi.sh --home tmp/pi-home
```

`scripts/pi.sh` starts the pinned Pi with this extension and its companion extensions. `--home PATH` keeps the Pi settings and sessions in a disposable directory. For all options, run `scripts/pi.sh --help`.

## Checks

```bash
npm run check          # full local gate: static checks, unit tests, direct coverage for every pair, integration tests
npm run check:static   # typecheck, lint, fallow, format check, and gate scripts, in parallel
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
SKIP=npm-check pre-commit run --all-files
```

When a commit stages a file that the build or CI reads, the pre-commit hook runs `npm run check:commit`. It runs the static checks, the unit tests that have no source pair, and direct coverage for the staged source-test pairs only, so it is not a full check. Run `npm run check` before you open a pull request and after a merge, because a merge does not run the hook.

Every check fails on a warning, so a passing check prints little. `npm run check:static` prints one line for each step. `npm run check` adds one `Merged LCOV` line that names the merged coverage report. The other commands print nothing when they pass. A failing step prints its full output. In CI, where GitHub Actions sets the `CI` variable, every check prints its full output, including each passing test.
