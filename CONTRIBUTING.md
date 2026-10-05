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

`check:changed` checks the edited source/test pairs and follows production imports, re-exports, and type references to consumer tests. It also runs incremental type checking, affected-file linting, cached formatting, source/test pairing, and global Fallow. Unpaired tests, test support, fixtures, and documentation select their own targeted checks. A file that no build reads selects none. The build inputs are the paths that `.github/workflows/ci.yml` lists, and CI runs only when one of them changes. Configuration, tooling, scripts, removed build inputs other than documentation, and any other build input that no rule recognizes select the broad check: Prettier on the JavaScript, JSON, and TypeScript build inputs, type checking, ESLint, the workflow install-script check, Fallow, and source/test pairing, each cached or incremental, plus the tests that the other rules select. Commits never run the full `npm run check`, and the broad check never runs unit coverage, the integration suite, or e2e tests. CI runs direct coverage for changed pairs on pull requests and for all pairs on main. Broad runs wait for each other across worktrees, and each run appends a JSON line to `check-changed.log` in the git common directory (`git rev-parse --git-common-dir`). Passing local checks stay quiet. Each test command prints one summary line, a failing test prints Node's full failure report, and a coverage shortfall names each file and metric below the threshold. `npm run fallow` prints nothing unless it finds a problem; it re-runs `fallow dupes` with its clone report only when duplication exceeds the threshold. For per-test output, run `node --test --test-reporter=spec` on the files directly. Ordinary quick tasks and individual plan tasks may complete with focused checks covering their full change. Run the full `npm run check` for combined GSD merge/phase verification and final PR/release handoff to cover architecture rules, integration, and whole-repository typed lint.

Use the owner test while editing, then run the required pre-commit hooks. They already run `check:changed`, so running both separately normally duplicates work. A passing hook supplies the task's focused evidence when it covers the whole task; record that scope without claiming the full project passed. See `skills/local-verification/SKILL.md` for multi-commit tasks and reuse of unchanged verification results.

Use `npm run test:modules` or `npm run test:architecture` to run one part of the unit suite. `npm test` and unit coverage still run the complete suite. After committing a task, give `check:changed` its starting commit with `--base`; its default HEAD comparison then contains no committed changes.

TypeScript, Prettier, and ESLint keep disposable caches under `node_modules/.cache/`. TypeScript still checks the project dependency graph. ESLint keys each cached result to the file's content and the configuration, but typed rules also read other files' types, so a cached pass can be stale after another file changes. CI lints from an empty cache and is the backstop; to lint fresh locally, delete `node_modules/.cache/eslint/` first. Local commit hooks format selected files and run `check:changed`, which runs incremental checks only. Unit coverage and the integration suite run in `npm run check` at the combined verification/handoff boundary.

Direct coverage runs each source/test pair in a separate process with its own coverage report. It runs up to four pairs at once, limited by the available CPUs. `TEST_CONCURRENCY` sets the worker limit for the gate. If you need serial output for diagnosis, set the limit to one:

```bash
TEST_CONCURRENCY=1 npm run test:coverage:direct:all
```

The gate prints each pair's test output together after that pair finishes. If a worker fails, the gate stops starting pairs and waits for the active workers to finish before it reports failure. Completed report rows remain available.

In CI, `npm run check` runs the unit coverage and integration tests once. It lints from an empty ESLint cache. Sonar downloads that run's accepted unit report. The lint workflow runs the remaining repository hooks, and a separate job runs direct coverage. Local commit hooks remain enabled.
