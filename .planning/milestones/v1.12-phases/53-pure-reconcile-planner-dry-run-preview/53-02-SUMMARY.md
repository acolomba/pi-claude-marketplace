---
phase: 53
plan: 02
subsystem: orchestrators/reconcile + shared/notify + edge/handlers/plugin
tags: [reconcile, preview, DIFF-01, DIFF-02, atomic-supersession]
requires:
  - orchestrators/reconcile/plan.ts (Plan 01 pure planner)
  - orchestrators/reconcile/types.ts (Plan 01 7-bucket types)
  - orchestrators/reconcile/notify.ts (Plan 01 projection skeleton; Plan 02 swaps placeholder tokens)
  - persistence/config-merge.ts (loadMergedScopeConfig + CFG-03 trichotomy)
  - persistence/state-io.ts (loadState)
  - persistence/locations.ts (locationsFor + configJsonPath / configLocalJsonPath)
  - shared/notify.ts (notify entry + closed-set tuples + discriminated union)
provides:
  - extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts (previewReconcile + PreviewReconcileOptions)
  - extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts (makePreviewHandler)
  - shared/notify.ts will-* token set + variants + renderer arms + reconcile-preview-empty standalone variant
  - orchestrators/reconcile/notify.ts isReconcilePlanListEmpty
  - docs/output-catalog.md `## /claude:plugin preview` H2 section with 6 catalog states
affects:
  - edge/router.ts (preview added to TOP_LEVEL_SUBCOMMANDS + SubcommandHandlers + switch + TOP_LEVEL_USAGE)
  - edge/register.ts (makePreviewHandler wired)
  - edge/handlers/tools.ts (4 new will-* arms in projectRowStatus / pluginScopeOrFallback / pluginVersion exhaustive switches)
  - orchestrators/plugin/list.ts (scopeOf closure extended with 4 will-* arms)
  - tests/edge/completions/provider.test.ts (TC-1 top-level keywords list now includes preview)
  - tests/edge/router.test.ts (handlers literal gains preview)
tech-stack:
  added: []
  patterns:
    - "Atomic-supersession lockstep: 6 STATUS_TOKENS + variants + renderer arms + catalog states + UAT FIXTURES + length-locks + FORBIDDEN_TARGETS extension all in ONE commit (Pitfall 53-3; v1.3/v1.10/v1.11 lineage)"
    - "Dedicated standalone-dispatched variant (reconcile-preview-empty) for the empty advisory body so the catalog-uat exercises the empty path through the same public notify() surface as every other variant"
    - "Read-only orchestrator with CFG-03 invalid-arm short-circuit BEFORE planReconcile (Pitfall 53-1) -- invalid input never coerced into empty desired state"
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts
    - tests/orchestrators/reconcile/preview.test.ts
    - tests/edge/handlers/plugin/preview.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - tests/architecture/notify-types.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - tests/shared/notify-v2.test.ts
    - tests/orchestrators/reconcile/notify.test.ts
    - tests/edge/router.test.ts
    - tests/edge/completions/provider.test.ts
decisions:
  - "D-53-02 user-locked: tokens render as `will *` (pending-tense) NOT `to *` -- verified zero occurrences of `to install` / `to add` etc. in the new content"
  - "Pitfall 53-7 honored: source-mismatch row reuses existing `source mismatch` REASONS member; invalid-config row reuses existing `invalid manifest` REASONS member -- REASONS stays at 29 entries"
  - "Empty-steady-state body routed through a new `reconcile-preview-empty` standalone-dispatched variant whose renderer arm hard-codes the catalog-locked advisory line so the byte form cannot drift from docs/output-catalog.md"
  - "CFG-03 abort (Pitfall 53-1): preview.ts inspects outcome.base.status AND outcome.local.status BEFORE planReconcile; invalid arm emits (failed) {invalid manifest} carrying path.basename (T-53-02-02 information-disclosure mitigation -- absolute path NEVER emitted) and SKIPS the planner for that scope"
  - "Glyph dispatch per RESEARCH Pattern 5 sub-decision: will add/install/enable -> ICON_INSTALLED; will remove/uninstall -> ICON_AVAILABLE (open circle); will disable -> ICON_UNINSTALLABLE (⊘). Zero new icon constants."
  - "Phase 54 hand-off shape: PluginWillEnableMessage variant + renderer arm + catalog state ship in Phase 53 but the planner produces zero of them (Pitfall 53-4); Phase 54 wires pluginsToEnable to a real disabled-state check"
metrics:
  duration_minutes: 32
  completed: 2026-06-10
---

# Phase 53 Plan 02: /claude:plugin preview + 6 pending-tense will-* tokens Summary

One-liner: `/claude:plugin preview` ships as a read-only, no-network, no-write subcommand emitting subject-first `(will ...)` rows through the structured `notify()` v2 cascade; 6 new closed-set will-* tokens + 4 plugin variants + 2 marketplace variants + 6 renderer arms + 6 catalog states + 6 catalog-uat FIXTURES entries + length-lock bumps + FORBIDDEN_TARGETS extension + a 7th `reconcile-preview-empty` standalone variant for the empty-steady-state advisory all land in ONE atomic commit per the v1.3/v1.10/v1.11 atomic-supersession lineage (Pitfall 53-3); CFG-03 abort (Pitfall 53-1) routes invalid base/local config to a `(failed) {invalid manifest}` row carrying `path.basename` (NEVER the absolute path -- T-53-02-02 information-disclosure mitigation) and SKIPS `planReconcile` for that scope; idempotency proof + no-mutation proof + scope fan-out + IL-2 single-notify all GREEN; `npm run check` 1629 unit + 7 integration tests (vs 1604 + 7 at Phase 53 Plan 01 close, +25 new unit tests).

## 19-File Diff Summary (one bullet per file)

### New production source (2)

- **`extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts`** (NEW, 131 lines) -- `previewReconcile(opts)` read-only orchestrator: scope fan-out (project-first per MSG-GR-3 when `--scope` omitted), `loadMergedScopeConfig` + CFG-03 trichotomy inspection, BUILD `(failed) {invalid manifest}` row with `path.basename(filePath)` for any invalid arm (Pitfall 53-1), SKIP `planReconcile` for that scope, accumulate plans + invalid blocks across scopes; empty case dispatches `{ kind: "reconcile-preview-empty" }`; non-empty composes a `CascadeNotificationMessage` and emits via exactly ONE `notify()` call (IL-2). NFR-5 enforced structurally by `tests/architecture/no-orchestrator-network.test.ts`.
- **`extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts`** (NEW, 64 lines) -- `makePreviewHandler(pi)` thin shim: `parseArgs` -> reject unknown flags + positionals via `notifyUsageError`, dispatch to `previewReconcile`. USAGE string `"Usage: /claude:plugin preview [--scope user|project]"`.

### Modified production source (6)

- **`extensions/pi-claude-marketplace/shared/notify.ts`** -- 6 new `STATUS_TOKENS` entries (`"will add"`, `"will remove"`, `"will install"`, `"will uninstall"`, `"will enable"`, `"will disable"`), 2 new `MARKETPLACE_STATUSES` entries, 4 new `PLUGIN_STATUSES` entries; 4 new plugin variant interfaces (`PluginWillInstallMessage` / `PluginWillUninstallMessage` / `PluginWillEnableMessage` / `PluginWillDisableMessage`) joined to the discriminated union; 2 new marketplace variants (`MpWillAdd` / `MpWillRemove`); 6 new renderer arms (2 in `renderMpHeader`, 4 in `renderPluginRow`); new `ReconcilePreviewEmptyMessage` standalone-dispatched variant with hard-coded body in `dispatchInfoMessage`; `isInfoKind` extended with the new kind; `computeSeverity` / `buildSummaryLine` / `shouldEmitReloadHint` extended with the new arm (info / empty / false respectively).
- **`extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`** -- Plan 01 placeholder status strings (`"added"` / `"removed"` / `"skipped"+"already installed"` / `"uninstalled"`) replaced with the real pending-tense set (`"will add"` / `"will remove"` / `"will install"` / `"will uninstall"` / `"will disable"` / `"will enable"`); source-mismatch block carries `reasons: ["source mismatch"]` (Pitfall 53-7 -- reuses existing REASONS member; no new literal); `isReconcilePlanListEmpty(plans)` exported for the orchestrator's empty-case short-circuit.
- **`extensions/pi-claude-marketplace/edge/router.ts`** -- `"preview"` added to `TOP_LEVEL_SUBCOMMANDS` (alphabetical: after `"info"`); `preview` field added to `SubcommandHandlers` interface; `case "preview":` arm added to `routeClaudePlugin` switch (alphabetical placement); `preview [--scope user|project]` line added to `TOP_LEVEL_USAGE` block; updated header summary string to include `preview`. The completion provider auto-picks up `"preview"` via its existing `TOP_LEVEL_SUBCOMMANDS` iteration (no edit there).
- **`extensions/pi-claude-marketplace/edge/register.ts`** -- `makePreviewHandler` imported; `preview: makePreviewHandler(pi)` added to the `SubcommandHandlers` literal in `registerClaudePluginCommand`.
- **`extensions/pi-claude-marketplace/edge/handlers/tools.ts`** -- 4 new will-* arms added to the exhaustive switches in `projectRowStatus` / `pluginScopeOrFallback` / `pluginVersion`; all are unreachable on the list-tool surface and route to the same throw / fallback / `undefined` paths as the existing cascade-only variants (preserves the type-exhaustiveness gate without changing list-tool behavior).
- **`extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`** -- `scopeOf` closure extended with the same 4 will-* arms returning `marketplaceScope` (unreachable on the list orchestrator).

### Docs / catalog (1)

- **`docs/output-catalog.md`** -- new `## /claude:plugin preview` H2 section with section-intro prose and 6 catalog states:
  - `<!-- catalog-state: empty-steady-state -->` -> `Preview: next reload will apply 0 actions.`
  - `<!-- catalog-state: mp-add-plugin-install -->` -> `● new-mp [user] (will add)\n  ● new-plugin (will install)`
  - `<!-- catalog-state: plugin-pending-uninstall -->` -> `● mp [user]\n  ○ old-plugin (will uninstall)`
  - `<!-- catalog-state: enable-disable-transitions -->` -> `● mp [user]\n  ● to-enable (will enable)\n  ⊘ to-disable (will disable)`
  - `<!-- catalog-state: source-mismatch -->` -> `1 marketplace operation failed.\n\n⊘ mp [project] (failed) {source mismatch}`
  - `<!-- catalog-state: invalid-config-abort -->` -> `1 marketplace operation failed.\n\n⊘ claude-plugins.json [project] (failed) {invalid manifest}`

### Test files -- new (2)

- **`tests/orchestrators/reconcile/preview.test.ts`** (NEW, 7 tests) -- empty-steady-state advisory single-call, idempotency (byte-identical args across two invocations), no-mutation (mtime + bytes unchanged for `claude-plugins.json` + `state.json`), CFG-03 abort with `path.basename` containment (rejects absolute path leakage) + `(will uninstall)` non-leakage (Pitfall 53-1), scope fan-out (omitted vs `--scope user`).
- **`tests/edge/handlers/plugin/preview.test.ts`** (NEW, 7 tests) -- bare dispatch / `--scope user` / `--scope project` / `--scope foo` USAGE / positional USAGE / unknown flag USAGE / `--scope` without value USAGE.

### Test files -- modified (7)

- **`tests/architecture/catalog-uat.test.ts`** -- new `"/claude:plugin preview"` outer FIXTURES key with 6 inner-state entries each pairing a `NotificationMessage` payload with the `piWithBothLoaded()` MockPi factory; `invalid-config-abort` and `source-mismatch` carry `expectedSeverity: "error"` (the rest are info / no severity).
- **`tests/architecture/notify-types.test.ts`** -- length-lock numbers updated: `PLUGIN_STATUSES` 11 -> 15 / `MARKETPLACE_STATUSES` 7 -> 9 / new `STATUS_TOKENS` length-lock at 21; `_PluginStatusExpected` + `_MarketplaceStatusExpected` literals extended; per-variant shape proofs (`_PluginWillInstallExpected` ... `_PluginWillDisableExpected`, marketplace `_MpWillAdd` / `_MpWillRemove`); negative-presence proofs (`_NoCauseOnWill*`, `_NoRollbackOnWill*`, `_NoDepsOnWill*`, `_NoReasonsOnWill*`, `_NoFromOnWill*`, `_NoToOnWill*`, `_NoVersionOnWill*`); new 7-arm union arity assertion `_l13` + `ReconcilePreviewEmptyMessage` shape proof.
- **`tests/architecture/notify-grammar-invariant.test.ts`** -- new test `DIFF-02: every will-* row renders subject-first <glyph> <name> [<scope>] (will ...) with the status token AFTER the subject`; asserts the load-bearing subject-first invariant for all 6 will-* fixtures AND the absence of the `/reload to pick up changes` trailer.
- **`tests/architecture/no-orchestrator-network.test.ts`** -- `FORBIDDEN_TARGETS` extended with `orchestrators/reconcile/preview.ts` + `plan.ts` + `notify.ts` (belt-and-braces over the Plan 01 purity gate on `plan.ts`).
- **`tests/shared/notify-v2.test.ts`** -- 6 new byte-equality tests for the will-* variants: will-add+will-install (orphan-fold suppressed bracket), will-remove (open-circle header), will-uninstall under list-arm header, will-enable+will-disable Phase-54 shape, cross-scope orphan-fold (bracket renders when scopes differ), reload-hint exclusion, info-severity routing.
- **`tests/orchestrators/reconcile/notify.test.ts`** -- updated to assert the real will-* tokens (was asserting Plan 01 placeholders); new assertions for `(will uninstall)` / `(will disable)` rows and the source-mismatch `reasons: ["source mismatch"]` shape; 3 new tests for `isReconcilePlanListEmpty`.
- **`tests/edge/router.test.ts`** + **`tests/edge/completions/provider.test.ts`** -- `preview` added to the exhaustive handler-mock literal and to the TC-1 top-level-keyword completion expected list.

## 6 New `will *` Tokens (D-53-02 honored)

| Token            | Tuple membership                        | Variant interface(s)                     | Renderer arm                                    |
| ---------------- | --------------------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `"will add"`     | STATUS_TOKENS + MARKETPLACE_STATUSES    | `MpWillAdd`                              | `renderMpHeader` -> `● <name> [<scope>] (will add)`     |
| `"will remove"`  | STATUS_TOKENS + MARKETPLACE_STATUSES    | `MpWillRemove`                           | `renderMpHeader` -> `○ <name> [<scope>] (will remove)`  |
| `"will install"` | STATUS_TOKENS + PLUGIN_STATUSES         | `PluginWillInstallMessage`               | `renderPluginRow` -> `● <name> [<scope>?] (will install)` |
| `"will uninstall"` | STATUS_TOKENS + PLUGIN_STATUSES       | `PluginWillUninstallMessage`             | `renderPluginRow` -> `○ <name> [<scope>?] (will uninstall)` |
| `"will enable"`  | STATUS_TOKENS + PLUGIN_STATUSES         | `PluginWillEnableMessage` (Phase 54 hand-off shape) | `renderPluginRow` -> `● <name> [<scope>?] (will enable)` |
| `"will disable"` | STATUS_TOKENS + PLUGIN_STATUSES         | `PluginWillDisableMessage`               | `renderPluginRow` -> `⊘ <name> [<scope>?] (will disable)` |

D-53-02 verification: zero occurrences of `to install` / `to uninstall` / `to add` / `to remove` / `to enable` / `to disable` anywhere in the new content (catalog, FIXTURES, source). Verified via the plan's acceptance grep:

```
grep -rn '"to install\|"to uninstall\|"to add\|"to remove\|"to enable\|"to disable' \
  extensions/pi-claude-marketplace/orchestrators/reconcile/ \
  extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts \
  extensions/pi-claude-marketplace/shared/notify.ts \
  docs/output-catalog.md tests/architecture/catalog-uat.test.ts \
  tests/architecture/notify-types.test.ts tests/shared/notify-v2.test.ts \
  tests/orchestrators/reconcile/preview.test.ts \
  tests/edge/handlers/plugin/preview.test.ts
# 0 matches
```

## 3 Length-Lock Updates

| Tuple                 | Plan 01 close | Plan 02 close | Test gate                                      |
| --------------------- | ------------- | ------------- | ---------------------------------------------- |
| `STATUS_TOKENS`       | 15            | 21            | new `_Assert_StatusTokensLen extends 21` (_l1s) |
| `MARKETPLACE_STATUSES` | 7            | 9             | `_Assert_MarketplaceStatusesLen extends 9` (_l2) |
| `PLUGIN_STATUSES`     | 11            | 15            | `_Assert_PluginStatusesLen extends 15` (_l1)   |
| `REASONS`             | 29            | 29 (unchanged) | `_Assert_ReasonsLen extends 29` (_l4) -- Pitfall 53-7 honored: source-mismatch / invalid-config rows reuse existing members |

## 6 Catalog States + 6 FIXTURES Entries (zero orphans)

| State name                     | Catalog byte form                                                        | FIXTURES payload                                                                  | Severity   |
| ------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ---------- |
| `empty-steady-state`           | `Preview: next reload will apply 0 actions.`                             | `{ kind: "reconcile-preview-empty" }` (dedicated standalone variant)              | info       |
| `mp-add-plugin-install`        | `● new-mp [user] (will add)\n  ● new-plugin (will install)`              | `MpWillAdd` + `PluginWillInstallMessage`                                          | info       |
| `plugin-pending-uninstall`     | `● mp [user]\n  ○ old-plugin (will uninstall)`                           | list-arm `MpList` + `PluginWillUninstallMessage`                                  | info       |
| `enable-disable-transitions`   | `● mp [user]\n  ● to-enable (will enable)\n  ⊘ to-disable (will disable)` | list-arm `MpList` + `PluginWillEnableMessage` + `PluginWillDisableMessage`        | info       |
| `source-mismatch`              | `1 marketplace operation failed.\n\n⊘ mp [project] (failed) {source mismatch}` | `MpFailed { reasons: ["source mismatch"] }` (Pitfall 53-7 -- reuses REASONS)      | error      |
| `invalid-config-abort`         | `1 marketplace operation failed.\n\n⊘ claude-plugins.json [project] (failed) {invalid manifest}` | `MpFailed { name: "claude-plugins.json", reasons: ["invalid manifest"] }` (Pitfall 53-1 -- BASENAME, not absolute path; T-53-02-02) | error      |

Catalog UAT forward walk + inverse walk both GREEN. Zero orphans.

## CFG-03 Abort Behavior (Pitfall 53-1; T-53-02-02)

```
Catalog state byte form (invalid-config-abort):
  1 marketplace operation failed.

  ⊘ claude-plugins.json [project] (failed) {invalid manifest}
```

- `previewReconcile` inspects `outcome.base.status` AND `outcome.local.status` BEFORE invoking `planReconcile`.
- When EITHER arm is `"invalid"`, the orchestrator constructs a `MarketplaceNotificationMessage` with `status: "failed"`, `reasons: ["invalid manifest"]`, and `name: path.basename(filePath)`.
- The `path.basename` containment is verified by a dedicated test in `tests/orchestrators/reconcile/preview.test.ts` that asserts the emitted output contains the basename AND does NOT contain the absolute path (`projectScopeRoot`).
- The same test also asserts the emitted output does NOT contain `"will uninstall"` -- proving CFG-03 abort never renders as a mass-uninstall preview.
- Severity: `error` (the cascade has a failed marketplace row); the GRAM-01 / GRAM-02 summary line `"1 marketplace operation failed."` is prepended automatically via the existing `emitWithSummary` seam.
- The orchestrator SKIPS `planReconcile` for the scope whose config is invalid -- a scope can be EITHER in `plans` OR in `invalidBlocks`, never both.

## Empty-Steady-State Advisory (DIFF-01 SC #2)

Exact byte form: `Preview: next reload will apply 0 actions.`

Mechanism (Phase 55 wiring contract):

- A new `ReconcilePreviewEmptyMessage` standalone-dispatched variant in `shared/notify.ts` (`kind: "reconcile-preview-empty"`, no other fields).
- The renderer arm in `dispatchInfoMessage` hard-codes the advisory body line so the byte form cannot drift from `docs/output-catalog.md`.
- `isInfoKind` / `computeSeverity` / `buildSummaryLine` / `shouldEmitReloadHint` all route the new kind to: standalone-dispatched / info / `""` (no summary) / `false` (no trailer) respectively.
- The orchestrator dispatches via `notify(opts.ctx, opts.pi, { kind: "reconcile-preview-empty" })` so the empty path uses the SAME public surface as every other variant (IL-2 single-call preserved); the catalog-uat byte-equality runner exercises this through the same `notify()` invocation it uses for the 5 cascade fixtures.
- Phase 55 apply-wiring will mirror this advisory shape when the reconcile cascade converges to zero actions.

## Idempotency Proof

- Fixture: a hermetic temp `cwd` + `HOME` populated with a project-scope `claude-plugins.json` + `state.json` whose merged-config diff against state is empty.
- mtime check: captures `mtimeMs` for `configPath` and `statePath` BEFORE the two invocations; asserts unchanged AFTER.
- Byte comparison: captures `readFile(...)` output for both files BEFORE; asserts byte-equal AFTER.
- Invocation count: two consecutive `previewReconcile` calls produce one `ctx.ui.notify` call each; the byte-form comparison via `assert.deepEqual(ctxA.calls[0].arguments, ctxB.calls[0].arguments)` is the load-bearing assertion.
- Lives at `tests/orchestrators/reconcile/preview.test.ts` (the `DIFF-01 SC #2 / idempotency:` test).

## Phase 54 Hand-Off

The `PluginWillEnableMessage` variant ships with:

- A discriminated-union arm in `PluginNotificationMessage` -- type-complete for Phase 54.
- A renderer arm in `renderPluginRow` emitting `● <name> [<scope>?] (will enable)` (ICON_INSTALLED glyph).
- A catalog state `enable-disable-transitions` with a paired FIXTURES entry exercising the byte form.
- A grammar invariant proof in `tests/architecture/notify-grammar-invariant.test.ts`.

Phase 53 produces ZERO `will enable` rows in practice (Pitfall 53-4: the Phase 53 state model has no disabled marker on a recorded plugin, so `planReconcile`'s `pluginsToEnable` bucket stays structurally empty). Phase 54 will introduce the marker, wire `pluginsToEnable` to a real `state.disabled === true` check, and emit `(will enable)` rows from the same `buildReconcilePreviewNotification` projection path that already exists.

## DIFF-01 / DIFF-02 / Phase 52 Status

| Requirement / SC                                   | Status      | Evidence                                                                    |
| -------------------------------------------------- | ----------- | --------------------------------------------------------------------------- |
| DIFF-01 SC #1 (pure planner)                       | CLOSED (Plan 01) | `orchestrators/reconcile/plan.ts` + `tests/architecture/reconcile-planner-purity.test.ts` |
| DIFF-01 SC #2 (read-only preview, idempotent, no-mutation) | CLOSED  | `previewReconcile` + idempotency / no-mutation tests + FORBIDDEN_TARGETS gate + `reconcile-preview-empty` advisory |
| DIFF-01 SC #3 (CFG-03 abort)                       | CLOSED      | preview.ts invalid-arm short-circuit + dedicated test + catalog `invalid-config-abort` state + `path.basename` containment proof |
| DIFF-02 SC #3 (subject-first row grammar + atomic lockstep) | CLOSED  | 6 new STATUS_TOKENS / variants / renderer arms / catalog states / FIXTURES entries / length-locks all in ONE commit; notify-grammar-invariant DIFF-02 test |
| Phase 52 SC#4 convergence proof                    | CLOSED (Plan 01) | `tests/orchestrators/reconcile/plan-convergence.test.ts` discharged the deferred proof |

## `npm run check` Final Test Count

| Surface                | Phase 53 Plan 01 close (2026-06-10) | Phase 53 Plan 02 close (2026-06-10) | Delta |
| ---------------------- | ----------------------------------- | ----------------------------------- | ----- |
| Unit tests             | 1604                                | 1629                                | +25   |
| Integration tests      | 7                                   | 7                                   | 0     |

The +25 unit tests break down as: 7 preview orchestrator tests + 7 edge shim tests + 6 notify-v2 byte-equality tests + 1 grammar-invariant DIFF-02 test + 3 isReconcilePlanListEmpty tests + 1 PluginDisable projection assertion (added in the notify.test.ts edits). Within the gate range stated in the plan.

## Deviations from Plan

Minimal -- the plan was executed as written. The notable adjustments:

- **`reconcile-preview-empty` standalone-dispatched variant introduced** (Rule 2 -- correctness): the plan suggested either "have `buildReconcilePreviewNotification` accept a second arg or return a tagged-union shape" OR "have the orchestrator wrap the empty case by constructing the advisory body inline". Both proposals collide with the catalog-uat byte-equality runner (the runner only routes through `notify()`, so an orchestrator-level `ctx.ui.notify(advisory)` bypass would leave the `empty-steady-state` catalog state with no FIXTURES entry -- an orphan in the inverse-walk gate). The dedicated 7th standalone variant resolves this cleanly: the orchestrator dispatches via `notify()`, the catalog-uat exercises the empty path through the same public surface as every other variant, and the renderer arm hard-codes the body so the byte form cannot drift. Notify-types `_l13` 7-arm arity assertion locks the new variant against accidental removal.
- **`ICON_AVAILABLE` reused for `will remove` mp header AND `will uninstall` plugin row** (RESEARCH Pattern 5): the plan referenced "ICON_UNINSTALLED" (which does not exist as a constant in `shared/notify.ts`); the actual constant for the open-circle `○` glyph is `ICON_AVAILABLE`. The plan's INTENT (pre-transition analog of the realized uninstalled row's open-circle glyph) is preserved; only the constant name differs.
- **Exhaustive switches in `edge/handlers/tools.ts` + `orchestrators/plugin/list.ts` extended** (Rule 2 -- correctness): the 4 new `will *` PluginStatus literals required new arms in `projectRowStatus` / `pluginScopeOrFallback` / `pluginVersion` (tools.ts) and `scopeOf` (list.ts) to satisfy TS exhaustive-narrowing -- the existing arms throw / fallback for cascade-only variants that are unreachable on the list surface; the will-* arms route to the same throw / fallback / `undefined` paths. Documented inline that the variants are unreachable on the list surface.
- **`tests/edge/completions/provider.test.ts` TC-1 expected list updated**: the test hard-codes the alphabetized expected list of top-level subcommands; `"preview"` insertion required updating the literal in lockstep with the `TOP_LEVEL_SUBCOMMANDS` tuple.
- **`tests/edge/router.test.ts` handlers literal extended**: the SubcommandHandlers interface gained `preview`; the test's mock-handlers literal required the new field to type-check.

None of these are architectural changes (Rule 4); all are immediate correctness consequences of the lockstep contract.

## Self-Check: PASSED

- `[x]` `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts` exists at the expected path.
- `[x]` `extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts` exists at the expected path.
- `[x]` `tests/orchestrators/reconcile/preview.test.ts` exists at the expected path.
- `[x]` `tests/edge/handlers/plugin/preview.test.ts` exists at the expected path.
- `[x]` Commit `5402f56` exists in `git log` (verified via `git log --oneline -5`).
- `[x]` `npm run check` GREEN (1629 unit + 7 integration).
- `[x]` Pre-commit hooks GREEN (verified via `SKIP=trufflehog pre-commit run --files ...` before commit).
- `[x]` D-53-02 honored (zero `to *` matches in new content; verified via the plan's acceptance grep).
- `[x]` Catalog inverse-walk gate GREEN (zero orphans for the new `/claude:plugin preview` section).
