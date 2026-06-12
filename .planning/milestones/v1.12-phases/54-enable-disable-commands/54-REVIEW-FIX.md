---
phase: 54-enable-disable-commands
fixed_at: 2026-06-10T21:35:00Z
review_path: .planning/phases/54-enable-disable-commands/54-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 54: Code Review Fix Report

**Fixed at:** 2026-06-10T21:35:00Z
**Source review:** .planning/phases/54-enable-disable-commands/54-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 8 (2 Critical + 6 Warning; `fix_scope: critical_warning` -- IN-01..IN-05 excluded)
- Fixed: 8
- Skipped: 0

Quality gate: `npm run check` green after all fixes (typecheck + ESLint + Prettier + 1675 unit + 9 integration tests). Trufflehog scan (run from the main repo per worktree policy) passed.

## Fixed Issues

### CR-01: Fresh enable always fails -- nested `withStateGuard` self-deadlock

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** a880684
**Applied fix:** Extracted `installPlugin`'s guard-closure body into the exported guard-FREE `runInstallLedger(state, locations, opts, capture?)`. `installPlugin` calls it inside its own `withStateGuard` (behavior unchanged); `setPluginEnabled` now uses `withLockedStateTransaction` and calls the ledger against the OUTER snapshot -- exactly one lock owns the critical section, so the `proper-lockfile` re-entrancy deadlock is structurally impossible. Both latent defects fixed in the same stroke: `allowExistingRecord: true` skips the PI-15 early-sanity throw and the state-phase `ConcurrentInstallError` so the KEPT disabled record (ENBL-02) re-materializes in place (preserving `installedAt`); the single shared snapshot + `tx.save()` removes the outer stale-state clobber. Added the end-to-end fresh-enable success test against a real on-disk marketplace asserting the catalog `enable-fresh` byte form (`(added)` header, `(installed)` row, `/reload` trailer) AND non-empty `resources.skills` in the persisted state.json.

### CR-02: ENBL-04 unimplemented -- no producer of the `(disabled)` token

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `tests/orchestrators/plugin/list.test.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/edge/handlers/tools.test.ts`, `tests/integration/fold-adoption.test.ts`
**Commit:** 0bb8b16
**Applied fix:** `list.ts::installedRowMessage` now branches on the canonical `isRecordedButDisabled` predicate (imported from `reconcile/plan.ts` -- legal per the D-11 matrix; the purity gate constrains plan.ts's own imports, not its importers) BEFORE the upgradable check, returning a `PluginDisabledMessage`. The PL-1 `--installed` filter and the orphan-fold carry-over include the `disabled` bucket. `info.ts` partitions disabled scopes and routes them through the list-arm cascade (marketplace header + `PluginDisabledMessage` row) per the catalog's info-surface paragraph; mixed disabled+info scopes emit separate notifies mirroring the GRAM-04 failure separation. No catalog/byte changes -- the `disabled-inventory` state already existed; this wires real payload production. Test fixtures that seeded installed records with empty resources were updated to seed a populated `skills` array (empty resources + `installable: true` IS the marker) with a `disabled: true` knob; the fold-adoption integration fixture gained a real skill (a zero-component install records all-empty resources, colliding with the marker). New orchestrator-level tests drive a disabled record through `loadPluginListPayload`/`getPluginInfo` and assert the `(disabled)` row, the frozen-version no-`(upgradable)` rule, and the `--installed` bucketing.

### WR-01: Catalog claims "state.json mtime is UNCHANGED" on CFG-03 abort, but the guard re-saved state on every clean-return arm

**Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts` (mechanism landed in commit a880684's `enable-disable.ts` rewrite)
**Commit:** 47a7288
**Applied fix:** The CR-01 restructure moved `setPluginEnabled` to `withLockedStateTransaction` with `tx.save()` ONLY on the `fresh` arms, making the catalog's mtime claim true (catalog wording kept -- "prefer making the catalog truthful" resolved by fixing the behavior). The CFG-03 test was strengthened from load-bearing-field comparison to byte + mtime equality on state.json, and the idempotent-disable test gained a byte-equality assertion.

### WR-02: `--local` placed before the ref breaks parsing with a misleading usage error

**Files modified:** `extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts`, `tests/edge/handlers/plugin/enable-disable.test.ts`
**Commit:** 8696989
**Applied fix:** `extractLocalFlag` now returns `residualArgs` with the `--local` token removed; the handler feeds the residue to `parseRequiredPluginMarketplaceRef`, mirroring how `--scope` is consumed by the parser itself. Added handler tests for `--local` before the ref and between ref and `--scope`.

### WR-03: `not-recorded` outcome misuses `{not in manifest}` and has no catalog state

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** 8b389c7
**Applied fix:** The not-recorded arm now emits `(skipped) {not installed}` (the reinstall/update precedent for "marketplace present, plugin not installed"; non-benign reason routes to warning severity per D-28-03). Added the catalog `enable-not-installed` state and the byte-locked UAT fixture (`expectedSeverity: "warning"`, `1 plugin operation skipped.` summary), plus an orchestrator-level test asserting the arm and the absence of `{not in manifest}`.

### WR-04: `as never` double-casts on `cascadeUnstagePlugin` defeat type checking

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
**Commit:** 707342d
**Applied fix:** `runDisableBranch` now takes the real `ScopedLocations` and the exact state-record type `cascadeUnstagePlugin` requires (aliased `InstalledPluginRecord = ExtensionState["marketplaces"][string]["plugins"][string]`). Both `as never` casts and both local structural mirror interfaces deleted; argument-order swaps and schema renames are compile errors again.

### WR-05: Reconcile plan never converges after a successful disable

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `tests/orchestrators/reconcile/plan.test.ts`
**Commit:** a73d339
**Applied fix:** `classifyDeclaredPlugin` gates the disable push on `recorded && record !== undefined && !isRecordedButDisabled(record)` -- the terminal disabled state (recorded + empty resources + `enabled: false`) is steady state, symmetric with the enable branch. ENBL-02(c) updated to assert the converged no-op (`deepEqual emptyReconcilePlan`), and a new convergence test proves populated-record -> disable action, disabled-record -> empty plan.

### WR-06: ENBL-03 test assertion too weak; no fresh-enable success coverage

**Files modified:** `tests/orchestrators/plugin/enable-disable.test.ts`
**Commit:** e929390
**Applied fix:** The missing-cached-clone test now pins the full `(failed) {source missing}` brace byte form (the bare `/\(failed\)/` match also passed for the CR-01 `StateLockHeldError` emission, which is how the broken fresh enable shipped green). The fresh-enable success test -- the other half of this finding -- landed with commit a880684 (CR-01).

## Skipped Issues

None -- all in-scope findings were fixed. (IN-01..IN-05 are Info-tier and outside `fix_scope: critical_warning`.)

______________________________________________________________________

_Fixed: 2026-06-10T21:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
