# Contributing

## General

This project welcomes issues and pull requests.

## Responsible AI contributions

The use of generative AI is welcome, provided these conditions are met:

- **Human ownership:** You as a human are responsible for the contents of your contribution.
- **Human oversight and expertise:** Please review, validate, and revise issues and pull requests with your own expertise so they reflect your personal understanding and voice.

## Development setup

Prerequisites:

- [Open GSD](https://www.opengsd.net/), specifically [gsd-core](https://opengsd.net/products/gsd-core).

```bash
npm install
npx @opengsd/gsd-core@latest --install --local
git lfs install
pre-commit install
pre-commit install --hook-type commit-msg
```

## Checks

```bash
npm run check          # typecheck, lint, fallow, format check, gate scripts, unit + integration tests
npm run lint:fix       # ESLint with autofixes
npm run format         # Prettier autoformat
pre-commit run --all-files
```

`npm run check` runs three gate scripts of its own, between the format check and the test suites. They are fast because none of them spawns a test run:

- `npm run test:corresponding` -- every production module has an owner test beside it that imports it, and every corresponding test has a module.
- `npm run test:corresponding:negative` -- the negative control for the gate above. It plants each violation and asserts the gate refuses it.
- `npm run test:coverage:direct:negative` -- the negative control for the direct-coverage gate below.

### Coverage sweeps (manual)

Two more scripts measure direct coverage by running each owner test on its own and reading the LCOV it writes. Both are slow -- one focused test run per pair, around nine minutes for the whole tree -- so neither is in `npm run check` and neither has a CI job.

```bash
npm run test:coverage:direct        # the pairs your branch changed
npm run test:coverage:direct:all    # every pair in the tree
```

Run the changed-pairs sweep before opening a pull request that adds or edits a production module. Run the whole-tree sweep at a milestone boundary.

Both stop at the first pair that falls short of complete direct coverage, which today includes the accepted single-branch shortfalls recorded in `.planning/WINDOWS.md`. Reaching one of those is the expected outcome, not a regression -- read the ledger entry for the module the sweep names before treating a stop as a failure. That is also why neither script can be a CI job yet: a job that is red every night reports nothing.
