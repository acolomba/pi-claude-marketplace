---
phase: 68-load-time-backfill
plan: 03
subsystem: api
tags: [reconcile, notify, typebox, discriminated-union, force-install]

# Dependency graph
requires:
  - phase: 66-derived-force-state-glyphs
    provides: "force-installed status + ICON_FORCE_INSTALLED glyph + forceInstalledRow composition site in PLUGIN_STATUSES"
  - phase: 67-list-filters-completion-reinstall-repair
    provides: "unconditional always-overwrite reinstall primitive (the backfill materialize path)"
provides:
  - "PluginBackfilledOutcome arm on PerEntryOutcome carrying the re-resolved installable boolean"
  - "RECONCILE_APPLIED_STATUSES widened with a force-installed arm + render arm"
  - "buildReconcileAppliedCascade projection: backfill -> (installed) full / (force-installed) partial"
affects: [68-04, 69-force-path-severity, 70-spec-documentation-reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union arm + exhaustive switch projection (assertNever gate)"
    - "Reconcile-local narrow status set widening with render-map total-arm enforcement (D-10)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - tests/orchestrators/reconcile/notify.test.ts

key-decisions:
  - "Combined Task 1 + Task 2 into a single atomic commit so no intermediate commit fails the typecheck exhaustiveness gate (plan-authorized)."
  - "Partial force-installed row uses the SOLE forceInstalledRow composition site (D-11 call-never-duplicate) rather than re-deriving installedLikeRow with the force glyph."
  - "Severity is a sensible default (info) per D-68-04; force-path severity finalized in Phase 69. Reasons brace left empty (byte-exact token frozen in Phase 70)."

patterns-established:
  - "installable discriminator drives installed-vs-force-installed projection (T-68-07 mitigation)."
  - "Backfill rows fold into the single applied cascade, never a second notify (RECON-04 / T-68-08)."

requirements-completed: [BFILL-01]

# Metrics
duration: 6min
completed: 2026-06-28
---

# Phase 68 Plan 03: Backfilled-Outcome Arm + Cascade Projection Summary

**Backfill promotions now have a typed `plugin-backfilled` outcome arm whose re-resolved `installable` boolean projects into an `(installed)` row when fully promoted or a `(force-installed)` row when partially re-materialized, folded into the single load-time applied cascade.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-28T01:34:12Z
- **Completed:** 2026-06-28T01:40:11Z
- **Tasks:** 2 (landed as one atomic commit)
- **Files modified:** 4

## Accomplishments

- Added `PluginBackfilledOutcome` (`kind: "plugin-backfilled"`, `version?`, `dependencies`, required `installable: boolean`) to the `PerEntryOutcome` union (BFILL-01).
- Widened `RECONCILE_APPLIED_STATUSES` with a `force-installed` arm, added the matching `PluginForceInstalledMessage` to `ReconcileAppliedMsg`, and added a `renderForceInstalled` arm routing through the existing `forceInstalledRow` (`◉` glyph) composition site.
- Added a `case "plugin-backfilled"` projection in `buildReconcileAppliedCascade` branching on `outcome.installable`: `true` -> `installed` row (carries `dependencies` for soft-dep markers), `false` -> `force-installed` row; both `severity: "info"`, `needsReload: true`.
- Added three behavior tests (full promotion, partial re-materialize, single-cascade RECON-04 with both an install and a backfill row).

## Task Commits

Tasks 1 and 2 were landed as one atomic commit (the plan's critical-atomicity constraint: adding the union arm makes the exhaustive switch non-exhaustive until the projection lands, so a split would produce a commit failing the typecheck exhaustiveness gate).

1. **Task 1 + Task 2: Add the union arm + project backfill outcomes / widen the applied-status set** - `41520ac2` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` - Added `PluginBackfilledOutcome` interface and union member.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts` - Widened `RECONCILE_APPLIED_STATUSES` + `ReconcileAppliedMsg`, added `renderForceInstalled` arm and render-map entry, imported `forceInstalledRow` / `PluginForceInstalledMessage`.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` - Added the `plugin-backfilled` projection arm.
- `tests/orchestrators/reconcile/notify.test.ts` - Added full / partial / single-cascade behavior tests.

## Decisions Made

- **Single atomic commit for both tasks** - plan-authorized; preserves the per-commit typecheck exhaustiveness invariant.
- **Force-installed row reuses `forceInstalledRow`** - the SOLE force-installed composition site (D-11), so bytes stay identical to every other force-installed surface, rather than re-deriving `installedLikeRow` with the `◉` glyph.
- **Empty reasons / info severity** - the backfill outcome does not carry dropped-component detail; the byte-exact reasons token is frozen in Phase 70 and the force-path severity in Phase 69 (D-68-04 defers both).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The full `npm run check` run reported two failures in `tests/architecture/hooks-exec.test.ts` (`Block F / D-60-06`). This is the documented ENOTEMPTY concurrency flake unrelated to this plan's reconcile changes; re-running the file in isolation passed 22/22. typecheck, lint, format:check, and the integration suite were all green.
- Prettier flagged the new test block on the first `npm run check`; ran `prettier --write` on the test file and re-verified clean.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 68-04 can now produce `plugin-backfilled` outcomes and rely on this typed row + projection to fold them into the single applied cascade automatically.
- Phase 69 will stamp the final force-path severity onto the force-installed row; Phase 70 freezes the byte-exact promotion-row token. Both are intentionally deferred.

## Self-Check: PASSED

All four modified files and the SUMMARY exist on disk; commit `41520ac2` is present in git history.

---
*Phase: 68-load-time-backfill*
*Completed: 2026-06-28*
