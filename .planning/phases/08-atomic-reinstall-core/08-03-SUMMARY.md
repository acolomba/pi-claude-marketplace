---
phase: 08-atomic-reinstall-core
plan: 03
subsystem: bridges
tags: [agents, mcp, rollback, reinstall, force]

# Dependency graph
requires:
  - phase: 08-atomic-reinstall-core
    provides: manual-save transaction and rollback-safe skills/commands replacement pattern
provides:
  - rollback-safe agents replacement helpers with force semantics
  - rollback-safe MCP replacement helpers
affects: [08-atomic-reinstall-core, reinstall, bridges, agents, mcp]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - opaque replacement handles backed by bridge-private WeakMap internals
    - old index/document snapshot restore on rollback
    - default foreign agent block with force-mode rollback protection

key-files:
  created:
    - .planning/phases/08-atomic-reinstall-core/08-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/types.ts
    - extensions/pi-claude-marketplace/bridges/agents/stage.ts
    - extensions/pi-claude-marketplace/bridges/agents/index.ts
    - tests/bridges/agents/stage.test.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/index.ts
    - tests/bridges/mcp/stage.test.ts

key-decisions:
  - "Agents replacement blocks prepared foreign-content failures by default and allows force only for this plugin's previous index rows."
  - "MCP replacement stores exact previous mcp.json text and restores it on rollback, preserving previous shape/format where possible."

patterns-established:
  - "Agents replacement restores both files and agents-index.json using a captured pre-replacement index snapshot."
  - "MCP replacement preserves bridge-owned collision policy by wrapping prepared commit/rollback without adding new policy checks."

requirements-completed: [PRL-09, PRL-10]

# Metrics
duration: 12min
completed: 2026-05-14
---

# Phase 08: Plan 03 Summary

**Rollback-safe agents and MCP replacement helpers with default foreign-content blocking and force-mode restore**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-14T00:18:32Z
- **Completed:** 2026-05-14T00:26:57Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `replacePreparedAgents`, `rollbackAgentsReplacement`, and `finalizeAgentsReplacement` with backup of previous agent files and exact agents-index text.
- Added `force?: boolean` semantics for agents replacement: default blocks `prepared.result.failed`, while `force: true` backs up and overwrites this plugin's previous foreign-preserved entries and can roll them back.
- Added `replacePreparedMcp`, `rollbackMcpReplacement`, and `finalizeMcpReplacement` with exact previous `mcp.json` text restoration or absence restoration.
- Added tests proving rollback restores agent files/index, foreign-content blocks before mutation, force overwrite is rollback-protected, MCP rollback restores previous bytes or removes newly-created `mcp.json`, and noop handles leak nothing.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add backup-backed agents replacement helper with force semantics** - `2cac16e` (feat)
2. **Task 2: Add rollback-capable MCP replacement helper** - `74961b2` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/agents/types.ts` - Adds `ReplacePreparedAgentsOptions` and opaque `AgentsReplacement` handle types.
- `extensions/pi-claude-marketplace/bridges/agents/stage.ts` - Adds replace/rollback/finalize helpers with force semantics, file backup, and agents-index restore.
- `extensions/pi-claude-marketplace/bridges/agents/index.ts` - Exports new agents replacement helpers and types.
- `tests/bridges/agents/stage.test.ts` - Adds rollback/default-block/force/noop tests for agent replacement.
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts` - Adds opaque `McpReplacement` handle types.
- `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` - Adds replace/rollback/finalize helpers that snapshot and restore scoped `mcp.json`.
- `extensions/pi-claude-marketplace/bridges/mcp/index.ts` - Exports new MCP replacement helpers and type.
- `tests/bridges/mcp/stage.test.ts` - Adds rollback/absence/noop/collision-policy tests for MCP replacement.

## Decisions Made

- Agents rollback restores exact previous `agents-index.json` text instead of reconstructing an equivalent document, preserving prior formatting where possible.
- MCP rollback restores exact previous `mcp.json` text when the file existed and removes the file when it was absent before replacement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial agents commit was blocked by import ordering and Prettier formatting. Reordered imports, accepted formatting, reran focused agents tests and typecheck, then committed successfully.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All four bridge families now expose rollback-safe replacement helpers. Plan 08-04 can compose skills, commands, agents, and MCP replacement under `withLockedStateTransaction` to implement atomic single-plugin reinstall.

## Self-Check: PASSED

- `node --test tests/bridges/agents/stage.test.ts tests/bridges/mcp/stage.test.ts` exits 0.
- `npm run typecheck -- --pretty false` exits 0.
- Agents and MCP barrels export their new replacement helpers.
- Agents stage includes `force?: boolean` and `MANUAL_RECOVERY_REQUIRED` handling.

---
*Phase: 08-atomic-reinstall-core*
*Completed: 2026-05-14*
