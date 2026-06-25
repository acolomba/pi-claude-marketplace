# Phase 2: Caller-stamped severity & reload reducer - Pattern Map

**Mapped:** 2026-06-24
**Files analyzed:** 7 surfaces (1 type/reducer core, 1 typed call path, ~18 producers in 4 orchestrator families, 1 projection, 3 test surfaces)
**Analogs found:** all in-repo (this is an output-preserving refactor — every "modified" file already exists; the only NEW file is the D-05 architecture test, whose analog is `notify-grammar-invariant.test.ts`)

> Line numbers below are verified against the current tree (notify.ts is 3383 lines; supersedes the stale MESSAGING-COUPLING audit). All excerpts are EXISTING code the executor must match for style; the additions are the two stamped fields.

---

## File Classification

| File | Role | Data Flow | Closest Analog (existing) | Match |
|------|------|-----------|---------------------------|-------|
| `shared/notify.ts` (type model — MessageBase + 5 transition arms) | model / type | transform | itself — the existing `extends MessageBase` per-arm idiom (notify.ts:628-898) | self / exact |
| `shared/notify.ts` (reducer — computeSeverity/cascadeSeverity/shouldEmitReloadHint/count*Rows) | service (reducer) | transform / reduce | itself — existing `.some()`/`.filter()` flattened traversals (notify.ts:2208-2236, 2549-2561) | self / exact |
| `shared/notify-context.ts` (kind union, MarketplaceRows<Msg>) | service (typed call path) | request-response | self (notify-context.ts:92-152) | self / exact |
| `orchestrators/plugin/{install,update,uninstall,reinstall,enable-disable,list}.ts` + `*.messaging.ts` | controller (producer) | event-driven (emit) | `install.ts:1359-1376` literal + `install.messaging.ts` shape | exact |
| `orchestrators/marketplace/{add,remove,update,autoupdate}.ts` + `*.messaging.ts` | controller (producer) | event-driven (emit) | same producer idiom as plugin family | role-match |
| `orchestrators/import/execute.ts` + `execute.messaging.ts` | controller (producer) | batch / transform | same producer idiom | role-match |
| `orchestrators/reconcile/notify.ts` (`applyOutcomeToBlock` projection) | service (projection) | transform | self (reconcile/notify.ts:311-419) — D-05 backstop target | self / exact |
| `tests/architecture/notify-stamp-coverage.test.ts` **(NEW)** | test (arch) | request-response | `tests/architecture/notify-grammar-invariant.test.ts` | role-match (runtime-introspection arch test) |
| `tests/shared/notify-inert-fields.test.ts` (supersede) | test (unit) | request-response | self (premise inverted) + `notify-v2.test.ts` | self |

---

## Pattern Assignments

### `shared/notify.ts` — MessageBase + transition-interface narrowing (D-04)

**Analog:** the file's own `extends MessageBase` arm idiom. Every one of the 16 plugin + 10 marketplace arms already does `extends MessageBase` with a `readonly status: "<literal>"` discriminant.

**Current base** (notify.ts:606-609):
```typescript
export interface MessageBase {
  readonly severity?: "info" | "warning" | "error";
  readonly needsReload?: boolean;
}
```

**Current transition arm shape** (notify.ts:628-635) — the 5 transition arms (`PluginInstalledMessage`, `PluginUpdatedMessage`, `PluginReinstalledMessage`, `PluginUninstalledMessage`, `PluginDisabledMessage`) all follow this `extends MessageBase` form:
```typescript
export interface PluginInstalledMessage extends MessageBase {
  readonly status: "installed";
  readonly name: string;
  readonly dependencies: readonly Dependency[];
  readonly version?: string;
  readonly scope?: Scope;
  readonly reasons?: readonly ContentReason[];
}
```

**Narrowing target** (RESEARCH Pattern 1, lowest-surprise shape — a sibling base the 5 transition arms extend instead of `MessageBase`):
```typescript
export interface TransitionMessageBase extends MessageBase {
  readonly severity: "info" | "warning" | "error"; // narrowed: required
  readonly needsReload: boolean;                    // narrowed: required
}
// then: PluginInstalledMessage extends TransitionMessageBase { readonly status: "installed"; ... }
```
Keep `readonly`, keep the same member order convention (status first, then name). Non-transition arms (`available`/`unavailable`/`upgradable`/`failed`/`skipped`/`manual recovery`/`will *`) keep `extends MessageBase` (fields stay optional → default `info`/`false`).

**`present` collapse (D-08 / RLD-04):** delete `PluginPresentMessage` (notify.ts:764-771) and `"present"` from `PLUGIN_STATUSES` (notify.ts:472). The list surface emits `installed` with `needsReload:false` instead. Renderer `installed` arm bytes are already byte-identical to the present arm (notify.ts:757-759 comment confirms). Drop `PluginPresentMessage` from the `PluginNotificationMessage` union (notify.ts:890).

---

### `shared/notify.ts` — the dumb-reducer rewrite (SEV-02 / RLD-02 / SEV-04 / RLD-03)

**Analog:** the existing flattened `marketplaces.some(mp => … mp.plugins.some(p => …))` traversal — mirror its iteration so the byte output is unchanged.

**DELETE** `BENIGN_REASONS` (notify.ts:150-157) + `allBenign` (notify.ts:166-168):
```typescript
const BENIGN_REASONS: ReadonlySet<Reason> = new Set([ "up-to-date", "already installed", ... ]);
function allBenign(reasons: readonly Reason[] | undefined): boolean {
  return reasons !== undefined && reasons.length > 0 && reasons.every((r) => BENIGN_REASONS.has(r));
}
```

**REWRITE** `cascadeSeverity` (notify.ts:2198-2237) — the existing 4-arm first-match content ladder reading `status`+`reasons` — into a MAX over `row.severity`. The existing traversal to mirror:
```typescript
const hasError = message.marketplaces.some(
  (mp) => mp.status === "failed" || mp.plugins.some((p) => p.status === "failed"),
);
// …manual-recovery / actionable-skip arms…
```
Replacement keeps `ComputedSeverity = "warning" | "error" | undefined` (notify.ts:2188) and reduces over the flattened mp + plugin rows reading `.severity` (RESEARCH Pattern 2: `Math.max` over `SEVERITY_RANK[r.severity ?? "info"]`, return `undefined`/`"warning"`/`"error"`). Both `mp.severity` and `p.severity` participate.

**DELETE** `reconcileAppliedSeverity` (notify.ts:2244-2246) — it just delegates to `cascadeSeverity`; the rewritten cascade reducer absorbs it.

**`computeSeverity` info-kind switch PARTIALLY STAYS** (notify.ts:2266-2295) — see Open Question Q1 in RESEARCH. The `marketplace-not-added → "error"` and `plugin-info` failed → `"error"` standalone arms have no per-row `severity` array; recommendation is to keep the small kind→severity map and route only the **cascade** branch through the new MAX reducer.

**REWRITE** `shouldEmitReloadHint` trigger loop (notify.ts:2548-2561) — delete the status-token trigger set + `disabledIsTransition`:
```typescript
const disabledIsTransition = message.kind === "disable-cascade";
for (const mp of message.marketplaces) {
  for (const p of mp.plugins) {
    if (p.status === "installed" || p.status === "updated" || p.status === "reinstalled" ||
        p.status === "uninstalled" || (disabledIsTransition && p.status === "disabled")) {
      return true;
    }
  }
}
return false;
```
Replace with the OR-reduce (RESEARCH Pattern 2): `rows.some((r) => r.needsReload === true)` over the flattened mp + plugin rows. The info-kind early-return arms (notify.ts:2521-2542) STAY (info surfaces never reload). `RELOAD_HINT_TRAILER` (notify.ts:2144) STAYS verbatim.

**REWRITE** `countFailedRows` (notify.ts:2323-2336) + `countSkippedRows` (notify.ts:2350-2365) — currently match `p.status === "failed"` / `p.status === "skipped" && !allBenign(p.reasons)`. Re-tally by stamped `severity`: error-count = rows with `severity === "error"`, warning-count = rows with `severity === "warning"`. Keep the `{ plugins, marketplaces }: SummaryCounts` return shape (notify.ts:2300-2303) and the `for…of` accumulation style. `buildSummaryLineForCascade` (notify.ts:2372) and `operationPhrase` (notify.ts:2398) STAY.

**Reducer consumption seams (do NOT add a 2nd `ctx.ui.notify`):** `emitWithSummary` (notify.ts:3046-3053) consumes `computeSeverity(message)`; `notify()` (notify.ts:3167) and `emitContextCascade` (notify.ts:3222) consume `shouldEmitReloadHint(message)`. The reducers receive the WHOLE cascade `message` and must flatten internally — keep these call signatures unchanged.

**`disable-cascade` kind removal (D-07 / RLD-05):** remove `"disable-cascade"` from the cascade `kind?` union (notify.ts:1057), drop the `case "disable-cascade":` arm in the `notify()` exhaustiveness switch (notify.ts:3147) — it falls through with `undefined`/`"cascade"`.

---

### `shared/notify-context.ts` — typed call path (RLD-05 kind removal; D-04 enforcement carrier)

**Analog:** self. The `MarketplaceRows<Msg>` narrowing (notify-context.ts:92-99) is what makes D-04 reach producer call sites — the object literal is checked against the narrow `Msg` BEFORE the widening cast.

**Remove** `"disable-cascade"` from the kind param union (notify-context.ts:137):
```typescript
export function notifyWithContext<Status extends string, Msg extends { status: Status }>(
  ctx, pi, context, rows: readonly MarketplaceRows<Msg>[],
  kind?: "cascade" | "disable-cascade",   // → kind?: "cascade"
): void {
```
The widening cast (notify-context.ts:145, `rows as unknown as readonly MarketplaceNotificationMessage[]`) is post-check — it does NOT defeat the required-field gate. Leave it.

---

### `orchestrators/*/*.ts` (~18 producers) — stamp the two fields at the emit literal

**Analog:** `orchestrators/plugin/install.ts:1359-1376` — the canonical literal-construction-then-`notifyWithContext` recipe.

**Current install success literal** (install.ts:1359-1376):
```typescript
const installedRow: PluginInstalledMessage = {
  status: "installed",
  name: plugin,
  dependencies,
  version: installCtx.version,
  ...(reasons.length > 0 && { reasons }),
};
notifyWithContext(ctx, pi, INSTALL_CONTEXT, [
  { name: marketplace, scope, plugins: [installedRow] },
]);
```
**After (D-03/D-06):** add `severity: "info", needsReload: true` to the transition literal. Failed literal (install.ts:1173/1225 style) adds `severity: "error", needsReload: false`. Once `PluginInstalledMessage extends TransitionMessageBase`, omitting either is a TS2741 at this literal.

**List surface present→installed (D-08)** — `list.ts:287-294` `installedRowMessage` return:
```typescript
return {
  status: "present",
  name: pluginName,
  dependencies: dependenciesFromDeclares(declaresAgents, declaresMcp),
  version: record.version,
  ...scopeField,
  ...descriptionField,
};
```
**After:** `status: "installed"` + `severity: "info", needsReload: false` (the `needsReload:false` IS the old present reload-suppression). Update the function return type (list.ts:240) from `PluginPresentMessage | …` to `PluginInstalledMessage | …`. Keep reasons OMITTED (Pitfall 2 — no orphan-rewake brace leak on inventory). `disabled` (list.ts:263-268) and `upgradable` (list.ts:277-284) inventory rows stay optional-field (no stamp needed; default `info`/`false`).

**Disable transition + disable-cascade removal (D-07/RLD-05)** — `enable-disable.ts:857-865`:
```typescript
notifyWithContext(ctx, pi, DISABLE_CONTEXT,
  [{ name: marketplace, scope, plugins: [disableRow] }], "disable-cascade");
```
**After:** drop the 5th arg; the fresh-disable arm of `composeOutcomeRow` (enable-disable.ts:967 `status: "disabled"`) stamps `severity: "info", needsReload: true` directly. Skip arms (enable-disable.ts:762/767/904/911) stamp per D-03: `already enabled`/`already disabled` → `info`, `not installed` → `warning`; all skip rows `needsReload: false`.

**Skip-severity per-site mapping (D-03 / RESEARCH Pitfall 3)** — each skip producer stamps its own benign/actionable judgment (replacing `allBenign`):
- `marketplace/update.ts` `up-to-date` skip → `info`; non-benign narrowed reason → `warning`
- `marketplace/autoupdate.ts` `already autoupdate`/`already no autoupdate` → `info`
- `plugin/update.ts` skip → classify by reason
- `plugin/reinstall.ts` manual-recovery → always `warning`
- `import/execute.ts` skip → classify by reason

`catalog-uat` `expectedSeverity` per fixture catches any wrong stamp.

---

### `orchestrators/reconcile/notify.ts` — the D-05 backstop target (projected rows)

**Analog:** self. `applyOutcomeToBlock` (reconcile/notify.ts:311-419) builds plugin rows DIRECTLY via `block.plugins.push({...})` — NOT through a command render map — so the type system can't force the stamp here; this is exactly the D-05 dynamic case.

**Current transition-row pushes** (reconcile/notify.ts:331-377) that must be stamped:
```typescript
case "plugin-installed":
  block.plugins.push({ status: "installed", name: outcome.plugin,
    ...(outcome.version !== undefined && { version: outcome.version }),
    dependencies: outcome.dependencies });
  return;
case "plugin-uninstalled":
  block.plugins.push({ status: "uninstalled", name: outcome.plugin, ... });
case "plugin-enabled":   // re-materializes → emits "installed"
  block.plugins.push({ status: "installed", ..., dependencies: [] });
case "plugin-disabled":
  block.plugins.push({ status: "disabled", name: outcome.plugin, ... });
case "plugin-install-failed": case "plugin-uninstall-failed":
case "plugin-enable-failed": case "plugin-disable-failed":
  block.plugins.push({ status: "failed", name: outcome.plugin, reasons: reasonAsContent(outcome.reason) });
```
**After:** add `severity`/`needsReload` to each push: `installed`/`uninstalled`/`disabled` → `severity:"info", needsReload:true`; `failed` → `severity:"error", needsReload:false`. Once the transition interfaces are narrowed, these literals ALSO become TS2741 if unstamped (they construct `PluginNotificationMessage` arms directly) — but the marketplace-level `failed` block (reconcile/notify.ts:130-137 via `blockToMarketplaceMessage`) and the dynamic `MarketplaceBlock` accumulator (line 74, `plugins: PluginNotificationMessage[]`) widen, so the D-05 runtime test is the belt-and-suspenders backstop.

---

### `tests/architecture/notify-stamp-coverage.test.ts` (NEW) — D-05 runtime backstop

**Analog:** `tests/architecture/notify-grammar-invariant.test.ts` — the runtime-introspection arch-test idiom (drive real notify shapes / projections, assert structural invariant over the output), NOT a grep/AST walker.

**Header structure to mirror** (notify-grammar-invariant.test.ts:1-33): doc-comment stating the invariant + requirement IDs, `import assert from "node:assert/strict"`, `import test, { mock } from "node:test"`, import the production symbol under test.

**Mock helpers to copy verbatim** (notify-grammar-invariant.test.ts:39-61): `makeCtx()`, `piWithBothLoaded()` — though for D-05 you drive `buildReconcileAppliedCascade` / `buildReconcilePendingNotification` (pure projections, no ctx/pi needed) per RESEARCH Code Example:
```typescript
import { buildReconcileAppliedCascade } from ".../reconcile/notify.ts";
const TRANSITION_STATUSES = new Set(["installed","updated","reinstalled","uninstalled","disabled"]);
test("GATE-01/D-05: reconcile-applied projection stamps both fields on every state-change row", () => {
  const msg = buildReconcileAppliedCascade(SAMPLE_OUTCOMES);
  for (const mp of msg.marketplaces) for (const p of mp.plugins) {
    if (TRANSITION_STATUSES.has(p.status)) {
      assert.notEqual(p.severity, undefined, `${p.status} row missing severity`);
      assert.equal(typeof p.needsReload, "boolean", `${p.status} row missing needsReload`);
    }
  }
});
```
**Comment policy** (`.claude/rules/typescript-comments.md`): use `D-05`/`GATE-01`/`RECON-04` anchors in test titles — NEVER `Phase 2`/`Wave N`/`Plan NN`.

---

### `tests/shared/notify-inert-fields.test.ts` — SUPERSEDE (premise inverted)

**Analog:** self + `notify-v2.test.ts`. The current file (notify-inert-fields.test.ts:52-130) asserts the fields are INERT (injected `severity:"error"`/`needsReload:true` produce byte-identical output). This phase makes them LIVE — that premise is now FALSE.

**Reusable harness** (notify-inert-fields.test.ts:27-50) — `makeCtx`, `piWithBothLoaded`, `renderArgs(msg)` returning the single `ctx.ui.notify` call args — KEEP; rewrite the two tests to assert the fields are LIVE: a stamped `severity:"error"` row now DOES flip emission severity / prepend a summary, and a stamped `needsReload:true` row DOES add the `/reload` trailer. Note the existing test fixtures use `status:"present"` (line 102/120) → migrate to `status:"installed"` + `needsReload`.

---

## Shared Patterns

### Closed-set tuple + literal-union (status / kind model)
**Source:** `PLUGIN_STATUSES` (notify.ts:461-478), `PluginStatus = (typeof PLUGIN_STATUSES)[number]` (notify.ts:516).
**Apply to:** the `present` removal (drop `"present"` from the tuple) and any `TRANSITION_STATUSES` registry in the D-05 test (pin via `satisfies readonly PluginStatus[]` to stay drift-proof).

### Conditional-spread for optional fields
**Source:** `...(outcome.version !== undefined && { version: outcome.version })` (reconcile/notify.ts:335), `...(reasons.length > 0 && { reasons })` (install.ts:1364), `...scopeField` (list.ts:267).
**Apply to:** keep this idiom for the OPTIONAL fields; the two NEWLY-REQUIRED transition fields are stamped UNCONDITIONALLY (`severity: "info", needsReload: true`), never conditionally-spread.

### `assertNever` exhaustiveness tail
**Source:** every status/kind switch (reconcile/notify.ts:417, notify.ts:2288/3154).
**Apply to:** unchanged — keep on every switch you touch (removing `"present"`/`"disable-cascade"` cases must keep the `default: assertNever` tail intact).

### `ctx.ui.notify` single-emission seam (IL-2)
**Source:** `emitWithSummary` (notify.ts:3046-3053) is the ONLY `ctx.ui.notify` call in the cascade path.
**Apply to:** all reducer rewrites — do NOT add a second emission; the rewritten `computeSeverity`/`shouldEmitReloadHint` feed this same seam.

### Comment traceability anchors
**Source:** `.claude/rules/typescript-comments.md` + existing code (`// D-07 INERT:` notify.ts:2249, `// UAT-03:` enable-disable.ts:834).
**Apply to:** all new/edited comments + test titles — use `D-01`..`D-08`, `SEV-0N`, `RLD-0N`, `GATE-01`, `RECON-04` anchors; NEVER `Phase 2`/`Plan NN`/`Wave N`.

---

## No Analog Found

None. Every modified surface has an in-repo analog (mostly itself). The one NEW file (`notify-stamp-coverage.test.ts`) models on `notify-grammar-invariant.test.ts` (runtime-introspection arch test).

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/`, `extensions/pi-claude-marketplace/orchestrators/{plugin,marketplace,import,reconcile}/`, `tests/architecture/`, `tests/shared/`.
**Files scanned:** notify.ts, notify-context.ts, reconcile/notify.ts, plugin/{install,list,enable-disable}.ts, install.messaging.ts, catalog-uat.test.ts, notify-grammar-invariant.test.ts, notify-inert-fields.test.ts.
**Pattern extraction date:** 2026-06-24
