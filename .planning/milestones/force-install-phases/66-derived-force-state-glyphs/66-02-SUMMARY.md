---
phase: 66-derived-force-state-glyphs
plan: 02
subsystem: orchestrators
tags: [list, deriver, force-installed, force-upgradable, no-network, resolveStrict, compatibility]

# Dependency graph
requires:
  - phase: 66-01
    provides: the force-installed/force-upgradable PluginStatus tokens, glyphs, message arms, and assertNever-forced render/projection sites the deriver emits into
  - phase: 64-resolver-three-way-state
    provides: resolveStrict three-way state + narrowUnsupportedKinds render helper
provides:
  - the single shared force-state deriver in installedRowMessage (force-installed FIRST, then force-upgradable, then upgradable, then installed)
  - read-only force-installed derivation from the persisted record.compatibility.unsupported (no flag, no migration, no state write)
  - no-network candidate resolveStrict split of the upgradable branch into upgradable vs force-upgradable
  - force rows in the list-surface LIST_STATUSES / ListMsg / LIST_RENDER total maps and the orphan-fold carry-over set
affects: [66-03-info-success, 66-04-reconcile-pending, 67-list-filters]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Derive realized status as a pure function of (persisted compatibility record, no-network candidate resolve) with the degraded-record check ordered FIRST (A4)"
    - "Extend a command-local total render map (LIST_STATUSES/ListMsg/LIST_RENDER) in lockstep with a new orchestrator-emitted status"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - tests/orchestrators/plugin/list.test.ts

key-decisions:
  - "force-installed is read-only from record.compatibility.unsupported (D-66-01 / A1); the candidate resolveStrict is used ONLY to split upgradable vs force-upgradable, never to decide force-INSTALLED"
  - "force-installed checked BEFORE the upgradable branch so a degraded record never mis-splits into force-upgradable (A4 ordering, load-bearing)"
  - "the --installed shouldShow filter is left unchanged (force rows RENDER, not FILTER); the filter spanning is LIST-01 / Phase 67"

patterns-established:
  - "Pattern: a new orchestrator-emitted status must extend BOTH the command-local total render map (list.messaging.ts) and the central assertNever switch, or the satisfies site fails to compile"

requirements-completed: [FSTAT-01, FSTAT-03, FSTAT-04, FSTAT-05]

# Metrics
duration: ~25min
completed: 2026-06-27
---

# Phase 66 Plan 02: Force-State List Deriver Summary

**Implemented the single shared force-state deriver in `installedRowMessage`: force-installed is read live (read-only) from the persisted `record.compatibility.unsupported` and checked FIRST, then the clean-record upgradable branch splits on a no-network `resolveStrict` of the candidate manifest entry (unsupported -> force-upgradable, else upgradable), so FSTAT-03 auto-return falls out for free with no persisted flag, no migration, and no state write.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 (one source commit, one test commit)
- **Files modified:** 3

## Accomplishments

- Made `installedRowMessage` `async` and threaded `marketplaceRoot` so the deriver can call the no-network `resolveStrict(candidate, { marketplaceRoot })`.
- Inserted, BEFORE the existing `upgradable` branch, a force-installed derivation that reads `record.compatibility.unsupported` (force-installed when non-empty) per D-66-01 / FSTAT-01 — a pure read of the existing persisted record, no new field, no state write. Reasons come from the shared `narrowUnsupportedKinds` render helper (D-64-02) for cross-surface marker parity.
- Split the clean-record `upgradable` branch: an `unsupported` candidate resolve yields `force-upgradable`; otherwise the unchanged `upgradable` row (D-66-02 / FSTAT-04 / FSTAT-05). The candidate resolve is reached only for a clean record (force-installed returns first), so it never re-resolves the historical installed version.
- Extended the local `PluginRenderStatus` union with both force states; left the `--installed` `shouldShow` filter unchanged (force rows RENDER this phase; the filter spanning is LIST-01 / Phase 67).
- Added a deriver matrix (6 cases) proving purity (no state write), A4 ordering (force-installed wins over force-upgradable), the no-network candidate split, auto-return-to-installed, and that the force-installed reasons are the `narrowUnsupportedKinds` markers.

## Task Commits

1. **Task 1 — deriver implementation:** `4ea75083` (feat)
2. **Task 2 — deriver matrix:** `0e6eda1d` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — async `installedRowMessage` deriver (force-installed FIRST, then force-upgradable split via no-network `resolveStrict`); `marketplaceRoot` threaded through the `enumerateMarketplacePlugins` call; `PluginRenderStatus` widened; force rows added to the orphan-fold carry-over filter
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` — `LIST_STATUSES` / `ListMsg` / `LIST_RENDER` total maps extended with the two force rows (render arm bodies lifted verbatim from the central `renderPluginRow` switch)
- `tests/orchestrators/plugin/list.test.ts` — six deriver-matrix cases; `seedMarketplace` helper extended with `installed.unsupported` to seed the persisted compatibility signal

## Decisions Made

None beyond the LOCKED D-66-01..05 and the RESEARCH assumptions A1 (force-installed from `compatibility`) and A4 (force-installed checked first). All honored as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended the command-local list render map (list.messaging.ts) not enumerated in `files_modified`**
- **Found during:** Task 1 (typecheck)
- **Issue:** The list surface renders through a command-local total map (`LIST_STATUSES` / `ListMsg` / `LIST_RENDER`) pinned by `as const satisfies CommandContext<...>`. 66-01 added the force states only to the CENTRAL `renderPluginRow` switch, not to this command-local map. Returning a force-state `ListMsg` from the deriver would not typecheck (the `ListMsg` union excluded both types) and would have no render arm (`satisfies` TS2741).
- **Fix:** Added `force-installed` / `force-upgradable` to `LIST_STATUSES`, the `ListMsg` union, and `LIST_RENDER` (arm bodies lifted verbatim from the central switch — `pluginRow(ICON_FORCE_INSTALLED, ...)` and `pluginRow(ICON_INSTALLED, ...)`).
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
- **Verification:** `npm run typecheck` green.
- **Committed in:** 4ea75083

**2. [Rule 1 - Bug] Added force rows to the orphan-fold carry-over filter**
- **Found during:** Task 1 (implementation review)
- **Issue:** The cross-scope orphan-fold carry-over filter selects which other-scope rows fold under a user-scope marketplace header, restricted to `installed`/`upgradable`/`disabled`. A force-installed/force-upgradable plugin IS a recorded-installed plugin (same rationale as the `disabled` inclusion); now that my change makes force rows reachable, omitting them would both hide the folded row AND let the user-side enumeration re-emit the plugin as a duplicate `(available)`.
- **Fix:** Added `force-installed` / `force-upgradable` to the carry-over `filter` predicate.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
- **Verification:** existing fold tests + full `npm run check` green.
- **Committed in:** 4ea75083

**3. [Rule 1 - Bug] Removed a redundant `manifestEntry !== undefined` guard flagged by ESLint**
- **Found during:** Task 1 (lint)
- **Issue:** Inside `if (upgradable)`, TypeScript's const-alias control-flow analysis already narrows `manifestEntry` to defined (the `upgradable` const's `?.version !== undefined` conjunct), so the extra guard was `no-unnecessary-condition` (types have no overlap).
- **Fix:** Dropped the guard; call `resolveStrict(manifestEntry, ...)` directly.
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
- **Verification:** `npm run lint` green.
- **Committed in:** 4ea75083

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three are mechanical correctness fixes the RESEARCH anticipated (compile-caught missing render sites; the fold-filter parity the `disabled` precedent already documented). No scope creep, no architectural change.

## Issues Encountered

- `npm run check` ran fully green this session: 2389 unit tests pass (0 fail, 2 pre-existing skips), integration 16/16. No flaky temp-teardown races appeared on this run.

## Known Stubs

None. The deriver is wired end-to-end: list rows now RENDER force-installed/force-upgradable from real persisted + resolved state. The remaining force surfaces (info/success, reconcile pending) are 66-03/66-04 by design.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

- Created file present: `.planning/phases/66-derived-force-state-glyphs/66-02-SUMMARY.md`
- Modified files present: `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts`, `tests/orchestrators/plugin/list.test.ts`
- Commits present: `4ea75083` (feat), `0e6eda1d` (test)

---
*Phase: 66-derived-force-state-glyphs*
*Completed: 2026-06-27*
