# orchestrators/reconcile/

Reconcile family for the v1.12 Marketplace and Plugin Config Files milestone. This directory is the foundation of the Phase 53 user-visible diff/preview surface and the Phase 55 load-time apply path. The family follows the same shape as `orchestrators/import/` and `orchestrators/marketplace/`: typed result records, a pure planner, a pure notify projection, and a wrapping orchestrator that does the I/O. Phase 53 Plan 01 lands the pure half; Plan 02 lands the user-visible bytes; Phase 55 lands the apply path.

## Purity discipline

`plan.ts` exports `planReconcile(MergedConfig, ExtensionState, Scope) -> ReconcilePlan`. It is a pure bidirectional 7-bucket diff: no `node:fs`, no `platform/git`, no `notify`, no `saveState` / `saveConfig` / `atomicWriteJson` / `withStateGuard` / `withLockedStateTransaction`. The architecture grep-gate at `tests/architecture/reconcile-planner-purity.test.ts` enforces this structurally; the gate operates on the comment-stripped source so the header docstring may legally mention forbidden symbols without self-invalidation.

`notify.ts` exports `buildReconcilePreviewNotification(plans) -> CascadeNotificationMessage`. It is also pure -- a plan-to-message projection that never calls `ctx.ui.notify`. The Plan 02 preview orchestrator owns the actual `notify()` call; this projection is its caller-visible seam.

## The 7-bucket model

The pure planner partitions the union of declared (from `MergedConfig`) and recorded (from `ExtensionState`) entries into seven action buckets:

1. `marketplacesToAdd` -- declared but not recorded
2. `marketplacesToRemove` -- recorded but not declared
3. `pluginsToInstall` -- declared+enabled but not recorded
4. `pluginsToUninstall` -- recorded but not declared
5. `pluginsToEnable` -- structurally empty in Phase 53 (Phase 54 wires this once the state model carries a "currently disabled" marker)
6. `pluginsToDisable` -- declared with `enabled === false` but still recorded
7. `sourceMismatches` -- declared marketplace whose recorded source diverges (cause: `"source-mismatch"`) or whose stored record is in an unrecognised shape (cause: `"unknown-stored"`)

Disabled-entry rule (Pitfall 53-2): `enabled === false` excludes from the desired-materialised set; `enabled === true` and `enabled === undefined` include (D-04 consume-time default -- the absent field includes, only explicit `false` excludes).

Plugin keys are flat-keyed `"${plugin}@${marketplace}"` and parsed by `lastIndexOf("@")` so plugin names containing `@` do not collide (Pitfall 52-6).

A plugin entry whose `${plugin}@${marketplace}` marketplace name appears in neither map is recorded as a `PlannedSourceMismatch` with `declaredSource: ""` and `recordedSource: "<marketplace not declared>"` (stable sentinel). Phase 55 surfaces this as a planning-time advisory.

## Phase 54 hand-off (enable/disable)

Phase 53 produces `pluginsToEnable` as structurally empty. The Phase 53 state model has no "currently disabled" marker on a recorded plugin, so the planner cannot distinguish recorded-and-enabled from recorded-and-locally-disabled. Phase 54 introduces the marker, and the planner's declared+enabled-AND-recorded branch will split on `state.disabled === true` to populate the bucket.

The disable bucket is fully populated in Phase 53: a declared entry with `enabled === false` that is still recorded routes here, and the apply path will drop the materialised artefacts without removing the state record's version pin (D-04 / ENBL-02).

## Plan 01 vs Plan 02 split

| Concern                                             | Plan 01                                                     | Plan 02                                                                                                       |
| --------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `types.ts` / `plan.ts` / `notify.ts`                | Land as pure code                                           | Untouched                                                                                                     |
| Purity grep-gate                                    | Lands and is GREEN                                          | Stays GREEN                                                                                                   |
| Convergence proof (Phase 52 deferred)               | Lands in `plan-convergence.test.ts`                         | Stays GREEN                                                                                                   |
| `notify.ts` placeholder status strings              | `"added"`/`"removed"`/`"failed"` and child-row placeholders | Replaced with `will add` / `will remove` / `will install` / `will uninstall` / `will enable` / `will disable` |
| `shared/notify.ts` token additions                  | None                                                        | 6 new `STATUS_TOKENS` literals + per-variant interfaces                                                       |
| `docs/output-catalog.md` states                     | None                                                        | 6 new catalog states for the preview surface                                                                  |
| `tests/architecture/catalog-uat.test.ts` `FIXTURES` | None                                                        | Byte-exact fixture lockstep with the new catalog states                                                       |
| `previewReconcile` orchestrator (`preview.ts`)      | None                                                        | Lands with the read-only diff command                                                                         |
| Edge handler (`edge/handlers/plugin/preview.ts`)    | None                                                        | Lands with the router + completion provider edits                                                             |

This split exists because the pending-tense token set MUST land in lockstep with the catalog states and the catalog-uat FIXTURES (the byte-equality gate would go RED between an interim token addition and its fixture support). Pitfall 53-3 atomic-supersession discipline. Plan 01 stays byte-neutral on `shared/notify.ts` so Plan 02 has a clean atomic landing zone.

## Analog modules

`orchestrators/import/execute.ts` is the closest analog -- its `buildImportNotificationMarketplaces` is the byte-stable template the reconcile notify projection mirrors (same `MarketplaceBlock` shape, same `ensureMarketplaceBlock(byMp, scope, mpName)` factory, same `compareByNameThenScope` final sort). `orchestrators/marketplace/info.ts` is the closest read-only orchestrator analog -- its header docstring discipline (the IL-2 single-notify contract; the NFR-5 no-network grep-gate annotation) is the template the Plan 02 preview orchestrator will mirror.

## Files this directory will hold once Plan 02 lands

```text
orchestrators/reconcile/
├── README.md
├── types.ts        # Plan 01 (this plan)
├── plan.ts         # Plan 01 (this plan)
├── notify.ts       # Plan 01 (this plan)
└── preview.ts      # Plan 02
```
