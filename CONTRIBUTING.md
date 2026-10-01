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
npm run check:changed  # feedback for changes since HEAD, including untracked files
npm run check:changed -- --base origin/main --list  # preview branch checks
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
pre-commit run --all-files
```

`check:changed` checks the edited source/test pairs and follows production imports, re-exports, and type references to consumer tests. It also runs incremental type checking, affected-file linting, cached formatting, source/test pairing, and global Fallow. Shared test helpers, removed files, configuration, tooling, and unknown inputs broaden to the full check and all-pair coverage. A focused pass is feedback during work. Run the full `npm run check` before completion to cover architecture rules, integration, full typed lint, and unread members.

Use `npm run test:modules`, `npm run test:architecture`, or `npm run test:analyzers` to run one part of the unit suite. `npm test` and unit coverage still run the complete suite. After committing a task, give `check:changed` its starting commit with `--base`; its default HEAD comparison then contains no committed changes.

TypeScript and Prettier keep disposable caches under `node_modules/.cache/`. TypeScript still checks the project dependency graph. ESLint's full completion check remains uncached. Local commit hooks format selected files and run `check:changed`; member analysis and the full typed lint run at completion and whenever changed checks broaden to the full command.

Direct coverage runs each source/test pair in a separate process with its own coverage report. It runs up to four pairs at once, limited by the available CPUs. `TEST_CONCURRENCY` sets the worker limit for the gate and the report command. If you need serial output for diagnosis, set the limit to one:

```bash
TEST_CONCURRENCY=1 npm run test:coverage:direct:all
```

The gate prints each pair's test output together after that pair finishes. If a worker fails, the gate stops starting pairs and waits for the active workers to finish before it reports failure. Completed report rows remain available.

In CI, `npm run check` runs the unit coverage and integration tests once. Sonar downloads that run's accepted unit report. The lint workflow runs the remaining repository hooks, and a separate job runs direct coverage. Local commit hooks remain enabled.
