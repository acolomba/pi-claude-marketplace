---
phase: 03-desired-state-output-atomic-catalog-supersession
plan: 01
subsystem: notifications
tags: [typescript, notify, catalog-uat, severity, desired-state-output]

# Dependency graph
requires:
  - phase: 02-caller-stamped-severity-reload-reducer
    provides: caller-stamped row.severity + dumb MAX reducer (computeSeverity/cascadeSeverity); skipSeverity + IDEMPOTENT_REASONS; producer emit-site stamping model
  - phase: 01-localized-type-model-command-context-spine
    provides: CommandContext.Messaging.label; per-command render maps (REINSTALL/UPDATE/UNINSTALL_CONTEXT); structural tuple-vs-array cardinality
provides:
  - "OUT-02/D-02 leading severity sentence ([A|Some] <subject> operation[s] has/have failed | needs/need attention.)"
  - "OUT-06/D-03 render-time mixed-subject detection (drop subject noun when a cascade spans plugin + marketplace rows)"
  - "D-01 absent-target error severity: reinstall/update not-installed -> error; standalone uninstall already-gone -> error (failed) {not installed} row"
  - "uninstall already-gone-not-installed catalog state + fixture; 3 absent-target wire-coverage fixtures"
affects: [04-concern-module-extraction, catalog-uat, notify-grammar-invariant]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "summaryPhrase(count, severity, subject|null) helper composes the D-02 sentence; subject=null drops the noun for D-03 mixed cascades"
    - "Absent-target severity is a producer-stamped fact (reasons.includes('not installed') ? 'error' : skipSeverity) -- skipSeverity stays info-vs-warning only; reasons set stays closed"
    - "uninstall PU-5: STANDALONE error row, ORCHESTRATED converge stays silent (apply.ts untouched, WR-06/NFR-2)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-producer-wire-coverage.test.ts

key-decisions:
  - "D-02 grammar via a single summaryPhrase helper replacing operationPhrase; the cascade tail of buildSummaryLine and buildSummaryLineForCascade stay byte-parallel"
  - "uninstall PU-5 row is a (failed) {not installed} row, NOT (skipped): uninstall's render map renders uninstalled/failed only (no skipped arm). reinstall/update keep the (skipped) {not installed} token (severity-only flip)"
  - "enable/disable not-installed stays warning -- not in the D-01 absent-target enumeration (uninstall/reinstall/update only), per RESEARCH A3"

patterns-established:
  - "Leading severity sentence is a structural render of rows + max severity, composed once at the buildSummaryLine prefix (single emitWithSummary seam, IL-2)"
  - "Atomic catalog supersession: notify.ts grammar + every summary-bearing catalog block + all byte-assertion fixtures land in one commit; catalog-uat green at every boundary"

requirements-completed: [OUT-01, OUT-02, OUT-05, OUT-08, GATE-02]

# Metrics
duration: ~50min
completed: 2026-06-24
---

# Phase 3 Plan 01: Desired-state leading sentence + absent-target error severity Summary

**D-02 leading severity sentence (`A plugin operation has failed.` / `Some operations have failed.`) with D-03 render-time mixed-subject detection, plus the D-01 absent-target error flips (reinstall/update not-installed -> error; standalone uninstall already-gone -> error row) -- all with atomic catalog + fixture supersession kept green at every commit.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-06-24
- **Completed:** 2026-06-24
- **Tasks:** 2
- **Files modified:** 32 (7 in the plan's file list; 25 lockstep byte-assertion/test updates the grammar+severity change reddened)

## Accomplishments

- Replaced the OLD `N plugin operation(s) failed/skipped.` grammar with the OUT-02/D-02 leading sentence in both `buildSummaryLine` and `buildSummaryLineForCascade`, preserving the single `emitWithSummary` -> `ctx.ui.notify` seam (count unchanged at 17).
- Implemented D-03 mixed-subject detection at render time: a cascade spanning plugin AND marketplace rows drops the subject noun (`Some operations have failed.`), counting all rows uniformly off the combined total.
- Flipped the D-01 absent-target arms to producer-stamped `error`: `reinstall`/`update` not-installed (severity-only, `(skipped) {not installed}` preserved) and the STANDALONE `uninstall` already-gone path (new `(failed) {not installed}` error row, was literal silence). The ORCHESTRATED reconcile converge stays silent -- `apply.ts` untouched.
- Rewrote ~51 summary-bearing catalog fenced blocks + the Summary-line prose in lockstep, added the new `already-gone-not-installed` catalog state + fixture, and added 3 absent-target wire-coverage fixtures. `catalog-uat` and `npm run check` green at every commit boundary.

## Task Commits

1. **Task 1: D-02 leading-sentence grammar + D-03 mixed-subject detection + all summary-bearing catalog blocks/fixtures** - `1b5e741f` (feat)
2. **Task 2: D-01 absent-target producer flips + PU-5 standalone error row + catalog states + wire-coverage fixtures** - `e55b69e5` (feat)

_Note: both tasks carried `tdd="true"`; executed as a single cohesive commit each because the catalog byte-gate admits no partial-green intermediate (RESEARCH Pitfall 3 -- the grammar change reddens ~40-50 fixtures simultaneously)._

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - New `summaryPhrase(count, severity, subject|null)` helper; D-02 rewrite of `buildSummaryLine` (standalone arms + cascade tail) and `buildSummaryLineForCascade`; D-03 mixed-subject branch; `operationPhrase` removed.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - not-installed skip arm stamps `error` (was `skipSeverity` -> warning).
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - not-installed/not-found skip arm stamps `error`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - standalone already-gone path emits a `(failed) {not installed}` error row via `notifyWithContext`; orchestrated converge unchanged.
- `docs/output-catalog.md` - all summary-bearing fenced blocks + Summary-line prose rewritten to D-02; new `already-gone-not-installed` uninstall state.
- `tests/architecture/catalog-uat.test.ts` - new `already-gone-not-installed` fixture (status `failed`, severity `error`).
- `tests/architecture/notify-producer-wire-coverage.test.ts` - 3 absent-target WireFixtures (error/no-trailer).
- `tests/architecture/notify-grammar-invariant.test.ts` - `SUMMARY_GRAMMAR` regex updated to the D-02 grammar.
- `tests/shared/notify-v2.test.ts`, `tests/shared/notify-inert-fields.test.ts`, `tests/shared/snm38-indent-ladder.test.ts`, and ~18 orchestrator/edge handler tests - byte-assertion updates to the D-02 grammar + the D-01 severity flips.

## Decisions Made

- **uninstall PU-5 row is `(failed)`, not `(skipped)`.** The plan's option A (severity-only on a `skipped` row) is not viable for `uninstall` because its render map (`UNINSTALL_STATUSES = ["uninstalled", "failed"]`) has no `skipped` arm -- the wire test surfaced `no render arm for status "skipped"`. The plan explicitly permitted a `failed` row as the alternative; `not installed` is already `UNINSTALL_CONTEXT`'s private reason. reinstall/update keep `(skipped) {not installed}` (their render maps support `skipped`).
- **enable/disable not-installed stays `warning`** (the `enable-not-installed` catalog state) -- it is not in the D-01 absent-target enumeration (uninstall/reinstall/update), per RESEARCH assumption A3 / Open Question #4 default.
- **Mixed-subject sentence is `Some operations ...`** for all four mixed catalog blocks (invalid-config-row-with-cause, partial-marketplace-remove, marketplace-remove partial, update-path-invalid-manifest) -- each has >= 2 error rows total, so article=`Some`, verb=`have failed`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lockstep update of ~25 byte-assertion test files outside the plan's file list**
- **Found during:** Task 1
- **Issue:** The plan's `files_modified` lists only the 3 core files for the grammar change, but the D-02 rewrite directly reddened byte-exact summary-line assertions across `tests/shared/notify-v2.test.ts`, `tests/shared/notify-inert-fields.test.ts`, `tests/shared/snm38-indent-ladder.test.ts`, `tests/architecture/notify-grammar-invariant.test.ts` (the `SUMMARY_GRAMMAR` regex), and ~18 orchestrator/edge handler tests. GATE-03 requires `npm run check` green at every boundary.
- **Fix:** Mechanically rewrote every OLD-grammar assertion to the D-02 grammar (homogeneous error/warning + mixed-subject drop-noun forms) in the same commit as the notify.ts change.
- **Files modified:** the ~25 test files listed above.
- **Verification:** `npm run check` exits 0.
- **Committed in:** `1b5e741f` (Task 1 commit)

**2. [Rule 1 - Bug] uninstall PU-5 row status changed from `skipped` to `failed`**
- **Found during:** Task 2
- **Issue:** The first PU-5 implementation used a `PluginSkippedMessage` (option A), but `notifyWithContext(UNINSTALL_CONTEXT, ...)` threw `no render arm for status "skipped"` -- uninstall's render map renders `uninstalled`/`failed` only.
- **Fix:** Switched the PU-5 row to a `PluginFailedMessage` (`(failed) {not installed}`, severity error), updated the catalog block + catalog-uat fixture + wire fixture to match. reinstall/update keep `(skipped)` (their maps support it).
- **Files modified:** uninstall.ts, docs/output-catalog.md, catalog-uat.test.ts, notify-producer-wire-coverage.test.ts.
- **Verification:** wire-coverage + catalog-uat green.
- **Committed in:** `e55b69e5` (Task 2 commit)

**3. [Rule 3 - Blocking] Lockstep update of 4 orchestrator unit tests asserting OLD D-01 behavior**
- **Found during:** Task 2
- **Issue:** The D-01 producer flips reddened `tests/orchestrators/plugin/uninstall.test.ts` (PU-5 silence test) and 3 `tests/orchestrators/plugin/update.test.ts` tests asserting warning/no-error for not-installed.
- **Fix:** Updated those tests to assert the new error-row behavior (severity `error`, the D-02 summary, the preserved row token) in the same commit as the producer flips.
- **Files modified:** uninstall.test.ts, update.test.ts.
- **Verification:** `npm run check` exits 0.
- **Committed in:** `e55b69e5` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking lockstep test updates, 1 bug fix for the render-map mismatch).
**Impact on plan:** All necessary to keep GATE-02/GATE-03 green and to satisfy the actual render-map contract. No scope creep -- `apply.ts` (reconcile converge) and `notify-reasons.ts` (closed reason set) were NOT modified, as required.

## Issues Encountered

- **mdformat reformatted `docs/output-catalog.md`** during pre-commit (Task 1). Re-ran catalog-uat after the reformat (still green), re-staged, re-ran pre-commit clean.
- **Two flaky filesystem-race tests** (`hooks-async-rewake` `_shared` rmdir ENOTEMPTY / `D-60-06 registerHooksBridge`, and the `info` `INFO-03` fan-out ordering) failed transiently under parallel full-suite load. Both pass in isolation and on re-run; unrelated to the notify grammar/severity change (out of scope per the SCOPE BOUNDARY rule).

## Threat Surface

- **T-03-01 (Information Disclosure)** addressed by construction: the new PU-5 / absent-target error rows are reason-only (`not installed`) and carry NO `cause`, so no `redactAbsolutePaths` routing was needed and no raw absolute path is introduced (ASVS V7).
- No new network endpoints, auth paths, or schema changes introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The desired-state leading sentence and absent-target error severity are live and byte-fixed in the catalog. Phase 4 (concern-module extraction, MOD-04/05/06, GATE-03) can proceed against this stable rendered-output baseline.
- Note for Phase 4: the trailing tally (OUT-03/04/D-04) and `Messaging.label` threading were NOT part of this plan's two tasks (the plan scoped only the leading sentence + absent-target flips). If the workstream still requires the tally, it remains to be planned.

## Self-Check: PASSED

- SUMMARY file exists at the plan directory.
- Both task commits (`1b5e741f`, `e55b69e5`) present in git history.
- All modified key-files exist on disk.

---
*Phase: 03-desired-state-output-atomic-catalog-supersession*
*Completed: 2026-06-24*
