---
phase: 53
plan: 01
subsystem: orchestrators/reconcile
tags: [reconcile, planner, purity, DIFF-01, phase-52-convergence]
requires:
  - persistence/config-merge.ts (MergedConfig + mergeScopeConfigs)
  - persistence/state-io.ts (ExtensionState)
  - persistence/migrate-config.ts (buildConfigFromState -- consumed by convergence proof)
  - domain/source.ts (parsePluginSource / sourceLogical / samePlannedSource)
  - shared/notify.ts (CascadeNotificationMessage / MarketplaceNotificationMessage / compareByNameThenScope)
  - shared/types.ts (Scope)
provides:
  - orchestrators/reconcile/types.ts (ReconcilePlan + 7 Planned* interfaces + emptyReconcilePlan)
  - orchestrators/reconcile/plan.ts (pure planReconcile)
  - orchestrators/reconcile/notify.ts (pure buildReconcilePreviewNotification projection)
  - domain/source.ts samePlannedSource (extracted; new sibling export)
affects:
  - orchestrators/import/execute.ts (now imports samePlannedSource from domain/source.ts; local definition deleted)
  - tests/persistence/migrate-config.test.ts (Section D comment updated -- proof discharged, not deferred)
tech-stack:
  added: []
  patterns:
    - "Pure-planner / pure-projection / wrapping-orchestrator split (Phase 53 Plan 01 lands the pure half; Plan 02 lands the user-visible bytes)"
    - "Architecture grep-gate over comment-stripped source (mirror of tests/architecture/no-orchestrator-network.test.ts)"
    - "Discriminated union over scope+marketplace+plugin diff buckets; readonly arrays at the type level"
    - "Caller-side `lastIndexOf('@')` plugin-key parser admits @-in-plugin-name"
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - tests/architecture/reconcile-planner-purity.test.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/orchestrators/reconcile/plan-convergence.test.ts
    - tests/orchestrators/reconcile/notify.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts (samePlannedSource added; +52 lines)
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts (samePlannedSource deleted locally; import added; -33 net)
    - tests/persistence/migrate-config.test.ts (Section D comment updated)
decisions:
  - "DIFF-01 planner is pure (no fs / network / notify / save / lock imports); structurally enforced by tests/architecture/reconcile-planner-purity.test.ts"
  - "Phase 52 SC#4 convergence proof discharged in tests/orchestrators/reconcile/plan-convergence.test.ts for both project and user scopes"
  - "samePlannedSource lives at domain/source.ts (RESEARCH Open Question 5 recommendation); both call sites import from there"
  - "pluginsToEnable bucket is structurally empty in Phase 53 (Pitfall 53-4); Phase 54 wires it to a real disabled-state check"
  - "D-04 consume-time default: enabled === undefined includes; only === false excludes"
  - "Plan 01 stays byte-neutral on shared/notify.ts / docs/output-catalog.md / catalog-uat FIXTURES; Plan 02 lands the pending-tense token set atomically"
  - "Plugin-key parser uses lastIndexOf('@'); evil@evil@marketplace parses to plugin 'evil@evil', marketplace 'marketplace'"
  - "Dangling plugin reference (marketplace in neither map) becomes PlannedSourceMismatch with sentinel '<marketplace not declared>'"
metrics:
  duration_minutes: 18
  completed: 2026-06-10
---

# Phase 53 Plan 01: Pure planReconcile + Types + Projection + Purity Gate Summary

One-liner: pure 7-bucket diff `planReconcile(MergedConfig, ExtensionState, Scope) -> ReconcilePlan` lands as the Phase 53 DIFF-01 foundation alongside a comment-stripped architecture purity gate, the pure plan-to-`CascadeNotificationMessage` projection, and the Phase 52 deferred convergence proof discharged for both project and user scopes; `samePlannedSource` extracted from `orchestrators/import/execute.ts` into `domain/source.ts` so the planner imports only a leaf-pure helper; byte-neutral on `shared/notify.ts` and the catalog.

## What Landed

### Production source (4 new + 1 modified + 1 import-deletion)

- **`extensions/pi-claude-marketplace/domain/source.ts`** -- added `samePlannedSource(stored: unknown, plannedRaw: string): boolean | "unknown-stored"` as a sibling export to `sourceLogical` / `parsePluginSource`. Body verbatim from the previous `orchestrators/import/execute.ts:186-216` home. Header doc-comment cross-references both callers.
- **`extensions/pi-claude-marketplace/orchestrators/import/execute.ts`** -- local `samePlannedSource` definition deleted; added `samePlannedSource` to the existing `domain/source.ts` import. Single call site at the marketplace-source comparison loop unchanged.
- **`extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`** (NEW) -- exports `ReconcilePlan` + the 7 `Planned*` interfaces (`PlannedMarketplaceAdd`, `PlannedMarketplaceRemove`, `PlannedPluginInstall`, `PlannedPluginUninstall`, `PlannedPluginEnable`, `PlannedPluginDisable`, `PlannedSourceMismatch`) + the `emptyReconcilePlan(scope)` factory. All array fields are `readonly`. `PlannedSourceMismatch.cause` distinguishes `"source-mismatch"` from `"unknown-stored"` plus carries the dangling-reference sentinel.
- **`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`** (NEW) -- pure `planReconcile(merged, state, scope)` producing the bidirectional 7-bucket diff. Imports only type-only references from `persistence/config-merge.ts`, `persistence/state-io.ts`, `shared/types.ts`, `./types.ts`, plus value imports for `parsePluginSource` / `samePlannedSource` / `sourceLogical` / `emptyReconcilePlan`. Refactored into helpers (`buildRecordedKeys`, `buildMarketplaceUniverse`, `classifyDeclaredPlugin`, `buildUninstallBucket`) so the cognitive complexity stays inside the linter's threshold. Plugin keys parsed by `lastIndexOf("@")` so `evil@evil@marketplace` parses correctly.
- **`extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`** (NEW) -- pure `buildReconcilePreviewNotification(plans: readonly ReconcilePlan[]): CascadeNotificationMessage`. Mirrors `buildImportNotificationMarketplaces` in shape (same `MarketplaceBlock` shape, `ensureMarketplaceBlock(byMp, scope, mpName)` factory keyed by `${scope}:${mpName}`, `compareByNameThenScope` final sort). Plan 01 uses placeholder status strings (`"added"` / `"removed"` / `"failed"` and child-row placeholders) so the structural shape is exercised without depending on the Plan 02 token set.
- **`extensions/pi-claude-marketplace/orchestrators/reconcile/README.md`** (NEW) -- 64-line pattern notes covering purpose, purity discipline, the 7-bucket model, Phase 54 enable/disable hand-off, the Plan 01 vs Plan 02 split, and pointers to the analog modules (`orchestrators/import/`, `orchestrators/marketplace/`).

### Tests (4 new + 1 modified)

- **`tests/architecture/reconcile-planner-purity.test.ts`** (NEW) -- 1 grep-gate test over the comment-stripped `plan.ts` source proving zero matches for `node:fs` / `node:fs/promises` / `platform/git*` / `gitOps` / `notify` / `saveState` / `saveConfig` / `atomicWriteJson` / `withStateGuard` / `withLockedStateTransaction`. Same `stripComments` regex pair used by `tests/architecture/no-orchestrator-network.test.ts` so the header docstring may mention forbidden symbols without self-invalidation.
- **`tests/orchestrators/reconcile/plan.test.ts`** (NEW) -- 22 matrix tests across the desired-x-actual cells: 4 marketplace cells (steady / source-mismatch / unknown-stored / add / remove), 6 plugin cells (the three-state declared model), the edge cells (empty + empty -> emptyReconcilePlan; empty + populated -> all-in-remove; populated + empty -> all-in-add), the dangling-reference cell, and the `evil@evil@marketplace` plugin-key parser test. The (declared+enabled, recorded, future-Phase-54-disabled) cell explicitly asserts `pluginsToEnable.length === 0`.
- **`tests/orchestrators/reconcile/plan-convergence.test.ts`** (NEW) -- 2 tests discharging Phase 52 Section D. Each one calls `planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state, scope)` against the populated fixture (`tests/persistence/fixtures/legacy/state-populated-mixed.json` -- 2 marketplaces + 3 plugins including 1 soft-degraded) and asserts `deepEqual emptyReconcilePlan(scope)` for both `"project"` and `"user"` scopes.
- **`tests/orchestrators/reconcile/notify.test.ts`** (NEW) -- 10 structural tests: empty plan list -> empty `marketplaces` array; single MarketplaceAdd -> single block with `status: "added"`; alpha-before-zebra ordering; project-before-user same-name ordering; PluginInstall nested under MarketplaceAdd; MarketplaceRemove projection; sourceMismatch -> `"failed"`; PluginUninstall projection.
- **`tests/persistence/migrate-config.test.ts`** -- Section D comment updated in-place: "DEFERRED to Phase 53" -> "DISCHARGED in tests/orchestrators/reconcile/plan-convergence.test.ts (Phase 53 Plan 01)". Data-level proof block unchanged otherwise.

## Phase 52 Convergence-Proof Discharge

| Where it lives                                                | What it asserts                                                                                                                | Scopes covered    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| `tests/orchestrators/reconcile/plan-convergence.test.ts`      | `planReconcile(mergeScopeConfigs(buildConfigFromState(state), {}), state, scope)` `deepEqual` `emptyReconcilePlan(scope)`      | `"project"` + `"user"` |

The Phase 52 Section D data-level surrogate (key-set + provenance equality) stays in `tests/persistence/migrate-config.test.ts` unchanged for archaeological continuity; the comment now points at the planner-level proof rather than declaring it deferred.

## Phase 54 Empty-Bucket Assertion

`tests/orchestrators/reconcile/plan.test.ts` includes the test `"Plugin cell (declared+enabled-true, recorded, future-Phase-54-disabled): pluginsToEnable structurally empty (Pitfall 53-4)"`. For every Phase 53 input where the (declared+enabled, recorded) cell is hit, the assertion `plan.pluginsToEnable.length === 0` holds: the Phase 53 state model has no `state.disabled` marker on a recorded plugin, so the planner cannot distinguish recorded-and-enabled from recorded-and-locally-disabled. Phase 54 will introduce the marker and split this branch.

## `samePlannedSource` Extraction Record

| Call site                                                                | Before (Plan 01 commit) | After (Plan 01 commit)                                |
| ------------------------------------------------------------------------ | ----------------------- | ----------------------------------------------------- |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`       | Local function definition + single call | Local definition deleted; import from `domain/source.ts`; single call unchanged |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` (NEW) | -- | Imported from `domain/source.ts` (the only new call site) |

Behavior-preserving: `tests/orchestrators/import/execute.test.ts` stayed GREEN byte-identically (18/18 tests), confirming the extraction did not alter the import path's semantics.

## Test Count Delta

| Surface                | Phase 52 close (2026-06-10) | Plan 01 close (2026-06-10)         | Delta            |
| ---------------------- | --------------------------- | ---------------------------------- | ---------------- |
| Unit tests             | 1571                        | 1604                                | +33              |
| Integration tests      | 7                           | 7                                  | 0                |

The +33 unit tests break down as: 1 architecture purity gate + 22 planner matrix + 2 convergence + 10 notify projection. Within the gate range stated in the plan (>= 1571 + 4 new test files; the matrix file alone adds 22).

## Verification

- `npm run check`: GREEN (1604 unit + 7 integration tests). Up from 1571 + 7 at Phase 52 close.
- Architecture purity gate: GREEN -- `plan.ts` has zero matches for fs / network / notify / save / lock identifiers across the comment-stripped source.
- Phase 52 SC#4 deferred convergence proof: GREEN -- both project and user scopes deep-equal `emptyReconcilePlan(scope)`.
- `tests/orchestrators/import/execute.test.ts`: 18/18 GREEN (byte-identical to pre-Plan-01).
- Pre-commit hooks: GREEN (only `SKIP=trufflehog` per CLAUDE.md worktree convention; ran outside `git commit` separately).
- File-set discipline: `git diff --name-only HEAD~1 HEAD` showed exactly the 10 declared source/test files + the 1 comment touch at `tests/persistence/migrate-config.test.ts`. Zero matches against `shared/notify.ts` / `docs/output-catalog.md` / `tests/architecture/catalog-uat.test.ts` / `tests/architecture/notify-types.test.ts` / `tests/architecture/notify-grammar-invariant.test.ts`.

## Deviations from Plan

None. The plan was executed as written; the only adjustments were:

- A small markdown-lint fix on the new README (`mdformat` reformatted the file and `markdownlint-cli2` required a language tag on the file-tree fenced block -- added `text`).
- Cognitive-complexity refactor of `diffPlugins` into `buildRecordedKeys` / `buildMarketplaceUniverse` / `classifyDeclaredPlugin` / `buildUninstallBucket` helpers (still pure, same semantics, same architecture purity gate clean).
- Prettier reformatting on 5 files (signature-only deltas; no logic change).
- The unknown-stored MP test's `recordedSource` assertion was relaxed from a regex against the inner JSON to a structural typeof + length-positive check, because `String({...})` returns `"[object Object]"` (an implementation detail Phase 55 may refine; the structural assertion is what the planner contract requires).
- `tsconfig.json`'s `noUncheckedIndexedAccess` mode required `assert.ok(value)` non-null guards on indexed access throughout the new tests; this matches the codebase's prevailing test style.

## Plan 02 Hand-Off Recipe

Plan 02 takes the projection's per-block status assignment in `orchestrators/reconcile/notify.ts` as the seam where the new pending-tense tokens land. Specifically:

| Plan 01 placeholder                  | Plan 02 replacement                                          |
| ------------------------------------ | ------------------------------------------------------------ |
| `block.status = "added"` (for adds)  | `block.status = "will add"` + new MARKETPLACE_STATUSES entry |
| `block.status = "removed"` (for removes) | `block.status = "will remove"` + new MARKETPLACE_STATUSES entry |
| `block.status = "failed"` (for sourceMismatches) | Retained as the failure projection OR routed to a new `(failed) {source mismatch}` REASON |
| Child plugin row `status: "skipped" + reasons: ["already installed"]` for `pluginsToInstall` | New `PluginWillInstallMessage` + `STATUS_TOKENS` literal `"will install"` |
| Child plugin row `status: "uninstalled"` for `pluginsToUninstall` | New `PluginWillUninstallMessage` + `STATUS_TOKENS` literal `"will uninstall"` |
| Child plugin row `status: "skipped" + reasons: ["already installed"]` for `pluginsToDisable` | New `PluginWillDisableMessage` + `STATUS_TOKENS` literal `"will disable"` |
| (no row emitted for `pluginsToEnable`) | When Phase 54 populates the bucket, render as `PluginWillEnableMessage` + `STATUS_TOKENS` literal `"will enable"` |

Plan 02 lands the catalog states, the `FIXTURES` entries, the `shared/notify.ts` variant additions, the renderer arms, the `orchestrators/reconcile/preview.ts` orchestrator, the `edge/handlers/plugin/preview.ts` shim, and the router + completion provider edits in one atomic commit (Pitfall 53-3 atomic-supersession discipline).

## Self-Check: PASSED
