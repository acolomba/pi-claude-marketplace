# persistence/

## Purpose

State persistence and filesystem location resolution. `state.json` schema + load/save with legacy-record migration; `ScopedLocations` typed bundle (the `<scopeRoot>/claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp.json` triple). Phase 2 lands both.

The single sanctioned `console.warn` site (IL-3) lives here in Phase 2's `state-io.ts`'s `migrateLegacyMarketplaceRecords`.

## Allowed Imports

`persistence/` may import from: `domain/`, `shared/`. Imports from `edge/`, `orchestrators/`, `bridges/`, `transaction/`, `presentation/`, `platform/` are forbidden.

## Planned Contents

- [ ] `state-io.ts` -- atomic load/save of `state.json` via `shared/atomic-json.ts` (Phase 2)
- [ ] `locations.ts` -- `locationsFor(scope, cwd)` returns the typed `ScopedLocations` bundle (Phase 2)
- [ ] `migrate.ts` -- legacy-record migration with the IL-3 sanctioned `console.warn` (Phase 2)
