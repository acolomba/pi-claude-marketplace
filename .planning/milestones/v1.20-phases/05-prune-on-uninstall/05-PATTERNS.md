# Phase 05: Prune on uninstall - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 14 production files (2 new, 12 modified) + 6 test surfaces
**Analogs found:** 14 / 14 (every path below verified git-tracked; no mirror paths)

All paths are relative to `/home/acolomba/src/pi-claude-marketplace-manifest/`. `E/` abbreviates `extensions/pi-claude-marketplace/`. Line numbers are from the files as they stand on `features/manifest` at HEAD `69dd8ae1`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `E/domain/dependency-orphans.ts` (NEW) | domain (pure) | transform (graph fixpoint) | `E/domain/dependency-closure.ts` | exact (pure graph walk over an injected declaration set) |
| `E/orchestrators/plugin/dependency-index.ts` (NEW) | orchestrator leaf | file-I/O (offline manifest reads, discriminated result) | `E/orchestrators/plugin/install-flow.ts::lookupCascadeDependencies` (lines 481-506) + `E/orchestrators/plugin/install-disable-cascade.ts` (leaf/DI shape) | exact for the read composition; role-match for the leaf shape |
| `E/orchestrators/plugin/uninstall.ts` (MODIFY) | orchestrator (ledger owner) | request-response inside a locked transaction | itself + `E/orchestrators/plugin/install-outcome.ts::runInstallLedger` (guard-free body extraction) | exact |
| `E/orchestrators/plugin/uninstall.messaging.ts` (MODIFY) | messaging (row composers, private reason pin) | transform | `E/orchestrators/marketplace/remove.messaging.ts` (private-reason pin), `E/orchestrators/plugin/install.messaging.ts::composePromotedRow` (reason-carrying success row), `E/orchestrators/plugin/install-cascade.messaging.ts::closureFailureFacts` (cause-line failure facts) | exact |
| `E/edge/flag-catalog.ts` (MODIFY) | config (flag SSOT) | -- | itself: `KEEP_DATA_FLAG_ENTRY` / `KEEP_DATA_FLAG` (lines 79-84, 190) | exact |
| `E/edge/handlers/plugin/uninstall.ts` (MODIFY) | edge handler | request-response | itself: `KEEP_DATA_FLAG` mapping (line 58) | exact |
| `E/edge/router.ts` (MODIFY) | edge usage text | -- | itself: line 95 | exact |
| `E/orchestrators/reconcile/apply.ts` (MODIFY) | orchestrator | batch | itself: `applyPluginUninstalls` (lines 341-390) | exact |
| `E/orchestrators/reconcile/apply-outcomes.ts` (MODIFY) | model (outcome union) | -- | `InvalidBlockOutcome.cause?: Error` (lines 316-326) | exact |
| `E/orchestrators/reconcile/notify.ts` (MODIFY) | projection | transform | `invalid-config` arm cause child (lines 715-737); shared failed arm (lines 841-851) | exact |
| `E/shared/notification-types.ts` (MODIFY) | model (closed-set tuple) | -- | the `dependency promoted` tail entry (lines 100-107) | exact |
| `E/shared/notify-reasons.ts` (MODIFY) | model (partition + ledger) | -- | the `dependency promoted` arm of `CommandPrivateReason` (lines 283-287) + header ledger (lines 34-37) | exact |
| `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` (MODIFY) | test fixture | -- | its own `success-keep-data` fixture (lines 32-51) | exact |
| `tests/domain/dependency-orphans.test.ts` (NEW) | test | -- | `tests/domain/dependency-closure.test.ts` (synthetic `Graph`, lines 25-40) + `tests/orchestrators/plugin/install-declared-enabled.test.ts` (table-driven cases) | exact |
| `tests/orchestrators/plugin/dependency-index.test.ts` (NEW) | test | -- | `tests/orchestrators/plugin/dependency-declaration-read.test.ts` (injected `DependencyDeclarationReader` seam, lines 51-70) + `tests/orchestrators/plugin/install-disable-cascade.test.ts` (in-memory `ExtensionState`, lines 33-67) | exact |
| `tests/orchestrators/plugin/uninstall.test.ts` fixtures (MODIFY) | test | -- | `tests/orchestrators/reconcile/apply.test.ts::writeMarketplaceSource` (lines 370-397) | exact |

## Pattern Assignments

### `E/domain/dependency-orphans.ts` (domain, pure transform)

**Analog:** `E/domain/dependency-closure.ts`

**Module header discipline** (lines 1-12) -- copy the "why it is in domain/" statement and the two-structure rationale style:
```ts
// domain/dependency-closure.ts
//
// The dependency closure walk: given a root `plugin@marketplace` key, produce
// the post-ordered list of plugins that must be materialized to satisfy it, or
// the first reason the graph cannot be satisfied (RESV-02, RESV-04, RESV-05,
// D-03-08).
//
// The walk lives in `domain/` because it is pure: no I/O, no clock, no
// filesystem and no network. The catalog read arrives as a PARAMETER
// (`ClosureLookup`), so a caller decides where a plugin's declared
// `dependencies` come from and the walk itself stays trivially testable
// against a synthetic graph.
```

**Imports pattern** (lines 49-53) -- domain imports domain only, sibling relative, `type` merged into the value import:
```ts
import {
  isRenderableDependencyToken,
  parseDeclaredDependencies,
  type DeclaredDependency,
} from "./dependencies.ts";
```
The orphan module needs no imports at all if its input is a pre-built `ReadonlyMap<string, ReadonlySet<string>>` (the index leaf does the key derivation). Prefer that: keep the pure module import-free.

**Key derivation contract the index MUST match byte-for-byte** (lines 334, 347):
```ts
  const marketplace = args.dependency.marketplace ?? args.declaringMarketplace;
  ...
      key: `${args.dependency.name}@${marketplace}`,
```
Note `buildChildEdge` REFUSES a `sha`-pinned element (lines 321-330) and an unrenderable marketplace token (lines 335-344). For the orphan test a declaration that names a key HOLDS it regardless of constraint (fail-closed direction, RESEARCH A3) -- do not copy the `sha` refusal; do copy the `isRenderableDependencyToken` fill-in check if the filled marketplace ever reaches a row.

**Discriminated result shape** (lines 62-65) -- copy the `readonly kind` union style for any result the orphan module returns:
```ts
export type ClosureLookupResult =
  | { readonly kind: "found"; readonly dependencies: readonly DeclaredDependency[] }
  | { readonly kind: "absent" }
  | { readonly kind: "unusable"; readonly detail: string };
```

**Doc comment style** (lines 100-114) -- every exported interface carries a `/** */` explaining each field's semantics, citing the decision ID:
```ts
/**
 * One plugin in the resolved graph.
 *
 * `requiredBy` is the key of the plugin whose declaration FIRST introduced this
 * member, and is `undefined` for the root. ...
 */
export interface ClosureMember {
  readonly key: string;
  ...
}
```

**Core sketch:** use RESEARCH.md Pattern 3 (`findDependents`, `pruneOrphans` fixpoint) verbatim as the starting point; extract `isHeldBy(index, gone, key)` so no nested `some` inside `filter` trips `sonarjs`. Anchor comments on `D-05-01` / `D-05-02` / `PRUNE-02` / `PRUNE-03`.

---

### `E/orchestrators/plugin/dependency-index.ts` (orchestrator leaf, file-I/O)

**Analog A (read composition):** `E/orchestrators/plugin/install-flow.ts::lookupCascadeDependencies` (lines 481-506). This is private to a ledger file that `uninstall.ts` may NOT import (both are `PLUGIN_LEDGER_TARGETS`, `tests/architecture/gate-targets.ts:275`), so the leaf re-expresses it over `tx.state`:
```ts
  const manifest = await loadMarketplaceManifest(source.sourceRecord.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, subject.name);
  if (declared.kind === "absent") {
    return { kind: "absent" };
  }

  return readDependencyDeclaration({
    marketplaceRoot: source.sourceRecord.marketplaceRoot,
    entry: declared.entry,
    locations: core.locations,
  });
```
In the leaf, `source.sourceRecord` becomes `state.marketplaces[mpName]` directly -- `manifestPath` / `marketplaceRoot` are `MARKETPLACE_RECORD_SCHEMA` fields (`E/persistence/state-io.ts:285-286`). No `resolveInstallMarketplaceSource` call.

**Reader seam to expose** -- `E/orchestrators/plugin/dependency-declaration-read.ts` lines 72-77 and 80-96:
```ts
export interface DependencyDeclarationReader {
  /** Follows symlinks; true only for a regular file. */
  readonly isRegularFile: (filePath: string) => Promise<boolean>;
  readonly readTextFile: (filePath: string) => Promise<string>;
  readonly makePresenceProbe: typeof makePresenceProbe;
}

/** Inputs of one declaration read. */
export interface DependencyDeclarationReadOptions {
  readonly marketplaceRoot: string;
  readonly entry: ManifestPluginEntry;
  readonly locations: ScopedLocations;
  /** Filesystem seam; production omits it and reads real disk. */
  readonly reader?: DependencyDeclarationReader;
}
```
Thread an optional `reader?: DependencyDeclarationReader` (and an injectable `loadManifest?: typeof loadMarketplaceManifest`) through the leaf's options so `tests/orchestrators/plugin/dependency-index.test.ts` can drive all four arms without disk. Do NOT export a "for tests" helper (`unowned-exports-census.test.ts` pins that).

**Analog B (leaf/DI module shape):** `E/orchestrators/plugin/install-disable-cascade.ts`

Imports (lines 1-15) -- value imports first, then a blank line, then `import type` block, alphabetized within group:
```ts
import { toDisabledRecord } from "../../persistence/state-io.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
...
import { applyPartialCascadeFold } from "./shared.ts";

import type { InstallMsg } from "./install.messaging.ts";
import type { HooksRouting } from "../../bridges/hooks/index.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
```

Record-type derivation from state (lines 53-56) -- copy this instead of importing a record type that is not exported:
```ts
type MarketplaceStateRecord = ExtensionState["marketplaces"][string];
/** Installed record supplied to the injected cascade collaborator. */
export type InstallDisableCascadePluginRecord =
  ExtensionState["marketplaces"][string]["plugins"][string];
```

Discriminated ok/fail result (lines 32-35):
```ts
export type FreshInstallDisableResult =
  | { readonly ok: true; readonly removeRoutes: true }
  | { readonly ok: false; readonly cause: Error; readonly removeRoutes: boolean };
```
For the index: `{ ok: true; index: ReadonlyMap<string, ReadonlySet<string>> } | { ok: false; declarer: string; reason: ContentReason; cause: Error }`.

**Failure-arm token mapping to copy** -- `E/orchestrators/plugin/install-cascade.messaging.ts::closureFailureFacts` (lines 264-277):
```ts
    case "not-found":
      return {
        key: failure.key,
        reasons: ["not in manifest"],
        cause: new Error(`Dependency "${failure.key}" is not declared by its marketplace.`),
      };
    case "unusable-declaration":
      return {
        key: failure.key,
        reasons: ["invalid manifest"],
        cause: new Error(
          `Plugin "${failure.key}" declares an unusable dependency (${failure.detail}).`,
        ),
      };
```
Manifest-load throw arm: `narrowProbeError(err)` from `E/shared/probe-classifiers.ts:37`. Cause text must name the DECLARER (`cannot read the dependencies of Y@mp: <detail>`) and carry keys/field paths only, never an absolute path.

**Helpers to call, not re-implement:** `loadMarketplaceManifest` (`E/domain/manifest.ts:139`), `lookupDeclaredPlugin` (`E/domain/manifest-lookup.ts:54-60`), `readDependencyDeclaration` (`E/orchestrators/plugin/dependency-declaration-read.ts:256`).

---

### `E/orchestrators/plugin/uninstall.ts` (orchestrator, locked request-response)

**Analog:** itself, plus `install-outcome.ts` for the guard-free extraction.

**Option seam to extend** (lines 140-141):
```ts
  /** Preserves plugin data after uninstall; omission or false removes it. */
  readonly keepData?: boolean;
```
Add `readonly prune?: boolean;` directly beneath with a `D-05-10` / `D-05-08` doc comment.

**Injection seam to extend** (lines 164-171, 186-193) -- add the index builder and the per-member removal body here rather than exporting them:
```ts
export interface UninstallTransaction {
  readonly cascadeUnstagePlugin: typeof cascadeUnstagePlugin;
  readonly commitPluginRemoval: typeof commitPluginRemoval;
  readonly loadTargetConfig: typeof loadConfig;
  readonly runPostCommitCleanup: typeof runPostUninstallCleanup;
  readonly sweepConfigLayers: typeof sweepPluginFromConfigLayers;
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}
...
const REAL_UNINSTALL_TRANSACTION: UninstallTransaction = {
  cascadeUnstagePlugin,
  commitPluginRemoval,
  ...
};
```

**Lock-closure escape pattern** (lines 692-704 declare; 710-788 the closure) -- sentinels are declared BEFORE the closure and read after it; note the object form `routeEffect` versus the bare `let`s that need `eslint-disable no-unnecessary-condition` at lines 812 and 824:
```ts
  let alreadyGone = false;
  let configInvalid = false;
  let removedVersion: string | undefined;
  let cascadeFailure: Error | undefined;
  const routeEffect = { removeAfterSave: false };
```
Use the OBJECT form for the two new sentinels (`const refusal = { row: undefined as ... }`, `const prune = { rows: [] as ... }`) so no new eslint-disable is needed.

**Primary removal sequence inside the closure** (lines 737-788) -- the body to extract into a guard-free per-plugin removal function:
```ts
      removedVersion = installed.version;
      const localOutcome = await cascade(plugin, marketplace, locations, installed);
      if (!localOutcome.ok) {
        cascadeFailure = foldPartialCascadeFailure(plugin, installed, localOutcome);
        await tx.save();
        routeEffect.removeAfterSave = localOutcome.dropped.hooks.length > 0;
        return;
      }

      transaction.commitPluginRemoval(mp, { scope, marketplace, plugin });

      if (!orchestrated) {
        await transaction.sweepConfigLayers(locations, plugin, marketplace);
      }

      await tx.save();
      routeEffect.removeAfterSave = true;
```
Hard rules for the member variant (RESEARCH Pattern 4): NEVER `tx.save()` inside it (`E/transaction/with-state-guard.ts:93-95` throws on the second call); NEVER rethrow AG-5 -- `foldPartialCascadeFailure` (lines 364-378) does rethrow for the primary, so the member variant catches and yields a `warning` row instead.

**AG-5 fold to NOT copy for members** (lines 371-377):
```ts
  const cause = localOutcome.cause ?? new Error(`Cascade unstage failed for plugin "${plugin}".`);
  if (cause instanceof AgentsUnstageFailureError) {
    throw cause;
  }

  applyPartialCascadeFold(installed, localOutcome.dropped);
  return cause;
```

**Reason classifier to reuse** (lines 196-215) -- `narrowCascadeFailure(cause): ContentReason` maps `StateLockHeldError` -> `lock held`, AG-5 -> `source mismatch`, EACCES/EPERM -> `permission denied`, ENOENT -> `source missing`.

**Failure emit to model the refusal on** (lines 232-274) -- orchestrated arm returns the typed outcome; standalone arm builds a `PluginFailedMessage` and notifies one block with `"single"` cardinality:
```ts
  if (orchestrated) {
    return {
      status: "failed",
      reason: narrowCascadeFailure(cause),
      error: cause,
      cause: errorMessage(cause),
    };
  }

  const failedRow: PluginFailedMessage = {
    status: "failed",
    name: plugin,
    reasons: [narrowCascadeFailure(cause)],
    ...(removedVersion !== undefined && { version: removedVersion }),
    cause,
    severity: "error",
    needsReload: false,
  };
  notifyWithContext(ctx, pi, UNINSTALL_CONTEXT, [{ name: marketplace, scope, plugins: [failedRow] }], undefined, "single");
  return undefined;
```
The dependents refusal is the same shape with `reasons: ["dependents remain"]`, `cause: new Error(\`required by ${dependents.join(", ")}\`)`. The orchestrated `failed` outcome (lines 112-119) already carries `error: Error`, which is what `apply.ts` must thread into `cause`.

**Success row to extend** (lines 587-601) -- add a `pruned: boolean` input, keep reason order `["dependency pruned", "data kept"]`:
```ts
function buildUninstalledRow(
  plugin: string,
  removedVersion: string | undefined,
  keepData: boolean | undefined,
): PluginUninstalledMessage {
  return {
    status: "uninstalled",
    name: plugin,
    ...(removedVersion !== undefined && { version: removedVersion }),
    ...(keepData === true && { reasons: ["data kept"] as const }),
    severity: "info",
    needsReload: true,
  };
}
```

**Multi-block emit site to grow** (lines 886-901): today one block, one row. Prune fills `plugins: [uninstalledRow, ...prunedRowsUnderSameMp]` and appends one block per other marketplace that lost a member; cardinality stays `"single"`.

**Post-commit cleanup per removed plugin** (lines 838-846) -- call once per pruned plugin with the SAME `keepData` (D-05-09):
```ts
  await transaction.runPostCommitCleanup({
    completionCache,
    locations,
    scope,
    marketplace,
    plugin,
    keepData: opts.keepData ?? false,
  });
```
and `dropCachedHooks(hooksRouting, scope, marketplace, plugin)` (lines 398-412) for each member whose cascade dropped hooks.

**Guard-free body precedent** -- `E/orchestrators/plugin/install-outcome.ts:546-565`:
```ts
/**
 * Run install's phase ledger without acquiring a state lock.
 *
 * The caller owns locking and persistence. Failures preserve rollback details
 * through `capture`; success exposes only the immutable outcome projection.
 */
export async function runInstallLedger(
  state: ExtensionState,
  locations: ScopedLocations,
  options: InstallLedgerOptions,
  ...
```
The uninstall equivalent stays module-private (or rides `UninstallTransaction`), since only `uninstall.ts` calls it.

**Header comment to update:** lines 28-30 say uninstall "is implicitly clean by construction (no git surface)". Still true after wiring (the read module is fs-only), but consider adding `uninstall.ts` to `NETWORK_FREE_TARGETS` (`tests/architecture/gate-targets.ts:41`) now that it reads manifests.

---

### `E/orchestrators/plugin/uninstall.messaging.ts` (messaging, transform)

**Analog A (private reason pin):** `E/orchestrators/marketplace/remove.messaging.ts` lines 27-38:
```ts
// `_ReasonInSet<R extends Reason> = R` pins the private reason to the closed
// `Reason` set as it derives `RemovePrivateReason`: an out-of-set literal
// violates the `extends Reason` constraint -- a TS2344 compile error here, with
// no runtime footprint.
type _ReasonInSet<R extends Reason> = R;
// fallow-ignore-next-line private-type-leak -- `_ReasonInSet` is the compile-time membership guard; exporting that helper would widen the command's public reason vocabulary.
export type RemovePrivateReason = _ReasonInSet<"plugins remain">;
```
Copy as `export type UninstallPrivateReason = _ReasonInSet<"dependency pruned" | "dependents remain">;` (the `fallow-ignore-next-line private-type-leak` marker is required; count it in the repo's ignore census if a test pins that number).

**Analog B (reason-carrying success row composer):** `E/orchestrators/plugin/install.messaging.ts` lines 328-372:
```ts
export const PROMOTED_ROW_REASONS = [
  "already installed",
  "dependency promoted",
] as const satisfies readonly ContentReason[];
...
export function composePromotedRow(args: {
  readonly plugin: string;
  readonly version: string;
  readonly scope: Scope;
  readonly needsReload: boolean;
}): PluginInstalledMessage {
  return {
    status: "installed",
    name: args.plugin,
    version: args.version,
    scope: args.scope,
    dependencies: [],
    reasons: PROMOTED_ROW_REASONS,
    severity: "info",
    needsReload: args.needsReload,
  };
}
```
Copy as a `composePrunedRow({ plugin, version, keepData })` returning `PluginUninstalledMessage` with `reasons: keepData ? ["dependency pruned", "data kept"] : ["dependency pruned"]`, `severity: "info"`, `needsReload: true`. Whether this lives in `uninstall.messaging.ts` or stays as the extended `buildUninstalledRow` in `uninstall.ts` is the planner's call; either way the `as const satisfies readonly ContentReason[]` pin is the pattern.

**Analog C (refusal facts with cause line):** `E/orchestrators/plugin/install-cascade.messaging.ts` lines 241-249 (`dependency cycle` -- names ride the cause, never the token):
```ts
    case "cycle":
      return {
        key: failure.chain.at(-1) ?? rootKey,
        reasons: ["dependency cycle"],
        cause: new Error(`Dependency cycle: ${failure.chain.join(" -> ")}.`),
      };
```

**Render map is already total** (lines 38-41) -- `uninstalled` and `failed` are the only statuses prune/guard emit; do not add an arm.

---

### `E/edge/flag-catalog.ts` (config)

**Analog:** its own `KEEP_DATA_FLAG_ENTRY` (lines 69-84), catalog row (line 158), export (lines 184-190):
```ts
// DATA-01 / D-02-02: `--keep-data` opts out of uninstall's default data
// deletion; ...
// WR-01: the name is EXPORTED (as `KEEP_DATA_FLAG` below) because the uninstall
// handler must map the consumed flag onto its `keepData` option field, and a
// hand-written literal at that mapping site fails OPEN ...
const KEEP_DATA_FLAG_ENTRY: FlagEntry = {
  name: "--keep-data",
  description: "Preserve the plugin's persistent data directory",
  parse: true,
  complete: true,
};
...
  uninstall: [KEEP_DATA_FLAG_ENTRY, WRITE_TARGET_FLAG_ENTRY],
...
export const KEEP_DATA_FLAG = KEEP_DATA_FLAG_ENTRY.name;
```
Add `PRUNE_FLAG_ENTRY` beneath, insert into the `uninstall` row, export `PRUNE_FLAG`. Anchor the comment on `FLAG-01` / `D-05-10` / `WR-01`.

---

### `E/edge/handlers/plugin/uninstall.ts` (edge handler)

**Analog:** itself. USAGE (lines 22-23), import (line 13), mapping (lines 55-58):
```ts
const USAGE =
  "Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local]";
...
import { KEEP_DATA_FLAG, passThroughFlagNames } from "../../flag-catalog.ts";
...
      // DATA-01 / D-02-04: omission is the deletion default, so the property is
      // omitted rather than forwarded as false.
      ...(localFlag.consumedFlags.has(KEEP_DATA_FLAG) && { keepData: true }),
```
Add `[--prune]` to USAGE (and the header comment lines 4-5), import `PRUNE_FLAG`, spread `...(localFlag.consumedFlags.has(PRUNE_FLAG) && { prune: true })`.

### `E/edge/router.ts` (usage text)

Line 95:
```ts
  "  uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local]\n" +
```
Add `[--prune]`; `tests/architecture/flag-catalog-drift.test.ts` (documented-flag reconciliation) and `tests/edge/router.test.ts` pin this line.

---

### `E/orchestrators/reconcile/apply.ts`, `apply-outcomes.ts`, `notify.ts` (reconcile refusal row, D-05-16)

**Outcome push to extend** -- `apply.ts` lines 375-381 (drops `result.error` today):
```ts
      } else {
        outcomes.push({
          kind: "plugin-uninstall-failed",
          scope: op.scope,
          marketplace: op.marketplace,
          plugin: op.plugin,
          reason: result.reason,
        });
      }
```
Add `cause: result.error` (conditional spread). No `prune` option is ever passed here (D-05-08) -- lines 349-357 stay as they are.

**Outcome type to extend** -- `apply-outcomes.ts` lines 166-169, copying the `InvalidBlockOutcome.cause` doc (lines 316-326):
```ts
export interface PluginUninstallFailedOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-uninstall-failed";
  readonly reason: Reason;
}
...
  /**
   * I5 / PR #51: optional path-redacted diagnostic. When set, the projection
   * surfaces it as a synthetic plugin-row cause-chain trailer ...
   */
  readonly cause?: Error;
```
State in the comment that the dependents cause carries `name@marketplace` tokens only, so `redactAbsolutePaths` is not needed.

**Projection arm to extend** -- `notify.ts` lines 841-851 (shared by four failed kinds):
```ts
    case "plugin-install-failed":
    case "plugin-uninstall-failed":
    case "plugin-enable-failed":
    case "plugin-disable-failed":
      block.plugins.push({
        status: "failed",
        name: outcome.plugin,
        reasons: reasonAsContent(outcome.reason),
        severity: "error",
        needsReload: false,
      });
      return block;
```
Spread `...(outcome.kind === "plugin-uninstall-failed" && outcome.cause !== undefined && { cause: outcome.cause })` (or give all four the optional field). Precedent for a conditional cause child: lines 727-736.

---

### `E/shared/notification-types.ts` + `E/shared/notify-reasons.ts` (closed-set amendment)

**Tuple tail to append after** -- `notification-types.ts` lines 100-108:
```ts
  // D-04-07: the plugin the user just named was already recorded, as another
  // plugin's dependency, and this command promoted that record to a direct
  // install. ...
  "dependency promoted",
] as const;
```
Append `"dependency pruned"` then `"dependents remain"` with the same register of inline note.

**Partition arm to append after** -- `notify-reasons.ts` lines 283-288:
```ts
  // D-04-07: install's marker for a recorded dependency the user then named.
  // The record changed hands and nothing was materialized, so it joins
  // `already installed` on an `installed` row rather than a skipped one -- a
  // promotion mutates state, which is why it is not an idempotent reason.
  | "dependency promoted"
  | "plugins remain"
```
Both new members go in `CommandPrivateReason`, NOT `IDEMPOTENT_REASONS` (line 57). The `_ReasonsCoverageProof` at lines 305-309 goes red until both sides move.

**Header ledger sentence to extend** -- `notify-reasons.ts` lines 34-37 (and the `54-entry` counts at lines 9 and 15):
```ts
 * dependency off the benign-skip default (52 to 53). D-04-07 added
 * `dependency promoted`, install's marker for a recorded dependency the user
 * then asked for by name -- a state change, which the refusal `already
 * installed` cannot report on its own (53 to 54).
```

**Ten pin surfaces (from 04-06, all verified this session):**

| # | File:line | Today | After |
|---|-----------|-------|-------|
| 1 | `E/shared/notification-types.ts:107` | tail `"dependency promoted"` | +2 at tail |
| 2 | `E/shared/notify-reasons.ts:9,15,34-37` | `54-entry` | `56-entry` + ledger sentences |
| 3 | `E/shared/notify-reasons.ts:287` | `CommandPrivateReason` | +2 arms |
| 4 | emitting arms in `uninstall.ts` / `uninstall.messaging.ts` | -- | composers + `_ReasonInSet` pin |
| 5 | `docs/output-catalog.md` `## /claude:plugin uninstall` | 6 states | +4 (+1 reconcile-applied) with `<!-- catalog-state: ... -->` anchors |
| 6 | `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` | 6 fixtures | +4 |
| 7 | `tests/architecture/catalog-uat/catalog-contract.test.ts:51-52` | `EXPECTED_STATE_COUNT = 206`, `EXPECTED_UTF8_BYTES = 27_385` | bump both (byte lock AFTER mdformat) |
| 8 | `tests/architecture/catalog-uat/catalog-parser.test.ts:69,74` | `206` | bump |
| 9 | `tests/architecture/notify-closed-set-locks.test.ts:29,68` | `54` | `56` + ledger comment |
| 10 | `tests/shared/notification-types.test.ts:73`, `tests/architecture/compat-01-no-expansion.test.ts:221` | tuple ends `"dependency promoted"` | append both |

---

### `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` (fixture)

**Analog:** its own `success-keep-data` (lines 30-51) -- copy the comment-plus-fixture shape:
```ts
    // WR-06 / DATA-01: the preserving disposition, which is the only thing that
    // separates this row from the `success` row above.
    "success-keep-data": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "uninstalled",
                name: "helper",
                version: "1.0.0",
                reasons: ["data kept"],
                severity: "info",
                needsReload: true,
              },
            ],
          },
        ],
      },
    },
```
New keys: `success-prune` (primary row + `{dependency pruned}` row), `success-prune-keep-data`, `prune-partial-failure` (`expectedSeverity: "warning"`, one `failed` member row at `severity: "warning"`), `refused-dependents-remain` (`expectedSeverity: "error"`, `failed` row with `reasons: ["dependents remain"]` and `cause: new Error("required by deploy-kit@official")`). The `already-gone-cross-scope` fixture (lines 141-162) shows the `expectedSeverity` field.

---

### `tests/domain/dependency-orphans.test.ts` (NEW test)

**Analog A:** `tests/domain/dependency-closure.test.ts` lines 1-40 -- imports, `satisfies` compile pins, synthetic `Graph`:
```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDeclaredDependencies } from "../../extensions/pi-claude-marketplace/domain/dependencies.ts";
...
/** A synthetic catalog: key -> whatever that key declares. An absent key is absent. */
type Graph = Readonly<Record<string, readonly DeclaredDependency[]>>;
```
**Analog B:** `tests/orchestrators/plugin/install-declared-enabled.test.ts` lines 8-40 -- a `CASES` table with `title`/inputs/`expected` looped into `test(...)`. Cases to cover: single orphan, transitive D1->D2 fixpoint, diamond (shared dependency held by a remaining declarer), disabled declarer holds, explicit record never pruned, cyclic island residue (documented, not pruned), ordering = dependents before dependencies.

### `tests/orchestrators/plugin/dependency-index.test.ts` (NEW test)

**Analog A:** `tests/orchestrators/plugin/dependency-declaration-read.test.ts` lines 51-70 -- the injected reader fake (`buildReader({ files, presence })`) recording every path opened.
**Analog B:** `tests/orchestrators/plugin/install-disable-cascade.test.ts` lines 33-67 -- a hand-built `ExtensionState` literal with `provenance: "explicit"` records (copy and vary `provenance`, `enabled`, and marketplace count).
**Analog C:** `tests/orchestrators/plugin/dependency-closure.test.ts`-style `satisfies` pin on the result union.

### `tests/orchestrators/plugin/uninstall.test.ts` fixtures (MODIFY)

**Analog:** `tests/orchestrators/reconcile/apply.test.ts::writeMarketplaceSource` lines 370-397 -- the minimal valid `marketplace.json` a second record needs so the guard can read its declarations:
```ts
  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeUnder(
    manifestPath,
    JSON.stringify({
      name: marketplace,
      plugins: Object.entries(trees).map(([plugin, tree]) => ({
        name: plugin,
        version: "1.0.0",
        source: `./plugins/${plugin}`,
        ...
      })),
    }),
  );
```
For declaring fixtures add `dependencies: [...]` to the entry AND to `<root>/plugins/<name>/.claude-plugin/plugin.json` (D-03-25). The LIFE-04 comment at `uninstall.test.ts:306-310` ("Uninstall reads no manifest") must be reworded when the shared-clone fixture at `:2568` grows a manifest.

## Shared Patterns

### Locked-transaction, save-once discipline
**Source:** `E/orchestrators/plugin/uninstall.ts:710-788`; `E/transaction/with-state-guard.ts:93-95`
**Apply to:** the guard, the sweep, the member removal body
- Everything runs inside the single `transaction.withLockedStateTransaction(locations, async (tx) => { ... })`.
- Exactly one `await tx.save()` on the mutating path; abort arms return without saving.
- Never call the public `uninstallPlugin` from inside (proper-lockfile `retries: 0`, non-re-entrant).

### Closure-escape sentinels
**Source:** `E/orchestrators/plugin/uninstall.ts:692-704, 812, 824`
**Apply to:** the refusal and prune results
Use the object form (`const routeEffect = { removeAfterSave: false }`) so post-closure reads need no `eslint-disable no-unnecessary-condition`.

### Severity is computed, not asserted
**Source:** `E/shared/notification-summary.ts:137-162` (block = max over rows); `E/orchestrators/plugin/install-cascade.messaging.ts:225-230` (`skipSeverity(reasons)`)
**Apply to:** pruned rows (`info`), member-failure rows (`warning`), refusal row (`error`)
Stamp the row; let the reducer compute the block.

### Cause lines carry names, tokens stay closed-set
**Source:** `E/orchestrators/plugin/install-cascade.messaging.ts:241-249`; `E/shared/errors.ts:158-176` (`causeChainTrailer`, prefix `cause: `)
**Apply to:** `{dependents remain}` (`cause: required by Y@mp, Z@mp`) and the unreadable-declarer refusal (`cause: cannot read the dependencies of Y@mp: <detail>`)
Message string IS the rendered line; keys and field paths only, no absolute paths.

### Catalog-owned flag names (WR-01)
**Source:** `E/edge/flag-catalog.ts:69-84, 190`; `E/edge/handlers/plugin/uninstall.ts:13, 58`
**Apply to:** `PRUNE_FLAG`
Export the name from the catalog; the handler imports it; omission (not `false`) is the default (D-02-04 discipline).

### Comment anchors
**Source:** `.claude/rules/typescript-comments.md`; every excerpt above
**Apply to:** all new code and test titles
Anchor on `D-05-NN`, `PRUNE-NN`, `FLAG-01`, `NFR-3`, `NFR-5`; never `Phase 5` / `Pitfall N`.

## No Analog Found

None. Every new/modified file has a same-role, same-flow analog in the tree. The one structural gap is that no existing orchestrator builds a whole-scope declaration index (install builds it per-closure-member through `lookupCascadeDependencies`); the leaf is a re-expression of that private function over `tx.state`, not a new pattern.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,orchestrators/plugin,orchestrators/marketplace,orchestrators/reconcile,edge,shared,transaction,persistence}`, `tests/{domain,orchestrators/plugin,orchestrators/reconcile,architecture,architecture/catalog-uat}`
**Files scanned:** 27 (20 production, 7 test)
**Tracked-source check:** `git ls-files` confirmed for the named analogs; no `.gsd/capabilities` mirror paths exist in this repo
**Pattern extraction date:** 2026-09-16
