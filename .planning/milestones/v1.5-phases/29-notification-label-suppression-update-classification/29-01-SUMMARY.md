---
phase: 29-notification-label-suppression-update-classification
plan: "01"
subsystem: notifications
tags: [notify, severity, summary-line, cascade, UXG-07, typescript]

# Dependency graph
requires:
  - phase: 28-severity-routing-label-discipline
    provides: computeSeverity 5-arm ladder + BENIGN_REASONS/allBenign predicate (the traversal buildSummaryLine mirrors)
provides:
  - "buildSummaryLine helper in shared/notify.ts that counts failed/skipped plugin + marketplace operations"
  - "notify() prepends '{summary}\\n\\n{cascade body}' for error/warning severity; info severity byte-unchanged"
  - "notify-v2.test.ts + downstream orchestrator/snm38 assertions moved to the summary-line byte forms"
affects:
  - 29-02 (catalog-uat byte gate + output-catalog.md + style guide + ADR must adopt the summary line)
  - 29-03 (update.test.ts error/warning assertions must prepend the summary line)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Summary-line composition: notify() prepends a human-readable count sentence before the cascade body for error/warning severity only"
    - "Counting helpers (countFailedOperations / countSkippedOperations) mirror computeSeverity's traversal and allBenign predicate"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - tests/shared/notify-v2.test.ts
    - tests/shared/snm38-indent-ladder.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts

key-decisions:
  - "buildSummaryLine kept file-private (no new public export); the 0/0 edge case degrades to '0 plugin operations <verb>.' rather than crashing"
  - "Extracted countFailedOperations/countSkippedOperations/operationPhrase to keep cognitive complexity <= 15 (ESLint sonarjs gate)"
  - "Lockstep-moved downstream orchestrator + snm38 assertions broken by the notify() output change (Rule 1), EXCEPT update.test.ts (Plan 03's file) and catalog-uat/output-catalog (Plan 02's files)"

patterns-established:
  - "Summary line grammar (D-29-03): singular 'operation' for count 1, plural 'operations' otherwise; mixed plugin+marketplace renders 'N plugin operation(s) and M marketplace operation(s) <verb>.'"

requirements-completed: [UXG-07]

# Metrics
duration: ~15 min
completed: 2026-05-31
---

# Phase 29 Plan 01: Notification Summary Line Summary

**`notify()` now prepends a human-readable summary line ("N plugin operation(s) [and M marketplace operation(s)] failed/skipped.") before the cascade body for error/warning severity, giving the host `Error:`/`Warning:` prefix a meaningful sentence to introduce; info severity is byte-identical.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-31T18:04:00Z (approx)
- **Completed:** 2026-05-31T18:20:00Z (approx)
- **Tasks:** 2 (both TDD)
- **Files modified:** 7

## Accomplishments

- Added file-private `buildSummaryLine(message, severity)` to `shared/notify.ts`, co-located with `computeSeverity`, counting failed (error) / actionable-skip + manual-recovery (warning) plugin and marketplace operations via the same traversal `computeSeverity` performs.
- Wired the composition into `notify()`: for `error`/`warning` severity the call becomes `ctx.ui.notify("{summary}\n\n{cascade body}", severity)`; the reload-hint (if any) stays last. Info severity is unchanged (single-arg, no summary line).
- Left `notifyUsageError()` byte-unchanged (out of scope per CONTEXT.md).
- Updated `notify-v2.test.ts` error/warning call-arg assertions in lockstep and added 10 new UXG-07 composition tests (singular / plural / mixed grammar, info-negative, summary-before-body + reload-hint-last ordering).
- Lockstep-moved the downstream assertions broken by the new `notify()` output: `install.test.ts` (4), `uninstall.test.ts` (1), `list.test.ts` (1), `autoupdate.test.ts` (1), and the `snm38-indent-ladder.test.ts` full-ladder snapshot.

## Task Commits

Each task was committed atomically (TDD: test -> feat -> lockstep test update):

1. **Task 1 (RED): failing tests for the summary line** - `38e5065` (test)
2. **Task 1 (GREEN): buildSummaryLine helper + notify() composition** - `17ff9b5` (feat)
3. **Task 2: prepend summary line to error/warning assertions (notify-v2 + downstream lockstep)** - `4738978` (test)

_TDD note: Task 1 RED was committed first (8 of 10 new tests failing), then GREEN. Task 2 reconciled the existing/downstream assertions._

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - Added `buildSummaryLine` + `countFailedOperations` / `countSkippedOperations` / `operationPhrase` helpers; `notify()` composes the summary prefix for error/warning severity.
- `tests/shared/notify-v2.test.ts` - Updated 8 error/warning full-string assertions; added 10 UXG-07 composition tests; added a SUMMARY-LINE COMPOSITION note to the file-header v2 mini-spec.
- `tests/shared/snm38-indent-ladder.test.ts` - Full ladder snapshot updated from `[0,2,2,2,2,4,0,0,2]` to `[0,0,0,2,2,2,2,4,0,0,2]` (the two leading zeros are the prepended summary line + blank line; the fixture carries a `failed` plugin row so it computes error severity).
- `tests/orchestrators/plugin/install.test.ts` - PI-3 (x2), PI-5, CMP-4/PI-16 assertions prepend the summary line.
- `tests/orchestrators/plugin/uninstall.test.ts` - PU-3/PU-7 `.startsWith` prefix updated.
- `tests/orchestrators/plugin/list.test.ts` - PL-6/CMC-22 (marketplace-only failed header) -> `"1 marketplace operation failed."`.
- `tests/orchestrators/marketplace/autoupdate.test.ts` - missing-everywhere flip failure -> `"1 marketplace operation failed."`.

## Decisions Made

- **buildSummaryLine stays file-private.** The plan's success criterion forbids new public exports; the planned 0-failed-rows edge-case ("0 plugin operations failed.") is unreachable through the public `notify()` surface (computeSeverity only returns error/warning when a matching row exists), so it is documented in code rather than asserted via a test hook. Replaced the would-be edge-case test with a benign-only-cascade info-negative test.
- **Decomposed the counting** into `countFailedOperations` / `countSkippedOperations` / `operationPhrase` to satisfy the ESLint `sonarjs/cognitive-complexity` gate (a single inlined function measured 33 vs the 15 ceiling).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Lockstep test move] Downstream orchestrator + snm38 assertions broke on the notify() output change**
- **Found during:** Task 2 (updating notify-v2 assertions)
- **Issue:** The plan's `files_modified` for Plan 01 listed only `notify.ts` and `notify-v2.test.ts`, but changing `notify()`'s error/warning output string broke 12 orchestrator assertions and the `snm38-indent-ladder.test.ts` full-ladder snapshot that assert the exact `notify()` byte output. No plan in the phase was scoped to fix the non-`update` orchestrator files (`install`, `uninstall`, `list`, `autoupdate`) or `snm38`, so leaving them red would fail the phase's `npm run check` gate permanently.
- **Fix:** Prepended the correct summary line to the broken assertions in `install.test.ts` (4), `uninstall.test.ts` (1), `list.test.ts` (1), `autoupdate.test.ts` (1), and updated the `snm38` ladder snapshot. Did NOT touch `update.test.ts` (owned by the parallel wave-1 Plan 03 -- editing it from this worktree would cause a merge collision) or the catalog files (owned by wave-2 Plan 02).
- **Files modified:** tests/orchestrators/plugin/{install,uninstall,list}.test.ts, tests/orchestrators/marketplace/autoupdate.test.ts, tests/shared/snm38-indent-ladder.test.ts
- **Verification:** All 166 tests across the 6 modified test files pass; `npm run typecheck`/`lint`/`format:check` clean.
- **Committed in:** `4738978` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 lockstep test move).
**Impact on plan:** The lockstep moves are mandatory -- they are the canonical Rule 1 response to a behavior-output change. No scope creep beyond reconciling assertions that directly assert `notify()`'s output. Two test surfaces were deliberately left to their owning sibling plans to avoid worktree merge collisions.

## Issues Encountered

- **Cross-plan convergence: `npm run check` does NOT exit 0 after Plan 01 in isolation.** 6 tests remain red by design and are owned by sibling plans:
  - `catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()` -- the catalog-uat byte gate compares `docs/output-catalog.md` fenced blocks against live `notify()` output. The catalog blocks gain the summary line only in **Plan 29-02** (`output-catalog.md` + `catalog-uat.test.ts`).
  - 5 `PUP-*` tests in `tests/orchestrators/plugin/update.test.ts` (PUP-4, PUP-5, PUP-1 x3) -- these assert error/warning `notify()` strings and need the summary prefix. They are owned by **Plan 29-03** (which owns `update.test.ts`).

  **ACTION REQUIRED for Plan 29-03:** the plan's Task 2 (29-03-PLAN.md line ~131) specifies the new not-in-manifest assertion as `"● mp [project]\n  ⊘ hello (failed) {not in manifest}"` with severity `"error"` -- this is STALE. After Plan 01, that error-severity notify emits `"1 plugin operation failed.\n\n● mp [project]\n  ⊘ hello (failed) {not in manifest}"`. Plan 29-03 must (a) prepend `"1 plugin operation failed.\n\n"` to its new assertion, and (b) update the 5 existing PUP error/warning assertions in `update.test.ts` to prepend the appropriate summary line (`"1 plugin operation skipped.\n\n"` for the warning `(skipped) {not installed}` cases; `"1 plugin operation failed.\n\n"` for the error PluginFailedMessage cases). Full green is restored only after Plans 29-02 and 29-03 merge.

## Threat Flags

None -- no new security-relevant surface. `buildSummaryLine` is a pure in-memory count over the `NotificationMessage` already constructed by orchestrators (matches the plan's `<threat_model>` T-29-01 `accept` disposition). No npm installs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 29-02 (catalog/style-guide/ADR) and Plan 29-03 (update.ts reclassification + update.test.ts) must land to restore `npm run check` exit 0. See the explicit ACTION REQUIRED note above for the Plan 29-03 assertion correction.
- `buildSummaryLine` is the canonical home for the summary-line grammar; future surfaces flow through `notify()` and gain the summary automatically.

## Self-Check: PASSED

- FOUND: `.planning/phases/29-notification-label-suppression-update-classification/29-01-SUMMARY.md`
- FOUND: `extensions/pi-claude-marketplace/shared/notify.ts` (contains `buildSummaryLine`)
- FOUND commit `38e5065` (test RED)
- FOUND commit `17ff9b5` (feat GREEN)
- FOUND commit `4738978` (test lockstep)

---
*Phase: 29-notification-label-suppression-update-classification*
*Completed: 2026-05-31*
