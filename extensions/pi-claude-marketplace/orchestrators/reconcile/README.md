# orchestrators/reconcile/

Reconcile family: the declarative-config bridge. Each `applyReconcile` (load-time) and `previewReconcile` (read-only `/claude:plugin preview`) invocation diffs the merged user-authored config (`claude-plugins.json` + `claude-plugins.local.json`) against the recorded extension state (`state.json`) and either renders a dry-run cascade (preview) or drives the mutating orchestrators back to convergence (apply).

The family follows the same shape as `orchestrators/import/` and `orchestrators/marketplace/`: typed result records, a pure planner, a pure notify projection, and a wrapping orchestrator that does the I/O.

## Files

```text
orchestrators/reconcile/
├── README.md            # this file
├── types.ts             # ReconcilePlan + per-bucket record types
├── apply-outcomes.ts    # PerEntryOutcome union consumed by the apply cascade
├── plan.ts              # planReconcile(merged, state, scope) -- the pure planner
├── notify.ts            # pure plan-to-message + outcomes-to-message projections
├── preview.ts           # /claude:plugin preview orchestrator (read-only)
└── apply.ts             # load-time apply orchestrator (drives the mutators)
```

## Purity discipline

`plan.ts` exports `planReconcile(MergedConfig, ExtensionState, Scope) -> ReconcilePlan`. It is a pure bidirectional 7-bucket diff: no `node:fs`, no `platform/git`, no `notify`, no `saveState` / `saveConfig` / `atomicWriteJson` / `withStateGuard` / `withLockedStateTransaction`. The architecture grep-gate at `tests/architecture/reconcile-planner-purity.test.ts` enforces this structurally; the gate operates on the comment-stripped source so the header docstring may legally mention forbidden symbols without self-invalidation.

`notify.ts` exports two pure projections: `buildReconcilePreviewNotification(plans) -> CascadeNotificationMessage` for the preview surface and `buildReconcileAppliedCascade(outcomes) -> ReconcileAppliedCascadeMessage` for the apply surface. Neither projection calls `ctx.ui.notify`; `preview.ts` and `apply.ts` own the single sanctioned `notify()` call per invocation (IL-2).

## The 7-bucket model

The pure planner partitions the union of declared (from `MergedConfig`) and recorded (from `ExtensionState`) entries into seven action buckets:

1. `marketplacesToAdd` -- declared but not recorded (or recorded only under a different name with a matching source -- see CR-01 source-claim below).
2. `marketplacesToRemove` -- recorded but not declared (and not source-claimed by a differently-named declared entry).
3. `pluginsToInstall` -- declared+enabled but not recorded.
4. `pluginsToUninstall` -- recorded but not declared. Plugins under a marketplace in `marketplacesToRemove` are EXCLUDED here -- the apply path's marketplace-remove cascade unstages them, so listing each as a separate uninstall would double-bill the work.
5. `pluginsToEnable` -- declared+enabled AND recorded-but-disabled. The bucket IS populated: `plan.ts::isRecordedButDisabled` reads the empty-resources marker (all four `resources.*` arrays empty AND `compatibility.installable === true`) and the `plan.ts::classifyDeclaredPlugin` recorded-and-declared-enabled branch pushes onto the bucket when the marker matches.
6. `pluginsToDisable` -- declared with `enabled === false` but still recorded with populated artefacts.
7. `sourceMismatches` -- four per-cause planner diagnostics on one bucket (`source-mismatch`, `unknown-stored`, `dangling-reference`, `malformed-plugin-key`). Each variant carries only the fields its diagnostic actually renders; subjects derive via `types.ts::plannedSourceMismatchSubject` (marketplace name for the first three causes; raw config key for malformed-plugin-key).

Disabled-entry rule: `enabled === false` excludes the plugin from the desired-materialised set; `enabled === true` and `enabled === undefined` include (D-04 consume-time default -- the absent field includes, only explicit `false` excludes).

Plugin keys are flat-keyed `"${plugin}@${marketplace}"` and parsed by `lastIndexOf("@")` so plugin names containing `@` do not collide.

## Sentinel contracts

The planner and the apply path coordinate via two structural sentinels (no new schema fields):

- **Empty-resources marker for "currently disabled" (ENBL-02 / A1).** A recorded plugin whose `resources.{skills,prompts,agents,mcpServers}` arrays are ALL empty AND whose `compatibility.installable === true` is treated as currently disabled. The disable orchestrator empties the resource arrays while preserving the version pin AND the `installable: true` flag, so the empty-resources + installable-true intersection is the unambiguous "currently disabled" marker. `installable === true` is load-bearing: a soft-degraded (`installable: false`) plugin -- e.g. one whose companion extension is missing -- legally records all four resource arrays empty too, so without the guard the `state-populated-mixed.json` fixture's soft-degraded entry would be misclassified as `pluginsToEnable`.

- **Tri-state `samePlannedSource` sentinel.** `domain/source.ts` exports `samePlannedSource(record, declared): "same" | "different" | "unknown-stored"`. Earlier shapes returned `boolean | "unknown-stored"`, which a careless `if (...)` treated as a source match for the `"unknown-stored"` arm. The tri-state cut closes that footgun: every consumer (`plan.ts::diffMarketplaces`, `plan.ts::findRecordedBySource`) must switch on the explicit literal.

## Apply path

`apply.ts::applyReconcile` runs project-then-user (per MSG-GR-3) per scope:

1. **Read pass** under `withLockedStateTransaction` with NO `tx.save()` (WR-05 write-free):

   - Pristine-scope gate (no `state.json` AND no `claude-plugins.{,local.}json`) skips before taking the lock -- no mkdir, no lock file, no generated config.
   - `migrateFirstRunConfig` fires first (MIG-01 first-load: generate `claude-plugins.json` from existing `state.json`; idempotent).
   - `loadMergedScopeConfig` produces the merged view + the per-file `ConfigLoadResult`s.
   - CFG-03 invalid-config arms surface as structured `(failed) {invalid manifest}` rows with the file BASENAME (paths redacted per T-55-02-01) -- the planner is SKIPPED for that scope (invalid input is never coerced to an empty desired-state diff).
   - Otherwise the pure `planReconcile` runs.

2. **Apply pass** with NO outer lock (each driven orchestrator owns its own per-scope critical section -- CR-01 / `proper-lockfile` is not re-entrant). Buckets are driven in fixed order so each step's precondition is established by the previous step:

   ```text
   uninstall plugins -> remove marketplaces -> add marketplaces
                     -> install plugins -> enable plugins -> disable plugins
                     -> source-mismatch rows (report-only)
   ```

   Each driven orchestrator is invoked with `notifications: { mode: "orchestrated" }` and wrapped in a try/catch ladder that translates typed marketplace/plugin throws (`StateLockHeldError`, `PluginShapeError`, the file-shape probe classifiers) into closed-set `Reason` tokens BEFORE they reach the projection (T-55-02-02: raw `error.message` never reaches the rendered output).

3. **Single notify emission per invocation** (IL-2 / RECON-04). Empty-and- clean reconciles are SILENT (NFR-2). Post-commit hygiene warnings (data-dir mkdir deferred, completion-cache refresh deferred, etc.) surface through a sanctioned second `notifyDiagnostic` call (the only exception to RECON-04's single-emit rule), mirroring the import cascade's `pushDiagnostic` channel.

## Preview path

`preview.ts::previewReconcile` is the read-only mirror: NEVER writes (no `tx.save()`, no `saveConfig`), NEVER touches the network (the architecture grep-gate at `tests/architecture/no-orchestrator-network.test.ts` arms this file). It runs `loadMergedScopeConfig` per scope, surfaces CFG-03 and state-load throws as structured `(failed)` basename rows, and otherwise calls `planReconcile` against a synthetic post-migration merged view (`mergedViewForPlanning`) so a pre-migration window (base config absent, populated state) is not misrendered as a mass-uninstall plan. The single `notify()` call dispatches the `CascadeNotificationMessage` from the projection, or the dedicated `ReconcilePreviewEmptyMessage` for the empty-steady-state path.

## Analog modules

`orchestrators/import/execute.ts` is the closest cascade analog -- its `buildImportNotificationMarketplaces` is the byte-stable template the reconcile notify projection mirrors (same `MarketplaceBlock` shape, same `ensureMarketplaceBlock(byMp, scope, mpName)` factory, same `compareByNameThenScope` final sort). `orchestrators/marketplace/info.ts` is the closest read-only orchestrator analog -- its IL-2 single-notify discipline and NFR-5 no-network grep-gate annotation are the template `preview.ts` mirrors.
