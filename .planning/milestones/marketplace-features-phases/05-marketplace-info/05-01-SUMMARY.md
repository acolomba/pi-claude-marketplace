---
phase: 05-marketplace-info
plan: "01"
subsystem: marketplace
tags: [typescript, cucumber, notifications, marketplace-info]

requires: []
provides:
  - Project-first mixed-scope marketplace info notifications even when one manifest is invalid
  - Behavioral fixtures for same-name marketplaces published from separate local sources
affects: [marketplace-info, behavioral-tests]

actuals:
  tokens: 4080
  tasks: 2
  commits: 2
plan_head_before: 5fca92644db9dce62feabe53681022095322c611
plan_head_after: 3abf12c2de81c4bf25dd0329be808cc51fa21402

tech-stack:
  added: []
  patterns:
    - Ordered per-candidate outcomes for mixed-success fan-out
    - Cucumber setup through public marketplace commands and case-owned sources

key-files:
  created:
    - features/step_definitions/marketplace/info.steps.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - features/marketplace/info.feature
    - tests/orchestrators/marketplace/info.test.ts

key-decisions:
  - "Keep successful and failed scope results in one ordered NotificationMessage array; collapse only an all-success result into the existing singleton or cascade shape."
  - "Keep the world's name-keyed publication as the fixture invalidated by each scenario and publish the healthy peer at a separate location."

patterns-established:
  - "Mixed-scope ordering: preserve the project-first candidate order across success and failure notifications."
  - "Notification-order tests: record actual notify calls and assert the complete sequence before filesystem and mock verification."

requirements-completed: [INFO-04, INFO-08]

coverage:
  - id: D1
    description: "Implicit marketplace info preserves project-first scope order across mixed and all-failed manifest outcomes."
    requirement: INFO-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#implicit scope emits a failed project block before a healthy user block"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#implicit scope emits a healthy project block before a failed user block"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#implicit scope emits failed project and user blocks in scope order"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber -- features/marketplace/info.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "An invalid marketplace manifest retains the shipped plugin-info failure envelope and invalid-manifest row."
    requirement: INFO-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts#schema-invalid manifest JSON renders the catalog invalid-manifest envelope"
        status: pass
      - kind: e2e
        ref: "features/marketplace/info.feature#Info on a marketplace whose manifest became invalid reports a failed invalid manifest row"
        status: pass
    human_judgment: false

duration: 17 min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 01: Mixed-Scope Marketplace Info Summary

**Marketplace info now reports project and user results in canonical scope order even when either manifest fails, with full unit and headless-Pi behavioral coverage.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-18T16:08:51Z
- **Completed:** 2026-10-18T16:26:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced success/failure partitioning with ordered per-candidate outcomes so a failed project manifest is reported before a healthy user marketplace.
- Added separate-source Cucumber coverage for both mixed-scope directions while preserving the existing invalid-manifest plugin-info failure row.
- Added explicit owner-test notification logs for both mixed directions and the both-failed case, while retaining singleton and all-success coverage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reproduce and fix mixed-scope notification ordering** - `f5eee02b` (fix)
2. **Task 2: Cover reverse mixed-scope and both-failed ordering** - `3abf12c2` (test)

**Plan metadata:** this commit (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` - Preserves candidate order across successful and failed scope outcomes.
- `features/marketplace/info.feature` - Covers both mixed-scope manifest-health directions and keeps the single-invalid contract.
- `features/step_definitions/marketplace/info.steps.ts` - Publishes a second same-name local source and adds each source through the public command surface.
- `tests/orchestrators/marketplace/info.test.ts` - Records and asserts complete multi-notification sequences for mixed and failed outcomes.

## Decisions Made

- Used one ordered notification-message array rather than separate success and failure collections, because the collection order is already the canonical project-first order.
- Aggregated only all-success outcomes into the established singleton or cascade payload; any failure keeps one notification per candidate.
- Kept the first publication in the world's name-keyed map so the existing invalidation step targets the intended scope without replacing fixtures.

## Verification

- `node --test tests/orchestrators/marketplace/info.test.ts` - passed, 22 tests.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` - passed.
- `npm run test:cucumber -- features/marketplace/info.feature` - passed, 6 scenarios and 43 steps.
- `npm run check:features` - passed.
- `npm run check` - passed, including 142 scenarios, 1,504 steps, and 280 direct-coverage records.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The managed sandbox caused isolated Node tests and detached headless Pi processes to exit before reporting results. Running the required verification commands through the approved unsandboxed execution path reached the assertions and completed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for the next marketplace-info plan. No blockers remain.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- The created info step-definition file exists.
- Both task commits are ancestors of the plan head.
- All focused verification and the full repository gate passed.
- STATE.md and ROADMAP.md remain unmodified.

---

*Phase: 05-marketplace-info*
*Completed: 2026-10-18*
