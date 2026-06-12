---
phase: 55-load-time-reconcile-apply-notification-wiring
plan: 02
subsystem: orchestrators
tags: [orchestrators, notify, recon-01, recon-02, recon-03, recon-04, recon-05, apply, catalog]

# Dependency graph
requires:
  - phase: 53
    provides: "ReconcilePlan + pure planReconcile + projection helper pattern (preview)"
  - phase: 54
    provides: "isRecordedButDisabled predicate + enable/disable orchestrator surface"
  - phase: 55-01
    provides: "orchestrated-mode foundation across addMarketplace / removeMarketplace / uninstallPlugin / setPluginEnabled + typed *Outcome unions"
provides:
  - "ReconcileAppliedCascadeMessage standalone variant (shared/notify.ts) -- 8th NotificationMessage arm"
  - "buildReconcileAppliedCascade projection helper (orchestrators/reconcile/notify.ts)"
  - "PerEntryOutcome discriminated union (orchestrators/reconcile/apply-outcomes.ts)"
  - "applyReconcile load-time orchestrator (orchestrators/reconcile/apply.ts)"
  - "resources_discover handler wired with bound ctx + applyReconcile inside try/catch BEFORE aggregateDiscoveredResources (index.ts)"
  - "## reconcile-applied-cascade catalog section (3 catalog states paired with FIXTURES)"
affects: [55-03-load-reconcile-race-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone-dispatched RECON-04 variant routed through dispatchInfoMessage so shouldEmitReloadHint returns false structurally (Pitfall 4 closed: the reconcile already ran ON /reload)."
    - "Per-scope read pass under withStateGuard (migrate-then-load-then-plan inside ONE lock) followed by per-entry apply pass with NO outer lock (CR-01 preserved -- each driven orchestrator owns its per-scope critical section)."
    - "Per-entry try/catch around each driven orchestrator coerces unexpected throws into typed `failed` outcomes (Pitfall 5 / RECON-03 / NFR-5 soft-fail)."
    - "Atomic-supersession (Pitfall 53-3) preserved: Task 1 lands the type + renderer + projection + catalog surface in ONE commit; Task 2 wires apply.ts + index.ts in a separate commit. Two commits, both individually GREEN."

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/edge/index-handler.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/index.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-types.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/shared/notify-v2.test.ts

key-decisions:
  - "A1 VERIFIED via direct read of agent-session.js: bindExtensions emits session_start FIRST (line 1649), then extendResourcesFromExtensions fires (line 1650) which checks hasHandlers(\"resources_discover\") before emitting. Since extension factories register their handlers during construction (BEFORE bindExtensions runs), softDepStatus(pi) at apply time observes a stable surface. A1 is CONFIRMED; no Plan revision needed."
  - "Plan said `enable success -> {status: \"enabled\"}` but `enabled` is NOT a member of PLUGIN_STATUSES (only `disabled` is). Mapped enable success to `installed` instead (Rule 1 fix): the setPluginEnabled enable branch re-materializes via installPlugin, so `(installed)` is the truthful realized-token surface. Preserves RESEARCH Pattern 5 Option A (REUSE existing transition tokens; no new closed-set members)."
  - "Added narrow gitOps DI seam to ApplyReconcileOptions (Rule 3 blocker fix): RECON-03 network soft-fail proof requires injecting a failing clone, and addMarketplace is the only network-touching orchestrator at apply time per NFR-5. Production caller (index.ts) omits the option; tests pass a mock-clone-throws fixture."
  - "Used makeRawNotifyFn (the AUTH-01 sanctioned raw-text notify wrapper from shared/notify.ts) for the last-ditch error notify in index.ts -- direct ctx.ui.notify is forbidden by the no-restricted-syntax rule, but the catch arm predates any structured NotificationMessage construction."
  - "blockToMarketplaceMessage gained added/removed arms (Rule 1 fix): the projection assigns these statuses but the existing switch only handled will add / will remove / failed / undefined. Added defensive throw arms for updated / autoupdate enabled / autoupdate disabled / skipped (which the reconcile projection never assigns) and assertNever for compile-time exhaustiveness."

patterns-established:
  - "Plan-level atomic-supersession lockstep applied to a 2-task plan: Task 1 lands the type + projection + catalog in ONE commit so the catalog-uat byte-equality runner is GREEN before Task 2 builds apply.ts against the now-frozen types. Mirrors how Phase 53 Plan 02 + Phase 54 Plan 02 sequenced their type + apply work."
  - "Per-marketplaces-array counting helpers (countFailedRows / countSkippedRows / buildSummaryLineForCascade) extracted from the cascade arm so the RECON-04 standalone variant reuses the same wording without code duplication."

requirements-completed: [RECON-01, RECON-02, RECON-03, RECON-04, RECON-05]

# Metrics
duration: ~120m
completed: 2026-06-10
---

# Phase 55 Plan 02: Load-Time Reconcile Apply & Notification Wiring Summary

**Lands the load-time apply path atomically: applyReconcile orchestrator + index.ts resources_discover wiring (ctx now bound -- the `unknown` cast is gone) + ReconcileAppliedCascadeMessage standalone variant + renderer dispatch arm + projection helper + catalog amendment. After this plan ships, every Pi startup and `/reload` reconciles installed reality to the merged config without operator action, soft-fails per entry on network failure, and reports through a single structured cascade in catalog-conformant grammar -- NEVER emitting the `/reload to pick up changes` trailer (Pitfall 4 closed structurally).**

## Performance

- **Duration:** ~120 min
- **Started:** 2026-06-10T22:50:00Z
- **Completed:** 2026-06-10T~24:50:00Z
- **Tasks:** 2/2
- **Files modified:** 12 (4 new, 8 modified)

## Accomplishments

- **RECON-04 type model**: 8th NotificationMessage arm (ReconcileAppliedCascadeMessage) added to shared/notify.ts. StandaloneKind extended; isInfoKind / computeSeverity / buildSummaryLine / shouldEmitReloadHint / dispatchInfoMessage all gain matching arms with assertNever discipline preserved. shouldEmitReloadHint returns `false` structurally -- the reconcile already ran ON /reload so the trailer would be a lie (Pitfall 4 closed).
- **Projection helper**: buildReconcileAppliedCascade in orchestrators/reconcile/notify.ts folds the per-entry PerEntryOutcome union (14 variants covering mp add/remove + plugin install/uninstall/enable/disable in success + failed shape, plus source-mismatch and invalid-block) into the new variant. Block ordering via compareByNameThenScope; plugin rows preserve insertion order. ZERO new STATUS_TOKENS / PLUGIN_STATUSES / MARKETPLACE_STATUSES / REASONS / MARKERS literals (RESEARCH Pattern 5 Option A).
- **applyReconcile orchestrator**: per-scope read pass under withStateGuard (migrate-then-load-then-plan inside ONE lock); per-scope apply pass with NO outer lock (CR-01 preserved); per-entry try/catch with closed-set reason narrowing (Pitfall 5 / RECON-03); single notify() per invocation (IL-2 / RECON-04); SILENT on empty-and-clean reconciles (NFR-2 / A4 / RECON-05).
- **index.ts handler wiring**: the `unknown` cast that elided ctx is dropped; the natural `(event, ctx)` signature is restored. applyReconcile is called inside try/catch BEFORE aggregateDiscoveredResources so newly-materialized artefacts are picked up on the SAME load. A catastrophic throw is caught + surfaced through makeRawNotifyFn inside its own try/catch -- Pi load is NEVER blocked (NFR-2).
- **Catalog amendment**: new `## reconcile-applied-cascade` H2 section with 3 catalog states (success-cascade-mixed, soft-fail-mixed, invalid-config-row) paired with FIXTURES in tests/architecture/catalog-uat.test.ts. The CFG-03 invalid-config row carries ONLY the file BASENAME (T-55-02-01 / T-53-02-02 information-disclosure mitigation).
- **A1 VERIFIED inline**: agent-session.js:1648-1656 confirms pi-coding-agent fires resources_discover AFTER session_start has emitted to every extension AND after all extension factory functions have returned -- softDepStatus(pi) at apply time observes a stable pi-subagents / pi-mcp-adapter status.

## Task Commits

1. **Task 1: variant + projection + catalog amendment (atomic 8-file commit)** -- `ffeec66` (feat)
2. **Task 2: applyReconcile + index.ts wiring + behavior tests** -- `678fc4b` (feat)

## Files Created/Modified

### Created (4)

- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` -- applyReconcile orchestrator. Per-scope read pass under withStateGuard; per-entry apply pass with NO outer lock; per-entry try/catch coerces throws into typed failed outcomes; single notify() per invocation; SILENT on empty-and-clean reconciles. A1 verification recorded inline. 526 lines.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` -- PerEntryOutcome discriminated union (14 variants). Failure variants carry `reason: Reason` (broader than ContentReason); T-55-02-02 mitigation contract documented inline.
- `tests/orchestrators/reconcile/apply.test.ts` -- RECON-01..05 + CFG-03/T-55-02-01 coverage; 5 tests GREEN.
- `tests/edge/index-handler.test.ts` -- RECON-04 wiring proof; 3 tests GREEN.

### Modified (8)

- `extensions/pi-claude-marketplace/shared/notify.ts` -- ReconcileAppliedCascadeMessage interface, StandaloneKind extension, isInfoKind extension, reconcileAppliedSeverity helper, dispatch arms (computeSeverity / buildSummaryLine / shouldEmitReloadHint / dispatchInfoMessage), buildSummaryLineForCascade helper, composeReconcileAppliedBody helper, refactored countFailedOperations / countSkippedOperations into shared per-marketplaces-array counters.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` -- buildReconcileAppliedCascade projection helper, applyOutcomeToBlock + reasonAsContent helpers, blockToMarketplaceMessage extended with added/removed arms + defensive throw arms + assertNever default.
- `extensions/pi-claude-marketplace/index.ts` -- ctx bound (no more `unknown` cast); applyReconcile inside try/catch BEFORE aggregateDiscoveredResources; last-ditch error notify via makeRawNotifyFn (the AUTH-01 sanctioned escape) inside its own try/catch.
- `docs/output-catalog.md` -- `## reconcile-applied-cascade` H2 section with 3 catalog states.
- `tests/architecture/catalog-uat.test.ts` -- section parser extended to accept `## reconcile-applied-cascade` (non-backtick section); 3 FIXTURES entries paired with the new catalog states; orphan-walk clean both directions.
- `tests/architecture/notify-types.test.ts` -- 8-arm union arity proof (`_l14`) + ReconcileAppliedCascadeMessage shape proof (`_rac`).
- `tests/architecture/notify-grammar-invariant.test.ts` -- 2 new tests: subject-first row grammar for realized tokens + structural no-/reload-trailer assertion on cascades carrying transition tokens.
- `tests/shared/notify-v2.test.ts` -- 4 new per-variant byte-equality tests covering the 3 catalog states + explicit no-/reload trailer proof.

## Decisions Made

### Plan-Driven (not a deviation)

- **Atomic-supersession lockstep**: Task 1 lands the variant + projection + catalog in ONE atomic commit; Task 2 wires apply.ts + index.ts in a separate atomic commit. Two commits, both individually pass the catalog-uat byte-equality gate. This sequencing was explicitly mandated by the plan to avoid intermediate RED states.

### Rule 1 (Bug fix)

- **`enabled` token does not exist in PLUGIN_STATUSES** -- the plan's behavior block stated `plugin enable success -> child row { status: "enabled" }`, but PLUGIN_STATUSES has no `enabled` literal (only `disabled`). Mapped enable success to `installed` instead: the setPluginEnabled enable branch re-materializes via installPlugin, so `(installed)` is the truthful realized-token surface. Preserves RESEARCH Pattern 5 Option A (REUSE existing transition tokens; no new closed-set members).
- **`blockToMarketplaceMessage` missing `added`/`removed` arms** -- the existing switch only handled `will add` / `will remove` / `failed` / `undefined`. Adding the new realized-transition arms (assigned by applyOutcomeToBlock) is required for the projection to compile. Added defensive throw arms for `updated` / `autoupdate enabled` / `autoupdate disabled` / `skipped` (the reconcile projection never assigns these) and assertNever default for compile-time exhaustiveness.

### Rule 3 (Blocker fix)

- **Narrow gitOps DI seam added to ApplyReconcileOptions** -- RECON-03 (per-entry network soft-fail) cannot be proven without injecting a failing clone. addMarketplace is the only network-touching orchestrator at apply time per NFR-5; threading a `gitOps?: GitOps` option into applyReconcile and routing it through to addMarketplace is the narrow, plan-aligned way to inject the failure. Production caller (index.ts) omits the option; tests inject a fixture that throws on the first clone and succeeds on the second.
- **`makeRawNotifyFn` for the last-ditch error notify in index.ts** -- direct `ctx.ui.notify` is forbidden by the project ESLint no-restricted-syntax rule. The catch arm in index.ts surfaces a raw error string (it predates any structured NotificationMessage construction), so it routes through makeRawNotifyFn -- the AUTH-01 sanctioned escape for domain-tier raw-text notification.

### Rule 2 / Rule 4

- None -- no missing critical functionality or architectural changes required.

## A1 Sanity Check (REQUIRED -- plan directive)

**Result: A1 CONFIRMED.**

Evidence: `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js`:

```js
async bindExtensions(bindings) {
  // ... binding setup ...
  this._applyExtensionBindings(this._extensionRunner);
  await this._extensionRunner.emit(this._sessionStartEvent);       // line 1649
  await this.extendResourcesFromExtensions(...);                   // line 1650
}

async extendResourcesFromExtensions(reason) {
  if (!this._extensionRunner.hasHandlers("resources_discover")) {  // line 1653
    return;
  }

  const { skillPaths, promptPaths, themePaths } = await
    this._extensionRunner.emitResourcesDiscover(...);              // line 1656
  // ...
}
```

`bindExtensions` first emits `session_start` to every extension, then calls `extendResourcesFromExtensions` which checks `hasHandlers("resources_discover")`. For the predicate to return true, each extension's factory function MUST have already run and called `pi.on("resources_discover", ...)` -- factories run during runner construction, BEFORE `bindExtensions`. Therefore at the moment `resources_discover` emits:

1. All extension factory functions have returned.
2. `session_start` has already been emitted to every extension.
3. `pi.getAllTools()` returns a stable list of every registered tool.

`softDepStatus(pi)` at apply time observes a stable pi-subagents / pi-mcp-adapter status. A1 is CONFIRMED -- no Plan revision needed; the cascade emission stays in the resources_discover handler (RESEARCH Open Question 4's `session_start` fallback is NOT triggered).

Documented inline in `apply.ts` (top-of-file comment block) for future maintainers.

## Verification

- `tests/orchestrators/reconcile/apply.test.ts` -- 5/5 GREEN (RECON-01, RECON-02, RECON-03, RECON-05, CFG-03/T-55-02-01)
- `tests/edge/index-handler.test.ts` -- 3/3 GREEN (RECON-04 wiring, clean reconcile returns ResourcesDiscoverResult, NFR-2 boundary preservation)
- `tests/architecture/catalog-uat.test.ts` -- GREEN (3 new catalog states paired with FIXTURES; orphan-walk clean both directions)
- `tests/architecture/notify-types.test.ts` -- GREEN (8-arm union arity + ReconcileAppliedCascadeMessage shape proofs)
- `tests/architecture/notify-grammar-invariant.test.ts` -- GREEN (subject-first row grammar for realized tokens + structural no-/reload-trailer assertion)
- `tests/shared/notify-v2.test.ts` -- GREEN (4 new per-variant byte-equality tests)
- `npm run check` -- GREEN end-to-end (1703 unit + 7 integration tests, 0 failures)

## Threat Model Disposition

- **T-55-02-01 (Information disclosure / CFG-03 invalid-config block path)**: MITIGATED. `apply.ts` constructs the invalid-block outcome with `path.basename(filePath)` (never the absolute path) -- mirrors preview.ts:69-77 verbatim. Verified by the CFG-03/T-55-02-01 apply test (asserts the absolute path NEVER appears in the emitted cascade).
- **T-55-02-02 (Information disclosure / orchestrator failure cascade rows)**: MITIGATED. The PerEntryOutcome union's failure variants carry only `reason: Reason` (closed-set); `buildReconcileAppliedCascade` consumes `outcome.reason` only. Raw `error.message` is NEVER read into a row's `reasons` field or anywhere else in the rendered output. Documented contractually in `apply-outcomes.ts` JSDoc.
- **T-55-02-03 (DoS / catastrophic exception blocks Pi load)**: MITIGATED. index.ts wraps applyReconcile in try/catch with a last-ditch error notify (inside its own try/catch); aggregateDiscoveredResources runs unconditionally after. Pi load NEVER blocks (NFR-2). Verified by the NFR-2 boundary-preservation index-handler test.
- **T-55-02-04 (Tampering / mass-uninstall from malformed config)**: MITIGATED. CFG-03 abort: any `invalid` arm in `loadMergedScopeConfig` for a scope skips that scope's planner -- the apply pass for that scope has ZERO buckets. Verified by the CFG-03 apply test (pre-records a `should-stay` marketplace; asserts it persists across the run).
- **T-55-02-05 (Tampering / unmanaged-entry removal)**: MITIGATED. Ownership guard is structural: `planReconcile`'s `marketplacesToRemove` / `pluginsToUninstall` buckets only include entries recorded in state. apply.ts trusts the planner and walks only the plan's buckets -- never scans the filesystem or state.json directly for "extras". RECON-02 apply test verifies the planner-driven invariant.
- **T-55-02-06 (Tampering / double-apply via two concurrent processes)**: PARTIALLY MITIGATED (Plan 03 deferred). Per-scope read pass under withStateGuard serializes the migrate-then-load-then-plan step within a single process. Cross-process double-apply prevention is proven by Plan 03's RECON-06 two-process test (this plan's tests cover single-process behavior only).
- **T-55-02-07 (Repudiation / silent failure on a soft-fail entry)**: MITIGATED. Per-entry try/catch ALWAYS pushes an outcome; the cascade emits a single notify() carrying every outcome. Silent failures are structurally impossible. Verified by the RECON-03 apply test.
- **T-55-02-08 (DoS / reload-hint loop on auto-reconcile cascade)**: MITIGATED. StandaloneKind structurally suppresses `shouldEmitReloadHint`: arm returns `false`. The cascade rows can carry realized transition tokens (`installed` / `uninstalled` / etc.) without ever emitting `Run /reload to pick up changes`. Verified by the grammar-invariant test (`RECON-04: reconcile-applied-cascade NEVER emits /reload to pick up changes ...`) and the per-variant byte-equality test (`RECON-04: success cascade NEVER emits /reload to pick up changes trailer ...`).
- **T-55-02-SC (Package legitimacy)**: N/A -- no new packages installed.

## Threat Flags

None -- no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the threat model already documents.

## Known Stubs

None -- every artifact this plan provides is wired end-to-end and exercised by at least one test.

## Hand-off to Plan 03

- applyReconcile is the orchestrator Plan 03 (RECON-06 two-process race) targets in an integration test. The surface is stable: `applyReconcile({ ctx, pi, cwd, scope?, gitOps? })` -> `Promise<void>`; the per-scope read pass under withStateGuard is the single-process serialization seam Plan 03's two-process test exercises.
- The Phase 52 deferred MIG-01 cross-process lock-coverage obligation discharges in Plan 03 -- this plan's single-process apply tests cover the migrate-then-reconcile ordering rail, but the two-process concurrent-first-load race that withStateGuard is supposed to serialize is Plan 03's integration scope.
- The `gitOps` DI seam in ApplyReconcileOptions is available for Plan 03 to compose network-failure scenarios into the two-process test; production callers (index.ts) continue to omit it.

## Self-Check: PASSED

Verified files exist (apply.ts, apply-outcomes.ts, notify.ts modifications, apply.test.ts, index-handler.test.ts, catalog-uat extensions, notify-v2 extensions):

- extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts -- FOUND
- extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts -- FOUND
- tests/orchestrators/reconcile/apply.test.ts -- FOUND
- tests/edge/index-handler.test.ts -- FOUND

Verified commits exist:

- ffeec66 (Task 1) -- FOUND
- 678fc4b (Task 2) -- FOUND
