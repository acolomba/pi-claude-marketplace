# Architecture Research

**Domain:** Brownfield integration — declarative config + load-time reconciler for an existing Pi extension (pi-claude-marketplace v1.12)
**Researched:** 2026-06-09
**Confidence:** HIGH (grounded in the real codebase under `extensions/pi-claude-marketplace/`; every integration point cites a file path)

> This is a subsequent-milestone integration study, not an ecosystem survey. It answers: *where does the declarative config + load-time reconciler hook into the existing edge → orchestrator → bridge → persistence layering, and what is new vs. modified.* Web research is not applicable; the only authority is the code.

---

## Standard Architecture

### Existing layering (confirmed in source)

```
┌──────────────────────────────────────────────────────────────────────┐
│ index.ts          extension entry: on("resources_discover"),          │
│                   registerClaudePluginCommand, registerTools           │
├──────────────────────────────────────────────────────────────────────┤
│ edge/             register.ts (commands + session_start), router.ts,   │
│                   handlers/{plugin,marketplace}, completions, args     │
├──────────────────────────────────────────────────────────────────────┤
│ orchestrators/    marketplace/{add,remove,autoupdate,update,info,list} │
│                   plugin/{install,uninstall,update,reinstall,list,info} │
│                   import/{marketplaces(planner),execute,settings,refs}  │
│                   discover.ts (resources_discover aggregator)          │
├──────────────────────────────────────────────────────────────────────┤
│ bridges/          skills | commands | agents | mcp (stage/unstage)     │
│ domain/           resolver, source, manifest(+cache), version, name    │
├──────────────────────────────────────────────────────────────────────┤
│ transaction/      withStateGuard, withLockedStateTransaction,          │
│                   runPhases (ledger), rollback                          │
├──────────────────────────────────────────────────────────────────────┤
│ persistence/      state-io.ts (STATE_SCHEMA, load/save), migrate.ts,   │
│                   locations.ts (ScopedLocations brand), agents-index   │
│ platform/         pi-api, git, git-credential                          │
│ shared/           notify.ts (output catalog), atomic-json, path-safety │
└──────────────────────────────────────────────────────────────────────┘
```

### What v1.12 adds (new components, in **bold**)

```
                          ┌─────────────────────────────────────────┐
  index.ts ── on("session_start") ──► reconcile  (NEW: orchestrators/reconcile/)
       │     (load-time hook)         │  loadMergedConfig (NEW)
       │                              │  diffDesiredVsActual (NEW planner)
       │                              │  apply via existing add/remove/
       │                              │       install/uninstall/enable/disable
       │                              ▼
       └── on("resources_discover") ──► discover.ts (UNCHANGED; runs AFTER reconcile materializes)

  persistence/  config-io.ts (NEW)        state-io.ts (MODIFIED: fields split out)
                claude-plugins.json        state.json (machine bookkeeping only)
                claude-plugins.local.json
                migrate-config.ts (NEW: state.json → config on first load)
```

---

## Component Responsibilities

| Component | New/Modified | Responsibility |
|-----------|--------------|----------------|
| `persistence/config-io.ts` | **NEW** | Typebox schema + `loadConfig`/`saveConfig` for `claude-plugins.json` and `claude-plugins.local.json`; merge of base + local into one `MergedConfig` (desired state). Mirrors `state-io.ts` structure (Compile validator, atomic write). |
| `persistence/config-merge.ts` | **NEW** (may fold into config-io) | Entry-level override merge: local file overrides base **per entry** (per marketplace / per plugin), not whole-file replace. |
| `persistence/migrate-config.ts` | **NEW** | First load without a config file: generate `claude-plugins.json` from current `state.json` (no uninstall). Analogue of `persistence/migrate.ts`. |
| `orchestrators/reconcile/` | **NEW** | The load-time reconciler. `planReconcile(merged, state)` = pure desired-state diff (template: `orchestrators/import/marketplaces.ts`). `applyReconcile` drives existing orchestrators. |
| `persistence/locations.ts` | **MODIFIED** | Add `configJsonPath` (`<scopeRoot>/claude-plugins.json`) and `configLocalJsonPath` (`<scopeRoot>/claude-plugins.local.json`) fields. Both under `scopeRoot`, NOT `extensionRoot`. |
| `persistence/state-io.ts` | **MODIFIED** | `STATE_SCHEMA` keeps only machine bookkeeping; `autoupdate` (desired) moves to config. Bump `schemaVersion` if shape changes load-incompatibly. |
| `orchestrators/{marketplace,plugin}/*` | **MODIFIED** | Each mutating command gains a config write-back step inside its existing lock. `--local` routing flag added. |
| `orchestrators/plugin/enable.ts`, `disable.ts` | **NEW** | Ride existing uninstall (artefact removal) / install-from-cache (re-materialize) machinery; keep config entry + version pin. |
| `index.ts` | **MODIFIED** | Add load-time reconcile invocation (see hook-point analysis below). |
| `shared/notify.ts` + catalog | **MODIFIED** | New reconcile-summary surface within the existing `MarketplaceNotificationMessage` grammar. |

---

## Recommended Project Structure (additions only)

```
extensions/pi-claude-marketplace/
├── persistence/
│   ├── config-io.ts          # NEW: CONFIG_SCHEMA, loadConfig, saveConfig
│   ├── config-merge.ts       # NEW: base+local entry-level merge → MergedConfig
│   ├── migrate-config.ts     # NEW: state.json → claude-plugins.json (first load)
│   ├── state-io.ts           # MODIFIED: split desired fields out of STATE_SCHEMA
│   └── locations.ts          # MODIFIED: + configJsonPath, + configLocalJsonPath
├── orchestrators/
│   ├── reconcile/
│   │   ├── plan.ts           # NEW: pure diff(MergedConfig, ExtensionState) → ReconcilePlan
│   │   ├── apply.ts          # NEW: drives add/remove/install/uninstall/enable/disable
│   │   ├── notify.ts         # NEW: ReconcileResult → MarketplaceNotificationMessage[]
│   │   └── index.ts          # NEW: reconcileAtLoad(userLoc, projectLoc, ...)
│   └── plugin/
│       ├── enable.ts         # NEW
│       └── disable.ts        # NEW
└── shared/
    └── config-writeback.ts   # NEW: writeBackMarketplace/Plugin(scope, --local, mutation)
```

### Structure rationale

- **`orchestrators/reconcile/` mirrors `orchestrators/import/`.** Import already solved "declared desired state → ensure marketplaces, then install plugins, continue-on-failure, build one cascade notification." The reconciler is import generalized to a *bidirectional* diff (also removes undeclared). Treat `import/marketplaces.ts::buildClaudeImportPlan` (the D-28 pure planner) and `import/execute.ts::executeScopedPlan` as the working template. Do not re-derive the orchestration loop from scratch.
- **`config-io.ts` next to `state-io.ts`, not merged.** They are different files on disk with different lifecycles (config is user-authored/version-controlled; state is machine-owned). Keeping them sibling modules preserves the persistence-layer convention (one schema + Compile validator + atomic write per file).
- **Config files live under `scopeRoot`, not `extensionRoot`.** The milestone locks `<scopeRoot>/claude-plugins.json`. This is the same tier as `agents/` and `mcp.json` in `locations.ts` (lines 120–123). `extensionRoot` (`<scopeRoot>/pi-claude-marketplace/`) stays the machine-bookkeeping root.

---

## Architectural Patterns

### Pattern 1: Load-time hook placement — reconcile **before** discover, sequenced not concurrent

**What:** The reconciler must run, materialize artefacts, then `resources_discover` reads the materialized `resources/skills` and `resources/prompts`.

**The seam:** `index.ts` currently wires two independent handlers:
- `on("resources_discover", …)` → `aggregateDiscoveredResources(...)` (reads `skillsTargetDir`/`promptsTargetDir`, lines 21–30)
- `registerClaudePluginCommand` which internally does `pi.on("session_start", …)` (register.ts:109)

`resources_discover` reads the filesystem each time it fires; it has **no dependency on in-memory state**. So the reconciler does not need to *return* anything to discover — it only needs to have **finished its disk mutations before discover runs**.

**Recommendation:** Run the reconciler inside the `resources_discover` handler itself, *before* `aggregateDiscoveredResources`, because:
1. `resources_discover` carries `event.cwd` — required to build the project-scope `ScopedLocations` (`locationsFor("project", event.cwd)`, already done at index.ts:24). `session_start`'s `ctx` does not obviously carry cwd in the same shape.
2. It guarantees ordering by construction (await reconcile, then aggregate) — no cross-handler race.
3. Pi calls `resources_discover` at startup and on `/reload`, which is exactly the "Pi startup + restart/reload" trigger the milestone specifies.

```typescript
onResourcesDiscover("resources_discover", async (event) => {
  const userLoc = locationsFor("user", homedir());
  const projectLoc = locationsFor("project", event.cwd);
  // NEW: reconcile desired→actual before reading materialized resources.
  // Network soft-fails; never throws past this boundary (NFR-5 load exception).
  await reconcileAtLoad({ userLoc, projectLoc, /* ctx, pi, gitOps */ });
  const discovered = await aggregateDiscoveredResources(userLoc, projectLoc);
  return { skillPaths: [...discovered.skillPaths], promptPaths: [...discovered.promptPaths] };
});
```

**Caveat to resolve in roadmap:** `resources_discover`'s handler currently has no `ctx`/`pi` for `notify()`. Reconcile notifications need a notify sink. Options: (a) reconcile emits via a deferred channel surfaced on next `session_start` (`ctx` is available there); (b) capture `pi` at extension-init and notify directly if `resources_discover` provides a usable ctx. **Flag for a feasibility spike** — see Pitfalls.

**Trade-off:** Putting reconcile in the discover handler couples two concerns in one event. Acceptable because the ordering requirement is real and discover is the only handler with cwd. The legacy-migration path (`state-io.ts::loadState` → `migrateLegacyMarketplaceRecords`, fire-and-forget) is unaffected — it runs lazily inside the first `loadState` the reconciler triggers, so legacy state migration happens *underneath* reconcile automatically.

### Pattern 2: Pure desired-state planner (reuse the D-28 template)

**What:** Separate the diff (pure, testable, no I/O) from the apply (effectful). This is exactly what `import/marketplaces.ts::buildClaudeImportPlan` does (pure) vs `import/execute.ts::executeScopedPlan` (effectful).

**When:** Always — the reconciler's correctness hinges on the diff being unit-testable without disk.

```typescript
// orchestrators/reconcile/plan.ts  (pure; template = import/marketplaces.ts)
interface ReconcilePlan {
  marketplacesToAdd: PlannedMarketplaceSource[];     // declared, not in state
  marketplacesToRemove: string[];                    // in state, not declared
  pluginsToInstall: PlannedPluginRef[];              // declared+enabled, not materialized
  pluginsToUninstall: PlannedPluginRef[];            // materialized, not declared
  pluginsToEnable: PlannedPluginRef[];               // declared enabled, currently disabled
  pluginsToDisable: PlannedPluginRef[];              // declared disabled, currently materialized
  autoupdateChanges: {...}[];                         // declared autoupdate ≠ state
}
function planReconcile(merged: MergedConfig, state: ExtensionState): ReconcilePlan
```

The planner is where the **bidirectional** difference from import lives: import only *adds* (declared → ensure). Reconcile also *removes* (undeclared → uninstall) and computes enable/disable transitions. The `import/execute.ts::samePlannedSource` source-comparison helper (lines 186–216) is directly reusable for "marketplace declared with a different source than recorded."

**Trade-off:** A pure planner duplicates a little shape-mapping. Worth it — `tests/architecture` + unit tests can pin the diff matrix exhaustively without filesystem fixtures.

### Pattern 3: Apply via existing orchestrators, one lock per scope

**What:** `applyReconcile` must NOT re-implement install/uninstall. It calls `installPlugin`, `uninstallPlugin`, `addMarketplace`, `removeMarketplace` exactly as `import/execute.ts` calls `addMarketplace`/`installPlugin` (lines 572, 638). Each of those already owns its `withStateGuard` lock internally.

**When:** Always. The continue-on-failure semantics (`try/catch` per item, accumulate outcomes, one cascade notify at end) are already proven in `executeScopedPlan`.

**Critical sequencing constraint:** Each existing orchestrator acquires the per-scope `proper-lockfile` lock (`withScopeLock`, retries: 0 — `with-state-guard.ts:160`). They cannot be nested. So `applyReconcile` invokes them **sequentially per scope**, never holding an outer lock around them. This matches import, which calls `addMarketplace` then `installPlugin` serially without an outer guard.

```typescript
// orchestrators/reconcile/apply.ts
for (const mp of plan.marketplacesToAdd)   await addMarketplace({...});      // owns its lock
for (const p of plan.pluginsToUninstall)   await uninstallPlugin({...});     // owns its lock
for (const p of plan.pluginsToInstall)     await installPlugin({..., notifications:{mode:"orchestrated"}});
// enable/disable likewise; accumulate outcomes; single notify at end
```

### Pattern 4: Config write-back composed with `withLockedStateTransaction`

**What:** Every mutating command must update both `state.json` (machine) and `claude-plugins.json` (desired). They must stay consistent: a crash must not leave state mutated but config stale, or vice versa.

**The integration point:** Two atomic files, two writes — there is no single transaction spanning both. The codebase already accepts last-writer-wins byte-safety via `write-file-atomic` and uses `proper-lockfile` for the *state* critical section (`with-state-guard.ts`). Recommended ordering inside each command:

1. Acquire the per-scope state lock (existing `withStateGuard`/`withLockedStateTransaction`).
2. Do the physical artefact work + `state.json` save (existing).
3. **Then** write-back config (`saveConfig`) *while still holding the same scope lock* — extend the locked region, not a second lock.

Use `withLockedStateTransaction` (the explicit-save variant, `with-state-guard.ts:83`) for commands that need to interleave a config write with the state save, because it hands the caller `tx.save()` control. The config write-back goes between artefact-commit and `tx.save()`, or immediately after, inside the same `withScopeLock` body.

**Recommendation:** Add a `shared/config-writeback.ts` helper invoked *inside* the existing locked closure so config + state share one lock acquisition:

```typescript
await withLockedStateTransaction(loc, async (tx) => {
  // ... existing physical work + mutate tx.state ...
  await writeBackPluginEntry(loc, { local: opts.local, ... });  // NEW, same lock
  await tx.save();                                              // existing state save
});
```

**Ordering for crash-consistency:** config is the *authoritative desired state*; state is *derived/machine*. If a crash occurs between the two writes, the next load-time reconcile re-derives. So write config **last** (after state save) when the command *adds* desired state (a crash before config-write just means reconcile won't see it yet — safe, idempotent retry). Write config in the **same** locked body so a concurrent process cannot interleave. **Flag the exact ordering as a phase-level decision** — it interacts with the saga/rollback discipline hardened in v1.7.

### Pattern 5: enable/disable rides existing uninstall/install machinery

**What:** Disable = remove artefacts but keep config entry + version pin + cached clone. Enable = re-materialize from cache, no network.

**Reuse map:**
- **disable** ≈ `uninstallPlugin` *minus* the `pluginDataDir` rm-rf (PU-2, uninstall.ts) and *minus* config-entry removal. The artefact cascade (`cascadeUnstagePlugin`) is exactly the bridge-unstaging disable needs. So: parameterize uninstall, or extract its cascade core and have `disable.ts` call the cascade + clear the state `resources` record while leaving the cached clone (`sources/<mp>`) and config entry intact.
- **enable** ≈ `installPlugin` with `notifications` orchestrated, but reading from the **cached manifest/clone only** — which `installPlugin` already does (PI-2: "cached manifest read ONLY (no network)", install.ts:17). `reinstall` (PRD v1.1) already proves "cached-manifest / recorded-version reuse with no network sync." **`reinstall.ts` is the closest template for enable** — same no-network re-materialize-from-cache shape.

**Recommendation:** enable.ts delegates to the reinstall building blocks (`reinstallPlugin`); disable.ts delegates to the uninstall cascade core. Both then write-back `enabled: false/true` to config. Keep the version pin: enable reads the pinned version from the config entry / state record, never re-resolves from network.

```
disable(plugin@mp):  cascadeUnstagePlugin → clear state.resources → keep state record+clone → config.enabled=false
enable(plugin@mp):   reinstallPlugin (cached, pinned version) → config.enabled=true
```

### Pattern 6: Notifications within the existing catalog grammar

**What:** Reconcile produces a multi-marketplace, multi-plugin result that must render through `notify()` using the locked `MarketplaceNotificationMessage[]` grammar (`shared/notify.ts`), byte-checked by `tests/architecture/catalog-uat.test.ts`.

**Reuse:** `import/execute.ts::buildImportNotificationMarketplaces` (lines 364–497) is the exact pattern: accumulate per-(scope,marketplace) blocks, map outcomes to `status` + per-plugin rows, sort via `compareByNameThenScope`. Reconcile's notify builder (`orchestrators/reconcile/notify.ts`) is a sibling of that function with the reconcile outcome set (added/removed marketplaces; installed/uninstalled/enabled/disabled plugins).

**Grammar additions to verify:** removed-marketplace and uninstalled-plugin statuses already exist (`MarketplaceStatus` includes `removed`; plugin `uninstalled` exists). enable/disable need their own status tokens or reuse `installed`/`uninstalled` — **decision point**: are "enabled"/"disabled" new STATUS_TOKENS or do they render as installed/uninstalled? This touches the closed-set grammar (`STATUS_TOKENS`, `REASONS`, `MARKERS`) and the byte-locked `docs/output-catalog.md`. Any new token requires catalog-UAT byte forms in lockstep (per the v1.10/v1.11 discipline in MEMORY).

**Trade-off:** Soft-fail network results must render as warnings, not block load. The existing `computeSeverity` benign-softening ladder (v1.5 UXG-02) already routes benign skips to `info`. A reconcile that *couldn't reach the network* for an autoupdate is a benign soft-fail → `info`/skipped, not `error`.

---

## Data Flow

### Load-time reconcile flow (NEW)

```
Pi startup / /reload
   └─► resources_discover(event.cwd)                    [index.ts handler]
         ├─► reconcileAtLoad(userLoc, projectLoc)        [NEW]
         │     ├─ loadMergedConfig(loc)  ──► base+local entry-merge   [config-io+merge]
         │     │     └─ (first load, no file) migrate-config: state.json → config
         │     ├─ loadState(loc)         ──► machine bookkeeping      [state-io, +legacy migrate]
         │     ├─ planReconcile(merged, state) ──► ReconcilePlan      [PURE, template=import planner]
         │     └─ applyReconcile(plan):                               [template=import/execute]
         │           addMarketplace / removeMarketplace               [each owns its scope lock]
         │           installPlugin(orchestrated) / uninstallPlugin
         │           enablePlugin / disablePlugin
         │           ↳ network attempts soft-fail, never throw past boundary (NFR-5)
         │           ↳ accumulate outcomes → buildReconcileNotification → notify (deferred sink?)
         └─► aggregateDiscoveredResources(userLoc, projectLoc)        [UNCHANGED; reads materialized dirs]
               └─ returns { skillPaths, promptPaths }                 [Pi loads them]
```

### Mutating-command write-back flow (MODIFIED commands)

```
/claude:plugin install x@mp [--local]
   └─► makeInstallHandler → installPlugin(opts)
         └─ withLockedStateTransaction(loc):              [single scope lock]
               physical stage+commit (5-phase ledger)     [unchanged]
               mutate tx.state                            [unchanged]
               writeBackPluginEntry(loc, {local})         [NEW, same lock]
               tx.save()                                  [unchanged]
         └─ notify(...)                                   [unchanged]
```

### State.json split (which fields move, which stay)

| Field (current `MARKETPLACE_RECORD_SCHEMA` / `PLUGIN_INSTALL_RECORD_SCHEMA`) | Moves to config | Stays in state.json |
|---|---|---|
| marketplace `name` | ✔ (config declares it) | (state may keep as key) |
| marketplace `source` | ✔ (desired) | needed at runtime for clone resolution — **keep a copy in state** (already used by reconcile source-match) |
| marketplace `autoupdate` | ✔ **moves** (desired/user setting) | — |
| marketplace `addedFromCwd`, `manifestPath`, `marketplaceRoot`, `lastUpdatedAt` | — | ✔ machine bookkeeping |
| plugin ref (`plugin@marketplace`) | ✔ (config declares) | ✔ keyed record |
| plugin `enabled` | ✔ **new in config** | — (or mirror as derived) |
| plugin `version` (resolved/pinned) | ✔ pin is desired; **config carries the pin** | ✔ state carries *resolved* version |
| plugin `resolvedSource`, `compatibility`, `resources`, `installedAt`, `updatedAt` | — | ✔ machine bookkeeping (materialized artefact records) |

**Net:** the *desired* fields (which marketplaces/plugins, their source, autoupdate, enabled, version pin) become config-authoritative; the *materialized* records (what artefacts were actually written, resolved versions, timestamps, derived paths) stay in `state.json`. Keep `source` duplicated into state for runtime resolution (the reconciler compares them; mismatch ⇒ re-add). Decide whether to bump `STATE_SCHEMA.schemaVersion` (currently locked `1`) — if `autoupdate` is dropped, an old state.json with it still validates (it's `Type.Optional`), so a bump may be optional; confirm during design.

---

## Anti-Patterns

### Anti-Pattern 1: Nesting orchestrator locks in the reconciler

**What people do:** Wrap `applyReconcile` in one big `withStateGuard` and call `installPlugin`/`uninstallPlugin` inside it.
**Why it's wrong:** Those orchestrators acquire the **same per-scope `proper-lockfile` with `retries: 0`** (`with-state-guard.ts:160`). A nested acquisition deadlocks/ELOCKEDs instantly.
**Do this instead:** Drive existing orchestrators sequentially with no outer lock (exactly as `import/execute.ts` does). Each owns its own lock window.

### Anti-Pattern 2: Letting load-time network failures throw past `resources_discover`

**What people do:** `await addMarketplace(...)` in reconcile and let a GitHub-fetch failure propagate.
**Why it's wrong:** It would block Pi startup and break the milestone invariant "network soft-fails and never blocks load." `aggregateDiscoveredResources` would never run.
**Do this instead:** Per-item `try/catch` (the `executeScopedPlan` pattern), accumulate failures as warning outcomes, continue. The reconcile boundary in the `resources_discover` handler must be total (never re-throw).

### Anti-Pattern 3: A `sync` command or a second reconcile trigger

**What people do:** Add a `/claude:plugin sync` command.
**Why it's wrong:** The milestone explicitly locks "reconciliation at extension load only; no sync command." Mutating commands write-back; load reconciles. A manual sync invites two divergent code paths.
**Do this instead:** Reconcile is load-only; write-back keeps config fresh during the session.

### Anti-Pattern 4: Replacing whole config file on `--local` write

**What people do:** Write the full merged config to the local file.
**Why it's wrong:** Local override is **entry-level** (per marketplace / per plugin), not whole-file. Whole-file replace would promote base entries into the local file and break the override semantics.
**Do this instead:** `--local` write touches only the targeted entry in `claude-plugins.local.json`; base file untouched.

### Anti-Pattern 5: Writing config files under `extensionRoot`

**What people do:** Put `claude-plugins.json` under `<scopeRoot>/pi-claude-marketplace/`.
**Why it's wrong:** Milestone locks `<scopeRoot>/claude-plugins.json`. `extensionRoot` is the machine-bookkeeping root; config is user-authored and version-controlled, a peer of `mcp.json`/`agents/`.
**Do this instead:** New `locations.ts` fields `configJsonPath`/`configLocalJsonPath` joined to `scopeRoot`.

---

## Integration Points

### Internal boundaries (cite paths)

| Boundary | Mechanism | Notes |
|----------|-----------|-------|
| `index.ts` ↔ reconciler | direct call inside `resources_discover` handler, before `aggregateDiscoveredResources` (index.ts:21–30) | only handler with `event.cwd`; guarantees ordering |
| reconciler ↔ existing orchestrators | direct calls to `addMarketplace`/`removeMarketplace` (`orchestrators/marketplace/{add,remove}.ts`), `installPlugin`/`uninstallPlugin` (`orchestrators/plugin/{install,uninstall}.ts`) | each owns its scope lock; call serially; `notifications:{mode:"orchestrated"}` for installs (install.ts:214) |
| reconciler planner ↔ import planner | `planReconcile` mirrors `buildClaudeImportPlan` (`import/marketplaces.ts`); reuse `samePlannedSource` (`import/execute.ts:186`) | bidirectional diff is the new part |
| config ↔ persistence | `config-io.ts` sibling of `state-io.ts`; Typebox `Compile` validator + `atomicWriteJson` (`shared/atomic-json.ts`) | same atomic-write discipline (NFR-1) |
| config write-back ↔ state save | inside `withLockedStateTransaction` body (`with-state-guard.ts:83`) | one scope lock covers both writes |
| migration ↔ first load | `migrate-config.ts` invoked by `loadMergedConfig` on ENOENT; analogue of `migrate.ts` fire-and-forget | generates config from state.json, no uninstall |
| reconcile notify ↔ catalog | `buildReconcileNotification` mirrors `buildImportNotificationMarketplaces` (`import/execute.ts:364`); routes through `notify()` (`shared/notify.ts:2304`) | byte-locked by `catalog-uat.test.ts` |
| enable/disable ↔ reinstall/uninstall | `enable.ts` → `reinstallPlugin` (`reinstall.ts:196`, cached no-network); `disable.ts` → uninstall cascade core (`cascadeUnstagePlugin`) | keep clone + config entry; clear materialized state |

### NFR amendments implied

| NFR | Current text | v1.12 amendment |
|-----|--------------|-----------------|
| **NFR-5** (network policy) | `install`/`list`/`uninstall`/`remove`/path-`add` MUST NOT touch network | **Add load-time exception:** load-time reconcile MAY attempt network for GitHub-source marketplace add/autoupdate, but every attempt soft-fails and never blocks load. Codify as: reconcile network is best-effort-only, non-blocking. The architectural guard `tests/architecture/no-orchestrator-network.test.ts` must still pass for `install.ts` (install stays cache-only). |
| **NFR-10** (containment) | refuse writes outside `extensionRoot`/`agents/`/`mcp.json` | **Extend** the allowed-write set to include `<scopeRoot>/claude-plugins.json` and `<scopeRoot>/claude-plugins.local.json`. Add these to the containment allowlist and to `path-safety` assertions where applicable. |
| **NFR-1** (atomic writes) | all disk mutations atomic | config writes go through `atomicWriteJson` — no amendment, just compliance. |

### New architecture tests implied

| Test (under `tests/architecture/` unless noted) | Asserts |
|---|---|
| `reconcile-plan-matrix.test.ts` (unit) | pure `planReconcile` produces correct add/remove/install/uninstall/enable/disable sets across the full desired×actual matrix — no disk |
| `reconcile-no-throw-boundary.test.ts` | a network-failing marketplace add inside reconcile never throws past the `resources_discover` boundary (NFR-5 load exception) |
| `config-containment.test.ts` | config writes refuse paths outside the two allowed config files (NFR-10 extension) |
| `reconcile-lock-discipline.test.ts` | reconcile does not nest the per-scope state lock (no outer guard around orchestrator calls) |
| extend `catalog-uat.test.ts` | byte forms for reconcile-summary + enable/disable rows |
| `config-state-consistency.test.ts` | after a mutating command, config and state agree on desired entries; `--local` writes only the local file entry |
| extend `no-orchestrator-network.test.ts` | `install.ts`/`enable.ts` stay cache-only (no git import surface) even though reconcile may touch network |
| `state-config-split.test.ts` | desired fields absent from `STATE_SCHEMA`; machine fields absent from `CONFIG_SCHEMA` |

---

## Suggested Build Order (dependency-aware)

1. **Persistence foundation (no behavior change):** `config-io.ts` + `config-merge.ts` (schema, load/save, entry-level merge) and `locations.ts` config paths. Pure + atomic-write; unit-testable in isolation. *Blocks everything.*
2. **State split:** carve desired fields out of `STATE_SCHEMA`; decide `schemaVersion`. Independent of reconcile; do early so downstream code reads the final shapes.
3. **Migration:** `migrate-config.ts` (state.json → config on first load). Depends on (1)+(2). Provable in isolation: "first load generates config, uninstalls nothing."
4. **Pure reconcile planner:** `orchestrators/reconcile/plan.ts`. Depends on (1)+(2) shapes only; no I/O. Pin the diff matrix with `reconcile-plan-matrix.test.ts`.
5. **enable/disable orchestrators:** `enable.ts` (← reinstall building blocks) / `disable.ts` (← uninstall cascade). Depends on (1) for config write-back. Independent of the reconciler apply step; can land in parallel with (4).
6. **Reconcile apply + notify:** `apply.ts` (drives existing + new orchestrators serially) + `notify.ts` (catalog grammar). Depends on (4)+(5). Add no-throw-boundary + lock-discipline tests.
7. **Load-time wiring:** modify `index.ts` to invoke `reconcileAtLoad` inside `resources_discover` before `aggregateDiscoveredResources`. Resolve the notify-sink question first (feasibility spike).
8. **Write-back into mutating commands:** thread `writeBackPluginEntry`/`writeBackMarketplaceEntry` + `--local` flag through `add/remove/autoupdate/update/install/uninstall/reinstall/import/bootstrap` inside their existing locked closures. Largest mechanical surface; do last so config shapes are frozen.
9. **NFR amendments + catalog byte forms + architecture tests** in lockstep with the surfaces they cover (not a trailing phase — fold into 6/7/8).

**Why this order:** persistence/shape changes (1–3) are leaf dependencies of everything; the pure planner (4) and enable/disable (5) are independently testable before any wiring; reconcile apply (6) and load wiring (7) sit on top; the broad write-back surface (8) lands last to avoid re-touching commands as config shapes evolve. This mirrors how import was built (planner before executor) and respects the v1.7 saga discipline by keeping the riskiest cross-file changes (write-back + load wiring) on a frozen foundation.

---

## Sources

- Real codebase, `extensions/pi-claude-marketplace/` (HIGH — primary authority):
  - `index.ts` (load-time hook, resources_discover + cwd)
  - `edge/register.ts:75–135` (command wiring, session_start)
  - `orchestrators/discover.ts` (resources_discover aggregator, fs-only)
  - `orchestrators/import/marketplaces.ts` + `import/execute.ts` (D-28 pure planner + effectful executor template; `samePlannedSource`, `buildImportNotificationMarketplaces`)
  - `orchestrators/plugin/install.ts:1–55,168–260` (no-network cache read, orchestrated mode, lock composition); `uninstall.ts:70–148` (cascade, post-commit rm); `reinstall.ts` (cached no-network re-materialize)
  - `transaction/with-state-guard.ts` (withStateGuard, withLockedStateTransaction, per-scope proper-lockfile retries:0)
  - `persistence/state-io.ts` (STATE_SCHEMA, load/save, Compile validator, atomicWriteJson); `migrate.ts` (first-load migration pattern, fire-and-forget); `locations.ts` (ScopedLocations brand, scopeRoot vs extensionRoot, containment helpers)
  - `shared/notify.ts` (catalog grammar surface, MarketplaceNotificationMessage, compareByNameThenScope)
- `.planning/PROJECT.md` (HIGH — milestone scope, locked decisions, NFR catalog, shipped-feature lineage)
- `CLAUDE.md` project + STACK context (HIGH — NFR-1/5/7/10/11, atomic-write + typebox conventions)

---
*Architecture research for: pi-claude-marketplace v1.12 declarative config + load-time reconciler*
*Researched: 2026-06-09*
