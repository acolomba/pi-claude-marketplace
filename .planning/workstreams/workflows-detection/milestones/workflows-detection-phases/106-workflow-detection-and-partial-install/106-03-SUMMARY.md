---
phase: 106-workflow-detection-and-partial-install
plan: 03
subsystem: testing
tags: [node-test, workflows, partial-install, rollback, discovery]

requires:
  - phase: 106-01
    provides: Workflow detection, compatibility metadata, fixtures, and partial-install classification
provides:
  - Install rejection, rollback, retry, and persistence boundary coverage for workflows
  - Exact two-key reload discovery coverage with workflow decoys in both scopes
affects: [106-04, partial-install, installation-ledger, resource-discovery]

actuals:
  tokens: 1763
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Source sentinel assertions across failed and retried partial installs
    - Exact object key locks for closed discovery results

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/discover.test.ts

key-decisions:
  - "Keep workflows as source-only compatibility metadata through install rollback and retry."
  - "Keep reload discovery closed to skillPaths and promptPaths."

patterns-established:
  - "Retry boundary: remove only the fixture blocker, then repeat the same partial install."
  - "Discovery boundary: seed decoys in both scopes and lock the exact result keys."

requirements-completed: [WDET-05, WDET-06]

coverage:
  - id: D1
    description: Normal install rejects workflows, while partial install stages only supported components.
    requirement: WDET-05
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 conventional workflows directory boundary"
        status: pass
    human_judgment: false
  - id: D2
    description: A commands-phase interruption rolls back supported artifacts and permits a clean retry.
    requirement: WDET-06
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 interrupted partial-install retry"
        status: pass
      - kind: unit
        ref: "tests/architecture/compat-01-no-expansion.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: Workflow files stay outside materialized resources and reload discovery results.
    requirement: WDET-06
    verification:
      - kind: integration
        ref: "tests/orchestrators/plugin/install.test.ts#WDET-02 workflow sentinel containment"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/discover.test.ts#resources_discover deterministic paths"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-29
status: complete
---

# Phase 106 Plan 03: Materialization and Discovery Boundaries Summary

**Workflow sentinels stay source-only across rejection, rollback, retry, persistence, and reload discovery.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-29T19:49:33Z
- **Completed:** 2026-08-29T20:00:52Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Proved that normal installation rejects a workflow plugin with the existing partial hint and no mutation.
- Proved that a commands-phase failure rolls back the skill, writes no record, and supports a clean retry.
- Locked reload discovery to `skillPaths` and `promptPaths` when both scopes contain workflow decoys.

## Task Commits

Each task was committed atomically:

1. **Task 1: Protect workflow partial-install boundary** - `5163647e` (test)
2. **Task 2: Preserve workflow discovery boundary** - `85550cdd` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/install.test.ts` - Covers rejection, rollback, retry, record shape, and sentinel containment.
- `tests/orchestrators/discover.test.ts` - Pins the two-array discovery result with workflow decoys in both scopes.

## Decisions Made

- Kept the six-slot install ledger unchanged. The tests use its existing skills-to-commands rollback path.
- Placed discovery decoys beside the supported resource directories. No production discovery field was added.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The sandboxed unit run blocked three unrelated local git and network fixtures.
- The same complete unit suite passed with fixture access.

## Validation Results

- Focused install and compatibility suites: pass.
- Focused discovery suite: pass.
- Complete unit suite: 3,642 pass, 0 fail, 1 intentional platform skip.
- Integration suite: 10 pass, 0 fail.
- Production extension diff: empty.
- Per-task secret scans: 0 verified and 0 unverified secrets.
- Per-task pre-commit hooks: pass with TruffleHog skipped after each filesystem scan.
- Stub scan: no new stub, placeholder, skipped test, or unrun verification.
- Threat scan: no production file, endpoint, schema, bridge, resource field, or executor changed.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 106-04 can use the committed boundary tests for final parity and catalog verification.
- No blocker remains from this plan.

## Self-Check: PASSED

- The summary and both modified test files exist.
- Both task commits exist in git history.
- Every acceptance and plan-level verification completed successfully.

---

*Phase: 106-workflow-detection-and-partial-install*
*Completed: 2026-08-29*
