---
phase: 260912-pdh
plan: 01
subsystem: build-gates
tags: [tooling-retirement, direct-coverage-gate, pre-commit, census-pin]
status: complete
requires: []
provides:
  - "direct-coverage correspondence rule total by construction over both roots"
affects:
  - scripts/test-coverage-direct.mjs
  - tests/architecture/gate-targets.ts
  - .pre-commit-config.yaml
  - .github/workflows/ci.yml
tech-stack:
  added: []
  patterns:
    - "retire a lookup table and its guards together rather than emptying the table"
key-files:
  created: []
  modified:
    - scripts/test-coverage-direct.mjs
    - tests/architecture/gate-targets.ts
    - .pre-commit-config.yaml
    - .github/workflows/ci.yml
  deleted:
    - scripts/revalidation.mjs
    - scripts/revalidation.negative.mjs
    - tests/architecture/revalidation.test.ts
decisions:
  - "Lookup tables and all five consulting guards deleted, not emptied, because an emptied table leaves permanently-false branches in a file no gate in this repository measures."
  - "The UNOWNED_EXPORT_CENSUS entry removal is a re-measurement, not a waiver: the gate compares by deepStrictEqual in both directions."
  - "ci.yml's pair-count comment was updated 233 to 232 as live job documentation; REQUIREMENTS.md and ROADMAP.md were left byte-unchanged as historical measurements."
metrics:
  duration: 38 min
  completed: 2026-09-12
  commits: 1
  plan_head_before: ba768e6efe6cf90c1a34a516845fafbe30ba361b
actuals:
  tokens: 14000
  tasks: 2
  commits: 1
---

# Quick Task 260912-pdh: Retire the Revalidation Tooling Summary

Deleted the revalidation CLI, its negative control and its 147-test focused suite, then removed
every coupling in the tree that named them — including a census pin the `STATE.md` checklist did
not list.

## What Was Done

One atomic commit, `2f2cb7c4`, seven paths: three deletions and four modifications.

**Deleted.** `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs` and
`tests/architecture/revalidation.test.ts`. The requirement seal the CLI carried
(`SEALED_REQUIREMENT_ROUTES`, the clause signatures, `scope-impact --check`) lives entirely inside
the deleted file, so the seal retires with it rather than being broken. Confirmed by grep before
acting: no other file in the tree reads `RCOV-01`, `SEALED_REQUIREMENT_ROUTES` or `scope-impact`.

**`scripts/test-coverage-direct.mjs`.** Both lookup tables and all five guards that consulted them
are gone, not emptied: the `specialPairs` and `specialTests` declarations, the leading early-return
in `sourceToTest` and in `testToSource`, the first two arms of `pairForPath`'s if/else chain, and
the leading short-circuit in `pairabilityRefusal`. `productionPaths` now returns the sorted
production-root walk with no key spread. Every surviving docstring, the `let sourcePath`/`let
testPath` declarations and the existence loop were left untouched.

**`tests/architecture/gate-targets.ts`.** Removed the `UNOWNED_EXPORT_CENSUS` entry keyed on
`scripts/revalidation.mjs` together with its 11 export names. The census docstring, which describes
a continuing obligation, was not touched.

**`.pre-commit-config.yaml`.** The `fix-unicode-dashes` block lost the eight-line comment that
justified two file exclusions and its `exclude:` is now `^\.planning/`, byte-identical to its
`fix-smartquotes` and `fix-ligatures` siblings. The `npm-coverage-direct` block lost the deleted
alternative from its `files:` pattern and the sentence explaining it; the clause about the pin file
being listed so a pin edit re-runs the comparison survives as a standalone comment, and the earlier
paragraph's "plus the special pair" parenthetical was struck and reflowed.

**`.github/workflows/ci.yml`.** The `direct-coverage` cost comment moved from 233 to 232 pairs.

## Measured Results

| Reading | Before | After |
|---------|--------|-------|
| `productionPaths()` | 233 | **232** |
| `npm run check` unit | 6118 / 6118 | **5971 / 5971** |
| `npm run check` integration | 32 / 32 | **32 / 32** |
| focused suite `revalidation.test.ts` | 147 / 147, exit 0 | deleted |
| `fallow-ignore` markers repo-wide | 11 | 11 |

The unit arithmetic closes exactly: 6118 − 147 = 5971. Nothing else stopped running, and nothing is
still resolving the deleted file.

Every gate was run unpiped and read from its own exit status, with output redirected to a file when
volume was a problem. All exit 0: `npm run check`, `npm run typecheck`, `npm run lint`,
`npm run fallow`, `npm run format:check`, `npm run test:corresponding`,
`npm run test:corresponding:negative`, `npm run test:coverage:direct:negative`, and
`node --test tests/architecture/gate-targets.test.ts tests/architecture/unowned-exports-census.test.ts`
(18/18).

`SKIP=trufflehog pre-commit run --files` over the four modified paths passed 24 hooks with 0
failures, run twice — once before the commit and once after, the second reading the landed
configuration. `git status --porcelain` shows no hook rewrite among the four files; the only
entries are the operator's own pre-existing modified and untracked files.

## The Coupling the Checklist Did Not Name

`STATE.md`'s close-time checklist lists four couplings. A fifth was found by grep while planning
and confirmed independently by the operator: `tests/architecture/gate-targets.ts:714` keyed
`UNOWNED_EXPORT_CENSUS` on `scripts/revalidation.mjs` with 11 export names, and
`unowned-exports-census.test.ts` compares the re-measured census against that pin with
`deepStrictEqual`. A removal therefore fails as loudly as an addition. Deleting the CLI without
dropping the census entry would have been red, which is why the entry removal had to land in the
same commit as the deletions.

The second forcing coupling, recorded in the plan: `pairForPath` stats both members of any pair it
resolves and throws `Missing source-test pair member` on a miss, so a lookup table still naming a
deleted path converts a retired pair into a hard refusal of the whole gate run rather than a skip.
Table removal and file deletion are one change for the same reason.

## Why the Tables Were Deleted Rather Than Emptied

The moment the only entry goes, five guards become permanently false. This repository has no way to
excuse that residue: `.fallowrc.json` carries zero `health.thresholdOverrides`, the 11
`fallow-ignore` markers cover no dead code, and adding a suppression was out of scope.

The nuance that decided it cuts toward deletion: `scripts/test-coverage-direct.mjs` is not itself
inside the measured pair set. `productionPaths()` is the production-root walk, the gate's own module
is under neither root, `check-corresponding-tests.mjs` does not reach `scripts/**`, and there is no
owner test — `tests/scripts/` holds only `check-phase-06-hub-ledger.test.ts`. A dead branch left
here would not be caught; it would sit unmeasured. That makes leaving one worse, not safer.

The decision is verified separately from the change. A comment-stripped grep of the gate script
finds **0** occurrences of either retired identifier — it read 11 on the pre-change tree, so the
gate is discriminating rather than vacuous. `productionPaths()` reads 232, proving the key-spread
site is gone and the enumeration is now purely the production-root walk, not merely that a table was
emptied. And `npm run test:coverage:direct:negative` exits 0 having exercised the simplified
resolver against real fixtures, reporting its full control list rather than a bare pass.

## Scope Held

- `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md` are absent from the commit diff. Their 233
  was true when measured; the count moved because tooling was removed, not because a baseline was
  lost.
- Nothing under `.planning/phases/01-live-evidence-revalidation/` was touched. All 165 entries are
  present, ledger and review inputs included; they archive with the phase.
- `git diff $SHA^..$SHA -- .fallowrc.json` is empty. No `fallow-ignore`, no `eslint-disable`, no
  threshold override was added anywhere.
- Only the four named scripts were deleted-adjacent: `scripts/test-coverage-direct.mjs`,
  `scripts/test-coverage-direct.negative.mjs`, `scripts/check-corresponding-tests.mjs` and
  `scripts/check-phase-06-hub-ledger.mjs` all survive untouched.
- Staging was by explicit path. The operator's `.claude/settings.json`, `.codex/config.toml`,
  `.gitignore`, `.claude/CLAUDE.md`, `.mcp.json` and `AGENTS.md` are unstaged and unmodified by this
  work.

## Deviations from Plan

None. Both judgment calls the plan flagged for the operator — striking the "plus the special pair"
phrase in `.pre-commit-config.yaml` and moving `ci.yml`'s pair count to 232 — were approved before
execution and applied as written.

## Known Stubs

None.

## Self-Check: PASSED

- `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`,
  `tests/architecture/revalidation.test.ts`: absent from the working tree, `D` in the commit diff.
- `scripts/test-coverage-direct.mjs`, `tests/architecture/gate-targets.ts`,
  `.pre-commit-config.yaml`, `.github/workflows/ci.yml`: present, `M` in the commit diff.
- Commit `2f2cb7c4` exists on `features/refine-unit-tests`; subject 56 characters, no body line
  over 80, no milestone, phase, plan or wave reference.
- `git diff --name-status $SHA^..$SHA` lists exactly seven paths: three `D`, four `M`.
