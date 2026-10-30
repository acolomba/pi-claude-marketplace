---
phase: 11-cleanup-split-and-docs
plan: "02"
subsystem: lifecycle-orchestration
tags: [typescript, notifications, dependencies, cleanup]
requires: []
provides:
  - One typed marketplace-not-added message factory shared by info and list surfaces
  - One configuration-enabled holder filter shared by disable and removal guards
affects: [marketplace-info, plugin-info, plugin-list, plugin-enable-disable]
actuals:
  tokens: 2574
  tasks: 2
  commits: 2
plan_head_before: c6407e236f812cdc79f65c206f0aa21eadc785f1
plan_head_after: fb4d915cd306d3e73aa7bf8c592c5b8f1e156b79
tech-stack:
  added: []
  patterns:
    - Shared pure factories construct repeated notification variants.
    - Reverse-dependency guards filter the declaration map through one persisted-state rule.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - test/orchestrators/marketplace/shared.test.ts
key-decisions:
  - Keep cross-scope probing outside the pure message factory so notification construction cannot read state.
  - Reuse withoutDisabledHolders so configuration-enabled, load-time-disabled holders keep the shared meaning.
patterns-established:
  - Marketplace absence payloads are built through marketplaceNotAddedMessage.
requirements-completed: [CLN-01]
coverage:
  - id: D1
    description: Marketplace and plugin info plus plugin list share one typed marketplace-not-added payload without changing rendered bytes.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/marketplace/info.test.ts, test/orchestrators/plugin/list-flow.test.ts, and test/orchestrators/plugin/info.test.ts
        status: pass
      - kind: other
        ref: direct coverage for marketplace/shared.ts, marketplace/info.ts, plugin/list-flow.ts, and plugin/info.ts
        status: pass
    human_judgment: false
  - id: D2
    description: The standalone disable guard reuses the shared configuration-enabled declaration-map filter with stable dependent order.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/orchestrators/plugin/dependency-index.test.ts and test/orchestrators/plugin/enable-disable.test.ts
        status: pass
      - kind: other
        ref: direct coverage for plugin/dependency-index.ts and plugin/enable-disable.ts
        status: pass
    human_judgment: false
duration: 11min
completed: 2026-10-27
status: complete
---

# Phase 11 Plan 02: Shared Marketplace and Dependency Filters Summary

**Marketplace absence notifications and enabled reverse-dependent checks now use their existing shared rules without changing output bytes or order.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-27T23:46:28Z
- **Completed:** 2026-10-27T23:56:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Added a pure, typed `marketplaceNotAddedMessage` factory and routed marketplace info, plugin info, and plugin list through it.
- Preserved optional scope brackets, cross-scope hints, notification boundaries, and exact rendered bytes.
- Replaced the standalone disable guard's local declarer filter with `withoutDisabledHolders`, preserving declaration-map order and persisted-state lookup.

## Task Commits

1. **Task 1: Share the marketplace-not-added message builder** - `d2d20e4d` (`refactor`)
2. **Task 2: Reuse the enabled-declarer filter** - `fb4d915c` (`refactor`)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - Exports the pure marketplace-absence message factory.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` - Uses the shared message factory for absent marketplaces.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts` - Uses the shared message factory for narrowed list misses.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - Uses the shared message factory when no scope records the marketplace.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - Filters the declaration index through `withoutDisabledHolders`.
- `test/orchestrators/marketplace/shared.test.ts` - Pins omitted and present optional factory fields.

## Decisions Made

- Kept `crossScopeFlag` asynchronous and separate from the factory. The factory remains pure, while each caller keeps its existing state-probe timing.
- Reused `withoutDisabledHolders` as written. Its `dependencyDisabled` exception marks a plugin that remains enabled in configuration. The plugin still holds declarations.
- Added no enable-disable test. The existing disabled-declarer case fails if the holder filter is removed. The dependency-index test pins the load-time-disabled distinction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Direct coverage] Added focused owner tests for the new shared factory**

- **Found during:** Task 1 direct coverage
- **Issue:** The plan introduced a branch-bearing export in `marketplace/shared.ts`. Its test ownership list did not include the paired shared test. Direct coverage reported one uncovered function.
- **Fix:** Added two exact structural assertions for the omitted optional fields and the scoped cross-scope form.
- **Files modified:** `test/orchestrators/marketplace/shared.test.ts`
- **Verification:** The shared owner suite and direct coverage for `marketplace/shared.ts` passed.
- **Committed in:** `d2d20e4d`

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** The added test is the minimum paired coverage required for the planned shared export. Production scope did not expand.

## Issues Encountered

- CodeGraph could not open its database in this worktree. Narrow repository searches and Fallow guards supplied the caller and policy context before editing.
- The sandbox first prevented the repository fixers and Fallow from writing worktree or cache files. The commands passed with worktree-scoped permissions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The remaining cleanup plans can reuse the consolidated notification and holder-filter rules. This plan has no dependency on the Phase 10 install-flow work.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- Both task commits are ancestors of the plan head.
- All six modified files exist.
- Owner tests, direct coverage, changed-code Fallow audits, and `npm run fallow` passed.
- The working tree contained no uncommitted task changes before this summary was added.

---
*Phase: 11-cleanup-split-and-docs*
*Completed: 2026-10-27*
