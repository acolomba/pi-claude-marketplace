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

It installs:

- The npm dependencies (`npm ci`), including the Pi version `package-lock.json` pins. The tests and `scripts/pi.sh` run that Pi, so no `pi` on `PATH` is needed or used.
- [pre-commit](https://pre-commit.com/#installation)
- [gsd-core](https://github.com/open-gsd/gsd-core)
- [codegraph](https://github.com/colbymchenry/codegraph)

## Running Pi against the checkout

```bash
scripts/pi.sh --home tmp/pi-home
```

`scripts/pi.sh` starts the pinned Pi with only this extension, pi-mcp-adapter, pi-subagents, and @quintinshaw/pi-dynamic-workflows loaded. On first use it installs those three companions, at versions pinned in the script, into a private npm prefix outside the checkout -- `${XDG_CACHE_HOME:-~/.cache}/pi-claude-marketplace/pi-runtime` by default, or the directory `PI_CM_RUNTIME_PREFIX` names. A prefix inside the checkout is refused. It never writes `package.json` or `package-lock.json`. The first run needs the npm registry.

`--home PATH` keeps Pi's settings and sessions in a disposable directory, such as `tmp/pi-home`. Run `scripts/pi.sh --help` for the full option list.

## Checks

```bash
npm run check          # typecheck, lint, fallow, format check, gate scripts, unit + integration tests
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
pre-commit run --all-files
```
