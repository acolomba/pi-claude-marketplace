# Phase 5: Injection and Ownership Design - Research

**Researched:** 2026-09-07
**Domain:** TypeScript dependency injection, lifecycle-owned runtime state, and public test contracts
**Confidence:** HIGH

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

### Hidden Dependency Classification

- **D-05-01:** Classify every MF-DEC-07 affected use before changing it. Ordinary portable filesystem behavior uses a fresh case-owned temporary tree. Only an irreproducible fault, timing edge, operation schedule, rollback point, probe sequence, hydration read, or state-read race may receive a narrow consumer-owned production port wired to its real adapter by production composition. Ports must not be `__deps` members, test-only exports, unused defaults, or dead seams.
- **D-05-02:** Preserve exactly the two MF-DEC-03 behavioral-composition exceptions: `applyReconcile` and `bootstrapClaudePlugin`. Do not add dependency-injection seams solely for those flows. Preserve apply's public-result assertions; bootstrap's complete state, configuration, and scope-tree assertions; and both suites' exact-notification assertions. Correct an independently authorized boundary, such as apply's state-read race, without weakening the composition proof.
- **D-05-03:** Phase 5 defines and wires any required production ports, but Phase 6 owns removal of the authorized `createRequire` and `syncBuiltinESMExports` machinery. — **Reversibility:** costly — Port placement must coordinate with Phase 6 source-test ownership moves and the install/reinstall split sequence.

### Mutable State Ownership

- **D-05-04:** Replace hooks routing module-state ownership with one explicit hooks runtime state instance per extension lifecycle. Registration, hydration, routing rebuilds, settle state, async-rewake lifecycle behavior, and registered callbacks share that instance. Stale registrations are invalidated through real lifecycle behavior, not a test reset export. Tests create fresh runtime instances. — **Reversibility:** costly — Reversing this would reintroduce shared-process state across the hooks call graph and require retouching every state consumer.
- **D-05-05:** Replace the module-global completion maps with a completion-cache instance owned at the extension or command composition boundary. Production consumers receive its public cache operations; tests create fresh instances. Preserve disk-cache schemas, invalidation semantics, time-to-live behavior, and cross-operation cache effects without exporting a reset hook. — **Reversibility:** costly — The cache is shared by completion readers and marketplace/plugin mutation invalidators, so changing its lifetime later affects both sides of that contract.
- **D-05-06:** A lifecycle operation may clear or replace state only when production behavior requires it, such as reload or disposal. Do not retain or create an operation whose only caller is test setup.

### Public Contract Cleanup

- **D-05-07:** Apply MF-DEC-01 trace-preserving removal to `BOOLEAN_FLAGS`, `resetEpoch`, `resetRoutingState`, `resetCompletionCache`, and any other terminal test-shaped surface found within the active scope. Remove or privatize the surface and its artificial case; keep tests on public results. Retain an export only when current production consumers establish a genuine public contract.
- **D-05-08:** Remove the `BOOLEAN_FLAGS` test import and tautological assertion while retaining the independent literal flag-catalog pin and public list-handler behavior coverage.
- **D-05-09:** Phase 5 may shape genuine contracts needed by the MF-DEC-02 split program, but Phase 6 owns the approved resolver, notify, install, update, reinstall, list, and catalog splits and their test-ownership migrations.

### the agent's Discretion

- Exact type, factory, and file names for the hooks runtime, completion cache, and narrow ports.
- Whether an owned state object is represented by a class, closure, or typed object, provided its lifetime and consumers are explicit.
- Migration order and temporary internal adapters, provided no test-only or dead surface survives the completed phase.
- The smallest port boundary for each authorized irreproducible case after current-source research.

### Deferred Ideas (OUT OF SCOPE)

- Phase 6 removes all authorized process-global builtin mutation machinery after Phase 5 supplies the classified seams.
- Phase 6 executes the approved large-module split program and source-test ownership migration.
- `bridges/skills/stage.test.ts` remains out of scope without a dedicated terminal finding.
- Stale architecture-document counts from AUDIT-009 remain deferred documentation work.
- The info split remains excluded and uninstall remains a cohesive transactional workflow under MF-DEC-02.
- No pid-table change is authorized without a dedicated terminal finding.
- Spikes 018 through 020 are historical exploration artifacts, not canonical findings; validate any useful idea against current source and the live ledger.
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID                    | Description                                                                                                                                                                                                                                                     | Research Support                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TREF-04               | Each terminal hidden dependency is classified: use real temporary filesystem state by default and a narrow production-owned port only for irreproducible faults or timing; preserve the two selected behavioral composition exceptions without test-only seams. | The MF-DEC-07 table below maps all eleven authorized roots to a real-filesystem proof or a smallest consumer-owned port, and fences the two MF-DEC-03 composition suites.                    |
| TREF-05               | Terminal mutable module state moves to legitimate lifecycle or factory ownership without reset exports created only for tests.                                                                                                                                  | The hooks and completion-cache call-path maps identify every state cell, lifecycle owner, reader, mutator, and invalidator that must share the new instances.                                |
| TREF-06               | Tests exercise public contracts, and terminal test-only exports, reset hooks, and test-shaped branches follow the trace-preserving removal disposition.                                                                                                         | The public-surface inventory gives exact removal and replacement assertions for `BOOLEAN_FLAGS`, hooks resets, completion reset, and the newly discovered dead marketplace-name memory path. |
| </phase_requirements> |

## Summary

Phase 5 should introduce two real runtime-owned objects and a small set of consumer-owned I/O ports. The extension factory is the common composition root: it currently registers hooks, performs reconcile on `resources_discover`, and registers the command surface. It is therefore the only place that can construct one hooks runtime and one completion-cache instance and visibly thread them to both read and mutation paths. [VERIFIED: extensions/pi-claude-marketplace/index.ts:29-85,161-165]

The hooks work is larger than moving the four cells in `routing-state.ts`. Settle owns four more mutable cells, and async rewake owns both the child registry and per-PID-table persistence chains. Registration currently performs the genuine reload transition: bump generation, clear pending context and settle state, shut down tracked children, hydrate, rebuild, reap orphans, and capture the generation in callbacks. The new runtime must keep that sequence coherent and make every callback close over the same instance. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:157-163; extensions/pi-claude-marketplace/bridges/hooks/settle.ts:51-85; extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:145-180; extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:705-821]

The completion work should follow the existing `createManifestCache(load)` precedent: a closure owns its map, production receives the returned operations, and tests get isolation by constructing a fresh instance. The current completion module additionally exposes a stale marketplace-name memory/read path with no production reader, while production completion reads use `getPluginIndex` and mutation paths still invalidate both cache files. The planner should remove that dead in-memory/read surface only after a source census in the implementation task, while retaining the names-file schema and stateless invalidation behavior. [VERIFIED: extensions/pi-claude-marketplace/domain/manifest-cache.ts:75-133; extensions/pi-claude-marketplace/shared/completion-cache.ts:138-145,250-274; extensions/pi-claude-marketplace/edge/completions/data.ts:286-299,320-325,356-371,409-423,460-469]

**Primary recommendation:** Create a required `HooksRuntime` and `CompletionCache` at the extension factory, thread them through existing edge/orchestrator composition, add only the root-specific ports classified below, remove test-only reset/export surfaces, and leave all `createRequire`/`syncBuiltinESMExports` deletion and large-module splitting to Phase 6.

## Architectural Responsibility Map

| Capability                        | Primary Tier                  | Secondary Tier              | Rationale                                                                                                 |
| --------------------------------- | ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------- |
| Hooks runtime lifetime            | Extension composition         | Hooks bridge                | The extension factory determines lifecycle; bridge modules own routing, settle, and async behavior.       |
| Hooks hydration and route rebuild | Hooks bridge                  | Persistence                 | Hydration translates persisted state into in-memory routing entries.                                      |
| Async-rewake child ownership      | Hooks bridge                  | OS process state            | The runtime owns live child handles and persistence serialization, while the PID table remains unchanged. |
| Completion cache lifetime         | Extension/command composition | Shared cache                | The same instance must serve keystroke readers and command invalidators.                                  |
| Hidden filesystem ports           | Owning bridge/orchestrator    | Platform filesystem adapter | Each consumer names only the operation it needs; production composition supplies Node-backed adapters.    |
| Public-contract cleanup           | Owning source module          | Architecture/owner tests    | Production use decides visibility; tests cannot make an internal helper public.                           |

## Standard Stack

### Core

| Library/runtime                    | Version                                                                       | Purpose                                            | Why Standard                                                                                                                                                             |
| ---------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                            | Project constraint is verbatim `"node": ">=20.19.0"`; local runtime `v26.8.1` | ESM runtime, filesystem APIs, built-in test runner | Already defines the production and test runtime; no new runtime is needed. [VERIFIED: package.json:32-34; local `node --version`]                                        |
| TypeScript                         | Project declaration is verbatim `"typescript": "^6.0.3"`                      | Strict contracts for owned state and ports         | Existing compiler uses `"strict": true`, `"noUncheckedIndexedAccess": true`, and `"noEmit": true`. [VERIFIED: package.json:25-30; tsconfig.json:8-17]                    |
| `node:test` + `node:assert/strict` | Built into Node                                                               | Owner, integration, and architecture tests         | This is the repository's existing runner and assertion API; no third-party test framework is present. [VERIFIED: package.json:82-95; .planning/codebase/TESTING.md:7-12] |

### Supporting

| Existing asset                     | Purpose                                                        | When to Use                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createManifestCache`              | Factory-owned closure state with no reset export               | Use as the implementation pattern for the completion-cache factory. [VERIFIED: extensions/pi-claude-marketplace/domain/manifest-cache.ts:7-14,75-133] |
| Phase 4 typed collaborators        | Production-shaped, consumer-owned ports and fresh test doubles | Use for every new fault/timing port and its test helper. [VERIFIED: .planning/phases/04-hermetic-test-infrastructure/04-VERIFICATION.md:33-38]        |
| Fallow + ESLint + TypeScript gates | Complexity, boundary, dead-code, style, and type enforcement   | Run on every plan's final integration step. [VERIFIED: package.json:75-96]                                                                            |

### Alternatives Considered

| Instead of                       | Could Use                           | Tradeoff                                                                                                                                 |
| -------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Required runtime-owned contracts | Optional defaults or `__deps` bags  | Rejected by D-05-01 because production wiring becomes invisible or test-only.                                                            |
| Root-specific ports              | One shared `FsPort`                 | Rejected by MF-DEC-07 because ordinary filesystem behavior must stay real and consumers should not receive capabilities they do not own. |
| Factory-owned maps               | Module globals plus reset functions | Rejected by D-05-04 through D-05-07 because tests and extension lifecycles would still share process state.                              |

**Installation:** None. This phase uses existing runtime APIs and installs no package, so no package-legitimacy audit is required.

## Current-Source Inventory

### MF-DEC-07 Authorized Roots and Phase 5 Classification

The authoritative root list is verbatim: `"BSKL-019"`, `"HHD-011"`, `"HSA-026"`, `"OPEF-F04"`, `"OPEF-F09"`, `".planning/reviews/unit-test-adversarial/adversarial/orchestrators-plugin-install-a.md#OPIA-F05"`, `"OPIC-F27"`, `"OPLU-B-F10"`, `"OPR-B-F14"`, `"ORA-F15"`, and `"SHC-F003"`. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88908-88945]

| Root                    | Current production/test owner                                                     | Classification for Phase 5                                                                                                                                                                                                                                                                       | Prescriptive boundary                                                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BSKL-019                | `bridges/skills/unstage.ts` / `tests/bridges/skills/unstage.test.ts`              | Irreproducible remove-after-success race and selected-path failure. [VERIFIED: tests/bridges/skills/unstage.test.ts:207-285]                                                                                                                                                                     | Add a skills-unstage-owned removal operation. Keep normal removal against a real temp tree; the injected operation controls only the raced/failing remove.                                               |
| HHD-011                 | `bridges/hooks/event-router.ts` / its owner test                                  | Hydration/read sequencing. [VERIFIED: tests/bridges/hooks/event-router.test.ts:448-474]                                                                                                                                                                                                          | Make hydration consume a required hooks-owned state reader. Do not inject the whole event router or replace its real registration behavior.                                                              |
| HSA-026                 | `bridges/hooks/stage.ts` / its owner test                                         | Irreproducible readlink diagnostic failure, realpath race, readdir failure, and lstat failure. [VERIFIED: tests/bridges/hooks/stage.test.ts:339-355,427-443,491-507,544-560]                                                                                                                     | Add one hooks-staging tree-inspection port containing only `readlink`, `realpath`, `readdir`, and `lstat`; all ordinary staging/writes stay on the real temp filesystem.                                 |
| OPEF-F04                | `orchestrators/plugin/fetch.ts` / its owner test                                  | Clone visibility changes between status probes. [VERIFIED: tests/orchestrators/plugin/fetch.test.ts:1260-1303]                                                                                                                                                                                   | Add a fetch-owned clone-status probe or classifier operation; do not pass a generic filesystem object.                                                                                                   |
| OPEF-F09                | `orchestrators/plugin/enable-disable.ts` / its owner test                         | Mixed. Portable config/write failures remain real temp-tree cases; rollback ordering and hooks cache rebuild failure are controlled boundaries. [VERIFIED: terminal root in .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:47786; current source/test CodeGraph inspection] | Reuse the owned hooks runtime for cache mutation. Expose only the semantic config transaction/rollback operations that cannot be reproduced portably; do not create a wide enable/disable `__deps` bag.  |
| OPIA-F05 (full-path ID) | `orchestrators/plugin/install.ts` / its owner test                                | Eight operation-schedule cases around prepare, replace, rollback, abort, cleanup, and finalization. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:51397; MF-DEC-07:88916,88940]                                                                                 | Define install-owned semantic transaction operations now, wired to real implementations. Choose names that can move with the Phase 6 install split without changing the contract.                        |
| OPIC-F27                | `orchestrators/plugin/info.ts` / its owner test                                   | Forced targeted `readFile`/`readdir` failures; ordinary missing/corrupt trees remain real filesystem cases. [VERIFIED: tests/orchestrators/plugin/info.test.ts:75-104]                                                                                                                           | Add an info-owned read/list port without splitting `info.ts`; the info split is explicitly excluded.                                                                                                     |
| OPLU-B-F10              | `orchestrators/plugin/uninstall.ts` / its owner test                              | Cross-bridge/cache/config removal schedule and failure positions. [VERIFIED: terminal root in .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:53789; current source/test CodeGraph inspection]                                                                               | Keep uninstall cohesive. Inject a narrow uninstall workflow contract made from semantic operations already executed by production, including the owned completion cache and hooks runtime.               |
| OPR-B-F14               | `orchestrators/plugin/reinstall.ts` / its owner test                              | Prepare/replace/rollback/abort/finalize schedule plus post-save hooks-cache failure. [VERIFIED: terminal root in .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:55762; current source/test CodeGraph inspection]                                                            | Define reinstall-owned semantic transaction operations compatible with the Phase 6 split. Replace the existing optional cache-drop member with the required completion-cache contract during this phase. |
| ORA-F15                 | `persistence/state-io.ts` + `orchestrators/reconcile/apply.ts` / apply owner test | State changes after a selected read. [VERIFIED: tests/orchestrators/reconcile/apply.test.ts:443-464]                                                                                                                                                                                             | Add only a required reconcile-owned state-reader contract. Keep `applyReconcile` composing its real orchestrators and retain public result, state/tree, and notification assertions.                     |
| SHC-F003                | `shared/path-safety.ts` / its owner test                                          | Inspection ordering and forced `readlink`/`lstat` failures. [VERIFIED: tests/shared/path-safety.test.ts:240-288,393-457]                                                                                                                                                                         | Create a path-safety-owned inspector/factory containing only `lstat` and `readlink`; its real adapter must be supplied by every production composition path that constructs the guard.                   |

### Census Boundary

A fresh source census finds `syncBuiltinESMExports(` in fourteen test files and 83 invocations, not the older ledger proof's thirteen files and 80 calls. The files outside the eleven directly mapped owner suites are `tests/bridges/commands/discover.test.ts`, `tests/bridges/skills/stage.test.ts`, and `tests/index.test.ts`. This drift is inventory evidence, not authorization: Phase 5 must not edit `bridges/skills/stage.test.ts`, and Phase 6 owns removal of all authorized global-patch machinery. [VERIFIED: current `rg -l`/`rg -o` census on 2026-09-07; .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88923,88948]

Phase 5 should therefore add and wire the legitimate contracts, update source/test signatures required by those contracts, and add public forwarding/behavior proofs. It should not delete `createRequire`, `syncBuiltinESMExports`, or the scope-tree pre-binding workaround; those are Phase 6 acceptance work. This avoids silently completing only half of D-05-03. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-CONTEXT.md:18-20,121-123]

### Preserved Composition Exceptions

| Flow                    | Preserve                                                                                                                                                                                                                                 | Allowed Phase 5 correction                                                                                                   | Forbidden change                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `applyReconcile`        | Real orchestration, public reconcile result, complete state/tree effects, exact notifications. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json:88836-88848]                                               | Inject only the independently authorized state reader used to create the race.                                               | No broad orchestrator bundle; no interaction-only replacement. |
| `bootstrapClaudePlugin` | Real `addMarketplace` + autoupdate composition, complete state/config/scope tree, exact notifications. [VERIFIED: MF-DEC-03 current-source CodeGraph inspection; .planning/phases/05-injection-and-ownership-design/05-CONTEXT.md:18-20] | Accept the shared runtime/cache only if a real production consumer in that flow needs it; do not add it solely for the test. | No bespoke bootstrap dependency seam.                          |

## Architecture Patterns

### System Architecture Diagram

```text
Pi loads extension factory
          |
          +--> createHooksRuntime() ------------------------------+
          |         | routing + parsed config + generation        |
          |         | settle cells                                |
          |         | async child registry + write chains         |
          |         v                                             |
          |   register/hydrate/rebuild --> registered callbacks --+
          |         ^                         | stale generation -> no-op
          |         |                         + dispatch/settle/async completion
          |         +-- reconcile and command mutations
          |
          +--> createCompletionCache() ---------------------------+
          |         | get plugin index                            |
          |         | invalidate/drop cache                       |
          |         v                                             |
          |   command completions <--> marketplace/plugin mutations
          |
          +--> construct required real I/O adapters
                    |
                    +--> consumer-owned port --> Node filesystem
```

### Recommended Project Structure

Keep new ownership modules beside the concern they own. Exact names are discretionary; this structure minimizes boundary churn:

```text
extensions/pi-claude-marketplace/
├── index.ts                              # constructs both lifecycle instances and real adapters
├── bridges/hooks/
│   ├── runtime.ts                        # HooksRuntime factory and lifecycle transition
│   ├── routing-state.ts                  # routing types/helpers, no module-owned mutable cells
│   ├── settle.ts                         # functions close over runtime settle state
│   └── async-rewake/registry.ts          # functions use runtime async state; PID schema unchanged
├── edge/
│   ├── types.ts                          # required runtime/cache composition contracts
│   └── completions/data.ts               # receives CompletionCache reader
└── shared/completion-cache.ts            # createCompletionCache; schemas and real file I/O retained
```

Do not create Phase 6's resolver, notify, install, update, reinstall, list, or catalog split files in this phase. [VERIFIED: .planning/phases/05-injection-and-ownership-design/05-CONTEXT.md:30-32,121-126]

### Pattern 1: Closure-Owned State with Required Production Wiring

**What:** Construct a stateful object once and return only the operations consumers need. The closure, not an exported map or reset, owns mutable cells.

**When to use:** Both hooks state and completion cache.

```typescript
// Pattern source: extensions/pi-claude-marketplace/domain/manifest-cache.ts:75-133
export interface CompletionCache {
  getPluginIndex(/* production arguments */): Promise<readonly PluginIndexRow[]>;
  dropMarketplace(/* production arguments */): Promise<void>;
}

export function createCompletionCache(): CompletionCache {
  const pluginEntries = new Map<string, PluginCacheEntry>();
  return {
    async getPluginIndex(/* ... */): Promise<readonly PluginIndexRow[]> {
      // Existing schema, poison, disk, and TTL behavior moves here unchanged.
    },
    async dropMarketplace(/* ... */): Promise<void> {
      // Existing memory eviction + ENOENT-silent file unlink.
    },
  };
}
```

The names in this skeleton are recommendations, not existing discrete contracts. The executor should define the exact signatures from current consumers and let TypeScript enumerate every migration site.

### Pattern 2: One Hooks Runtime, Coherent Substate

**What:** One runtime instance owns routing/generation state, settle state, and async-rewake live state. Functions receive the runtime or are bound into runtime-specific closures.

**When to use:** Registration, hydration, dispatch, event adaptation, settle, async child callbacks, reconcile, and plugin mutation paths.

The lifecycle operation should express production meaning such as `beginRegistration` or `reload`, not `reset`. It should perform the existing ordered transition: invalidate the prior generation, clear pending and settle state, shut down in-memory children, hydrate/rebuild, then expose callbacks bound to the captured generation. The persisted orphan reap remains separate and unchanged. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:705-755]

### Pattern 3: Consumer-Owned Fault Port

**What:** Name the port for the consumer's domain operation, expose only the minimum methods needed for irreproducible behavior, and provide a real Node-backed adapter at composition.

**When to use:** The eleven-root classification table only.

```typescript
// Recommended shape; exact names are discretionary.
interface HooksHydrationReader {
  readStateText(path: string): Promise<string>;
}

function createHooksHydrationReader(): HooksHydrationReader {
  return { readStateText: (path) => readFile(path, "utf8") };
}
```

The production adapter must be a required value in the composition chain. Do not use an optional argument that falls back to the real filesystem inside the consumer: that recreates an invisible dependency and lets the seam exist only for tests.

### Component Responsibilities

| Component              | Owns                                                                                         | Must not own                                   |
| ---------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Extension factory      | Instance lifetime and real adapter construction                                              | Hooks/cache internals                          |
| Hooks runtime          | All ephemeral hooks maps/cells and real reload/disposal transitions                          | Persisted PID schema or unrelated plugin state |
| Completion cache       | Plugin-index memory map and cache read/eviction operations                                   | Command parsing or marketplace business rules  |
| Consumer-specific port | One fault/timing/probe/schedule boundary                                                     | A general filesystem abstraction               |
| Owner test             | Public results, exact state/bytes, errors, notifications, and production-contract forwarding | Module internals or reset hooks                |

### Anti-Patterns to Avoid

- **Optional real default inside the consumer:** this hides production ownership. Construct the real adapter at the extension/edge composition point.
- **A universal filesystem bag:** it over-authorizes consumers and turns ordinary temp-filesystem behavior into interaction testing.
- **Passing independent maps/counters:** it permits mismatched hook state. Pass one runtime or closures bound to one runtime.
- **Renaming a reset:** a public `clearAll` called only from tests still violates TREF-05/TREF-06.
- **Interaction-only replacement:** port call logs supplement, never replace, exact public result/state/error/notification assertions.
- **Early split work:** do not extract the large Phase 6 modules while introducing their future contracts.

## Hooks Runtime Ownership and Call Paths

### State Inventory

| Current cell                                                                               | Current owner             | Current consumers                                                        | Target owner/action                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parsedConfigCache`, `routingTable`, `liveEpoch`, `pendingSessionStartContext`             | `routing-state.ts` module | event router, dispatch, settle, async registry, hook environment/helpers | Move into one `HooksRuntime`; retain narrow reads/mutations as runtime operations. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:147-163,165-305]                                                                      |
| `cachedLastAssistant`, `stopHookActive`, `consecutiveBlockCount`, `capNotifiedThisSession` | `settle.ts` module        | agent-end, input-reset, stop/stop-failure settle handlers                | Move into the same runtime's settle substate; keep real input/reload transitions. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/settle.ts:51-103]                                                                                       |
| `asyncRewakeRegistry`, `pidTableOperations`                                                | async registry module     | spawn, exit callback, persistence serialization, shutdown                | Move into the same runtime's async substate. Keep `OrphanProbes` as the existing legitimate safety port and do not alter the PID table. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:145-180,211-225,500-535] |

### Required Routing

1. `index.ts` constructs one runtime before `registerHooksBridge` and passes it to the resources-discover closure and command registration. [VERIFIED: current composition points at extensions/pi-claude-marketplace/index.ts:29-85,161-165]
2. `registerHooksBridge` performs the real lifecycle transition and builds every registered callback from that runtime. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:705-821]
3. Hydration and rebuild receive the runtime; they no longer import singleton state. Current production mutation consumers are enable/disable, install, reinstall, uninstall, update, and reconcile apply. [VERIFIED: current `rg` census in extensions/pi-claude-marketplace/orchestrators: enable-disable.ts:461; install.ts:1329,2269; reinstall.ts:1068; uninstall.ts:376; update.ts:2009; reconcile/apply.ts:858]
4. Dispatch and settle handler factories bind the runtime into closures so generation checks and bucket reads consult the captured instance. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts:319-367; extensions/pi-claude-marketplace/bridges/hooks/settle.ts:110-172,272-348]
5. Async spawn and exit callbacks read generation and registry state from the same runtime. Existing `SpawnDeps` and `OrphanProbes` remain legitimate production contracts; do not fold them into a test-only super-bag. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:170-225,422-425]

### Reset Removal Migration

`resetEpoch` is explicitly documented as serving the test reset seam only, and `resetRoutingState` says its only caller is test setup. Both must disappear, while the registration/reload operation remains private or runtime-public because it has a production caller. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:187-194,309-325]

Tests that currently import `resetRoutingState` span hooks unit/architecture/integration suites and plugin install/update/reinstall/uninstall/enable-disable owners. Replace each setup call with a fresh runtime passed to the unit or command composition. Integration tests should build a fresh extension/bridge fixture, not manually empty state. [VERIFIED: current `rg -n resetRoutingState` census on 2026-09-07]

## Completion Cache Ownership and Call Paths

### Existing Contract to Preserve

The plugin-index cache uses the verbatim schema version `schemaVersion: Type.Literal(6)` and the verbatim in-memory TTL expression `10 * 60 * 1000`. It caches successful rows and soft-failure poison rows, re-reads disk after TTL, propagates non-manifest failures, and provides memory-only invalidate plus memory-and-file drop operations. [VERIFIED: extensions/pi-claude-marketplace/shared/completion-cache.ts:87-110,138-160,284-370,399-423]

The marketplace-name file schema remains verbatim `schemaVersion: Type.Literal(2)`. Its current memory map and `getMarketplaceNames` reader have no production call site, because the completion reader now calls `rebuildNamesForScope` directly; marketplace add/remove still call the names-file invalidator. [VERIFIED: extensions/pi-claude-marketplace/shared/completion-cache.ts:65-69,138-145,250-274; extensions/pi-claude-marketplace/edge/completions/data.ts:286-299,320-325; current production `rg` census]

### Consumers That Must Receive the Same Instance

| Side                     | Current consumers                                                                                                                                                                                                                          | Target wiring                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read                     | `edge/completions/data.ts` calls plugin-index read in install, installed/update/uninstall/reinstall, fetch, and info candidate construction. [VERIFIED: extensions/pi-claude-marketplace/edge/completions/data.ts:356-371,409-423,446-469] | `registerClaudePluginCommand` closes over the cache and passes it through completion provider/data.                                                                           |
| Marketplace invalidation | add: names + plugin drop; remove: names + plugin drop; update: plugin drop. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:579-584; remove.ts:604-605; update.ts:738]                                        | Marketplace handlers/orchestrators receive the same required cache contract from edge composition.                                                                            |
| Plugin invalidation      | install, update, uninstall, reinstall call plugin drop. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1563; update.ts:2608; uninstall.ts:434; reinstall.ts:1633]                                             | Plugin handlers/orchestrators receive the same required cache contract. Remove reinstall's optional `opts.__deps?.dropMarketplaceCache` selection when routing this contract. |

### Freshness and Cross-Operation Proofs

- Two reads through one instance must hit memory according to existing semantics; two separately constructed instances must not share memory.
- A command mutation followed by completion through the same extension instance must observe invalidation.
- Marketplace-name file invalidation must remain ENOENT-silent even if the unused memory/read layer is removed.
- Plugin-index TTL, schema mismatch, poison persistence, non-manifest error propagation, memory-only invalidate, and disk drop require exact owner regressions.
- No test may call `resetCompletionCache`; it creates a new cache or a new full command fixture.

## Public Contract Cleanup

| Surface                            | Current evidence                                                                                                                                                 | Required disposition and replacement proof                                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOOLEAN_FLAGS`                    | Private constant is used by `makeListHandler`, then re-exported only for a test. [VERIFIED: extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts:26-82] | Delete the export and test import. Delete the equality case derived from the same `parseFlagNames("list")`; retain the independent verbatim literal list row `list: ["--available", "--installed", "--partial", "--remote", "--unavailable"]` and public handler behavior. [VERIFIED: tests/architecture/flag-catalog-drift.test.ts:103-155] |
| `resetEpoch`                       | Test-reset-only by source documentation. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:187-194]                                     | Remove; owner tests construct a fresh runtime and drive registration to change generation.                                                                                                                                                                                                                                                   |
| `resetRoutingState`                | Source says only test setup calls it. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts:309-325]                                        | Remove; tests construct fresh runtime/extension fixtures. Keep only lifecycle-named production transition operations.                                                                                                                                                                                                                        |
| `resetCompletionCache`             | Source says only test setup calls it. [VERIFIED: extensions/pi-claude-marketplace/shared/completion-cache.ts:426-439]                                            | Remove; tests create cache instances.                                                                                                                                                                                                                                                                                                        |
| `resetSettleState`                 | Has a genuine production caller during bridge registration. [VERIFIED: extensions/pi-claude-marketplace/bridges/hooks/settle.ts:75-85; event-router.ts:718-722]  | Do not delete behavior. Make it private to the runtime lifecycle or a non-test-named runtime operation.                                                                                                                                                                                                                                      |
| Marketplace-name memory reader/map | No current production reader; tests and invalidators keep it reachable. [VERIFIED: current production `rg` census; completion-cache.ts:138-145,250-274]          | Trace-preserving removal is recommended: remove the dead memory/read API and its artificial owner cases, retain public file schema and real invalidation. Confirm the zero-consumer census immediately before edit.                                                                                                                          |

## Don't Hand-Roll

| Problem                      | Don't Build                             | Use Instead                                           | Why                                                                  |
| ---------------------------- | --------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Test isolation               | Global registry plus reset helper       | Fresh runtime/cache factory                           | Lifetime is explicit and isolation follows construction.             |
| Filesystem fault simulation  | Process-wide Node builtin mutation      | Small typed consumer port                             | Prevents cross-test and pre-bound-import leakage.                    |
| Ordinary filesystem behavior | In-memory filesystem emulator           | `mkdtemp` case-owned tree with `finally` cleanup      | Matches repository convention and production semantics.              |
| Cache persistence            | New schema/migration layer              | Existing TypeBox schemas and atomic JSON writer       | Phase requires byte/semantic preservation, not a cache redesign.     |
| Hook lifecycle cleanup       | Ad-hoc map clearing in each test/caller | One production lifecycle transition on `HooksRuntime` | Keeps generation, settle, pending context, and child state coherent. |

**Key insight:** The phase is about ownership, not mockability. A seam is legitimate only when production constructs it, a consumer needs it, and its public behavior can be tested without reaching into module state.

## Runtime State Inventory

| Category            | Items Found                                                                                                                                                                 | Action Required                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Stored data         | Completion cache files, plugin/state/config files, hooks cache inputs, and async PID tables remain on disk. [VERIFIED: completion-cache.ts:3-37; async registry.ts:500-535] | No data migration. Preserve schemas/paths and change only in-memory ownership.                                         |
| Live service config | None found; this phase operates inside the local Pi extension and does not rename external service configuration. [VERIFIED: phase call-path and filesystem inventory]      | None.                                                                                                                  |
| OS-registered state | Live async child processes and their persisted PID table are the only OS-adjacent state. [VERIFIED: async registry.ts:500-535]                                              | Keep same-process shutdown and cross-process orphan reap behavior. No PID-table format or policy change is authorized. |
| Secrets/env vars    | No secret key or environment-variable rename is in scope. [VERIFIED: 05-CONTEXT.md phase boundary and deferred decisions]                                                   | None.                                                                                                                  |
| Build artifacts     | TypeScript is source-run with verbatim `"noEmit": true`; no emitted build artifact requires migration. [VERIFIED: tsconfig.json:8]                                          | None. Run typecheck/tests only.                                                                                        |

## Common Pitfalls

### Pitfall 1: Losing Stale-Callback Invalidation

**What goes wrong:** Each callback receives a different state object, or a reload creates a new object while old callbacks remain live and never see their generation invalidated.

**Why it happens:** The current generation is module-global, so moving cells mechanically can separate registration from callback reads.

**How to avoid:** Build all callbacks from one runtime and make the real registration/reload transition invalidate the prior generation before new callbacks capture it.

**Warning signs:** Callback factories accept loose maps/counters; an old registered callback still dispatches after a second registration.

### Pitfall 2: Partial Hooks Ownership

**What goes wrong:** Routing maps move into a factory, but settle counters or async child registries remain process-global.

**How to avoid:** Treat the three state inventories as one runtime with coherent substate. Verify fresh-instance isolation in routing, settle, and async owner suites.

### Pitfall 3: Completion Readers and Invalidators Receive Different Instances

**What goes wrong:** A mutation invalidates one cache while autocomplete reads another, breaking the cross-operation contract.

**How to avoid:** Construct once at `index.ts`, pass through `registerClaudePluginCommand`, and require that same contract in every mutation path.

### Pitfall 4: Turning Phase 5 into Phase 6

**What goes wrong:** The implementation deletes global patch machinery or splits install/reinstall while defining the future ports.

**How to avoid:** Phase 5 verifies real production wiring and public behavior but retains the authorized test machinery until Phase 6. Make task acceptance explicitly assert the machinery remains where D-05-03 requires sequencing.

### Pitfall 5: A Dead or Optional Seam

**What goes wrong:** A port has a default real implementation inside the consumer or is used only by tests.

**How to avoid:** Make it required through production composition and add a forwarding/integration proof. Fallow's dead-code gate must remain green.

### Pitfall 6: Weakening Safety and Observable Assertions

**What goes wrong:** Call-log assertions replace exact errors, trees, notifications, cleanup, or ordering.

**How to avoid:** Retain all current observable assertions and add port interaction checks only where they prove the wiring itself.

## State of the Art in This Repository

| Old approach                                            | Current approved approach                            | Impact for Phase 5                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Module-global cache plus reset export                   | Factory-owned closure (`createManifestCache`)        | Copy the ownership pattern, not necessarily the exact API. [VERIFIED: domain/manifest-cache.ts:7-14,75-133]            |
| Broad fabricated SDK values                             | Consumer-owned typed ports                           | Keep new contracts narrow and production-shaped. [VERIFIED: Phase 04 verification:33-38]                               |
| Process-wide builtin mutation                           | Real temp tree or narrow production port             | Phase 5 supplies ports; Phase 6 removes mutation machinery. [VERIFIED: MF-DEC-07:88923-88948]                          |
| Export internal constant for architecture equality test | Independent literal pin plus public handler behavior | Remove `BOOLEAN_FLAGS` export and derived equality case. [VERIFIED: list.ts:26-82; flag-catalog-drift.test.ts:103-155] |

## Assumptions Log

| #   | Claim | Section | Risk if Wrong |
| --- | ----- | ------- | ------------- |

All implementation-relevant claims were verified against current source, CodeGraph call paths, the live revalidation ledger, or locked context. Exact type and file names in recommendations are intentionally discretionary design choices, not asserted current facts.

## Open Questions

1. **Should the marketplace-name in-memory reader survive?**
   - What we know: current production completion code directly rebuilds names; `getMarketplaceNames` and `memMarketplaceNames` have no production reader, while names-file invalidation remains live. [VERIFIED: current production `rg` census; data.ts:286-325]
   - What's unclear: the locked wording says preserve disk schemas and invalidation, but does not require retaining a dead memory optimization.
   - Recommendation: remove the dead memory/read surface after a task-local zero-consumer census; retain the schema and file invalidation. If another concurrent phase introduces a real reader, place it on the new instance instead.

2. **How should old callbacks be disposed across an actual Pi reload?**
   - What we know: current registration invalidates callbacks with generation checks and performs same-process child shutdown. [VERIFIED: event-router.ts:705-727]
   - What's unclear: whether Pi disposes registrations between separate extension-factory invocations is an external loader behavior not proven in this session.
   - Recommendation: preserve the current double-registration stale-callback regression on one runtime. Do not rely on an undocumented loader disposal guarantee; if factory invocations share a `pi` registration lifetime, store/replace the runtime through a production lifecycle owner exposed by that API, not a test reset.

## Environment Availability

Step 2.6 result: available local tooling is sufficient; this phase has no network service or new package dependency.

| Dependency | Required By                         | Available | Version   | Fallback                                                                                     |
| ---------- | ----------------------------------- | --------- | --------- | -------------------------------------------------------------------------------------------- |
| Node.js    | Typecheck/tests                     | ✓         | `v26.8.1` | Project floor is verbatim `"node": ">=20.19.0"`. [VERIFIED: local probe; package.json:32-34] |
| npm        | Scripts/gates                       | ✓         | `11.19.0` | — [VERIFIED: local probe]                                                                    |
| CodeGraph  | Required source/call-path discovery | ✓         | `1.6.0`   | Shell `codegraph explore` used. [VERIFIED: local probe; AGENTS.md:1-9]                       |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property            | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| Framework           | Node built-in `node:test` on local `v26.8.1`          |
| Config file         | No runner config; scripts live in `package.json`      |
| Quick run command   | `node --test <owner.test.ts>`                         |
| Direct-pair command | `npm run test:coverage:direct -- <changed-source.ts>` |
| Full suite command  | `npm run check`                                       |

[VERIFIED: package.json:75-96; .planning/codebase/TESTING.md:7-20]

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                                                                                    | Test type                        | Automated command                                                                                                                                                                                                                                                                                       | File exists?            |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| TREF-04 | Each authorized root has a real adapter and a narrow controllable port only for its classified case; apply/bootstrap remain behavioral compositions.        | Unit + integration/static census | Run each affected owner file with `node --test`, then direct-pair coverage for each changed source.                                                                                                                                                                                                     | ✅ Existing owner files |
| TREF-05 | Fresh hooks/cache instances isolate tests; one instance shares state across registration/read/mutation; reload and cross-operation invalidation still work. | Unit + integration               | `node --test tests/bridges/hooks/routing-state.test.ts tests/bridges/hooks/event-router.test.ts tests/bridges/hooks/settle.test.ts tests/bridges/hooks/async-rewake/registry.test.ts tests/shared/completion-cache.test.ts tests/edge/completions/data.test.ts tests/edge/completions/provider.test.ts` | ✅ Existing owner files |
| TREF-06 | Test-only exports/resets disappear while independent flag pins and public behavior remain.                                                                  | Architecture + unit              | `node --test tests/architecture/flag-catalog-drift.test.ts tests/bridges/hooks/routing-state.test.ts tests/shared/completion-cache.test.ts` plus zero-match `rg` checks                                                                                                                                 | ✅ Existing owner files |

### Recommended Task-Level Verification

1. Hooks state core: routing-state, settle, async registry, and event-router owner suites; then hooks integration suites.
2. Hooks consumer wiring: affected plugin orchestrator owners plus reconcile apply; verify stale callback and real reload behavior.
3. Completion factory/read path: completion-cache, completions data/provider, and command registration owner suites.
4. Completion invalidators: marketplace add/remove/update and plugin install/update/uninstall/reinstall owners; then a cross-operation command-to-completion proof.
5. Narrow ports: each production source with its direct owner; retain public outcomes and exact filesystem/notification/error assertions.
6. Public cleanup: architecture flag catalog, list-handler owner, hooks/cache owners, TypeScript, Fallow, and full check.

### Sampling Rate

- **Per task commit:** affected `node --test <owner files>` plus `npm run test:coverage:direct -- <changed source>`.
- **Per wave merge:** all affected hooks/cache/orchestrator owner suites and `npm run typecheck`.
- **Phase gate:** `npm run check`, current global-patch census recorded for Phase 6, and zero matches for removed test-only symbols.

### Required Static Acceptance Checks

- No production export named `BOOLEAN_FLAGS`, `resetEpoch`, `resetRoutingState`, or `resetCompletionCache`.
- No test import/call of those four surfaces.
- No newly added `__deps`, `ForTest`, optional real-adapter fallback, or `fallow-ignore` marker.
- Every new production `.ts` file has its corresponding owner test under the mirrored `tests/` path.
- `bridges/skills/stage.test.ts` and Phase 6 split ownership remain untouched.
- `createRequire`/`syncBuiltinESMExports` are inventoried but not removed in Phase 5.

### Wave 0 Gaps

None. Existing test infrastructure covers every requirement. New factory modules require paired owner files in the same task, not a framework/bootstrap wave.

## Security Domain

This is a local extension rather than a web application, so ASVS is used as a design lens, not a compliance claim.

### Applicable ASVS Categories

| ASVS Category         | Applies                              | Standard control                                                                                                  |
| --------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | No                                   | No authentication decision changes in this phase.                                                                 |
| V3 Session Management | No                                   | Hook session runtime is local lifecycle state, not an authenticated web session.                                  |
| V4 Access Control     | Yes, filesystem containment analogue | Preserve `assertPathInside` and symlink refusal on every real or injected inspection path.                        |
| V5 Input Validation   | Yes                                  | Preserve existing TypeBox cache validation and typed path/error contracts. [VERIFIED: completion-cache.ts:61-110] |
| V6 Cryptography       | No                                   | No cryptographic primitive is introduced or changed.                                                              |

### Known Threat Patterns

| Pattern                                            | STRIDE                                     | Standard mitigation                                                                                                                      |
| -------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Symlink/path escape hidden by a test double        | Elevation of privilege / Tampering         | Real temp-tree happy paths plus the same path-safety checks behind the injected inspector.                                               |
| Cross-extension or cross-test state leakage        | Information disclosure / Tampering         | Per-lifecycle hooks/cache instances with no global reset surface.                                                                        |
| Stale callback dispatch after reload               | Tampering / Denial of service              | Generation invalidation inside the real registration lifecycle.                                                                          |
| Killing an unrelated process during orphan cleanup | Denial of service / Elevation of privilege | Preserve marker verification, conservative skip, and existing `OrphanProbes`; no PID-table change. [VERIFIED: async registry.ts:524-535] |
| Stale completion after mutation                    | Tampering                                  | One cache instance shared by readers and invalidators; exact cross-operation test.                                                       |
| Test-only injection reachable in production        | Tampering                                  | Required composition wiring, no optional fallback, dead seam, or `__deps` member.                                                        |

## Project Constraints (from AGENTS.md)

- Because `.codegraph/` exists, use CodeGraph before grep/find or direct file reads when locating or understanding code. This research used `codegraph explore` for the hooks, completion, composition, and root call paths before targeted source reads. [VERIFIED: AGENTS.md:1-9]
- If CodeGraph is unavailable, the documented shell fallback is `codegraph explore "<symbol names or question>"`. [VERIFIED: AGENTS.md:4-7]

Additional established repository constraints that the planner must carry into tasks:

- Named exports, explicit exported return types, strict TypeScript, and ordered type-only imports. [VERIFIED: .planning/codebase/CONVENTIONS.md:88-113,158-168]
- Real case-owned temporary filesystems for ordinary state/config I/O; injected typed doubles only at legitimate external/fault boundaries. [VERIFIED: .planning/codebase/TESTING.md:41-91]
- Both ESLint and Fallow complexity/boundary gates apply; no new suppression is authorized. [VERIFIED: .planning/codebase/CONVENTIONS.md:30-75,142-145]
- New source modules require mirrored owner tests and direct source-test coverage. [VERIFIED: package.json:76,83-90]

## Sources

### Primary (HIGH confidence)

- `.planning/phases/05-injection-and-ownership-design/05-CONTEXT.md` — locked scope, decisions, discretion, and deferrals.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — MF-DEC-03 and MF-DEC-07 terminal authority.
- Current CodeGraph output and targeted source reads — exact call paths, state cells, production consumers, and test patch shapes.
- `extensions/pi-claude-marketplace/bridges/hooks/{routing-state,settle,event-router}.ts` and `async-rewake/registry.ts` — hooks state and lifecycle.
- `extensions/pi-claude-marketplace/shared/completion-cache.ts`, `edge/completions/data.ts`, and all current invalidator call sites — cache ownership.
- `extensions/pi-claude-marketplace/domain/manifest-cache.ts` — existing factory-owned state precedent.
- `tests/architecture/flag-catalog-drift.test.ts` and `edge/handlers/plugin/list.ts` — public-contract removal evidence.
- `package.json`, `tsconfig.json`, `.planning/codebase/TESTING.md`, and `.planning/codebase/CONVENTIONS.md` — validation and code conventions.

### Secondary (MEDIUM confidence)

None. No external documentation was needed because this is a codebase-specific refactor with no new package or API.

### Tertiary (LOW confidence)

None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified from current package, compiler, and local runtime.
- Architecture: HIGH — verified with CodeGraph and current line-numbered sources.
- Hidden-dependency classification: HIGH — rooted in MF-DEC-07 and inspected owner tests; semantic port names remain discretionary recommendations.
- Pitfalls: HIGH — derived from locked prohibitions and the current call graph.

**Research date:** 2026-09-07
**Valid until:** 2026-10-07, or until hooks/cache/edge composition changes materially.
