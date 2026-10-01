# Phase 2: Uninstall data disposition and the uninstall option seam - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 11
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/edge/handlers/shared.ts` | utility | transform | same file, `extractLocalFlag` | exact |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` | controller | request-response | `edge/handlers/plugin/install.ts` | role-match |
| `extensions/pi-claude-marketplace/edge/flag-catalog.ts` | config | transform | same file, catalog derivations | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` | service | file-I/O | same file, `runPostUninstallCleanup` | exact |
| `docs/output-catalog.md` | config | transform | its existing uninstall section | exact |
| `tests/edge/handlers/shared.test.ts` | test | transform | same file, scanner contract cases | exact |
| `tests/edge/handlers/plugin/uninstall.test.ts` | test | request-response | `tests/edge/handlers/plugin/install.test.ts` | role-match |
| `tests/edge/flag-catalog.test.ts` | test | transform | same file, uninstall derivation assertion | exact |
| `tests/architecture/flag-catalog-drift.test.ts` | test | transform | same file, ordered handler parse-set pin | exact |
| `tests/orchestrators/plugin/uninstall.test.ts` | test | file-I/O | same file, data-cleanup and end-state cases | exact |
| `tests/orchestrators/reconcile/apply.test.ts` | test | event-driven | same file, reconcile uninstall fixture | exact |

`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` and
`persistence/locations.ts` are read-only consumer/safety analogs. Phase 2 does
not need to modify them: reconcile already omits any disposition option, and
the locations helper already owns name validation and containment.

## Pattern Assignments

### `extensions/pi-claude-marketplace/edge/handlers/shared.ts` (utility, transform)

**Analog:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts`

**Scanner and rejection pattern** (lines 42-81):

```typescript
export function extractLocalFlag(
  args: string,
  ctx: ExtensionCommandContext,
  usage: string,
  passThroughLongFlags: readonly string[] = [],
): { local: boolean; residualArgs: string } | undefined {
  let local = false;
  const tokens = args.split(/\s+/).filter((t) => t.length > 0);
  let skipValue = false;
  for (const tok of tokens) {
    if (skipValue) { skipValue = false; continue; }
    if (tok === "--scope") { skipValue = true; continue; }
    if (tok === SCOPE_TARGET_FLAG) { local = true; continue; }
    if (tok.startsWith("--")) {
      if (passThroughLongFlags.includes(tok)) continue;
      notifyUsageError(ctx, { message: `Unknown flag: "${tok}".`, usage });
      return undefined;
    }
  }
  return { local, residualArgs: tokens.filter((t) => t !== SCOPE_TARGET_FLAG).join(" ") };
}
```

Extend this one scanner only. Preserve scope-value skipping, duplicate-boolean
behavior, and the usage-notification boundary; explicitly reject short flags
too, because the present `startsWith("--")` condition lets a short token reach
the positional parser.

### `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` (controller, request-response)

**Analog:** `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts`

**Catalog-owned accepted extras** (lines 34-56):

```typescript
const USAGE =
  "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project] [--map-model] [--partial] [--local]";
const PASS_THROUGH_FLAGS = passThroughFlagNames("install");

const localFlag = extractLocalFlag(args, ctx, USAGE, PASS_THROUGH_FLAGS);
if (localFlag === undefined) {
  return;
}
```

**Typed opt-in forwarding** (lines 89-104):

```typescript
await installPlugin({
  ctx, pi, scope: flagged.scope ?? "user", cwd: ctx.cwd,
  marketplace: ref.marketplace, plugin: ref.plugin,
  ...(mapModel && { mapModel: true }),
  ...(partial && { partial: true }),
  ...(localFlag.local && { local: true }),
});
```

Use the current uninstall shim for its reference parsing and scope forwarding
(`uninstall.ts:24-45`), but copy install's `passThroughFlagNames("verb")`
seam. Add `--keep-data` to the usage in catalog order, remove/consume it before
`parseRequiredPluginMarketplaceRef`, and forward only the true opt-in property.

### `extensions/pi-claude-marketplace/edge/flag-catalog.ts` (config, transform)

**Analog:** `extensions/pi-claude-marketplace/edge/flag-catalog.ts`

**Single-source catalog derivations** (lines 143-194):

```typescript
uninstall: [WRITE_TARGET_FLAG_ENTRY],

export function completionFlagEntries(verb: CatalogVerb): { name: string; description?: string }[] {
  return CATALOG[verb].filter((f) => f.complete).map((f) => ({ name: f.name, description: f.description }));
}

export function parseFlagNames(verb: CatalogVerb): Set<string> {
  return new Set(CATALOG[verb].filter((f) => f.parse).map((f) => f.name));
}

export function passThroughFlagNames(verb: CatalogVerb): readonly string[] {
  return CATALOG[verb].filter((f) => f.parse && f.name !== SCOPE_TARGET_FLAG).map((f) => f.name);
}
```

Declare the new entry beside `WRITE_TARGET_FLAG_ENTRY` with `parse: true` and
`complete: true`; do not add handler-owned literals or a separate completion
path. Its concise description should state that it preserves plugin data.

### `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` (service, file-I/O)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`

**Optional operation option** (lines 131-158):

```typescript
export interface UninstallPluginOptions {
  readonly ctx: NotificationContext;
  readonly pi: ToolInventory;
  readonly scope?: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
  readonly cascade?: typeof cascadeUnstagePlugin;
  readonly notifications?: UninstallPluginNotifications;
  readonly local?: boolean;
}
```

**Post-commit ordering and contained deletion** (lines 460-495):

```typescript
try {
  await completionCache.dropMarketplaceCache(
    await locations.pluginCacheFile(marketplace), scope, marketplace,
  );
} catch { /* hygienic cleanup never becomes the primary user-facing path */ }

const dataDir = await locations.pluginDataDir(marketplace, plugin);
try {
  await rm(dataDir, { recursive: true, force: true });
} catch { /* hygienic cleanup never becomes the primary user-facing path */ }

try { await garbageCollectPluginClones(locations); } catch { /* same policy */ }
```

**Only call cleanup after a completed durable uninstall** (lines 765-788):

```typescript
if (alreadyGone) return emitAlreadyGone({ ctx, pi, marketplace, scope, plugin, orchestrated });
if (cascadeFailure !== undefined) return emitCascadeFailure(/* existing fields */);
await transaction.runPostCommitCleanup(completionCache, locations, scope, marketplace, plugin);
```

Add one optional preservation boolean to this existing options bundle and thread
it to cleanup. When true, skip the entire `pluginDataDir` resolution/removal
block; retain cache invalidation, clone collection, commit ordering, failure
handling, and the existing success notification bytes.

### `docs/output-catalog.md` (config, transform)

**Analog:** `docs/output-catalog.md`, uninstall success contract (lines 781-809).

```text
● official [user]
  ○ helper v1.0.0 (uninstalled)

/reload to pick up changes
```

Document `--keep-data` and the default deletion behavior adjacent to the
uninstall command contract. Keep the existing success block unchanged: there is
no retained-data trailer or new notification variant.

### Test owner files (test)

**Scanner rejection matrix:** `tests/edge/handlers/shared.test.ts:164-218`
passes catalog-derived extras, then asserts the complete usage notification and
zero side effects for an unrecognized long flag. Add `--keep-data` placement
and duplicate coverage here, plus rejected `-y` coverage in prefix and suffix
positions.

**Handler end state:** `tests/edge/handlers/plugin/uninstall.test.ts:478-493`
uses a hermetic workspace, invokes the real handler, compares the full emitted
notification, and compares `readObservedEffects(workspace)` to the unchanged
whole footprint. Reuse this for rejected flags and add accepted keep-data cases
in the same owner.

**Catalog derivation and architecture pins:**

```typescript
const completionEntries = completionFlagEntries("uninstall");
const parseNames = parseFlagNames("uninstall");
assert.deepStrictEqual(completionEntries, expectedEntries);
assert.deepStrictEqual(parseNames, new Set([SCOPE_TARGET_FLAG]));
```

Source: `tests/edge/flag-catalog.test.ts:95-112`. Update independent expected
values and the ordered `HANDLER_ACCEPTED_PARSE_SETS.uninstall` pin in
`tests/architecture/flag-catalog-drift.test.ts:112-125`.

**Filesystem data disposition:** `tests/orchestrators/plugin/uninstall.test.ts:372-439`
seeds real data, calls the real owner, asserts state removal and exact output,
then cleans up its temporary directory. Add independently asserted nested data
bytes for preserve/delete/default paths. Keep the containment test at lines
445-493: a deletion request must still propagate a path-safety refusal.

**Reconcile consumer:** `tests/orchestrators/reconcile/apply.test.ts:1182-1332`
uses real config/state/resources, runs reconcile twice, asserts the first
uninstall and second silence, route/cache effects, and the exact notification.
Seed a data file into this fixture and assert its removal after the first pass;
do not alter the consumer call, which intentionally omits the new option.

## Shared Patterns

### Option ownership and validation

**Sources:** `edge/flag-catalog.ts:174-194`; `edge/handlers/shared.ts:42-81`
**Apply to:** catalog, scanner, and uninstall handler.

The catalog derives both completions and parse-accepted names. The shared
scanner sends errors through `notifyUsageError` and must reject unsupported
tokens before uninstall can mutate state.

### Uninstall cleanup policy

**Sources:** `orchestrators/plugin/uninstall.ts:460-495,765-788`; `persistence/locations.ts:216-227`
**Apply to:** uninstall operation and its owner tests.

Call `locations.pluginDataDir()` only when deletion is requested; that helper
performs `assertSafeName` and `assertPathInside`. Keep path resolution outside
the `rm` failure catch. Hygiene failures are swallowed only after the durable
state change; cache and clone cleanup are independent of data disposition.

### Reconcile default

**Source:** `orchestrators/reconcile/apply.ts:347-358`

```typescript
const result = await uninstallPlugin({
  ctx: opts.ctx, pi: opts.pi, scope: op.scope, cwd: opts.cwd,
  marketplace: op.marketplace, plugin: op.plugin,
  notifications: { mode: "orchestrated" },
});
```

**Apply to:** reconcile owner test. Omission of the optional preservation
property is the promptless delete-data default required by DATA-03.

## No Analog Found

None. Phase 2 extends existing owners and paired tests; it creates no new
module or standalone test owner.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{edge,orchestrators,persistence}`, `tests/{edge,orchestrators,architecture}`, `docs/`
**Files scanned:** 14 tracked source, test, and documentation files
**Pattern extraction date:** 2026-09-14
