---
phase: 117-extension-entry-and-final-gate
plan: "03"
subsystem: testing
tags: [node-test, strong-mock, git-rename, import-order, eslint]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "117-02's move-and-rewrite mechanic, proved on a 5-consumer and a 2-consumer module before it was applied to the 26-consumer one"
  - phase: 116-edge-surface
    provides: "the ~20 proofs that verify against createNotificationBoundary, and the 116-17 rename-similarity finding the one-commit shape rests on"
provides:
  - the strict Pi notification boundary, beside the 22 edge suites that dominate its consumer set
  - 28 rewritten import specifiers across 26 consumer suites, all resolving to the new home
  - the four accepted cross-tier orchestrator imports, named rather than left to be rediscovered
  - tests/helpers/ reduced to its last module, the marketplace seed
affects: [117-04 orphan relocations, 117-07 marketplace-seed move and directory close-out]

actuals:
  tokens: 5348
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "move-and-rewrite in one commit, at 26-consumer scale: a commit that moves the module without fixing its consumers does not typecheck, so the move and the rewrites are one concern"
    - "a 100 percent rename is trustworthy only once the consumer edits are confirmed staged; the same number read against an unstaged tree is the 117-02 trap"

key-files:
  created:
    - tests/edge/notification-boundary.ts
  modified:
    - tests/edge/register.test.ts
    - tests/edge/router.test.ts
    - tests/edge/handlers/shared.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/autoupdate.test.ts
    - tests/edge/handlers/marketplace/info.test.ts
    - tests/edge/handlers/marketplace/list.test.ts
    - tests/edge/handlers/marketplace/remove.test.ts
    - tests/edge/handlers/marketplace/shared.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts
    - tests/edge/handlers/plugin/fetch.test.ts
    - tests/edge/handlers/plugin/import.test.ts
    - tests/edge/handlers/plugin/info.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/plugin/list.test.ts
    - tests/edge/handlers/plugin/pending.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/edge/handlers/plugin/shared.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/pending.test.ts

key-decisions:
  - "The move and its 28 consumer rewrites are one commit. A pure-move commit would leave 26 suites importing a path that no longer exists and would not typecheck, so the 116-17 move-plus-total-rewrite split does not apply."
  - "The module body was not touched at all, so git reports the rename at 100 percent. That number was only trusted after confirming every consumer edit was already staged -- the identical reading was misleading in 117-02 for exactly the opposite reason."
  - "ESLint decided every import placement. It demanded reordering in six suites, not the two the plan predicted: the shorter specifier re-sorts within the parent group as well as creating a sibling group."

patterns-established:
  - "Dominant-consumer placement: a support module with a lopsided consumer distribution moves to the majority tier, and the minority imports across the boundary explicitly rather than the module being duplicated."
  - "A rename percentage is evidence only in combination with a staged-tree check; read alone it cannot distinguish an unedited body from an unstaged edit."

requirements-completed: [SUITE-02, DEL-03]

coverage:
  - id: D1
    description: "The strict Pi notification boundary lives at tests/edge/notification-boundary.ts, beside the 22 edge suites that dominate its consumer set, and tests/helpers/ holds only the marketplace seed"
    requirement: SUITE-02
    verification:
      - kind: other
        ref: "test ! -e tests/helpers/notification-boundary.ts -- exit 0; ls -1 tests/helpers/ -- one entry, marketplace-seed.ts"
        status: pass
      - kind: other
        ref: "rg -n 'helpers/notification-boundary' tests -- exit 1, no match anywhere under tests/"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 28 import lines across 26 consumer suites resolve to the new path and the whole tree typechecks"
    requirement: SUITE-02
    verification:
      - kind: other
        ref: "npm run typecheck -- exit 0, no error TS line"
        status: pass
      - kind: unit
        ref: "npm test -- exit 0, runner reported ℹ tests 5143, ℹ suites 295, ℹ pass 5143, ℹ fail 0"
        status: pass
      - kind: integration
        ref: "npm run test:integration -- exit 0, runner reported ℹ tests 31, ℹ pass 31, ℹ fail 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "ESLint is silent over the whole tests tree, including the six suites whose import placement changed"
    requirement: SUITE-02
    verification:
      - kind: other
        ref: "npm exec -- eslint tests -- exit 0 after eslint --fix applied the placement it reported"
        status: pass
      - kind: other
        ref: "npm exec -- prettier --check over all 27 touched paths -- exit 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The move is recorded by git as a rename with the module body unchanged, so git log --follow reaches through it"
    requirement: DEL-03
    verification:
      - kind: other
        ref: "git diff --cached -M --summary -- 'rename tests/{helpers => edge}/notification-boundary.ts (100%)'"
        status: pass
      - kind: other
        ref: "md5sum before and after the git mv -- 55ee3c1bc9b478fa464a92cf7230a20f both times; git log -1 --stat shows the renamed path with 0 line changes"
        status: pass
      - kind: other
        ref: "git log --follow tests/edge/notification-boundary.ts reaches af7c501f, 66e11dac and c2472de8"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nothing under extensions/ and nothing in package.json changed, and the correspondence gate does not name the moved module"
    requirement: DEL-03
    verification:
      - kind: other
        ref: "git diff --quiet -- extensions/ package.json and git diff --cached --quiet -- extensions/ package.json -- both exit 0"
        status: pass
      - kind: other
        ref: "node scripts/check-corresponding-tests.mjs | grep notification-boundary -- exit 1, gate still reports the same 7 violations as before"
        status: pass
    human_judgment: false

duration: 16 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 03: The Notification Boundary Move Summary

**`tests/helpers/notification-boundary.ts` moved to `tests/edge/`, beside the 22 edge suites that are 22 of its 26 consumers -- 28 import specifiers rewritten in the same commit, the body untouched at a 100 percent rename, and the four orchestrator suites that now import across the tier boundary named rather than hidden.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-03T17:41:00Z
- **Completed:** 2026-09-03T17:56:43Z
- **Tasks:** 1
- **Files modified:** 27 (1 moved, 26 edited in place)

## Accomplishments

- The strict Pi notification boundary now lives at `tests/edge/notification-boundary.ts`. Its body was not edited: `md5sum` reads `55ee3c1bc9b478fa464a92cf7230a20f` before and after the `git mv`, and `git log -1 --stat` shows the renamed path with **0** line changes.
- All **28 import lines across 26 consumer suites** resolve to the new path. `npm run typecheck` exits 0, which is the check the plan asked for instead of counting path segments -- both homes are two levels below the repository root, so the module's own climb to `platform/pi-api.ts` is unchanged.
- `tests/helpers/` now holds exactly **one** file: `marketplace-seed.ts`. That is success criterion 1 of this plan, and it leaves 117-07 a directory with one module and the close-out.
- The suite total is unchanged, both figures read from the runner's own `ℹ tests` line rather than derived: **5143 before, 5143 after**, over **295 suites** both times, `ℹ fail 0` both times. This plan adds and removes no case, and the runner agrees.
- The four cross-tier consumers are named below rather than left to be rediscovered (D-117-05).

## Task Commits

1. **Task 1: Move the Pi notification boundary beside the edge tier** -- `50296404` (refactor)

**Plan metadata:** see the `docs(117-03)` commit that carries this summary.

## The four accepted cross-tier imports (D-117-05)

These four orchestrator suites now reach across the tier boundary into `tests/edge/`. They are accepted, not incidental:

| Consumer | New specifier |
| --- | --- |
| `tests/orchestrators/import/execute.test.ts` | `../../edge/notification-boundary.ts` |
| `tests/orchestrators/plugin/bootstrap.test.ts` | `../../edge/notification-boundary.ts` |
| `tests/orchestrators/reconcile/apply.test.ts` | `../../edge/notification-boundary.ts` |
| `tests/orchestrators/reconcile/pending.test.ts` | `../../edge/notification-boundary.ts` |

**Why this breaks nothing configured:** `.fallowrc.json`'s `boundaries.zones` block governs paths under `extensions/pi-claude-marketplace/`, and the ESLint `import-x/no-restricted-paths` architecture rule likewise scopes to the production tree. Neither has any zone or rule covering `tests/`. `npm run fallow` exits 0 and names the moved module in no finding; `npm exec -- eslint tests` exits 0. So there is no boundary rule these four violate -- they are a deliberate asymmetry accepted because D-117-06 already rejected the alternative, which was a second copy of a definition roughly twenty phase-116 proofs verify against, at a `fallow dupes` threshold of three lines.

## The specifier rewrite, as measured

The plan asked for the shape of the tree to be re-derived rather than trusted. Re-derived by `rg` before the move:

| Group | Files | Lines | Old specifier | New specifier |
| --- | --- | --- | --- | --- |
| `tests/edge/handlers/marketplace/` | 7 | 7 | `../../../helpers/…` | `../../notification-boundary.ts` |
| `tests/edge/handlers/plugin/` | 12 | 13 | `../../../helpers/…` | `../../notification-boundary.ts` |
| `tests/edge/handlers/shared.test.ts` | 1 | 1 | `../../helpers/…` | `../notification-boundary.ts` |
| `tests/edge/` root | 2 | 3 | `../helpers/…` | `./notification-boundary.ts` (sibling) |
| `tests/orchestrators/` | 4 | 4 | `../../helpers/…` | `../../edge/notification-boundary.ts` |
| **Total** | **26** | **28** | | |

Two consumers carry the specifier twice, because the house import ordering puts type-only imports last and both import `createNotificationBoundary` and the `Notification` type in separate statements: `tests/edge/handlers/plugin/list.test.ts` (lines 110 and 113) and `tests/edge/register.test.ts` (lines 53 and 65). Both lines were fixed in each. That is what makes the count 28 lines over 26 files.

Nothing else was rewritten in any consumer. No case body, no expectation, no count.

## What ESLint actually demanded

The plan predicted the ordering churn would fall on **the two suites directly under the edge root**, whose import becomes a sibling. Measured: `npm exec -- eslint tests/edge tests/orchestrators` reported **9 problems across 6 files**, not 2. The extra four are handler suites:

```
tests/edge/handlers/marketplace/add.test.ts
  89:1  error  `../../../platform/git-ops-fake.ts` import should occur before import of `../../notification-boundary.ts`
tests/edge/handlers/marketplace/update.test.ts    (same)
tests/edge/handlers/plugin/bootstrap.test.ts      (same)
tests/edge/handlers/plugin/import.test.ts         (same)

tests/edge/register.test.ts
  52:1  error  There should be at least one empty line between import groups
  53:1  error  There should be at least one empty line between import groups
  54:1  error  `../platform/git-ops-fake.ts` import should occur before import of `./notification-boundary.ts`
  65:1  error  `./notification-boundary.ts` type import should occur before type import of `../../extensions/…/edge/types.ts`

tests/edge/router.test.ts
  39:1  error  There should be at least one empty line between import groups
```

The cause is that the rule alphabetizes **within** the parent group as well as separating the sibling group. `../../notification-boundary.ts` sorts before `../../../platform/git-ops-fake.ts`, where `../../../helpers/notification-boundary.ts` sorted after it -- so every handler suite that also imports the git-ops fake moved a line. This is the plan's own instruction working as intended: *run ESLint and let it tell you the ordering; do not guess it*. Guessing would have shipped four ordering violations.

`eslint --fix` produced the placement; `npm exec -- eslint tests` then exits 0 over the whole tree. Prettier was run afterwards over all 27 touched paths and exits 0 with no collapse to reconcile -- unlike 117-02, where the shorter specifier let an import collapse onto an over-long line and only running both tools caught it.

## On the plant

There is no plant here beyond what the toolchain already forces, and the plan says so explicitly rather than inventing one that cannot fail:

- A **wrong specifier does not typecheck.** `tsc --noEmit` covers `tests/**/*.ts`, so a single missed rewrite is an `error TS` line, not a silent pass. That is the falsification route for all 28 lines at once.
- A **wrong module** would not satisfy the roughly twenty phase-116 proofs that verify against `createNotificationBoundary`'s exact counts. The `npm test` run is the proof that the definition every consumer now resolves to is still the one they were written against.

The **rename gate's** falsifiability was measured previously rather than re-planted here: the plan records that on this repository's own files, a move plus a small edit reports 94 to 96 percent (117-02 measured 96, 96 and 98), while a move plus a total rewrite and an edit with no move both report **no rename at all**. This commit's 100 percent is corroborated independently by two facts that do not depend on git's similarity heuristic: the `md5sum` match across the `git mv`, and `git log --follow` reaching `af7c501f`, `66e11dac` and `c2472de8`.

**The 100 percent was checked against the 117-02 trap before it was trusted.** In 117-02 the same reading was *false*, produced by a `git add` that aborted on a stale pathspec and left the consumer edits unstaged, so the summary was measuring a bare `git mv`. Here the ordering the plan prescribes was followed -- stage first, then read the gate -- and the staged state was confirmed before reading it: `git diff --name-only -- tests/` was empty, and `git diff --cached --name-only` counted **27** paths. So the 100 percent means what it says: the body genuinely was not edited.

## Gate results

Every link run separately, with its exit code read from the command itself and never from a pipe tail. `npm run check` was not used, per the plan: its `format:check` link fails on the operator's pre-existing untracked files (`.mcp.json`, the `.planning/research/.cache/*.json` set) and short-circuits before the tests run.

| Link | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | no `error TS` line |
| `npm exec -- eslint tests` | 0 | after `--fix` applied the 9 reported problems |
| `npm exec -- prettier --check` (27 paths) | 0 | "All matched files use Prettier code style!" |
| `npm run fallow` | 0 | moved module named in no finding |
| `npm test` | 0 | `ℹ tests 5143`, `ℹ suites 295`, `ℹ pass 5143`, `ℹ fail 0` |
| `npm run test:integration` | 0 | `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0` |
| old-directory scan (`rg 'helpers/notification-boundary' tests`) | 1 | no match |
| relocation-history scan on the moved file | 1 | no match |
| correspondence gate names the moved module | 1 | not named |
| `test ! -e tests/helpers/notification-boundary.ts` | 0 | gone |
| `git diff --quiet -- extensions/ package.json` | 0 | unchanged, working tree and index alike |
| staged rename summary | 0 | `rename tests/{helpers => edge}/notification-boundary.ts (100%)` |

**Baseline for comparison,** taken before the move on this same tree: `npm test` exit 0 with `ℹ tests 5143`, `ℹ suites 295`, `ℹ pass 5143`, `ℹ fail 0`. Both totals are the runner's own line; neither is computed.

The correspondence gate itself still exits 1 with the **same 7 violations** it had before this plan (`missing-test: tests/index.test.ts` plus six `unexpected-test` rows). This plan neither resolves nor adds one -- the moved module is not a `*.test.ts` file, so the gate has never had an opinion about it.

Pre-commit was run file-scoped over the 27 literal paths before the commit and every hook passed. Two were skipped for the two documented reasons: `trufflehog`, whose git-mode scan aborts structurally in a linked worktree, and `npm-format-check`, which fails on the operator's untracked files. The sanctioned substitute for the first was run first -- a filesystem trufflehog scan over the same 27 literal paths with `--results=verified,unknown --fail`, reporting `chunks: 79, bytes: 810223, verified_secrets: 0, unverified_secrets: 0`, exit 0.

## Decisions Made

- **One commit, containing the move and all 28 rewrites.** The plan's `must_haves` already declined the split and the reason is structural at this scale: a pure-move commit would leave 26 suites importing a path that does not exist, so it would not typecheck. The 116-17 rule that forces a split applies to a move plus a *total rewrite*; here the moved file's diff is literally zero lines.
- **The module was not edited in any way.** Read before moving, as the plan instructed: it carries no path header comment and no reference to its own directory. Its only relative specifier is `../../extensions/pi-claude-marketplace/platform/pi-api.ts`, a two-level climb that is identical at both homes. `toolProbes` stays required and a count of zero still states no expectation at all.
- **Import placement was measured, not authored,** and the measurement contradicted the plan's prediction in a way that mattered -- four more files than expected.
- **The 100 percent rename was cross-checked before being reported,** because the identical number was wrong in the immediately preceding plan for an unrelated reason.

## Deviations from Plan

None -- plan executed exactly as written. No production file, no `package.json` line and no `.prettierignore` entry was touched; `tests/helpers/marketplace-seed.ts` was not moved; no consumer was edited beyond its import statement and the ordering ESLint demanded.

## Issues Encountered

1. **One plan count is imprecise and is corrected here.** The action prose says "the seventeen suites under the two handler subdirectories". Measured by `rg` on this tree: **nineteen** -- 7 under `tests/edge/handlers/marketplace/` and 12 under `tests/edge/handlers/plugin/`, carrying 20 of the 28 lines. The plan's headline totals (26 consumers, 28 lines) are correct, and its `files_modified` frontmatter enumerates all 26 correctly; only the prose subtotal is off. This is exactly why the plan told the executor to re-derive the shape rather than trust it.

2. **The ordering churn is wider than the plan predicted** -- six suites, not two. Recorded above with the ESLint output verbatim, and with the cause, because the same effect will recur when 117-07 moves `marketplace-seed.ts` out from under `tests/helpers/`: shortening a specifier re-sorts it inside the parent group, not only across groups.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness

- `tests/helpers/` holds exactly one file, `marketplace-seed.ts`. 117-07 inherits the move of that module (15 consumers: 13 in `tests/edge/handlers/`, 2 in `tests/orchestrators/plugin/`), the deletion of the directory, and the `helpers` token in the two `package.json` globs.
- The move-and-rewrite mechanic is now proved at 5, 2 and 26 consumers. The 26-consumer case surfaced the parent-group re-sort effect, which 117-07 should expect.
- `package.json` is unchanged, so the 117-01 glob-completeness control is still green.
- The correspondence gate's 7 violations are untouched and remain 117-04's and the entry-pair plans' work. None is new.
- No blockers.

## Self-Check: PASSED

- `tests/edge/notification-boundary.ts` exists on disk; `tests/helpers/notification-boundary.ts` does not.
- Commit `50296404` is present in `git log`, carrying `rename tests/{helpers => edge}/notification-boundary.ts (100%)` in `git log -1 --stat`.
- `git log --follow tests/edge/notification-boundary.ts` reaches the pre-move history.
- Every `<verify>` link was run separately and its exit code read directly; all results are tabulated above.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*
