---
phase: 66-derived-force-state-glyphs
plan: 03
subsystem: orchestrators
tags: [info, install, update, force-installed, narrowUnsupportedKinds, success-row, cascade]

# Dependency graph
requires:
  - phase: 66-01
    provides: the force-installed PluginStatus token, ◉ glyph, PluginForceInstalledMessage arm, TRANSITION_STATUS_LIST membership, and the central renderPluginRow force-installed arm
  - phase: 64-resolver-three-way-state
    provides: resolveStrict three-way state + narrowUnsupportedKinds render helper
provides:
  - info reports (force-installed) with the dropped-component detail for an installed plugin re-resolving unsupported (D-64-05 keeps unavailable/installable on installed)
  - install/update emit force-installed success cascade rows (info severity, needsReload) when the live resolved state is unsupported, installed/updated otherwise
  - the force-installed arm threaded through the install/update command-local render maps (INSTALL_STATUSES/InstallMsg/INSTALL_RENDER, UPDATE_STATUSES/UpdateMsg/UPDATE_RENDER) and the PluginUpdateUpdatedOutcome
affects: [66-04-reconcile-pending, 69-force-path-severity, 70-doc]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Branch a success/detail row status on the live resolved.state (unsupported -> force-installed, else installed/updated) sourced from the same derived signal as the list deriver (D-66-01 single-deriver consistency)"
    - "Extend a command-local total render map (INSTALL_RENDER/UPDATE_RENDER) in lockstep with a new orchestrator-emitted status, arm body lifted verbatim from the central switch"
    - "Carry the candidate unsupported-kind signal on the outcome record (PluginUpdateUpdatedOutcome.unsupportedKinds) so the cascade mapper, not the producer, owns the row-status flip"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/edge/handlers/plugin/update.test.ts

key-decisions:
  - "info: only the unsupported arm maps to force-installed; unavailable and installable keep (installed) (D-64-05); info never emits force-upgradable (list-inventory-only)"
  - "install/update force-installed rows carry narrowUnsupportedKinds markers as reasons (cross-surface parity with the list deriver), severity info + needsReload true (force-installed JOINS TRANSITION_STATUS_LIST)"
  - "update flips the row at the cascade mapper via a new optional PluginUpdateUpdatedOutcome.unsupportedKinds field; the force-installed row renders single-version (toVersion), no v<from> -> v<to> arrow (PluginForceInstalledMessage has no from/to)"
  - "no Warning: summary emitted in any force path (FORCE-04 preserved; all force-installed rows stamp info severity)"

patterns-established:
  - "Pattern: a new orchestrator-emitted status must extend BOTH the command-local total render map and the central assertNever switch, or the satisfies site fails to compile"

requirements-completed: [FSTAT-07]

# Metrics
duration: ~45min
completed: 2026-06-27
---

# Phase 66 Plan 03: Force-State Detail & Success Surfaces Summary

**Threaded the derived force signal into the detail and success surfaces: `info` reports `(force-installed)` with the `narrowUnsupportedKinds` dropped-component detail for an installed plugin re-resolving `unsupported`, and the `install --force` / `update --force` SUCCESS cascade row reads `(force-installed)` (info severity, reload-hint via TRANSITION_STATUS_LIST membership) when the live resolved state is `unsupported`, falling back to `(installed)` / `(updated)` for a fully-supported operation (FSTAT-03 -- no lingering force state).**

## Performance

- **Duration:** ~45 min
- **Tasks:** 2 (TDD: RED + GREEN per task)
- **Files modified:** 10

## Accomplishments

- **Task 1 (info):** Branched the `info` installed-row builder's non-installable arm on `resolved.state` -- an `unsupported` re-resolve of a recorded-installed plugin now emits `status: "force-installed"` with the dropped-component detail (reusing the shared `narrowUnsupportedKinds` marker helper, not a new kind->reason map), while `unavailable` and `installable` keep `(installed)` (D-64-05). `info` never emits `force-upgradable` (list-inventory-only).
- **Task 2 (install/update success):** Branched the `install` success row on `installCtx.resolved.state` (unsupported -> force-installed row carrying `narrowUnsupportedKinds` reasons + orphan-rewake reasons, info severity, needsReload true; else installed). Mirrored in `update` by carrying the candidate unsupported kinds on `PluginUpdateUpdatedOutcome.unsupportedKinds` and flipping the row to force-installed inside `outcomeToCascadePluginMessage` (else the unchanged `(updated)` row). Extended both command-local render maps (`INSTALL_*`, `UPDATE_*`) with the force-installed arm, lifted verbatim from the central `renderPluginRow` switch.
- Preserved FORCE-04: every force-installed row stamps `info` severity, so no `Warning:` summary renders in any force path.

## Task Commits

1. **Task 1 -- info RED (failing test):** `b56e5bdb` (test)
2. **Task 1 -- info GREEN (implementation):** `e7f17563` (feat)
3. **Task 2 -- install/update RED (failing tests):** `cd38e496` (test)
4. **Task 2 -- install/update GREEN (implementation):** `486465d4` (feat)
5. **Task 2 -- edge shim row token update:** `11e41a7c` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` -- non-installable arm branches status on `resolved.state` (unsupported -> force-installed)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` -- success row branches on `installCtx.resolved.state`; `PluginInstalledMessage` type import dropped (now annotated `InstallMsg`)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` -- `force-installed` added to `INSTALL_STATUSES` / `InstallMsg` / `INSTALL_RENDER`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` -- `unsupportedKinds` set on the updated outcome; `outcomeToCascadePluginMessage` flips to force-installed; `narrowUnsupportedKinds` imported
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts` -- `force-installed` added to `UPDATE_STATUSES` / `UpdateMsg` / `UPDATE_RENDER`
- `extensions/pi-claude-marketplace/orchestrators/types.ts` -- optional `unsupportedKinds` on `PluginUpdateUpdatedOutcome`
- `tests/orchestrators/plugin/info.test.ts` -- force-installed info row case (lspServers -> `{lsp}`)
- `tests/orchestrators/plugin/install.test.ts` -- force-installed success-row byte assertion (experimental -> `{unsupported source}`)
- `tests/orchestrators/plugin/update.test.ts` -- existing FORCE-02 row assertion updated from `(updated)` to byte-exact `(force-installed)`
- `tests/edge/handlers/plugin/update.test.ts` -- shim force-degrade row token updated from `(updated)` to `(force-installed)`

## Decisions Made

None beyond the LOCKED D-66-01..05 and RESEARCH assumptions A1/A4. Honored exactly: force-installed JOINS TRANSITION_STATUS_LIST (stamps needsReload), force-upgradable stays list-only (info/success never emit it), only `unsupported` maps to force-installed (D-64-05), dropped-component detail routes through the shared `narrowUnsupportedKinds` helper.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing force-degrade assertions that expected the pre-66-03 `(updated)` token**
- **Found during:** Task 2 (full `npm run check` + install/update suites)
- **Issue:** Two pre-existing Phase 65 tests asserted the force-degraded update success row reads `(updated)`: `tests/orchestrators/plugin/update.test.ts` FORCE-02 and `tests/edge/handlers/plugin/update.test.ts` shim. D-66-04 / FSTAT-07 changes that row to `(force-installed)`, so the old assertions are now wrong by design.
- **Fix:** Updated FORCE-02 to a byte-exact `(force-installed) {unsupported source}` assertion and the edge shim to match `/\(force-installed\)/`; both intents (force was threaded; the candidate degraded) are preserved.
- **Files modified:** tests/orchestrators/plugin/update.test.ts, tests/edge/handlers/plugin/update.test.ts
- **Verification:** `npm run check` green.
- **Committed in:** 486465d4 (FORCE-02), 11e41a7c (edge shim)

**2. [Rule 3 - Blocking] Extended the install/update command-local render maps + PluginUpdateUpdatedOutcome not enumerated in `files_modified`**
- **Found during:** Task 2 (typecheck)
- **Issue:** install/update render through command-local total maps pinned by `as const satisfies CommandContext<...>`. Returning a force-installed row would not typecheck (the `InstallMsg`/`UpdateMsg` unions excluded it) and would have no render arm (`satisfies` TS2741). The update flip also needs a place to carry the candidate signal from the producer to the cascade mapper.
- **Fix:** Added `force-installed` to `INSTALL_STATUSES`/`InstallMsg`/`INSTALL_RENDER`, `UPDATE_STATUSES`/`UpdateMsg`/`UPDATE_RENDER` (arm bodies lifted verbatim from the central switch), and an optional `unsupportedKinds` field on `PluginUpdateUpdatedOutcome`.
- **Files modified:** install.messaging.ts, update.messaging.ts, orchestrators/types.ts
- **Verification:** `npm run typecheck` + `npm run check` green.
- **Committed in:** 486465d4

**3. [Rule 1 - Bug] Dropped the now-unused `PluginInstalledMessage` type import in install.ts**
- **Found during:** Task 2 (lint)
- **Issue:** Re-annotating the success row local from `PluginInstalledMessage` to `InstallMsg` left the named import unused (`no-unused-vars`).
- **Fix:** Removed `PluginInstalledMessage` from the `shared/notify.ts` type import (still referenced only in prose comments).
- **Files modified:** extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
- **Verification:** `npm run lint` green.
- **Committed in:** 486465d4

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs). All mechanical correctness fixes the RESEARCH anticipated (compile-caught missing render sites; the Phase 65 catalog assertions that encoded the pre-force-display `(updated)` token). No scope creep, no architectural change.

## Issues Encountered

- `npm run check` ran fully green this session: 2391 unit tests pass (0 fail, 2 pre-existing skips), integration 16/16. No flaky temp-teardown races appeared on this run.

## Known Stubs

None. The detail/success surfaces are wired end-to-end: `info` and the install/update success cascade now report `(force-installed)` from real resolved state. The remaining force surface (reconcile pending `will force install`) is 66-04 by design.

## User Setup Required

None -- no external service configuration required.

## Self-Check: PASSED

- Created file present: `.planning/phases/66-derived-force-state-glyphs/66-03-SUMMARY.md`
- Modified files present: info.ts, install.ts, install.messaging.ts, update.ts, update.messaging.ts, orchestrators/types.ts (all confirmed on disk)
- Commits present: `b56e5bdb`, `e7f17563`, `cd38e496`, `486465d4`, `11e41a7c`

---
*Phase: 66-derived-force-state-glyphs*
*Completed: 2026-06-27*
