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

### Coverage sweeps

Three scripts measure direct coverage by running each owner test on its own and reading the LCOV it writes. They are slow -- one focused test run per pair, around eight minutes for the whole tree -- so none of them is in `npm run check`.

```bash
npm run test:coverage:direct           # the pairs your branch changed
npm run test:coverage:direct:commit    # the pairs this commit touches
npm run test:coverage:direct:all       # every pair in the tree
```

All three run for you: the pre-commit hook runs the commit-scoped one, and the CI job runs the branch-scoped one on a pull request and the whole-tree one on everything else. Run the whole-tree sweep by hand too, at a milestone boundary, when you want the answer before you push. It writes one JSON row per pair to `coverage/all-pairs.jsonl` as each pair lands, so a run that stops early still leaves a readable partial result, and a run that reaches the end reads that file back before reporting -- a row lost on the way fails it. `coverage/` is gitignored.

All three measure every pair they select and compare every reading they took against a committed pin, `scripts/test-coverage-direct.pin.json`. So does the fourth form, `npm run test:coverage:direct -- <path>`, which measures one pair and compares it against that pair's pin row -- it is the arm you reach for while working on a module, so it is the one that most needs to tell you whether a shortfall is yours or recorded. None of them stops at the first shortfall; a shortfall is recorded, the run says so by name, and the comparison after the last pair is what refuses. Each pinned module was examined twice: once for a behavior-preserving rewrite that would remove the uncovered arm, once for a real test that would reach it. Neither worked. Every row carries the gate's own reading string, the finding ids that authorize it, and one recorded reason per uncovered site. Under `extensions/pi-claude-marketplace/`:

| module                                    | reading                           |
| ----------------------------------------- | --------------------------------- |
| `bridges/commands/discover.ts`            | branches 55/57, lines 412/414     |
| `orchestrators/plugin/install-outcome.ts` | branches 109/111, lines 1034/1040 |

Measuring one of those, with that exact reading, is a PASS: the run reports it and exits 0. Any other module falling short -- or one of these reporting different numbers, in either direction -- fails the run.

The pin is not an allow-list, and nothing in it is forgiven. An allow-list excuses the entries it names, silently and forever. This set fails on an addition, on a removal, and on a swap: a module that falls short and is not pinned fails, a pinned module whose reading moved -- better or worse -- fails, and a pinned module that now reads complete fails as a stale row. A change to the tree's coverage surface therefore has to be written down in the same commit that causes it.

One gate implementation serves three scopes at one strictness. Two of them are change sets reached through an explicitly named base; the third is the whole enumeration.

The local pre-commit hook `npm-coverage-direct` runs the gate commit-scoped, so it asks about the pairs the commit touches. The CI job `direct coverage (Node 24)` runs it branch-scoped against `origin/main...HEAD` on a pull request -- the authoritative change set for one. That job checks out at full depth, asserts that `origin/main` resolves before it measures anything, and then asserts the base the gate printed, because at a shallow checkout `origin/main` does not exist and the gate would diff one commit while reporting a resolved base. The gate prints the base it selected on every run, so which scope you got is never a guess.

The same job runs the whole-tree sweep on every other event it fires on -- a push to `main`, and the `v*`-tag call `publish.yml` makes. On both of those `origin/main...HEAD` is empty, because `origin/main` is `HEAD`, so a changed-pair run would select nothing, measure only the pinned pairs and exit 0 having said nothing about the commit that triggered it. The whole tree is the honest change set for a commit already on `main`, and the strongest one for a release. `package` depends on the job, so a shortfall blocks the release manifest check the way every other gate does -- and on the release path it is the whole tree that has to hold, not a diff against itself.

Local hooks only fire once you have run `pre-commit install` in your checkout. You can also run this one on its own, without making a commit:

```bash
pre-commit run npm-coverage-direct --all-files
```

The three scopes cost very different amounts, and that is why the hook does not take the branch-scoped base. Measured on a long-lived branch, the branch-scoped selection reached 147 pairs and about six and a half minutes, and it grows as the branch does. The commit-scoped selection costs one focused test run per pair the commit changed, plus the pinned pairs the gate measures on every run. The whole-tree sweep takes around eight minutes. When the hook stops a commit you have to land anyway, `SKIP=npm-coverage-direct` is the pre-commit-native escape, and it is written down here rather than left to be discovered: a gate that is expensive and undocumented is a gate people learn to route around. `--no-verify` stays forbidden.

A complete reading is reachability evidence only. It says every arm ran under the owner test. It says nothing about whether that test asserted anything worth asserting.

### The whole-tree report (manual, not a gate)

Every sweep can say what the tree reads, but each one files a verdict on it and dies on a pin mismatch before you can read the rest. This one files no verdict, so it survives anything the pin would refuse:

```bash
npm run test:coverage:direct:report   # every pair, recorded rather than enforced
```

It runs the same one focused test per pair, records the gate's verdict for each, and writes one JSON row per pair to `coverage/all-pairs-report.ndjson`. It is a reporting tool, not a gate: it does not stop at a shortfall, and its exit code is not a coverage verdict -- a zero says the report was written, nothing more. Only the three sweep commands above decide whether coverage is complete, and every one of them still refuses a reading that does not match the pin. It is as slow as they are, and it stays manual: it files no verdict, so a job would have nothing to gate on.

Each row carries a `verdict` of `complete`, `type-only` or `accepted-shortfall`. The report does not read the pin, so `accepted-shortfall` says only that the gate refused the row. Read the refused rows against the pin above: those rows, carrying those readings, are the expected result. Any other refused row -- or one of these reading differently -- is a real failure. Anything else that goes wrong, such as a focused test that failed, fails the report rather than filing a coverage verdict for a pair it never measured.

## Vendored skills

Every skill lives under `.agents/skills/`, `.claude/skills/` holds symlinks to them, and Pi reads `.agents/skills/` directly. Some of them are vendored from other repositories: `skills-lock.json` names each vendored skill and its source, and `THIRD_PARTY_NOTICES.md` records its version and license. A skill absent from `skills-lock.json` is written in this repository and needs neither entry.

To update a skill:

```bash
npx skills@latest update <name> -p -y
npx skills@latest remove <name> -a pi -y
```

The installer copies the skill directory only, and some upstream repositories keep the license at the repository root. The `update` command links every agent whose directory exists, so it creates a `.pi/skills/` symlink. The `remove -a pi` command deletes only that link. After an update, check that the `LICENSE` file is still in place, and record the new version and commit in `THIRD_PARTY_NOTICES.md`.
