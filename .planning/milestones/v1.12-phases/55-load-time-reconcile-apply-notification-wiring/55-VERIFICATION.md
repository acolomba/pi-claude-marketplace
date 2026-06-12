---
phase: 55-load-time-reconcile-apply-notification-wiring
verified: 2026-06-10T02:00:00Z
status: passed
score: 5/5
overrides_applied: 0
---

# Phase 55: Load-Time Reconcile Apply, Notification & Wiring — Verification Report

**Phase Goal:** On every Pi startup and `/reload`, the extension automatically reconciles installed
reality to the merged config -- adding declared-but-missing entries, removing undeclared managed
ones -- reporting through the structured notification cascade, soft-failing network per entry, and
never blocking Pi load.

**Verified:** 2026-06-10T02:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Declared-but-missing entries added/installed at load; installed-but-undeclared entries removed/uninstalled (RECON-01, RECON-02) | VERIFIED | `tests/orchestrators/reconcile/apply.test.ts` RECON-01 and RECON-02 tests GREEN; `planReconcile` + `applyReconcile` drive the full add/install and remove/uninstall buckets with ownership guard structural in the planner |
| 2 | Network failure soft-fails per entry; pass continues; failure never propagates past `resources_discover`; Pi load never blocked (RECON-03, NFR-5, NFR-2) | VERIFIED | RECON-03 test injects failing `gitOps` into addMarketplace; asserts no throw, cascade carries `{network unreachable}` row + sibling success row; index.ts wraps `applyReconcile` in double try/catch with last-ditch `makeRawNotifyFn` (WR-08 vacuous-test fix applied; real propagation path tested) |
| 3 | Results surface through ONE `notify()` per `applyReconcile`; catalog-conformant grammar; reconcile NEVER emits `/reload to pick up changes` hint (RECON-04, IL-2) | VERIFIED | `ReconcileAppliedCascadeMessage` variant in `shared/notify.ts`; `shouldEmitReloadHint` arm returns `false` structurally (line 2170–2175); `notify-grammar-invariant.test.ts` asserts no `/reload` trailer even on cascades carrying transition tokens; `notify-v2.test.ts` byte-equality GREEN on 3 catalog states; catalog-uat FIXTURES orphan-walk clean both directions |
| 4 | Back-to-back reconcile is a byte-unchanged no-op — state.json and config bytes + mtime preserved; zero `notify()` on second call (RECON-05) | VERIFIED | RECON-05 test asserts byte+mtime equality on both files after second call and asserts zero `ctx.ui.notify` calls; pristine-scope gate (WR-05 fix) prevents any writes in empty project dirs |
| 5 | Two concurrent Pi processes cannot double-apply or interleave reconciliation; state.json converges to exactly one mp record + one plugin record; no orphaned staging dirs; both children exit 0 (RECON-06, NFR-3) | VERIFIED | `tests/integration/load-reconcile-race.test.ts` Scenario A (RECON-06 core race) GREEN; state-consistency assertions per Pitfall 10; 5/5 back-to-back local runs green (no-flake verification documented in SUMMARY); Phase 52 deferred Pitfall 52-2 (Scenario B) + Pitfall 52-4 (Scenario C) discharged in same file |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | applyReconcile orchestrator, per-scope read pass under lock, per-entry apply pass with no outer lock, single notify() emission | VERIFIED | 649 lines; `withLockedStateTransaction` (from `with-state-guard.ts`) on read pass with no `tx.save()`; per-entry `notifications: { mode: "orchestrated" }` calls at lines 243/300/347/403/450/502; `export async function applyReconcile` at line 595; WR-05 pristine-scope gate at lines 123–130 |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` | PerEntryOutcome discriminated union (14 variants) | VERIFIED | 169 lines; `export type PerEntryOutcome` at line 155 |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` | buildReconcileAppliedCascade projection helper | VERIFIED | 426 lines; `export function buildReconcileAppliedCascade` at lines 403–404 |
| `extensions/pi-claude-marketplace/shared/notify.ts` | ReconcileAppliedCascadeMessage variant, StandaloneKind extension, shouldEmitReloadHint = false, dispatchInfoMessage arm | VERIFIED | `reconcile-applied-cascade` in StandaloneKind at line 1097; `shouldEmitReloadHint` returns `false` at lines 2170–2175; `dispatchInfoMessage` arm at line 2683 |
| `extensions/pi-claude-marketplace/index.ts` | resources_discover handler binds ctx (no unknown cast), calls applyReconcile inside try/catch BEFORE aggregateDiscoveredResources | VERIFIED | `onResourcesDiscover("resources_discover", async (event, ctx) => {` at line 26; `applyReconcile({ ctx, pi, cwd: event.cwd })` at line 34; double try/catch at lines 33–47; `aggregateDiscoveredResources` at line 49 (after applyReconcile) |
| `docs/output-catalog.md` | ## reconcile-applied-cascade H2 section with 3 catalog states | VERIFIED | Section exists at line 1290 of output-catalog.md |
| `tests/orchestrators/reconcile/apply.test.ts` | RECON-01/02/03/05 + CFG-03/T-55-02-01 coverage | VERIFIED | 704 lines; RECON-01 at line 104, RECON-02 at line 155, RECON-03 at line 221, RECON-05 at line 363 |
| `tests/edge/index-handler.test.ts` | RECON-04 wiring proof; catastrophic-throw catch arm | VERIFIED | 235 lines; wiring + NFR-2 preservation tests present |
| `tests/integration/load-reconcile-race.test.ts` | RECON-06 two-process race + Pitfall 52-2/52-4 lock-coverage | VERIFIED | 513 lines (>100 min_lines); Scenario A at line 246, Scenario B at line 341, Scenario C at line 421 |
| `tests/integration/load-reconcile-race-child.ts` | Forkable child entry point calling applyReconcile via stub ctx + stub pi over IPC | VERIFIED | 100 lines; `applyReconcile` at line 77; IPC ready/go pattern; exits 0 |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | AddMarketplaceNotifications + orchestrated-mode outcome | VERIFIED | `AddMarketplaceNotifications` at line 98; `notifications?: AddMarketplaceNotifications` at line 180 |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | RemoveMarketplaceNotifications + orchestrated-mode outcome | VERIFIED | `RemoveMarketplaceNotifications` at line 73; `notifications?: RemoveMarketplaceNotifications` at line 121 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | UninstallPluginNotifications + orchestrated-mode outcome | VERIFIED | `UninstallPluginNotifications` at line 72; `notifications?: UninstallPluginNotifications` at line 131 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | EnableDisablePluginNotifications + orchestrated-mode outcome, no config write-back in orchestrated mode (WR-09) | VERIFIED | `EnableDisablePluginNotifications` at line 84; `if (!orchestrated)` gate at line 390 guards `writeConfigEntry`; `saveConfig` only reached in standalone arm |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `extensions/pi-claude-marketplace/index.ts` | `applyReconcile` | `resources_discover` handler | VERIFIED | `applyReconcile({ ctx, pi, cwd: event.cwd })` at line 34; `ctx` is bound (no `unknown` cast in handler signature) |
| `applyReconcile` | `migrateFirstRunConfig + loadMergedScopeConfig + planReconcile` | `withLockedStateTransaction` closure per scope (read pass) | VERIFIED | All three called inside `withLockedStateTransaction` closure in `readPassForScope`; `migrateFirstRunConfig` at line 143, `loadMergedScopeConfig` at line 146, `planReconcile` at line 176 |
| `applyReconcile` | `addMarketplace / removeMarketplace / installPlugin / uninstallPlugin / setPluginEnabled` | `notifications: { mode: "orchestrated" }` per-entry calls | VERIFIED | Pattern appears at lines 243, 300, 347, 403, 450, 502 of apply.ts |
| `ReconcileAppliedCascadeMessage` | `shouldEmitReloadHint = false` | `StandaloneKind` `isInfoKind` arm | VERIFIED | `case "reconcile-applied-cascade": return false` at lines 2170–2175 of notify.ts |
| `tests/integration/load-reconcile-race.test.ts` | `tests/integration/load-reconcile-race-child.ts` | `child_process.fork(CHILD_PATH, ...)` | VERIFIED | `fork(CHILD_PATH, ...)` at lines 140 and 145; `CHILD_PATH` resolves to `load-reconcile-race-child.ts` at line 57–59 |
| `load-reconcile-race-child.ts` | `applyReconcile` | stub ctx + stub pi over IPC | VERIFIED | `applyReconcile({ ctx, pi, cwd, ... })` at line 77 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `apply.ts` — notify() call | `buildReconcileAppliedCascade(outcomes)` | Per-entry orchestrator outcomes accumulated in apply loop | Yes — each outcome is typed result from real orchestrator call; empty-and-clean path explicitly suppresses notify | FLOWING |
| `apply.ts` — read pass | `plan` from `planReconcile` | `loadMergedScopeConfig` → real JSON load from disk; `tx.state` from `withLockedStateTransaction` → real state.json | Yes — no static returns; CFG-03 invalid arm skips planner structurally | FLOWING |
| `index.ts` — handler | `applyReconcile({ ctx, pi, cwd: event.cwd })` | Pi runtime `event.cwd` + bound `ctx` from handler signature | Yes — real ctx, real cwd; `aggregateDiscoveredResources` called unconditionally after | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RECON-01/02/03/05 apply tests | `npm test -- tests/orchestrators/reconcile/apply.test.ts` | 1709/1709 pass | PASS |
| RECON-04 index-handler wiring | `npm test -- tests/edge/index-handler.test.ts` | 1709/1709 pass | PASS |
| RECON-06 two-process race + Pitfall 52-2/52-4 | `npm test -- tests/integration/load-reconcile-race.test.ts` | 10/10 integration pass (1712 total) | PASS |
| Architecture gates (notify-types, catalog-uat, grammar-invariant) | `npm test -- tests/architecture/notify-grammar-invariant.test.ts tests/architecture/notify-types.test.ts tests/architecture/catalog-uat.test.ts` | 1709/1709 pass | PASS |
| Full suite gate | `npm run check` | 1709 unit + 10 integration, 0 failures | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RECON-01 | 55-02-PLAN.md | Declared-but-missing entries added/installed at load | SATISFIED | `apply.test.ts` RECON-01 test; `applyReconcile` drives `addMarketplace` + `installPlugin` for declared-but-missing entries |
| RECON-02 | 55-02-PLAN.md | Installed-but-undeclared entries removed/uninstalled (scoped to managed entries) | SATISFIED | `apply.test.ts` RECON-02 test; ownership guard is structural in `planReconcile` (state-recorded entries only); unmanaged entries never touched |
| RECON-03 | 55-01-PLAN.md + 55-02-PLAN.md | Network failures soft-fail per entry, never block Pi load | SATISFIED | Plan 01: orchestrated-mode foundation with per-entry outcome types; Plan 02: per-entry try/catch in apply loop; WR-03 fix: errno ladder classifies network errnos as `{network unreachable}` |
| RECON-04 | 55-02-PLAN.md | Results through structured cascade, no `/reload` hint | SATISFIED | `ReconcileAppliedCascadeMessage` variant; `shouldEmitReloadHint = false` structurally; grammar-invariant test asserts no trailer; `notify-v2.test.ts` byte-equality on 3 catalog states |
| RECON-05 | 55-02-PLAN.md | Back-to-back reconcile is byte-unchanged no-op | SATISFIED | RECON-05 test asserts byte+mtime equality on state.json and config; WR-05 pristine-scope gate ensures no file creation in empty project dirs |
| RECON-06 | 55-03-PLAN.md | Concurrent processes cannot double-apply or interleave | SATISFIED | `load-reconcile-race.test.ts` Scenario A; state-consistency assertions (exactly one mp-a, one plugin-a, no orphan staging dirs); 5/5 back-to-back local runs green |

No orphaned requirements — all six RECON-01..06 requirements declared in the plan frontmatter are fully covered and the REQUIREMENTS.md traceability table marks all six Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none found) | — | — | — | — |

No `TBD`, `FIXME`, or `XXX` markers found in any phase 55 modified files. No stubs, no empty implementations, no hardcoded empty returns in rendering paths.

### Human Verification Required

None — all phase 55 behaviors are verifiable programmatically via the test suite. The notification output format is covered by `catalog-uat.test.ts` byte-equality fixtures and `notify-grammar-invariant.test.ts`. Pi runtime behavior (actual startup/reload triggering `resources_discover`) is outside test scope but is a standard Pi extension contract not specific to this phase.

### Gaps Summary

No gaps. All five roadmap success criteria are verified against actual codebase evidence:

1. **RECON-01/02** (declared-but-missing adds; installed-but-undeclared removes): `applyReconcile` in `apply.ts` drives both buckets with the planner as the ownership gate. Tests GREEN.
2. **RECON-03/NFR-5** (per-entry soft-fail, Pi load never blocked): per-entry try/catch in apply loop + double try/catch in index.ts. WR-03 errno classification fix confirmed in `add.ts`. Tests GREEN.
3. **RECON-04/IL-2** (single notify per reconcile, no `/reload` trailer): `ReconcileAppliedCascadeMessage` wired end-to-end; `shouldEmitReloadHint = false` structurally; catalog-uat FIXTURES verified. Tests GREEN.
4. **RECON-05** (fixed-point convergence): RECON-05 test asserts byte+mtime unchanged on both files; WR-05 pristine-scope gate prevents spurious file creation. Tests GREEN.
5. **RECON-06/NFR-3** (no concurrent double-apply): two-process race test with state-consistency assertions. 5/5 back-to-back runs green. Phase 52 deferred Pitfall 52-2/52-4 discharged.

Post-execution review fixes (CR-01 source-based planner convergence, WR-01..09) are all committed (commits b6c0452..b37e2d6) and verified in the final test run.

---

_Verified: 2026-06-10T02:00:00Z_
_Verifier: Claude (gsd-verifier)_
