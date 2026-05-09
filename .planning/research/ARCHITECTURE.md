# Architecture Research

**Domain:** Per-user CLI extension that bridges plugin manifests into a host runtime (Pi extension delivering Claude plugin marketplaces) **Researched:** 2026-05-09 **Confidence:** HIGH for V1-carry-forward decisions (read directly from V1 source on `features/initial`); MEDIUM-to-HIGH for successor-divergence recommendations (verified against Pi API d.ts + ecosystem patterns); LOW where explicitly flagged.

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────┐
│                       Pi Host Runtime                            │
│   (registers commands, fires events, exposes pi.getAllTools())   │
└───────────┬───────────────────────────────────┬──────────────────┘
            │                                   │
            │ slash command dispatch            │ resources_discover
            ▼                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Edge Layer                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐      │
│  │ Router       │ │ Completions  │ │ Discovery handler    │      │
│  │ (parses sub- │ │ (subcommand  │ │ (returns staged      │      │
│  │  command)    │ │  + value)    │ │  skill/prompt dirs)  │      │
│  └──────┬───────┘ └──────────────┘ └──────────────────────┘      │
└─────────┼────────────────────────────────────────────────────────┘
          │ delegated by feature key (install/update/...)
          ▼
┌──────────────────────────────────────────────────────────────────┐
│                Feature Orchestrators (Use Cases)                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐    │
│  │ Marketplace family   │    │ Plugin family                │    │
│  │  add / rm / list /   │    │  install / uninstall /       │    │
│  │  update / autoupdate │    │  update / list               │    │
│  └──────────┬───────────┘    └──────────┬───────────────────┘    │
│             │                            │                       │
│             └────────┬───────────────────┘                       │
│                      ▼                                           │
│              ┌────────────────┐                                  │
│              │ Transaction    │  withStateGuard(locations, fn)   │
│              │ Coordinator    │  + Phase ledger + Rollback       │
│              └────────┬───────┘                                  │
└───────────────────────┼──────────────────────────────────────────┘
                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Resource Bridges (Stagers)                    │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌───────────────────┐  │
│  │ Skills   │ │ Prompts  │ │ Agents     │ │ MCP servers       │  │
│  │ stager   │ │ stager   │ │ (with idx, │ │ (merge into       │  │
│  │          │ │          │ │  soft-dep) │ │  mcp.json, marker)│  │
│  └────┬─────┘ └────┬─────┘ └─────┬──────┘ └────────┬──────────┘  │
└───────┼────────────┼─────────────┼─────────────────┼─────────────┘
        ▼            ▼             ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                         Domain Core                              │
│  Resolver (discriminated installable union) │ Manifest parser    │
│  Source parser (github/path)                │ Locations brand    │
│  Validation (assertSafeName, assertPathInside)                   │
└────────┬─────────────────────────────────────────────────────────┘
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Persistence & I/O Layer                        │
│  state.json │ agents-index.json │ resources/skills,prompts/      │
│  data/<mp>/<plg>/ (CLAUDE_PLUGIN_DATA) │ sources/<mp>/ (clones)  │
│  staging/ │ agents-staging/ │ ../agents/ │ ../mcp.json           │
│  All writes go through atomicWriteJson / tmp+rename helpers      │
└──────────────────────────────────────────────────────────────────┘
         │                                   │
         ▼                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│              Out-of-extension Bridge Files (Soft Deps)           │
│  <scopeRoot>/agents/   ← pi-subagents reads (probed via tools)   │
│  <scopeRoot>/mcp.json  ← pi-mcp-adapter reads (probed via tools) │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component                  | Responsibility                                                                                                                                  | Implementation                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Edge layer                 | Parse `/claude:plugin <sub>...`, return tab completions, answer `resources_discover`                                                            | Thin handlers; no I/O beyond `pathExists`; one router per command surface |
| Feature orchestrators      | One per use case (`installPlugin`, `updatePlugin`, `removeMarketplace`, ...) -- own ordering, error wrapping, severity, reload-hint composition | Pure async functions taking `ScopedLocations` + a typed input record      |
| Transaction coordinator    | `withStateGuard` (re-load → mutate → save-or-throw) + phase ledger that aggregates rollback failures + leak descriptors                         | Generic helpers in `transaction/` and `errors.ts`                         |
| Resource bridges (stagers) | Per-component-class staging logic with prepare/commit/abort split (agents and mcp) or stage/move (skills/prompts)                               | Each bridge owns its tmp dir, marker discipline, and unstage path         |
| Domain core                | Resolver that emits a discriminated \`installable: true                                                                                         | false\` union, manifest parser, source parser, name/path validation       |
| Persistence layer          | `state.json` (single-file per scope), agents index (in-extension, per-scope), out-of-extension bridge files (`agents/`, `mcp.json`)             | All writes via `atomicWriteJson` or tmp+rename; ENOENT swallowed at read  |
| Soft-dep probes            | `hasLoadedPiSubagents`, `hasLoadedPiMcpAdapter` -- query Pi at decision time                                                                    | Pull via `pi.getAllTools()` (no push events available in Pi API)          |

## Recommended Project Structure

V1 already uses a mode that mixes feature-vertical (`marketplace/`, `plugin/`, `agent/`, `mcp/`) with shared layers (`commands/`, `state/`, `transaction/`, `presentation/`, `validation.ts`, etc.). The successor should keep the spirit and tighten the seams. The recommendation is **feature-vertical for use cases, layered for cross-cutting concerns** -- i.e. ports-and-adapters around a vertical-slice core.

```text
extensions/claude-marketplace/
├── index.ts                     # Pi entrypoint: registers command + resources_discover
│
├── edge/                        # Thin transport layer (NEW: pulled out of root + commands/)
│   ├── router.ts                # /claude:plugin subcommand routing
│   ├── completions.ts           # tab-completion (subcommand + --scope)
│   ├── args.ts                  # arg-string parsing, --scope validation
│   └── handlers/                # one file per slash subcommand
│       ├── install-plugin.ts    # → orchestrators/plugin/install
│       ├── uninstall-plugin.ts
│       ├── update.ts
│       ├── list.ts
│       ├── add-marketplace.ts
│       ├── remove-marketplace.ts
│       ├── list-marketplaces.ts
│       ├── update-marketplace.ts
│       └── marketplace-autoupdate.ts
│
├── orchestrators/               # Use cases (feature-vertical)
│   ├── plugin/
│   │   ├── install.ts           # 4-phase install
│   │   ├── update.ts            # 3-phase update
│   │   ├── uninstall.ts
│   │   └── list.ts
│   └── marketplace/
│       ├── add.ts
│       ├── remove.ts            # cascade across plugins
│       ├── update.ts            # manifest refresh + optional plugin cascade
│       ├── autoupdate.ts        # toggle on/off
│       └── list.ts
│
├── bridges/                     # Resource bridges (per Claude component class)
│   ├── skills/                  # → resources/skills/<plugin>-<skill>/SKILL.md
│   │   ├── stage.ts
│   │   └── discover.ts
│   ├── prompts/                 # → resources/prompts/<plugin>:<command>.md
│   │   ├── stage.ts
│   │   └── discover.ts
│   ├── agents/                  # → <scope>/agents/claude-marketplace-<...>.md
│   │   ├── stage.ts             # prepare/commit/abort
│   │   ├── convert.ts           # Claude → pi-subagents frontmatter
│   │   ├── frontmatter.ts       # GENERATED_AGENT_MARKER, parse/serialize
│   │   └── index.ts             # agents-index.json IO + corruption tolerance
│   └── mcp/                     # → <scope>/mcp.json
│       ├── stage.ts             # prepare/commit/abort
│       ├── parse.ts             # plugin mcpServers map normalization
│       ├── marker.ts            # _claudeMarketplace ownership marker
│       └── effective-config.ts  # cross-slot collision check
│
├── domain/                      # Pure logic (NEW: pulled out of plugin/ + sources.ts)
│   ├── resolver.ts              # ResolvedPluginInstallable | ResolvedPluginUninstallable
│   ├── manifest.ts              # marketplace.json + plugin.json schemas
│   ├── source.ts                # MarketplaceSource (github | path), normalization
│   ├── compatibility.ts         # supported / unsupported / notes computation
│   ├── version.ts               # 12-hex content hash version (PI-7)
│   └── name.ts                  # generated names + assertSafeName
│
├── transaction/                 # State + atomicity primitives
│   ├── state-guard.ts           # withStateGuard (preserved verbatim from V1)
│   ├── phase.ts                 # NEW: explicit phase ledger replacing ad-hoc try/catch chains
│   ├── rollback.ts              # PluginFailure / RollbackFailure aggregation
│   └── leaks.ts                 # appendLeaks / appendLeakToError
│
├── persistence/                 # Disk shapes + atomic IO
│   ├── state-io.ts              # loadState / saveState + legacy migration
│   ├── state-schema.ts          # ExtensionState, MarketplaceRecord, PluginInstallRecord
│   ├── locations.ts             # ScopedLocations brand + factories
│   └── atomic.ts                # atomicWriteJson, cleanupStaging, removeIfExists
│
├── presentation/                # Composing the user message
│   ├── reload-hint.ts           # "Run /reload to <verb> <names>." (ES-5 stable)
│   ├── soft-dep.ts              # NEW: extracts probe + warning composition into one place
│   ├── cascade.ts               # marketplace-update cascade summary
│   ├── marketplace-list.ts      # list rendering
│   └── error-format.ts          # NEW: formatErrorWithCauses (depth 5)
│
├── platform/                    # Pi-API-shaped boundary (NEW)
│   └── pi-api.ts                # Wraps pi.getAllTools(), pi.on(...), pi.registerCommand
│                                # → makes feature code testable without a live Pi
│
└── shared/
    ├── path-safety.ts           # assertPathInside, PathContainmentError
    ├── errors.ts                # errorMessage, base error helpers
    └── result.ts                # OPTIONAL: tagged tuple [ok|err] for resolver-shaped APIs
```

### Structure Rationale

- **`edge/` separated from `orchestrators/`:** V1 already does this (commands/\* call into plugin/*, marketplace/*) but the boundary is implicit. Naming the layer makes it enforceable in lint rules -- edge code may not import `node:fs/promises`; orchestrators may not import `ExtensionCommandContext` directly except to receive `notify` as a callback. Improves testability of orchestrators (they take plain inputs).
- **`bridges/` keeps each Claude component class self-contained:** skills/prompts/agents/mcpServers each have different staging models (stage→move vs prepare→commit→abort vs JSON merge). Co-locating discovery + conversion + staging + indexing per class beats splitting them into a generic `staging/` layer; the operations differ enough that abstraction would force shared code through pointless conditionals (V1 already learned this -- agents and mcp deliberately diverge from the skills/prompts pattern).
- **`domain/` extracted from `plugin/`:** V1 mixes the resolver (pure) with install (impure) under `plugin/`. Pulling pure logic into `domain/` lets the successor unit-test the resolver without faking a `ScopedLocations` and lets the resolver be used by `list` without touching state.
- **`transaction/` gets a `phase.ts`:** V1 hand-rolls phase ordering inside `install.ts` (try/catch/append-leak chains 200+ lines deep). A phase ledger primitive that takes `[{phase, do, undo}, ...]` and returns aggregated failures lets the orchestrator stay declarative. Same observable behavior, far less code to audit per change.
- **`platform/pi-api.ts` is new:** the V1 orchestrators take `ExtensionAPI` directly via closures (`handleInstall(pi)`). A thin wrapper named `PiPort` makes the dependency explicit and lets tests inject a stub instead of constructing a fake `ExtensionAPI`. The only methods used are `getAllTools()`, `on(...)`, `registerCommand(...)`, plus `ctx.ui.notify` from the per-call context -- narrow surface, easy to wrap.
- **`shared/result.ts` is optional:** see Pattern 4 below. The resolver already returns a discriminated union and that's the right shape for *that* boundary; promoting the same idiom to all internal calls would be churn for churn's sake unless the successor commits to it consistently.

## Architectural Patterns

### Pattern 1: Discriminated installable union at the resolver boundary (carry forward, expand)

**What:** The resolver returns `ResolvedPluginInstallable | ResolvedPluginUninstallable`, with `pluginRoot` only on the installable variant. Consumers narrow via `installable === true`. NFR-7 mandates this for the resolver; the successor should propagate the pattern to other "may yield a usable artefact" boundaries.

**When to use:** Any function that today returns `{ ok: bool, value?: T, reason?: string }` or throws-on-bad-input where the caller usually has a recovery path (`list` shows non-installable plugins as `unavailable`; `install` rejects them up front).

**Trade-offs:** Strict, exhaustive, refactor-safe; costs 5-10 LOC per discriminator. Forces the callsite to acknowledge the failure case rather than silently dereferencing.

```typescript
// Carry forward verbatim from V1 plugin/resolve.ts:
export type ResolvedPlugin = ResolvedPluginInstallable | ResolvedPluginUninstallable;

// Successor extension: same shape for compatibility resolver consumers
export type ManifestEntryStatus =
  | { kind: "available"; entry: MarketplaceManifestPlugin }
  | { kind: "unavailable"; reason: string }
  | { kind: "missing" };
```

### Pattern 2: State-guard with read-modify-save closure (carry forward, document boundaries)

**What:** All mutating state operations run inside `withStateGuard(locations, mutate)`, which:

1. Loads fresh `state.json` (NOT a stale snapshot from earlier in the operation),
2. Hands the mutate closure a mutable copy,
3. Saves only if the closure does not throw,
4. Returns whatever the closure returns.

**When to use:** Always, for any code path that calls `saveState`. V1 enforces this convention by having every `saveState` call site go through `withStateGuard`. Successor MUST keep this discipline (ST-7).

**Trade-offs:** Cheap, correct in-process. Last-writer-wins across processes -- the V1 docstring is honest about this. Acceptable for a per-user, per-shell CLI tool; insufficient if Pi ever runs two parallel sessions writing to the same scope (see Concurrency below).

```typescript
// V1 transaction/state-guard.ts -- carry forward verbatim
export async function withStateGuard<T>(
  locations: ScopedLocations,
  mutate: (state: ExtensionState) => T,
): Promise<T> {
  const fresh = await loadState(locations.extensionRoot);
  const result = mutate(fresh);
  await saveState(locations.extensionRoot, fresh);
  return result;
}
```

### Pattern 3: Prepare → commit → abort tri-phase staging for non-resource sinks (carry forward, generalize)

**What:** For sinks that mutate files outside the extension's own tree (`agents/`, `mcp.json`), V1 splits the work into three named phases:

- `prepare`: compute the next on-disk shape in a tmp dir or in memory; throw on any precondition failure; reversible.
- `commit`: single atomic-rename or `atomicWriteJson` call; either success or filesystem-level failure.
- `abort`: undo a prepared-but-uncommitted change (in V1: delete tmp dir, return any leak descriptor).

**When to use:** Any bridge that publishes into a file pi-mcp-adapter / pi-subagents will read. Skills/prompts use a simpler stage→move because they live in the extension's own tree and aren't merged with foreign content.

**Trade-offs:** ~30% more code than stage-then-move but lets the update orchestrator interleave multiple bridges' commits and abort all on the first failure. Without this split, a partial 3-phase update with mcp succeeding and agents failing strands the user with a non-committable state.

```typescript
// V1 mcp/stage.ts pattern (representative):
export type PreparedMcpStaging =
  | { kind: "noop" }
  | { kind: "staged"; locations: ScopedLocations; stagedNames: string[]; _nextDoc: RawMcpDoc };

export async function prepareStageMcpServers(input): Promise<PreparedMcpStaging> { /* ... */ }
export async function commitPreparedMcp(prepared: PreparedMcpStaging): Promise<void> { /* ... */ }
export async function abortPreparedMcp(prepared: PreparedMcpStaging): Promise<string | undefined> { /* ... */ }
```

### Pattern 4: Phase ledger for orchestrator rollback (NEW for successor)

**What:** Replace the hand-rolled try/catch chains in `install.ts` and `update.ts` with a small primitive that takes a list of `{ phase, do, undo }` steps and threads errors through a `RollbackFailure[]` accumulator. Same observable behavior (same `(rollback partial: [phase] msg; ...)` user string per AS-4), much less per-orchestrator code.

**When to use:** The 4-phase install (skills/prompts → agents → mcp → state commit) and the 3-phase update (prepare → state-guard swap → physical replace+commit). Don't generalize further -- `marketplace remove` already cascades naturally and doesn't need a ledger.

**Trade-offs:** Net code reduction, clearer rollback semantics. Risk: an over-eager ledger abstraction can make ordering implicit; spec the steps as a literal const array (not built up procedurally) so the order is grep-able. Saga-pattern-as-state-machine literature ([microservices.io](https://microservices.io/patterns/data/saga.html), [DZone](https://dzone.com/articles/modelling-saga-as-a-state-machine)) supports this -- sagas in this codebase are local (not distributed), but the orchestrator-as-state-machine framing applies.

```typescript
// Sketch -- successor transaction/phase.ts
type Phase<T> = {
  name: "skills/prompts" | "agents" | "mcpServers" | "data dir";
  do(): Promise<T>;
  undo(committed: T): Promise<RollbackFailure[]>;
};

async function runPhases(phases: Phase<unknown>[]): Promise<{
  committed: unknown[];
  failure?: { atPhase: string; cause: Error; rollback: RollbackFailure[] };
}> { /* ... */ }
```

### Pattern 5: Branded location object (carry forward verbatim)

**What:** `ScopedLocations` carries a phantom symbol brand so callers can't hand-craft a shape that pairs `agentsIndexPath` from one scope with `agentsDir` from another. Constructed once per operation by `locationsFor(scope, cwd)`.

**When to use:** Always. This pattern is gold for an extension that has multiple persistence surfaces per scope. Every successor function that operates on disk takes a `ScopedLocations` rather than `(scope, cwd, extensionRoot)` separately.

**Trade-offs:** None observed. The `unique symbol` brand has zero runtime cost.

### Pattern 6: Capability probe at decision time (carry forward -- push not available)

**What:** Soft-dep checks call `pi.getAllTools()` and look for the canonical tool names (`subagent` for pi-subagents; `mcp` or `sourceInfo.source.includes("pi-mcp-adapter")` for pi-mcp-adapter).

**When to use:** Before emitting a soft-dep warning or composing a reload hint. Probe at use, not at extension-load.

**Trade-offs:** Pull-based probing is the only choice -- Pi's `ExtensionAPI` (verified via `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts`) exposes session/turn/tool-call events but no `extension_loaded` or `tool_registered` push event. Adding a push subscription would require a Pi-side feature; it is out of scope for the successor unless co-developed.

```typescript
// V1 presentation/reload-hint.ts -- carry forward verbatim
export function hasLoadedPiSubagents(pi: ExtensionAPI): boolean {
  return pi.getAllTools().some((tool) => tool.name === "subagent");
}
```

## Data Flow

### Install flow (4-phase, AS-2)

```text
/claude:plugin install <plugin>@<marketplace> [--scope ...]
        │
        ▼
edge/handlers/install-plugin.ts
  ↓ parse args, resolve scope → ScopedLocations
  ▼
orchestrators/plugin/install.ts  ── installPlugin(opts)
  │
  │ Preflight (no writes):
  │   1. domain/resolver: classify plugin (installable | unavailable)
  │   2. bridges/{skills,prompts,agents}/discover: enumerate generated names
  │   3. persistence/state-io: loadState; cross-marketplace conflict check
  │   4. domain/version: hash content → "hash-<12hex>" (PI-7)
  │
  │ Phase 1 -- skills/prompts: stage to staging/<uuid>/, then atomic rename
  │ Phase 2 -- agents: prepareStagePluginAgents (in-memory + tmp), commit on phase 4 success
  │            on failure: rollback Phase 1 (removeRecordedResources)
  │ Phase 3 -- mcp: prepareStageMcpServers (in-memory next doc)
  │            on failure: abort Phase 2, rollback Phase 1
  │ Phase 4 -- state commit: withStateGuard(locations, s => s.marketplaces[m].plugins[p] = record)
  │            on failure: abortPreparedMcp + abortPreparedAgents + rollback Phase 1
  │            after success: commitPreparedAgents + commitPreparedMcp
  │
  ▼
presentation/{reload-hint, soft-dep}: compose final notify message
  ▼
ctx.ui.notify(message, severity)  // success | warning | error
```

### Update flow (3-phase, AS-3)

```text
/claude:plugin update [<plugin>@<marketplace>] [--scope ...]
        │
        ▼
orchestrators/plugin/update.ts  ── updatePlugin(opts)
  │
  │ Preflight: loadState, expectInstalledPlugin, resolve, compute toVersion
  │   if toVersion === fromVersion → return { updated: false }
  │
  │ Phase 1 (Prepare): stage everything in tmp; abort on failure leaves prior install intact
  │ Phase 2 (State swap): withStateGuard saves NEW record;
  │            concurrent-change detection: if record.installed=false OR version !== fromVersion,
  │            abort with "changed concurrently; retry the update."
  │ Phase 3 (Physical replace + soft-dep commit):
  │            move new resources into place (overwriting old), commit prepared agents & mcp.
  │            Failure here = state already NEW but disk inconsistent → MANUAL RECOVERY REQUIRED.
  ▼
ctx.ui.notify(...)
```

### Marketplace remove cascade

```text
/claude:plugin marketplace remove <name> [--scope ...]
        │
        ▼
orchestrators/marketplace/remove.ts
  │
  │ Preflight: load state, capture which plugins to clean
  │
  │ Per-plugin loop (in-memory cleanedPluginNames):
  │   removeRecordedResources (skills/prompts)
  │   unstagePluginAgents (idx + agent files)
  │   on partial failure → push to failedPlugins (preserve marketplace record so user can retry)
  │
  │ State commit: drop cleaned plugins from marketplace.plugins;
  │   if failedPlugins.length === 0 → drop marketplace record entirely
  │
  │ Post-state cleanup (warnings, not errors):
  │   removePluginDataDir for each cleanedPluginName
  │   removeMarketplaceDataDir if marketplace dropped entirely
  ▼
ctx.ui.notify(summary, severity)
```

### State management

```text
state.json (single per scope)
   ▲                         ▲
   │ atomic write             │ read-fresh inside guard
   │ (write-file-atomic       │
   │  semantics, tmp+rename)  │
   │                          │
saveState(extensionRoot, s)   loadState(extensionRoot)
   ▲                          ▲
   └──── only callsite: ──────┘
        withStateGuard(locations, mutate)
                    ▲
                    │ called by every orchestrator
        installPlugin / updatePlugin / uninstallPlugin /
        addMarketplace / updateMarketplace / removeMarketplace
```

### Key Data Flows

1. **Resolver → Install:** Manifest entry → `resolvePlugin(ctx, entry)` → `ResolvedPlugin` discriminated union → `requireInstallable` narrows → orchestrator only ever sees `pluginRoot` after the narrow. Inverts the V1 alternative of `resolvedPlugin.pluginRoot ?? marketplaceRoot` fallback chains.
2. **Soft-dep probe → Reload hint:** `pi.getAllTools()` snapshot → `hasLoadedPiSubagents`/`hasLoadedPiMcpAdapter` → composed warning string with stable ES-5 marker → appended to success body via `appendReloadHint`. Probe is per-call, never cached (cache = stale-after-load bugs).
3. **Phase failure → Error:** Per-phase `RollbackFailure` accumulator → `withRollbackContext(originalError, failures)` → `Error` with `cause` chain + `(rollback partial: [phase] msg; ...)` suffix → orchestrator throws → handler catches and routes through `ctx.ui.notify(message, "error")`.
4. **Marketplace cascade:** `marketplace update` with `autoupdate: true` → manifest refresh → for each installed plugin → `updatePlugin` → per-plugin success/skip/fail tracked in cascade summary. Cascade does NOT swallow errors silently; `presentation/cascade.ts` aggregates them into a single notify with severity bumped to `warning`.

## V1 Carry-Forward vs Successor Change

| Decision                | V1                                                                                                                                                      | Successor                                                                                                                                                                                           | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Module layout           | Mixed: `commands/` (router + handlers), `marketplace/`, `plugin/`, `agent/`, `mcp/`, plus shared `state/`, `transaction/`, `presentation/`, `resource/` | **Refactor names; preserve shape.** Rename to `edge/`, `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `platform/`, `shared/`. No new top-level concepts. | V1 layout is fundamentally sound; the issue is that `commands/` overlaps with `marketplace/` + `plugin/` semantically (both contain feature logic). Renaming makes the edge↔orchestrator seam enforceable.                                                                                                                                                                                                                                                                                                      |
| Persistence shape       | Single `state.json` per scope holding all marketplaces + all plugins                                                                                    | **Carry forward.** Single file is correct for V1 scale (tens of marketplaces × hundreds of plugins per user max).                                                                                   | Sharded files only help when (a) cross-shard atomicity isn't needed or (b) write contention dominates. Both are false here: marketplace remove cascades across plugins (cross-shard tx) and writes are user-initiated (no contention). The single-file model breaks down at 10k+ plugins per scope or if Pi runs concurrent multi-process writers -- neither is on the V1 horizon. The `agents-index.json` is correctly already split out (different access pattern: per-bridge, append-mostly).                |
| Atomic install ordering | 4 phases hand-coded in `install.ts` (skills/prompts → agents → mcp → state) with try/catch/append-leak chains                                           | **Carry forward semantics; refactor mechanism.** Same 4 phases, same rollback strings (AS-4 user contract), but model as a `Phase[]` ledger primitive.                                              | The phase order is correct (it minimizes external surface area before the state commit). The implementation is hard to audit because the orchestration logic and the I/O logic are tangled. A 60-line ledger primitive replaces ~250 lines of nested try/catch without changing any user-visible behavior.                                                                                                                                                                                                      |
| Update transaction      | 3 phases (prepare → state-guard swap with old-resource snapshot → physical replace + commit)                                                            | **Carry forward.** This pattern is unusual and hard-won -- it explicitly handles "state already NEW but disk inconsistent" by emitting `MANUAL RECOVERY REQUIRED` instead of silently retrying.     | Re-reading the V1 update.ts confirms the choice is deliberate: snapshotting old resources during the state swap lets phase 3 recover *most* of an interrupted update without a state rollback. A naive "commit state last" pattern would either lose the new version or strand it half-installed.                                                                                                                                                                                                               |
| Concurrency model       | `withStateGuard` (re-load + save-or-throw) -- explicit intra-process guard, last-writer-wins across processes                                           | **Carry forward; document boundary; flag for milestone-2 escalation.** Don't add `proper-lockfile` in V1 successor.                                                                                 | Per-user CLI tool with shell-level serialization (one terminal, one Pi process per scope at a time in practice). proper-lockfile ([npm](https://www.npmjs.com/package/proper-lockfile), [moxystudio](https://github.com/moxystudio/node-proper-lockfile)) is the right escalation if Pi gains concurrent-process capability -- its mkdir-based atomic acquire would slot underneath `withStateGuard` without changing the closure contract. CRDT is overkill (no offline merge case).                           |
| Soft-dep probing        | Pull (`pi.getAllTools()`) at decision time                                                                                                              | **Carry forward.** Pi API does not expose push events for tool/extension load.                                                                                                                      | Verified against `pi-coding-agent/dist/core/extensions/types.d.ts` -- `pi.on(event, ...)` covers session/turn/tool-call/agent lifecycle events but no `extension_loaded` or `tool_registered`. Push subscription is a Pi-side feature, not something this extension can fix. Probing is correct for the available API.                                                                                                                                                                                          |
| Error model             | `Error` + `Error.cause` chain + structured `RollbackFailure[]` aggregator + discriminated union at the *resolver* boundary only                         | **Carry forward.** Don't import `neverthrow` ([npm trends](https://npmtrends.com/fp-ts-vs-neverthrow-vs-pure-ts-vs-ts-custom-error-vs-ts-results)).                                                 | NFR-7 ("strictly typed installable variant") is satisfied by the resolver's discriminated union. Promoting Result types throughout would force every internal call to unwrap, and the Pi `ExtensionHandler` contract uses thrown errors. The hybrid V1 model -- discriminated unions where consumers have a recovery path, throws everywhere else with cause chains and stable suffix strings -- is the right calibration for this codebase. Mixing Result + throw within one repo is the worst of both worlds. |
| Presentation layer      | `presentation/{reload-hint, cascade, marketplace-list}` modules; ES-5 marker strings in inline literals                                                 | **Carry forward; centralize markers.** Pull ES-5 marker strings into one `presentation/markers.ts` constants file so a contract drift requires editing exactly one location.                        | The marker strings are user contracts (gitlint-grade per ES-5). V1 currently spreads them across reload-hint.ts, install.ts, errors, etc. One source of truth makes IL-5's "structured event channel" successor-architecture concern trivial to add later without touching every callsite.                                                                                                                                                                                                                      |
| Telemetry               | None (IL-4)                                                                                                                                             | **None in V1; design for it.** Add a `Telemetry` port (no-op default) wrapped behind the `platform/` layer. Don't ship a default sink.                                                              | IL-5 explicitly calls out structured event channels as a successor concern. A no-op `recordEvent({phase, severity, code})` interface costs ~30 LOC, breaks no V1 contract, and means a future telemetry milestone is a single-port-implementation change rather than a cross-cutting refactor.                                                                                                                                                                                                                  |

## Scaling Considerations

| Scale                                                                         | Architecture Adjustments                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-10 marketplaces, 10s of plugins (typical user)                              | V1 architecture is correct as-is. `state.json` < 100 KB; single-file IO < 5 ms.                                                                                                                                                                                       |
| 100s of plugins per scope (power user / project-scope shared org marketplace) | Still fits in a single `state.json` (< 1 MB). Profile `loadState` -- JSON.parse is the bottleneck at this point. Consider: lazy-loading marketplace records (keep an index, load full record on demand). Don't shard yet.                                             |
| 1000s of plugins                                                              | Time to shard: `state.json` split into `state.json` (index of marketplaces) + `marketplaces/<name>.json` (per-marketplace plugin map). Cross-marketplace cascade (remove) becomes harder -- needs a write-set commit primitive. Likely never happens for this domain. |
| Multi-process / concurrent shells                                             | Add `proper-lockfile` under `withStateGuard`. Ledger acquires the lock around the load+save window, not for the whole orchestrator (held too long blocks the other shell pointlessly).                                                                                |

### Scaling Priorities

1. **First bottleneck (likely never hit):** `state.json` parse + write latency on every command. Mitigation: lazy-load marketplace records by name; only `list` without `--marketplace` filter loads all.
2. **Second bottleneck:** cross-process state collisions if Pi gains parallel-shell support. Mitigation: `proper-lockfile` slot under the state-guard, with a 5s acquire timeout and a clear "scope locked by another Pi process; retry in a moment" error.

## Anti-Patterns

### Anti-Pattern 1: "Generic resource bridge" abstraction

**What people do:** Notice that skills/prompts/agents/mcp all "stage things on disk" and try to factor a generic `Bridge<TResource>` interface that all four implement.

**Why it's wrong:** They diverge in load-bearing ways. Skills/prompts use stage→move because they live in the extension's own tree. Agents need a per-scope index file with corruption tolerance and a generated-name marker. MCP merges into a *foreign* JSON file with an ownership marker and a cross-slot collision check. The shared subset is `mkdir + atomicWrite + assertPathInside` -- already in `shared/path-safety.ts` + `persistence/atomic.ts`. Forcing a `Bridge` superclass adds conditional fields per kind (`indexPath?: string`, `marker?: string`, `collisionCheck?: () => Promise<...>`) and obscures the per-kind invariants.

**Do this instead:** Keep `bridges/skills/`, `bridges/prompts/`, `bridges/agents/`, `bridges/mcp/` as parallel sibling modules with a *consistent shape* (`stage.ts`, plus per-bridge specifics) but no shared abstract type. The orchestrator's `Phase` ledger handles the cross-bridge ordering.

### Anti-Pattern 2: Caching `pi.getAllTools()` between commands

**What people do:** Notice that probing on every command is "wasteful," cache the tool list at extension load.

**Why it's wrong:** Pi extensions can be loaded/unloaded mid-session. A cached snapshot means the user runs `/something-that-loads-pi-mcp-adapter` then `/claude:plugin install ...` and gets a "pi-mcp-adapter is not loaded" warning that's been false since the previous command. The probe is O(small) -- it's a property read on an in-memory list -- so the optimization is fictitious.

**Do this instead:** Probe at decision time. The V1 `hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter` calls are correct as-is.

### Anti-Pattern 3: `await Promise.all(rollbackSteps)` parallel rollback

**What people do:** "Rollback is best-effort, so let's parallelize the cleanups for speed."

**Why it's wrong:** The phases write to *overlapping* directories (skills/prompts under `resources/`; agents in the parent `agents/`; mcp in `mcp.json`). Parallel cleanup can succeed-the-state-rollback before agent unstaging completes, leaving orphan agent index entries the user can never fix without `MANUAL RECOVERY REQUIRED` (per AS-7). V1 deliberately does sequential rollback with a per-phase failure accumulator and that ordering is part of the contract.

**Do this instead:** Sequential phase undo, accumulate failures, append to thrown error via `appendLeaks`. Speed of rollback is irrelevant -- it only runs on the unhappy path.

### Anti-Pattern 4: Throwing inside `withStateGuard` to mean "no save needed"

**What people do:** Use the "save only if closure does not throw" property as a control-flow signal -- throw a sentinel error to mean "abort save, but this isn't really an error."

**Why it's wrong:** Conflates "intentional no-op" with "operation failed." V1 already has the right pattern: the closure mutates *or returns without mutating*. The save still happens with the unchanged state (writing the same JSON back is harmless under atomic rename). Sentinel errors leak to the orchestrator and force a try/catch dance.

**Do this instead:** Mutate or don't mutate. Let the closure return whatever metadata the caller needs; let `withStateGuard` save unconditionally on success.

### Anti-Pattern 5: Adding `process.stdout.write` for "debug logs"

**What people do:** Ship a flag `--debug` that writes to stdout/stderr.

**Why it's wrong:** IL-2 explicitly forbids direct stdout/stderr writes in command and bridge code. The single sanctioned `console.warn` is the load-time migration save failure (IL-3). Pi's TUI captures stdout -- bypassing `ctx.ui.notify` produces invisible output the user can't see and tests can't assert on.

**Do this instead:** Add severity-aware structured events through a `platform/telemetry.ts` port (no-op by default per IL-4). Local debugging uses Pi's own log infrastructure, not extension-level prints.

## Integration Points

### External Services

| Service                   | Integration Pattern                                                                           | Notes                                                                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Git (GitHub source clone) | Shell out via `node:child_process` in `bridges/marketplace/git.ts` (V1 already isolated this) | Network access only on `marketplace add` / `marketplace update` to GitHub source (NFR-5). Path sources never touch the network.     |
| Filesystem                | `node:fs/promises` everywhere; all writes through `atomicWriteJson` or tmp+rename helpers     | NFR-1 (atomicity) + PS-1 (containment) checked at every name-derived path.                                                          |
| pi-subagents (soft dep)   | Out-of-band file drop into `<scope>/agents/`; capability detected via `pi.getAllTools()`      | Stable filename prefix `claude-marketplace-` + GENERATED_AGENT_MARKER in frontmatter. Foreign agents in the same dir are untouched. |
| pi-mcp-adapter (soft dep) | Merge into `<scope>/mcp.json` with `_claudeMarketplace` ownership marker                      | Cross-slot collision check via `effective-config.ts` -- refuses to overwrite entries in any of pi-mcp-adapter's four config slots.  |
| Pi runtime                | `pi.registerCommand`, `pi.on("resources_discover", ...)`, `pi.getAllTools()`, `ctx.ui.notify` | Wrap behind `platform/pi-api.ts` for testability. Verified surface against `pi-coding-agent` types.d.ts.                            |

### Internal Boundaries

| Boundary                      | Communication                                                                                                    | Notes                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| edge/ ↔ orchestrators/        | Direct function call with typed input record + `ctx` for notify                                                  | Edge layer parses; orchestrators don't see raw arg strings.                |
| orchestrators/ ↔ bridges/     | Direct function call (`stagePluginAgents(opts)`, `prepareStageMcpServers(opts)`); no events                      | Orchestrator owns ordering and rollback. Bridges own per-class invariants. |
| orchestrators/ ↔ persistence/ | Through `transaction/state-guard.ts` only -- never direct `saveState`                                            | ST-7 enforced by import lint.                                              |
| bridges/ ↔ persistence/       | Bridges own their per-bridge files (agents-index.json, mcp.json, scope agents dir); state.json is opaque to them | Keeps bridges replaceable.                                                 |
| domain/ ↔ everything          | Pure imports only; domain has no I/O dependencies                                                                | Enables fast unit tests without ScopedLocations setup.                     |
| bridges/ ↔ Pi API             | Never directly -- goes through orchestrators or `platform/`                                                      | Bridges should be runnable in unit tests with no Pi at all.                |

## Build Order Implications

Phase ordering for the successor implementation, derived from dependency direction:

1. **Foundations first:** `domain/` (resolver, manifest, source, name, version) + `persistence/` (locations, atomic, state-schema) + `shared/` (path-safety, errors). Pure code, exhaustively unit-testable. Can ship as a typed library before any Pi integration.
2. **State + transaction primitives:** `persistence/state-io.ts` + `transaction/state-guard.ts` + `transaction/phase.ts` + `transaction/leaks.ts`. Tested with in-memory locations and a tmpdir.
3. **Bridges (parallel-buildable):** `bridges/skills/`, `bridges/prompts/`, `bridges/agents/`, `bridges/mcp/`. Each is independently testable. Order does not matter; can be split across phases.
4. **Orchestrators:** `orchestrators/marketplace/` first (add/list -- simpler, no cross-bridge phases), then `orchestrators/plugin/` (install/update/uninstall -- exercise the phase ledger), then cascades (`marketplace/remove`, `marketplace/update --autoupdate`).
5. **Edge layer + presentation:** `edge/handlers/`, `edge/router.ts`, `edge/completions.ts`, `presentation/`. Thin glue, testable with stubbed orchestrators.
6. **Pi integration:** `index.ts` + `platform/pi-api.ts`. Smallest surface area, last to wire up.

This ordering means phases 1-3 can ship without any Pi runtime dependency -- useful for getting the test pyramid right before the integration boundary muddies it.

## Sources

- V1 source (read directly): `git -C ... show features/initial:extensions/claude-marketplace/<file>` for index.ts, commands/router.ts, transaction/state-guard.ts, plugin/install.ts, plugin/update.ts, plugin/lifecycle.ts, plugin/resolve.ts, types.ts, state/io.ts, agent/stage.ts, mcp/stage.ts, location/index.ts, errors.ts, marketplace/remove.ts, presentation/reload-hint.ts (HIGH confidence).
- PRD §4 system context, §6.9 state persistence, §6.10 path safety, §6.11 atomic staging, §6.12 error surfaces, §8.3/8.4 install + update transaction state machines, §9.1-9.3 architecture diagrams (HIGH confidence -- this is the spec).
- Pi `ExtensionAPI` surface: `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts` (verified `getAllTools()`, `on(event, ...)` events list -- HIGH confidence that no push event for extension/tool load exists in the API surface as of the current pinned version).
- [proper-lockfile (npm)](https://www.npmjs.com/package/proper-lockfile) -- inter-process lockfile primitive; mkdir-based atomic acquire (MEDIUM confidence on "right escalation choice"; widely used in npm CLI tools).
- [moxystudio/node-proper-lockfile](https://github.com/moxystudio/node-proper-lockfile) -- implementation reference.
- [write-file-atomic (npm)](https://www.npmjs.com/package/write-file-atomic) -- atomic file write primitive; the V1 `atomicWriteJson` follows the same tmp+rename pattern.
- [npm/write-file-atomic](https://github.com/npm/write-file-atomic) -- semantics reference.
- [Modeling Saga as a State Machine (DZone)](https://dzone.com/articles/modelling-saga-as-a-state-machine) -- orchestrator-as-state-machine framing for multi-phase transactions (MEDIUM confidence; the local-only flavor differs from the distributed saga literature, but the structural argument transfers).
- [Saga pattern (microservices.io)](https://microservices.io/patterns/data/saga.html) -- compensating transactions discipline; informs Phase ledger design.
- [Vertical Slice Architecture (Milan Jovanović)](https://www.milanjovanovic.tech/blog/vertical-slice-architecture) -- feature-first organization rationale (MEDIUM confidence; .NET-flavored but the structural argument is language-neutral).
- [Vertical Slice Architecture (Jimmy Bogard)](https://www.jimmybogard.com/vertical-slice-architecture/) -- original framing.
- [TypeScript Discriminated Unions (Total TypeScript)](https://www.totaltypescript.com/discriminated-unions-are-a-devs-best-friend) -- pattern reference for the `installable: true | false` resolver shape.
- [neverthrow (GitHub)](https://github.com/supermacro/neverthrow) -- Result-type library; reviewed and rejected for V1 successor (carry-forward `Error.cause` model is a better fit for the codebase's hybrid).
- [npm trends: fp-ts vs neverthrow vs ts-results](https://npmtrends.com/fp-ts-vs-neverthrow-vs-pure-ts-vs-ts-custom-error-vs-ts-results) -- adoption context for the Result-type rejection.
- [Why we don't use Effect-TS (Harbor blog)](https://runharbor.com/blog/2025-11-24-why-we-dont-use-effect-ts) -- supporting argument for not pulling in a heavy FP error-handling stack mid-project.

______________________________________________________________________

*Architecture research for: per-user CLI extension bridging plugin manifests into a host runtime* *Researched: 2026-05-09*
