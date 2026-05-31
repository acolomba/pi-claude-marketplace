---
phase: 29-notification-label-suppression-update-classification
plan: 03
subsystem: api
tags: [update, manifest, classification, notify, cascade, UXG-08]

# Dependency graph
requires:
  - phase: 05-plugin-orchestrators
    provides: preflightUpdate three-phase update orchestrator + PluginUpdateOutcome discriminated union
  - phase: 16-renderer-public-api
    provides: outcomeToCascadePluginMessage failed-arm rendering (failed) {not in manifest}
provides:
  - "preflightUpdate consults the marketplace manifest BEFORE the not-installed guard"
  - "update <plugin>@<mp> where plugin is absent from state AND manifest -> (failed) {not in manifest} (matches install)"
affects: [phase-29-verification, gsd-complete-milestone]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Load-manifest-first ordering in preflightUpdate: a typo / nonexistent plugin name is distinguished from a real-but-uninstalled plugin by checking the manifest before concluding not-installed"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "D-29-08/09: moved loadCachedMarketplaceManifest above the record===undefined guard (cleanest restructure; cached path, no net I/O)"
  - "record===undefined && entry absent -> partition: failed, reasons: [not in manifest] (no fromVersion, matching install)"
  - "record===undefined && entry present -> partition: skipped, reasons: [not installed] (preserved); no PLUGIN_ENTRY_VALIDATOR.Check on this early-return arm"

patterns-established:
  - "Manifest-first classification: align update's not-in-manifest disposition with install's not-in-manifest arm"

requirements-completed: [UXG-08]

# Metrics
duration: 8min
completed: 2026-05-31
---

# Phase 29 Plan 03: Update Classification Fix Summary

**`preflightUpdate` now consults the marketplace manifest before the not-installed guard, so `update <nonexistent>@<mp>` renders `(failed) {not in manifest}` (matching `install`) instead of the misleading `(skipped) {not installed}`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-31T18:00:37Z
- **Completed:** 2026-05-31T18:09:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Restructured `preflightUpdate` (`orchestrators/plugin/update.ts`) to load the cached marketplace manifest BEFORE the `record === undefined` ("not installed") guard.
- A plugin absent from BOTH local state and the manifest now returns `partition: "failed"`, `reasons: ["not in manifest"]` -- the same disposition `install` produces for a typo / nonexistent plugin name.
- Preserved both existing arms: in-manifest-but-not-installed still returns `(skipped) {not installed}`; installed-but-delisted still returns `(skipped) {not in manifest}` with `fromVersion`.
- Added a new PUP-1 test asserting the `(failed) {not in manifest}` byte form (severity `error`) for the absent-from-both case, with the adjacent PUP-1 `(skipped) {not installed}` byte form retained as the regression anchor.

## Task Commits

Each task was committed atomically (TDD: test RED proved first, then implementation GREEN; committed implementation-then-test per the plan's two-task split):

1. **Task 1: Fix preflightUpdate to consult manifest before not-installed guard** -- `9e18b83` (fix)
2. **Task 2: Add update.test.ts test for not-installed + not-in-manifest case** -- `6a872d9` (test)

_Note: the RED proof for Task 1 was the Task 2 test, authored and run against the unmodified code first (failed exactly: actual `(skipped) {not installed}` vs expected `(failed) {not in manifest}`), then the fix turned it GREEN. The two changes were committed as separate atomic commits per the plan structure._

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- `preflightUpdate`: manifest load + `entryRaw` lookup moved above the `record === undefined` guard; the guard split into two arms (failed/not-in-manifest vs skipped/not-installed); the installed-but-delisted arm unchanged below.
- `tests/orchestrators/plugin/update.test.ts` -- new test `PUP-1 pl@mp: targeting a plugin not in state AND not in manifest -> partition='failed' (not in manifest)` using `manifestPlugins: {}` and no prior install.

## Decisions Made

- **D-29-08/09 restructure (recommended approach):** moved `loadCachedMarketplaceManifest` + `entryRaw` lookup above the `record === undefined` check rather than inlining a second manifest read inside that branch. This is the cleanest form, uses the cached path, and adds no net I/O.
- The `record === undefined && entry present` ("in manifest, not installed") arm returns early WITHOUT calling `PLUGIN_ENTRY_VALIDATOR.Check(entryRaw)` -- validation is unnecessary for this skip return, matching the plan's `<action>` note.
- The new `failed` return carries `declaresAgents: false, declaresMcp: false` (the static-skipped/failed return pattern used throughout the function) and omits `fromVersion` (there is no install record to read a version from).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added blank line before the "not installed" return to satisfy `@stylistic/padding-line-between-statements`**
- **Found during:** Task 1 (preflightUpdate restructure)
- **Issue:** ESLint flagged `Expected blank line before this statement` on the `return` following the inner `if (entryRaw === undefined) { ... }` block; `npm run check` requires lint clean (NFR-6).
- **Fix:** Inserted a blank line before the comment block preceding the `(skipped) {not installed}` return.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- **Verification:** `eslint` re-run exit 0; `prettier --check` still clean.
- **Committed in:** `9e18b83` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking lint fix)
**Impact on plan:** The lint fix is required for the quality bar (NFR-6). No scope creep -- same logic, one whitespace line.

## Issues Encountered

- The worktree has no `node_modules`, so `npm run check` cannot run in-place. Verification ran the worktree source files via `NODE_PATH=<main-repo>/node_modules` against `node --test`, and ran `tsc` / `eslint` / `prettier` via the main repo's `node_modules/.bin`. The plan's `cd /home/acolomba/pi-claude-marketplace && npm test ...` verify commands point at the main checkout, not the worktree; running them verbatim would have tested the unmodified files, so the equivalent gates were run against the worktree files explicitly.
- `pre-commit run trufflehog` fails inside the worktree (`.git` is a file, not a directory -- trufflehog cannot read the git index). This is the documented worktree-sandbox limitation in CLAUDE.md; commits used the prescribed `SKIP=trufflehog` prefix. The changes are pure TypeScript logic + test code with no secrets.

## Verification Results

- **typecheck (`tsc --noEmit`):** exit 0
- **eslint (changed files):** exit 0
- **prettier --check (changed files):** clean
- **full unit suite (`tests/{architecture,...}/**/*.test.ts`):** 1158/1158 pass, 0 fail, 0 skipped (exit 0)
- **PUP suite:** 15/15 pass -- new `(failed) {not in manifest}` test GREEN; PUP-1 `(skipped) {not installed}` and PUP-5 `(skipped) {not in manifest}` preserved

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UXG-08 closed. `update.ts` classification now matches `install.ts` for the manifest-absent case.
- No blockers. Ready for Phase 29 verification and (once all Phase 29 plans land) `/gsd-complete-milestone`.

## Self-Check: PASSED

- FOUND: `.planning/phases/29-notification-label-suppression-update-classification/29-03-SUMMARY.md`
- FOUND commit `9e18b83` (fix: `update.ts` preflightUpdate reorder)
- FOUND commit `6a872d9` (test: `update.test.ts` not-in-manifest case)
- FOUND commit `0e1b754` (docs: SUMMARY)

---
*Phase: 29-notification-label-suppression-update-classification*
*Completed: 2026-05-31*
