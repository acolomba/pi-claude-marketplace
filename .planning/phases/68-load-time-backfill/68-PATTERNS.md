# Phase 68: Load-Time Backfill - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 8 (3 modified source, 1 new source, 4 test files)
**Analogs found:** 8 / 8

All analogs are in-tree on `features/force-install`. No external packages. This
phase is wiring: the risk lives in the seams (loadState normalization, reinstall
force-capability, SPLIT-02 / RECON-04 invariants), not in a new algorithm.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/shared/extension-version.ts` (NEW) | config / constant | static-read | `shared/atomic-json.ts` (leaf module) | role-match |
| `extensions/pi-claude-marketplace/persistence/state-io.ts` (MODIFY) | model / persistence | file-I/O, transform | self (STATE_SCHEMA, loadState, saveState) | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (MODIFY) | orchestrator | event-driven (resources_discover) | self (applyReconcile, applyPlan) | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (MODIFY) | orchestrator | CRUD (always-overwrite) | self (resolveInstallable, updateStateRecord) | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` (MODIFY) | model / type | transform | self (PerEntryOutcome union + arms) | exact |
| `tests/architecture/extension-version-sync.test.ts` (NEW) | test | file-I/O assert | `tests/architecture/config-state-write-seams.test.ts` | role-match |
| `tests/persistence/state-io.test.ts` (MODIFY) | test | round-trip | self | exact |
| `tests/orchestrators/reconcile/*.test.ts` + `tests/orchestrators/plugin/reinstall.test.ts` (MODIFY/NEW) | test | integration | `tests/orchestrators/reconcile/apply.test.ts`, `reinstall.test.ts` | exact |

## Pattern Assignments

### `shared/extension-version.ts` (config / constant) - NEW

**Analog:** leaf-module convention (`shared/atomic-json.ts` header style). No
existing constant module; this is a new single-export leaf.

**Pattern to copy** - a checked-in `const`, NOT a runtime `package.json` import
(import-attributes JSON modules are experimental below Node 22, noise at the
NFR-4 floor of 20.19). Drift is caught by the sync test below.

```typescript
// shared/extension-version.ts
//
// BFILL-02: the running extension version -- the ONLY input that can move the
// supported-kind boundary, so it gates the load-time backfill scan. Kept as a
// checked-in constant (not a runtime package.json import) so the read is
// zero-I/O, needs no experimental Node feature at the NFR-4 floor, and stays
// trivially offline (NFR-5). A drift-guard test pins it === package.json.
export const EXTENSION_VERSION = "0.6.2";
```

Current `package.json` version is `0.6.2` (package.json:87). Adds a third
version-sync point alongside `package.json` and `sonar-project.properties`.

---

### `persistence/state-io.ts` (model / persistence) - MODIFY

**Analog:** self. Three edit sites; all follow existing in-file patterns.

**1. Schema field addition** - mirror the existing `Type.Optional` field
`lastUpdatedAt` on `MARKETPLACE_RECORD_SCHEMA` (state-io.ts:139). Add to
`STATE_SCHEMA` (state-io.ts:153-156); `schemaVersion` stays `1|2` (D-68-01, no
bump):

```typescript
export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),
  // BFILL-02 / D-68-01: optional top-level scan-gate stamp. Absent = scan-once
  // (treated as version-changed). Additive -- old docs without it validate fine.
  lastReconciledExtensionVersion: Type.Optional(Type.String()),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});
```

`Type.Optional` semantics: an old `state.json` without the field passes
`STATE_VALIDATOR.Check`, and `saveState` (state-io.ts:314) re-validates and
accepts a state with or without it. No `migrate.ts` default-fill needed.

**2. loadState normalization (CRITICAL - else the gate never closes).**
`loadState` REBUILDS the object at state-io.ts:290, currently:

```typescript
const normalized: unknown = { schemaVersion: 2, marketplaces };
```

A new top-level field is silently dropped here on every load, so the gate would
read `undefined` every load and backfill would re-run forever (D-68-03
violated). Thread the field from `parsed`:

```typescript
const root = parsed as { lastReconciledExtensionVersion?: unknown };
const normalized: unknown = {
  schemaVersion: 2,
  ...(typeof root.lastReconciledExtensionVersion === "string" && {
    lastReconciledExtensionVersion: root.lastReconciledExtensionVersion,
  }),
  marketplaces,
};
```

**3. ENOENT default + DEFAULT_STATE stay unchanged** - the ENOENT arm
(state-io.ts:236 `{ schemaVersion: 2, marketplaces: {} }`) and `DEFAULT_STATE`
(state-io.ts:164) correctly OMIT the stamp: absent = scan-once = a fresh scope
scans on first load (D-68-03 intent). No edit needed beyond the optional type
permitting it.

**Write seam:** `saveState` (state-io.ts:314-323) already calls
`atomicWriteJson` (NFR-1). The stamp MUST route through `saveState` /
`withStateGuard`, never a new `atomicWriteJson(stateJsonPath, ...)` elsewhere
(SPLIT-02, see Shared Patterns).

---

### `orchestrators/reconcile/apply.ts` (orchestrator) - MODIFY

**Analog:** self. Insert a new per-scope step in `applyReconcile`'s scope loop.

**Insertion point** - inside the `for (const scope of scopes)` loop, AFTER
`applyPlan` (apply.ts:836-838) and before `rebuildScopeRoutingTableIsolated`
(apply.ts:845). The apply region runs with NO outer lock (CR-01) because
`reinstallPlugin` self-locks and `proper-lockfile` is not re-entrant:

```typescript
if (readResult.plan !== undefined) {
  await applyPlan(opts, readResult.plan, outcomes);
}
// BFILL-01/02: gated, no-outer-lock, folds rows into `outcomes`, then stamps.
await applyBackfillForScope(opts, scope, readResult, outcomes);
await rebuildScopeRoutingTableIsolated(scope, opts.cwd, outcomes);
```

**Outcomes accumulator** (apply.ts:792) - push promotion rows onto the shared
`outcomes: PerEntryOutcome[]`. The single cascade is built once at apply.ts:864
and emitted via one `notifyReconcileAppliedWithContext` (apply.ts:865) -
RECON-04 single-notify preserved automatically; do NOT add a second `notify()`.

**applyPlan step pattern** (apply.ts:754-774) - the existing per-step
orchestrator-call signature `(opts, plan, outcomes)` is the shape to mirror for
`applyBackfillForScope`.

**Empty-and-silent invariant** (apply.ts:851-853) - `outcomes.length === 0`
returns silently (NFR-2 / RECON-05). Stamp-on-gate-open still writes state.json
even when zero plugins backfilled and the cascade is silent (D-68-03); this does
NOT violate RECON-05 (which governs the unchanged-version steady state where the
gate stays closed and no stamp is written).

---

### `orchestrators/plugin/reinstall.ts` (orchestrator) - MODIFY (BLOCKING widening)

**Analog:** self. The Phase 67 primitive is installable-only; it must widen to
the force-capable shape before backfill can reuse it (D-68-02).

**Defect:** `resolveInstallable` (reinstall.ts:1262-1269) calls
`requireInstallable`, which THROWS `PluginShapeError {not-installable}` on an
`unsupported` plugin; and `updateStateRecord` (reinstall.ts:1431-1444)
hardcodes `compatibility.installable: true` with the (always-empty) `unsupported`
of `ResolvedPluginInstallable`. So it cannot run on a force-installed plugin nor
record a partial re-materialization.

**1. Widen the resolve gate** (reinstall.ts:1262-1269) - swap to the
`requireForceInstallable` gate (resolver.ts:1110-1123), which admits
`installable | unsupported` and returns `MaterializablePlugin`
(resolver.ts:136):

```typescript
async function resolveInstallable(
  entry: PluginEntry,
  marketplaceRoot: string,
): Promise<MaterializablePlugin> {            // was ResolvedPluginInstallable
  const resolved = await resolveStrict(entry, { marketplaceRoot });  // NFR-5 cache-only
  requireForceInstallable(resolved, "install");  // was requireInstallable
  return resolved;
}
```

Re-type the threaded `installable` fields (reinstall.ts:1276, :1381, :1421) from
`ResolvedPluginInstallable` to `MaterializablePlugin`. Bridges already accept
this union (Phase 65).

**2. Record the real compatibility set** (reinstall.ts:1431-1439) - replace the
hardcoded record:

```typescript
mp.plugins[plugin] = {
  version: oldRecord.version,                  // SAME recorded version, no upgrade
  resolvedSource: installable.pluginRoot,
  compatibility: {
    installable: installable.state === "installable",  // was hardcoded `true`
    notes: [...installable.notes],
    supported: [...installable.supported],
    unsupported: [...installable.unsupported], // real set, may be non-empty now
  },
  resources: resourcesFromHandles(handles, plugin, installable),
  enabled: true,
  installedAt: oldRecord.installedAt,
  updatedAt: new Date().toISOString(),
};
```

**3. Orchestrated entry** - backfill calls `reinstallPlugin({ render: "none" })`
(reinstall.ts:236-240); the `render === "none"` arm (reinstall.ts:277-279)
returns a `ReinstallPluginOutcome` WITHOUT notifying - the path to fold rows into
the reconcile cascade.

**Side effect to audit:** widening makes the standalone `reinstall` command
succeed on a force-installed plugin. Audit `tests/orchestrators/plugin/reinstall.test.ts`
for any scenario asserting the OLD force-installed failure and update it.

---

### `orchestrators/reconcile/apply-outcomes.ts` (model / type) - MODIFY

**Analog:** self. Add one arm to the `PerEntryOutcome` union (apply-outcomes.ts:234-249),
mirroring the existing `PluginInstalledOutcome` arm shape (apply-outcomes.ts:80-95):

```typescript
/** Plugin re-materialized in place by load-time backfill (BFILL-01). */
export interface PluginBackfilledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-backfilled";
  readonly version?: string;
  readonly dependencies: readonly Dependency[];
  // re-resolved installability: projects to `installed` (empty unsupported)
  // or `force-installed` (partial re-materialize).
  readonly installable: boolean;
}
```

Add `| PluginBackfilledOutcome` to the union (apply-outcomes.ts:248) and handle
it in `buildReconcileAppliedCascade`. Full-promotion case may instead reuse the
existing `plugin-installed` arm -> `(installed)` row (notify.ts:485); only the
partial case needs a `force-installed` reconcile-local arm. The `force-installed`
token already exists in the global `PLUGIN_STATUSES` set (shared/notify.ts:712,
Phase 66), but the reconcile-local narrow set `RECONCILE_APPLIED_PLUGIN_STATUSES`
and its render map must gain a `force-installed` arm, with the narrow-set
tripwire test bumped in lockstep. Pick a sensible-default severity; Phase 69
finalizes severity, Phase 70 freezes the byte-exact token (D-68-04 defers both).

---

### Test files

**`tests/architecture/extension-version-sync.test.ts`** (NEW) - mirror the
file-reading architecture-test pattern from
`tests/architecture/config-state-write-seams.test.ts:1-8` (`fileURLToPath(import.meta.url)`
+ `path.resolve(..., "../..")` to reach repo root):

```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXTENSION_VERSION } from "../../extensions/pi-claude-marketplace/shared/extension-version.ts";

test("BFILL-02: EXTENSION_VERSION matches package.json version", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const pkg = JSON.parse(await readFile(path.join(repoRoot, "package.json"), "utf8")) as {
    version: string;
  };
  assert.equal(EXTENSION_VERSION, pkg.version);
});
```

**`tests/persistence/state-io.test.ts`** (MODIFY) - extend the existing
round-trip harness (`tmpExtensionRoot` + `saveState`/`loadState`, header
state-io.test.ts:1-49). Add: optional field validates; old doc without it loads;
round-trip preserves the stamp; `loadState` normalization carries the field
(regression for the dropped-field hazard).

**Reconcile backfill tests** (`tests/orchestrators/reconcile/`) - new file or
extend `apply.test.ts`. Cover: gate fires on version change / absent stamp;
skips on unchanged version; gate-open with zero force-installed plugins still
stamps and stays silent; unchanged version leaves state.json mtime untouched
(RECON-05); backfill rows fold into the single cascade (exactly one `notify()`).

**Reinstall force-capability tests** (`tests/orchestrators/plugin/reinstall.test.ts`)
- partial re-materialize records non-empty `compatibility.unsupported` and stays
force-installed; update the existing assertion of the old force-installed failure.

**Test conventions** (from `state-io.test.ts` + `config-state-write-seams.test.ts`):
`node:test` + `node:assert/strict`, native TS strip (no tsx), per-test isolated
`mkdtemp` extensionRoot, `import` from `../../extensions/pi-claude-marketplace/...`
with `.ts` extensions. Test titles anchor on `BFILL-NN` / `D-68-NN` / `NFR-N` /
`RECON-NN` IDs, never GSD phase/plan references and never bare `Pitfall N`.

## Shared Patterns

### Stamp write seam (SPLIT-02 / NFR-1)
**Source:** `transaction/with-state-guard.ts:66-76` (`withStateGuard`) +
`persistence/state-io.ts:314-323` (`saveState`).
**Apply to:** the version-stamp write in `applyBackfillForScope`.

```typescript
// after the scan, when the gate opened (independent of materialize count):
await withStateGuard(locationsFor(scope, opts.cwd), (state) => {
  state.lastReconciledExtensionVersion = EXTENSION_VERSION;  // saveState revalidates + atomic-writes
});
```

`withStateGuard` re-loads fresh state (reflecting any reinstall writes), mutates,
and `saveState`s under the per-scope lock - CR-01-safe (separate lock from each
`reinstallPlugin`). NEVER write the stamp via a bare `atomicWriteJson(stateJsonPath, ...)`
- `tests/architecture/config-state-write-seams.test.ts:75-78` pins state.json
writers to exactly `state-io.ts::saveState` and `migrate.ts::persistMigratedState`.

### Cache-only re-resolution (NFR-5)
**Source:** `domain/resolver.ts` `resolveStrict` (used at reinstall.ts:1266).
**Apply to:** the backfill candidate scan and the widened reinstall resolve.
Re-resolution is offline; backfill must never touch the network.

### Force-state classification (FSTAT-01 / D-66-01)
**Source:** derived re-resolution to `unsupported` (Phase 66), NOT a persisted
flag. **Apply to:** the candidate scan - iterate `state.marketplaces[*].plugins[*]`,
`resolveStrict` each entry, select those that re-resolve `unsupported` AND whose
re-resolved `supported` set is strictly larger than the recorded
`compatibility.supported` (the boundary moved for that plugin). Do NOT
reintroduce a `forceInstalled` flag.

### Single cascade notify (RECON-04 / IL-2)
**Source:** `apply.ts:851-865`. **Apply to:** all backfill rows - push onto the
shared `outcomes[]`; the one `notifyReconcileAppliedWithContext` at apply.ts:865
emits them. No second `notify()`; all user output via the cascade.

### Comment / test-title anchors
**Source:** `.claude/rules/typescript-comments.md`. Use `D-68-NN`, `BFILL-NN`,
`NFR-N`, `RECON-NN`, `RINST-01`, `FSTAT-01`, `SPLIT-02`, `CR-01`. NEVER GSD
phase/plan/wave references; never bare `Pitfall N`. ASCII only.

## No Analog Found

None. Every file has an in-tree analog (mostly the file itself being extended).
The one genuinely new module (`shared/extension-version.ts`) is a trivial leaf
constant with a documented decision (D-68-01 / BFILL-02 recommendation), and its
test mirrors the existing architecture-test file-read pattern.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{persistence,orchestrators,transaction,domain,shared}/`,
`tests/{persistence,orchestrators,architecture}/`.
**Files scanned:** state-io.ts, apply.ts, reinstall.ts, apply-outcomes.ts,
with-state-guard.ts, resolver.ts, config-state-write-seams.test.ts,
state-io.test.ts; plus test-dir listings.
**Pattern extraction date:** 2026-06-27
