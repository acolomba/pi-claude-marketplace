---
phase: 117-extension-entry-and-final-gate
plan: "09"
subsystem: testing
tags: [gates, correspondence-gate, ownership, negative-control, typescript-ast]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "A correspondence gate reporting zero violations, so a new check firing can only be firing on its own plant"
provides:
  - "A `proxy-owned` verdict that names barrel-proxy ownership where the gate previously reported the generic `wrong-import`"
  - "A one-level re-export lookup that fails closed on an import resolving to no file, to a directory, or to a non-TypeScript path"
  - "Four new plants in the gate's planting control, each RED-confirmed against the pre-change gate"
affects: [117-12, correspondence gate maintenance, OWN-02 enforcement]

actuals:
  tokens: 981
  tasks: 1
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A gate verdict split is proven by planting both sides of the split, not by reading the gate's own source back"

key-files:
  created: []
  modified:
    - scripts/check-corresponding-tests.mjs
    - scripts/check-corresponding-tests.negative.mjs

key-decisions:
  - "Verdict spelled `proxy-owned` (D-117-21's word), not research's draft `proxy-import`"
  - "The re-export lookup goes one level only; a barrel re-exporting a second barrel that re-exports the pair reports no proxy"
  - "The gate stays silent on an owner that imports its pair directly with a barrel beside it — that case is undecidable from the import list"
  - "The guard is `statSync({throwIfNoEntry:false})` + `isFile()` + a `.ts` suffix check, so both crash arms (ENOENT and EISDIR) are closed and both are planted"

patterns-established:
  - "Proof by planting: each new verdict was confirmed RED against the pre-change gate and the exact failure text recorded (D-116-04)"
  - "A mutation plant for the failure the control exists to catch: collapsing both verdicts into one, and removing each guard arm, were each run and each produced a named failure"

requirements-completed: [OWN-02, OWN-04, COV-04, SUITE-04]

coverage:
  - id: D1
    description: "The gate reports `proxy-owned` when an owner test reaches its paired module only through a module that re-exports it"
    requirement: "OWN-02"
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.negative.mjs (barrel plant, expects exactly [{kind:'proxy-owned',path:'tests/domain/answer.test.ts'}])"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate still reports `wrong-import` when an owner test reaches its pair through nothing at all, so the two verdicts are not collapsed"
    requirement: "OWN-02"
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.negative.mjs (no-relative-import plant with the barrel present, expects exactly [{kind:'wrong-import',...}])"
        status: pass
    human_judgment: false
  - id: D3
    description: "The re-export lookup yields a verdict rather than throwing when an owner imports a path that resolves to no file or to a directory"
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.negative.mjs (./missing.ts plant and ./proxy.ts directory plant, each expects exactly [{kind:'wrong-import',...}])"
        status: pass
    human_judgment: false
  - id: D4
    description: "No existing verdict changed spelling, order or exit behaviour, and the live gate still reports zero violations on the clean tree"
    verification:
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs -> exit 0, 'Corresponding-test gate passed.'; the five pre-existing plants in the control still pass unchanged"
        status: pass
      - kind: unit
        ref: "npm test -> 5142 tests, 295 suites, 0 fail"
        status: pass
    human_judgment: false

duration: 13 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 09: Name barrel-proxy ownership as its own verdict Summary

**The correspondence gate now reports `proxy-owned` when an owner test reaches its paired module only through a module that re-exports it, split out of the generic `wrong-import` verdict, with both sides of the split planted in the control and each plant RED-confirmed against the pre-change gate.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-03T19:54:30Z
- **Completed:** 2026-09-03T20:07:42Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- `scripts/check-corresponding-tests.mjs` splits the one branch that fires when an owner test does not import its own pair. Before emitting, it asks whether any module the owner *does* import re-exports that pair; if one does, the verdict is `proxy-owned`, otherwise it stays `wrong-import`. The distinction is decided from the import graph the gate already builds — no name list, no registry, no exemption entry.
- The new `reachesPairThrough` helper reuses the gate's own `importedPaths` specifier resolution against each imported module, so a barrel's `export { x } from "./x.ts"` is picked up the same way an import is.
- The lookup fails closed. An imported path is checked with `statSync(..., { throwIfNoEntry: false })` and `isFile()`, plus a `.ts` suffix check, before anything is read. An import resolving to no file, to a directory, or to a non-TypeScript path counts as a non-match, so the gate reports a verdict instead of throwing mid-scan.
- `scripts/check-corresponding-tests.negative.mjs` gained a barrel fixture (`extensions/pi-claude-marketplace/domain/index.ts` re-exporting `answer.ts`, plus its own owner test) and four plants, each asserting the whole violation array with `assert.deepStrictEqual`.

## Task Commits

1. **Task 1: Name barrel-proxy ownership as its own verdict, with a planting control** — `c7c52d9f` (feat)

**Plan metadata:** see the `docs(117-09)` commit that carries this file.

## Files Created/Modified

- `scripts/check-corresponding-tests.mjs` — splits `wrong-import` into `wrong-import` and `proxy-owned`; adds the guarded one-level re-export lookup and the comment recording that limit.
- `scripts/check-corresponding-tests.negative.mjs` — adds the barrel fixture and four plants; unlinks the trailing `extra.test.ts` plant so the new section starts from a clean tree.

## What the green gate run does and does not prove

**The live gate run proves only the absence of a regression. It proves nothing about the new verdict.**

The branch this task split is EMPTY on the current tree: every owner test imports its pair directly, so the enclosing branch is never entered and `proxy-owned` can never be reached by running the gate against the repository. `node scripts/check-corresponding-tests.mjs` exits 0 with `Corresponding-test gate passed.` both before and after the change — an identical reading either way.

The planting control is the only evidence that exists for the new branch. Each plant was confirmed RED against the pre-change gate, and the exact text recorded:

| Plant | Mutation it was run against | What it actually said |
| --- | --- | --- |
| owner imports only the barrel | `git show HEAD:scripts/check-corresponding-tests.mjs` (pre-change gate) | `actual: [ { kind: 'wrong-import', ... } ] / expected: [ { kind: 'proxy-owned', ... } ]` |
| owner imports nothing relevant | new gate with the verdict collapsed to a constant `"proxy-owned"` | `actual: [ { kind: 'proxy-owned', ... } ] / expected: [ { kind: 'wrong-import', ... } ]` |
| owner imports `./missing.ts` | new gate with the whole guard removed | `Error: ENOENT: no such file or directory, open '.../tests/domain/missing.ts'` — a crash, not a verdict |
| owner imports `./proxy.ts` (a directory) | new gate with only the `isFile()` arm removed | `Error: EISDIR: illegal operation on a directory, read` — a crash, not a verdict |

Every mutation above was run in a scratch copy outside the repository; the working tree was never mutated to produce them.

## Recorded limits

- **One level only.** The lookup asks whether a module the owner imports re-exports the pair. A barrel that re-exports a second barrel that re-exports the pair reports no proxy. A deeper answer costs a graph walk with a cycle guard and nothing in the tree needs one. The limit is stated in the script's own comment.
- **The direct-plus-barrel case is undecidable and the gate stays silent on it.** An owner that imports its pair directly *and* imports a barrel beside it cannot be told apart from the import list: deciding which binding the test actually invokes needs call-site analysis, not import analysis. Research measured this form as reporting `[]` today and it still reports `[]`. No plant was added for it and the gate was not made to guess.

## Decisions Made

- **Verdict spelled `proxy-owned`.** D-117-21 is the operator's word; research's draft `proxy-import` was not used.
- **The guard is `statSync` + `isFile()` rather than `existsSync`.** `existsSync` is true for a directory, and `readFileSync` on a directory throws `EISDIR`, so an existence check alone would leave one crash arm open. Both arms are planted.
- **`barrelImportTest` is one shared fixture constant, not two identical ones.** The same import text is a legal direct pair import when it sits in `tests/domain/index.test.ts` and a proxy import when it sits in `tests/domain/answer.test.ts`; two identically-valued constants would have hidden that the verdict turns on which file holds the text, not on the text.
- **The new plants were appended after the existing ones, and `extra.test.ts` is unlinked first.** The five pre-existing plants therefore run against a byte-identical fixture and still pass unchanged, which is the evidence that no existing verdict moved.

## Deviations from Plan

None - plan executed exactly as written.

## Measured corrections to plan statements

Per the phase's re-derive-every-count rule, two stated facts were measured rather than assumed:

- **The plan (and the threat model) states the gate's verdicts are read by "two other scripts and one architecture suite."** Measured false. A repository-wide grep for `check-corresponding-tests`, `test:corresponding` and `checkCorrespondingTests` (excluding `node_modules`, `.git`, `.planning`, `.codegraph`) returns only `package.json` (two script entries), the gate itself, and its negative control. `scripts/test-coverage-direct.mjs` and `tests/architecture/import-boundaries.test.ts` were both read and neither references the gate. The blast radius of a verdict change is therefore smaller than stated. Nothing was done differently: no existing verdict's spelling, ordering or exit behaviour changed regardless.
- **The plan states `scripts/` is covered by neither ESLint, nor the prettier glob, nor the fallow file pattern.** Measured true, three ways: `npm run lint` targets `extensions tests eslint.config.js`; `format:check` globs `**/*.{js,json,ts}`, which does not match `.mjs`; and `pre-commit run --files <the two paths>` reported `npm lint`, `npm format check`, `npm typecheck` and `npm fallow` all as `(no files to check)`. An explicit `npx prettier --check` on the two files nonetheless reports `All matched files use Prettier code style!`, so the hand-matched style agrees with the repository's formatter even though nothing enforces it.

## Issues Encountered

- **The pre-commit `trufflehog` hook fails structurally in this linked worktree**, exactly as CLAUDE.md documents: `failed to read index file: open .../.git/index: not a directory`. Discharged by the sanctioned filesystem route before committing — `trufflehog filesystem scripts/check-corresponding-tests.mjs scripts/check-corresponding-tests.negative.mjs --results=verified,unknown --fail` reported `chunks: 2, bytes: 13019, verified_secrets: 0, unverified_secrets: 0` and exit 0. The full hook run was then repeated with `SKIP=trufflehog` and exited 0. No other hook was skipped and `--no-verify` was never used.
- **Confirming RED needed `node_modules` reachable from the scratch copy.** The gate imports `typescript`, so the first scratch run failed with `ERR_MODULE_NOT_FOUND` rather than the assertion under test. Resolved by symlinking the repository's `node_modules` into the scratch directory; the symlink and the whole scratch directory were removed afterwards.

## Verification Results

Every gate was run unpiped and its own exit code read (the zsh `$status`/`$?` trap named in the phase notes).

| Gate | Result |
| --- | --- |
| `node scripts/check-corresponding-tests.negative.mjs` | exit 0 — `Corresponding-test negative controls passed.` |
| `node scripts/check-corresponding-tests.mjs` | exit 0 — `Corresponding-test gate passed.` (zero violations, unchanged from baseline) |
| `npm run test:corresponding:negative` | exit 0 |
| `npm run test:coverage:direct:negative` | exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | exit 0 — 5142 tests, 295 suites, 0 fail (identical to the post-Wave-3 baseline) |
| `npm run test:integration` | exit 0 — 31 tests, 0 fail |
| `rg -q 'proxy-owned'` in both scripts | exit 0 in each |
| anti-pattern scan (`allowlist\|allowList\|exemptions\|EXEMPT_\|ownershipRegistry\|Phase [0-9]\|Plan [0-9]\|Wave [0-9]`) | no match in either script — no name list, exemption entry or ownership registry exists |
| `git diff --quiet -- extensions/ tests/ package.json` | exit 0 — nothing under `extensions/`, nothing under `tests/`, nothing in the manifest changed |
| post-commit deletion check | no files deleted by the commit |

`npm run check` was deliberately not run: its `format:check` link fails on the operator's pre-existing untracked files and would short-circuit before the tests. Those files were not touched and `.prettierignore` was not edited.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- OWN-02 now has a verdict that names it, with a control that plants both sides of the split. Nothing here blocks 117-10 or later plans.
- Shared requirement IDs were NOT marked complete: `OWN-02`, `OWN-04`, `COV-04` and `SUITE-04` are declared by more than one plan in this phase, and 117-12 owns the final sweep.
- Nothing was appended to `deferred-items.md` or `.planning/WINDOWS.md`: no stub, skipped test or unrun verify was left behind, and the one out-of-scope finding (the plan's overstated consumer count) is recorded above rather than being acted on.

## Self-Check: PASSED

- `scripts/check-corresponding-tests.mjs` — present on disk, modified.
- `scripts/check-corresponding-tests.negative.mjs` — present on disk, modified.
- Commit `c7c52d9f` — found in `git log`, touching exactly those two files (75 insertions, 4 deletions).

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*
