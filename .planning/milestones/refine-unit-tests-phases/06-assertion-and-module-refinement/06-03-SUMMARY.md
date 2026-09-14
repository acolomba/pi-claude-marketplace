---
phase: 06-assertion-and-module-refinement
plan: "03"
subsystem: testing
tags: [typescript, node-test, hermeticity, plugin-lifecycle, transactions]

requires:
  - phase: 06-assertion-and-module-refinement
    plan: "01"
    provides: exact plugin lifecycle notification, state, rollback, and tree assertion contracts
  - phase: 05-test-infrastructure-hardening
    plan: "34"
    provides: authorized patch census and narrow transaction, cache, state, and routing ports
provides:
  - five plugin lifecycle owner suites without shared Node builtin mutation
  - case-owned transaction, state, cache, routing, and filesystem failure fixtures
  - exact public notification, rollback, persisted-state, and final-tree proof across the refined owners
affects: [06-assertion-and-module-refinement, plugin-lifecycle-tests]

actuals:
  tokens: 36712
  tasks: 2
  commits: 2
plan_head_before: da6571c3edbc8e423fab861217bd3fc106dc40ae

tech-stack:
  added: []
  patterns:
    - case-owned transaction control replaces shared filesystem observation
    - real temporary-tree permissions provoke ordinary filesystem failures
    - existing state, cache, and routing ports drive deterministic lifecycle faults

key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-03-SUMMARY.md
  modified:
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts

key-decisions:
  - "Install schedule evidence observes a case-owned InstallTransaction phase ledger instead of Node's shared filesystem module."
  - "Reinstall owner tests retain public rollback, tree, state, and output proof while existing persistence, cache, data, and routing ports replace shared primitive observation."
  - "Ordinary filesystem failures use real case-owned permissions and malformed path state; hooks and cache faults use existing narrow owner interfaces."

requirements-completed: [TREF-08]

coverage:
  - id: D1
    description: "Enable, fetch, and info owners drive every retained branch through case-owned state or existing command dependencies while preserving exact public outcomes."
    requirement: TREF-08
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/fetch.test.ts tests/orchestrators/plugin/info.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Install and reinstall owners retain notification order, rollback, persisted-state, ledger, and final-tree proof without scoped builtin patch calls."
    requirement: TREF-08
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/reinstall.test.ts"
        status: pass
      - kind: quality
        ref: "npm run fallow"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 03: Plugin Owner Isolation Summary

**Five plugin lifecycle owner suites now exercise case-owned state and narrow production ports while retaining exact notifications, persisted outcomes, rollback evidence, and final-tree contracts.**

## Performance

- **Duration:** 30 min
- **Started:** 2026-09-09T03:55:50Z
- **Completed:** 2026-09-09T04:25:44Z
- **Tasks:** 2
- **Files created or modified:** 5

## Accomplishments

- Removed `createRequire`, `syncBuiltinESMExports`, and shared `node:fs` promise mutation from enable/disable, fetch, info, install, and reinstall owners.
- Drove enable/disable transaction failures, fetch concurrency, and info read failures through case-owned transactions, status, readers, and real state while retaining exact notifications and persisted results.
- Replaced install schedule observation with a case-owned transaction phase ledger and used existing completion-cache, hooks-routing, and locked-state boundaries for deterministic failure cases.
- Reworked reinstall retries and recovery cases around existing persistence, cache, data, and routing dependencies plus real case-owned filesystem permissions. Ordered notices, redaction, rollback artifacts, and tree inventories remain asserted.
- Kept the authorized terminal residual owners, `tests/bridges/skills/stage.test.ts` and `tests/orchestrators/plugin/uninstall.test.ts`, unchanged.

## Task Commits

Each task was committed atomically after its focused verification passed:

1. **Task 1: Isolate enable, fetch, and info cases** - `8fe524ac` (test)
2. **Task 2: Isolate install and reinstall owner cases** - `fb75cee0` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/enable-disable.test.ts` - Uses a case-owned lifecycle transaction and narrow failure controls while retaining exact notification, state, retry, route, and tree assertions.
- `tests/orchestrators/plugin/fetch.test.ts` - Observes concurrent fetch visibility through the public fetch status owner instead of mutating shared filesystem methods.
- `tests/orchestrators/plugin/info.test.ts` - Injects the existing plugin-info reader boundary and keeps the cohesive public info surface unchanged.
- `tests/orchestrators/plugin/install.test.ts` - Uses case-owned phase observation, existing cache/routing/state owners, and real permission faults for install lifecycle proofs.
- `tests/orchestrators/plugin/reinstall.test.ts` - Uses persistence, cache, data, and hooks ports plus real filesystem state for retry, rollback, restoration, and manual-recovery proofs.
- `.planning/phases/06-assertion-and-module-refinement/06-03-SUMMARY.md` - Records execution evidence and measured plan results.

## Decisions Made

- Transaction phase callbacks are the deterministic owner boundary for install scheduling and rollback evidence. The tests no longer infer those phases by intercepting shared filesystem calls.
- Existing production-owned dependencies remain the only seams for persistence, cache, data-directory, and hooks failures. No reset API, test-only production export, or plugin-info split was added.
- Real permission and path state cover ordinary filesystem failure behavior when a narrow owner port is not the subject of the case.
- Public results remain authoritative. Collaborator ledgers only support exact notification, state-byte, rollback, recovery, and final-tree assertions.

## TDD Gate Compliance

- The centralized behavior-adding predicate classified both tasks as test-only refinements, so the MVP+TDD production-behavior gate did not apply.
- Existing exact owner assertions served as regression gates while patch mechanics were replaced. Each focused suite passed before its atomic task commit.
- No production behavior or source file changed, so no separate RED/GREEN production implementation cycle was required.

## Verification

- The combined five-file `node --test` gate passed.
- `npm run typecheck` passed.
- Scoped ESLint passed with zero warnings for all five refined owners.
- `npm run fallow` passed dead-code, health, and duplication enforcement.
- A prohibited-token scan found no `syncBuiltinESMExports`, `createRequire`, `filesystemPromises`, `retryFs`, or `retryRequire` references in the five target suites.
- The residual scan still finds shared-process patch machinery only in the two explicitly authorized terminal owners: stage and uninstall.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The known stale Phase 1 sealed-route and status expectations in `tests/architecture/revalidation.test.ts` remain outside this plan. This plan did not modify that file, and the debt did not affect any specified verification command.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All five scoped plugin owners are patch-free and contract-preserving. Only the two authorized terminal residual owners remain, and no blocker prevents the next Phase 6 plan.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The summary, all five modified owner suites, the persisted plan-head ledger, and both recorded task commits exist. The measured pre-metadata commit count is two.
