<!-- refreshed: 2026-08-07 -->
# Architecture

**Analysis Date:** 2026-08-07

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        Pi Extension Host                              │
│  `extensions/pi-claude-marketplace/index.ts` (factory entry point)    │
└───────────────┬──────────────────────────────┬────────────────────────┘
                │ resources_discover / session_start   │ /claude:plugin command
                ▼                                       ▼
┌───────────────────────────┐        ┌────────────────────────────────┐
│   edge/                    │        │   bridges/hooks/                │
│  `edge/router.ts`          │        │  `bridges/hooks/index.ts`       │
│  `edge/register.ts`        │        │  dispatch Claude-Code hooks     │
│  `edge/handlers/*`         │        │  onto Pi's own hook events       │
└───────────────┬────────────┘        └───────────────┬──────────────────┘
                │ calls                                 │ reads
                ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       orchestrators/                                  │
│  `orchestrators/plugin/*` `orchestrators/marketplace/*`               │
│  `orchestrators/import/*` `orchestrators/reconcile/*`                 │
│  5-phase transactional ledgers; own notify() emission                 │
└───────┬───────────────┬───────────────┬───────────────┬───────────────┘
        │                │               │               │
        ▼                ▼               ▼               ▼
┌───────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐
│  bridges/       │ │  domain/     │ │ transaction/│ │  persistence/     │
│ agents/commands/│ │ resolver.ts  │ │ phase-ledger │ │ state-io.ts       │
│ mcp/skills/hooks│ │ manifest.ts  │ │ with-state-  │ │ config-io.ts      │
│ (stage/commit/  │ │ source.ts    │ │ guard.ts     │ │ locations.ts      │
│ unstage triplet)│ │ version.ts   │ │ rollback.ts  │ │ migrate.ts        │
└───────┬─────────┘ └──────┬──────┘ └──────┬──────┘ └────────┬──────────┘
        │                  │               │                 │
        ▼                  ▼               ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                platform/ + shared/ (leaf utilities)                   │
│  `platform/pi-api.ts` `platform/git.ts` `shared/notify.ts`            │
│  `shared/path-safety.ts` `shared/errors.ts` `shared/atomic-json.ts`   │
└─────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Disk: `<scopeRoot>/pi-claude-marketplace/state.json`,               │
│   `<scopeRoot>/agents/`, `<scopeRoot>/mcp.json`,                      │
│   `<scopeRoot>/claude-plugins.json` / `claude-plugins.local.json`     │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Extension factory | Registers Pi event handlers (`resources_discover`, `session_start`), the `/claude:plugin` command, and MCP tools | `extensions/pi-claude-marketplace/index.ts` |
| Edge router | Parses `/claude:plugin ...` subcommands + aliases into typed handler dispatch | `extensions/pi-claude-marketplace/edge/router.ts` |
| Edge handlers | Parse CLI args, resolve scope, call one orchestrator, no business logic | `extensions/pi-claude-marketplace/edge/handlers/plugin/*.ts`, `.../marketplace/*.ts` |
| Orchestrators (plugin) | 5-phase transactional install/uninstall/update/reinstall/enable-disable ledgers | `extensions/pi-claude-marketplace/orchestrators/plugin/*.ts` |
| Orchestrators (marketplace) | add/remove/list/info/update/autoupdate for marketplaces | `extensions/pi-claude-marketplace/orchestrators/marketplace/*.ts` |
| Orchestrators (import) | Bulk cascade-install of an entire Claude Code `claude-plugins.json` config | `extensions/pi-claude-marketplace/orchestrators/import/*.ts` |
| Orchestrators (reconcile) | Load-time diffing of desired vs. on-disk state; drives `resources_discover` self-healing | `extensions/pi-claude-marketplace/orchestrators/reconcile/*.ts` |
| Bridges | Translate one Claude-plugin component kind (skills/commands/agents/mcp/hooks) into its Pi-native artifact via a stage/commit/unstage triplet | `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp,hooks}/*.ts` |
| Domain | Pure resolution/validation logic: plugin manifest parsing, source-URL parsing, discriminated `installable` resolver, version derivation | `extensions/pi-claude-marketplace/domain/*.ts` |
| Transaction | Generic 5-phase do/undo ledger primitive + cross-process state-lock guard + rollback composition | `extensions/pi-claude-marketplace/transaction/*.ts` |
| Persistence | Atomic reads/writes of `state.json`, `claude-plugins.json`, `agents-index.json`; scope-rooted path bundle | `extensions/pi-claude-marketplace/persistence/*.ts` |
| Platform | Pi API typings, git operations, git-credential helper | `extensions/pi-claude-marketplace/platform/*.ts` |
| Shared | Cross-cutting leaf utilities: notify, errors, path containment, atomic JSON, soft-dependency probing | `extensions/pi-claude-marketplace/shared/*.ts` |

## Pattern Overview

**Overall:** Layered architecture with strict one-directional import boundaries (edge → orchestrators → {bridges, domain, transaction, persistence} → {platform, shared}), organized around a **command/resource translation pipeline**: Claude plugin artifacts on disk are resolved (domain), staged, and committed (bridges) into Pi-native equivalents under transactional control (transaction), with all disk mutation funneled through a single path-containment chokepoint (shared/path-safety.ts) and a single atomic-write primitive (shared/atomic-json.ts / write-file-atomic).

**Key Characteristics:**
- Every mutating operation (install/uninstall/update/enable/disable) is a named 5-phase ledger (`transaction/phase-ledger.ts`) with symmetric `do`/`undo` per phase, guaranteeing all-or-nothing materialization across 5 independently-persisted subsystems (skills, commands, agents, hooks, mcp).
- A single cross-process advisory lock (`proper-lockfile`, `retries: 0`) guards the load→mutate→save critical section per scope (`transaction/with-state-guard.ts`); nesting two guards on the same lock file self-deadlocks, so guard-free "ledger body" functions (e.g. `runInstallLedger`) are extracted for reuse by callers that already hold the lock.
- Discriminated-union resolution (`installable: true | false`, extended to `installable | partially-available | unavailable`) means TypeScript enforces that non-installable plugins cannot have their `pluginRoot` read (NFR-7).
- Orchestrators never touch the network directly for `install`/`list`/`uninstall` (NFR-5); an architectural test (`tests/architecture/no-orchestrator-network.test.ts`) greps orchestrator source files for forbidden git-surface tokens.
- All user-visible output flows through `shared/notify.ts`'s `notify()` / `notifyWithContext()` — direct `ctx.ui.notify` calls outside that file are forbidden by an ESLint rule and a grep gate.

## Layers

**edge/:**
- Purpose: parse `/claude:plugin` CLI args, resolve scope flags, dispatch to exactly one orchestrator call
- Location: `extensions/pi-claude-marketplace/edge/`
- Contains: `router.ts` (subcommand dispatch table), `register.ts` (wires `SubcommandHandlers` from `EdgeDeps`), `handlers/plugin/*.ts`, `handlers/marketplace/*.ts`, `args.ts`/`args-schema.ts` (flag parsing), `completions/*` (tab-completion provider)
- Depends on: orchestrators/, shared/notify.ts, shared/errors.ts
- Used by: `index.ts` factory (`registerClaudePluginCommand`)

**orchestrators/:**
- Purpose: own the transactional business logic for install/uninstall/update/reinstall/enable-disable, marketplace lifecycle, bulk import, and load-time reconcile
- Location: `extensions/pi-claude-marketplace/orchestrators/`
- Contains: per-verb files (`install.ts`, `uninstall.ts`, ...) each paired with a `*.messaging.ts` file holding its notification-message builder; `shared.ts` per subdirectory for cross-verb helpers
- Depends on: bridges/, domain/, transaction/, persistence/, platform/ (auth only), shared/
- Used by: edge/handlers/*, orchestrators/import/ (cascades plugin orchestrator calls), index.ts (`applyReconcile`, `updateSinglePlugin`)

**bridges/:**
- Purpose: one bridge per Claude-plugin component kind; each exposes `discover` (enumerate source artifacts + generated names), `stage`/`prepareStage*` (write into a staging dir or compute a prepared write), `commit*` (atomic rename/write into the live location), and `unstage*` (rollback removal)
- Location: `extensions/pi-claude-marketplace/bridges/{skills,commands,agents,mcp,hooks}/`
- Contains: kind-specific `types.ts`, `discover.ts`, `stage.ts`, `unstage.ts`, plus bridge-local helpers (e.g. `agents/frontmatter.ts`, `agents/index-mutation.ts`, `mcp/substitute.ts` for `${CLAUDE_PLUGIN_DATA}` variable substitution, `hooks/if-field/*` for the `if:` predicate compiler, `hooks/async-rewake/*` for hook-async resume state)
- Depends on: domain/ (name generation, manifest types), persistence/ (locations), shared/
- Used by: orchestrators/plugin/* (5-phase install/uninstall ledgers)

**domain/:**
- Purpose: pure, network-free resolution and validation of plugin/marketplace shapes — no disk writes
- Location: `extensions/pi-claude-marketplace/domain/`
- Contains: `resolver.ts` (the discriminated `installable | partially-available | unavailable` resolver), `manifest.ts`/`manifest-cache.ts` (marketplace.json parsing + cache), `source.ts` (plugin source URL parsing: path/github/git-subdir/url), `version.ts` (hash-version derivation), `name.ts` (safe-name assertions), `plugin-root.ts`, `components/*.ts` (typebox schemas for plugin.json, hooks.json, mcp.json fragments)
- Depends on: shared/ only
- Used by: orchestrators/, bridges/

**transaction/:**
- Purpose: generic 5-phase do/undo ledger primitive and the cross-process state-lock guard
- Location: `extensions/pi-claude-marketplace/transaction/`
- Contains: `phase-ledger.ts` (`runPhases<C>`, `Phase<C>`, `RollbackPartial`), `with-state-guard.ts` (`withLockedStateTransaction`, `proper-lockfile`-backed), `rollback.ts`
- Depends on: persistence/ (state-io), shared/errors.ts
- Used by: orchestrators/plugin/*, orchestrators/marketplace/* (any operation needing atomic multi-subsystem materialization)

**persistence/:**
- Purpose: typed, scope-rooted, atomic reads/writes of every on-disk artifact the extension owns
- Location: `extensions/pi-claude-marketplace/persistence/`
- Contains: `locations.ts` (branded `ScopedLocations` bundle — the single source of every writable path), `state-io.ts` (`state.json` load/save/migrate), `config-io.ts`/`config-merge.ts`/`config-write-back.ts` (`claude-plugins.json` / `.local.json`), `agents-index-io.ts`/`agents-index-schema.ts` (pi-subagents index file), `migrate.ts`/`migrate-config.ts` (schema-version upgrades)
- Depends on: domain/name.ts (safe-name assertion), platform/pi-api.ts (`getAgentDir`), shared/path-safety.ts
- Used by: orchestrators/, bridges/, transaction/

**platform/:**
- Purpose: thin typed wrappers over the Pi extension API and git CLI, isolating the rest of the codebase from `@earendil-works/pi-coding-agent` and `isomorphic-git` specifics
- Location: `extensions/pi-claude-marketplace/platform/`
- Contains: `pi-api.ts` (re-exported/augmented Pi API types, `softDepStatus`, `getAgentDir`), `git.ts` (clone/fetch/checkout operations, the only place `isomorphic-git` is imported), `git-credential.ts` (device-flow/token credential helper)
- Depends on: shared/ only
- Used by: orchestrators/plugin/clone-cache.ts, orchestrators/auth-host.ts, index.ts

**shared/:**
- Purpose: cross-cutting leaf utilities with no upward dependencies
- Location: `extensions/pi-claude-marketplace/shared/`
- Contains: `notify.ts`/`notify-context.ts`/`notify-reasons.ts` (the single sanctioned UI-output surface), `errors.ts`/`errors-bridges.ts` (typed error classes: `PluginShapeError`, `ConcurrentInstallError`, `StateLockHeldError`, `PathContainmentError`), `path-safety.ts` (`assertPathInside` chokepoint, NFR-10), `atomic-json.ts` (JSON write-file-atomic wrapper), `fs-utils.ts`, `concerns/soft-dep.ts` (`Dependency` type + companion-extension probing), `debug-log.ts`, `types.ts` (`Scope` union), `vars.ts` (`${CLAUDE_PLUGIN_DATA}`/`${CLAUDE_PROJECT_DIR}` substitution), `git-failure-classifiers.ts`, `probe-classifiers.ts`
- Depends on: nothing internal (leaf layer)
- Used by: every other layer

## Data Flow

### Primary Request Path (`/claude:plugin install <plugin>@<marketplace>`)

1. Pi dispatches the command string to `registerClaudePluginCommand`'s handler (`extensions/pi-claude-marketplace/edge/register.ts`), which calls `routeClaudePlugin` (`extensions/pi-claude-marketplace/edge/router.ts:136`)
2. Router peels the `install` token and calls `handlers.install(rest, ctx)`, resolved to `edge/handlers/plugin/install.ts`, which parses flags (`--scope`, `--map-model`, `--partial`, `--local`) via `edge/args.ts`
3. Handler calls `installPlugin` (`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:?`, exported entry point wrapping `runInstallLedger`), which opens `withLockedStateTransaction` (`transaction/with-state-guard.ts`) over the target scope's `state.json`
4. Inside the lock: `runInstallLedger` resolves the marketplace source, loads the cached `marketplace.json` (no network, PI-2), runs `resolveStrict` (`domain/resolver.ts`) to produce a discriminated `installable | partially-available | unavailable` verdict, then gates on `requireInstallable`/`requirePartialInstallable`
5. `runPhases` (`transaction/phase-ledger.ts`) executes 5 phases in order — skills, commands, agents, hooks, mcp — each calling its bridge's `prepareStage*`/`commitPrepared*` (e.g. `bridges/skills/stage.ts`); any phase throw triggers `undo` on all previously-committed phases (`bridges/*/unstage*`)
6. On success, the state phase mutates the in-memory `ExtensionState` snapshot; the outer `withLockedStateTransaction` persists it via `persistence/state-io.ts::saveState` (atomic write)
7. `notify()` (`shared/notify.ts`) renders a single `PluginInstalledMessage` (or `PluginFailedMessage` on error) to `ctx.ui.notify`

### Load-Time Reconcile Flow (`resources_discover`)

1. Pi fires `resources_discover` on every session start/reload; `index.ts` handler first calls `hydrateProjectScopeForCwd` (`bridges/hooks/index.ts`) to populate the per-project hook-routing cache
2. `applyReconcile` (`orchestrators/reconcile/apply.ts`) reconciles **desired** state against **recorded** state: `orchestrators/reconcile/plan.ts` diffs the declared config (merged `claude-plugins.json`) against the installation records in `state.json`, partitioning both sides into seven action buckets, and the apply path installs, uninstalls, enables, and disables to close the gap — materializing and unstaging artifacts as those transitions require. This is what lets `/reload` alone converge on a hand-edited config (NFR-2). It is a config-to-record reconciliation, NOT a deep diff of records against on-disk artifacts: an artifact deleted underneath an intact record is not detected
3. `recomputePluginPath` (`orchestrators/plugin-path.ts`) rebuilds the `PATH`-equivalent routing table for both scopes
4. `aggregateDiscoveredResources` (`orchestrators/discover.ts`) walks both scope `locationsFor(...)` bundles and returns `{ skillPaths, promptPaths }` to Pi

**State Management:**
- Single source of truth is `<scopeRoot>/pi-claude-marketplace/state.json`, one file per scope (`user`/`project`), read/written exclusively through `persistence/state-io.ts` under the `proper-lockfile` guard
- No in-memory caching of `state.json` across calls; every orchestrator entry point re-loads it inside its own lock acquisition
- `shared/completion-cache.ts` is the sole exception — a short-lived, explicitly-invalidated (`dropMarketplaceCache`) cache for tab-completion data, not authoritative state

## Key Abstractions

**ScopedLocations:**
- Purpose: branded, scope-specific bundle of every writable path (`stateJsonPath`, `agentsDir`, `pluginDataDir(...)`, etc.) so a project-scope path can never be accidentally substituted into a user-scope operation
- Examples: `extensions/pi-claude-marketplace/persistence/locations.ts`
- Pattern: unique-symbol brand (`SCOPED_LOCATIONS_BRAND`) prevents hand-constructed object literals from type-checking as `ScopedLocations`; every name-derived path getter routes through `assertPathInside` (`shared/path-safety.ts`)

**Phase<C> ledger:**
- Purpose: generic transactional primitive — an ordered array of `{ name, do, undo }` phases executed in sequence; any `do` throw unwinds all prior `undo`s in reverse order
- Examples: `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`, consumed by `orchestrators/plugin/install.ts`, `uninstall.ts`, `update.ts`, `reinstall.ts`, `enable-disable.ts`
- Pattern: each orchestrator builds a literal 5-element array (`skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase`) closing over a per-call mutable context object

**Resolver discriminated union:**
- Purpose: encode "can this plugin be materialized" as a type-level discriminant so consumers cannot read `pluginRoot` off a plugin that isn't installable
- Examples: `extensions/pi-claude-marketplace/domain/resolver.ts` (`ResolvedPlugin` union: `installable | partially-available | unavailable`)
- Pattern: `requireInstallable`/`requirePartialInstallable` narrow the union and throw `PluginShapeError` on the disqualified arm; TypeScript strict mode + `assertNever` enforce exhaustiveness at every switch

**Bridge stage/commit/unstage triplet:**
- Purpose: uniform per-component-kind lifecycle so the phase ledger can treat all 5 bridges symmetrically
- Examples: `bridges/skills/stage.ts` + `bridges/skills/unstage.ts`, mirrored in `commands/`, `agents/`, `mcp/`, `hooks/`
- Pattern: `prepareStage*` computes the target write (may stage into a tmp dir), `commitPrepared*` performs the atomic rename/write, `unstage*` removes by recorded name on rollback

## Entry Points

**Extension factory (`claudeMarketplaceExtension`):**
- Location: `extensions/pi-claude-marketplace/index.ts`
- Triggers: Pi's extension loader, awaited before any session event
- Responsibilities: register `resources_discover` (reconcile + resource aggregation), `session_start` (env reset), the `/claude:plugin` command, and MCP tools; register the hooks bridge event listeners

**`/claude:plugin` command:**
- Location: `extensions/pi-claude-marketplace/edge/router.ts` (`routeClaudePlugin`), wired by `edge/register.ts`
- Triggers: user-typed slash command in Pi
- Responsibilities: subcommand dispatch (install/uninstall/update/fetch/reinstall/list/info/pending/enable/disable/import/marketplace)

**MCP tools:**
- Location: `extensions/pi-claude-marketplace/edge/handlers/tools.ts`, registered via `registerClaudeMarketplaceTools` (`edge/register.ts`)
- Triggers: LLM tool-call from within a Pi session
- Responsibilities: expose read-only marketplace/plugin query operations as callable tools

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop; concurrency across separate OS processes (not threads) is what `proper-lockfile` guards against (two Pi instances editing the same scope's `state.json`)
- **Global state:** None at the module level in `extensions/pi-claude-marketplace/` proper; `shared/completion-cache.ts` holds a process-lifetime cache explicitly invalidated by mutating orchestrators
- **Circular imports:** Gated inside `orchestrators/` only, by two mechanisms that cover different halves of the problem (D-11):
  - `import-x/no-cycle` (BLOCK C-2 of `eslint.config.js`), scoped to `extensions/pi-claude-marketplace/orchestrators/**/*.ts`. The block also sets `import-x/extensions` to include `.ts`; without that setting the rule resolves imports but never parses the resolved `.ts` files, so it walks a one-node graph and greens on any cycle. `tests/architecture/import-boundaries.test.ts` pins both the rule and the setting.
  - A directed-edge grep gate in the same test file, because `no-cycle` fires only once a graph is *already* circular — the first of the two edges lands green. The ledger modules of `orchestrators/plugin/` (`install`/`update`/`uninstall`/`reinstall`/`enable-disable`) and of `orchestrators/marketplace/` (`add`/`remove`/`update`/`autoupdate`) must not import each other, in either direction, including `import type`. A plugin ledger reaches marketplace code only through `orchestrators/marketplace/shared.ts`; a marketplace file reaches plugin code only through leaf composers (`orchestrators/plugin/update-row.ts`, `clone-cache.ts`, `clone-gc.ts`), shared types in `orchestrators/types.ts`, or the injected `pluginUpdate` seam.
  - Not covered: `orchestrators/plugin/bootstrap.ts` imports `marketplace/add.ts` and `marketplace/autoupdate.ts` by design — it is a composer, not a ledger. And `bridges/hooks/` carries a pre-existing cycle knot (`event-router.ts` ↔ `dispatch.ts` ↔ `async-rewake/registry.ts`), which is why the `no-cycle` glob stops at `orchestrators/` rather than covering the whole extension.
- **Network boundary:** `orchestrators/plugin/install.ts`, `list.ts`, `uninstall.ts` MUST NOT import `platform/git.ts` or carry a `gitOps` field — enforced by `tests/architecture/no-orchestrator-network.test.ts`, a source-grep architectural test (NFR-5)
- **Lock re-entrancy:** `proper-lockfile` is configured `retries: 0` and is NOT re-entrant; nesting two `withLockedStateTransaction` calls on the same scope's lock file self-deadlocks (`ELOCKED` → `StateLockHeldError`) — guard-free ledger bodies (`runInstallLedger`, etc.) exist specifically so callers that already hold the lock (e.g. `setPluginEnabled`'s enable branch) can invoke the ledger without re-acquiring

## Anti-Patterns

### Direct `ctx.ui.notify` calls outside `shared/notify.ts`

**What happens:** Code outside `shared/notify.ts` calling `ctx.ui.notify(...)` directly instead of going through `notify()`/`notifyWithContext()`/`notifyUsageError()`.
**Why it's wrong:** Bypasses the single point that computes severity, soft-dependency markers, and the reload-hint trailer (IL-2); breaks the notify-discipline grep gate and an ESLint custom rule (BLOCK A in `eslint.config.js`).
**Do this instead:** Import and call the exported helpers from `extensions/pi-claude-marketplace/shared/notify.ts`.

### Orchestrator files importing git/network surfaces

**What happens:** A file under `orchestrators/plugin/install.ts` (or `list.ts`/`uninstall.ts`) importing `platform/git.ts`, the default git ops, or declaring a `gitOps` field.
**Why it's wrong:** Violates NFR-5 — these commands must be network-free; a hidden git import would silently make an offline-guaranteed operation require network.
**Do this instead:** Route any needed git materialization through the sibling `clone-cache.ts` seam (e.g. `orchestrators/plugin/clone-cache.ts`), which is exempt and is the sole named consumer of git ops in the install path.

## Error Propagation & Rollback

**Strategy:** Typed error classes thrown from domain/transaction/bridges layers, caught at the orchestrator boundary and converted into either a rethrow-with-capture (standalone install path preserves the raw error for the caller's catch, PI-14 bypass) or a structured discriminated `InstallPluginOutcome`/`*Outcome` result for orchestrated (cascade) callers.

**Patterns:**
- `shared/errors.ts` defines the closed set of domain errors (`PluginShapeError`, `ConcurrentInstallError`, `StateLockHeldError`, `PathContainmentError`) each carrying a structured `.shape`/`.kind` discriminant consumers can narrow on
- `resources_discover` and `session_start` handlers in `index.ts` wrap every awaited call in try/catch with a final notify-in-catch, and the notify call itself is wrapped again — a throw must NEVER propagate past these two Pi lifecycle events (NFR-2)
- Rollback failures during ledger `undo` are captured as `RollbackPartial[]` (`transaction/phase-ledger.ts`) and surfaced in the failure notification rather than swallowed silently

## Cross-Cutting Concerns

**Logging:** `shared/debug-log.ts::hookDebugLog(message, category)` — a debug-only trace channel, distinct from user-facing `notify()`; no `console.log`/`process.stdout` writes anywhere in command/bridge code (IL-2), with one sanctioned `console.warn` for legacy-migration save failures (IL-3)

**Validation:** `typebox` schemas throughout `domain/components/*.ts` (plugin.json, hooks.json, mcp fragment shapes) compiled once and reused as `PLUGIN_ENTRY_VALIDATOR`-style constants; re-validated defensively at consumption sites even after an earlier validation pass (defense-in-depth, e.g. `install.ts`'s re-check of the manifest entry)

**Authentication:** `orchestrators/auth-host.ts` builds a host-keyed credential bundle via `platform/git-credential.ts`, memoized once-per-host per command invocation (`authMemo`) to avoid repeated device-flow prompts during a bulk import cascade

---

*Architecture analysis: 2026-08-07*
