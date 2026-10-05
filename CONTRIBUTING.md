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
npm run check          # typecheck, lint, fallow, format check, gate scripts, unit + integration tests
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
pre-commit run --all-files
```

The pre-commit hook runs `npm run check` when a commit changes a file that the build or CI reads. A merge does not run the hook, so run `npm run check` yourself after a merge.
