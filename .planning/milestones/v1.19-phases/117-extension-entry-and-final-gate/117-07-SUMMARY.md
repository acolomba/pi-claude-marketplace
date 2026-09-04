---
phase: 117-extension-entry-and-final-gate
plan: "07"
subsystem: testing
tags: [node-test, git-rename, import-order, npm-scripts, glob, eslint, prettier]

requires:
  - phase: 117-extension-entry-and-final-gate
    provides: "117-01's glob-completeness control, which had to land green before this plan could amend either glob"
  - phase: 117-extension-entry-and-final-gate
    provides: "117-03's parent-group re-sort finding, which predicted the ESLint churn this move produced"
provides:
  - the marketplace fixture seed at tests/edge/handlers/, beside the 13 handler suites that dominate its consumer set
  - the two accepted cross-tier orchestrator imports, named rather than left to be rediscovered
  - tests/helpers/ deleted from the filesystem and from both unit-suite globs
  - SUITE-02 satisfied — no generic test-support directory remains in the repository
affects: [117-08 glob amendment, 117-12 closing sweep]

actuals:
  tokens: 4278
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "a move that goes DEEPER re-depths the moved module's own specifiers — the one edit no consumer rewrite reveals"
    - "a glob alternative is removed for honesty, and the completeness control is what proves the matched set did not change"

key-files:
  created:
    - tests/edge/handlers/marketplace-seed.ts
  modified:
    - package.json
    - tests/edge/handlers/marketplace/autoupdate.test.ts
    - tests/edge/handlers/marketplace/info.test.ts
    - tests/edge/handlers/marketplace/list.test.ts
    - tests/edge/handlers/marketplace/remove.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts
    - tests/edge/handlers/plugin/fetch.test.ts
    - tests/edge/handlers/plugin/info.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/plugin/list.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/list.test.ts

key-decisions:
  - "The move and its 15 consumer rewrites are one commit. A pure-move commit would leave 15 suites importing a path that does not exist and would not typecheck, so the 116-17 move-plus-total-rewrite split does not apply."
  - "All three of the module's own production specifiers gained a climb, because this is the only move in the dissolution whose new home is DEEPER than the old one. Nothing in any consumer reveals that; only reading the module does."
  - "The manifest edit and the move are separate commits, so the glob change is revertable without unwinding 16 files."
  - "The stale tests/helpers/ references in .planning/codebase/TESTING.md were logged as a deferred item rather than fixed, because the staleness is phase-wide and 117-12 owns the sweep."

patterns-established:
  - "Depth-aware relocation: when the destination is deeper than the source, the moved module's own relative specifiers are part of the edit, and typecheck is the falsification route for both sides at once."
  - "A dead glob alternative is deleted for honesty, and its deadness is measured (identical matched sets, not merely equal counts) rather than asserted."

requirements-completed: [SUITE-02, SUITE-04, DEL-03]

coverage:
  - id: D1
    description: "The marketplace fixture seed lives at tests/edge/handlers/marketplace-seed.ts, beside the 13 handler suites that are 13 of its 15 consumers, and the move is recorded by git as a rename"
    requirement: DEL-03
    verification:
      - kind: other
        ref: "git diff --cached -M --summary — 'rename tests/{helpers => edge/handlers}/marketplace-seed.ts (94%)'"
        status: pass
      - kind: other
        ref: "git log --follow tests/edge/handlers/marketplace-seed.ts reaches 39dc5b89, the pre-move history"
        status: pass
      - kind: other
        ref: "test ! -e tests/helpers/marketplace-seed.ts — exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 15 consumer specifiers and all three of the module's own production specifiers resolve from the new, deeper location"
    requirement: SUITE-02
    verification:
      - kind: other
        ref: "npm run typecheck — exit 0, no error TS line; a missed consumer specifier or a missed climb inside the module both surface here"
        status: pass
      - kind: unit
        ref: "npm test — exit 0, runner reported ℹ tests 5141, ℹ suites 295, ℹ pass 5141, ℹ fail 0; unchanged from the pre-move baseline"
        status: pass
      - kind: integration
        ref: "npm run test:integration — exit 0, ℹ tests 31, ℹ pass 31, ℹ fail 0"
        status: pass
      - kind: other
        ref: "rg -n 'helpers/marketplace-seed' tests scripts — exit 1, no match"
        status: pass
    human_judgment: false
  - id: D3
    description: "tests/helpers/ does not exist as a directory and neither unit-suite glob names it"
    requirement: SUITE-02
    verification:
      - kind: other
        ref: "test ! -d tests/helpers — exit 0"
        status: pass
      - kind: other
        ref: "rg -n 'helpers' package.json — exit 1; rg -n 'tests/helpers' tests scripts — exit 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Removing the helpers alternative changed nothing about which files the unit suite runs"
    requirement: SUITE-04
    verification:
      - kind: unit
        ref: "tests/architecture/unit-suite-glob-completeness.test.ts — both cases pass after the manifest edit, so the matched set still equals the tree"
        status: pass
      - kind: other
        ref: "globSync measured on this tree: 248 paths with the alternative, 248 without, and the two sorted arrays are identical"
        status: pass
      - kind: unit
        ref: "npm test before the manifest edit ℹ tests 5141 and after ℹ tests 5141, both read from the runner"
        status: pass
    human_judgment: false
  - id: D5
    description: "No production file changed, no exemption list or replacement shared directory was created, and the root-level owner pattern was not added"
    requirement: SUITE-04
    verification:
      - kind: other
        ref: "git diff --quiet -- extensions/ package.json (task 1) and git diff --quiet -- extensions/ (task 2) — both exit 0"
        status: pass
      - kind: other
        ref: "git diff -- package.json shows exactly two changed lines, both the brace list; no other script token changed"
        status: pass
      - kind: other
        ref: "npm run fallow — exit 0; npm run lint — exit 0; npm exec -- prettier --check tests and package.json — exit 0"
        status: pass
    human_judgment: false

duration: 28 min
completed: 2026-09-03
status: complete
---

# Phase 117 Plan 07: The Marketplace Seed Move and Helpers Close-Out Summary

**`tests/helpers/` is gone — the marketplace seed moved to `tests/edge/handlers/` at a 94 percent rename with all three of its own production specifiers re-depthed for the deeper home, 15 consumer specifiers rewritten, and the `helpers` alternative dropped from both unit globs with the matched file set proved unchanged at 248 paths.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-03T18:50:00Z
- **Completed:** 2026-09-03T19:18:00Z
- **Tasks:** 2
- **Files modified:** 17 (1 moved, 15 consumers edited, 1 manifest)

## Accomplishments

- The marketplace fixture seed now lives at `tests/edge/handlers/marketplace-seed.ts`, beside the 13 handler suites that are 13 of its 15 consumers. Git records the move as `rename tests/{helpers => edge/handlers}/marketplace-seed.ts (94%)`, inside the 94-to-96 percent band the plan cites for a move plus a small edit.
- **All three of the module's own production import specifiers gained a climb.** This is the only move in the dissolution whose destination is deeper than its source — `tests/helpers/` is two levels below the repository root, `tests/edge/handlers/` is three — so `../../extensions/pi-claude-marketplace/…` became `../../../extensions/pi-claude-marketplace/…` on all three: `persistence/config-io.ts`, `persistence/state-io.ts`, and the type-only `persistence/locations.ts`. The count was read off the file, not assumed.
- All **15 consumer import lines across 15 suites** resolve to the new path. Each consumer carries exactly one such line, so files and lines are the same number here.
- `tests/helpers/` no longer exists, as a directory or as an alternative in either npm glob. SUITE-02 is satisfied: no generic test-support directory remains in this repository.
- The suite total is unchanged at every step, always read from the runner's own `ℹ tests` line and never computed: **5141 before the move, 5141 after the move, 5141 after the manifest edit**, over **295 suites**, `ℹ fail 0` each time.
- The 117-01 glob-completeness control is green after the manifest edit, which is the proof the plan asked for — and the reason that control had to land first.

## Task Commits

1. **Task 1: Move the marketplace seed beside the handler suites** — `a65bcfce` (refactor)
2. **Task 2: Delete tests/helpers and stop both npm globs naming it** — `5a244641` (chore)

**Plan metadata:** see the `docs(117-07)` commit that carries this summary.

## The two accepted cross-tier imports (D-117-05)

These two orchestrator suites now reach across the tier boundary into `tests/edge/handlers/`. They are accepted and named, not incidental:

| Consumer | New specifier |
| --- | --- |
| `tests/orchestrators/plugin/info.test.ts` | `../../edge/handlers/marketplace-seed.ts` |
| `tests/orchestrators/plugin/list.test.ts` | `../../edge/handlers/marketplace-seed.ts` |

**Why this breaks nothing configured.** `.fallowrc.json`'s `boundaries.zones` block scopes its zones to paths under `extensions/pi-claude-marketplace/`, and the ESLint `import-x/no-restricted-paths` architecture rule likewise scopes to the production tree. Neither has any zone or rule covering `tests/`. `npm run fallow` exits 0 and names the moved module in no finding; `npm exec -- eslint tests` exits 0. There is no boundary rule these two violate. D-117-06 already rejected the alternative — a second copy of the seed per tier — at a `fallow dupes` threshold of three lines.

These two join the four `notification-boundary.ts` cross-tier imports 117-03 named, completing the six D-117-05 accepts.

## The specifier rewrite, as measured

Re-derived by `rg` on this tree before the move, as the plan instructed, rather than trusted from the plan's prose:

| Group | Files | Lines | Old specifier | New specifier |
| --- | --- | --- | --- | --- |
| `tests/edge/handlers/marketplace/` | 5 | 5 | `../../../helpers/marketplace-seed.ts` | `../marketplace-seed.ts` |
| `tests/edge/handlers/plugin/` | 8 | 8 | `../../../helpers/marketplace-seed.ts` | `../marketplace-seed.ts` |
| `tests/orchestrators/plugin/` | 2 | 2 | `../../helpers/marketplace-seed.ts` | `../../edge/handlers/marketplace-seed.ts` |
| **Total** | **15** | **15** | | |

Nothing else was rewritten in any consumer — no case body, no expectation, no count. The module's own body was untouched beyond its three specifiers and its path header comment; its pre-existing double assertions stay exactly as they were, and no relocation note was added (the history scan over the moved file exits 1).

## What ESLint actually demanded

117-03 predicted this effect and it recurred, at a wider scope than in that plan. `npm exec -- eslint tests` reported **13 problems across 13 files** — every handler suite, and neither orchestrator suite:

```
tests/edge/handlers/marketplace/autoupdate.test.ts
  50:1  error  `../../notification-boundary.ts` import should occur before import of `../marketplace-seed.ts`  import-x/order
tests/edge/handlers/marketplace/update.test.ts
  88:1  error  `../marketplace-seed.ts` import should occur after import of `../../notification-boundary.ts`   import-x/order
```

The direction is the mirror image of 117-03's. There, the shortened specifier sorted **earlier** in the parent group; here it sorts **later**, because `../../notification-boundary.ts` precedes `../marketplace-seed.ts` alphabetically where the old `../../../helpers/marketplace-seed.ts` followed it. Every handler suite that also imports the notification boundary — which is all 13 — moved a line. Guessing the ordering would have shipped 13 violations; running the tool is what the plan required, and it was right to.

Then Prettier, run second as the field notes require: `--check` reported `[warn]` on **three** of the 13 files. The 117-02 collapse effect, in the opposite direction — the shorter specifier let a three-line braced import fit inside the 100-column limit:

```
-import {
-  buildInstalledPluginRecord,
-  mergeMarketplaceIntoState,
-} from "../marketplace-seed.ts";
+import { buildInstalledPluginRecord, mergeMarketplaceIntoState } from "../marketplace-seed.ts";
```

`tests/edge/handlers/marketplace/update.test.ts`, `plugin/list.test.ts` and `plugin/uninstall.test.ts`. The diff was inspected before applying it, to confirm it touched only the import statement. Running ESLint alone would have committed a failing format gate.

## On the plant

There is no plant invented here, and the plan says so rather than writing a proof that cannot fail:

- A **wrong specifier does not typecheck.** `tsc --noEmit` covers `tests/**/*.ts`, so a single missed rewrite — on a consumer or inside the module itself — is an `error TS` line. That is the falsification route for the 15 consumer lines and the three own-module climbs at once.
- A **wrong module** would fail the 15 suites that seed fixtures from it. The `npm test` run is the proof that what every consumer now resolves to is the definition they were written against.
- The **rename gate's** falsifiability was established by earlier measurement on this repository's own files rather than re-planted: a move plus a small edit reports 94 to 96 percent (117-02 measured 96, 96, 98; this commit reports 94), while a move plus a total rewrite and an edit with no move both report no rename at all. The 94 percent here is corroborated independently by `git log --follow`, which reaches `39dc5b89`.
- The **glob claim is measured, not restated.** `globSync` on this tree returns **248** paths for the brace list with the `helpers` alternative and **248** without it, and the two sorted arrays compare identical — set equality, not merely equal counts. The 249 the plan quotes was measured before the phase began; the tree has since lost `source-scan.test.ts` from that directory (117-04) and a folded cascade suite (117-06). The 117-01 control passing after the edit is the independent second proof.

## Gate results

Every link run separately, with its exit code read from the command itself and never from a pipe tail — the zsh `$status` trap the field notes document. `npm run check` was not used, per the plan: its `format:check` link fails on the operator's pre-existing untracked files and short-circuits before the tests run.

### Task 1

| Link | Exit | Result |
| --- | --- | --- |
| `npm run typecheck` | 0 | no `error TS` line |
| `npm exec -- eslint tests` | 0 | after `--fix` applied the 13 reported problems |
| `npm exec -- prettier --check tests` | 0 | after `--write` on the three collapsed imports |
| `npm run fallow` | 0 | moved module named in no finding |
| `npm test` | 0 | `ℹ tests 5141`, `ℹ suites 295`, `ℹ pass 5141`, `ℹ fail 0` |
| `npm run test:integration` | 0 | `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0` |
| `rg 'helpers/marketplace-seed' tests scripts` | 1 | no match |
| relocation-history scan on the moved file | 1 | no match |
| correspondence gate names the seed | 1 | not named |
| `test ! -e tests/helpers/marketplace-seed.ts` | 0 | gone |
| `git diff --quiet -- extensions/ package.json` | 0 | unchanged |
| staged rename summary | 0 | `rename tests/{helpers => edge/handlers}/marketplace-seed.ts (94%)` |

### Task 2

| Link | Exit | Result |
| --- | --- | --- |
| `node --test tests/architecture/unit-suite-glob-completeness.test.ts` | 0 | `ℹ tests 2`, `ℹ pass 2`, `ℹ fail 0` |
| `npm run typecheck` | 0 | |
| `npm run lint` | 0 | |
| `npm exec -- prettier --check package.json` | 0 | |
| `npm run fallow` | 0 | |
| `npm test` | 0 | `ℹ tests 5141`, `ℹ suites 295`, `ℹ pass 5141`, `ℹ fail 0` |
| `npm run test:integration` | 0 | `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0` |
| `rg 'helpers' package.json` | 1 | no match |
| `test ! -d tests/helpers` | 0 | gone |
| `rg 'tests/helpers' tests scripts` | 1 | no match |
| `git diff --quiet -- extensions/` | 0 | unchanged |

**Baseline for comparison,** taken on this tree before the `git mv`: `npm test` exit 0 with `ℹ tests 5141`, `ℹ suites 295`, `ℹ pass 5141`, `ℹ fail 0`. Every total quoted in this summary is the runner's own line.

The correspondence gate still exits 1 with the **same 3 violations** it had before this plan — `missing-test: tests/index.test.ts`, `unexpected-test: tests/edge/index-handler.test.ts`, `unexpected-test: tests/shared/index-smoke.test.ts`. All three belong to 117-08. This plan neither resolves nor adds one; the seed is not a `*.test.ts` file, so the gate has never had an opinion about it.

Pre-commit was run file-scoped before each commit and every hook passed. Two were skipped for the two documented reasons: `trufflehog`, whose git-mode scan aborts structurally in this linked worktree, and `npm-format-check`, which fails on the operator's untracked files (`.mcp.json`, the `.planning/research/.cache/*.json` set) and named no file this plan touched. The sanctioned substitute for the first was run first, over the literal paths of each commit:

- Task 1, 16 paths: `chunks: 77, bytes: 890357, verified_secrets: 0, unverified_secrets: 0`, exit 0.
- Task 2, `package.json`: `chunks: 1, bytes: 4761, verified_secrets: 0, unverified_secrets: 0`, exit 0.

## Decisions Made

- **One commit for the move plus all 15 rewrites, a second for the manifest.** The plan's `must_haves` already declined the 116-17 split for the move: a pure-move commit would leave 15 suites importing a path that does not exist, so it would not typecheck. The manifest edit is genuinely separable and got its own commit, so the glob change can be reverted without unwinding 16 files.
- **The module's own specifiers were fixed by reading the file, not by inferring from consumers.** Nothing in any of the 15 consumer edits indicates the module moved deeper. This was the plan's stated highest-value warning and it was correct.
- **Import placement and line collapse were both measured, not authored.** ESLint decided the ordering in 13 files; Prettier decided the collapse in three. The proposed Prettier diff was inspected before applying to confirm it touched only the import statement.
- **The rename was read only after staging.** `git diff --name-only -- tests/` was empty and `git diff --cached --name-only` counted 16 before the gate was read, which is the 117-02 trap the field notes describe: a percentage read against a partially-staged index is not about your change.
- **The stale `tests/helpers/` references in `.planning/codebase/TESTING.md` were deferred, not fixed.** The staleness is phase-wide (four moves across 117-02, 117-03, 117-04 and this plan) and this plan's `files_modified` does not name that file. Logged as deferred item 3 and to `.planning/WINDOWS.md` for the 117-12 sweep.

## Deviations from Plan

None — plan executed exactly as written. No production file changed, no exemption list or replacement shared directory was created, the root-level owner pattern was not added to either glob, the seed's body was not rewritten beyond its three specifiers and its path header, and no consumer was edited beyond its import statement and the placement ESLint and Prettier demanded.

## Issues Encountered

1. **The plan's 249-path figure is stale and is corrected here by measurement.** Measured on this tree: both globs match **248** paths with the `helpers` alternative and 248 without it, with identical membership. The plan's 249 was measured before the phase began; 117-04 relocated `source-scan.test.ts` out of that directory and 117-06 folded a cascade suite, and 117-01 added one. The plan's *claim* — that removing the alternative changes nothing about which files run — holds, and the set-equality check is stronger evidence for it than either count.

2. **The ESLint churn is wider than the notification-boundary move's and runs the other way.** Thirteen files, not the six 117-03 saw, and the shortened specifier now sorts **after** the notification boundary where 117-03's sorted **before** its neighbor. The lesson generalizes as "shortening a specifier re-sorts it inside the parent group", with no reliable prediction of direction — which is exactly why the plan forbids guessing.

3. **`.planning/codebase/TESTING.md` describes a directory that no longer exists,** in ten places, including both globs quoted with the `helpers` alternative and four modules named by their pre-move paths. Out of this plan's scope; logged as deferred item 3. No gate reads that file.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `tests/helpers/` is gone from the filesystem, from both npm globs, and from every reference under `tests/` and `scripts/`. SUITE-02 is satisfied and the dissolution D-117-04 prescribes is complete.
- **117-08 inherits both glob lines in their post-`helpers` form.** Re-read `package.json` from disk before editing: the brace list is now `{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}` on lines 82 and 91. The 117-01 completeness control is green, so adding `tests/index.test.ts` without amending the globs will turn both of its cases RED with the new file on the expected side — the intended forcing function, not a regression.
- The correspondence gate's 3 violations are untouched and are entirely 117-08's. None is new.
- Requirement IDs were deliberately NOT marked complete: `SUITE-02`, `SUITE-04` and `DEL-03` are declared by more than one plan in this phase, and D-117-12 owns the sweep.
- No blockers.

## Self-Check: PASSED

- `tests/edge/handlers/marketplace-seed.ts` exists on disk; `tests/helpers/` does not exist as a file or a directory.
- Commits `a65bcfce` and `5a244641` are both present in `git log`, and `a65bcfce` carries the rename in `git log -1 --stat`.
- Every `<verify>` link from both tasks was run separately and its exit code read directly; all results are tabulated above.

---
*Phase: 117-extension-entry-and-final-gate*
*Completed: 2026-09-03*
