# Contributing

## General

This project welcomes issues and pull requests.

## Responsible AI contributions

The use of generative AI is welcome, provided these conditions are met:

- **Human ownership:** You as a human are responsible for the contents of your contribution.
- **Human oversight and expertise:** Please review, validate, and revise issues and pull requests with your own expertise so they reflect your personal understanding and voice.

## Development setup

Before doing any work on a fresh repository:

- `node_modules/` missing: run `npm install`.
- `.claude/gsd-core/` missing: install GSD local to the repository with `npx -y @opengsd/gsd-core@latest --claude --local` (use `--codex --local` instead when running under Codex).

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

Run the changed-pairs sweep before opening a pull request that adds or edits a production module. Run the whole-tree sweep at a milestone boundary. It writes one JSON row per pair to `coverage/all-pairs.jsonl` as each pair lands, so a run that stops early still leaves a readable partial result, and a run that reaches the end reads that file back before reporting -- a row lost on the way fails it. `coverage/` is gitignored.

Both stop at the first pair that falls short of complete direct coverage. Seven modules fall short today, each by one branch the compiler forces and no input can reach. Their readings, under `extensions/pi-claude-marketplace/`:

| module                                | reading                     |
| ------------------------------------- | --------------------------- |
| `edge/args.ts`                        | branches 28/29, lines 86/89 |
| `edge/completions/data.ts`            | branches 109/110            |
| `edge/completions/provider.ts`        | branches 79/80              |
| `edge/handlers/marketplace/update.ts` | branches 11/12              |
| `edge/handlers/plugin/import.ts`      | branches 11/12              |
| `edge/handlers/plugin/pending.ts`     | branches 9/10               |
| `edge/handlers/shared.ts`             | branches 14/15, lines 83/85 |

Stopping on one of those, with that exact reading, is the expected outcome rather than a regression. Each is pinned by identity in its own pair, and each is filed in the project's broken-windows ledger with the reason the arm is unreachable. A stop on any other module -- or on one of these reporting different numbers -- is a real failure.

The gate is deliberately not taught this list: an exception list inside the gate is a coverage pragma by another name, and the seven are already pinned where they live. That is also why neither script has a CI job, since a job that is red every run reports nothing.

### The whole-tree report (manual, not a gate)

Because both sweeps stop at the first shortfall, neither can say what the rest of the tree reads. This does:

```bash
npm run test:coverage:direct:report   # every pair, recorded rather than enforced
```

It runs the same one focused test per pair, records the gate's verdict for each, and writes one JSON row per pair to `coverage/all-pairs-report.ndjson`. It is a reporting tool, not a gate: it does not stop at a shortfall, and its exit code is not a coverage verdict -- a zero says the report was written, nothing more. Only the two commands above decide whether coverage is complete, and both still refuse a shortfall. It is as slow as they are, so it too has no CI job.

Each row carries a `verdict` of `complete`, `type-only` or `accepted-shortfall`. The report does not read the broken-windows ledger, so `accepted-shortfall` says only that the gate refused the row. Read the refused rows against the table above: seven rows carrying those readings is the expected result today, and an eighth row -- or one of the seven reading differently -- is a real failure. Anything else that goes wrong, such as a focused test that failed, fails the report rather than filing a coverage verdict for a pair it never measured.

## Vendored skills

Every skill lives under `.agents/skills/`, `.claude/skills/` holds symlinks to them, and Pi reads `.agents/skills/` directly. Some of them are vendored from other repositories: `skills-lock.json` names each vendored skill and its source, and `THIRD_PARTY_NOTICES.md` records its version and license. A skill absent from `skills-lock.json` is written in this repository and needs neither entry.

To update a skill:

```bash
npx skills@latest update <name> -p -y
npx skills@latest remove <name> -a pi -y
```

The installer copies the skill directory only, and some upstream repositories keep the license at the repository root. The `update` command links every agent whose directory exists, so it creates a `.pi/skills/` symlink. The `remove -a pi` command deletes only that link. After an update, check that the `LICENSE` file is still in place, and record the new version and commit in `THIRD_PARTY_NOTICES.md`.
