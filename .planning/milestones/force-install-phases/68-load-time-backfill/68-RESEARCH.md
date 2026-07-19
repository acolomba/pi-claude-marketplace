# Phase 68: Load-Time Backfill - Research

**Researched:** 2026-06-27
**Domain:** Persisted version-gate + load-time re-materialization of force-installed plugins (TypeScript ESM Pi extension; typebox state schema; reinstall repair primitive; reconcile cascade)
**Confidence:** HIGH (all claims verified against the live tree on `features/force-install`)

## Summary

This is an internal-architecture phase: no new external packages, no network, no new
runtime dependency. Everything needed already exists in the codebase — the typebox
`STATE_SCHEMA`, the `withLockedStateTransaction` / `saveState` write seam, the Phase 67
reinstall primitive, the `requireForceInstallable` gate (Phase 64), and the
`applyReconcile` single-cascade machinery (Phase 55 / RECON-04). Phase 68 wires them
together: read the running extension version, compare it to a new optional
`lastReconciledExtensionVersion` stamp in `state.json`, and — only when it changed —
re-materialize each force-installed plugin's now-supported components via the reinstall
primitive, folding promotion rows into the one existing reconcile cascade, then stamp the
running version.

The single load-bearing finding is a **gap in the reinstall primitive**: as built in
Phase 67 it resolves through `requireInstallable` (resolver.ts) and **hardcodes
`compatibility.installable: true` with an empty `unsupported` set** (reinstall.ts:1435).
It therefore *throws* `PluginShapeError {not-installable}` on a still-`unsupported`
plugin and cannot record a partial (still-degraded) re-materialization. D-68-02 requires
re-materializing "the now-fuller supported set… the persisted `compatibility` record
updates to the new (possibly empty) unsupported set." So the reinstall primitive must be
widened to the force-capable shape (`requireForceInstallable` → `MaterializablePlugin`,
record `installable: resolved.state === "installable"` + the real `supported`/`unsupported`
arrays) before backfill can reuse it for the partial-promotion case. The bridges already
accept `MaterializablePlugin` (Phase 65), so this is a localized change in `reinstall.ts`.

The second subtle finding: `loadState` **reconstructs** the state object as
`{ schemaVersion: 2, marketplaces }` (state-io.ts:290) and would silently **drop** any new
top-level field on every load. The new stamp must be threaded through this normalization
or the gate never closes (backfill would re-run every load, violating D-68-03).

**Primary recommendation:** Read the running version from a checked-in
`EXTENSION_VERSION` constant (drift-guarded by a test that reads `package.json`), NOT a
runtime JSON import (experimental at the NFR-4 Node floor). Add `lastReconciledExtensionVersion?`
as an optional top-level field on `STATE_SCHEMA` (no `schemaVersion` bump), thread it through
`loadState`'s normalization and `DEFAULT_STATE`. Widen the reinstall primitive to
`requireForceInstallable`/`MaterializablePlugin`. Run backfill as a **sibling step inside
`applyReconcile`'s per-scope apply region** (no outer lock — each reinstall takes its own
lock per CR-01), folding promotion rows into the existing `outcomes[]` accumulator, then
stamp via one `saveState`-backed locked write when the gate opened.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-68-01 (version-stamp migration, BFILL-02):** Add `lastReconciledExtensionVersion?`
  as an OPTIONAL top-level field on `STATE_SCHEMA`; keep `schemaVersion` at 2 (no bump).
  Additive and backward-compatible — an old doc without the field validates fine, the
  next save writes it. ABSENT stamp = scan-once (treated as version-changed). Existing
  state.json loads unchanged.
- **D-68-02 (backfill materialize scope, BFILL-01):** Re-materialize via the Phase 67
  unconditional reinstall (always-overwrite) primitive — "reinstall semantics" per
  BFILL-01. Re-resolve the plugin and materialize the now-fuller supported set in place;
  the persisted `compatibility` record updates to the new (possibly empty) unsupported
  set. If the unsupported set becomes empty, the plugin promotes to `(installed)`. SAME
  recorded version (no upgrade), NO network (cache only, NFR-5). Reuse the reinstall
  primitive rather than a bespoke partial-materialize path.
- **D-68-03 (scan gate granularity, BFILL-02):** The scan fires only when
  `lastReconciledExtensionVersion` differs from the running extension version, then stamps
  the running version. It scans ONLY force-installed plugins. Absent stamp = scan-once. An
  unchanged version skips the scan entirely.
- **D-68-04 (backfill notification, BFILL-01):** Backfill runs within the load-time
  reconcile; a promotion (force-installed → installed, or a partial re-materialize)
  surfaces as a row in the existing SINGLE `applyReconcile` cascade notification (RECON-04
  single-notify-per-invocation preserved). Severity nuance deferred to Phase 69; this
  phase emits the row at a sensible default.

### Claude's Discretion

- Whether backfill is a sub-step inside `applyReconcile` or a sibling step at
  `session_start` whose rows fold into the same cascade — left to planning, provided the
  single-notify rule holds and behavior matches D-68-01..04.
- The exact promotion-row token/wording (reconciled against the catalog in Phase 70).

### Deferred Ideas (OUT OF SCOPE)

- Force-path severity ladder SEV-01..05, including backfill/promotion row severities — Phase 69.
- Final PRD §11 reconcile + byte-exact promotion-row token — Phase 70.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BFILL-01 | Load-time reconciliation re-materializes (reinstall semantics) a force-installed plugin's previously-skipped components once the extension supports them, promoting it toward `(installed)` in place — no upgrade, no manual command. | Reinstall primitive (reinstall.ts) — but it must be widened to `requireForceInstallable`/`MaterializablePlugin` first (see Pitfall 1). Fold into `applyReconcile` outcomes (apply.ts:792). |
| BFILL-02 | Backfill scan gated on `lastReconciledExtensionVersion` in `state.json`; fires only when the extension version changed; unchanged version skips. | `STATE_SCHEMA` optional field (state-io.ts:153), version constant (new), gate in `applyReconcile` scope loop (apply.ts:786). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read running extension version | Build/static constant (`EXTENSION_VERSION`) | — | The supported-kind boundary is a compile-time property of THIS extension; the version is a static fact of the shipped artifact, not runtime/host state. |
| Persist version stamp | Persistence (`state-io.ts` / `saveState`) | Transaction (`with-state-guard.ts`) | SPLIT-02 architecture test pins `saveState` + `persistMigratedState` as the sole state.json writers; the stamp is internal machine state, same tier as `compatibility`. |
| Gate decision (version differs?) | Orchestrator (`reconcile/apply.ts`) | — | The gate is a load-time reconcile concern; lives where the scope fan-out + cascade already live. |
| Re-materialize components | Orchestrator (`plugin/reinstall.ts`) + Bridges | Domain (`resolver.ts`) | Reinstall is the single sanctioned always-overwrite materialize path (D-68-02); resolution is cache-only via `resolveStrict` (NFR-5). |
| Surface promotion rows | Notification (`reconcile/notify.ts` projection) | — | RECON-04: one cascade per invocation; rows fold into the existing `PerEntryOutcome[]` stream. |

## Standard Stack

No new packages. Phase 68 uses only what is already installed and in-tree.

| Capability | In-tree seam | File:line | Notes |
|------------|-------------|-----------|-------|
| Atomic state.json write | `atomicWriteJson` → `write-file-atomic@^8.0.0` | shared/atomic-json.ts:24 | Already the NFR-1 write path; fsync-by-default + concurrent-write queue. `[VERIFIED: package.json:11]` |
| State schema / validate | `typebox@^1.1.38` (`Type`, `Compile`) | persistence/state-io.ts:29-30,153 | Optional field via `Type.Optional(Type.String())`. `[VERIFIED: package.json:28]` |
| Per-scope lock + load/save | `withLockedStateTransaction` / `withStateGuard` | transaction/with-state-guard.ts:66,83 | `tx.state` is the loaded object; `tx.save()` calls `saveState`. |
| Force-capable narrowing gate | `requireForceInstallable` → `MaterializablePlugin` | domain/resolver.ts (gate), :136 (type) | Accepts `installable | unsupported`; the type backfill needs. |
| Cache-only resolution (NFR-5) | `resolveStrict` | domain/resolver.ts | Already used by reinstall (reinstall.ts:1266) and the Phase 66 list deriver — no network. |
| Re-materialize primitive | `reinstallPlugin({ render: "none" })` | orchestrators/plugin/reinstall.ts:236 | Returns a `ReinstallPluginOutcome` without notifying; the orchestrated path to fold into the cascade. **Must be widened — see Pitfall 1.** |
| Single reconcile cascade | `applyReconcile` + `buildReconcileAppliedCascade` | orchestrators/reconcile/apply.ts:786,864 | One `notify()` per invocation (RECON-04). |

**Installation:** none — `npm install` adds nothing for this phase.

## Package Legitimacy Audit

Not applicable — Phase 68 installs no external packages. All dependencies
(`write-file-atomic@^8.0.0`, `typebox@^1.1.38`, `proper-lockfile@^4.1.2`) are already
present in `package.json` and in active use on the `features/force-install` branch.

## Research Question 1 — Reading the running extension version

**Where the version lives:** root `package.json` `"version": "0.6.2"` (package.json:87).
There is no per-extension `package.json` (the extension is `extensions/pi-claude-marketplace/`
under the repo root). The Pi host API exposes **no** extension-version accessor — `platform/pi-api.ts`
re-exports only `getAgentDir` from `@earendil-works/pi-coding-agent`; there is no version
field. So "ask the host" (option 3) is **not available**. `[VERIFIED: grep platform/pi-api.ts]`

**Options evaluated (all empirically probed under Node 26 with native TS strip):**

| Option | Works at NFR-4 floor (Node 20.19)? | Runtime cost | Drift risk | Verdict |
|--------|-----------------------------------|--------------|-----------|---------|
| Checked-in `EXTENSION_VERSION` constant + drift-guard test | Yes — plain `const`, zero features | none | One sync point, **CI-enforced** | **RECOMMENDED** |
| Runtime JSON import `import pkg from "../../package.json" with { type: "json" }` | **Experimental at 20.19** — stable only from Node 22.0.0; emits ExperimentalWarning below 22 | module load | zero | Not recommended (warning noise at floor) |
| `fs.readFile(package.json)` via `import.meta.url` | Yes | async I/O at load + fallback path | zero | Acceptable alternative; more code + a failure mode on the hot load path |

`resolveJsonModule: true` is already set (tsconfig.json:15), so the JSON-import option
*type-checks*, and both JSON-import and fs-read *ran cleanly under Node 26* in this session.
The disqualifier is the **NFR-4 floor**: JSON module imports via import attributes are
stable only from **Node 22.0.0**; on Node 20.x they are experimental and emit an
`ExperimentalWarning` to stderr — unacceptable noise for a clean extension load.
`[VERIFIED: nodejs.org commit 88d91e8 "mark import attributes and JSON module as stable" lands in v22.0.0; CITED below]`

**Recommendation — new leaf module + drift-guard test:**

Create `extensions/pi-claude-marketplace/shared/extension-version.ts`:

```typescript
// shared/extension-version.ts
//
// BFILL-02: the running extension version — the ONLY input that can move the
// supported-kind boundary, so it gates the load-time backfill scan. Kept as a
// checked-in constant (not a runtime package.json import) so the read is
// zero-I/O, needs no experimental Node feature at the NFR-4 floor (20.19), and
// stays trivially offline (NFR-5). A drift-guard test pins it === package.json.
export const EXTENSION_VERSION = "0.6.2";
```

Drift-guard test (`tests/architecture/extension-version-sync.test.ts`), mirroring the
existing offline architecture-test pattern (`tests/architecture/config-state-write-seams.test.ts`
already reads files via `fileURLToPath(import.meta.url)`):

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

This adds a third version-sync point (alongside `package.json` and
`sonar-project.properties`, which CLAUDE.md's release ritual already bumps together), but
the drift test turns "forgot to bump it" into a hard CI failure rather than a silent
mis-gate. `[CITED: CLAUDE.md "offer to bump the version in package.json and sonar-project.properties"]`

**Documented alternative (no extra sync point):** read `package.json` at load time via
`readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../package.json"))`.
The published-tarball layout preserves the `../../package.json` relationship
(`node_modules/pi-claude-marketplace/package.json` vs
`node_modules/pi-claude-marketplace/extensions/pi-claude-marketplace/...`), and `files`
in package.json plus npm's always-include-package.json rule guarantee its presence. Costs:
async I/O on the hot load path and a "package.json missing/unreadable" fallback branch
(which would default to scan-once). Recommend the constant unless the team prefers
strict single-source-of-truth over zero runtime I/O.

## Research Question 2 — Load-time reconcile entry & cascade fold

**Where the load-time scan hooks in.** CONTEXT.md says "session_start → applyReconcile",
but the precise wiring is the **`resources_discover` event**, not `session_start`. In
`index.ts:56`, the extension registers `onResourcesDiscover("resources_discover", ...)`
and calls `await applyReconcile({ ctx, pi, cwd: event.cwd })` at index.ts:77, *before*
`aggregateDiscoveredResources` so newly-materialized artefacts are picked up on the SAME
load. `apply.ts:34` documents why: Pi fires `resources_discover` AFTER `session_start` and
after all extension factories return, so soft-dep status is stable at apply time. Backfill
inherits this entry — no new event registration needed.

**`applyReconcile` structure (apply.ts:786-881) and where rows accumulate:**

```
applyReconcile(opts)
  scopes = opts.scope ? [opts.scope] : ["project", "user"]
  outcomes: PerEntryOutcome[] = []                      // apply.ts:792 — the cascade accumulator
  for scope of scopes:
    readResult = readPassForScope(scope, cwd)           // LOCKED, WRITE-FREE (WR-05); migrate→load→plan
    if readResult.invalidOutcomes: push + continue
    if readResult.plan: applyPlan(opts, plan, outcomes) // NO outer lock — each orchestrator self-locks (CR-01)
    rebuildScopeRoutingTableIsolated(scope, cwd, outcomes)
  if outcomes.length === 0: return                      // NFR-2/A4/RECON-05 — silent no-op
  message = buildReconcileAppliedCascade(outcomes)      // apply.ts:864
  notifyReconcileAppliedWithContext(...)                // apply.ts:865 — the SINGLE notify (RECON-04)
```

`applyPlan` (apply.ts:754-774) drives the six orchestrators in fixed order
(uninstall → remove → add → install → enable → disable → source-mismatch), each pushing
into the shared `outcomes[]`. The single cascade is built once at apply.ts:864 from that
array.

**Recommended insertion point (resolves the Claude's-Discretion latitude).** Add backfill
as a **new step in the per-scope apply region**, i.e. a `applyBackfill(opts, scope, outcomes)`
call inside the `for scope` loop **after** `applyPlan` and before/with the routing rebuild.
Rationale:

- The apply region runs with **no outer lock** — required, because `reinstallPlugin` takes
  its own per-scope `withLockedStateTransaction` and `proper-lockfile` is **not re-entrant**
  (CR-01, apply.ts:733-735). Backfill *must not* run inside the read pass (which holds the
  lock) or it would deadlock/ELOCKED.
- Pushing promotion rows into the same `outcomes[]` array makes them fold into the one
  cascade automatically (D-68-04 / RECON-04) — no second `notify()`.
- The version gate is per-scope (each scope has its own `state.json` and thus its own
  stamp), which the scope loop already provides.

Concretely:

```typescript
// inside the for-scope loop in applyReconcile, after applyPlan(...):
if (readResult.plan !== undefined) {
  await applyPlan(opts, readResult.plan, outcomes);
}
// BFILL-01/02: gated, no-outer-lock, folds rows into `outcomes`, then stamps.
await applyBackfillForScope(opts, scope, readResult /* carries the stamp */, outcomes);
await rebuildScopeRoutingTableIsolated(scope, opts.cwd, outcomes);
```

**Folding the promotion row into the cascade.** Each re-materialization calls
`reinstallPlugin({ ..., render: "none" })` (reinstall.ts:236), which returns a
`ReinstallPluginOutcome` *without notifying* (the orchestrated path), and translate it into
a `PerEntryOutcome` pushed onto `outcomes`. The cascade projection
`buildReconcileAppliedCascade` (reconcile/notify.ts) currently maps `plugin-installed →
status "installed"` (notify.ts:485) and the reconcile render map narrows to the statuses
`installed` / `uninstalled` (reconcile.messaging.ts `RECONCILE_APPLIED_PLUGIN_STATUSES`).
Two sub-cases, two render targets:

- **Full promotion** (re-resolved `unsupported` set now empty → plugin is `installable`):
  reuse the existing `plugin-installed` outcome → `(installed)` row. No new status, no
  closed-set change.
- **Partial re-materialize** (still force-installed, fewer unsupported kinds): the
  reconcile cascade has **no** `force-installed` arm today. The global `PLUGIN_STATUSES`
  set already contains `force-installed` (shared/notify.ts:712, added Phase 66), so this
  reuses an existing global token — but the *reconcile-local* narrow set
  (`RECONCILE_APPLIED_PLUGIN_STATUSES`) and its render map must gain a `force-installed`
  arm, and that narrow-set's tripwire test bumps in lockstep (mirrors the Phase 66-01
  closed-set bump pattern). Pick a **sensible-default severity** here and let Phase 69
  stamp the final value; let Phase 70 freeze the byte-exact token (both are Claude's
  Discretion / deferred per D-68-04).

This likely needs **one new `PerEntryOutcome` arm** (e.g. `plugin-backfilled` carrying the
re-resolved `installable: boolean` so the projection chooses `installed` vs
`force-installed`), added to the union in `reconcile/apply-outcomes.ts:234` and handled in
`buildReconcileAppliedCascade`. Reusing `plugin-installed` for the full case and a new arm
only for the partial case is also viable — the planner decides.

## Research Question 3 — state.json write seam & schema migration

**The schema edit (D-68-01) — additive, no `schemaVersion` bump:**

```typescript
// persistence/state-io.ts — STATE_SCHEMA, currently :153
export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),   // UNCHANGED — stays 1|2
  // BFILL-02 / D-68-01: optional top-level scan-gate stamp. Absent = scan-once
  // (treated as version-changed). Additive — old docs without it validate fine.
  lastReconciledExtensionVersion: Type.Optional(Type.String()),
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});
```

`Type.Optional` means an old `state.json` lacking the field passes `STATE_VALIDATOR.Check`
unchanged, and `saveState` (state-io.ts:314) — which re-validates in-memory state before
writing — accepts a state with or without it. No `schemaVersion` bump, no migrate.ts
default-fill needed (an optional field has nothing to fill). `[VERIFIED: typebox Type.Optional semantics + saveState revalidation at state-io.ts:315]`

**CRITICAL — thread the field through `loadState` normalization (else the gate never closes).**
`loadState` does **not** return the parsed object; it rebuilds it at state-io.ts:290 as
`const normalized: unknown = { schemaVersion: 2, marketplaces };`. A new top-level field is
**silently dropped** here on every load, so `tx.state.lastReconciledExtensionVersion` would
always read `undefined`, the gate would always fire, and backfill would run on every load —
violating D-68-03 ("unchanged version skips the scan"). Three sites to update:

```typescript
// state-io.ts:290 — carry the stamp from `parsed`/`root` onto the rebuilt object:
const root = parsed as { lastReconciledExtensionVersion?: unknown };
const normalized: unknown = {
  schemaVersion: 2,
  ...(typeof root.lastReconciledExtensionVersion === "string" && {
    lastReconciledExtensionVersion: root.lastReconciledExtensionVersion,
  }),
  marketplaces,
};
```

The ENOENT default (state-io.ts:236 `{ schemaVersion: 2, marketplaces: {} }`) and
`DEFAULT_STATE` (state-io.ts:164) correctly **omit** the stamp — absent = scan-once = a
fresh/never-reconciled scope scans on its first load, which is exactly D-68-03's intent. No
change needed there beyond ensuring the type permits the optional field (it does, via
`Type.Optional`). `migrateLegacyMarketplaceRecords` returns only `marketplaces`
(migrate.ts:207), so the stamp threading must live in `loadState`, not the migrator.

**The write seam (NFR-1 atomic, SPLIT-02 enforced).** `state.json` may be written by ONLY
two files, pinned by the architecture test `tests/architecture/config-state-write-seams.test.ts:75`:
`persistence/state-io.ts::saveState` and `persistence/migrate.ts::persistMigratedState`.
The stamp write therefore must route through `saveState` (via `tx.save()` /
`withStateGuard`), never a new `atomicWriteJson(stateJsonPath, ...)` call elsewhere — that
would trip the SPLIT-02 walker. `saveState` already calls `atomicWriteJson`
(state-io.ts:322 → shared/atomic-json.ts:24 → `write-file-atomic`), giving NFR-1 atomicity
for free.

**Where the stamp gets written.** The read pass is write-free (WR-05), so the stamp is
written in the apply region. Two clean shapes:

1. **Dedicated locked stamp write** after backfill, only when the gate opened:
   ```typescript
   // in applyBackfillForScope, after re-materializing:
   await withStateGuard(locationsFor(scope, opts.cwd), (state) => {
     state.lastReconciledExtensionVersion = EXTENSION_VERSION;   // saveState revalidates + atomic-writes
   });
   ```
   `withStateGuard` (with-state-guard.ts:66) re-loads fresh state (now reflecting the
   reinstall writes), mutates, and `saveState`s — a single small extra write per
   version-change load. This is the simplest and keeps backfill's lock usage uniform with
   `reinstallPlugin`'s (each takes its own lock; CR-01-safe).

2. Fold the stamp into one of the reinstall transactions — rejected: brittle (no plugins
   to backfill ⇒ no transaction to piggyback on), and the gate must still close in the
   "version changed but zero force-installed plugins" case.

**Stamp-on-gate-open is unconditional of materialize results.** Per D-68-03 the running
version is stamped **whenever the gate opened**, even if no plugin needed backfill —
otherwise the gate reopens every load. This means the first load after a version bump
writes `state.json` (stamp) even when there are no force-installed plugins and the cascade
is silent (zero outcomes ⇒ no notify, NFR-2). This does **not** violate RECON-05's
"no-op reconcile leaves state.json untouched" invariant: RECON-05 governs the
*unchanged-version steady state* (gate closed ⇒ no stamp write ⇒ mtime untouched). Only the
post-upgrade load writes the stamp. Call this interaction out explicitly in the plan and
test it.

## Runtime State Inventory

This phase **adds** persisted runtime state (the version stamp) and **mutates** existing
persisted state (`compatibility` records during re-materialization). Inventory of state
this phase touches:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per scope: NEW optional top-level `lastReconciledExtensionVersion`; EXISTING per-plugin `compatibility.{installable,supported,unsupported}` records updated in place by re-materialization. | Schema edit (state-io.ts:153) + thread through loadState normalization (state-io.ts:290) + widen reinstall's `updateStateRecord` to write the real supported/unsupported (reinstall.ts:1416-1435). Code edit; no separate data migration (optional field auto-fills on next save; compatibility records rewritten by the reinstall primitive). |
| Live service config | None — backfill is fully local; no external service holds the stamp or the force-state. NFR-5: cache-only `resolveStrict`, no network. | None. |
| OS-registered state | None. The hooks routing tables are in-memory and already rebuilt post-apply via `rebuildScopeRoutingTableIsolated` (apply.ts:845) and inside `reinstallPlugin` (reinstall.ts:1219). | None — re-materialize reuses the existing rebuild path. |
| Secrets / env vars | None. `EXTENSION_VERSION` is a public build fact, not a secret. `PI_CODING_AGENT_DIR` continues to resolve the user-scope root unchanged. | None. |
| Build artifacts / installed packages | The new `EXTENSION_VERSION` constant must be kept in sync with `package.json` `version` (and the release ritual's `sonar-project.properties`). | Drift-guard test (Question 1) makes desync a CI failure. |

## Architecture Patterns

### Data flow (load → gate → backfill → stamp)

```
Pi load / /reload
  └─ resources_discover (index.ts:56)
       └─ applyReconcile({ ctx, pi, cwd })            apply.ts:786
            for scope in [project, user]:
              readPassForScope ──(locked, write-free)─► state (incl. lastReconciledExtensionVersion)
              applyPlan ──► outcomes[]   (existing install/uninstall/... rows)
              applyBackfillForScope(scope, state, outcomes):     ◄── NEW (no outer lock)
                 ▼ gate: EXTENSION_VERSION !== state.lastReconciledExtensionVersion ? (absent ⇒ fire)
                 ├─ NO  → return (skip scan — D-68-03)
                 └─ YES → for each recorded plugin:
                            resolveStrict(entry)  ── cache-only, NFR-5
                            is it force-installed (re-resolves `unsupported`)?  ── D-68-03 scope
                              └─ supported set grew vs recorded?
                                   └─ reinstallPlugin({ render:"none" })  ◄── self-locks (CR-01)
                                        ├─ widened: requireForceInstallable / MaterializablePlugin
                                        ├─ writes new compatibility.{supported,unsupported}
                                        └─ returns outcome ──► push PerEntryOutcome onto outcomes[]
                            withStateGuard(loc): state.lastReconciledExtensionVersion = EXTENSION_VERSION  ── stamp (saveState)
            outcomes.length===0 ? return (silent)
                                : ONE notifyReconcileAppliedWithContext(...)   apply.ts:865  (RECON-04)
```

### Pattern: identifying force-installed plugins to scan (D-68-03)

A force-installed plugin is one **recorded as installed** whose entry **currently
re-resolves to `unsupported`** (the Phase 66 derived-state definition). Scan = iterate the
scope's `state.marketplaces[*].plugins[*]`, `resolveStrict` each entry from the cached
manifest (no network), and select those that re-resolve `unsupported` AND whose re-resolved
`supported` set is strictly larger than the recorded `compatibility.supported` (the
boundary moved *for this plugin*). Re-materialize only those — re-materializing an unchanged
plugin wastes work and churns `state.json` mtime. (The version gate already guarantees the
boundary moved *somewhere*; the per-plugin supported-set check avoids needless writes for
plugins whose specific kinds did not change.)

### Anti-patterns to avoid

- **Bumping `schemaVersion` to 3.** D-68-01 forbids it; the field is additive-optional.
- **Writing the stamp via a bare `atomicWriteJson(stateJsonPath, ...)`** outside
  `saveState`/`persistMigratedState` — trips the SPLIT-02 architecture test
  (config-state-write-seams.test.ts:131).
- **Running backfill inside the read pass / under an outer lock** — `proper-lockfile` is
  not re-entrant; `reinstallPlugin` self-locks (CR-01 deadlock).
- **A second `notify()` for backfill rows** — violates RECON-04; fold into `outcomes[]`.
- **Runtime JSON import of `package.json`** at the NFR-4 Node floor — experimental below
  Node 22, emits ExperimentalWarning.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Re-materialize a plugin's components | A bespoke partial-materialize path | The (widened) `reinstallPlugin` primitive | D-68-02 mandates exactly one materialize path; reinstall already does prepare→replace→finalize→rollback with the bridges. |
| Atomic state write | `fs.writeFile` + manual tmp/rename | `saveState` → `atomicWriteJson` → `write-file-atomic` | NFR-1; SPLIT-02 pins the seam; concurrent-write queue + fsync handled. |
| Cross-process safety around the stamp write | A custom lock/flag | `withStateGuard` / `withLockedStateTransaction` | D-06 per-scope `proper-lockfile`; already the state lifecycle wrapper. |
| Cache-only re-resolution | A new no-network resolve | `resolveStrict` | Already the NFR-5-safe resolver used by reinstall and the Phase 66 list deriver. |
| Force-state classification | A persisted `forceInstalled` flag | Derived re-resolution to `unsupported` | FSTAT-01 / D-66-01: force-state is derived, never persisted (the sticky-flag attempt was removed). |

**Key insight:** Phase 68 is almost entirely *wiring* — the risk is in the seams
(loadState normalization dropping the field; reinstall's `requireInstallable` throwing on
force-installed plugins; SPLIT-02 / RECON-04 invariants), not in any new algorithm.

## Common Pitfalls

### Pitfall 1: the reinstall primitive is not yet force-capable (BLOCKING)

**What goes wrong:** `reinstallPlugin` resolves through `resolveInstallable` →
`requireInstallable(resolved, "install")` (reinstall.ts:1262-1267), which **throws**
`PluginShapeError {not-installable}` for any `unsupported` plugin. And `updateStateRecord`
**hardcodes** `compatibility.installable: true` and copies `installable.unsupported` —
which is always `[]` for the `ResolvedPluginInstallable` type (reinstall.ts:1416-1435,
`installable: ResolvedPluginInstallable` at :1421). So as built, reinstall (a) cannot run
on a still-force-installed plugin and (b) cannot record a partial (still-degraded)
re-materialization. This directly contradicts D-68-02 ("materialize the now-fuller
supported set… the persisted `compatibility` record updates to the new (possibly empty)
unsupported set").

**Why it happens:** Phase 67 made reinstall an always-overwrite repair primitive
(RINST-01) but only for fully-installable plugins; it never needed the force arm because
force-install/update (Phase 65) had its own path.

**How to avoid:** Widen the reinstall primitive to the force-capable shape, mirroring the
Phase 65 install-force path:
- `resolveInstallable` → call `requireForceInstallable(resolved, "install")` and return
  `MaterializablePlugin` (resolver.ts:136) instead of `ResolvedPluginInstallable`.
- Re-type the threaded `installable` fields (reinstall.ts:1276, :1381, :1421) to
  `MaterializablePlugin`. The bridges already accept this union (Phase 65 / 65-01).
- `updateStateRecord` (reinstall.ts:1435): write
  `installable: resolved.state === "installable"`, and copy the **actual**
  `resolved.supported` / `resolved.unsupported` arrays.

**Warning signs:** A backfill test on a still-partial plugin throws
`{no longer installable}` / `{not installable}`, or the post-backfill `state.json` shows
`compatibility.installable: true` + `unsupported: []` for a plugin that is still degraded.
**Note the side effect:** widening reinstall makes the standalone `reinstall` command
*succeed* on a force-installed plugin (re-materializing its supported subset) where it
previously failed — a desirable repair-primitive expansion, but it changes existing
reinstall behavior, so audit `tests/orchestrators/plugin/reinstall.test.ts` for a
force-installed/unsupported scenario that asserts the old failure and update it.

### Pitfall 2: loadState silently drops the new top-level field

**What goes wrong:** `loadState` rebuilds the object as `{ schemaVersion: 2, marketplaces }`
(state-io.ts:290), discarding `lastReconciledExtensionVersion`. The gate then reads
`undefined` every load and backfill runs every time (D-68-03 violated; also re-churns
`state.json` and re-emits the cascade on every load).

**How to avoid:** Thread `root.lastReconciledExtensionVersion` onto `normalized` (see
Question 3). Test: write a `state.json` with the stamp, `loadState`, assert the returned
state still carries it.

**Warning signs:** A round-trip test (`saveState` then `loadState`) loses the stamp; the
cascade fires on a second consecutive load with no version change.

### Pitfall 3: stamp write trips SPLIT-02 or violates RECON-04

**What goes wrong:** Writing the stamp via a new `atomicWriteJson(loc.stateJsonPath, ...)`
in the reconcile/orchestrator layer trips `config-state-write-seams.test.ts:131`; emitting
a separate `notify()` for backfill rows trips RECON-04's single-emission rule.

**How to avoid:** Stamp only through `saveState`/`withStateGuard`; fold rows into the
existing `outcomes[]`.

**Warning signs:** SPLIT-02 walker reports an offender; two notifications appear on one load.

### Pitfall 4: gate must close even when nothing was backfilled

**What goes wrong:** Stamping only when ≥1 plugin was re-materialized leaves the gate open
on a version bump that touched no force-installed plugins; backfill then re-scans every
load.

**How to avoid:** Stamp whenever the gate **opened**, independent of materialize count
(D-68-03). Test both: version-changed + zero force-installed plugins still stamps and stays
silent; unchanged version writes nothing (RECON-05 mtime invariant preserved).

## Code Examples

### Optional top-level schema field (typebox)

```typescript
// persistence/state-io.ts:153 — additive, schemaVersion unchanged
export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),
  lastReconciledExtensionVersion: Type.Optional(Type.String()),   // D-68-01
  marketplaces: Type.Record(Type.String(), MARKETPLACE_RECORD_SCHEMA),
});
// Source: in-tree pattern (state-io.ts:128-156); typebox@^1.1.38
```

### Force-capable resolve in the reinstall primitive (the widening)

```typescript
// orchestrators/plugin/reinstall.ts:1262 — was requireInstallable
async function resolveInstallable(
  entry: PluginEntry,
  marketplaceRoot: string,
): Promise<MaterializablePlugin> {                       // was ResolvedPluginInstallable
  const resolved = await resolveStrict(entry, { marketplaceRoot });   // NFR-5: cache-only
  requireForceInstallable(resolved, "install");          // was requireInstallable
  return resolved;
}
// Source: resolver.ts requireForceInstallable + MaterializablePlugin (:136)
```

### Stamp write through the sanctioned seam

```typescript
// inside applyBackfillForScope, after the scan, when the gate opened:
await withStateGuard(locationsFor(scope, opts.cwd), (state) => {
  state.lastReconciledExtensionVersion = EXTENSION_VERSION;   // saveState revalidates + atomic-writes
});
// Source: transaction/with-state-guard.ts:66; state-io.ts saveState:314
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Persisted `forceInstalled` flag (v1.15 sticky-flag attempt) | Derived force-state (re-resolve to `unsupported`) | Phase 66 / FSTAT-01 | Backfill identifies candidates by re-resolution, not a stored flag. Do not reintroduce the flag. |
| `reinstall --force` axis | `reinstall` always overwrites (repair primitive) | Phase 67 / RINST-01 | Backfill reuses reinstall; but it must be widened to the force arm (Pitfall 1). |
| Manual `complete` command | Automatic load-time backfill + `/reload` | This milestone (out of scope item) | Backfill is the automatic replacement; no manual command. |

**Deprecated/outdated:**
- Treating "session_start" as the literal hook for load-time reconcile — the actual entry
  is the `resources_discover` event (index.ts:56). CONTEXT.md's phrasing is loose.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict`, native TS strip (no tsx) |
| Config file | none — `package.json` `scripts.test` globs `tests/{...}/**/*.test.ts` |
| Quick run command | `node --test "tests/persistence/state-io.test.ts" "tests/orchestrators/reconcile/**/*.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BFILL-02 | Optional stamp field validates; old doc without it loads; round-trip preserves it | unit | `node --test "tests/persistence/state-io.test.ts"` | ✅ extend |
| BFILL-02 | `loadState` normalization carries `lastReconciledExtensionVersion` (Pitfall 2) | unit | `node --test "tests/persistence/state-io.test.ts"` | ✅ extend |
| BFILL-02 | `EXTENSION_VERSION` === `package.json` version (drift guard) | architecture | `node --test "tests/architecture/extension-version-sync.test.ts"` | ❌ Wave 0 |
| BFILL-02 | Gate fires on version change / absent stamp; skips on unchanged version | unit/integration | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | ❌ Wave 0 |
| BFILL-02 | Gate-open with zero force-installed plugins still stamps and stays silent (Pitfall 4) | integration | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | ❌ Wave 0 |
| BFILL-02 | Unchanged version leaves `state.json` mtime untouched (RECON-05) | integration | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | ❌ Wave 0 |
| BFILL-01 | Force-installed plugin whose kinds became supported re-materializes; full promotion → `(installed)` | integration/e2e | `node --test "tests/integration/**/*.test.ts"` | ❌ Wave 0 |
| BFILL-01 | Partial re-materialize records the new (non-empty) `compatibility.unsupported` and stays force-installed (Pitfall 1) | integration | `node --test "tests/orchestrators/plugin/reinstall.test.ts"` + reconcile | ❌ Wave 0 / extend |
| BFILL-01 | Backfill rows fold into the SINGLE cascade (RECON-04) — exactly one `notify()` | unit | `node --test "tests/orchestrators/reconcile/**/*.test.ts"` | ✅ pattern exists |
| BFILL-01 | SPLIT-02 write-seam unchanged (stamp via `saveState`) | architecture | `node --test "tests/architecture/config-state-write-seams.test.ts"` | ✅ exists |

### Sampling Rate

- **Per task commit:** `node --test` on the touched file(s) (state-io / reconcile / reinstall).
- **Per wave merge:** `node --test "tests/{persistence,orchestrators,architecture}/**/*.test.ts"`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work` (NFR-6).

### Wave 0 Gaps

- [ ] `tests/architecture/extension-version-sync.test.ts` — drift guard, covers BFILL-02.
- [ ] `extensions/pi-claude-marketplace/shared/extension-version.ts` — the `EXTENSION_VERSION` constant.
- [ ] Reconcile backfill test file (gate fire/skip, stamp-on-gate-open, silent no-op, single-cascade fold) — covers BFILL-01/02.
- [ ] Reinstall force-capability tests (partial re-materialize records non-empty unsupported; existing force-installed-failure assertion updated) — covers BFILL-01 / Pitfall 1.
- [ ] state-io round-trip + normalization-preservation tests — covers BFILL-02 / Pitfall 2.

## Project Constraints (from CLAUDE.md)

- **NFR-1:** All state.json writes atomic — route the stamp through `saveState` →
  `atomicWriteJson` → `write-file-atomic`. No bypass.
- **NFR-5:** Load-time work is offline/cache-only — re-resolution via `resolveStrict`, no
  network. Backfill must never touch the network.
- **NFR-2 / NFR-3:** No fix requires a Pi restart; operations idempotent/retry-safe. Backfill
  is idempotent (always-overwrite reinstall + gate); a crash before stamping just re-scans
  next load (safe).
- **IL-2:** All user-visible output via `ctx.ui.notify` through the structured cascade —
  fold rows into the single `applyReconcile` cascade; no direct stdout/stderr.
- **SPLIT-02 (architecture test):** Only `state-io.ts::saveState` and
  `migrate.ts::persistMigratedState` may write `state.json`.
- **Comment/test-title policy:** Use `D-68-NN` / `BFILL-NN` / `NFR-N` / `RECON-NN` /
  `RINST-01` / `FSTAT-01` IDs as anchors; NEVER GSD phase/plan/wave references, and never
  bare `Pitfall N` tokens (per `.claude/rules/typescript-comments.md`).
- **ASCII only** in commit messages (the `fix-unicode-dashes` hook rejects em dashes); run
  `pre-commit run --all-files` before committing; never `--no-verify`.
- **Git:** never commit to `main`; this work is on `features/force-install`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reusing `plugin-installed`→`(installed)` for full promotions and a new `force-installed` reconcile arm for partial re-materializes is acceptable as the "sensible default" row (token/severity deferred to 69/70). | RQ2 | Low — D-68-04 explicitly defers the final token/severity; the planner may pick a single new arm instead. Structural requirement (new outcome arm + render-map arm + narrow-set tripwire bump) holds either way. |
| A2 | The per-plugin "supported set grew" check is the right scan predicate (vs. re-materializing all force-installed plugins on every gate-open). | RQ2 / Patterns | Low — both satisfy D-68; the predicate only avoids needless writes. Verify against any RECON-05 mtime test. |
| A3 | Widening reinstall to `requireForceInstallable` is the intended reading of "reuse the reinstall primitive" rather than building a force-only wrapper around the bridge machinery. | Pitfall 1 | Medium — if the team prefers leaving reinstall installable-only, backfill needs a thin force-capable materialize that still reuses the bridge prepare/replace/finalize calls. Confirm in discuss/plan. |
| A4 | The `EXTENSION_VERSION` constant + drift test is preferred over a runtime `package.json` read. | RQ1 | Low — both are viable; the constant is recommended for zero-I/O + no experimental feature. User may prefer single-source-of-truth fs-read. |

## Open Questions (RESOLVED)

1. **Reinstall widening scope (A3).** RESOLVED: widen `reinstallPlugin` via `requireForceInstallable` (plan 68-02).
   - What we know: D-68-02 says "reuse the reinstall primitive"; reinstall currently
     requires full installability and hardcodes `compatibility.installable: true`.
   - What's unclear: whether to widen `reinstallPlugin` itself (affecting the standalone
     `reinstall` command on force-installed plugins) or add a force-capable internal entry
     reused by both.
   - Recommendation: widen `reinstallPlugin` (matches RINST-01's repair-primitive intent);
     update the one reinstall test that asserts the old force-installed failure.

2. **Promotion-row representation (A1).** RESOLVED: `PluginBackfilledOutcome` arm with `installable: boolean` (plan 68-03).
   - What we know: reconcile cascade narrow set is `installed`/`uninstalled`; global set
     already has `force-installed`.
   - What's unclear: one new `PerEntryOutcome` arm vs. reuse of `plugin-installed` for the
     full case.
   - Recommendation: add a `plugin-backfilled` arm carrying the re-resolved
     `installable: boolean`; project to `installed` (empty unsupported) or `force-installed`
     (partial). Sensible-default severity; Phase 69/70 finalize.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | runtime / tests | ✓ | v26.4.0 (floor NFR-4 ≥ 20.19.0) | — |
| `write-file-atomic` | NFR-1 stamp write | ✓ | ^8.0.0 (package.json:11) | — |
| `typebox` | STATE_SCHEMA edit | ✓ | ^1.1.38 (package.json:28) | — |
| `proper-lockfile` | per-scope lock | ✓ | ^4.1.2 (package.json:10) | — |
| Network | — | n/a | — | NFR-5: backfill is offline by construction |

No missing dependencies; no blocking gaps. The test toolchain (`node --test`, native TS
strip) was confirmed working in this session.

## Sources

### Primary (HIGH confidence — verified against the live tree, branch `features/force-install`)

- `extensions/pi-claude-marketplace/persistence/state-io.ts` — STATE_SCHEMA:153,
  DEFAULT_STATE:164, ENOENT default:236, loadState normalization:290, saveState:314-322.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` — applyReconcile:786,
  outcomes accumulator:792, applyPlan:754-774, read pass write-free (WR-05):129-205, single
  notify (RECON-04):864-865, resources_discover ordering note:34, no-outer-lock CR-01:733-735.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` —
  `PerEntryOutcome` union:234-249 (no backfill/reinstall arm today).
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` — resolveInstallable
  uses requireInstallable:1262-1267, threaded `installable: ResolvedPluginInstallable`:1276/1381/1421,
  updateStateRecord hardcodes `compatibility.installable: true`:1416-1435, render:"none"
  orchestrated path:259/277, self-locking transaction:245.
- `extensions/pi-claude-marketplace/domain/resolver.ts` — requireForceInstallable gate,
  `MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginUnsupported`:136,
  `compatibility`-shaped supported/unsupported arms.
- `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` — withStateGuard:66,
  withLockedStateTransaction tx.state:91 / tx.save→saveState:93-100.
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` — atomicWriteJson:24 (write-file-atomic).
- `extensions/pi-claude-marketplace/index.ts` — resources_discover handler:56, applyReconcile call:77.
- `extensions/pi-claude-marketplace/platform/pi-api.ts` — no extension-version accessor (getAgentDir only).
- `tests/architecture/config-state-write-seams.test.ts` — SPLIT-02 state.json writer whitelist:75-78.
- `tsconfig.json` — resolveJsonModule:15, module NodeNext:6. `package.json` — version 0.6.2:87, deps:8-12.
- Empirical: Node v26.4.0; JSON-import-attribute and fs-read of package.json both ran clean
  under native TS strip in this session.

### Secondary (MEDIUM confidence)

- [Node.js — esm: mark import attributes and JSON module as stable (commit 88d91e8, lands v22.0.0)](https://github.com/nodejs/node/commit/88d91e8bc2)
  — JSON module imports are stable only from Node 22; experimental on the NFR-4 floor (20.19).
- [Node.js ESM docs](https://nodejs.org/api/esm.html), [MDN import attributes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with)
  — `with { type: "json" }` syntax + default-export-only semantics.

## Metadata

**Confidence breakdown:**
- Standard stack / seams: HIGH — every claim cross-checked against the live source on the
  active branch with line anchors.
- Architecture (entry point, cascade fold, gate placement): HIGH — `applyReconcile` and
  the lock model read directly; CR-01 no-outer-lock requirement confirmed in code.
- Reinstall widening (Pitfall 1): HIGH on the defect (hardcoded `installable: true`,
  `requireInstallable` throw); MEDIUM on the exact fix shape (planner may prefer a wrapper).
- Version-read recommendation: HIGH — host has no accessor; JSON-import experimental at
  floor verified via Node release history.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable internal architecture; re-verify only if Phase 67
reinstall or Phase 55 reconcile seams change before planning).
