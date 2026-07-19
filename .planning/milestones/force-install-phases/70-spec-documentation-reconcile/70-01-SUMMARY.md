---
phase: 70-spec-documentation-reconcile
plan: 01
subsystem: api
tags: [notify, severity, output-catalog, install-failure, SEV-02, D-70-02]

# Dependency graph
requires:
  - phase: 69-force-path-severity
    provides: "SEV-02 forceable/unavailable arm split; the unsupported arm already stamped forceHint+error, leaving the unavailable-arm severity deferred to Phase 70"
provides:
  - "composeUnavailableMessage stamps severity:error on the install-failure unavailable row for BOTH arms (structural + force-degradable)"
  - "structural unavailable install failures now render the leading summary line with NO --force hint"
  - "catalog-UAT failure-structural-unavailable fixture + output-catalog block + style-guide reconciled to the error stamp"
affects: [70-spec-documentation-reconcile, milestone-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Caller-stamped row.severity (SEV-02) is the install-failure-vs-list-surface discriminator for the shared PluginUnavailableMessage variant, NOT the status token"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/architecture/catalog-uat.test.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md

key-decisions:
  - "D-70-02: stamp the no-force install of a structural unavailable plugin at error severity with NO --force hint (force cannot degrade-install a structural defect)"
  - "Per-row surgical: list-surface unavailable rows stay info (omit severity); only the install-failure derivation in composeUnavailableMessage stamps error"

patterns-established:
  - "Split the conditional severity/forceHint spread: severity:error is unconditional on the install-failure unavailable row; forceHint:true stays gated on forceable===true"

requirements-completed: [DOC-02]

# Metrics
duration: 8min
completed: 2026-06-28
---

# Phase 70 Plan 01: Structural Unavailable Install-Failure Error Stamp Summary

**Structural no-`--force` install failures now stamp `severity:error` (leading summary line fires) with no `--force` hint, completing the SEV-02 residual deferred by Phase 69; catalog/style-guide reconciled and catalog-UAT GREEN.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-28T15:59:00Z
- **Completed:** 2026-06-28T16:07:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `composeUnavailableMessage` now stamps `severity: "error" as const` unconditionally on the install-failure `unavailable` row; `forceHint: true` remains gated on `entityErrorRow.forceable === true`. The structural arm gets the error stamp (so the leading `A plugin operation has failed.` summary fires) but NO `--force` hint.
- PI-4 install test and the SEV-02 `composeInstallFailureMessage` unit test flipped to assert `severity === "error"` and (for PI-4) the prepended summary line, in lockstep with the code.
- `failure-structural-unavailable` catalog-UAT fixture now carries a row-level `severity: "error"` and fixture-level `expectedSeverity: "error"`; output-catalog block prepends the summary line; style-guide documents the caller-stamped install-failure severity vs info list surface.
- List-surface unavailable rows untouched (stay info). No new closed-set token: counts stay 22/17/7.

## Task Commits

Each task was committed atomically:

1. **Task 1: Stamp error severity on the structural unavailable install-failure arm (TDD)** - `59f5fdb5` (fix; test+impl in one commit)
2. **Task 2: Reconcile catalog-UAT fixture + output-catalog + style-guide** - `eda67ab5` (docs)

_TDD note: RED was confirmed (PI-4 failed asserting `error` against `undefined`) before the install.ts change; test and implementation were committed together in `59f5fdb5`._

## Files Created/Modified
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - `composeUnavailableMessage` unconditional `severity:error` stamp + updated doc comment (cites D-70-02)
- `tests/orchestrators/plugin/install.test.ts` - PI-4 test + SEV-02 unit test flipped to error severity
- `tests/architecture/catalog-uat.test.ts` - `failure-structural-unavailable` fixture stamps error + expectedSeverity
- `docs/output-catalog.md` - structural-unavailable fenced block prepends summary line; prose rewritten to error stamp
- `docs/messaging-style-guide.md` - Severity Routing note on caller-stamped install-failure unavailable severity vs info list surface

## Decisions Made
- None beyond the locked D-70-02 / D-70-04 context decisions. Implementation followed the plan's prescribed split of the conditional spread.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the SEV-02 `composeInstallFailureMessage` unit test in lockstep**
- **Found during:** Task 1 (severity stamp change)
- **Issue:** Beyond the PI-4 test named in the plan, a second directly-coupled unit test (`SEV-02 / D-69-03: composeInstallFailureMessage points at --force iff the verdict is force-degradable`, install.test.ts ~2296) asserted the structural arm's `severity === undefined`. The code change made it fail.
- **Fix:** Flipped its assertion to `severity === "error"` and updated the adjacent comment to cite D-70-02 (no hint, error severity). This test is in Task 1's declared file (`install.test.ts`) and proves the same behavior, so it is in-scope lockstep, not scope creep.
- **Files modified:** tests/orchestrators/plugin/install.test.ts
- **Verification:** Full install.test.ts suite green (75/75); `npm run check` exits 0.
- **Committed in:** `59f5fdb5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug-lockstep test).
**Impact on plan:** Necessary to keep the test suite green for the same behavior change; no scope creep, no extra surface touched.

## Issues Encountered
- None. No flake encountered; `npm run check` passed on the default parallel run.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SEV-02 residual (D-70-02) is fully closed. DOC-02 byte forms reconciled; catalog-UAT GREEN; closed set unchanged (22/17/7).
- Remaining Phase 70 work (DOC-01 PRD §11 rewrite, DOC-03 stale-comment sweep, D-70-01 hint freeze) is handled by sibling plans 70-02 / 70-03.

## Self-Check: PASSED

All 5 modified files and the SUMMARY exist on disk; both task commits (`59f5fdb5`, `eda67ab5`) are present in git history.

---
*Phase: 70-spec-documentation-reconcile*
*Completed: 2026-06-28*
