---
phase: 28-severity-routing-label-discipline
plan: 01
subsystem: notifications
tags: [notify, severity, computeSeverity, BENIGN_REASONS, UXG-02, structured-notification]

# Dependency graph
requires:
  - phase: 27-marketplace-autoupdate-output-grammar
    provides: "UXG-04 <autoupdate>/<no autoupdate> marker grammar + already autoupdate/already no autoupdate REASONS; UXG-05 marketplace update no-op (skipped) {up-to-date}; the Plan 27-04 deferral of mp-level skipped severity to Phase 28"
provides:
  - "BENIGN_REASONS closed set (up-to-date, already installed, already autoupdate, already no autoupdate) + allBenign() predicate in shared/notify.ts"
  - "computeSeverity rewritten as the D-28-06 5-arm first-match ladder: benign-only skip cascade -> info; actionable/mixed/manual-recovery -> warning; failed -> error"
  - "Both severity gates (notify-v2 + catalog-uat) and 5 downstream orchestrator test files moved in lockstep to the benign-softening ladder"
  - "ADR v2-001 + messaging-style-guide + output-catalog severity prose synced to the benign-softening ladder; the UXG-05 Phase-28 deferral sentences removed (realized)"
affects: [28-02, severity routing, notify, label-discipline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Benign-skip closed-set predicate: allBenign(reasons) returns false on empty/undefined so an unprovable skip routes to warning (D-28-08 safe default), shared across the plugin-skip and mp-skip ladder arms"
    - "Severity is a pure 2nd-arg concern: a severity-routing change touches assertions only, never a rendered byte string (catalog-uat byte gate stays GREEN; per-variant severity assertions move)"

key-files:
  created:
    - .planning/phases/28-severity-routing-label-discipline/28-01-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - tests/shared/notify-v2.test.ts
    - tests/architecture/catalog-uat.test.ts
    - docs/adr/v2-001-structured-notify.md
    - docs/messaging-style-guide.md
    - docs/output-catalog.md
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts

key-decisions:
  - "BENIGN_REASONS modeled as a ReadonlySet<Reason> with a shared allBenign() predicate (empty/undefined -> false), per Claude's Discretion in the plan"
  - "Downstream orchestrator severity assertions moved in lockstep (Rule 1) -- the plan's two named gates were not the only consumers of computeSeverity"

patterns-established:
  - "Benign idempotent no-op skips (resource already in requested state) route to info, not warning -- severity reflects whether the operator must act"

requirements-completed: [UXG-02]

# Metrics
duration: 23min
completed: 2026-05-31
---

# Phase 28 Plan 01: Severity Routing Benign-Softening Summary

**`computeSeverity` rewritten as a 5-arm first-match ladder with a `BENIGN_REASONS` closed set, so a cascade whose only non-success rows are benign idempotent no-op skips (`{up-to-date}` / `{already …}`) computes `info` instead of `warning` -- a pure severity-arg change, every rendered byte string unchanged.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-05-31T11:54:16Z
- **Completed:** 2026-05-31T12:16:54Z
- **Tasks:** 3 (plus 1 Rule-1 lockstep deviation commit)
- **Files modified:** 11

## Accomplishments

- Added `BENIGN_REASONS` (the four D-28-02 idempotent "already in requested state" reasons) and a shared `allBenign()` predicate to `shared/notify.ts`.
- Rewrote `computeSeverity` as the D-28-06 5-arm first-match ladder: (1) failed -> error; (2) manual recovery -> warning; (3) plugin skip with non-benign reasons -> warning; (4) mp skip with non-benign/missing reasons -> warning (D-28-08 safe default); (5) otherwise info. First-match poisoning is preserved (D-28-09).
- Moved both named severity gates in lockstep: `notify-v2` benign-skip variants now assert info (1-arg notify) plus new actionable/mixed/missing-reasons warning coverage; `catalog-uat` dropped `expectedSeverity` from the 5 benign-skip fixtures (warning count 6->1, error 15 unchanged).
- Synced the severity-ladder prose in the ADR, messaging style guide, and output catalog; removed the two UXG-05 "info-softening is Phase 28, NOT pre-empted" deferral sentences (now realized), closing the Plan 27-04 hand-off.
- Kept the catalog-uat byte-equality gate GREEN throughout (no rendered byte string changed); `npm run check` GREEN end-to-end (1152/1152).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add BENIGN_REASONS + rewrite computeSeverity ladder** - `ac30c99` (feat) [TDD: RED scaffolding proved the ladder, GREEN implementation committed]
2. **Task 2: Move both test gates in lockstep (notify-v2 + catalog-uat)** - `13d5a05` (test)
3. **Task 3: Sync severity-ladder prose (ADR, style guide, catalog)** - `5abbe9a` (docs)
4. **Deviation (Rule 1): move downstream orchestrator severity gates in lockstep** - `b10fb44` (test)

_TDD note: Task 1 used a temporary TDD-RED scaffolding block in `notify-v2.test.ts` (2 of 6 sub-tests RED against the old 3-arm ladder, all 6 GREEN after the rewrite). The scaffolding was superseded by Task 2's durable lockstep coverage and removed before Task 2's commit._

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - Added `BENIGN_REASONS` set + `allBenign()` predicate; rewrote `computeSeverity` as the D-28-06 5-arm ladder + doc-comment. No renderer arm, byte literal, `REASONS` membership, or `shouldEmitReloadHint` change.
- `tests/shared/notify-v2.test.ts` - Benign-skip variants flipped to info; severity tier warning test switched to an actionable reason; added 3 new warning tests (actionable / mixed / missing-reasons mp-skip).
- `tests/architecture/catalog-uat.test.ts` - Removed `expectedSeverity` from the 5 benign-skip fixtures; fixture doc-comment synced to the BENIGN_REASONS rule. Body strings byte-identical.
- `docs/adr/v2-001-structured-notify.md` - Lines 68 + 205 amended to the benign-softening refinement (UXG-02 / D-28-06/08/09).
- `docs/messaging-style-guide.md` - §"Severity Routing" rewritten to the 5-arm ladder; `{up-to-date}` worked example now info.
- `docs/output-catalog.md` - Severity table + skipped-only cascade + UXG-05 no-op blocks (deferral sentences removed) + idempotent-autoupdate blocks + ladder summary all flip the benign-skip arm to info.
- `tests/orchestrators/marketplace/autoupdate.test.ts` - 4 idempotent autoupdate flips (`already autoupdate` / `already no autoupdate`) flipped warning -> info.
- `tests/orchestrators/marketplace/update.test.ts` - 3 UXG-05 `(skipped) {up-to-date}` no-ops flipped warning -> info.
- `tests/orchestrators/plugin/update.test.ts` - PUP-3 up-to-date skip + PUP-1 updated+benign-skip cascade flipped warning -> info.
- `tests/orchestrators/import/execute.test.ts` - already-installed skip cascade flipped warning -> info.
- `tests/orchestrators/plugin/bootstrap.test.ts` - idempotent autoupdate report flipped warning -> info.

## Decisions Made

- **`BENIGN_REASONS` shape:** modeled as `ReadonlySet<Reason>` with a single `allBenign(reasons)` predicate shared by the plugin-skip and mp-skip arms (the natural shape the plan flagged as Claude's Discretion). `allBenign` returns `false` on an empty or `undefined` reason set so an mp-level skip with missing/empty `reasons?` cannot be proven benign and routes to warning (D-28-08).
- **Lockstep scope:** the plan named only `notify-v2.test.ts` + `catalog-uat.test.ts` as the test gates, but `computeSeverity` is consumed end-to-end by every orchestrator that emits benign skips. The 11 downstream assertions had to move with the ladder to keep `npm run check` GREEN (see Deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Downstream orchestrator severity assertions broke against the new ladder**
- **Found during:** Plan-end `npm run check` GREEN gate (after Task 3)
- **Issue:** The Task 1 `computeSeverity` rewrite correctly flipped benign skips from `warning` to `info`, which broke 11 downstream orchestrator tests that asserted the pre-Phase-28 `warning` severity for benign idempotent skips (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`). The plan enumerated only the two named gates (`notify-v2` + `catalog-uat`); these orchestrator tests are additional consumers of the same `notify()` -> `computeSeverity` path. Every broken assertion was a stale severity expectation; all byte-form message assertions still passed (confirming the pure-severity-arg invariant).
- **Fix:** Flipped the 11 stale `severity === "warning"` assertions to `severity === undefined` (info) across 5 files, updated the explanatory comments to cite UXG-02 / D-28-06/07, and updated 2 test titles that embedded "(warning)".
- **Files modified:** tests/orchestrators/marketplace/autoupdate.test.ts, tests/orchestrators/marketplace/update.test.ts, tests/orchestrators/plugin/update.test.ts, tests/orchestrators/import/execute.test.ts, tests/orchestrators/plugin/bootstrap.test.ts
- **Verification:** Each file re-run GREEN individually; full `npm run check` GREEN 1152/1152.
- **Committed in:** `b10fb44` (separate lockstep deviation commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - lockstep test correction)
**Impact on plan:** Necessary to satisfy the plan's own GREEN bar (`npm run check` exits 0). No scope creep -- only stale severity assertions directly caused by the in-scope `computeSeverity` change were touched; no byte form or production logic beyond the planned change was modified.

## Issues Encountered

- The `fix-unicode-dashes` + `mdformat` pre-commit hooks rewrote em-dashes to `--` and reflowed the three edited markdown docs on the first pass (expected per the project commit-discipline note for `docs/`). Re-staging after the first pass and re-running the hooks produced a clean second pass; the catalog-uat byte-equality gate confirmed no fenced output block was altered by the normalization.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UXG-02 is closed: the benign-softening severity ladder is implemented, gated (both severity gates + downstream orchestrators), and documented.
- Plan 28-02 (UXG-03 label-discipline feasibility spike) is unblocked. It is independent of this plan's `computeSeverity` change (the spike concerns the host `Error:`/`Warning:` label vs color, not the severity routing); D-28-11 already records that forcing cascades to `info` to drop the label is self-defeating, so this plan's softening does not pre-empt the UXG-03 outcome.

---
*Phase: 28-severity-routing-label-discipline*
*Completed: 2026-05-31*

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/notify.ts` - FOUND
- `.planning/phases/28-severity-routing-label-discipline/28-01-SUMMARY.md` - FOUND
- Commit `ac30c99` (Task 1) - FOUND
- Commit `13d5a05` (Task 2) - FOUND
- Commit `5abbe9a` (Task 3) - FOUND
- Commit `b10fb44` (Rule 1 lockstep) - FOUND
