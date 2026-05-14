---
phase: 10-claude-settings-import-foundation
plan: 01
subsystem: import-foundation
tags: [claude-settings, import, diagnostics, merge]
requires:
  - phase: 07-integration-pi-wiring
    provides: Two-scope Pi integration baseline and pure orchestrator patterns
provides:
  - Claude settings path resolver for user/project scopes
  - Missing/malformed settings read behavior with diagnostics
  - Local-over-base shallow merge for known Claude settings sections
affects: [phase-11-import-command]
tech-stack:
  added: []
  patterns: [pure import helpers, diagnostics-as-data, local-over-base merge]
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/import/types.ts
    - extensions/pi-claude-marketplace/orchestrators/import/settings.ts
    - extensions/pi-claude-marketplace/orchestrators/import/index.ts
    - tests/orchestrators/import/settings.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/index.ts
key-decisions:
  - "Claude settings discovery respects CLAUDE_CONFIG_DIR only for user scope; project scope uses <cwd>/.claude/settings*.json."
  - "Malformed JSON is returned as warning diagnostics while valid companion settings continue to merge."
patterns-established:
  - "Import foundation modules return structured diagnostics instead of notifying or writing stdout/stderr."
requirements-completed: [IMP-04]
duration: 15 min
completed: 2026-05-14
---

# Phase 10 Plan 01: Settings Discovery and Merge Summary

**Pure Claude settings loader with deterministic user/project paths, warn-and-continue JSON reads, and local-over-base merge semantics**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-14T01:46:00Z
- **Completed:** 2026-05-14T02:01:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `orchestrators/import/` public barrel and re-exported it from the orchestrators top-level barrel.
- Implemented user/project Claude settings path resolution, including explicit `claudeConfigDir` and `CLAUDE_CONFIG_DIR` support for user settings.
- Implemented optional JSON reads where missing files are empty and malformed/read failures return diagnostics.
- Implemented shallow local-over-base merge for `enabledPlugins` and `extraKnownMarketplaces`.

## Task Commits

1. **Tasks 1-3: Settings discovery, reads, and merge** - `e20bd2c` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/import/types.ts` - Import diagnostics, settings paths, and merged-settings result types.
- `extensions/pi-claude-marketplace/orchestrators/import/settings.ts` - Settings path resolver, optional JSON reader, and merge helper.
- `extensions/pi-claude-marketplace/orchestrators/import/index.ts` - Public Phase 10 import foundation barrel.
- `extensions/pi-claude-marketplace/orchestrators/index.ts` - Re-exports the import foundation API.
- `tests/orchestrators/import/settings.test.ts` - Regression tests for path resolution, missing/malformed files, and merge semantics.

## Decisions Made

- Used diagnostics-as-data for malformed JSON/read errors so Phase 11 can decide presentation via `ctx.ui.notify`.
- Treated non-object known settings sections as empty during merge to keep user-controlled JSON tolerant.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 10-02 can consume `MergedClaudeSettings.enabledPlugins` directly to extract exact-true `plugin@marketplace` refs.

---
*Phase: 10-claude-settings-import-foundation*
*Completed: 2026-05-14*
