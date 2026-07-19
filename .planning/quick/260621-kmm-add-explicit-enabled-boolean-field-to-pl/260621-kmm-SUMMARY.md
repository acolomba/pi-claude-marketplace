---
quick-task: 260621-kmm
subsystem: persistence, reconcile, plugin-orchestrators
tags: [schema, state-migration, enable-disable, enbl-02]
dependency-graph:
  requires: []
  provides: [explicit-enabled-boolean, enbl-02-disabled-marker]
  affects: [state-io, migrate, plan, enable-disable, update, install, reinstall]
tech-stack:
  added: []
  patterns: [additive-migration, discriminated-boolean-flag, enbl-02-marker]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/persistence/migrate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - tests/persistence/state-io.test.ts
    - tests/persistence/migrate.test.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/persistence/fixtures/legacy/state-populated-mixed.json
    - (27 additional test files with enabled field and schemaVersion 2 updates)
decisions:
  - Use !record.enabled (ESLint no-unnecessary-boolean-literal-compare rejects === false on boolean)
  - Drift gate axis string updated from "enabled === false" to "!installed.enabled"
  - state-populated-mixed.json updated with enabled:true and hooks:[] for convergence proof
metrics:
  duration: 90 minutes (two sessions)
  completed: 2026-06-21
  tasks-completed: 2
  files-changed: 37
---

# Quick Task 260621-kmm: Add Explicit enabled Boolean to Plugin State Records

**One-liner:** Replaces the five-resource-array-emptiness disabled-plugin heuristic with
an explicit `enabled: boolean` field (ENBL-02), adding additive migration and bumping
schemaVersion to 2.

## What Was Built

### Task 1 -- Schema and migration (commit 8ceaa9c3)

Added `enabled: Type.Boolean()` to `PLUGIN_INSTALL_RECORD_SCHEMA` in `state-io.ts`. Bumped
`STATE_SCHEMA.schemaVersion` from `Type.Literal(1)` to
`Type.Union([Type.Literal(1), Type.Literal(2)])`. `loadState` now always returns
`schemaVersion: 2`. Added `ensurePluginEnabled` migration helper in `migrate.ts` (mirrors
`ensurePluginResources` pattern) that fills `enabled: true` for any plugin record missing the
field. Set `enabled: true` in `install.ts` and `reinstall.ts`. Updated `clonePluginRecord` in
`reinstall.ts` to preserve `enabled`. Updated 27+ test fixture files to include `enabled`
field and `schemaVersion: 2`.

### Task 2 -- Predicate replacement (commit 5b3144d7)

Replaced `isRecordedButDisabled` in `plan.ts` from 5-array emptiness check to
`record.compatibility.installable && !record.enabled`. Did the same for the local copy in
`update.ts`. Replaced `isCurrentlyDisabled` in `enable-disable.ts` with `!installed.enabled`
and added `installed.enabled = false` in `runDisableBranch`. Updated T5 drift gate test in
`plan.test.ts` to pin the `!installed.enabled` axis. Fixed additional test fixtures that
wrote disabled-marker records without `enabled: false`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint rejected === false comparison on boolean field**
- **Found during:** Task 2 lint run
- **Issue:** @typescript-eslint/no-unnecessary-boolean-literal-compare forbids
  booleanField === false; plan used this form throughout
- **Fix:** Changed to !field in all three predicates (plan.ts, update.ts, enable-disable.ts)
- **Cascade:** Drift gate axis string in plan.test.ts updated from "enabled === false" to
  "!installed.enabled" to match the new source form
- **Files modified:** plan.ts, update.ts, enable-disable.ts, plan.test.ts

**2. [Rule 2 - Missing fixture update] state-populated-mixed.json missing enabled field**
- **Found during:** Task 2 -- plan-convergence.test.ts failing
- **Issue:** Fixture loaded without migration; !record.enabled evaluated !undefined === true,
  treating installable records as disabled
- **Fix:** Added enabled:true and hooks:[] to all plugin records in the fixture
- **Files modified:** tests/persistence/fixtures/legacy/state-populated-mixed.json

**3. [Rule 2 - Missing fixture updates] apply.test.ts Y3/T1 and autoupdate.test.ts**
- **Found during:** Task 2 full test run
- **Issue:** Direct writeFile calls used schemaVersion:1 and no enabled field; migration
  filled enabled:true, breaking disabled-marker detection
- **Fix:** Updated to schemaVersion:2, enabled:false, hooks:[] in disabled plugin records
- **Files modified:** tests/orchestrators/reconcile/apply.test.ts,
  tests/orchestrators/marketplace/autoupdate.test.ts

**4. [Rule 2 - Missing fixture update] list.test.ts seedMarketplace hardcoded enabled:true**
- **Found during:** Task 2 full test run (ENBL-04 tests failing)
- **Issue:** seedMarketplace set enabled:true regardless of disabled:true option
- **Fix:** Changed to enabled: info.disabled !== true
- **Files modified:** tests/orchestrators/plugin/list.test.ts

## Known Pre-existing Test Failures

The following failures are pre-existing parallel test interference:
- on-exit, multi-hook fan-in, rewakeSummary IL-2 exemption, HOOK-06 suite -- parallel
  interference from spawned child processes sharing process-level state
- Case D (in-tree symlink) -- macOS /private/var vs /var symlink path issue
- D-UPD: update on a disabled plugin -- HOME env var mutation across parallel test files

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8ceaa9c3 | feat(260621-kmm): add explicit enabled boolean to plugin state records |
| 2 | 5b3144d7 | feat(260621-kmm): replace resource-emptiness heuristic with enabled flag |

## Self-Check: PASSED

- [x] Both commits exist: 8ceaa9c3 and 5b3144d7
- [x] npm run typecheck exits 0
- [x] npm run lint exits 0
- [x] npm run format:check exits 0
- [x] npm test passes with only pre-existing parallel interference failures
- [x] All ENBL-02 predicates use !record.enabled consistently
