---
phase: 04-marketplace-remove-and-list
plan: "04"
subsystem: testing
tags: [marketplace-remove, integration-tests, json-notifications, persistence]

requires: []
provides:
  - Mixed marketplace-removal coverage for continued progress, persisted survivors, ordered JSON rows, and reload signaling
  - Failure-only marketplace-removal coverage for complete footprint preservation and no-reload signaling
affects: [marketplace-remove, RM-02, phase-04-verification]

actuals:
  tokens: 2764
  tasks: 2
  commits: 2
plan_head_before: 6c1e6d120d388d69181361224bd9ee2d2b3fef53
plan_head_after: 2231163ed3a2100be159275fbf469a91924fd9f1

tech-stack:
  added: []
  patterns:
    - Real lifecycle setup with an injected cascade failure seam and schema-validating JSON capture
    - Whole-value assertions across notification output, persisted state, config bytes, clone content, and staged skills

key-files:
  created: []
  modified:
    - tests/integration/marketplace-layer-remove.test.ts

key-decisions:
  - "Used the existing cascade injection seam only; production code, capture helpers, and wire schemas remain unchanged."
  - "Scoped assertions to immediate post-remove persistence because unchanged desired declarations may reconcile successful removals after a later reload."

patterns-established:
  - "Partial removal integration tests pair exact wire payloads with complete persisted and staged observations."
  - "Nonalphabetical plugin fixtures distinguish execution order from grouped output order."

requirements-completed: [RM-02]

coverage:
  - id: D1
    description: "A mixed cascade persists successful removals, retains failed plugins, and emits success rows before failure rows with reload required."
    requirement: RM-02
    verification:
      - kind: integration
        ref: "tests/integration/marketplace-layer-remove.test.ts#a partial remove persists successes and reports every failure in order"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failure-only cascade preserves the complete footprint and emits every failed child without requiring reload."
    requirement: RM-02
    verification:
      - kind: integration
        ref: "tests/integration/marketplace-layer-remove.test.ts#a failure-only remove keeps every plugin and needs no reload"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-10-18
status: complete
---

# Phase 04 Plan 04: Partial Marketplace Removal Coverage Summary

**Real lifecycle integration coverage now pins mixed and failure-only marketplace removal across persistence and exact schema-valid JSON output.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-18T14:02:55Z
- **Completed:** 2026-10-18T14:19:25Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `a partial remove persists successes and reports every failure in order`, proving that interleaved execution persists zebra and amber removals while retaining complete yak and birch records and artifacts.
- Added `a failure-only remove keeps every plugin and needs no reload`, proving complete state, config, clone, marketplace-data, and staged-skill preservation when every cascade fails.
- Compared each result as one complete schema-valid JSON entry, including exact row order, IDs, scopes, reasons, serialized causes, empty leak/rollback fields, and true-versus-false reload behavior.

## Task Commits

Each task was committed atomically:

1. **Task 1: Prove mixed cascade state and the exact grouped JSON result** - `dcc177bc` (test)
2. **Task 2: Prove failure-only preservation and no reload** - `2231163e` (test)

## Files Created/Modified

- `tests/integration/marketplace-layer-remove.test.ts` - Adds the mixed and failure-only lifecycle, persistence, artifact, and JSON notification cases.

## Verification

- Node `v26.11.1`.
- `node --test tests/integration/marketplace-layer-remove.test.ts` exited 0 after Task 1 and again after Task 2; each run reported one passing test module, zero failures, zero skips, and zero todos.
- The final focused run includes both added titles: `a partial remove persists successes and reports every failure in order` and `a failure-only remove keeps every plugin and needs no reload`.
- Both cases use a hermetic project scope and the real add/install lifecycle before invoking production `removeMarketplace` through the existing cascade seam.
- The mixed case verifies immediate partial persistence only. It does not claim clean cross-session persistence: retained desired declarations may reinstall successful removals on a later `/reload`.
- Both task commits passed the repository commit hooks, including the incremental npm check.

## Decisions Made

- Used the existing cascade injection seam so deterministic EACCES failures exercise real persistence and notification composition without a production failpoint.
- Kept the partial-state assertion session-local because the unchanged desired config intentionally permits later reconciliation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first Task 1 commit-hook run found one required blank line. The style-only fix was applied, staged checks were rerun, and the corrected commit passed all hooks.
- The plan-subject evaluation resolver reported no matching commits because this project's required commit style omits GSD identifiers. The persisted plan ledger and both reachable task hashes provide the commit evidence instead.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The partial and failure-only halves of RM-02 are covered for the phase verification wave.
- No blockers or follow-up production changes were found.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `tests/integration/marketplace-layer-remove.test.ts` exists.
- Task commits `dcc177bc` and `2231163e` are ancestors of the plan head.
- `.planning/STATE.md` and `.planning/ROADMAP.md` remain unchanged.

---
*Phase: 04-marketplace-remove-and-list*
*Completed: 2026-10-18*
