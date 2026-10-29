---
phase: 11-cleanup-split-and-docs
plan: "01"
subsystem: lifecycle-contracts
tags: [typescript, reconcile, git, dead-code, type-safety]
requires: []
provides:
  - Dead checkout and removal-test seams removed
  - Required installed outcome versions
  - Explicit recorded-version maps at every pending projection call
affects: [plugin-lifecycle, reconcile, import]
actuals:
  tokens: 6953
  tasks: 2
  commits: 2
plan_head_before: 0d435ff5ab55e2502ea0757987c02ff87dd6ceaa
plan_head_after: 4f8e2fa917676b0afa3a0a213acc8d4c662c9f62
tech-stack:
  added: []
  patterns:
    - Required lifecycle data is represented by required TypeScript members and explicit positional inputs.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - test/orchestrators/import/execute.test.ts
key-decisions:
  - Keep empty recorded-version maps explicit at callers instead of supplying a projection default.
  - Preserve versionless enable fixtures while making successful install fixtures carry their resolved version.
patterns-established:
  - Required lifecycle projection inputs have no silent empty default.
requirements-completed: [CLN-01]
coverage:
  - id: D1
    description: Dead removal-helper and checkout-force seams are absent while checkout behavior remains covered.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/platform/git.test.ts#local Git operations
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Successful install outcomes require versions and pending projections require recorded-version maps.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/types.test.ts and test/orchestrators/reconcile/notify.test.ts
        status: pass
      - kind: other
        ref: direct coverage for orchestrators/types.ts, reconcile/notify.ts, and import/execute.ts
        status: pass
    human_judgment: false
duration: 34min
completed: 2026-10-27
status: complete
---

# Phase 11 Plan 01: Dead Seams and Required Versions Summary

**Unused Git and removal-test seams are gone, while installed versions and pending recorded-version maps are now compile-time requirements.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-27T22:22:59Z
- **Completed:** 2026-10-27T22:56:48Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Removed `createDelegatingRemovalOps` and the unread `CheckoutOptions.force` member after consumer tracing.
- Made installed outcomes carry a required version and proved missing or undefined versions fail the type fixture.
- Removed the pending projection's silent recorded-version default and made empty maps explicit where no state exists.

## Task Commits

1. **Task 1: Remove the two proven-dead seams** - `ea007ae7` (`refactor`)
2. **Task 2: Require installed versions and recorded pending versions** - `4f8e2fa9` (`refactor`)

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - Removed the unread checkout force option.
- `test/platform/git.test.ts` - Covers detached checkout through the remaining checkout contract.
- `test/platform/removal-ops-fake.ts` - Removed the unconsumed delegating removal fake.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - Requires versions on installed outcomes.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - Requires force keys and recorded versions at pending projection calls.
- `test/orchestrators/types.test.ts` - Pins required installed versions with positive and negative fixtures.
- `test/orchestrators/reconcile/notify.test.ts` - Supplies explicit empty or populated maps at every projection call.
- `test/architecture/notify-stamp-coverage.test.ts` - Supplies explicit pending projection inputs.
- `test/orchestrators/import/execute.test.ts` - Keeps the shared successful install fixture and expected projections aligned with the required version contract.

## Decisions Made

- Required both positional inputs before the optional convergence arguments. This preserves the existing argument order and prevents either value from being omitted accidentally.
- Kept versionless enable outcomes versionless in import tests. The new requirement applies to successful install outcomes, not enable outcomes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Direct caller fixture] Updated import install expectations after the type contract exposed the shared fixture**

- **Found during:** Task 2 commit hook
- **Issue:** `test/orchestrators/import/execute.test.ts` used one shared successful install fixture without a version. Adding the required value made the import projection truthfully carry and render it, so its shared expected-result builder and notification strings also needed synchronization.
- **Fix:** Added `version: "1.0.0"` to the install fixture, made install expectations include it, and preserved the two versionless enable cases explicitly.
- **Files modified:** `test/orchestrators/import/execute.test.ts`
- **Verification:** Typecheck, the complete import owner suite, and direct coverage for `orchestrators/import/execute.ts` passed.
- **Committed in:** `4f8e2fa9`

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** The change is test-only and directly required by the installed-outcome contract. Production import behavior was not altered.

## Issues Encountered

- CodeGraph could not open its database in this worktree. The required Fallow trace commands were still run; because they could not resolve the test export or interface member, targeted `rg` consumer searches confirmed both removals before editing.
- The Task 2 TDD red state was observed as an unused `@ts-expect-error` for a missing version. Repository hooks require green commits, so the red fixture and implementation were committed together after verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The remaining cleanup plans can rely on narrower Git options and non-optional lifecycle version data. No blocker remains from this plan.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- Both task commits are ancestors of the plan head.
- All nine modified files exist and the working tree contained no uncommitted task changes before this summary was added.

---
*Phase: 11-cleanup-split-and-docs*
*Completed: 2026-10-27*
