# orchestrators/reconcile/

Reconcile family: the declarative-config bridge. It diffs the merged user-authored config (`claude-plugins.json` + `claude-plugins.local.json`) against the recorded extension state (`state.json`), and it compares each installed plugin with its marketplace's catalog. Three entry points use that diff:

- `pendingReconcile` (`/claude:plugin pending`, D-53-01) lists the changes and writes nothing.
- The load (`createLoadReconcile`, session start and `/reload`) prints the same list and changes no installation state (APL-03 / D-02).
- `applyReconcile` (`/claude:plugin apply`, APL-01) drives the mutating orchestrators to the desired state, then converges installed plugins on the catalog (APL-02).

The family follows the same shape as `orchestrators/import/` and `orchestrators/marketplace/`: typed result records, a pure planner, a pure notify projection, and a wrapping orchestrator that does the I/O.

## Files

```text
orchestrators/reconcile/
├── README.md                # this file
├── types.ts                 # ReconcilePlan + per-bucket record types
├── apply-outcomes.ts        # PerEntryOutcome union consumed by the apply cascade
├── plan.ts                  # planReconcile(merged, state, scope, verdict) -- the pure planner
├── dependency-verdict.ts    # buildScopeSatisfactionVerdict -- the offline LOAD-01 verdict the planner takes
├── convergence.ts           # planConvergence -- the offline catalog-move planner that pending, the load and apply share
├── notify.ts                # pure plan-to-rows + outcomes-to-message projections
├── reconcile.messaging.ts   # PENDING_CONTEXT + RECONCILE_APPLIED_CONTEXT row render maps
├── read-pass.ts             # the shared locked, write-free read pass + runScopeIsolated
├── mcp-migration.ts         # the AMIG-01 move of MCP entries out of the legacy mcp.json
├── delisted-plugins.ts      # the unreadable-declarer, refused-marketplace, and {not in manifest} warnings
├── pending.ts               # /claude:plugin pending orchestrator (read-only) + composePendingReport
├── load.ts                  # the read-only load: MIG-01, the MCP move, the pending block, warnings, routing
└── apply.ts                 # /claude:plugin apply orchestrator (plan, then convergence)
```

## Purity discipline

`plan.ts` exports `planReconcile(MergedConfig, ExtensionState, Scope, ScopeSatisfactionVerdict) -> ReconcilePlan`. It is a pure bidirectional 9-bucket diff: no `node:fs`, no `platform/git`, no `notify`, no `saveState` / `saveConfig` / `atomicWriteJson` / `withStateGuard` / `withLockedStateTransaction`. The architecture grep-gate at `test/architecture/reconcile-planner-purity.test.ts` enforces this structurally; the gate operates on the comment-stripped source so the header docstring may legally mention forbidden symbols without self-invalidation.

`notify.ts` exports two pure projections: `buildReconcilePendingNotification(plans, forceInstallKeys, recordedVersions, convergence) -> { marketplaces }` for the pending surface (and the load's block), whose rows are typed `MarketplaceRows<PendingMsg>`, and `buildReconcileAppliedCascade(outcomes) -> ReconcileAppliedCascadeMessage` for the apply surface. Neither projection calls `ctx.ui.notify`; `pending.ts` and `apply.ts` own the single sanctioned `notify()` call per invocation (IL-2).

## The 9-bucket model

The pure planner partitions the union of declared (from `MergedConfig`) and recorded (from `ExtensionState`) entries into nine action buckets:

1. `marketplacesToAdd` -- declared but not recorded (or recorded only under a different name with a matching source -- see CR-01 source-claim below).
2. `marketplacesToRemove` -- recorded but not declared (and not source-claimed by a differently-named declared entry).
3. `pluginsToInstall` -- declared+enabled but not recorded.
4. `pluginsToUninstall` -- recorded but not declared. Plugins under a marketplace in `marketplacesToRemove` are EXCLUDED here -- the apply path's marketplace-remove cascade unstages them, so listing each as a separate uninstall would double-bill the work.
5. `pluginsToEnable` -- declared+enabled AND recorded-but-disabled. The bucket IS populated: `plan.ts` imports `state-io.ts::isRecordedButDisabled`, which reads the record's explicit `enabled: false` boolean and NOTHING else (ENBL-05), and the `plan.ts::classifyDeclaredPlugin` recorded-and-declared-enabled branch pushes onto the bucket when the marker matches. The predicate is deliberately single-axis. The five `resources.*` arrays are not read: emptiness is a consequence of disabling, never the marker. `compatibility.installable` is not read either: availability is an ORTHOGONAL axis, so a soft-degraded record the user disabled is still recognized as disabled, and a degraded record the user never disabled is still materialized.
6. `pluginsToDisable` -- declared with `enabled === false` but still recorded with populated artifacts.
7. `pluginsToDependencyDisable` -- recorded plugins the load-time check holds down, because a dependency they declare is not satisfied in the same scope (LOAD-01). The satisfaction verdict is an INPUT (D-06-04): establishing it reads plugin manifests, which the planner may not do, so the apply path's read pass computes it inside its own locked closure and passes it in. A caller that omits the argument holds no plugin down.
8. `pluginsToDependencyInstall` -- missing declared dependencies of an eligible dependent, one entry per dependency key, deduplicated across every declarer that names it (MISS-01, D-09-01, D-09-02, D-09-05). Derived from the same precomputed satisfaction verdict's `missing` arm; a caller that omits the verdict argument plans no install.
9. `sourceMismatches` -- four per-cause planner diagnostics on one bucket (`source-mismatch`, `unknown-stored`, `dangling-reference`, `malformed-plugin-key`). Each variant carries only the fields its diagnostic actually renders; subjects derive via `types.ts::plannedSourceMismatchSubject` (marketplace name for the first three causes; raw config key for malformed-plugin-key).

Disabled-entry rule: `enabled === false` excludes the plugin from the desired-materialised set; `enabled === true` and `enabled === undefined` include (D-04 consume-time default -- the absent field includes, only explicit `false` excludes).

Plugin keys are flat-keyed `"${plugin}@${marketplace}"` and parsed by `lastIndexOf("@")` so plugin names containing `@` do not collide.

## Sentinel contracts

The planner and the apply path coordinate via one structural sentinel, plus two explicit schema fields. The first of the two REPLACED an earlier structural marker:

- **Explicit `enabled` field for "currently disabled" (ENBL-02 / ENBL-05).** A recorded plugin is currently disabled iff its `enabled` boolean is `false`. `state-io.ts::isRecordedButDisabled` is the single definition and reads that field and NOTHING else; a drift gate asserts no second definition exists, in any spelling.

  This replaced a two-axis structural marker that intersected all-empty `resources.*` with `compatibility.installable === true`. Neither conjunct survives, and the reasons are worth keeping: emptiness is a CONSEQUENCE of disabling rather than the marker, and `installable` tracks availability, which is ORTHOGONAL to user intent. The `installable === true` half was not merely redundant but actively wrong -- a partial install always persists `installable: false`, so the guard excluded exactly the disabled-partial record and no other shape, making every disabled-detection path silently take the wrong branch (ENBL-04 violation, repaired by ENBL-05..09).

- **Explicit `dependencyDisabled` field for "the load-time check put this record down" (LOAD-01 / D-06-02).** The apply path stamps it on every record the dependency-disable step itself flipped from enabled to disabled, which keeps the check's consequence distinguishable from the user's own `disable`. The marker leaves the record when the hold lifts: the enable branch re-runs the install ledger's state phase, and that phase REBUILDS the record from a literal that does not name the field (`install-outcome.ts`). Exactly three readers decide anything on it: `plan.ts::isAlreadyDependencyDisabled`, which keeps a record that is already down out of the dependency-disable bucket (so an unchanged tree re-drives nothing); `dependency-verdict.ts::isDisabledIndependently`, which uses it to tell a dependency the check itself disabled from one the user disabled; and `plan.ts::buildDependencyDisabledLift` (D-09-08), which reads it alongside the live verdict to lift a `provenance: "dependency"` record the check held down onto `pluginsToEnable` whether or not the config names it -- the config-declared lift in `classifyDeclaredPlugin` never reaches such a record (D-04-02). `state-io.ts` only serializes it.

- **Tri-state `samePlannedSource` sentinel.** `domain/source.ts` exports `samePlannedSource(record, declared): "same" | "different" | "unknown-stored"`. Earlier shapes returned `boolean | "unknown-stored"`, which a careless `if (...)` treated as a source match for the `"unknown-stored"` arm. The tri-state cut closes that footgun: every consumer (`plan.ts::diffMarketplaces`, `plan.ts::findRecordedBySource`) must switch on the explicit literal.

## Apply path

`apply.ts::applyReconcile` runs project-then-user (per MSG-GR-3) per scope:

1. **Read pass** (`read-pass.ts::readPassForScope`, shared with the load) under `withLockedStateTransaction` with NO `tx.save()` (WR-05 write-free):

   - Pristine-scope gate (no `state.json` AND no `claude-plugins.{,local.}json`) skips before taking the lock -- no mkdir, no lock file, no generated config.
   - `migrateFirstRunConfig` fires first (MIG-01 first-load: generate `claude-plugins.json` from existing `state.json`, leaving out whatever `claude-plugins.local.json` declares (FIX-02); an unreadable `claude-plugins.local.json` makes it write nothing; idempotent).
   - `loadMergedScopeConfig` produces the merged view + the per-file `ConfigLoadResult`s.
   - CFG-03 invalid-config arms surface as structured `(failed) {invalid manifest}` rows with the file BASENAME (paths redacted per T-55-02-01) -- the planner is SKIPPED for that scope (invalid input is never coerced to an empty desired-state diff).
   - Otherwise the pure `planReconcile` runs.

2. **Apply pass** with NO outer lock (each driven orchestrator owns its own per-scope critical section -- CR-01 / `proper-lockfile` is not re-entrant). Buckets are driven in fixed order so each step's precondition is established by the previous step:

   ```text
   uninstall plugins -> remove marketplaces -> add marketplaces
                     -> install plugins -> install missing dependencies (MISS-01)
                     -> [D-09-07 re-plan when something landed]
                     -> enable plugins -> disable plugins
                     -> dependency-disable plugins (LOAD-01)
                     -> source-mismatch rows (report-only, always round-1)
                     -> converge on the catalog (APL-02)
   ```

   `applyDependencyInstalls` (D-09-06) runs the SAME install cascade `installPlugin` runs, rooted at each missing dependency instead of a user-typed plugin, on every apply (D-02 supersedes D-09-13). When it materialized or found already-present at least one key, `refreshTogglePlan` (D-09-07) re-runs the read pass for this scope and substitutes ONLY `pluginsToEnable`, `pluginsToDisable` and `pluginsToDependencyDisable` from the fresh plan before the toggle steps run -- the uninstall / remove / add / install buckets and the source-mismatch rows always come from round 1, so a round-1 failure is never retried and double-reported. This is what lets a dependent the install just satisfied stay up (or come back up) in the SAME apply.

   The dependency-disable step runs after both toggle steps, so a record the config already disabled answers it idempotently and keeps its marker off (D-06-02). Its own marker write is wrapped in `runScopeIsolated`, so a transient lock or permission failure becomes one `state.json` row instead of discarding the cascade for both scopes.

   The converge step (`convergeScope`) reads the scope's state again, as the earlier steps left it, and runs `convergence.ts::planConvergence` over it. Each planned move runs through the update runner's converge entry (`convergePlugin`, D-26), not through reinstall. A move whose supported component set only grew re-materializes the recorded revision (D-10, D-25). A move that a dependent's range blocks, or that needs `--partial` consent, is not run. It gets the row `pending` lists for it (D-12). A failed move reports `(failed)`, and the next move still runs (D-13). A git target may clone on a cache miss (D-11).

   Each driven orchestrator is invoked with `notifications: { mode: "orchestrated" }` and wrapped in a try/catch ladder that translates typed marketplace/plugin throws (`StateLockHeldError`, `PluginShapeError`, the file-shape probe classifiers) into closed-set `Reason` tokens BEFORE they reach the projection (T-55-02-02: raw `error.message` never reaches the rendered output).

3. **Single notify emission per invocation** (IL-2 / RECON-04). An empty-and-clean `apply` reports `Apply: nothing to change.` through the `reconcile-pending-empty` advisory and writes nothing (APL-01 / D-08); an empty-and-clean load stays SILENT (D-05). Post-commit hygiene warnings (data-dir mkdir deferred, completion-cache refresh deferred, etc.) surface through a sanctioned second `notifyDiagnostic` call (the only exception to RECON-04's single-emit rule), mirroring the import cascade's `pushDiagnostic` channel.

## Load path

`load.ts::createLoadReconcile` builds the load's reconcile step (session start and `/reload`). It changes no installation state (APL-03 / D-02). Per scope, project first, it runs `read-pass.ts::openScopePass` (the read pass with MIG-01 and the legacy state migration, then the AMIG-01 MCP move), and then `closeScopePass` (the unreadable-declarer warning, the `{invalid manifest}` warning for each enabled plugin of a marketplace Claude Code refuses (D-PL5-28), the `{not in manifest}` warnings, and the hook routing rebuild). After both scopes, it builds `pending`'s report with `pending.ts::composePendingReport` over every scope whose read pass did not throw. On a mismatch it prints that block, which ends with the apply trailer and never with the `/reload` hint (D-05, D-06). On a match it prints nothing (RECON-05).

## Pending path

`pending.ts::pendingReconcile` is the read-only mirror: NEVER writes (no `tx.save()`, no `saveConfig`), NEVER touches the network (BLOCK F in `eslint.config.js` lints the reconcile `pending.ts`, `plan.ts`, and `notify.ts` for git surface). It runs `loadMergedScopeConfig` per scope, surfaces CFG-03 and state-load throws as structured `(failed)` basename rows, and otherwise calls `planReconcile` against a synthetic post-migration merged view (`mergedViewForPlanning`) so a pre-migration window (base config absent, populated state) is not misrendered as a mass-uninstall plan. `composePendingReport` builds the report, and the load uses the same function. Per readable scope, it computes the LOAD-01 satisfaction verdict (`dependency-verdict.ts::buildScopeSatisfactionVerdict`) and hands it to the planner, so `pending` lists the dependency disables, lifts and installs that `apply` makes. When the plan installs a missing dependency, `pending` assumes that the install succeeds and re-plans the toggles, as `apply` does (D-09-07). It then runs `convergence.ts::planConvergence` over the final plan and lists the catalog moves, the held moves and the declined moves after the plan's rows. Each invocation dispatches once: `notify()` with the dedicated `ReconcilePendingEmptyMessage` for the empty-steady-state path, otherwise `notifyPendingReport`, which calls `notifyWithContext` with `PENDING_CONTEXT` over the projection's rows merged with the `(failed)` rows and sorted by `compareByNameThenScope`.

## Analog modules

`orchestrators/import/execute.ts` is the closest cascade analog -- its `buildImportNotificationMarketplaces` is the byte-stable template the reconcile notify projection mirrors (same accumulate-blocks-then-sort structure, same `compareByNameThenScope` final sort). `orchestrators/marketplace/info.ts` is the closest read-only orchestrator analog -- its IL-2 single-notify discipline and NFR-5 no-network header annotation are the template `pending.ts` mirrors.
