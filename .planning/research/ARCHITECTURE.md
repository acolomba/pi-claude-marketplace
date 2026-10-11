# Architecture Research: mcp-4 (Pi 1.0 baseline + pi-mcp-adapter 5 delivery)

**Domain:** Brownfield Pi extension -- retarget the MCP bridge from Pi's `mcp.json` to the adapter-native `mcp-adapter.json`, migrate existing entries on `/reload`, and surface adapter runtime state
**Researched:** 2026-10-01
**Confidence:** HIGH for seams, gates and adapter behavior (read from this repo at `8b6ac3bc` and from the published `pi-mcp-adapter@5.0.0` / `@earendil-works/pi-coding-agent@1.0.0` tarballs). MEDIUM for the hooks/agents naming ripple (depends on a naming decision that is still open).

## Executive Recommendation

Almost all of this milestone lands on seams that already exist. The MCP bridge
(`bridges/mcp/*`) keeps its prepare/commit/abort triplet, its `_piClaudeMarketplace`
marker (MC-5), and its replacement handles. The file it writes changes. The entry
it writes gains adapter fields. The collision walk is rewritten to the adapter's
real precedence. Three things are genuinely new:

1. **A legacy-move step** in reconcile (`orchestrators/reconcile/`), shaped like
   the existing `backfill.ts` sibling step. It calls a new bridge function that
   moves marked entries out of `<scopeRoot>/mcp.json`.
2. **A status tracker** in `platform/` that subscribes to the adapter's
   `pi-mcp-adapter/status/v1` event-bus channel at factory time. It is created in
   `index.ts`, like `createCompletionCache`, and injected through `EdgeDeps` into
   `orchestrators/plugin/info.ts`.
3. **A pure entry translator** in `bridges/mcp/`. It runs the generated name,
   `directTools: "search"`, and Claude-rule variable expansion with adapter
   escaping. Stage and migration share it, so they cannot drift.

Use the file location as the version discriminator. An entry in legacy `mcp.json`
was written by old code and is untranslated. An entry in `mcp-adapter.json` was
written by new code and is translated. Applying the translator exactly once per
move is then structural, with no marker version field and no persisted flag.
COMPAT-01 forbids a new persisted record key without a sanctioned route.

Build order: **floor bump first** (it moves contract pins and peer gates that every
later phase touches). Then the adapter-file foundation, then the translator, then
migration (which needs the final translator). Live status can run in parallel with
migration once the naming is final.

## System Overview (new = `+`, modified = `~`)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ index.ts (entry)                                                               │
│   ~ createMcpStatusTracker(pi.events)  ── factory-time subscribe (before the  │
│     adapter's async init publishes its first snapshot)                         │
│   ~ EdgeDeps gains `mcpStatus` (same route as completionCache)                 │
└──────────┬───────────────────────────────┬───────────────────────────────────┘
           │ resources_discover             │ /claude:plugin info
           ▼                                ▼
┌───────────────────────────────┐  ┌──────────────────────────────────────────┐
│ orchestrators/reconcile/       │  │ orchestrators/plugin/info.ts  ~           │
│  apply.ts ~ per scope:         │  │  joins generated server names to the       │
│   + mcp-migration.ts (FIRST,   │  │  tracker snapshot; manifest arm maps raw   │
│     before applyPlan)          │  │  keys through generatedMcpServerName       │
│   applyPlan / backfill / ...   │  └──────────────┬───────────────────────────┘
└──────────┬────────────────────┘                 │ reads
           │ calls                                ▼
           ▼                         ┌──────────────────────────────────────────┐
┌─────────────────────────────────┐ │ platform/                                  │
│ bridges/mcp/                     │ │  + mcp-status.ts  (consumer-owned mirror,  │
│  ~ stage.ts   → mcp-adapter.json │ │    typebox-checked, latest snapshot only)  │
│     + legacy sweep of own        │ │  ~ pi-api.ts hasLoadedPiMcpAdapter         │
│       entries in mcp.json        │ │    (exclude `builtin:` sources)            │
│  ~ unstage.ts → both files       │ └──────────────────────────────────────────┘
│  ~ collision-slots.ts            │
│     nine-source, last-wins,      │ ┌──────────────────────────────────────────┐
│     overlay-aware (MCPSRC-01)    │ │ domain/name.ts                             │
│  ~ substitute.ts ${VAR:-d} +     │ │  + generatedMcpServerName(plugin, server)  │
│     adapter escaping             │ │    (sibling of generatedAgentName)         │
│  + adapter-entry.ts (translator) │ └──────────────────────────────────────────┘
│  + migrate.ts (legacy move)      │
│  + adapter-doc.ts (JSONC read,   │ ┌──────────────────────────────────────────┐
│     mcpServers|mcp-servers key)  │ │ persistence/locations.ts ~                 │
│  = marker.ts (unchanged, MC-5)   │ │  + mcpAdapterJsonPath                      │
└─────────────────────────────────┘ │  = mcpJsonPath (now legacy: read + sweep)  │
                                    └──────────────────────────────────────────┘
Disk (per scope):  <scopeRoot>/mcp-adapter.json  (+ write target)
                   <scopeRoot>/mcp.json          (~ sweep-only: our marked entries leave)
                   <scopeRoot>/pi-claude-marketplace/state.json (resources.mcpServers renamed)
Event bus:         pi.events "pi-mcp-adapter/status/v1"  (adapter → us, read-only)
```

## Mapping Table: New Behavior → Existing Seam → True Delta

| New behavior | Existing seam that carries it | Delta (what actually changes) |
|---|---|---|
| Write marked entries to `<scopeRoot>/mcp-adapter.json` | `ScopedLocations` path bundle; `prepareStageMcpServers` / `commitPreparedMcp` read-partition-merge-`atomicWriteJson` | **MOD** `persistence/locations.ts`: add `mcpAdapterJsonPath` (hard-coded suffix on `scopeRoot`, same containment-by-construction disposition as `mcpJsonPath`). **MOD** `stage.ts` / `unstage.ts` / `types.ts`: target `mcpAdapterJsonPath`; `StagedMcpRecord.targetPath` follows automatically (W-05). |
| NFR-10 write set | `PROJECT.md` Constraints + `locations.ts` containment comment | The set **grows**, it does not swap: `mcp-adapter.json` is added, and `mcp.json` stays because the legacy move and sweep rewrite it. Retiring `mcp.json` from the write set is a later decision, made after the migration window. |
| Read the adapter file the way the adapter does | `readScopedDoc` + `classifyMcpServers` in `stage.ts` | **NEW** `bridges/mcp/adapter-doc.ts`. (a) JSONC: comments, trailing commas and a BOM are legal in `mcp-adapter.json` (`readValidatedConfig` uses `parseJsonWithComments`). (b) The server map key is `mcpServers` **or** the legacy `mcp-servers`. Write back into whichever key exists, as the adapter's own `writeProjectServerDisabledOverride` does. (c) An unparseable adapter file is **refused**, not "treated as empty and replaced". Today's malformed-overwrite tolerance would destroy the user's `settings`/`imports`/`claudePlugins`. |
| Collision walk = adapter 5 precedence (MCPSRC-01) | `bridges/mcp/collision-slots.ts::loadEffectiveServerNames` | **MOD**: the slot list becomes the adapter's `getConfigSources()` order. The rule becomes LAST-wins (the current code is first-declarer-wins, which is the inversion BACKLOG records). Our own target file sits at position 5 (user) or 9 (project). The ancestor slot (6) appears only when `settings.ancestorConfigRoots` is set in a user-global source. Partial **overlay** entries (no `command`/`url`/`socket`) are not collisions; see Pattern 3. Non-file sources (`pi.mcp` packages, `agentPluginPaths`, `claudePlugins`, runtime registrations, host discovery) are documented as outside the contract. |
| Server name `plugin:<plugin>:<server>`, normalized | `domain/name.ts` generators (`generatedAgentName`, `declaredAgentName`, ...) | **NEW** `generatedMcpServerName(plugin, server)`. Called from the translator. Output must match `[A-Za-z0-9_-]+`: that is the class Pi's `mcp.json` translation accepts and the class the adapter's `sanitizeServerPrefix` leaves unencoded. Otherwise `:` becomes `_3a_` in every tool name. `StagedMcpRecord.generatedName` stops being "== input key". `state.json` picks the new name up through the existing `recorded` hand-off; there is no new state code. |
| `directTools: "search"` | `stampServers` in `stage.ts` | **NEW** field set by the translator. Only on entries the plugin did not set `directTools` on. Whether a plugin-declared value is honored is a FEATURES decision. |
| `${VAR:-default}` parity + escape adapter re-expansion (MENVX-01, ENVLIT-01) | `bridges/mcp/substitute.ts` (bridge-local by design; `shared/vars.ts` owns content substitution and stays untouched) | **MOD** `substitute.ts`: add a Claude-rule expansion pass and an escaping pass for what the adapter would expand again. A leading `!` becomes `!!` in env/secret fields. `${NAME}` / `$env:NAME` / `{env:NAME}` are re-interpolated by `interpolateEnvVars`; for `env`, `literalEnv: true` is the only lever. The rules are a FEATURES/PITFALLS question. Architecturally they live here and nowhere else. |
| Move existing marked entries out of both `mcp.json` files on `/reload` | `applyReconcileWithReader` per-scope loop; `backfill.ts` as the template for a version-agnostic sibling step with its own `withStateGuard` (CR-01: no outer lock, `proper-lockfile` is not re-entrant) | **NEW** `orchestrators/reconcile/mcp-migration.ts` (thin: lock, call bridge, rename record names, `tx.save`). **NEW** `bridges/mcp/migrate.ts` (the move itself, reusing the adapter-doc reader, marker partition, translator, collision walk and replacement-handle rollback). **MOD** `apply.ts`: call it first in each scope, before `applyPlan`, so every later step in the same pass sees the adapter file. |
| A lifecycle op on a not-yet-migrated plugin must not leave a duplicate | `unstageMcpServers` (marker-keyed, not name-keyed) and the replacement handles in `stage.ts` | **MOD** unstage sweeps own marked entries from BOTH files. **MOD** stage commit also removes this plugin's own marked entries from legacy `mcp.json`. After the rename, a leftover legacy copy has a DIFFERENT name and both copies would run. The replacement handle snapshots two files instead of one. |
| Prune rollback covers the new file | `orchestrators/plugin/prune-rollback.ts` snapshots `locations.mcpJsonPath` | **MOD**: snapshot `mcpAdapterJsonPath` too (unstage now writes both). |
| Live adapter runtime status in `info` | `GetPluginInfoOptions` already threads `pi: ToolInventory`; `HookSummaryEntry` is the precedent for a richer per-component entry; the `EdgeDeps` → handler route is how `completionCache` reaches handlers | **NEW** `platform/mcp-status.ts` (tracker). **MOD** `index.ts` (create + inject), `orchestrators/edge-deps.ts`, `edge/handlers/plugin/info.ts`, `orchestrators/plugin/info.ts` (join), `shared/notification-types.ts` (`components.mcp` → entry with optional runtime token), `shared/notification-grammar.ts` (render), `docs/output-catalog.md`. |
| Adapter-only detection | `platform/pi-api.ts::hasLoadedPiMcpAdapter` (RH-4) | **MOD**: ignore tools whose source is Pi's built-in (`sourceInfo.source`/`path` with the `builtin:` prefix, `BUILTIN_PATH_PREFIX` in Pi 1.0 `core/source-info.d.ts`). Keep the `name === "mcp"` arm only for a non-builtin source. `ToolInventoryItem` widens by `sourceInfo.path` if the check needs it. The marker vocabulary (`{requires pi-mcp}`) does not change. |
| Pi 1.0 floor | `platform/pi-api.ts` (sole Pi import site), `tests/architecture/peer-floor.test.ts`, `scripts/check-unused-type-members.contracts.json` external-mirror pins | Re-apply `74162ca6` (typing + pins), `5b1d8ef6`/`dac3a245`/`69e0870a` (pi-subagents peer tests), `4f82096f` (Stop canary) at `>=1.0.0`. Mechanical, but it moves pins that later phases also move. |
| Hooks and agents that name MCP tools | `domain/components/hooks/matcher.ts` keeps `mcp__<S>__<T>` literals; `bridges/agents/convert.ts` drops `mcp__*` tool tokens and points users to pi-subagents `mcp:<server>` overrides | **No code change is required for the listed features.** The rename changes the names users type in `/mcp-adapter`, pi-subagents `mcp:<server>` overrides and approvals. Literal hook matchers do not match adapter tool names today, and still will not. See the open decision under "Integration Points". |

## Component Responsibilities

### New

| Component | File | Responsibility | Talks to |
|---|---|---|---|
| Adapter doc model | `bridges/mcp/adapter-doc.ts` | JSONC-tolerant read of `mcp-adapter.json`; `mcpServers` vs `mcp-servers` key selection; refuse-not-replace on unparseable input; preserve every other top-level key (`settings`, `imports`, `claudePlugins`) verbatim | `stage.ts`, `unstage.ts`, `migrate.ts`, `collision-slots.ts` |
| Entry translator | `bridges/mcp/adapter-entry.ts` | Pure: `(sourceKey, entry, ctx) → { name, entry, warnings }`. Composes `substituteAndInject`, the variable-expansion/escape pass, `generatedMcpServerName`, and adapter defaults (`directTools: "search"`). The marker is NOT applied here; the caller stamps it, as today | `stage.ts::stampServers`, `migrate.ts` |
| Legacy move | `bridges/mcp/migrate.ts` | Given `ScopedLocations` + `cwd`: read legacy `mcp.json`, take every marked entry, translate, collision-check against the new walk, write `mcp-adapter.json` then `mcp.json`, return `{ renamed: Map<(mp,plugin), old→new[]>, skipped, warnings }`. Owns a two-file rollback via the replacement-handle pattern | reconcile `mcp-migration.ts` |
| Reconcile migration step | `orchestrators/reconcile/mcp-migration.ts` | Per scope, under its own `withStateGuard`: pristine gate (no `state.json` → skip, WR-05), call `migrateLegacyMcpEntries`, rewrite `resources.mcpServers` names of the affected records, `tx.save()` through `saveState` (SPLIT-02). Coerce throws into `invalid-block`-style outcomes (WR-01 isolation) | `apply.ts`, `bridges/mcp`, `transaction/with-state-guard.ts` |
| Status tracker | `platform/mcp-status.ts` | `createMcpStatusTracker(events: McpStatusEventSource)`: subscribe to `"pi-mcp-adapter/status/v1"`, validate the payload with a typebox schema of ONLY the fields we read, keep the latest snapshot, expose `lookup(name) → runtime state | "unknown"` and `received: boolean`. Holds the unsubscribe and drops it on `session_shutdown` | `index.ts` (creates), `info.ts` (reads) |
| MCP name generator | `domain/name.ts::generatedMcpServerName` | The one place the Claude Code `plugin:<plugin>:<server>` key is normalized into the adapter-safe name | translator, `info.ts` manifest arm |

### Modified

| Component | File | Change |
|---|---|---|
| Path bundle | `persistence/locations.ts` | `+ mcpAdapterJsonPath`; doc comment marks `mcpJsonPath` as legacy (read + sweep only) |
| Stage | `bridges/mcp/stage.ts` | Target the adapter file; overlay-aware partition; translator call; two-file commit/rollback (adapter write + legacy sweep of own entries) |
| Unstage | `bridges/mcp/unstage.ts` | Sweep own marked entries from both files; the legacy file tolerates malformed input with a warning (it is no longer the authoritative store) |
| Collision walk | `bridges/mcp/collision-slots.ts` | Nine-source list, last-wins, overlay-aware, owning-path reporting corrected; rewrite of the "four slots" MC-4/RN-5 contract text |
| Substitution | `bridges/mcp/substitute.ts` | `${VAR:-default}` expansion and adapter escaping |
| Types | `bridges/mcp/types.ts` | `RawMcpDoc` gains the server-key discriminant; `StagedMcpRecord.generatedName` doc; replacement internals hold two `oldText`s |
| Reconcile apply | `orchestrators/reconcile/apply.ts` | Call the migration step first in each scope |
| Prune rollback | `orchestrators/plugin/prune-rollback.ts` | Snapshot `mcpAdapterJsonPath` as well |
| Info | `orchestrators/plugin/info.ts` | Manifest arm maps raw keys through `generatedMcpServerName` so both arms show the same names; join runtime state from the injected tracker |
| Edge wiring | `orchestrators/edge-deps.ts`, `edge/register.ts`, `edge/handlers/plugin/info.ts`, `index.ts` | Thread `mcpStatus` the way `completionCache` is threaded |
| Notification vocabulary | `shared/notification-types.ts`, `shared/notification-grammar.ts`, `docs/output-catalog.md` | `components.mcp` becomes an entry list carrying an optional runtime token; the renderer formats it; the catalog is amended deliberately |
| Detection | `platform/pi-api.ts` | Adapter-only probe; Pi 1.0 typing |

### Unchanged (deliberately)

`bridges/mcp/marker.ts` (MC-5 key and shape: a byte-stable user contract), `bridges/mcp/safe-set.ts`, `domain/mcp-resolution.ts` (it still resolves raw plugin servers; naming is a stage-time concern), `shared/vars.ts`, `transaction/*`, the state schema (`resources.mcpServers: string[]` keeps its shape, and only its values change).

## Recommended Project Structure (delta only)

```text
extensions/pi-claude-marketplace/
├── bridges/mcp/
│   ├── adapter-doc.ts        # + JSONC read, server-key alias, refuse-not-replace
│   ├── adapter-entry.ts      # + pure translator shared by stage and migrate
│   ├── migrate.ts            # + legacy mcp.json → mcp-adapter.json move
│   ├── collision-slots.ts    # ~ nine-source, last-wins, overlay-aware
│   ├── stage.ts              # ~ new target, two-file commit, translator
│   ├── unstage.ts            # ~ sweep both files
│   ├── substitute.ts         # ~ ${VAR:-default} + adapter escaping
│   ├── types.ts              # ~
│   ├── marker.ts             # = MC-5 unchanged
│   └── index.ts              # ~ export migrateLegacyMcpEntries
├── domain/name.ts            # ~ + generatedMcpServerName
├── orchestrators/reconcile/
│   ├── mcp-migration.ts      # + per-scope locked step
│   └── apply.ts              # ~ call it first
├── orchestrators/plugin/{info,prune-rollback}.ts   # ~
├── orchestrators/edge-deps.ts                      # ~ + mcpStatus
├── persistence/locations.ts  # ~ + mcpAdapterJsonPath
├── platform/
│   ├── mcp-status.ts         # + event-bus tracker
│   └── pi-api.ts             # ~ Pi 1.0 types, adapter-only probe, McpStatusEventSource view
└── index.ts                  # ~ create tracker, inject
tests/ mirrors every new module (test:corresponding requires pairs)
```

### Structure Rationale

- **The move belongs in `bridges/mcp/`, the trigger in `orchestrators/reconcile/`.**
  Only the bridge knows the marker, the partition, the adapter document shape and
  the rollback handles. Reconcile owns "when" and the `state.json` write. This
  matches the fallow zones (orchestrators → bridges-mcp is allowed; bridges-mcp →
  persistence/domain/shared/platform is allowed) and keeps `reconcile/plan.ts` pure
  (RECONCILE_PURITY_TARGETS).
- **The tracker belongs in `platform/`.** It is the only module that knows an
  external extension's event channel name and payload shape. That is the same job
  `pi-api.ts` does for Pi, and `platform` → `shared` is the only import it needs.
  Do not import from `pi-mcp-adapter`. Its `.` export is TypeScript source that
  pulls in `@earendil-works/pi-ai` (whose peer range stops at `^0.99.0`, the
  recorded upstream gap). Even a type-only import turns a soft dependency into a
  build dependency.
- **The translator is its own module** because two callers need the identical
  transform and `stage.ts` (436 lines) already sits near the fallow
  `maxUnitSize: 60` / cognitive-15 ceilings per function.

## Architectural Patterns

### Pattern 1: File location is the version discriminator

**What:** Entries in legacy `mcp.json` are untranslated by construction (old code
wrote them). Entries in `mcp-adapter.json` are translated by construction. The
migration translates exactly the entries it moves, once.
**When to use:** Any transform that is not idempotent. `!` → `!!` escaping is the
example: applied twice it gives `!!!`.
**Trade-offs:** No marker field or persisted flag is needed, so COMPAT-01's
persisted-key clause stays quiet and MC-5 stays byte-stable. The cost: the
translator must also be total over legacy entries. The old stage already
substituted `${CLAUDE_*}`, so the expansion pass must accept an
already-substituted entry. It does, because the substituted values are absolute
paths that contain no `${`.

### Pattern 2: One translator, two callers

**What:** `stampServers` (stage) and `migrateLegacyMcpEntries` call the same pure
`translateForAdapter`. The marker is stamped by the caller afterwards, as today
("the marker never enters the walk", D-92-01).

```typescript
// bridges/mcp/adapter-entry.ts (shape, not final code)
export function translateForAdapter(
  plugin: string,
  sourceKey: string,
  entry: Record<string, unknown>,
  ctx: McpSubstitutionContext,
): { readonly name: string; readonly entry: Record<string, unknown>; readonly warnings: readonly string[] } {
  const name = generatedMcpServerName(plugin, sourceKey);
  const expanded = expandAndEscape(substituteAndInject(entry, ctx)); // substitute.ts
  return { name, entry: withAdapterDefaults(expanded), warnings: [] };
}
```

**Trade-offs:** The legacy move needs `pluginRoot`/`pluginData` for the
substitution context, but legacy entries are already substituted. Give the move
a context-free variant (expansion/escape + name + defaults only) instead of
reconstructing paths. Name the two entry points distinctly so a reviewer sees
which steps run on which path.

### Pattern 3: Overlay-aware ownership partition

**What:** `mcp-adapter.json` is a shared file. The adapter itself writes into it:
`/mcp-adapter disable` adds `disabled: true` to the project file, and panel Save
persists `directTools` changes. Both use `{ ...existing, field }`, so the adapter
can modify OUR marked entry in place (the marker survives the spread), and it can
add an unmarked partial entry under our name in the other scope's file.
**Rules:**
- A same-name entry with no transport key (`command`/`url`/`socket`) is an
  **overlay**, not a collision. Neither the stage collision check nor the
  partition's `theirs` arm may throw on it.
- On re-stage (update/reinstall/enable), carry forward adapter-owned user
  preference fields from our existing marked entry (at minimum `disabled`;
  decide on `directTools`, `includeTools`, `excludeTools`, `approveTools`).
  Otherwise an update silently re-enables a server the user disabled.
- On unstage, drop the whole marked entry, overlay fields included (the plugin
  is gone). Leave unmarked overlays in the other file alone. They are the
  user's, and the adapter ignores an overlay with no base.

**Trade-offs:** The field list is a contract with the adapter. Record it with a
decision ID and pin it against `ServerEntry` in the adapter's `types.ts`.

### Pattern 4: Consumer-owned mirror of an external event, injected, not global

**What:** `platform/pi-api.ts` already declares consumer-owned views
(`ToolInventory`, `NotificationContext`). Add `McpStatusEventSource { on(channel,
handler): () => void }` (structurally satisfied by Pi's `EventBus`). The tracker
owns a typebox schema with only `servers[].name`, `.status`, `.disabled`, and
`blockedReason`/`failedAgoSeconds` if rendered. `version` is checked against
`1`. The tracker is created once in the factory and passed down, the same as
`createCompletionCache()`. There is no module-global and no `_setForTest` seam
(no-test-only-production-surface).
**When:** Any cross-extension read-only data.
**Trade-offs:** Mirroring only the read fields keeps `lint:type-members` from
demanding `external-input` pins for `totalTools`, `listenState` and the other
unread fields. The snapshot is push-only: there is no "give me the current state"
request. Hence factory-time subscription, and an explicit `"unknown"` when no
snapshot has arrived. The adapter withholds its first snapshot until direct-tool
sync finishes, so an early `info` races it, and an empty snapshot arrives on
session shutdown.

### Pattern 5: Names are generated in `domain/name.ts`, consumed everywhere else

**What:** As with `generatedAgentName`/`declaredAgentName`, the MCP server name
is minted in one domain function. `stage.ts` records it (W-05 `recorded`),
`state.json` stores it, `info.ts` displays it (both arms), and the tracker
lookup joins on it.
**Trade-offs:** `info`'s state-only arm already says "MCP servers are the sole
exception by data shape, holding their raw source keys". After this milestone
that sentence is false and must be rewritten. The two arms then agree for the
first time.

## Data Flow

### Install / update / reinstall / enable (modified)

```text
mcpPhase (install-outcome.ts) / update-swap.ts / reinstall-replace.ts
  → prepareStageMcpServers(input)
      read mcp-adapter.json (adapter-doc: JSONC, key alias; unparseable → refuse)
      partition: ours (marker) | overlays | theirs
      translate each server (adapter-entry) → generated names
      collision walk (nine sources, last-wins, overlay-aware)   ── throws McpServerCollisionError
      read legacy mcp.json → own marked entries to sweep (tolerant)
      build next adapter doc + next legacy doc IN MEMORY
  → commitPreparedMcp: atomicWriteJson(adapter) then atomicWriteJson(legacy, only if it changed)
  → recorded[].generatedName → state.json resources.mcpServers (unchanged plumbing)
```

### `/reload` legacy move (new)

```text
resources_discover → applyReconcile → for scope in [project, user]:
  readPassForScope (unchanged)
  + applyMcpMigrationForScopeIsolated            (WR-01 isolation, own lock)
      no state.json → skip (WR-05, no unsolicited files)
      legacy mcp.json absent / no marked entries → return (RECON-05: zero writes)
      bridges/mcp/migrate.ts:
        snapshot both files (replacement handles)
        write mcp-adapter.json (moved + translated)       ┐ crash here → next /reload
        write mcp.json without moved entries             ┘ finds the same marked entries,
                                                           re-translates to the same names,
                                                           partition sees them as "ours" → idempotent
      rename resources.mcpServers in affected records → tx.save()
      failure → restore snapshots, structured outcome row
  applyPlan / backfill / routing rebuild (unchanged order after it)
```

Orphans: a marked legacy entry whose `(plugin, marketplace)` has no record in
that scope. Recommend leaving it in place with a warning: moving an entry no
record owns makes it unremovable by any lifecycle op. This is a decision to
record.

### `info` runtime status (new)

```text
factory: tracker = createMcpStatusTracker(pi.events)   ← adapter publishes after init, on change, on shutdown
/claude:plugin info p@m → edge handler (deps.mcpStatus) → getPluginInfo({..., mcpStatus})
  names = record.resources.mcpServers  |  manifest keys → generatedMcpServerName
  entry = { name, runtime: tracker.lookup(name) }    // connected | cached | failed | needs-auth |
                                                     // not-connected | blocked | disabled | unknown
  softDepStatus(pi).piMcpAdapterLoaded === false → no runtime token; the existing {requires pi-mcp} path applies
```

The status data is display-only. It is never persisted and never decides
severity. Severity stays with the command (memory: "notify.ts is a dumb
renderer").

## Architecture Gates That Will Fire

| Gate | Fires because | Do this |
|---|---|---|
| `tests/architecture/peer-floor.test.ts` | Literal `">=0.86.1"` | Update the literal and the lock in the floor phase (as `74162ca6` did for 0.99.2) |
| `npm run lint:type-members` + `scripts/check-unused-type-members.contracts.json` | `external-mirror` pin `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:414:5` moves on 1.0. Line:col pins in `platform/pi-api.ts` (100, 106-108, 124), `persistence/locations.ts:41`, `bridges/mcp/stage.ts` (49, 371, 416), `bridges/mcp/types.ts:94` shift with any edit above them | Run prettier first, then repin by shifting the LINE only (memory: prettier invalidates pins). New mirror interfaces declare only the fields that are read |
| Same gate, `UNUSED_TYPE_MEMBER_GATE_TARGETS` (includes `orchestrators/edge-deps.ts`) | New `EdgeDeps.mcpStatus` member | It must be read on a production path (the info handler) |
| `no-orchestrator-network.test.ts` / `NETWORK_FREE_TARGETS` | `info.ts` and reconcile `pending/plan/notify` are targets | The tracker and the migration modules name no git surface. Consider registering `reconcile/mcp-migration.ts` in `NETWORK_FREE_TARGETS` (full literal path, D-07-05/D-07-06) |
| `reconcile-planner-purity.test.ts` | Anything I/O in `plan.ts` | The migration is a sibling step in `apply.ts`, never in the planner |
| `import-boundaries.test.ts` + fallow `boundaries` | New cross-zone edges | `entry → platform` (tracker), `orchestrators → bridges-mcp` (migration), `bridges-mcp → domain` (name generator): all allowed. The tracker must not import `orchestrators/` |
| `config-state-write-seams.test.ts` | The migration rewrites record names | Through `withStateGuard`/`tx.save` → `saveState` only, never `atomicWriteJson(stateJsonPath)` |
| `compat-01-no-expansion.test.ts` | Any new `Reason`/`StatusToken`/glyph, any grammar-owner declaration growth, any persisted record key | The runtime token is a new sub-vocabulary on the info component line, NOT a `StatusToken`. A new reason for a migration failure would amend `Reason`. Either is a deliberate amendment with a decision ID and an output-catalog edit. Do not add a record key |
| `notify-closed-set-locks`, `closed-set-enrollment`, `messaging-guide-doc-pins`, `VOCABULARY_GUARD_DOC_TARGETS` | `components.mcp` shape and rendering change | Amend `docs/output-catalog.md` with the code |
| `integration-materialization-gate.test.ts` | Reads `locations.mcpJsonPath` after commit | Point it at `mcpAdapterJsonPath` |
| `tests/bridges/mcp/collision-slots.test.ts` (frozen slot order snapshot) | Deliberate reorder (BACKLOG: "a deliberate reorder plus a comment rewrite plus a snapshot update") | Rewrite with the nine-source order and last-wins assertions |
| `tests/e2e/install-soft-deps.test.ts` | Mocks `{ name: "mcp", sourceInfo: { source: "pi-mcp-adapter" } }` | Must stay green under the adapter-only probe; add a `builtin:` negative case |
| `no-test-only-production-surface.test.ts` | A test hook on the tracker | Inject the event source instead |
| `test:corresponding` | Each new `extensions/**` module | Add paired tests |
| `workflows-doc-pins.test.ts`, `workflows-marker-coverage.test.ts` | Touched by `74162ca6` (Pi version prose) | Re-apply with the 1.0 numbers |
| fallow `health` (cognitive 15, unit 60) and ESLint `sonarjs/cognitive-complexity` 15 | `stage.ts` growth (two-file commit, overlay carry-forward) | Extract into `adapter-doc.ts` / `adapter-entry.ts` up front, not after a red run |

## Suggested Build Order

| # | Phase | Depends on | Contents | Why here |
|---|---|---|---|---|
| 1 | **Pi 1.0 floor + adapter-only detection** | -- | Peer/dev bumps (Pi, pi-tui, pi-subagents `>=0.74.0`, all devDeps); re-apply `74162ca6`, `5b1d8ef6`, `dac3a245`, `69e0870a`, `4f82096f` at 1.0; repin contracts; workflow-engine 3.13.1 canary on Pi 1.0; `hasLoadedPiMcpAdapter` adapter-only; document `pi-mcp-adapter >=5.0.0` as the MCP soft dependency (decide optional-peer vs docs-only); record the `@earendil-works/pi-ai ^0.99.0` peer gap | Moves pins and gates every later phase touches; detection lives in the same file (`pi-api.ts`), so the pins move once |
| 2 | **Adapter-file foundation** | 1 | `mcpAdapterJsonPath`; `adapter-doc.ts`; stage/unstage retarget; legacy sweep in stage and unstage; overlay-aware partition + carry-forward; nine-source collision walk (closes MCPSRC-01); prune-rollback snapshot; NFR-10 text | Highest-risk core. It must be correct before any entry content changes, so failures stay attributable |
| 3 | **Entry translation** | 2 | `generatedMcpServerName`; `adapter-entry.ts`; `directTools: "search"`; `${VAR:-default}` + escaping (closes MENVX-01, ENVLIT-01); info manifest-arm name mapping | Fixes what "translated" means before the migration bakes it into users' files |
| 4 | **Auto migration** | 2, 3 | `bridges/mcp/migrate.ts`; `reconcile/mcp-migration.ts`; `apply.ts` ordering; record renames; outcome/notify wording | Needs the final translator (Pattern 1 relies on running it exactly once) |
| 5 | **Live status in `info`** | 1 (event bus types), 3 (final names for the join) | `platform/mcp-status.ts`; `EdgeDeps` wiring; info join; grammar + catalog amendment | Independent of 4; can run in parallel with it |
| 6 | **Close-out** | all | `docs/env-vars.md` (ENVDOC-01 overlap), README/docs NFR-10 text, live UAT canary: real adapter 5 reads our `mcp-adapter.json`, `/reload` migration on a seeded legacy file, `info` shows `connected`/`cached` | Live proof that the adapter accepts what we write; unit tests can only prove we wrote it |

Research flags: Phase 3 (the exact Claude Code normalization and expansion
rules, the escape set) and Phase 2 (the overlay carry-forward field list)
need targeted research. Phase 1 and Phase 5 follow established patterns.

## Anti-Patterns

### Treating an unparseable `mcp-adapter.json` as empty

**What people do:** Reuse `readScopedDoc`'s "malformed → `{}` → overwrite with a
warning" tolerance.
**Why it's wrong:** The adapter accepts JSONC. A file with one comment is valid to
the adapter and "malformed" to `JSON.parse`. Overwriting it deletes the user's
`settings`, `imports`, `claudePlugins` and every hand-written server.
**Do this instead:** Parse JSONC. If parsing still fails, refuse with a typed error
and write nothing.

### Writing `mcpServers` next to an existing `mcp-servers`

**Why it's wrong:** The adapter reads `raw.mcpServers ?? raw["mcp-servers"]`. Adding
`mcpServers` hides every server under the legacy key.
**Do this instead:** Write into whichever key exists, and choose `mcpServers` only
when neither does.

### Delivering through the adapter's `claudePlugins` option or Pi's `registerMcpServer()`

**Why it's wrong:** `claudePlugins` reads only the root `.mcp.json` (not inline
`mcpServers` or custom paths), keeps names as written, has no `CLAUDE_PLUGIN_DATA`,
sits below every normal source, and a higher-precedence `claudePlugins` array
REPLACES a lower one, which would clobber the user's own. `registerMcpServer()`
servers are proxy-only (no `directTools: "search"`). PROJECT.md already rejects
the latter.
**Do this instead:** Write full translated entries into `mcp-adapter.json`.

### A migration flag in `state.json` or in the marker

**Why it's wrong:** It trips COMPAT-01's persisted-key clause and changes a
byte-stable MC-5 contract, for information the file location already carries.

### Moving the snapshot cache into `shared/` as a module global

**Why it's wrong:** It is process-lifetime state with an external lifecycle
(reload, shutdown). Conventions prefer an injected collaborator, and a global
invites a test seam.

### Name-keyed unstage

**Why it's wrong:** After the rename, legacy and new copies have different names.
**Do this instead:** Stay marker-keyed (MC-5), as today. That is why unstage needs
no rename awareness.

## Integration Points

### External

| Service | Integration pattern | Notes |
|---|---|---|
| pi-mcp-adapter 5 config loader | Files: we write `<agentDir>/mcp-adapter.json` (precedence 5) and `<cwd>/.pi/mcp-adapter.json` (precedence 9); `/reload` re-reads | Merge is **per field** (`mergeServerMaps`), so a same-name full definition elsewhere merges with ours rather than replacing it (except transport switches, which strip the other transport's fields). Project-file servers need project trust plus a per-definition approval. A rename or a `directTools` change re-prompts. OAuth credentials are keyed by server name: **the rename forces re-sign-in** for OAuth servers |
| pi-mcp-adapter status channel | `pi.events.on("pi-mcp-adapter/status/v1", h)`; payload `{version:1, servers:[{name,status,toolCount,directToolCount,disabled,listenState,...}], ...}` | Statuses: `connected`, `cached`, `failed`, `needs-auth`, `not-connected`, `blocked`, `disabled`. Adapter 5 stops lazy servers after discovery, so `cached`/`not-connected` is the normal resting state, not a fault |
| pi-mcp-adapter as a concurrent writer | It rewrites `mcp-adapter.json` with tmp+rename under no lock we share | Lost-update window between our read and our rename. Keep the read-modify-write span short (read inside commit, not at prepare time), or accept and document it. Our `proper-lockfile` guard serializes only our own processes |
| Pi 1.0 | `pi.events` (`EventBus.on` returns an unsubscribe), `SourceInfo` with `builtin:` paths, `getAllTools()` | Built-in MCP is turned off by adapter 5 (`-builtin:mcp`); when the adapter is absent and the built-in is on, the built-in serves only Pi's `mcp.json`, which no longer contains our entries after migration. Detection must therefore report `{requires pi-mcp}` |
| Project config dir | We hard-code `<cwd>/.pi`; the adapter uses `getConfigDirName()` (`piConfig.configDir`) | Same CFGDIR-01 gap as today; not widened by this milestone |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| reconcile `apply.ts` ↔ `mcp-migration.ts` | Direct call, own lock (CR-01) | Runs before `applyPlan` in each scope; WR-01 isolation |
| `mcp-migration.ts` ↔ `bridges/mcp/migrate.ts` | Barrel export | Bridge returns the rename map; orchestrator writes state |
| stage ↔ legacy sweep | Same prepare/commit, two-file replacement handle | Rollback restores both files |
| `index.ts` → `EdgeDeps` → info handler → `info.ts` | Injected tracker | Mirrors `completionCache` |
| hooks matchers / agents tool tokens ↔ adapter tool names | None today | **Open decision.** Literal `mcp__<S>__<T>` matchers (`domain/components/hooks/matcher.ts`) compare against Pi's `event.toolName`, which under the adapter is `mcp` (proxy) or `<prefix>_<tool>` (direct, default prefix = sanitized server name). They do not match today. Exact Claude names are reachable with a per-entry `toolPrefix: "mcp"` plus a server name that ends in `_`: `formatToolName` yields `mcp__<server>_<tool>`, so server `plugin_<p>_<s>_` gives `mcp__plugin_<p>_<s>__<tool>`. If Claude Code's plugin tool form is `mcp__plugin_<p>_<s>__<tool>` (MEDIUM: assumed, not re-verified this session; confirm with `claude-code-compat-research`), that would make matchers, `PreToolUse` `tool_name`, and agent `tools:` tokens line up with no translation layer. Not in the listed features. Decide at naming time, because changing names twice costs users two OAuth re-sign-ins |

## Open Questions for Requirements

1. Overlay carry-forward field list (`disabled` at least; `directTools`/`includeTools`/`excludeTools`/`approveTools`?).
2. Orphan marked legacy entries (no owning record in scope): leave with a warning (recommended) or move.
3. Whether a successful migration is silent (RECON-05 style) or announced once, given that it can force OAuth re-sign-in and project re-approval.
4. Whether to adopt the exact-Claude tool-name alignment (the `toolPrefix: "mcp"` + trailing-`_` naming) as part of "upstream server naming".
5. `pi-mcp-adapter` as an optional peer dependency (pi-subagents precedent) or docs-only.
6. When `mcp.json` leaves the NFR-10 write set (a future milestone, after the migration window).

## Sources

- Repo at `8b6ac3bc` (features/mcp-4): `bridges/mcp/{stage,unstage,collision-slots,marker,substitute,safe-set,types,index}.ts`, `persistence/locations.ts`, `platform/pi-api.ts`, `orchestrators/reconcile/{apply,backfill}.ts`, `orchestrators/plugin/{info,prune-rollback}.ts`, `index.ts`, `domain/name.ts`, `domain/components/hooks/matcher.ts`, `bridges/agents/convert.ts`, `.fallowrc.json`, `scripts/check-unused-type-members.contracts.json`, `tests/architecture/{peer-floor,gate-targets,compat-01-no-expansion,config-state-write-seams,integration-materialization-gate}.test.ts` -- HIGH
- `.planning/BACKLOG.md` MCPSRC-01, MENVX-01, ENVLIT-01, ENVDOC-01, CFGDIR-01 -- HIGH (cross-checked against 5.0.0 source)
- `pi-mcp-adapter@5.0.0` tarball: `docs/configuration.md` (file layout, nine-source precedence, built-in replacement, project trust), `docs/extension-api.md` (Runtime status snapshots, runtime registration, `claudePlugins`), `docs/tools.md` (`directTools: "search"`), `config.ts` (`getConfigSources`, `mergeServerMaps`, `translatePiMcpServer`, `readValidatedConfig` JSONC, `writeProjectServerDisabledOverride`), `types.ts` (`MCP_STATUS_EVENT`, `McpStatusSnapshot`, `formatToolName`, `sanitizeServerPrefix`), `mcp-status.ts`, `index.ts` (publication timing), `utils.ts` (`interpolateEnvVars`, `resolveCommandSecret`), `CHANGELOG.md` 5.0.0 -- HIGH
- `@earendil-works/pi-coding-agent@1.0.0` tarball: `dist/core/source-info.d.ts` (`BUILTIN_PATH_PREFIX`), `dist/core/event-bus.d.ts`, `dist/core/extensions/types.d.ts` (`events`, `registerMcpServer`), `dist/extensions/mcp/*` (the built-in registers no tool named `mcp`), `CHANGELOG.md` (`builtin:<name>` naming) -- HIGH
- Commits `74162ca6`, `5b1d8ef6`, `dac3a245`, `69e0870a`, `4f82096f` (file lists only) -- HIGH for scope, not re-verified against 1.0

---
*Architecture research for: mcp-4 (MCP 4)*
*Researched: 2026-10-01*
