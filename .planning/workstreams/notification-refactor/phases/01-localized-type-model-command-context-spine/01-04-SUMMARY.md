---
phase: 01-localized-type-model-command-context-spine
plan: 04
subsystem: notifications
tags: [typescript, command-context, notify, mixed-subject-cascade, reconcile, import, output-neutral]

# Dependency graph
requires:
  - phase: 01-01
    provides: CommandContext spine + notifyWithContext adapter + emitContextCascade seam + exported shared vocabulary + topic-grouped reasons
provides:
  - IMPORT_CONTEXT (label "Import") + import status set (installed/skipped/failed/unavailable) + render map total over it (import/execute.messaging.ts)
  - PENDING_CONTEXT (label "Reconcile pending") + RECONCILE_APPLIED_CONTEXT (label "Reconcile") + render maps total over the will-*/realized-transition + failed statuses (reconcile/reconcile.messaging.ts)
  - emitReconcileAppliedContextCascade seam (notify.ts) + notifyReconcileAppliedWithContext spine adapter (notify-context.ts) -- routes the reconcile-applied-cascade standalone envelope's per-row body through a command render map while keeping its content-derived severity central
affects: [Plan 01-05 central-switch removal -- all mixed-subject cascade producers now route their own rows through command-local render maps]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mixed-subject cascade migration: the cascade producer's render map is total over the union of per-PLUGIN-ROW statuses it emits; marketplace header + cause-chain + severity stay central (D-10/D-11)"
    - "Standalone-envelope parameterized seam: emitReconcileAppliedContextCascade mirrors emitContextCascade but preserves the reconcile-applied-cascade kind so its content-derived severity is unchanged"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts

key-decisions:
  - "Render maps render per-PLUGIN-ROW bodies only; marketplace-level statuses (added/updated/will add/will remove for headers) stay rendered by the central renderMpHeader seam (the cascade body the spine threads). The import status union the plan listed (added/installed/updated/skipped/unavailable/failed) splits into marketplace-header statuses (added/updated/failed -> central) and plugin-row statuses (installed/skipped/failed/unavailable -> import render map)."
  - "The reconcile-applied-cascade is a STANDALONE-kind envelope (kind: reconcile-applied-cascade), not a plain CascadeNotificationMessage; its severity is content-derived through a distinct dispatchInfoMessage arm and it appends NO reload-hint. Flattening it to a plain cascade would change severity + reload-hint bytes, so a dedicated parameterized seam (emitReconcileAppliedContextCascade) preserves the envelope while dispatching per-row bodies through RECONCILE_APPLIED_CONTEXT.render."
  - "PENDING_CONTEXT and RECONCILE_APPLIED_CONTEXT are kept as two distinct contexts (not one merged map) because their status sets differ: pending emits pending-tense rows (will install/uninstall/enable/disable + failed) while applied emits realized rows (installed/uninstalled/disabled + failed). The shared `failed` arm + shared central vocabulary keep the duplication to the arm-table only."

patterns-established:
  - "Mixed-subject cascade producer migration: lift the per-plugin-row switch arms verbatim into a command render map, keep marketplace header + trailers central, thread the cascade rows through a context adapter with Plural cardinality."
  - "Standalone-envelope parameterized seam for a content-derived-severity message kind."

requirements-completed: [MOD-01, MOD-02, MOD-03, OUT-07]

# Metrics
duration: ~25min
completed: 2026-06-24
---

# Phase 1 Plan 04: Mixed-subject cascade producers (import + reconcile) Summary

**Migrated the two mixed-subject cascade producers -- the `import` command and the load-time `reconcile` cascade (pending diff + applied cascade) -- to the command-local notification model: each owns a `CommandContext` (Messaging.label + a render map total over the per-plugin-row statuses it emits), with all rows dispatched through those maps instead of the central `renderPluginRow` switch, output byte-identical (catalog-uat + notify-v2 + notify-grammar-invariant + reconcile-planner-purity green).**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-24
- **Tasks:** 2
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- `IMPORT_CONTEXT` (label `"Import"`) co-locates import's plugin-row status union (`installed` / `skipped` / `failed` / `unavailable`) and a render map total over it; `execute.ts` threads `notifyWithContext` with `Plural` cardinality.
- `PENDING_CONTEXT` (label `"Reconcile pending"`) and `RECONCILE_APPLIED_CONTEXT` (label `"Reconcile"`) co-locate the pending-tense rows (`will install` / `will uninstall` / `will enable` / `will disable` + `failed`) and the realized transition rows (`installed` / `uninstalled` / `disabled` + `failed`), each with a render map total over its set.
- Added `emitReconcileAppliedContextCascade` (notify.ts) + `notifyReconcileAppliedWithContext` (notify-context.ts spine adapter) so the load-time applied cascade's per-row bytes come from the reconcile render map while its content-derived severity + standalone-envelope behavior stay central and byte-identical.
- All per-plugin-row switch arm bodies were lifted verbatim; soft-dep marker gating stays confined to the `installed` arm (the only arm reading `dependencies`); every other arm passes `false`/`false`.

## Reconcile routing boundary (per plan output spec)

Exactly which row-building paths now thread the reconcile render map vs. stay central:

| Surface | Envelope | Per-row rendering | Header / severity / summary |
|---------|----------|-------------------|------------------------------|
| `pending` cascade (`pending.ts:203`) | plain `CascadeNotificationMessage` | `PENDING_CONTEXT.render` via `notifyWithContext` -> `emitContextCascade` | central (`renderMpHeader`, cascade severity, reload-hint ladder) |
| `pending` empty advisory (`pending.ts:183`) | `reconcile-pending-empty` standalone | **none** -- hard-coded advisory line, no row surface | central `dispatchInfoMessage` (unchanged) |
| applied cascade (`apply.ts:856`) | `reconcile-applied-cascade` standalone | `RECONCILE_APPLIED_CONTEXT.render` via `notifyReconcileAppliedWithContext` -> `emitReconcileAppliedContextCascade` | central (`renderMpHeader`, content-derived `reconcileAppliedSeverity` via `emitWithSummary`, NO reload-hint) |
| post-cascade hygiene warnings (`apply.ts` `notifyDiagnostic`) | diagnostic channel | n/a (free-form lines) | central `notifyDiagnostic` (unchanged) |

`reconcile/notify.ts` and `reconcile/apply-outcomes.ts` remain pure plan/outcome-to-row projections (they never call `ctx.ui.notify`); they were not edited because the emission rewiring lives entirely in `pending.ts` and `apply.ts`. **No producer's own plugin rows still render via the central `renderPluginRow` switch** -- import and both reconcile surfaces dispatch through their command-local render maps, giving Plan 01-05 a clean baseline. (The central `renderPluginRow` / `renderMpHeader` switches still serve the not-yet-removed marketplace HEADER rendering and any un-migrated callers; per-plugin-ROW dispatch for these producers is now fully localized.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added a parameterized seam for the standalone applied-cascade envelope**
- **Found during:** Task 2
- **Issue:** The spine (01-01) provides `emitContextCascade` only for plain `CascadeNotificationMessage`. The load-time applied cascade is a `ReconcileAppliedCascadeMessage` standalone-kind envelope whose severity is content-derived through a distinct `dispatchInfoMessage` arm and which appends no reload-hint. Routing it through `notifyWithContext` (which flattens to a plain cascade) would change the severity computation + reload-hint bytes, breaking byte-identity. The plan's success criterion "no producer remains pointing at the central switches for its own rows" could not be met for the applied cascade without a way to thread a render map into the standalone envelope's body.
- **Fix:** Added `emitReconcileAppliedContextCascade` to `shared/notify.ts` (mirrors `emitContextCascade`: composes the body via `composePluginLinesWith` with a caller-supplied per-row renderer, then routes through the shared `emitWithSummary` seam; NO reload-hint, matching the legacy applied-cascade byte form) and a thin `notifyReconcileAppliedWithContext` adapter to `shared/notify-context.ts` (preserves the `reconcile-applied-cascade` kind, reuses the existing `dispatchRow` cast bridge). This is additive infrastructure mirroring 01-01's established adapter-seam pattern; it touches no rendered byte (proven by catalog-uat).
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`, `extensions/pi-claude-marketplace/shared/notify-context.ts`
- **Commit:** `fe122495`

`shared/notify.ts` / `shared/notify-context.ts` were not in the plan's `files_modified` list (which named only the 8 orchestrator files); the seam addition was the minimal, byte-neutral way to satisfy MOD-03 for the applied cascade.

## Issues Encountered
- **Import-order lint after the spine import:** `eslint` (import-x/order) required `notify-context.ts` to sort before `notify.ts`; fixed by reordering the import lines in `execute.ts` (and applied the same ordering in `pending.ts` / `apply.ts`).
- **Worktree trufflehog hook structural failure:** the pre-commit `trufflehog` hook fails in a linked worktree (`.git` is a file, not a directory). This is the documented worktree limitation, not a secret finding. Each commit's staged files were scanned independently with `trufflehog filesystem` (0 verified / 0 unverified secrets, exit 0) before committing with the sanctioned `SKIP=trufflehog` prefix per the project CLAUDE.md.

## User Setup Required
None.

## Next Phase Readiness
- `npm run check` exit 0; `catalog-uat` (114 fixtures) + `notify-v2` + `notify-grammar-invariant` + `reconcile-planner-purity` all green and byte-identical; `git diff docs/output-catalog.md` empty.
- All mixed-subject cascade producers (import + reconcile pending + reconcile applied) now route their per-plugin rows through command-local render maps -- the D-13 full cutover of the cascade producers is complete. Plan 01-05 can remove the central per-row switches once every command (plugin + marketplace families from 01-02/01-03) is confirmed migrated.
- Note: the load-time reconcile save-failure path's single sanctioned `console.warn` (IL-3) was not touched -- it is not a render-map surface.

## Self-Check: PASSED

- Created files present: `import/execute.messaging.ts`, `reconcile/reconcile.messaging.ts`, `01-04-SUMMARY.md`.
- Task commits present: `f4e26f7e` (import), `fe122495` (reconcile).
- `npm run check` exit 0; byte gates + reconcile-planner-purity green and byte-identical; `git diff docs/output-catalog.md` empty.

---
*Phase: 01-localized-type-model-command-context-spine*
*Completed: 2026-06-24*
