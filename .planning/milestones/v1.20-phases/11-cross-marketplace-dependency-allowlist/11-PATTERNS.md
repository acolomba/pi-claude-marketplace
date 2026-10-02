# Phase 11: Cross-marketplace dependency allowlist - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 30 existing files (12 source, 15 test/fixture, 3 docs)
**Analogs found:** 30 / 30. Each target already exists, so its current implementation is the closest tracked analog. All paths below were confirmed by `git ls-files`.

## File Classification

All analog paths in the last column are git-tracked source paths, never capability mirrors.

| New/Modified File | Role | Data Flow | Closest Analog (same existing file) | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/manifest.ts` | model, validation | file-I/O, transform | `extensions/pi-claude-marketplace/domain/manifest.ts` | exact |
| `extensions/pi-claude-marketplace/domain/dependency-closure.ts` | service | graph traversal, transform | `extensions/pi-claude-marketplace/domain/dependency-closure.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | controller | request-response, file-I/O | `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | service | batch, transactional file-I/O | `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` | utility | transform | `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` | service | batch, transform | `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` | model | transform | `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | controller | event-driven, batch | `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` | controller | request-response, file-I/O | `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts` | exact |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` | model | transform | `extensions/pi-claude-marketplace/shared/notification-types.ts` | exact |
| `extensions/pi-claude-marketplace/shared/notification-grammar.ts` | utility | transform | `extensions/pi-claude-marketplace/shared/notification-grammar.ts` | exact |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | model, config | transform | `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | exact |
| `tests/domain/manifest.test.ts` | test | file-I/O | `tests/domain/manifest.test.ts` | exact |
| `tests/domain/dependency-closure.test.ts` | test | graph traversal | `tests/domain/dependency-closure.test.ts` | exact |
| `tests/orchestrators/plugin/install-flow.test.ts` | test | request-response, file-I/O | `tests/orchestrators/plugin/install-flow.test.ts` | exact |
| `tests/orchestrators/plugin/install-cascade.test.ts` | test | batch, transactional file-I/O | `tests/orchestrators/plugin/install-cascade.test.ts` | exact |
| `tests/orchestrators/plugin/install-cascade.messaging.test.ts` | test | transform | `tests/orchestrators/plugin/install-cascade.messaging.test.ts` | exact |
| `tests/orchestrators/reconcile/plan.test.ts` | test | batch, transform | `tests/orchestrators/reconcile/plan.test.ts` | exact |
| `tests/orchestrators/reconcile/apply.test.ts` | test | event-driven, batch | `tests/orchestrators/reconcile/apply.test.ts` | exact |
| `tests/orchestrators/marketplace/info.test.ts` | test | request-response, file-I/O | `tests/orchestrators/marketplace/info.test.ts` | exact |
| `tests/shared/notification-grammar.test.ts` | test | transform | `tests/shared/notification-grammar.test.ts` | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` | test | static contract | `tests/architecture/notify-closed-set-locks.test.ts` | exact |
| `tests/architecture/compat-01-no-expansion.test.ts` | test | static contract | `tests/architecture/compat-01-no-expansion.test.ts` | exact |
| `tests/architecture/dependency-doc-agreement.test.ts` | test | static contract, transform | `tests/architecture/dependency-doc-agreement.test.ts` | exact |
| `tests/architecture/catalog-uat/catalog-contract.test.ts` | test | fixture-to-render transform | `tests/architecture/catalog-uat/catalog-contract.test.ts` | exact |
| `tests/architecture/catalog-uat/fixtures/plugin-install.ts` | test fixture | fixture-to-render transform | `tests/architecture/catalog-uat/fixtures/plugin-install.ts` | exact |
| `tests/architecture/catalog-uat/fixtures/marketplace-info.ts` | test fixture | fixture-to-render transform | `tests/architecture/catalog-uat/fixtures/marketplace-info.ts` | exact |
| `docs/dependency-resolution.md` | documentation | user contract | `docs/dependency-resolution.md` | exact |
| `docs/output-catalog.md` | documentation | rendered-output contract | `docs/output-catalog.md` | exact |
| `docs/messaging-style-guide.md` | documentation | messaging contract | `docs/messaging-style-guide.md` | exact |

The catalog runner is conditional: add one or more state-count/order entries there only if new catalog states are added. The two fixture files are the actual payload owners and were not named in RESEARCH.md's test table.

## Pattern Assignments

### `extensions/pi-claude-marketplace/domain/manifest.ts` (model/validation, file-I/O)

**Analog:** same file. Imports and schema at lines 9-19, 29-43:

```typescript
import Type from "typebox";
import { Compile } from "typebox/compile";
import { InvalidMarketplaceManifestError } from "../shared/errors.ts";

const MARKETPLACE_SCHEMA = Type.Object({
  name: Type.String(),
  plugins: Type.Array(PLUGIN_ENTRY_SCHEMA),
  strict: Type.Optional(Type.Boolean()),
});
export type MarketplaceManifest = Type.Static<typeof MARKETPLACE_SCHEMA>;
const MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA);
```

Validation and error form at lines 123-133; cached read-only result at 136-153:

```typescript
if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
  const validationErrors = MARKETPLACE_VALIDATOR.Errors(parsed);
  const detail = validationErrors
    .slice(0, 1)
    .map((error) => `${error.instancePath || "<root>"}: ${error.message}`)
    .join("");
  throw new InvalidMarketplaceManifestError(`marketplace.json schema invalid: ${detail}`);
}
```

Add `Type.Optional(Type.Array(Type.String()))` in this schema. The existing `Check` produces a field-path error for malformed present values; all consumers must use this loader's cached parsed value.

### `extensions/pi-claude-marketplace/domain/dependency-closure.ts` (service, graph traversal)

**Analog:** same file. The options/result discriminants are at lines 123-169. Edge creation at 303-324 fills in an omitted marketplace from the *declaring* plugin and stores `requiredBy`:

```typescript
const marketplace = args.dependency.marketplace ?? args.declaringMarketplace;
return {
  kind: "edge",
  edge: {
    key: `${args.dependency.name}@${marketplace}`,
    parts: { name: args.dependency.name, marketplace },
    requiredBy: args.declaringKey,
  },
};
```

The guard order at lines 363-387 is the key pattern:

```typescript
const member = recordEdge(ctx, edge);
const isRoot = edge.key === ctx.options.rootKey;
if (!isRoot && ctx.options.installedKeys.has(edge.key)) {
  if (!ctx.skipped.includes(member)) {
    ctx.skipped.push(member);
  }
  return undefined;
}
if (!isRoot && !ctx.options.knownMarketplaces.has(edge.parts.marketplace)) {
  return { ok: false, reason: "marketplace-not-added", key: edge.key,
    marketplace: edge.parts.marketplace, requiredBy: edge.requiredBy };
}
return walkEdge(ctx, edge, member);
```

Add the new allowlist failure arm to `DependencyClosureResult`. Compare each uninstalled edge's marketplace with the cascade **root** marketplace after `installedKeys.has` and before `knownMarketplaces.has`. `resolveDependencyClosure` at 451-476 owns the root key and the pure walk context.

### `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` (controller, request-response/file-I/O)

**Analog:** same file. Scope-aware source selection and cached load at lines 508-523:

```typescript
const source = await resolveInstallMarketplaceSource({
  targetScope: core.scope, cwd: core.cwd,
  marketplace: subject.marketplace, targetState: state,
});
if (source === undefined) return { kind: "absent" };
const manifest = await loadMarketplaceManifest(source.sourceRecord.manifestPath);
```

Direct install calls `runInstallCascade` at 1448-1502. The reload operation's options and return union are at 1981-2033; its locked transaction starts at 2080. Preserve the existing installed-first check before reading any policy:

```typescript
const state = tx.state;
if (state.marketplaces[marketplace]?.plugins[plugin] !== undefined) {
  return { kind: "already-recorded" };
}
const cascade = await runInstallCascade({
  state, locations, rootKey, rootRanges: opts.ranges,
  treatDisabledAsWall: true,
  lookup: (subject) => lookupCascadeDependencies(state, { scope, cwd, locations }, subject),
  // ... scope-aware source and installed/known sets ...
});
```

The reload root is the missing dependency (lines 2063-2076, 2092-2095), so check every eligible original declarer before this cascade. Feed this cascade the missing root's own list for its transitive edges. On refusal, use its existing `CascadeFailureSink`/`handleCascadeThrow` pattern (lines 2071-2075, 2137-2153, 2162-2185) so notification still flows through the existing command boundary. The current synthetic `marketplace-not-added` failure at 2139-2153 handles an absent target source; keep that condition separate.

### `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` (service, batch/transactional file-I/O)

**Analog:** same file. Carry options by readonly fields as at lines 429-461 (`rootKey`, `rootRanges`, `installedKeys`, `knownMarketplaces`). Forward to closure and return before any materialization at 1175-1185:

```typescript
const closure = await resolveDependencyClosure({
  rootKey: options.rootKey,
  lookup: options.lookup,
  installedKeys: options.treatDisabledAsWall === true
    ? options.installedKeys : liveInstalledKeys(options.state, options.installedKeys),
  knownMarketplaces: options.knownMarketplaces,
});
if (!closure.ok) return { kind: "closure-failed", failure: closure };
```

Add the root list to `InstallCascadeOptions` and forward it without recomputing it from each intermediary marketplace.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` (reload bucket and handoff)

**Analogs:** same files. The planner's grouping at `plan.ts:781-824` preserves ranges but currently only the first declarer:

```typescript
const grouped = new Map<string, { ranges: string[]; requiredBy: string }>();
// first declaration:
grouped.set(entry.dependency, {
  ranges: [...(entry.ranges ?? [])], requiredBy: entry.dependent,
});
// later declaration:
group.ranges.push(...(entry.ranges ?? []));
```

`types.ts:174-190` defines `PlannedDependencyInstall` with `ranges` and `requiredBy`. Retain `requiredBy` as the stable failed-row label and add a separate complete, deduplicated list of eligible declarer keys. `apply.ts:682-707` keeps the reload-only gate and passes the plan's fields into `installMissingDependency`:

```typescript
if (opts.reason !== "reload") return false;
for (const op of plan.pluginsToDependencyInstall) {
  const result = await installMissingDependency({
    ctx: opts.ctx, pi: opts.pi, scope: op.scope, cwd: opts.cwd,
    marketplace: op.marketplace, plugin: op.plugin,
    ranges: op.ranges, requiredBy: op.requiredBy,
  });
}
```

### `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`, `extensions/pi-claude-marketplace/shared/notification-types.ts`, `extensions/pi-claude-marketplace/shared/notification-grammar.ts` (read-only info)

**Analogs:** same files. `info.ts:13-27` imports the cached loader, typed message, and `notify`. Its block at 89-99 projects parsed data, rather than composing output text:

```typescript
const parsed = (await loadMarketplaceManifest(record.manifestPath)) as Record<string, unknown>;
const description = typeof parsed.description === "string" ? parsed.description : undefined;
return { kind: "marketplace-info", name: record.name, scope: record.scope,
  details, source, ...(description !== undefined && { description }) };
```

`notification-types.ts:718-734` owns `MarketplaceInfoMessage` optional fields. `notification-grammar.ts:1149-1188` renders source, `last_updated`, then `description` as separate lines:

```typescript
if (message.description !== undefined) {
  lines.push(`description: ${message.description}`);
}
return lines.join("\n");
```

Project the parsed list into the typed message. Render `allowed_marketplaces:` only for a nonempty list. Keep arbitrary strings from forging line breaks or control sequences; use one stable escaped representation and test it. The same `renderMarketplaceInfo` handles both scopes (`notification-grammar.ts:1210-1214`).

### `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts`, `extensions/pi-claude-marketplace/shared/notification-types.ts`, `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (failure rows)

**Analogs:** same files. The exhaustive closure-reason switch at `install-cascade.messaging.ts:273-323` maps a structured failure into a reason and `DependencyCascadeError`:

```typescript
case "marketplace-not-added":
  return {
    key: failure.key,
    reasons: ["dependency marketplace not added"],
    cause: new DependencyCascadeError(
      `Dependency "${failure.key}" requires marketplace "${failure.marketplace}", which is not added. Run marketplace add <source> to add it.`,
      failure.key,
    ),
  };
```

`composeCascadeFailureMessage` at 479-510 builds the dependency failed row and the root `{dependency failed}` row. `notification-types.ts:5-14,86-101` owns the append-only `Reason` union. `notify-reasons.ts:345-355` classifies dependency reasons as `ContentReason`; its membership proof must include the new token. Add a `cross-marketplace` arm that names dependency, declarer, target marketplace, manual-install remedy, and the **root** marketplace manifest field.

## Test and Documentation Assignments

These are paired with the source changes above. The cited lines contain the concrete form to copy; use each file's existing imports/helpers rather than adding a new test harness.

| File | Concrete analog excerpt and location | Phase use |
|---|---|---|
| `tests/domain/manifest.test.ts` | Lines 77-107: table of `[manifest, expectedPath]`; `await assert.rejects(() => loadMarketplaceManifest(path), error => { assert.ok(error instanceof InvalidMarketplaceManifestError); assert.strictEqual(error.message, ...); return true; })`. | Add valid empty/nonempty arrays and scalar/null/mixed-array rejections naming `/allowCrossMarketplaceDependenciesOn`. |
| `tests/domain/dependency-closure.test.ts` | Lines 340-353: installed `installed@gone` succeeds with only `mp` known; lines 356-376 assert full `marketplace-not-added` object; 379-401 cover transitive foreign edge. | Pin installed-first, same root, root allowlist, transitive denial, and refusal before lookup. |
| `tests/orchestrators/plugin/install-flow.test.ts` | Lines 11560-11606 call `installMissingDependency({ ..., ranges: [], requiredBy: "deploy-kit@mp" })` then inspect outcome/state; lines 11950-11982 assert already-recorded leaves state mtime unchanged. | Extend direct/reload scenarios and option payloads; test refusal before state/file mutation and installed-first skip. |
| `tests/orchestrators/plugin/install-cascade.test.ts` | Lines 2165-2193 call `runInstallCascade`, assert `kind: "closure-failed"`, full failure, and unchanged disabled records; 1855-1876 show a cross-marketplace fixture that needs an explicit root allowlist to retain its current expected outcome. | Add root-policy option to every call and check closure failure before phases. |
| `tests/orchestrators/plugin/install-cascade.messaging.test.ts` | Lines 469-497 build a `CascadeFailureSubject`, call `emit(failureRows(subject), BOTH_LOADED)`, and assert exact severity/message bytes with dependency and root failed rows. | Add exact `cross-marketplace` cause and both remedies. |
| `tests/orchestrators/reconcile/plan.test.ts` | Lines 1054-1083: two declarers produce one bucket with both ranges and the first `requiredBy`. | Assert complete eligible-declarer list, stable first label, deduplication, exclusions. |
| `tests/orchestrators/reconcile/apply.test.ts` | Lines 5563-5603 set up a cross-marketplace reload with two local marketplace sources and declared dependency. | Give root marketplace an allowlist for success; add refusal and second-only-authorizer cases. |
| `tests/orchestrators/marketplace/info.test.ts` | Lines 252-286: hermetic manifest/state, `notificationBoundary` exact message, unchanged environment snapshot; 289-305 show optional fields. | Test absent, empty, nonempty list, both scopes, and escaped value representation. |
| `tests/shared/notification-grammar.test.ts` | Lines 482-501 compare exact `renderMarketplaceInfo` bytes with optional `last_updated` and `description`; lines 504-520 set up two-scope cascade. | Test line omission, placement, and two-scope output. |
| `tests/architecture/notify-closed-set-locks.test.ts` | Lines 84-90 list reason enrollment; 254 asserts exact count `62`. | Add `cross-marketplace`, update exact count to 63. |
| `tests/architecture/compat-01-no-expansion.test.ts` | Lines 270-281 contain dependency reason order; 390-409 compare ordered source union with `EXPECTED_REASONS`. | Append new token at the union/catalog tail and in ordered expected list at the same position. |
| `tests/architecture/dependency-doc-agreement.test.ts` | Lines 74-93: `CLOSURE_FAILURES` is `satisfies Record<ClosureFailure["reason"], ClosureFailure>`. | Add fixture for the new discriminant and assert docs/catalog message agreement. |
| `tests/architecture/catalog-uat/fixtures/plugin-install.ts` | Lines 749-779: a named state carries a typed failed dependency row and root `{dependency failed}` row. | Add cross-marketplace state with exact cause/remedies. |
| `tests/architecture/catalog-uat/fixtures/marketplace-info.ts` | Lines 9-35: full/minimal typed `marketplace-info` fixtures; lines 88-109: two-scope cascade. | Add nonempty and empty/absent list states consistent with D-11-04. |
| `tests/architecture/catalog-uat/catalog-contract.test.ts` | Lines 9-30 import fixture maps; 34-46 declare expected counts; 212-233 merge fixtures and reject duplicate state names. | Run catalog gate; update counts/order only if added states demand it. |
| `docs/dependency-resolution.md` | Lines 45-47 state marketplace selection; 108-112 explain already-installed and disabled records. | Add root allowlist rule and manual-install exception near marketplace selection; retain installed/version behavior. |
| `docs/output-catalog.md` | Lines 922-937 pair `<!-- catalog-state: dependency-marketplace-not-added -->` with a fenced exact rendered block and explanatory paragraph; 2131-2145 show info state/omission prose. | Add catalog state(s) for refusal and nonempty info, with fixtures in matching order. |
| `docs/messaging-style-guide.md` | Lines 7-11 say producers construct typed messages and `notify()` renders them; lines 61-66 describe closed-set reason and cause discipline. | Document the new reason/cause grammar by reference to types and catalog, without duplicating an independent reason list. |

## Shared Patterns

### Policy source and scope

**Source:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:508-523` and `extensions/pi-claude-marketplace/domain/manifest.ts:136-153`. Select a marketplace record with `resolveInstallMarketplaceSource({ targetScope, cwd, marketplace, targetState })`; then call `loadMarketplaceManifest(source.sourceRecord.manifestPath)`. This is the cached, validated source used by info and install. Treat the returned object as read-only. An absent field means an empty list; a malformed present field throws the existing typed manifest error.

### Installed-first policy

**Source:** `extensions/pi-claude-marketplace/domain/dependency-closure.ts:367-387` and `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:2083-2090`. Record each edge, then skip a recorded dependency before evaluating the allowlist. Reload also skips an already-recorded missing root inside its lock before reading any manifest. A known marketplace is availability, not authorization.

### Reload original edge

**Source:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:781-824`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:682-707`, and `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:2080-2136`. The plan groups all eligible declarers into one missing key; the apply step passes its bucket to a new cascade whose root is that missing key. Authorize the original declarer-to-missing edge before the synthetic-root cascade: same marketplace or **any** eligible declarer's validated root marketplace allowlist grants it. Keep the first `requiredBy` for the stable failure row. The missing root's own allowlist then governs its transitive closure.

### Failure and notification

**Source:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:273-323,479-510` and `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:2162-2185`. Return a structured closure failure before phases; map it to a `PluginFailedMessage` with `severity: "error"`, `needsReload: false`, a `DependencyCascadeError` cause, and a root `{dependency failed}` row. Command code emits through `notify`, not stdout/stderr. There is no HTTP authentication guard in this feature; git credentials remain in existing ledger paths.

### Contract gates

**Source:** `extensions/pi-claude-marketplace/shared/notification-types.ts:5-14`, `extensions/pi-claude-marketplace/shared/notify-reasons.ts:345-355`, `tests/architecture/notify-closed-set-locks.test.ts:84-90,254`, `tests/architecture/compat-01-no-expansion.test.ts:390-409`, and `tests/architecture/catalog-uat/catalog-contract.test.ts:212-233`. A new user-visible reason moves with the type union, classification proof, exact count, ordered compatibility list, catalog fixture, and catalog prose.

## No Analog Found

None. All planned targets are existing tracked files with matching role and data-flow patterns. No new test harness, validator, or notification system is needed.

## Metadata

**Analog search scope:** tracked `extensions/pi-claude-marketplace`, `tests`, and `docs`; CodeGraph was queried before code search.
**Files scanned:** 30 tracked targets plus CodeGraph call-path references.
**Pattern extraction date:** 2026-09-23.
**No source edits:** this map is the only file written.
