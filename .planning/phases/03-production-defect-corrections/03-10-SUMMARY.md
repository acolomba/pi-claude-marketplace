---
phase: 03-production-defect-corrections
plan: "10"
subsystem: plugin-notification-cardinality
tags: [typescript, notifications, cardinality, plugin, node-test]

requires:
  - phase: 03-production-defect-corrections
    plan: "01"
    provides: Shared notification tally and cardinality contract
  - phase: 03-production-defect-corrections
    plan: "03"
    provides: Plugin owner output and failure-routing foundations
provides:
  - Explicit single cardinality for plugin info and enable-disable surfaces
  - Explicit plural cardinality for plugin list across zero, one, many, and failure results
  - Caller-owned cardinality on the shared marketplace-not-added plugin helper
affects: [phase-03, plugin-info, plugin-list, enable-disable, update, reinstall]

actuals:
  tokens: 14500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - Parsed invocation shape determines cardinality before result enumeration
    - Shared notification helpers require callers to supply structural cardinality
    - Dedicated exact tests own tally bytes while existing cases retain focused body assertions

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-10-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/shared.test.ts

key-decisions:
  - "Plugin info and enable-disable remain single-target even when one invocation emits more than one scope block."
  - "Plugin list remains plural when it produces zero rows or a single synthetic failure row."
  - "Update and reinstall compute cardinality before enumeration so their shared failure helper receives caller-owned intent even when no target rows are produced."
  - "Keep legacy list body assertions focused by recording body-only output there; zero, one, and many cases record and assert the complete tally-bearing message."

patterns-established:
  - "Result count never determines single-versus-plural notification metadata."
  - "A shared emitter accepts cardinality as required input rather than inferring it from rows."

requirements-completed: [PDEF-01]

coverage:
  - id: D1
    description: "Plugin list emits exact plural tallies for zero, one, and multiple result rows without changing ordering."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#zero-one-many cardinality"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/list.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Named plugin info and enable-disable surfaces remain tally-free with explicit single cardinality."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts and tests/orchestrators/plugin/enable-disable.test.ts"
        status: pass
      - kind: other
        ref: "direct coverage for plugin/info.ts and plugin/enable-disable.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The shared marketplace-not-added emitter renders according to caller-supplied cardinality, including pre-row update and reinstall failures."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts plus update/reinstall owner suites"
        status: pass
      - kind: other
        ref: "direct coverage for plugin/shared.ts, plugin/update.ts, and plugin/reinstall.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 10: Remaining Plugin Cardinality Summary

**Every remaining plugin-surface context emitter now declares cardinality from its parsed invocation: named operations stay tally-free, while list reports exact plural tallies for zero, one, many, and failure outcomes.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-07T07:04:21-04:00
- **Completed:** 2026-09-07T07:13:03-04:00
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Declared plugin info as structurally single for its context-based fetch-skip emission.
- Declared plugin list as structurally plural on both normal and synthetic failure paths.
- Added exact list output coverage for zero, one, and three successful rows.
- Declared all enable-disable context emissions as structurally single without changing lock, state, or reload behavior.
- Made the shared marketplace-not-added signal require explicit caller-owned cardinality.
- Moved update and reinstall cardinality selection before target enumeration so failure paths retain parsed invocation intent.
- Preserved list ordering, info path safety, enable-disable state behavior, and update/reinstall reason ordering.

## Task Commits

1. **Task 1 RED: Specify plugin list cardinality** - `22474476` (test)
2. **Task 1 GREEN: Declare info and list cardinality** - `9f2ca257` (fix)
3. **Task 2 RED: Specify shared plugin cardinality** - `ad5dddaa` (test)
4. **Task 2 GREEN: Thread remaining plugin cardinality** - `1e511c85` (fix)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` - Passes explicit single cardinality.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - Passes plural cardinality on success and failure paths.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` - Passes single cardinality for realized and failed rows.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` - Requires caller-owned cardinality on its shared signal emitter.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Supplies target-derived cardinality before enumeration.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Supplies target-derived cardinality before enumeration.
- `tests/orchestrators/plugin/info.test.ts` - Pins tally-free single-target output.
- `tests/orchestrators/plugin/list.test.ts` - Pins exact zero, one, and many plural tallies while retaining body-owner coverage.
- `tests/orchestrators/plugin/enable-disable.test.ts` - Pins tally-free output and current primary-cause rendering.
- `tests/orchestrators/plugin/shared.test.ts` - Proves required plural and single helper intent.

## Decisions Made

- Info remains single even if scope fan-out yields multiple blocks because the operator named one plugin target.
- A list failure is still a plural invocation, so a single synthetic failure row reports `Plugin list: 1 failure`.
- Existing list tests that own row classification record the body without its common trailing tally. Three dedicated tests record the complete message and assert exact zero, one, and many cardinality bytes, avoiding duplicated tally assertions across unrelated cases.
- Update and reinstall reuse their existing target-derived cardinality rather than making the shared helper inspect target or result shapes.

## Deviations from Plan

### Shared helper callers had to change with its required input

- The plan listed `plugin/shared.ts` but not its update and reinstall callers.
- Both callers were updated because leaving a default would make caller-owned cardinality optional and preserve the original ambiguity.

### Enable-disable expectation incorporated the preceding cause-chain contract

- The full enable-disable suite exposed one stale expectation after Plan 03-07 began preserving both the primary error and its cause-chain link.
- The expected bytes now include both identical diagnostic links; no production behavior was changed for that assertion.

## Issues Encountered

- Adding list tallies affected many legacy exact body assertions. The recording boundary now removes only the common trailing list tally for those body-owned cases, while dedicated raw-message cases verify the complete zero, one, and many output.
- Fallow continues to print informational duplicate groups and `✗ 0 above threshold`; it exits zero and no new suppression was added.

## Verification

- Info, list, enable-disable, and shared owner suites passed together.
- Update and reinstall suites passed after their shared-helper call sites changed.
- Direct coverage passed at 100% lines, branches, and functions for all six modified production owners.
- `npm run typecheck` passed.
- Focused ESLint and Prettier checks passed for all plan-owned files.
- `git diff --check` passed.
- `npm run fallow` passed dead-code, health, and duplicate gates.

## User Setup Required

None.

## Next Phase Readiness

- All remaining plugin-surface `notifyWithContext` producers now carry structural cardinality.
- Wave 3 is complete; Plan 03-09 is next in Wave 4.
