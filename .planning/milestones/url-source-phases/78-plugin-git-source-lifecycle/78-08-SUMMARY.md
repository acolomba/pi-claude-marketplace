---
phase: 78-plugin-git-source-lifecycle
plan: 08
subsystem: ui
tags: [notify, reasons, reconcile, dangling-reference, closed-set-catalog]

# Dependency graph
requires:
  - phase: 78-plugin-git-source-lifecycle
    provides: "reconcile dangling-reference source-mismatch cause + per-cause PlannedSourceMismatch variants"
provides:
  - "dangling reference REASONS catalog member (PURL-06)"
  - "reconcile dangling-reference diagnostic renders {dangling reference} instead of {source mismatch} on the mp row and plugin child"
affects: [reconcile, notify, output-catalog, marketplace-remove, plugin-uninstall]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reason token divergence by planner cause: a single reconcile bucket derives distinct closed-set reason members from its discriminant instead of a shared literal"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/architecture/notify-closed-set-locks.test.ts

key-decisions:
  - "dangling reference is a new closed-set FAILURE_REASONS member, not a reuse of source mismatch — the diagnostic must name the real problem (an undeclared marketplace)"
  - "The header reason is derived from the cause at both render sites (dangling-reference -> dangling reference; other three causes -> source mismatch) rather than unconditionally assigning source mismatch before the branch"

patterns-established:
  - "Per-cause reason derivation in the reconcile source-mismatch bucket: the dangling-reference cause diverges from the shared token while source-mismatch / unknown-stored / malformed-plugin-key keep source mismatch"

requirements-completed: [PURL-06]

coverage:
  - id: D1
    description: "dangling reference is a closed-set REASONS member with the completeness partition proof intact (no TS2344)"
    requirement: PURL-06
    verification:
      - kind: unit
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 34-entry reason set"
        status: pass
      - kind: unit
        ref: "npm run typecheck (_ReasonsCoverageProof resolves to never)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Both dangling-reference render sites (pending projection + apply-outcome fold) emit {dangling reference} on the mp row and the plugin child; the other three source-mismatch causes still emit {source mismatch}"
    requirement: PURL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#pending projection: dangling-reference projects {dangling reference}; the other three causes project {source mismatch}"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#applied-cascade projection: dangling-reference projects {dangling reference}; the other three causes project {source mismatch}"
        status: pass
      - kind: integration
        ref: "tests/orchestrators/reconcile/apply.test.ts#T4 / PR #51 / PURL-06: ... dangling-reference variant attributes a (failed) {dangling reference} plugin child row"
        status: pass
    human_judgment: false
  - id: D3
    description: "The UAT two-row shape (orphaned pr-review-toolkit@claude-plugins-official) projects (failed) {dangling reference} on both the mp row and the plugin child"
    requirement: PURL-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/notify.test.ts#PURL-06 UAT shape: an orphaned pr-review-toolkit@claude-plugins-official reference projects a (failed) {dangling reference} mp row PLUS a (failed) {dangling reference} plugin child"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-07-12
status: complete
---

# Phase 78 Plan 08: Dangling Reference Reason Token Summary

**The reconcile dangling-reference diagnostic now renders `{dangling reference}` instead of the reused `{source mismatch}` token, naming the real problem — an orphaned plugin declaration whose marketplace is undeclared — on both the marketplace row and the plugin child.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-12T14:20:00Z
- **Completed:** 2026-07-12T14:42:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added the `dangling reference` member to the closed `REASONS` tuple (notify.ts) and the `FAILURE_REASONS` partition (notify-reasons.ts), keeping the `_ReasonsCoverageProof` completeness partition total (no TS2344).
- Switched both reconcile render sites — the pending/plan projection (`applySourceMismatch`) and the apply-outcome fold (`source-mismatch` case) — to derive the reason from the cause, emitting `["dangling reference"]` on the mp row AND the plugin child for the dangling-reference cause while the other three causes keep `["source mismatch"]`.
- Updated the reconcile notify tests to assert the divergence, reproduced the UAT two-row shape, and updated the end-to-end apply test plus the REASONS length tripwire.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the `dangling reference` token to the closed-set catalog** - `8218cffa` (feat)
2. **Task 2: Render `dangling reference` at both reconcile render sites** - `1b3ff94e` (feat)
3. **Task 3: Update the reconcile notify tests to assert the token divergence** - `d8c2f174` (test)

_Note: TDD tasks may have multiple commits (test → feat → refactor); this plan was not TDD._

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` - Appended `dangling reference` to the `REASONS` tuple (PURL-06); bumped the catalog member-count prose 33 -> 34.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` - Added `dangling reference` to `FAILURE_REASONS`; updated the 33-entry prose to 34.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - Derived the source-mismatch header reason from the cause at both render sites; updated the token-mapping doc comments.
- `tests/orchestrators/reconcile/notify.test.ts` - Rewrote the two per-cause matrices to assert reasons per cause; updated the WR-03 dangling test; added the UAT-shape reproduction test.
- `tests/orchestrators/reconcile/apply.test.ts` - Updated the end-to-end T4 dangling-reference assertion to expect `{dangling reference}`.
- `tests/architecture/notify-closed-set-locks.test.ts` - Bumped the REASONS closed-set length tripwire from 33 to 34.

## Decisions Made

- **dangling reference is a distinct FAILURE_REASONS member, not a reuse of source mismatch.** The token catalog is closed-set; this is a deliberate amendment so a dangling reference names its real cause (an undeclared marketplace) rather than a source-comparison problem that does not exist.
- **Header reason derived from the cause.** Both render sites now branch on `cause === "dangling-reference"` to set the header reason, instead of unconditionally assigning `["source mismatch"]` before the branch. This keeps the three non-dangling causes byte-stable.

## Deviations from Plan

The plan's three tasks executed as written. Two adjacent tests outside the plan's `files_modified` list required updates because they directly asserted the pre-change byte form for the dangling-reference cause:

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated the end-to-end apply test's dangling-reference assertion**
- **Found during:** Task 3 (regression scan `grep -rn "source mismatch" tests/orchestrators/reconcile/`)
- **Issue:** `tests/orchestrators/reconcile/apply.test.ts` (T4) asserted an end-to-end dangling-reference render of `(failed) {source mismatch}` — now false after Task 2.
- **Fix:** Updated the title, comment, and assertion to expect `(failed) {dangling reference}`.
- **Files modified:** tests/orchestrators/reconcile/apply.test.ts
- **Verification:** `node --test tests/orchestrators/reconcile/apply.test.ts` passes.
- **Committed in:** d8c2f174 (Task 3 commit)

**2. [Rule 1 - Bug] Bumped the REASONS closed-set length tripwire**
- **Found during:** Task 3 (`npm run check` full run)
- **Issue:** `tests/architecture/notify-closed-set-locks.test.ts` asserts `REASONS.length === 33`; the new member makes it 34. This tripwire is designed to force a conscious bump in the same change that grows the set.
- **Fix:** Bumped the expected count to 34 with a PURL-06 comment.
- **Files modified:** tests/architecture/notify-closed-set-locks.test.ts
- **Verification:** `node --test tests/architecture/notify-closed-set-locks.test.ts` passes.
- **Committed in:** d8c2f174 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 bug — both mechanical test updates directly forced by the in-scope render change).
**Impact on plan:** Both updates were necessary consequences of the token change and stayed within the reconcile/notify surface. No scope creep; the docs-catalog enumeration was deliberately deferred (see below) to respect the plan's `files_modified` scope.

## Issues Encountered

None beyond the two adjacent-test updates documented above.

## Deferred Issues

- **docs reason enumeration:** `docs/output-catalog.md` and `docs/messaging-style-guide.md` list the reason catalog for humans and do not yet carry a `dangling reference` row. No test gates these docs and they are outside plan 78-08's `files_modified` scope, so the addition was deferred (recorded in `78/deferred-items.md`) for a follow-up docs pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PURL-06 (dangling-reference diagnostic accuracy) is complete. Combined with 78-07 (cross-config-layer removal cascade), the reload-remove `source mismatch` UAT blocker is fully addressed: 78-07 removes future orphans at the source, and this plan names any remaining hand-edited dangling reference truthfully.
- `npm run check` is green (2730 tests, 1 skipped).

## Self-Check: PASSED

- Files verified: 78-08-SUMMARY.md, notify.ts, notify-reasons.ts, reconcile/notify.ts, test files — all present.
- Commits verified: 8218cffa, 1b3ff94e, d8c2f174 — all in git log.
- `npm run check` green (2730 tests, 1 skipped, 0 failed).

---
*Phase: 78-plugin-git-source-lifecycle*
*Completed: 2026-07-12*
