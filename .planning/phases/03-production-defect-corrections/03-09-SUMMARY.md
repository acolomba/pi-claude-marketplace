---
phase: 03-production-defect-corrections
plan: "09"
subsystem: lifecycle-notification-cardinality
tags: [typescript, notifications, cardinality, lifecycle, node-test]

requires:
  - phase: 03-production-defect-corrections
    plan: "03"
    provides: Lifecycle output and failure-routing foundations
  - phase: 03-production-defect-corrections
    plan: "06"
    provides: Rollback and containment corrections
  - phase: 03-production-defect-corrections
    plan: "07"
    provides: Typed errors and cleanup-context preservation
provides:
  - Explicit single cardinality on every standalone install, reinstall, and uninstall notification
  - Target-derived update and bulk-reinstall cardinality across success, failure, and empty paths
  - A cardinality-aware update no-op wrapper that preserves its fixed no-op headline
affects: [phase-03, plugin-install, plugin-reinstall, plugin-update, plugin-uninstall]

actuals:
  tokens: 20000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - Invocation structure selects cardinality before enumeration or outcome filtering
    - Direct failure helpers require caller-owned cardinality
    - Empty bulk lifecycle operations retain their operation-specific summary

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-09-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/shared/notify-context.test.ts
    - tests/architecture/catalog-uat.test.ts

key-decisions:
  - "Install and uninstall accept one named plugin target, so every standalone notification is structurally single."
  - "Reinstall and update select cardinality from the parsed target before enumeration, preserving plural intent when enumeration returns no rows or fails."
  - "The empty bulk update uses its established `Plugin update: nothing to update` contract rather than the generic `(no marketplaces)` sentinel."
  - "Update's realized-transition tally override remains independent from invocation cardinality."

patterns-established:
  - "Early aborts and no-op paths receive the same target-derived cardinality as the main cascade."
  - "Named lifecycle commands explicitly carry single cardinality even though their rendered bytes remain tally-free."

requirements-completed: [PDEF-01]

coverage:
  - id: D1
    description: "Named install, reinstall, and uninstall notifications explicitly remain single and tally-free."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts, reinstall.test.ts, and uninstall.test.ts"
        status: pass
      - kind: other
        ref: "Direct coverage for install.ts, reinstall.ts, and uninstall.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bulk reinstall preserves a zero-success tally when no targets are installed."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#GAP-01"
        status: pass
    human_judgment: false
  - id: D3
    description: "Bulk update preserves no-op and failure summaries while named update failures remain tally-free."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#PUP-1 and WR-05"
        status: pass
      - kind: other
        ref: "Direct coverage for plugin/update.ts and shared/notify-context.ts"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 09: Lifecycle Cardinality Summary

**Every plugin lifecycle notification now retains cardinality from the parsed invocation, including empty and early-failure bulk paths, without changing named-operation output.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-09-07T07:15:00-04:00
- **Completed:** 2026-09-07T07:27:12-04:00
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Marked every standalone install and uninstall notification as structurally single.
- Marked the low-level named reinstall arms as single while retaining target-derived cardinality for bulk cascade, empty, and enumeration-failure paths.
- Threaded update cardinality through enumeration failures, clone failures, three-phase failures, rollback-partial notifications, invalid-config write-back failures, no-op output, and the final cascade.
- Replaced the empty bulk update's generic marketplace sentinel with the command's established no-op headline.
- Preserved typed reasons, cleanup causes, rollback children, severity, reload hints, and realized-transition tally behavior.

## Task Commits

1. **Task 1 RED: Specify install and reinstall cardinality** - `15065794` (test)
2. **Task 1 GREEN: Preserve install and reinstall cardinality** - `94e8ba6b` (fix)
3. **Task 2 RED: Cover update and uninstall cardinality arms** - `94cc4d0c` (test)
4. **Task 2 GREEN: Preserve update and uninstall cardinality** - `c8e1e091` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - Supplies single cardinality on all four standalone notification arms.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Supplies single cardinality to named arms and parsed-target cardinality to empty and failure paths.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Carries parsed-target cardinality through every direct output helper and cascade.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` - Supplies single cardinality on all four standalone notification arms.
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - Requires and stamps cardinality for the update no-op envelope.
- Lifecycle owner tests - Pin empty bulk summaries, early bulk failures, and tally-free named output.
- Shared and catalog tests - Exercise the now-required no-op cardinality input.

## Decisions Made

- Cardinality follows the operator's target form, never the number or partition of produced rows.
- Empty reinstall keeps the generic empty body plus `Plugin reinstall: 0 successes`, because reinstall uses the normal tally composer.
- Empty update uses `Plugin update: nothing to update`, because update already owns a fixed never-silent no-op contract independent of success tally arithmetic.
- Low-level install, reinstall, and uninstall functions are named-plugin entrypoints, so their standalone notifications use an explicit `single` literal.

## Deviations from Plan

### The shared update no-op helper and its owner tests changed

- The plan listed only lifecycle orchestrators and their owner tests.
- The helper had to accept cardinality so the empty update path could use the same typed context seam as the normal no-op cascade; its shared and catalog callers were updated with explicit plural intent.

## Issues Encountered

- Repository-wide `npm run format:check` reports the pre-existing, user-owned untracked `.mcp.json`. It was left untouched; focused Prettier checks passed for every plan-owned file.
- Fallow continues to print informational duplicate groups and exits zero. No new suppression was added.

## Verification

- All four lifecycle owner suites passed together with the shared notification-context and catalog suites.
- Direct coverage passed at 100% lines, branches, and functions for install, reinstall, update, uninstall, and shared notify-context.
- `npm run typecheck` passed.
- Repository-wide ESLint passed.
- Focused Prettier checks and `git diff --check` passed.
- `npm run fallow` passed dead-code, health, and duplicate gates.

## User Setup Required

None.

## Next Phase Readiness

- Every plugin lifecycle output path now declares structural cardinality.
- Plan 03-11 is the final remaining gap-closure plan.
