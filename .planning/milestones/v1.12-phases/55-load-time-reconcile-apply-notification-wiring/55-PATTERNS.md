# Phase 55: Load-Time Reconcile Apply, Notification & Wiring - Pattern Map

**Mapped:** 2026-06-10
**Files analyzed:** 8 (4 new, 4 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|---------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | NEW | orchestrator | event-driven (per-scope read pass + per-entry apply loop) | `orchestrators/reconcile/preview.ts` | exact (sibling — same plan source, mirror shape) |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` | MODIFIED | projection helper (pure) | transform | `orchestrators/reconcile/notify.ts` (self — extend with applied-cascade builder) | exact |
| `extensions/pi-claude-marketplace/shared/notify.ts` | MODIFIED | type/variant catalog | transform | self — add `ReconcileAppliedCascadeMessage` variant alongside `ReconcilePreviewEmptyMessage` (`notify.ts:1006-1008`) | exact (precedent) |
| `extensions/pi-claude-marketplace/index.ts` | MODIFIED | lifecycle wiring | event-driven (`resources_discover`) | self (lines 15-37) — drop `unknown` cast, bind `ctx`, call `applyReconcile` | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | MODIFIED | orchestrator | request-response | `orchestrators/plugin/install.ts` (lines 197-219 — `InstallPluginNotifications`/`mode: "orchestrated"` precedent) | role-match |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | MODIFIED | orchestrator | request-response | `orchestrators/plugin/install.ts` (same precedent) | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | MODIFIED | orchestrator | request-response | `orchestrators/plugin/install.ts` (same precedent) | role-match |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` | MODIFIED | orchestrator | request-response | `orchestrators/plugin/install.ts` (same precedent) | role-match |
| `tests/orchestrators/reconcile/apply.test.ts` | NEW | unit test (orchestrator) | CRUD fixture | `tests/orchestrators/reconcile/preview.test.ts` (sibling) | exact |
| `tests/integration/load-reconcile-race.test.ts` | NEW | integration test (two-process race) | event-driven (fork+IPC) | `tests/integration/concurrent-install.test.ts` (lines 100-187) | exact |

## Pattern Assignments

### `orchestrators/reconcile/apply.ts` (orchestrator, event-driven)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts`

**Imports pattern** (preview.ts lines 34-52):
```ts
import path from "node:path";

import { loadMergedScopeConfig } from "../../persistence/config-merge.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { loadState } from "../../persistence/state-io.ts";
import { compareByNameThenScope, notify } from "../../shared/notify.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";

import { buildReconcilePreviewNotification, isReconcilePlanListEmpty } from "./notify.ts";
import { planReconcile } from "./plan.ts";

import type { ReconcilePlan } from "./types.ts";
import type { ExtensionAPI, ExtensionContext } from "../../platform/pi-api.ts";
import type { CascadeNotificationMessage, ContentReason, MarketplaceNotificationMessage } from "../../shared/notify.ts";
import type { Scope } from "../../shared/types.ts";
```

**Options shape** (preview.ts lines 54-61) — apply.ts uses the same `{ctx, pi, cwd}` triple; scope param drops (always both, project-first):
```ts
export interface PreviewReconcileOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly cwd: string;
  readonly scope?: Scope;
}
```

**Per-scope fan-out + CFG-03 abort + invalid-block accumulator** (preview.ts lines 95-146 — apply.ts wraps the read-pass body in `withStateGuard` per Pattern 2; migrate-then-load-then-plan order is locked):
```ts
const scopes: readonly Scope[] = opts.scope === undefined ? ["project", "user"] : [opts.scope];
const plans: ReconcilePlan[] = [];
const invalidBlocks: MarketplaceNotificationMessage[] = [];

for (const scope of scopes) {
  const loc = locationsFor(scope, opts.cwd);
  const outcome = await loadMergedScopeConfig(loc);

  if (outcome.base.status === "invalid") {
    invalidBlocks.push(buildInvalidConfigBlock(scope, outcome.base.filePath));
  }
  if (outcome.local.status === "invalid") {
    invalidBlocks.push(buildInvalidConfigBlock(scope, outcome.local.filePath));
  }
  if (outcome.base.status === "invalid" || outcome.local.status === "invalid") {
    continue;
  }

  let state;
  try { state = await loadState(loc.extensionRoot); } catch (err) {
    invalidBlocks.push({
      name: "state.json", scope, status: "failed",
      reasons: [narrowStateLoadFailReason(err)], plugins: [],
    });
    continue;
  }
  plans.push(planReconcile(outcome.merged, state, scope));
}
```

**Invalid-config block builder w/ T-53-02-02 basename mitigation** (preview.ts lines 69-77 — copy verbatim):
```ts
function buildInvalidConfigBlock(scope: Scope, filePath: string): MarketplaceNotificationMessage {
  return {
    name: path.basename(filePath),
    scope,
    status: "failed",
    reasons: ["invalid manifest"],
    plugins: [],
  };
}
```

**Lock pattern for the read pass** — REPLACE the unlocked `loadMergedScopeConfig` + `loadState` block above with `withStateGuard(loc, async (state) => { await migrateFirstRunConfig(loc, state); /* loadMergedScopeConfig + CFG-03 + planReconcile */ })`. Source: `transaction/with-state-guard.ts:66-76`:
```ts
export async function withStateGuard<T>(
  locations: ScopedLocations,
  mutate: (state: ExtensionState) => Promise<T> | T,
): Promise<T> {
  return withScopeLock(locations, async () => {
    const fresh = await loadState(locations.extensionRoot);
    const result = await mutate(fresh);
    await saveState(locations.extensionRoot, fresh);
    return result;
  });
}
```

**CRITICAL ordering rule (Pattern 2 / Pitfalls 52-2, 52-4):** inside the closure, call `migrateFirstRunConfig(loc, state)` FIRST, then `loadMergedScopeConfig(loc)`, then `planReconcile(...)`. The closure's `state` was loaded by `withStateGuard` BEFORE migrate runs — that ordering observes the D-13 existsSync gate at the right instant.

**Apply pass — NO outer lock (Pattern 3, Pitfall 3, CR-01 lesson):** Drive `addMarketplace` / `removeMarketplace` / `installPlugin` / `uninstallPlugin` / `setPluginEnabled` SERIALLY at top level. Each owns its own per-scope lock. Order: uninstall → remove → add → install → enable → disable → source-mismatch (report only). See `orchestrators/plugin/enable-disable.ts:11-19` for the CR-01 lesson comment.

**Per-entry continue-on-failure** (Pattern 4 Strategy B — mirror `installPlugin` precedent at `install.ts:197-219`):
```ts
export type InstallPluginNotifications =
  | { readonly mode: "standalone" }
  | { readonly mode: "orchestrated" };
```
Each driven orchestrator gains the same `notifications?: { mode: "orchestrated" }` option that suppresses internal `notify()` and returns a structured outcome; `apply.ts` wraps each call in try/catch and accumulates into the cascade.

**Final emission — single `notify()` (IL-2)** (preview.ts lines 152-175):
```ts
if (invalidBlocks.length === 0 && isReconcilePlanListEmpty(plans)) {
  // Phase 55 silent-on-empty (Pattern 5 A4); preview emits an empty variant.
  return;  // do NOT notify
}

const projection = buildReconcileAppliedCascade(plans, perEntryOutcomes);  // NEW builder
const message: ReconcileAppliedCascadeMessage = {
  kind: "reconcile-applied-cascade",
  marketplaces: [...projection.marketplaces, ...invalidBlocks].sort((a, b) =>
    compareByNameThenScope(a, b),
  ),
};
notify(opts.ctx, opts.pi, message);
```

**Top-level catch / NFR-2 boundary discipline** — see `index.ts` modification below; `applyReconcile` itself should never throw past `resources_discover`.

---

### `orchestrators/reconcile/notify.ts` (projection helper)

**Analog:** self (extend with `buildReconcileAppliedCascade(plans, outcomes)`).

**Core pattern** (notify.ts lines 162-225): `buildReconcilePreviewNotification` folds plan buckets into `(scope, marketplace)` blocks, sorts via `compareByNameThenScope`. Phase 55 adds a sibling that:
1. Replaces `"will add"`/`"will remove"` with `"added"`/`"removed"` STATUS_TOKENS (Pattern 5 Option A — reuse existing transition tokens).
2. Replaces `"will install"`/`"will uninstall"`/`"will enable"`/`"will disable"` plugin rows with `"installed"`/`"uninstalled"`/`"enabled"`/`"disabled"`.
3. Accepts per-entry outcomes; if outcome is `add-failed` / `install-failed` / etc., emits `(failed)` row carrying the classified reason instead of the success token.

**Block accumulator pattern** (notify.ts lines 47-75 — reuse `ensureMarketplaceBlock`):
```ts
interface MarketplaceBlock {
  readonly key: string;
  readonly name: string;
  readonly scope: Scope;
  status?: MarketplaceStatus;
  reasons?: readonly ContentReason[];
  plugins: PluginNotificationMessage[];
}
```

---

### `shared/notify.ts` (type/variant catalog)

**Analog:** `ReconcilePreviewEmptyMessage` lines 1006-1008 (the precedent for "reconcile-* variant with `shouldEmitReloadHint` arm = false").

**New variant** — add a `ReconcileAppliedCascadeMessage` arm:
```ts
export interface ReconcileAppliedCascadeMessage {
  readonly kind: "reconcile-applied-cascade";
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}
```

**Union-extension site** (notify.ts lines 1037-1044):
```ts
export type NotificationMessage =
  | CascadeNotificationMessage
  | MarketplaceInfoMessage
  | PluginInfoMessage
  | MarketplaceInfoCascadeMessage
  | PluginInfoCascadeMessage
  | MarketplaceNotAddedMessage
  | ReconcilePreviewEmptyMessage
  | ReconcileAppliedCascadeMessage;  // NEW
```

**StandaloneKind extension** (notify.ts lines 1059-1065 + 1074-1085 `isInfoKind`): add `"reconcile-applied-cascade"` literal AND extend the `isInfoKind` guard in the same atomic edit (TYPE-03 single-source).

**`shouldEmitReloadHint` arm** (notify.ts line 2023, `isInfoKind` branch at 2031 — hard-returns `false` for all StandaloneKind variants). Adding to StandaloneKind automatically gives the new variant `shouldEmitReloadHint = false` — **this resolves Pitfall 4** structurally.

**Renderer dispatch arm** (notify.ts lines 2503-2526 — `dispatchInfoMessage` switch): add `case "reconcile-applied-cascade":` that renders the cascade body using existing per-mp/per-plugin row renderers (reuse, not new tokens).

**Catalog lockstep requirement (Pitfall 53-3 / atomic-supersession):** the SAME commit MUST land:
- `docs/output-catalog.md` new H2 section for `reconcile-applied-cascade`
- `tests/architecture/catalog-uat.test.ts` FIXTURES entry
- `tests/architecture/notify-types.test.ts` length-locks (StandaloneKind set size + 1)
- `tests/architecture/notify-grammar-invariant.test.ts` assertion that the new variant emits NO `/reload to pick up changes` trailer

---

### `index.ts` (lifecycle wiring)

**Analog:** self — current handler at lines 15-30 uses an `unknown` cast that elides `ctx`.

**Current code** (verbatim):
```ts
export default function claudeMarketplaceExtension(pi: ExtensionAPI): void {
  const onResourcesDiscover = pi.on.bind(pi) as unknown as (
    event: "resources_discover",
    handler: (event: ResourcesDiscoverEvent) => Promise<ResourcesDiscoverResult>,
  ) => void;

  onResourcesDiscover("resources_discover", async (event) => {
    const discovered = await aggregateDiscoveredResources(...);
    return { skillPaths: [...], promptPaths: [...] };
  });
  ...
}
```

**Target shape** (drop the cast — Pi API at `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:802` is `(event, ctx) => ...`):
```ts
pi.on("resources_discover", async (event, ctx) => {
  // NFR-2: NEVER throw past resources_discover.
  try {
    await applyReconcile({ ctx, pi, cwd: event.cwd });
  } catch (err) {
    try { ctx.ui.notify(`reconcile aborted: ${(err as Error).message}`, "error"); } catch {}
  }
  const discovered = await aggregateDiscoveredResources(
    locationsFor("user", homedir()),
    locationsFor("project", event.cwd),
  );
  return { skillPaths: [...discovered.skillPaths], promptPaths: [...discovered.promptPaths] };
});
```

---

### `orchestrators/marketplace/add.ts` (orchestrator — add `notifications: "orchestrated"` mode)

**Analog:** `orchestrators/plugin/install.ts:197-219` — the `InstallPluginNotifications` discriminated union + `mode: "standalone" | "orchestrated"` precedent (Phase 19).

**Apply to:** `addMarketplace`, `removeMarketplace`, `uninstallPlugin`, `setPluginEnabled` — each gains a `notifications?: { mode: "standalone" | "orchestrated" }` option (default `"standalone"`); in orchestrated mode, suppress `notify()` and return a structured outcome.

**Source excerpt** (install.ts lines 175-219):
```ts
export type InstallPluginOutcome =
  | { readonly status: "installed"; readonly resourcesChanged: boolean; ... }
  | { readonly status: "failed"; readonly error: Error; readonly cause: string };

export type InstallPluginNotifications =
  | { readonly mode: "standalone" }
  | { readonly mode: "orchestrated" };
```

**Current `addMarketplace` catch site** (add.ts lines 286-313) — must be modified to suppress `notify()` and return a structured outcome when `notifications.mode === "orchestrated"`:
```ts
} catch (err) {
  const reason = classifyAddError(err);
  if (reason === undefined) throw err;
  if (opts.rethrowPreconditionErrors === true) throw err;
  // STANDALONE: notify(...).
  // ORCHESTRATED: return { status: "failed", reason, error: err };
  notify(opts.ctx, opts.pi, { marketplaces: [{ name: addSubjectName(err, opts.rawSource), scope: opts.scope, status: "failed", reasons: [reason], plugins: [] }] });
  return;
}
```

**Same pattern applies to `removeMarketplace`** (remove.ts lines 160-200), `uninstallPlugin` (uninstall.ts lines 148-...), and `setPluginEnabled` (enable-disable.ts:258-...).

---

### `tests/orchestrators/reconcile/apply.test.ts` (unit test)

**Analog:** `tests/orchestrators/reconcile/preview.test.ts` (sibling — same fixture style, same plan-driving harness).

**Coverage required (per RESEARCH §Validation):** RECON-01 (declared-but-missing → add+install); RECON-02 (installed-but-undeclared → remove+uninstall scoped to managed entries); RECON-03 (per-entry network failure soft-fails); RECON-05 (back-to-back reconcile = byte-unchanged).

---

### `tests/integration/load-reconcile-race.test.ts` (integration test — fork + IPC)

**Analog:** `tests/integration/concurrent-install.test.ts` lines 120-187 (`runRace` + `assertOneWinner` + ready-sync over IPC).

**Imports + fork pattern** (concurrent-install.test.ts lines 125-150):
```ts
const first = fork(CHILD_PATH, [], {
  cwd: env.cwd,
  env: { ...process.env, HOME: env.home },
  stdio: ["ignore", "ignore", "ignore", "ipc"],
});
// ... waitReady via 'message' === 'ready' ...
await Promise.all([waitReady(first), waitReady(second)]);
```

**Child entry point convention:** create a sibling `tests/integration/load-reconcile-race-child.ts` mirroring `concurrent-install-child.ts`. Child receives a `{ cwd }` IPC message, calls `applyReconcile({ ctx: stubCtx, pi: stubPi, cwd })`, sends `{ ok, message? }` back, exits 0.

**Assertion shape (Pitfall 10 — DON'T copy `assertOneWinner` byte-for-byte):** read state.json AFTER both children exit; assert exactly ONE `mp-a` record + exactly ONE `plugin-a` record; assert no orphaned staging dirs. The two-process race is INSIDE the read pass; the apply pass has no shared lock, so don't assert "exactly one winner".

---

## Shared Patterns

### CFG-03 invalid-config row with basename (T-53-02-02 information disclosure)
**Source:** `orchestrators/reconcile/preview.ts:69-77`
**Apply to:** `apply.ts` invalid-block accumulator — same `path.basename(filePath)` discipline.

### NFR-1 / NFR-3 / D-06 per-scope lock
**Source:** `transaction/with-state-guard.ts:66-76` (`withStateGuard`)
**Apply to:** `apply.ts` read pass (migrate + load + plan); NOT the apply loop.

### Single `notify()` per orchestration arm (IL-2)
**Source:** every orchestrator under `orchestrators/*` (e.g., `uninstall.ts:148`, `remove.ts:160`); `notify()` defined at `shared/notify.ts:9-41`.
**Apply to:** `apply.ts` final emission — exactly ONE `notify(ctx, pi, message)` per call.

### Orchestrated-mode precedent for cross-orchestrator composition
**Source:** `orchestrators/plugin/install.ts:197-219` (`InstallPluginNotifications`)
**Apply to:** `addMarketplace`, `removeMarketplace`, `uninstallPlugin`, `setPluginEnabled` — each gains the same shape.

### CR-01 nested-lock lesson (NO outer lock around apply loop)
**Source:** `orchestrators/plugin/enable-disable.ts:11-19` (CR-01 comment block); `with-state-guard.ts:107-153` (non-reentrant lock).
**Apply to:** `apply.ts` apply loop — top-level calls, each orchestrator owns its own lock.

### `softDepStatus(pi)` probe threading
**Source:** every orchestrator's notify call site (`notify(ctx, pi, message)` consumes `pi` for the probe).
**Apply to:** `apply.ts` — pass `pi` through `applyReconcile` options; thread to the final `notify()`.

### Reload-hint suppression via new StandaloneKind variant
**Source:** `shared/notify.ts:1006-1008` (`ReconcilePreviewEmptyMessage`) + `notify.ts:2023-2038` (`shouldEmitReloadHint` `isInfoKind` arm = false).
**Apply to:** `ReconcileAppliedCascadeMessage` — adding to `StandaloneKind` set automatically suppresses the trailer (Pitfall 4 resolved structurally).

### Catalog/UAT atomic-supersession
**Source:** Phase 53 `reconcile-preview-empty` landing — variant + catalog state + FIXTURES + length-lock landed in the SAME commit.
**Apply to:** `reconcile-applied-cascade` variant — same atomic discipline (Pitfall 53-3).

### Two-process race via fork + IPC ready-sync
**Source:** `tests/integration/concurrent-install.test.ts:120-176` + `tests/integration/concurrent-install-child.ts`
**Apply to:** `tests/integration/load-reconcile-race.test.ts` + new `load-reconcile-race-child.ts`.

## No Analog Found

None — every file in this phase has a strong analog in the existing codebase. Phase 55 is a connect-the-wires phase over already-frozen foundations (Phases 19, 51, 52, 53, 54).

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/orchestrators/reconcile/`
- `extensions/pi-claude-marketplace/orchestrators/{marketplace,plugin}/`
- `extensions/pi-claude-marketplace/shared/notify.ts`
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`
- `extensions/pi-claude-marketplace/index.ts`
- `tests/integration/`, `tests/orchestrators/reconcile/`

**Files scanned:** 11 source + 2 test analogs
**Pattern extraction date:** 2026-06-10
