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

- The npm dependencies (`npm ci`). They include the Pi version that `package-lock.json` pins. The tests and `scripts/pi.sh` run that Pi, so you do not need a `pi` on `PATH`, and they do not use one.
- [pre-commit](https://pre-commit.com/#installation)
- [gsd-core](https://github.com/open-gsd/gsd-core)
- [codegraph](https://github.com/colbymchenry/codegraph)

## Running Pi against the checkout

```bash
scripts/pi.sh --home tmp/pi-home
```

`scripts/pi.sh` starts the pinned Pi and loads only four extensions: this extension, pi-mcp-adapter, pi-subagents, and @quintinshaw/pi-dynamic-workflows.

The first time you run the script, it installs the three companion extensions into a private npm prefix outside the checkout. An npm prefix is the directory where npm installs packages. The script pins the version of each companion. The default prefix is `${XDG_CACHE_HOME:-~/.cache}/pi-claude-marketplace/pi-runtime`. To use a different directory, set `PI_CM_RUNTIME_PREFIX`.

The script refuses a prefix inside the checkout, and it never writes the `package.json` or `package-lock.json` of the repository. The first run needs access to the npm registry.

`--home PATH` keeps the Pi settings and sessions in a disposable directory, for example `tmp/pi-home`. For the full list of options, run `scripts/pi.sh --help`.

## Checks

```bash
npm run check          # typecheck, lint, fallow, format check, gate scripts, unit + integration tests
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
pre-commit run --all-files
```
