# Phase 6: Load-time dependency check and allowed uninstall - Pattern Map

**Mapped:** 2026-09-18
**Files analyzed:** 16 (2 new production + 1 new test + 13 modified)
**Analogs found:** 16 / 16 (all tracked source; no gitignored mirrors)

This phase adds **no new external dependency and no new architectural shape**.
Every new file has a near-exact in-repo analog. The dominant risk named by
RESEARCH.md is re-building a thing that already exists, so this map is
deliberately aggressive about naming the file to copy rather than the idea to
follow.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `orchestrators/reconcile/dependency-verdict.ts` | orchestrator leaf (async pre-step) | file-I/O → transform (offline read, discriminated result) | `orchestrators/plugin/dependency-index.ts` | exact |
| **NEW** `tests/orchestrators/reconcile/dependency-verdict.test.ts` | test | file-I/O with injected seams | `tests/orchestrators/plugin/dependency-index.test.ts` | exact |
| **NEW** sibling fn in `orchestrators/plugin/dependency-index.ts` (constraint-preserving walk) | orchestrator leaf | file-I/O → transform | `buildScopeDeclarationIndex` in the same file | exact (same file) |
| **NEW** `applyDependencyDisables` step in `orchestrators/reconcile/apply.ts` | orchestrator step (own lock + save) | CRUD (locked state write) | `orchestrators/reconcile/backfill.ts::applyBackfillForScope` | exact |
| `orchestrators/reconcile/types.ts` (new bucket + factory) | model / plan data | transform | `PlannedPluginDisable` + `emptyReconcilePlan` in the same file | exact |
| `orchestrators/reconcile/plan.ts` (gate + bucket + 4th param) | service (pure planner) | transform | `classifyDeclaredPlugin` / `buildUninstallBucket` in the same file | exact |
| `orchestrators/reconcile/apply-outcomes.ts` (new outcome arm) | model | transform | `PluginDisabledOutcome` (`:238-274`) | exact |
| `orchestrators/reconcile/notify.ts` (arm → row) | renderer | transform | `case "plugin-disabled"` (`:842-858`) | exact |
| `persistence/state-io.ts` (schema field + clone) | model / persistence | CRUD | `hookEntries` / `resolvedSha` in the same schema (`:93-118`) | exact |
| `shared/notification-types.ts` (`REASONS` members, `cause?`) | config (closed set) | transform | `"dependents remain"` / `"dependency pruned"` entries (`:111-127`) | exact |
| `shared/notify-reasons.ts` (group home + header count) | config (closed set) | transform | `:288-314` command-private union | exact |
| `shared/notification-grammar.ts` (widen `:1625` trailer gate) | renderer | transform | the `failed \| manual recovery` gate itself | role-match |
| `orchestrators/plugin/uninstall.ts` (refusal → report) | orchestrator | request-response | `assertNoDependents` (`:238-267`) + `buildUninstalledRow` (`:873-887`) | exact (edit in place) |
| `orchestrators/plugin/uninstall.messaging.ts` (token pin + row brace) | config | transform | `PRUNED_ROW_REASONS` (`:77-86`) / `install.messaging.ts:328-331` | exact |
| `docs/dependency-resolution.md`, `docs/plugin-enablement.md`, `docs/output-catalog.md` | docs | — | existing sections named in RESEARCH.md | exact |
| Gate/fixture edits (6 architecture tests + 2 catalog fixtures) | test | — | RESEARCH.md §Example 2 checklist rows 1-10 | exact |

---

## Pattern Assignments

### `orchestrators/reconcile/dependency-verdict.ts` (NEW — orchestrator leaf, file-I/O → transform)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` (200 lines, read in full)

Copy this file's **whole shape**: module header naming every decision ID, an
options interface with two optional injection seams, a discriminated
`{ ok: true } | { ok: false; declarer; cause }` result, a private failure
constructor, a private per-record read, and one exported `async` walk.

**Imports pattern** (lines 48-58) — note the import-x group order and
type-only imports last:

```ts
import { lookupDeclaredPlugin } from "../../domain/manifest-lookup.ts";
import { loadMarketplaceManifest } from "../../domain/manifest.ts";
import { errorMessage } from "../../shared/errors.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";

import { readDependencyDeclaration } from "./dependency-declaration-read.ts";

import type { DependencyDeclarationReader } from "./dependency-declaration-read.ts";
import type { DeclarationIndex, OrphanCandidate } from "../../domain/dependency-orphans.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
```

**Options + injection-seam pattern** (lines 79-90). Copy the "production omits
it" seam comments verbatim in spirit — `reader` and `loadManifest` are the
project's dependency-injection convention (CONVENTIONS.md: DI over test-only
seams). Drop `exclude` (Pitfall 4: it has no meaning for the load-time
question):

```ts
/** Inputs of one scope-wide index build. */
export interface ScopeDeclarationIndexOptions {
  /** The locked snapshot of the target scope's state document. */
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  /** The `name@marketplace` key under decision; it is never indexed. */
  readonly exclude: string;
  /** Filesystem seam of the declaration read; production omits it. */
  readonly reader?: DependencyDeclarationReader;
  /** Manifest-load seam; production omits it and reads the memoized cache. */
  readonly loadManifest?: typeof loadMarketplaceManifest;
}
```

**Discriminated result pattern** (lines 104-120) — this is the shape Pitfall 7
requires (never throw past `resources_discover`):

```ts
export type ScopeDeclarationIndexResult =
  | {
      readonly ok: true;
      readonly index: DeclarationIndex;
      readonly candidates: readonly IndexedRecord[];
    }
  | {
      readonly ok: false;
      readonly declarer: string;
      readonly cause: Error;
    };

type IndexFailure = Extract<ScopeDeclarationIndexResult, { readonly ok: false }>;

/** One record's declared key set, or the failure that ends the walk. */
type RecordDeclarations =
  { readonly ok: true; readonly declared: ReadonlySet<string> } | IndexFailure;
```

**Error-construction pattern** (lines 122-128) — this is the security control
for the new cause line (NFR-9 / T-55-02-02): a plain `Error`, message built
from a key plus a redacted detail, and **deliberately no `{ cause }`** so the
renderer's chain walk cannot print the raw message:

```ts
function unreadableDeclarer(key: string, detail: string): IndexFailure {
  return {
    ok: false,
    declarer: key,
    cause: new Error(`cannot read the dependencies of ${key}: ${detail}`),
  };
}
```

**Fail-closed read pattern** (lines 136-171) — copy the three-refusal ladder
(manifest load throw → `absent` from the marketplace → `unusable` own
manifest) and `refuseUnusableOwnManifest: true`. The one change is the return:
keep `readonly DeclaredDependency[]` instead of flattening to a key `Set`, so
the `version` constraint survives (Open Question 3):

```ts
  const read = await readDependencyDeclaration({
    marketplaceRoot: marketplace.marketplaceRoot,
    entry: declared.entry,
    locations: options.locations,
    ...(options.reader !== undefined && { reader: options.reader }),
    refuseUnusableOwnManifest: true,
  });
  if (read.kind === "unusable") {
    return unreadableDeclarer(key, read.detail);
  }

  return {
    ok: true,
    declared: new Set(
      read.dependencies.map((dep) => `${dep.name}@${dep.marketplace ?? marketplace.name}`),
    ),
  };
```

**Walk pattern** (lines 177-200) — nested `Object.values(state.marketplaces)` /
`Object.entries(marketplace.plugins)`, key built as `${name}@${marketplace.name}`,
first failure returned immediately:

```ts
export async function buildScopeDeclarationIndex(
  options: ScopeDeclarationIndexOptions,
): Promise<ScopeDeclarationIndexResult> {
  const index = new Map<string, ReadonlySet<string>>();
  const candidates: IndexedRecord[] = [];
  for (const marketplace of Object.values(options.state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      const key = `${name}@${marketplace.name}`;
      if (key === options.exclude) {
        continue;
      }

      const read = await readRecordDeclarations(options, marketplace, name);
      if (!read.ok) {
        return read;
      }

      index.set(key, read.declared);
      candidates.push({ key, provenance: record.provenance, marketplace, plugin: name, record });
    }
  }

  return { ok: true, index, candidates };
}
```

**Disabled-predicate rule (hard gate):** the verdict's "dependency is disabled"
arm must call `isRecordedButDisabled` from `persistence/state-io.ts`. Writing
`!record.enabled` in any form fails `tests/architecture/disabled-state-classification.test.ts`,
which walks every `.ts` under the extension. A module that legitimately
classifies on it must also join `DISABLED_STATE_TARGETS` **and** the parallel
`DECLARED_MODULE_ORDER` basename list in `tests/architecture/gate-targets.ts`.
`backfill.ts:18` is the worked example of a reconcile-layer module doing exactly
that import.

---

### `applyDependencyDisables` in `orchestrators/reconcile/apply.ts` (NEW step — orchestrator, CRUD under its own lock)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`
(NOT `applyPluginToggles` — see below)

`applyPluginToggles` is the *wrong* analog for the write: it never touches a
record, it delegates entirely to `setPluginEnabled`, and `enable-disable.ts` is
out of scope. `backfill.ts` is the right one — it is the existing apply-side
step that takes its **own** per-scope lock, writes state, and coerces its own
throws into a row.

**Own-lock pattern** (`backfill.ts:106-113`) — the comment states the CR-01
invariant that makes this legal (Pitfall 1):

```ts
  // D-68-03 (stamp-on-gate-open): close the gate even when nothing was
  // backfilled. SPLIT-02 / NFR-1: route through withStateGuard -> saveState,
  // never a bare atomicWriteJson. CR-01: this takes its own per-scope lock; the
  // surrounding apply region holds no outer lock.
  const loc = locationsFor(scope, opts.cwd);
  await withStateGuard(loc, (fresh) => {
    fresh.lastReconciledExtensionVersion = EXTENSION_VERSION;
  });
```

**Throw-isolation pattern** (`backfill.ts:127-160`) — reuse the exported helper
rather than re-writing the catch. This is the Pitfall 7 answer on the apply
side:

```ts
export async function applyBackfillForScopeIsolated(
  opts: ApplyReconcileOptions,
  scope: Scope,
  readResult: ScopeReadResult,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  await runScopeIsolated(scope, outcomes, () =>
    applyBackfillForScope(opts, scope, readResult, outcomes),
  );
}

export async function runScopeIsolated(
  scope: Scope,
  outcomes: PerEntryOutcome[],
  op: () => Promise<void>,
): Promise<void> {
  try {
    await op();
  } catch (err) {
    outcomes.push({
      kind: "invalid-block",
      scope,
      basename: "state.json",
      reason: classifyReadPassThrow(err),
      cause: new Error(redactAbsolutePaths(errorMessage(err))),
    });
  }
}
```

**Step-registration pattern** (`apply.ts:804-837`) — each step is its own
extracted `async function` called in a documented order; the header's "Order
rationale (data dependency)" list is part of the contract and must gain the new
step's entry. Do **not** branch inside `applyPluginToggles`:

```ts
async function applyPlan(
  opts: ApplyReconcileOptions,
  plan: ReconcilePlan,
  outcomes: PerEntryOutcome[],
): Promise<void> {
  await applyPluginUninstalls(opts, plan, outcomes);
  await applyMarketplaceRemoves(opts, plan, outcomes);
  await applyMarketplaceAdds(opts, plan, outcomes);
  await applyPluginInstalls(opts, plan, outcomes);
  await applyPluginToggles(opts, plan.pluginsToEnable, outcomes, { /* … */ });
  await applyPluginToggles(opts, plan.pluginsToDisable, outcomes, { /* … */ });
  applySourceMismatches(plan, outcomes);
}
```

**Where the verdict pre-step slots in** (`apply.ts:192-201`) — inside
`readPassForScope`'s already-`async`, already-fs-doing locked closure, between
the CFG-03 early return and the `planReconcile` call. Copy the numbered-step
comment register:

```ts
      if (invalidOutcomes.length > 0) {
        return { scope, plan: undefined, invalidOutcomes, stateExisted: stateExists };
      }

      // (4) Plan against the merged config + current state. Pure -- no I/O.
      const plan = planReconcile(outcome.merged, state, scope);
      return { scope, plan, invalidOutcomes: [], state, stateExisted: stateExists };
```

**Warning:** a helper called from inside `readPassForScope` may **not** take the
scope lock (the closure already holds it, `proper-lockfile` is `retries: 0` and
not re-entrant). The verdict builder does fs reads only — no lock, no save.

---

### `orchestrators/reconcile/types.ts` (modified — model)

**Analog:** `PlannedPluginDisable` and `emptyReconcilePlan` in the same file.

**Bucket-type pattern** (lines 121-130) — a doc comment citing the decision ID,
then a flat readonly interface:

```ts
/**
 * Planned disable of a plugin declared with `enabled === false` but still
 * recorded in state. The apply path removes the materialised artifacts
 * without removing the state record's version pin (D-04 / ENBL-02).
 */
export interface PlannedPluginDisable {
  readonly scope: Scope;
  readonly plugin: string;
  readonly marketplace: string;
}
```

`PlannedDependencyDisable` additionally carries the row data (`dependency` key,
`kind`, optional `range`) — model the `kind` discriminant on
`PlannedSourceMismatch`'s four-variant union (`:162-195`) if the row's fields
differ per kind, which they do (`range` exists only on `out-of-range`).

**Plan + factory pattern** (lines 209-240) — the interface and the factory are
adjacent and must change together; `tests/orchestrators/reconcile/types.test.ts`
pins the factory by `deepEqual`:

```ts
export interface ReconcilePlan {
  readonly scope: Scope;
  readonly marketplacesToAdd: readonly PlannedMarketplaceAdd[];
  /* … */
  readonly pluginsToDisable: readonly PlannedPluginDisable[];
  readonly sourceMismatches: readonly PlannedSourceMismatch[];
}

export function emptyReconcilePlan(scope: Scope): ReconcilePlan {
  return {
    scope,
    marketplacesToAdd: [],
    /* … */
    pluginsToDisable: [],
    sourceMismatches: [],
  };
}
```

**Silent-omission hazard:** the interface and factory are compile-checked, but
`plan.ts:624-632`'s hand-maintained `total* === 0` fast-path conjunction is
**not**. Omitting the new term there silently returns `emptyReconcilePlan` with
a non-empty bucket. Add all four sites in one edit (interface, factory,
conjunction, return literal). The doc comment's "seven action buckets" prose
also becomes eight.

---

### `orchestrators/reconcile/apply-outcomes.ts` (modified — model)

**Analog:** `PluginDisabledOutcome` (lines 238-274)

Copy the extends-base + optional-field-with-rationale shape. Every optional
field carries a comment explaining what its presence/absence distinguishes:

```ts
/**
 * Plugin disable success outcome. Two producers share it: the toggle path (a
 * user-declared `enabled: false` over a materialized record) and the
 * install-disabled cascade (DFEN-04 -- the install ran whole and then unstaged
 * because the plugin's own `defaultEnabled` said so). The three optional fields
 * below are what tell the two apart on the rendered row; the toggle path omits
 * all three and stays byte-frozen.
 */
export interface PluginDisabledOutcome extends PluginOutcomeBase {
  readonly kind: "plugin-disabled";
  readonly version?: string;
  readonly reasons?: readonly ContentReason[];
  readonly enableHint?: true;
  readonly postCommitWarnings?: readonly string[];
}
```

---

### `orchestrators/reconcile/notify.ts` (modified — renderer)

**Analog:** `case "plugin-disabled"` (lines 842-858), verbatim:

```ts
    case "plugin-disabled":
      block.plugins.push({
        status: "disabled",
        name: outcome.plugin,
        ...(outcome.version !== undefined && { version: outcome.version }),
        // DFEN-04 / OUT-01 / OUT-04: forwarded when the producer supplied them,
        // which is the install-disabled cascade and nothing else. The toggle
        // path omits both and renders the byte-frozen bare row. Conditional
        // spreads because `exactOptionalPropertyTypes` rejects an explicit
        // `undefined`.
        ...(outcome.reasons !== undefined && { reasons: outcome.reasons }),
        ...(outcome.enableHint === true && { enableHint: true }),
        // D-03/D-06: a realized disable transition -> info, reloads.
        severity: "info",
        needsReload: true,
      });
      return block;
```

The new arm is this arm with `severity: "warning"` and a `cause` spread. Note
the **conditional-spread idiom** (`...(x !== undefined && { x })`) — required
everywhere by `exactOptionalPropertyTypes`, and used in every excerpt in this
document. "notify.ts is a dumb renderer": the severity and token are stamped by
the producing orchestrator, not probed here.

---

### `persistence/state-io.ts` (modified — model / persistence)

**Analog:** the `resolvedSha` / `hookEntries` optional fields in
`PLUGIN_INSTALL_RECORD_SCHEMA` (`:93-118`) and the enumerating
`clonePluginRecord` (`:144-193`).

Two edits, one file. The schema field follows the additive-optional precedent
(no `schemaVersion` bump, no migrate fill). The clone **enumerates** fields, and
its own header comment names the hazard: "a key added to
`PLUGIN_INSTALL_RECORD_SCHEMA` and not added here is dropped from every snapshot
with no compile error." Copy the conditional-spread form the `hookEntries` clone
line already uses.

**Twin hazard — `toDisabledRecord` spreads** (`:229-238`):

```ts
export function toDisabledRecord<R extends PluginInstallRecord["resources"]>(
  record: PluginInstallRecord & { resources: R },
  updatedAt: string,
): DisabledPluginRecord<R> {
  return {
    ...record,
    enabled: false,
    updatedAt,
  };
}
```

A spread preserves an existing marker (correct for a user `disable` over an
already-marked record) but cannot **set** one. The new apply step wraps it:
`{ ...toDisabledRecord(record, nowIso), dependencyDisabled: true }`.

**Clear-on-lift is deliberate omission, not code.** `install-outcome.ts:940-1000`
and `reinstall-record.ts:128-151` rebuild the record as a fresh literal naming
every field they preserve — a field they never name is dropped automatically.
Do not add `dependencyDisabled` to either literal, and comment in both why the
omission is load-bearing.

---

### Closed-set amendment: `shared/notification-types.ts` + `shared/notify-reasons.ts`

**Analog:** the `"dependents remain"` and `"dependency pruned"` entries this
phase edits — the tokens Phase 5 added, with both of their homes still adjacent.

**Tuple-member pattern** (`notification-types.ts:111-127`) — a rationale comment
citing decision IDs, stating what the token means, why a neighbouring token
cannot carry it, and what rides the cause line instead:

```ts
  // D-05-14 / D-05-15 / PRUNE-05: the plugin the user named is still declared
  // as a dependency by another installed plugin in the scope, so the uninstall
  // was refused and nothing was removed. `plugins remain` cannot carry it: that
  // token's documented subject is a marketplace that still records plugins,
  // and this row's subject is a plugin that other plugins still need. The
  // dependents ride the row's cause line (`required by <key>, <key>`) rather
  // than the token, on the `dependency cycle` precedent -- a token names one
  // fact about one plugin, and the list of who needs it is a fact about
  // several.
  "dependents remain",
] as const;
```

**Group-home pattern** (`notify-reasons.ts:288-314`) — the same token, in the
command-private union, with its own comment. A literal with no group home is a
compile error via `_ReasonsCoverageProof`:

```ts
  | "plugins remain"
  // D-05-14 / D-05-15: uninstall's refusal marker, owned by
  // `orchestrators/plugin/uninstall.messaging.ts`. The named plugin is still
  // declared by another installed plugin in the scope, so nothing was removed;
  // the dependents are named on the cause line. It sits beside `plugins
  // remain` because the two are the same shape of refusal about different
  // subjects -- and it is NOT idempotent: the operation was refused, not
  // already done.
  | "dependents remain"
```

The **full 10-row amendment checklist** (tuple, group home, header-count prose,
length pin, two enumeration pins, catalog grammar paragraph, catalog row + byte
lock, catalog-UAT fixture, catalog parser counts) is already written out in
RESEARCH.md §Code Examples Example 2 — follow it row by row; it was derived by
grepping these two exact tokens.

**Never derive the expected list from the constant under test.**
`compat-01-no-expansion.test.ts:60-72` forbids it in prose: "A derived list makes
the assertion a tautology that can never fail, which is worse than no gate."

---

### `orchestrators/plugin/uninstall.messaging.ts` (modified — config)

**Analog:** its own `PRUNED_ROW_REASONS` / `PRUNED_ROW_REASONS_DATA_KEPT`
(`:77-86`) and `install.messaging.ts:328-331`.

**Compile-time membership pin** (`uninstall.messaging.ts:33-39`):

```ts
type _ReasonInSet<R extends Reason> = R;
// fallow-ignore-next-line private-type-leak -- `_ReasonInSet` is the compile-time membership guard; exporting that helper would widen the command's public reason vocabulary.
export type UninstallPrivateReason = _ReasonInSet<"dependency pruned" | "dependents remain">;
```

**Row-brace constant pattern** (`install.messaging.ts:328-331`) — the ordering
contract lives in the comment:

```ts
/**
 * D-04-07: the promotion brace, in reason order. The standalone row
 * (`composePromotedRow`) and import's promoted row both carry it from here, so
 * a promotion reads as one thing whichever command performed it.
 */
export const PROMOTED_ROW_REASONS = [
  "already installed",
  "dependency promoted",
] as const satisfies readonly ContentReason[];
```

LOAD-03's row composes two axes (`data kept` + the new dependents token), so it
needs the two-variant form `PRUNED_ROW_REASONS` / `PRUNED_ROW_REASONS_DATA_KEPT`
already uses — `buildUninstalledRow` (`uninstall.ts:873-887`) currently
**replaces** the reason list rather than appending, and that is the line that
changes.

---

### `tests/orchestrators/reconcile/dependency-verdict.test.ts` (NEW — test)

**Analog:** `tests/orchestrators/plugin/dependency-index.test.ts` (read `:1-120`)

Copy the fixture-builder stack wholesale — it is the established way to exercise
this read path with zero real disk.

**Import + explicit-`.ts` pattern** (lines 1-15):

```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { buildScopeDeclarationIndex } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { MarketplaceManifest } from "../../../extensions/pi-claude-marketplace/domain/manifest.ts";
import type { DependencyDeclarationReader } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
```

**Never-created scope root** (lines 17-24) — the key trick that keeps the suite
hermetic without `mkdtemp`:

```ts
/**
 * A scope root that is never created on disk. `assertPathInside` returns
 * without complaint for a path whose components do not exist, so a path-source
 * record still derives a plugin root and every own-manifest answer comes from
 * the injected reader.
 */
const SCOPE_ROOT = path.join(tmpdir(), "dependency-index-scope");
const LOCATIONS = locationsFor("project", SCOPE_ROOT);
```

**Seed-builder ladder** (lines 26-89) — `pluginRecord(seed)` → `marketplaceRecord(name, plugins)`
→ `stateOf(...marketplaces)`, plus `manifestOf(name, entries)`. Copy these four
functions almost verbatim; this phase's only change is that the `EntrySeed`
`dependencies` need `version` constraints on them:

```ts
function pluginRecord(seed: RecordSeed = {}): PluginRecord {
  return {
    version: "1.0.0",
    resolvedSource: path.join(SCOPE_ROOT, "plugins", "x"),
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: seed.enabled ?? true,
    provenance: seed.provenance ?? "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
```

**Seam-double pattern** (lines 91-120) — plain local factories returning the
production interface, never a module-global patch (CONVENTIONS.md: DI over
test-only seams):

```ts
/** The manifest seam: one manifest per recorded `manifestPath`, or a throw. */
function manifestLoader(
  answers: Readonly<Record<string, MarketplaceManifest | Error>>,
): (manifestPath: string) => Promise<MarketplaceManifest> {
  return (manifestPath) => {
    const answer = answers[manifestPath];
    if (answer === undefined) {
      return Promise.reject(new Error(`unexpected manifest load of ${manifestPath}`));
    }

    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
}

function ownManifests(files: Readonly<Record<string, string>> = {}): DependencyDeclarationReader {
  return {
    isRegularFile: (filePath) => Promise.resolve(Object.hasOwn(files, filePath)),
    readTextFile: (filePath) => Promise.resolve(files[filePath] ?? ""),
    makePresenceProbe: () => () =>
      Promise.reject(new Error("a path-source record never probes a clone")),
  };
}
```

`pluginRecord` is also the analog for the `dependencyDisabled` schema test in
`tests/persistence/state-io.test.ts` — a legacy record is exactly this literal
with the field absent.

---

## Shared Patterns

### Module header naming decisions, not history

**Source:** `orchestrators/plugin/dependency-index.ts:1-46`, `orchestrators/reconcile/backfill.ts:1-12`
**Apply to:** both new production modules

Every module in this tree opens with a `//` block that names the requirement /
decision IDs it implements, the invariant that makes its placement legal, and
the counter-rationale for the obvious alternative. Cite durable IDs
(`LOAD-01`, `D-06-04`, `NFR-5`) — **never** `Phase N` / `Plan N` / `Wave N`,
which the comment policy and a vocabulary gate both forbid.

`backfill.ts:8-12` is the template for "why this is its own file":

```ts
// It lived inside apply.ts and its two entry points were reached through
// `__test_` re-exports, while its tests already had a file of their own
// (tests/orchestrators/reconcile/backfill.test.ts). A concern with its own
// test file and its own name is a module; extracting it is what turns those
// seams into an interface (FLOW-09).
```

### Conditional spread for every optional field

**Source:** `notify.ts:842-858`, `dependency-index.ts:158`, `apply.ts:710`
**Apply to:** every new object literal in this phase

```ts
...(outcome.version !== undefined && { version: outcome.version }),
...(options.reader !== undefined && { reader: options.reader }),
```

`exactOptionalPropertyTypes` rejects an explicit `undefined`, so this idiom is
mandatory, not stylistic.

### Path redaction on every user-visible error message

**Source:** `dependency-index.ts:122-128, 146`; `apply.ts:173-179`; `backfill.ts:152-158`
**Apply to:** the new verdict failure arm and the new cause line

```ts
cause: new Error(redactAbsolutePaths(errorMessage(err))),
```

Build the message from an already-redacted string and chain **no** `{ cause }` —
the renderer's chain walk does not redact on its own (NFR-9 / T-55-02-02).

### Extract a predicate, do not grow a branch

**Source:** `plan.ts::classifyDeclaredPlugin` (`:414-504`) and `buildUninstallBucket` (`:515`);
`apply.ts::degradationFromEnable` (`:647-657`)
**Apply to:** the `plan.ts:498` three-term gate and the new apply step

Both complexity ceilings (ESLint `sonarjs/cognitive-complexity: 15` and fallow
`health.maxCognitive: 15`) are computed by different algorithms and must be
satisfied independently. `classifyDeclaredPlugin` exists *because* of this. The
new gate term belongs in a named helper (`isHeldByUnsatisfiedDependency`), not
inline. The third term must be the **live verdict**, not
`record.dependencyDisabled` alone — the marker says nothing about whether the
dependency has since been satisfied, which is the LOAD-02 lift half.

### Orchestrator stamps, renderer renders

**Source:** `apply.ts:813-835` (`buildSuccess` / `buildFailed` axes) vs `notify.ts:842-858`
**Apply to:** the new outcome arm and its row

The producing orchestrator decides the token, reasons and severity; `notify.ts`
maps an outcome arm to a row and probes nothing. A severity computed inside
`notify.ts` is the anti-pattern.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `shared/notification-grammar.ts` — widening the `:1625` trailer gate to admit `status === "disabled"` | renderer | transform | There is no precedent for a `cause:` trailer on a non-`failed` row. The gate itself (`:1625-1636`) is the only reference, and the change is a one-condition widening rather than a copied pattern. RESEARCH.md Open Question 1 recommends it (Option A); assumption A3 flags that `notify-grammar-invariant.test.ts`, `notify-producer-wire-coverage.test.ts` and `notify-stamp-coverage.test.ts` were **not read** and may enumerate per-variant fields. The planner should read those three before committing to this shape. |
| The fixpoint sweep loop (D-06-05) | service | transform | Phase 5's orphan sweep (D-05-02) is named as the shape to copy, but its source location was not pinned in RESEARCH.md. Find it in `orchestrators/plugin/uninstall.ts`'s prune path before writing a fresh `while` loop; the termination condition must be "no record **changed** this pass", not "no record is unsatisfied" (Pitfall 3). |

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/{reconcile,plugin}/`,
`extensions/pi-claude-marketplace/{persistence,shared,domain}/`,
`tests/orchestrators/{reconcile,plugin}/`
**Files read this session:** 8 (`dependency-index.ts`, `reconcile/types.ts`,
`reconcile/apply.ts` two ranges, `reconcile/backfill.ts`,
`reconcile/apply-outcomes.ts`, `shared/notify-reasons.ts`,
`shared/notification-types.ts`, `tests/orchestrators/plugin/dependency-index.test.ts`)
plus the full CONTEXT.md and RESEARCH.md
**Tracked-source check:** `git ls-files` confirmed for all six primary analog
paths; no gitignored mirror paths appear in this document
**Pattern extraction date:** 2026-09-18
