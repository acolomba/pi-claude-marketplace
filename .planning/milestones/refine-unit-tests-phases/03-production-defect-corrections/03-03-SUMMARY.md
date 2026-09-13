---
phase: 03-production-defect-corrections
plan: "03"
subsystem: plugin-agent-staging
tags: [typescript, agents, multi-directory, transactions, rollback]

requires:
  - phase: 03-production-defect-corrections
    plan: "02"
    provides: Ordered multi-directory agent discovery and install staging contract
provides:
  - Ordered multi-directory agent preview and staging for plugin update
  - Ordered multi-directory agent preview, staging, and rollback for plugin reinstall
  - A sole list-valued agent-directory contract across every production consumer
affects: [phase-03, plugin-update, plugin-reinstall, agents-bridge]

actuals:
  tokens: 21000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - Reuse the resolver-owned ordered directory list for preview and live staging
    - Observe replacement bytes at the persistence boundary before forcing rollback

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/discover-names.test.ts
    - tests/bridges/agents/stage.test.ts

key-decisions:
  - "Update and reinstall pass `agentsDirs` from discovery to staging without recomputing or narrowing the list."
  - "Reinstall rollback evidence observes both directory-sourced replacements at the state-save boundary, then verifies both old files are restored."
  - "New test-fixture branches were extracted into helpers when Fallow reported them, rather than adding a complexity suppression."

patterns-established:
  - "Preview and mutation consume the same resolver-owned path representation."
  - "Transactional rollback tests prove both the intermediate mutation and the final restoration."

requirements-completed: [PDEF-01]

coverage:
  - id: D1
    description: "Update preview and staging consume all resolved agent directories with stable first-wins warnings."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts"
        status: pass
      - kind: other
        ref: "Direct coverage for orchestrators/plugin/update.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Reinstall preview, staging, and rollback consume artifacts from every resolved agent directory."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts"
        status: pass
      - kind: other
        ref: "Direct coverage for orchestrators/plugin/reinstall.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Production source exposes only the ordered `agentsDirs` representation."
    requirement: PDEF-01
    verification:
      - kind: unit
        ref: "Agent bridge, discovery, install, update, reinstall, and shared suites"
        status: pass
      - kind: other
        ref: "Direct coverage for agents/types.ts, agents/stage.ts, discover-names.ts, and plugin/shared.ts"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 03: Complete Multi-Directory Agent Staging Summary

**Plugin update and reinstall now preview, stage, and roll back the same complete ordered agent-directory list, and the temporary singular representation is gone.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-09-07T05:43:57-04:00
- **Completed:** 2026-09-07T05:56:34-04:00
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Migrated update staging from the first agent directory to every resolver-owned directory.
- Migrated reinstall staging and rollback to that same ordered directory list.
- Proved later-directory conflict preview, materialization, duplicate warnings, and rollback with hermetic fixtures.
- Removed `agentsSourceDir`, `pickAgentsSourceDir`, and the temporary bridge input union from production.
- Updated every bridge test caller to use the canonical list-valued input.

## Task Commits

1. **Task 1 RED: Expose update multi-directory staging gap** - `b1452ce7` (test)
2. **Task 1 GREEN: Stage all resolved directories on update** - `40f69e75` (feat)
3. **Task 2 RED: Expose reinstall staging and rollback gaps** - `4fde49b5` (test)
4. **Task 2 GREEN: Stage all resolved directories on reinstall** - `5e6ee90c` (feat)
5. **Task 3: Remove the singular agent-directory contract** - `1f5d3c99` (refactor)
6. **Verification fix: Extract complex test-fixture branches** - `87288822` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Passes discovery's complete `agentsDirs` list to preparation.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Uses the same list for transactional staging and rollback.
- `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts` - Returns only canonical list-valued agent paths.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` - Removes the obsolete first-directory adapter.
- `extensions/pi-claude-marketplace/bridges/agents/types.ts` - Removes the singular compatibility input union.
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` - Accepts `StageAgentsInput` directly and discovers its full list.
- `tests/orchestrators/plugin/update.test.ts` - Covers later-directory preview, staging, and duplicate warnings.
- `tests/orchestrators/plugin/reinstall.test.ts` - Covers later-directory preview, staging, warnings, and save-failure rollback.
- `tests/orchestrators/plugin/shared.test.ts` - Removes obsolete singular-adapter tests.
- `tests/orchestrators/plugin/discover-names.test.ts` - Pins the list-only discovery result.
- `tests/bridges/agents/stage.test.ts` - Migrates every bridge call to list-valued input.

## Decisions Made

- Passed the exact `generatedNames.agentsDirs` value through update and reinstall preparation, avoiding a second resolution pass or result-dependent filtering.
- Preserved first-wins ordering and existing warning text by leaving discovery ownership in the agents bridge.
- Used a failing state-save seam to inspect both new agent files after replacement and then verify both prior files after rollback.

## Deviations from Plan

### Canonical-input bridge tests were migrated with production

- Removing the compatibility union makes legacy singular object literals invalid.
- `tests/bridges/agents/stage.test.ts` was therefore updated even though the initial `files_modified` list named only its production owner.

### Test fixture helpers were extracted to satisfy the health gate

- Adding multi-directory fixture branches pushed two existing large seed functions over Fallow's cognitive-complexity limit.
- The new branches were extracted into focused helpers; no new suppression was added.

## Issues Encountered

- Fallow correctly reported the two test-helper complexity regressions after the behavioral work was committed. Both were structurally corrected before completion.

## Verification

- Agent types, stage, generated-name discovery, install, update, reinstall, and shared suites passed together: 7 test files.
- Update passed 145/145 tests; reinstall passed 113/113 tests.
- Direct coverage passed at 100% for `update.ts`, `reinstall.ts`, `agents/types.ts`, `agents/stage.ts`, `discover-names.ts`, and `plugin/shared.ts`.
- `npm run typecheck` passed.
- Focused ESLint and Prettier checks passed for all changed TypeScript files.
- `npm run fallow` passed with zero health-threshold violations and the existing authorized suppression unchanged.
- Production search found no `agentsSourceDir`, `pickAgentsSourceDir`, or `PrepareStageAgentsInput` symbol.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BA-015 is closed across install, update, and reinstall.
- Wave 2 can continue with Plan 03-06.

## Self-Check: PASSED

- All production, test, and summary files exist.
- All six task and verification commits are present in git history.

---

_Phase: 03-production-defect-corrections_
_Completed: 2026-09-07_
