---
phase: 01-localized-type-model-command-context-spine
plan: 02
subsystem: notifications
tags: [typescript, command-context, notify, plugin-family, output-neutral, render-map]

# Dependency graph
requires:
  - phase: 01-01
    provides: CommandContext<Status,Msg> + RenderFn + Single/Plural aliases + notifyWithContext (shared/notify-context.ts); exported presentation vocabulary + MessageBase (shared/notify.ts); topic-grouped reason enums (shared/notify-reasons.ts)
provides:
  - Seven plugin-family command-local notification modules (install/uninstall/update/reinstall/enable/disable/list/info .messaging.ts) each exporting a CommandContext const with Messaging.label + a render map total over its OWN statuses + command-private reasons
  - All plugin-family standalone-cascade call sites rewired to notifyWithContext (the central renderPluginRow switch is no longer reached for plugin-family cascades)
  - notifyWithContext extended with an optional `kind` param so the disable verb threads the "disable-cascade" reload-hint kind through the spine (additive, byte-identical)
affects: [Plan 01-05 central renderPluginRow switch removal, Phase 2 reducer/collapse work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-command `.messaging.ts` sibling module: `as const` status tuple + `(typeof X)[number]` union + render map `{ [K in Status]: RenderFn<Extract<Msg,{status:K}>> }` + `as const satisfies CommandContext<...>` pin (D-04/D-10)"
    - "Verbatim arm-lift: each render-map arm reproduces the exact bytes of its central renderPluginRow switch arm and CALLS the shared vocabulary (ICON_*/joinTokens/renderScopeBracket/renderVersion/composeVersionArrow/composeReasons/pluginRow), never duplicating it (D-11)"
    - "Shared-orchestrator dual context: enable-disable.ts declares TWO contexts (ENABLE_CONTEXT/DISABLE_CONTEXT), each total over its own statuses; verb-branch keeps each notifyWithContext call concrete (non-union) so TS infers each context's own Status/Msg"
    - "Additive Single/Plural cardinality annotation on existing row variables (OUT-07/D-12) -- a 1-tuple IS an array at runtime, ladders unchanged"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts

key-decisions:
  - "Standalone (non-cascade) surfaces stay on legacy notify(): marketplace-not-added, the update/reinstall empty-targets `{ marketplaces: [] }` sentinel, and info's plugin-info / plugin-info-cascade envelopes route through the central dispatchInfoMessage / cascade path. Only PluginNotificationMessage CASCADE rows route through notifyWithContext."
  - "info's PLUGIN_INFO_CONTEXT is total over exactly `disabled` -- the only PluginNotificationMessage cascade row info emits (the recorded-but-disabled inventory blocks). The standalone PluginInfoRow surface (installed/available/unavailable/failed) is a SIBLING shape rendered centrally, not cascade-dispatchable."
  - "notifyWithContext gained an optional `kind?: 'cascade' | 'disable-cascade'` param so the disable verb preserves the UAT-03 reload-hint trigger; without it the disable-cascade kind would be dropped and the /reload trailer would vanish on fresh-disable rows (a rendered-output change)."

patterns-established:
  - "Adapter-then-migrate consumed: plugin-family commands now own their render maps; legacy notify() still serves un-migrated callers + standalone surfaces."

requirements-completed: [MOD-01, MOD-02, MOD-03, OUT-07]

# Metrics
duration: ~70min
completed: 2026-06-24
---

# Phase 1 Plan 02: Plugin-family command-local notification migration Summary

**The seven plugin-family commands (install, uninstall, update, reinstall, enable, disable, list, info) each own a co-located `.messaging.ts` module exporting a `CommandContext` (Messaging.label + render map total over its OWN statuses + command-private reasons); every plugin-family cascade call site threads `notifyWithContext`, dispatching per-row bodies through the command's render map -- all output byte-identical (114 catalog-uat fixtures + notify-v2 + notify-grammar-invariant + no-credential-leak green, verified after EACH command migration).**

## Performance

- **Duration:** ~70 min
- **Completed:** 2026-06-24
- **Tasks:** 3
- **Files modified:** 15 (8 modified, 7 created)

## Accomplishments
- Seven command-local `.messaging.ts` modules, each declaring its private `as const` status tuple, its row message union (a subset of the central plugin shapes), its command-private reasons, and a render map total over its own statuses with arm bodies lifted VERBATIM from the central `renderPluginRow` switch (MOD-01/MOD-03/D-10).
- All plugin-family cascade call sites rewired to `notifyWithContext(ctx, pi, <CMD>_CONTEXT, rows)` (MOD-02/D-02). The central `renderPluginRow` switch is no longer reached for any plugin-family cascade -- each command's catalog-uat run is now a full end-to-end validation of its own render map.
- Cardinality annotated via `Single<Row>` (install single-target failure, list catch path) / `Plural<Row>` (update/reinstall/list/info bulk cascades), additive typing only -- no `.length` ladder rewrites (OUT-07/D-12).
- `present` status preserved (no present->installed collapse); `disable-cascade` kind preserved (the UAT-03 reload-hint trigger).
- Soft-dep marker gating preserved exactly: only the `installed`/`updated`/`reinstalled` arms thread `dependencies.includes(...)` into `composeReasons`; every other arm passes `false`/`undefined`.

## Task Commits

1. **Migrate install + uninstall + update** -- `cb2da259` (feat)
2. **Migrate reinstall + enable/disable** -- `74005105` (feat)
3. **Migrate list + info** -- `595299f2` (feat)

## Files Created/Modified
- `install.messaging.ts` (created) -- INSTALL_CONTEXT (label "Plugin install"), statuses installed/failed/unavailable, render map, private reason `orphan rewake`.
- `uninstall.messaging.ts` (created) -- UNINSTALL_CONTEXT (label "Plugin uninstall"), statuses uninstalled/failed, private reason `not installed`.
- `update.messaging.ts` (created) -- UPDATE_CONTEXT (label "Plugin update"), statuses updated/skipped/failed.
- `reinstall.messaging.ts` (created) -- REINSTALL_CONTEXT (label "Plugin reinstall"), statuses reinstalled/skipped/failed/manual recovery.
- `enable-disable.messaging.ts` (created) -- TWO contexts: ENABLE_CONTEXT (label "Plugin enable", statuses installed/skipped/failed) and DISABLE_CONTEXT (label "Plugin disable", statuses disabled/skipped/failed), each with its own total render map.
- `list.messaging.ts` (created) -- LIST_CONTEXT (label "Plugin list"), statuses present/available/unavailable/upgradable/disabled/failed (`present` preserved).
- `info.messaging.ts` (created) -- PLUGIN_INFO_CONTEXT (label "Plugin info"), total over `disabled` only (the sole cascade-dispatched row; standalone info surface stays central).
- `*.ts` orchestrators (modified) -- call-site rewires + Single/Plural cardinality annotations.
- `shared/notify-context.ts` (modified) -- `notifyWithContext` gained an optional `kind?: "cascade" | "disable-cascade"` param (additive; flows into the CascadeNotificationMessage the central seam reads).

## Decisions Made
- **Standalone routing handled centrally (research Open Question 3):** `marketplace-not-added`, the update/reinstall empty-targets `{ marketplaces: [] }` sentinel, and info's `plugin-info` / `plugin-info-cascade` envelopes are NOT cascades of `PluginNotificationMessage` rows; they stay on legacy `notify()` / `dispatchInfoMessage`. Only cascade plugin rows route through `notifyWithContext`. This is the planned boundary -- info's CommandContext owns its EMBEDDED/cascade row render map (the `disabled` inventory blocks), while the standalone envelope routing stays central.
- **info's CommandContext is total over `disabled` only:** the standalone `PluginInfoRow` surface (statuses installed/available/unavailable/failed) is a SIBLING shape with its own central renderer (`pluginInfoStatusGlyph` + component-listing composer), not a `PluginNotificationMessage` and not dispatchable through the cascade seam. The only cascade `PluginNotificationMessage` row info emits is the recorded-but-disabled inventory block, so `PLUGIN_INFO_CONTEXT.render` is total over exactly `disabled`.
- **disable-cascade kind threaded through an additive spine param (Rule 3):** the spine's `notifyWithContext` originally hardcoded `{ marketplaces: rows }`, which would have dropped the `disable-cascade` kind and silently removed the UAT-03 `/reload to pick up changes` trailer on fresh-disable rows -- a rendered-output change. Fixed by adding an optional `kind` param (additive, default plain cascade); the disable verb threads `"disable-cascade"`. Verified byte-identical by notify-v2's UAT-03 tests and the enable-disable orchestrator test.
- **Shared-orchestrator dual-context concrete branch:** enable/disable share one orchestrator. For the verb-shared `failed`-row emit paths a small `emitEnableDisableFailedRow` helper branches on `enable` and issues a concrete (non-union) `notifyWithContext` call per arm -- a `enable ? ENABLE_CONTEXT : DISABLE_CONTEXT` union does NOT typecheck because TS cannot unify the two distinct `CommandContext<Status,Msg>` instantiations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended notifyWithContext with an optional `kind` param**
- **Found during:** Task 2 (disable verb migration)
- **Issue:** The 01-01 spine `notifyWithContext` hardcoded `{ marketplaces: rows }` with no `kind`, so threading the disable verb through it would drop the `disable-cascade` kind and suppress the UAT-03 `/reload` trailer on fresh-disable rows -- a rendered-output regression.
- **Fix:** Added an optional `kind?: "cascade" | "disable-cascade"` parameter that flows verbatim into the `CascadeNotificationMessage` the central `emitContextCascade` seam reads. Additive and byte-identical for all other callers (default plain cascade).
- **Files modified:** extensions/pi-claude-marketplace/shared/notify-context.ts
- **Commit:** 74005105

No other deviations. The `marketplace-not-added`, empty-targets, and standalone info-envelope surfaces were left on the legacy path exactly as the plan's action notes permitted, and this is documented above per the plan's output requirement.

## Soft-dep gating note
Preserved exactly per the do-not-regress rule: only `installed` (install/enable), `updated` (update), `reinstalled` (reinstall), and the list `present` arm pass `p.dependencies.includes("agents"/"mcp")` into `composeReasons`; every other arm (uninstalled, disabled, available, unavailable, upgradable, skipped, failed, manual recovery) passes `false`/`undefined`. catalog-uat is the proof -- no soft-dep marker appears on a non-dep-bearing row.

## present / disable-cascade preservation
- `present` status: list.messaging.ts declares a `present` arm rendering byte-identically to `installed` (no present->installed collapse this phase). Confirmed by `grep -c "present:" list.messaging.ts` == 1 and catalog-uat green.
- `disable-cascade` kind: preserved via the additive `notifyWithContext` `kind` param; the disable verb threads `"disable-cascade"`. Confirmed by notify-v2's two UAT-03 reload-hint tests + the enable-disable orchestrator test (all green).

## Issues Encountered
- **Worktree trufflehog hook structural failure:** the pre-commit `trufflehog` hook fails in a linked worktree (`.git/index: not a directory`) -- the documented worktree limitation, not a secret finding. Each commit's staged files were scanned independently with `trufflehog filesystem` (0 verified/unverified secrets) before committing with the sanctioned `SKIP=trufflehog` prefix.
- **enable-disable union-context typecheck (TS2345):** a `enable ? ENABLE_CONTEXT : DISABLE_CONTEXT` argument to `notifyWithContext` does not typecheck (TS cannot unify the two distinct `CommandContext` instantiations -- it demands the intersection of both status sets). Resolved by branching to concrete per-verb calls (`emitEnableDisableFailedRow` + the dispatchOutcome verb branch).

## Next Phase Readiness
- All 7 plugin-family commands own their notification vocabulary locally; the central `renderPluginRow` switch is dead code for plugin-family cascades (its removal is Plan 01-05, after the marketplace/import/reconcile families migrate in parallel plans 01-03/01-04).
- `npm run check` green; catalog-uat (114 fixtures) + notify-v2 + notify-grammar-invariant + no-credential-leak byte-identical/green; `git diff docs/output-catalog.md` empty.

## Self-Check: PASSED

- Created files present: 7 `.messaging.ts` modules + this SUMMARY.
- Task commits present: `cb2da259`, `74005105`, `595299f2`.
- `npm run check` exit 0; byte gates green and byte-identical; `git diff docs/output-catalog.md` empty.

---
*Phase: 01-localized-type-model-command-context-spine*
*Completed: 2026-06-24*
