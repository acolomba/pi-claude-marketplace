---
phase: 10-claude-settings-import-foundation
plan: 03
subsystem: import-foundation
tags: [marketplace-sources, import-plan, claude-plugins-official]
requires:
  - phase: 10-claude-settings-import-foundation
    provides: Settings merge and enabled plugin refs from Plans 10-01 and 10-02
provides:
  - Marketplace source planner for official, directory, and github.repo sources
  - Per-scope Claude import plan builder
  - Purity and full Phase 10 validation tests
affects: [phase-11-import-command]
tech-stack:
  added: []
  patterns: [desired-state import plan, scope-preserving plugin actions, unmappable skip diagnostics]
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
    - tests/orchestrators/import/marketplaces.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/types.ts
    - extensions/pi-claude-marketplace/orchestrators/import/index.ts
    - extensions/pi-claude-marketplace/orchestrators/import/settings.ts
    - extensions/pi-claude-marketplace/orchestrators/import/refs.ts
requirements-completed: [IMP-04, IMP-05, IMP-06, IMP-07, IMP-08]
key-decisions:
  - "Phase 10 plans desired marketplace/plugin actions only; it does not call marketplace add, plugin install, state mutation, or network APIs."
  - "Unmappable non-official marketplace refs become skipped plugin entries and diagnostics while unrelated refs continue."
patterns-established:
  - "Official Claude marketplace maps to anthropics/claude-plugins-official as a planned marketplace source."
duration: 18 min
completed: 2026-05-14
---

# Phase 10 Plan 03: Marketplace Source Planning Summary

**Per-scope Claude import planner mapping official, directory, and github.repo marketplaces into pure desired actions**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-14T02:11:00Z
- **Completed:** 2026-05-14T02:29:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Added `planMarketplaceSourcesForRefs` for official built-in, Claude `directory`, and Claude `github.repo` source shapes.
- Added `buildClaudeImportPlan` to produce scope-preserving marketplace actions, plugin installs, skipped plugins, and diagnostics.
- Preserved both-scope duplication: user and project inputs produce independent scoped plans for the same enabled plugin.
- Added architecture tests preventing network, state mutation, marketplace-add, plugin-install, and user-notification calls inside Phase 10 import helpers.
- Verified the repository with `npm run check`.

## Task Commits

1. **Tasks 1-3: Marketplace mapping, import plan builder, and validation** - `f49686e` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts` - Marketplace source mapping and per-scope import plan builder.
- `extensions/pi-claude-marketplace/orchestrators/import/types.ts` - Planned marketplace/plugin/skipped/import-plan types.
- `extensions/pi-claude-marketplace/orchestrators/import/index.ts` - Public Phase 10 planner exports.
- `extensions/pi-claude-marketplace/orchestrators/import/settings.ts` - Formatted by Prettier during final validation.
- `extensions/pi-claude-marketplace/orchestrators/import/refs.ts` - Formatted by Prettier during final validation.
- `tests/orchestrators/import/marketplaces.test.ts` - IMP-07/IMP-08, both-scope duplication, and architecture coverage.
- `tests/orchestrators/import/refs.test.ts` - Formatted by Prettier during final validation.

## Decisions Made

- Planned marketplace sources are deduplicated by marketplace within a scope, while plugin install actions remain per enabled ref.
- Plugins whose marketplace source is unmappable are moved to `skippedPlugins` with reason `unmappable-marketplace-source`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial validation required installing dependencies because `node_modules/` was absent. `npm install` restored the local verification environment; no package files were intentionally changed.
- Prettier flagged new files during validation; formatting was applied without behavior changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 11 can consume `buildClaudeImportPlan` to add missing marketplaces first, then install `pluginsToInstall`, while warning on diagnostics and `skippedPlugins`.

---
*Phase: 10-claude-settings-import-foundation*
*Completed: 2026-05-14*
