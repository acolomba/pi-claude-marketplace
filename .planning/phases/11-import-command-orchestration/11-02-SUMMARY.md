---
phase: 11-import-command-orchestration
plan: 02
subsystem: edge-command
tags: [import, slash-command, router, completions]
requires:
  - phase: 11-import-command-orchestration
    plan: 01
    provides: Import execution orchestrator
provides:
  - `/claude:plugin import [--scope user|project]` edge handler
  - Router and registration wiring for import
  - Import command tab completion updates
affects: [phase-11-import-command, edge-layer]
tech-stack:
  added: []
  patterns: [thin edge handler, both-scope default, command completion sentinel]
key-files:
  created:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - tests/edge/handlers/import.test.ts
  modified:
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/completions/provider.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/types.ts
    - tests/edge/router.test.ts
    - tests/edge/completions/provider.test.ts
    - tests/edge/register.test.ts
requirements-completed: [IMP-01, IMP-02, IMP-03, IMP-11]
key-decisions:
  - "Omitted import scope expands to selectedScopes ['user', 'project']; explicit --scope narrows to exactly one scope."
  - "EdgeDeps exposes an optional importClaudeSettings seam for tests while production uses the real orchestrator."
patterns-established:
  - "Import has no positional arguments; positional input is rejected with usage through ctx.ui.notify helpers."
duration: 12 min
completed: 2026-05-14
---

# Phase 11 Plan 02: Import Command Edge Wiring Summary

**Expose import orchestration through `/claude:plugin import [--scope user|project]`**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-14T03:10:00Z
- **Completed:** 2026-05-14T03:22:00Z
- **Tasks:** 4
- **Files modified:** 9

## Accomplishments

- Added `makeImportHandler` with command parsing, usage errors, both-scope default, explicit-scope narrowing, and delegation to `importClaudeSettings`.
- Routed top-level `import` through `routeClaudePlugin` and added it to usage text.
- Added `import` to top-level tab completions and ensured `import -` offers `--scope`, `import --scope ` offers `user`/`project`, and `import foo` does not trigger plugin-ref completions.
- Wired the import handler in command registration and updated the command description to mention import.
- Added edge tests for handler scope expansion, router dispatch/usage, completion behavior, and registered-command routing.

## Task Commits

1. **Tasks 1-4: Import handler, routing, completions, registration** - committed (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` - Thin import edge handler.
- `extensions/pi-claude-marketplace/edge/router.ts` - Top-level import usage and dispatch.
- `extensions/pi-claude-marketplace/edge/completions/provider.ts` - Top-level `import` completion.
- `extensions/pi-claude-marketplace/edge/register.ts` - Import handler registration.
- `extensions/pi-claude-marketplace/edge/types.ts` - Optional import orchestrator test seam.
- `tests/edge/handlers/import.test.ts` - Import handler tests.
- `tests/edge/router.test.ts` - Import router and usage tests.
- `tests/edge/completions/provider.test.ts` - Import completion tests.
- `tests/edge/register.test.ts` - Registered command import routing test.

## Decisions Made

- The handler uses the existing `parseArgs` helper directly because import accepts only flags and no positional arguments.
- Import gets production `gitOps` through `EdgeDeps`, preserving the existing marketplace-add dependency path.
- Tests use an injected `importClaudeSettings` function to prove command routing without performing real disk or network mutations.

## Deviations from Plan

None - implementation follows the planned edge wiring.

## Issues Encountered

- A new completion test initially used a `description` field that is not part of `PluginIndexRow`. Systematic debugging identified the type mismatch; the fixture now uses only `name`, `status`, and `version`.

## Validation

- `npm run typecheck` - passed.
- `npm test -- tests/edge/handlers/import.test.ts tests/edge/router.test.ts tests/edge/completions/provider.test.ts tests/edge/register.test.ts` - passed.
- `npm test -- tests/orchestrators/import/execute.test.ts tests/orchestrators/import/settings.test.ts tests/orchestrators/import/refs.test.ts tests/orchestrators/import/marketplaces.test.ts` - passed as regression coverage for the delegated orchestrator.

## User Setup Required

None.

## Next Plan Readiness

Plan 11-03 can add command-level e2e fixtures and final validation for both-scope import, narrowed scope, unavailable warnings, source mismatch, idempotency, and single reload guidance.

---
*Phase: 11-import-command-orchestration*
*Completed: 2026-05-14*
