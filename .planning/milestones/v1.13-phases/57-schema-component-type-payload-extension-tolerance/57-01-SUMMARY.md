---
phase: 57-schema-component-type-payload-extension-tolerance
plan: 01
subsystem: persistence
tags:
  - persistence
  - state-schema
  - typebox
  - migration
  - hooks
dependency_graph:
  requires:
    - SPLIT-01 / D-12 / D-13 STATE_SCHEMA + ensurePluginResources default-fill seam (carry-forward from Phase 51)
  provides:
    - PLUGIN_INSTALL_RECORD_SCHEMA.resources.hooks (required string[])
    - ensurePluginResources hooks-default arm (resources.hooks = [])
  affects:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (fresh install record stamps hooks: [])
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts (resourcesFromHandles + clonePluginRecord carry hooks)
tech_stack:
  added: []
  patterns:
    - additive-required-schema-field-via-default-fill (HOOK-02 / D-57-01 — mirrors agents / mcpServers arms; no schemaVersion bump)
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/persistence/migrate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/persistence/migrate.test.ts
    - tests/persistence/state-io.test.ts
    - tests/edge/handlers/tools.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/marketplace/cascade.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/transaction/with-state-guard.test.ts
decisions:
  - "HOOK-02 / D-57-01 honored verbatim: PLUGIN_INSTALL_RECORD_SCHEMA.resources gains a REQUIRED hooks: Type.Array(Type.String()) field. STATE_SCHEMA.schemaVersion stays Type.Literal(1) — additive migration only."
  - "ensurePluginResources hooks arm mirrors the existing agents / mcpServers arms in lockstep (same shape, same mutation contract, same idempotency)."
  - "No new persistMigratedState call sites — the new mutation flag rides the existing fire-and-forget atomic write seam (NFR-1 unchanged)."
  - "Pre-existing 12 test-file fixtures and 3 production-orchestrator call sites (install.ts, reinstall.ts × 2) updated in lockstep with the schema widening so typecheck stays clean and saveState's schema gate accepts the records."
metrics:
  duration_min: 39
  completed_date: "2026-06-14"
requirements:
  - HOOK-02
---

# Phase 57 Plan 01: Schema additive `resources.hooks` field with default-fill migration — Summary

`PLUGIN_INSTALL_RECORD_SCHEMA.resources.hooks: Type.Array(Type.String())` lands as a required additive field with a mirror default-fill arm in `ensurePluginResources`; `STATE_SCHEMA.schemaVersion` stays `Type.Literal(1)` per D-57-01.

## Outcome

v1.0..v1.12 `state.json` files now load cleanly under v1.13: `loadState` runs `migrateLegacyMarketplaceRecords` (which calls `ensurePluginResources`) before `STATE_VALIDATOR.Check`, so any record missing `resources.hooks` is default-filled to `[]` and the schema gate passes. A second pass over an already-normalized record is idempotent (`mutated: false`). Mutations from the new arm propagate through the existing fire-and-forget `persistMigratedState` atomic write — no new save call sites.

Bucket-A hook installation, dispatch, and exec are NOT wired here; they belong to later phases (DISP / EXEC). Every fresh install record stamps `hooks: []` until those phases land.

## Tasks completed

| Task                                                                          | Type  | Commits          | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1: Add `resources.hooks` field to `PLUGIN_INSTALL_RECORD_SCHEMA`              | auto+tdd | f955bc6 / 7827f0b | `state-io.ts`, `install.ts`, `reinstall.ts`, 12 test fixtures                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2: Extend `ensurePluginResources` with `hooks: []` default-fill               | auto+tdd | 83d45a9 / 9d4c6f5 | `migrate.ts`, `migrate.test.ts`, `state-io.test.ts`, 4 additional test fixtures (enable-disable, autoupdate, info, list)                                                                                                                                                                                                                                                                                                                                                                                           |

## Behavior changes

- **Schema** (`PLUGIN_INSTALL_RECORD_SCHEMA.resources`): now has 5 required `string[]` fields — `skills`, `prompts`, `agents`, `mcpServers`, `hooks`. `Type.Object` lenient default `additionalProperties: true` preserved.
- **Migrator** (`ensurePluginResources`): new arm appended after `mcpServers` arm. Same shape: `if (resources.hooks === undefined) { resources.hooks = []; mutated = true; }`. Also fires inside the synthesized-`resources` arm so a record missing the entire `resources` object gets the full `{agents: [], mcpServers: [], hooks: []}` skeleton.
- **Install path** (`orchestrators/plugin/install.ts:715-720`): fresh install records stamp `hooks: []` alongside the other 4 resource arrays.
- **Reinstall path** (`orchestrators/plugin/reinstall.ts`): `resourcesFromHandles` returns `hooks: []`; `clonePluginRecord` propagates `record.resources.hooks` verbatim.

## Tests

5 new behavior cases in `tests/persistence/migrate.test.ts` (HOOK-02 / D-57-01 arm + D-57-03 preservation):

1. Fills `hooks: []` when absent (mutated=true).
1. Idempotent when already normalized (whole-function mutated=false).
1. Preserves a pre-existing `hooks: ["x"]`.
1. Fills `hooks: []` when the entire `resources` field is missing (synthesized-resources arm).

5 new STATE_VALIDATOR cases in `tests/persistence/state-io.test.ts`:

1. Accepts `resources.hooks: []`.
1. Accepts `resources.hooks: ["my-plugin"]` (D-57-03 generatedName shape).
1. Rejects `resources.hooks: "not-an-array"`.
1. Rejects a record omitting `resources.hooks` entirely (default-fill is the migrator's responsibility).
1. v1.12-shaped `state.json` round-trips through `loadState`; first plugin gains `hooks: []` default, second plugin's pre-existing `hooks: ["pre-existing"]` left untouched.

Full unit suite: 1862 / 1862 GREEN. Integration suite: 10 / 10 GREEN. Typecheck + ESLint + Prettier clean (`npm run check` exit 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated 13 pre-existing test fixtures + 3 production call sites for the widened schema**

- **Found during:** Task 1 GREEN
- **Issue:** Widening `PLUGIN_INSTALL_RECORD_SCHEMA.resources` with a REQUIRED `hooks` field surfaced 24 typecheck errors across 3 production files (`install.ts`, `reinstall.ts` × 2) and 12 test files that hand-build `PluginInstallRecord` literals. Without these updates, `tsc --noEmit` and `saveState`'s schema gate would block any commit.
- **Fix:** Added `hooks: []` (or `hooks: resources.hooks ?? []` in factory helpers) to every literal. Where the test file declared its own narrowed `resources` type for an `as unknown as` cast, added `hooks: string[]` to the local type. Where the test file referenced fixture lines that loaded `state.json` and asserted byte-equality after a no-op operation, updated the fixture's `resources` literal to include `hooks: []` so the migrator default-fill does NOT trigger a fire-and-forget persist that would change the bytes (e.g. `tests/orchestrators/plugin/enable-disable.test.ts:81-82, 185`; `tests/orchestrators/marketplace/autoupdate.test.ts:692`; `tests/orchestrators/plugin/info.test.ts:160-163`; `tests/orchestrators/plugin/list.test.ts:171-174, 635`).
- **Files modified:** see `key_files.modified` above.
- **Commits:** 7827f0b (production + 12 test fixtures), 9d4c6f5 (4 additional test fixtures discovered at Task 2 runtime via `npm test`).

**2. [Rule 3 - Blocking] Reformatted out-of-scope harness JSON files so the global `npm format check` pre-commit hook passed**

- **Found during:** Task 2 GREEN pre-commit
- **Issue:** The repo's `npm format check` pre-commit hook runs `prettier --check "**/*.{js,json,ts}"` with `pass_filenames: false`, so it scans the whole repo regardless of which files the commit touches. Two untracked GSD/bg-shell harness files (`.bg-shell/manifest.json`, `.gsd/runtime/write-gate-state.json`) carried pre-existing prettier drift unrelated to this plan, blocking every commit.
- **Fix:** `npx prettier --write` on those two files only. The drift was pure whitespace / quote normalization; no semantic content changed. Project policy forbids `--no-verify`, so the workaround is to bring the harness files into compliance.
- **Files modified:** `.bg-shell/manifest.json`, `.gsd/runtime/write-gate-state.json` (untracked, not in any commit).
- **Commits:** none — files are untracked.

### Architectural deviations

None. D-57-01 / D-57-03 / HOOK-02 honored verbatim.

## Verification gate results

- `npm run check`: GREEN (exit 0).
- `grep -n "schemaVersion" extensions/pi-claude-marketplace/persistence/state-io.ts | grep -v '^//'`: shows `Type.Literal(1)` only — no widening smuggled in.
- `grep -n "resources.hooks\|resources\\.hooks" extensions/pi-claude-marketplace/persistence/migrate.ts`: shows the new default-fill arm at line 129.
- `grep -n "Type.Array(Type.String())" extensions/pi-claude-marketplace/persistence/state-io.ts`: shows the new `hooks` field on `PLUGIN_INSTALL_RECORD_SCHEMA.resources` alongside the existing four resource arrays.
- Forbidden tokens (`Phase 57`, `Plan 01`, `Wave 1`, `Pitfall N`) absent from the two modified `persistence/*.ts` files (verified via the plan's grep).

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/persistence/state-io.ts`: FOUND.
- `extensions/pi-claude-marketplace/persistence/migrate.ts`: FOUND.
- Commit `f955bc6` (Task 1 RED): FOUND.
- Commit `7827f0b` (Task 1 GREEN): FOUND.
- Commit `83d45a9` (Task 2 RED): FOUND.
- Commit `9d4c6f5` (Task 2 GREEN): FOUND.
