---
phase: 08-atomic-reinstall-core
plan: 02
subsystem: bridges
tags: [skills, commands, rollback, reinstall, backup-replacement]

# Dependency graph
requires:
  - phase: 08-atomic-reinstall-core
    provides: lock-held manual-save state transaction and reinstall no-network guard
provides:
  - rollback-safe skills replacement helpers
  - rollback-safe commands replacement helpers
affects: [08-atomic-reinstall-core, reinstall, bridges, skills, commands]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - opaque replacement handles backed by bridge-private WeakMap internals
    - backup-root swap with rollback/finalize lifecycle

key-files:
  created:
    - .planning/phases/08-atomic-reinstall-core/08-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/types.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/skills/index.ts
    - tests/bridges/skills/stage.test.ts
    - extensions/pi-claude-marketplace/bridges/commands/types.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/index.ts
    - tests/bridges/commands/stage.test.ts

key-decisions:
  - "Replacement helper internals are kept bridge-private with WeakMap storage so orchestrators hold opaque handles."
  - "Rollback removes newly staged resources, restores backed-up previous resources, and reports cleanup leaks rather than hiding them."

patterns-established:
  - "Bridge replacement helpers expose replace/rollback/finalize alongside existing prepare/commit/abort without changing install/update behavior."
  - "Replacement failures attempt immediate internal rollback; rollback leaks are surfaced with MANUAL RECOVERY REQUIRED detail."

requirements-completed: [PRL-09, PRL-10]

# Metrics
duration: 12min
completed: 2026-05-14
---

# Phase 08: Plan 02 Summary

**Backup-backed skills and commands replacement helpers with rollback/finalize lifecycle**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-14T00:06:50Z
- **Completed:** 2026-05-14T00:17:35Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `replacePreparedSkills`, `rollbackSkillsReplacement`, and `finalizeSkillsReplacement` with backup roots under skills staging.
- Added `replacePreparedCommands`, `rollbackCommandsReplacement`, and `finalizeCommandsReplacement` with backup roots under commands staging.
- Added Phase 8 tests proving replacement updates targets, rollback restores old bytes, finalize keeps staged content and removes backups, blocked unrelated targets restore backups before throwing, and noop replacements leak nothing.
- Preserved existing `commitPreparedSkills` / `commitPreparedCommands` install/update behavior unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backup-backed skills replacement helper** - `fe34ddd` (feat)
2. **Task 2: Add backup-backed commands replacement helper** - `3589ff1` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/skills/types.ts` - Adds opaque `SkillsReplacement` public handle types.
- `extensions/pi-claude-marketplace/bridges/skills/stage.ts` - Adds replace/rollback/finalize helpers with backup and manual-recovery leak reporting.
- `extensions/pi-claude-marketplace/bridges/skills/index.ts` - Exports new skills replacement helpers and type.
- `tests/bridges/skills/stage.test.ts` - Adds rollback/finalize/noop/conflict tests for skills replacement.
- `extensions/pi-claude-marketplace/bridges/commands/types.ts` - Adds opaque `CommandsReplacement` public handle types.
- `extensions/pi-claude-marketplace/bridges/commands/stage.ts` - Adds replace/rollback/finalize helpers with backup and manual-recovery leak reporting.
- `extensions/pi-claude-marketplace/bridges/commands/index.ts` - Exports new commands replacement helpers and type.
- `tests/bridges/commands/stage.test.ts` - Adds rollback/finalize/noop/conflict tests for commands replacement.

## Decisions Made

- Used bridge-private `WeakMap` storage for replacement internals (`backupRoot`, backed-up paths, renamed paths) to keep the public handles opaque to orchestrators.
- Existing commit/abort helpers remain untouched; reinstall will call the new replacement lifecycle explicitly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first skills task commit was blocked by strict typechecking because the public replacement handle originally exposed `PreparedSkillsStaging` where rollback/finalize required a staged variant. Narrowed the public replaced handle to `PreparedSkillsStaged` while keeping operational internals bridge-private.
- Prettier reformatted two long assertions in the skills tests before the successful commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 08-03 can mirror the replacement lifecycle for agents and MCP. Plan 08-04 can then compose all four bridge replacement helpers under the manual-save transaction from Plan 08-01.

## Self-Check: PASSED

- `node --test tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts` exits 0.
- `npm run typecheck -- --pretty false` exits 0.
- Skills and commands barrels export their new replacement helpers.
- Skills and commands stage files import `MANUAL_RECOVERY_REQUIRED` and expose replace/rollback/finalize functions.

---
*Phase: 08-atomic-reinstall-core*
*Completed: 2026-05-14*
