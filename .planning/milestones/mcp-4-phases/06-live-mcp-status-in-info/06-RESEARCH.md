# Phase 6: Live MCP status in info - Research

**Researched:** 2026-10-09
**Domain:** Pi 1.0 extension event bus, pi-mcp-adapter 5.1.0 status channel, `/claude:plugin info` rendering and the closed output catalog
**Confidence:** HIGH for code facts (read this session with file:line); MEDIUM for the runtime timing consequence (derived from source, not run live)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Status wording (Claude Code parity, see evidence record E1)
- **D-06-01:** Each adapter status renders in Claude Code's words, with one
  addition. Adapter `connected` -> `connected`; `cached` ->
  `cached, connects on first use`; `needs-auth` -> `needs authentication`;
  `blocked` -> `pending approval`; `disabled` -> `disabled`;
  `not-connected` -> `not connected`; `failed` -> `failed`. Claude's text map
  says `not connected` for a failed server; the adapter has a separate
  `failed` (failure backoff) and `not-connected` (never discovered, no cached
  tools), so `failed` takes Claude's `/mcp` panel word to keep a failure
  visible. — **Reversibility:** costly — closed-catalog tokens with byte
  locks; renaming them later changes pinned output.
- **D-06-02:** Claude's `cached (connects on first use)` renders with a comma,
  `cached, connects on first use`, because the status sits inside info's
  per-server parentheses and nested parentheses would read badly.

#### Placement on the row
- **D-06-03:** The status is the first item inside the server's existing
  parentheses on the `mcp:` line; the AVAR-04/05 lists follow after `;`.
  Example: `mcp: plugin:analytics:api (needs authentication; unset
  ANALYTICS_TOKEN), plugin:analytics:db (connected)`. A server with no other
  detail gets parentheses holding the status alone.
- **D-06-04:** No extra adapter details: no tool count, no failure age, no
  block reason. The adapter's own panel carries them.
- **D-06-05:** No remedy hint. Claude's status text gives none either.

#### Unknown states
- **D-06-06:** Two unknown tokens. `status unknown` when there is no usable
  snapshot: the adapter is absent, it has not published yet, or its last
  snapshot is the empty shutdown snapshot. `not loaded` when a usable
  snapshot exists but does not list the server's adapter key (for example
  the plugin was installed this session and the adapter has not read its
  config yet).
- **D-06-07:** When the adapter is not loaded, each server still shows
  `status unknown`, alongside the existing `requires: pi-mcp-adapter
  (missing)` line. One rule for every installed server (ASTAT-02 as written).

#### Rows, scopes, severity
- **D-06-08:** Only `(installed)` and `(partially-installed)` rows carry a
  status, and only on servers the record says were written. A `(disabled)`
  row shows none (its servers are out of the adapter config by design,
  ENBL-08); not-installed rows show none; a left-out server keeps its
  `(unsupported <feature>)` detail and gets no status.
- **D-06-09:** When the same plugin is installed in both scopes, both scopes'
  `mcp-adapter.json` hold the same key and the snapshot has one entry. Only
  the scope row whose entry the adapter actually loads shows the snapshot's
  status; the other row's server shows a closed token that says it is
  shadowed by the other scope (wording drafted as a catalog amendment).
  Research must confirm the adapter's precedence between the user and
  project files, and whether install even allows this case (D-02-03
  collision rule); if it cannot occur, this decision is moot and needs no
  token. — **Reversibility:** costly — adds a closed-catalog token.
- **D-06-10:** Status never changes info's severity; info stays `info`, as
  the `(missing)` companion tag does.

#### Settled going in (from the Phase Boundary, not re-discussed)
The tracker is created in the extension factory and injected through
`EdgeDeps`, the way `completionCache` is, never held as a module global
(ROADMAP note); the adapter is a soft dependency and is never imported
(STACK, RH-4); the status channel is push-only, so info reads the last cached
snapshot; ADET-01's `requires: pi-mcp-adapter (missing)` tag stays as it is;
ANAME-01 server names; the AVAR-04/05 `unset` / `withheld` lists stay in the
per-server parentheses.

### Claude's Discretion
- Snapshot validation shape (typebox schema of only the fields read), how a
  malformed or newer-version snapshot is treated (as no usable snapshot ->
  `status unknown` is the expected reading), tracker module name and
  location, and the subscription lifecycle across `/reload` and
  `session_shutdown`.
- Exact wording of the shadowed token (D-06-09), drafted as a closed-catalog
  amendment for operator review.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ASTAT-01 | `/claude:plugin info` shows each plugin MCP server's adapter state (for example connected, cached, needs-auth, failed) from the adapter's `pi-mcp-adapter/status/v1` events, without importing the adapter and without connecting servers. | Pi 1.0 `ExtensionAPI.events` bus (Q1); adapter publish points and resting states (Q2); key join `generatedMcpServerKey(plugin, declared)` (Q5); tracker in `platform/mcp-status.ts` (Q8); stamping post-pass beside `withCompanionRequirements` (Q4). |
| ASTAT-02 | Before the first status snapshot, or when the adapter is absent, info shows an explicit unknown state instead of guessing; new status tokens are closed-catalog amendments in `docs/output-catalog.md`. | Snapshot validation and the empty-snapshot rule (Q7); catalog amendment file set and count pins (Q6); enrollment tripwire in `notify-closed-set-locks.test.ts` (Q6). |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Upstream parity is the default; divergence needs a recorded decision ID or a Pi capability gap. D-06-01 records the `failed` divergence.
- All user-visible output goes through `shared/notification-dispatch.ts` (`notify()`); no `process.stdout`/`stderr`, no `console.*` in the extension (IL-2; fallow `no-stdio`, `no-console`, `notify-chokepoint`).
- `platform/pi-api.ts` is the only file that imports `@earendil-works/pi-coding-agent` (NFR-11; fallow `pi-peer-chokepoint`).
- No telemetry (IL-4). The status data is display-only: never persisted, never decides severity.
- `list`/`info` must not touch the network (NFR-5; ESLint BLOCK F gates every `orchestrators/` and `domain/` module outside `NETWORK_SEAMS`).
- TypeScript strict; every exported function declares its return type; Google-style review and comment skills apply to every `.ts` file; comments cite durable IDs (ASTAT-01, D-06-xx), never phase/plan numbers.
- Every production module has exactly one paired test at the mirrored path with 100% direct line/branch/function coverage; no test-only production surface; no module-global state; dependencies injected.
- `npm run check` must stay green at gates (typecheck, ESLint `--max-warnings 0`, fallow incl. boundaries/health/dupes/rule packs, Prettier, pairing, unit, integration, direct coverage). Do not run it during research.
- Tests that touch user scope use a hermetic `HOME` / `PI_CODING_AGENT_DIR`.
- Git: never commit to `main`; Conventional Commits; no GSD phase mentions in commits.

## Summary

Pi 1.0 gives every extension `pi.events`, a shared `EventBus` with `on(channel, handler) => unsubscribe` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:1360-1361]. All extensions loaded in one pass share one bus, the resource loader keeps that bus across `/reload`, and Pi itself unsubscribes every `pi.events` subscription an extension made when its runtime is invalidated after `session_shutdown` [VERIFIED: loader.js:145-160, 412-422; agent-session.js:2899-2903; resource-loader.js:243, 506]. Because `/reload` and every session replacement re-run our factory, a tracker created in the factory starts empty every time, so no snapshot can survive a reload. No `session_shutdown` handler is needed to unsubscribe.

pi-mcp-adapter 5.1.0 publishes on `"pi-mcp-adapter/status/v1"` with `version: 1` [VERIFIED: adapter types.ts:17-20]. It publishes an empty snapshot whenever it tears a session down, including at the start of every session (`shutdownState(previousState=null)` still emits the empty snapshot) [VERIFIED: adapter index.ts:313-319, 1337]. It publishes a full snapshot only after its runtime initializes. The key finding for planning: in a **deferred session** (every enabled server lazy, no project-file servers, valid metadata cache for each), the adapter never initializes at `session_start` and publishes nothing but that empty snapshot until the first MCP use (a tool call, `/mcp`, `/mcp-adapter`, a prompt command) [VERIFIED: adapter index.ts:751-773, 1373-1398, 1551-1553]. So under D-06-06, `status unknown` is the normal steady state of a warm, user-scope-only session until the user touches MCP. That is consistent with the locked decision, but the operator should know it before the catalog prose is written (Open Question 1).

D-06-09 can occur. The collision check exempts an entry marked for the same `plugin@marketplace` in any source [VERIFIED: bridges/mcp/stage.ts:147-182; marker.ts:130-133], and a test pins that the plugin's own entry in the other scope does not block install [VERIFIED: tests/bridges/mcp/stage.test.ts:1027]. The same plugin name from a different marketplace yields the same key and is refused. The adapter reads `<cwd>/.pi/mcp-adapter.json` ("pi-project") as its last, highest-precedence source, after `~/.pi/agent/mcp-adapter.json` ("pi-global") [VERIFIED: adapter config.ts:738-746, 812-821], and merges per field. So the **project** row owns the snapshot entry and the **user** row's same-named server gets the shadow token.

**Primary recommendation:** Add `platform/mcp-status.ts` with `createMcpStatusTracker(events)`. It validates `{version: 1, servers: [{name, status}]}` with typebox and keeps a `Map<key, status>`. It answers `lookup(key)` with one of the seven adapter statuses, `"unlisted"` or `"unknown"`. Thread it `index.ts -> EdgeDeps.mcpStatus -> makePluginInfoHandler -> GetPluginInfoOptions.mcpStatus` (required). Stamp it in a post-pass beside `withCompanionRequirements`, joining on `generatedMcpServerKey(plugin, recordedServer)`. Add a 10-member closed token union rendered first in the server's parentheses, and amend the catalog in the same change.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Subscribe to adapter status channel | platform/ (`mcp-status.ts`) | entry (`index.ts` creates it) | External-system boundary; `platform` may import only `shared` and `typebox` [VERIFIED: .fallowrc.json boundaries]. |
| Pi event-bus view type | platform/ (`pi-api.ts`) | — | Consumer-owned views of Pi API live in `pi-api.ts` (`PiInventory`, `NotificationContext`) [VERIFIED: pi-api.ts:133-163]. |
| Snapshot validation + latest cache | platform/ (`mcp-status.ts`) | — | Untrusted cross-extension input, validated at the boundary. |
| Injection to info | edge/ (`types.ts`, `register.ts`, `handlers/plugin/info.ts`) | entry | Same route as `completionCache` [VERIFIED: index.ts:73, 233-242; edge/types.ts:24-37]. |
| Decide per-server token (status, unknown, not loaded, shadow) | orchestrators/ (`plugin/info.ts` or a leaf `plugin/info-mcp-status.ts`) | persistence/ (project record read) | Commands determine state and stamp it; renderer only formats (memory: notify is a dumb renderer). |
| Render token text | shared/ (`notification-grammar.ts`) | shared/ (`notification-types.ts` union) | `mcpEntryText` already renders per-server parentheses [VERIFIED: notification-grammar.ts:1396-1407]. |
| Catalog contract | docs/ + tests/architecture/catalog-uat | — | Byte-equality gate between fixture messages and catalog blocks. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | 1.0.0 installed (peer `>=1.0.0`) | `ExtensionAPI.events: EventBus` | Already the project's host API [VERIFIED: package.json:18,59; types.d.ts:1360-1361] |
| `typebox` | 1.3.34 installed | Snapshot schema + `Compile` validator | Project's validation idiom (`Type` default import, `Compile` from `typebox/compile`, compiled once at module load) [VERIFIED: node_modules/typebox/package.json; persistence/agents-index-schema.ts:15-16] |
| `node:test`, `node:assert/strict`, `strong-mock` | in repo | Unit tests | Mandated by `skills/typescript-unit-testing` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pi-mcp-adapter` | 5.1.0 (optional peer `>=5.1.0 <6`, never installed in repo) | Integration conformance only, via `PI_MCP_ADAPTER_ROOT` | `tests/integration/*` only [VERIFIED: package.json:61; tests/integration/pi-mcp-adapter-peer.ts:66-80; ci.yml:116-125] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| String channel literal | `import { MCP_STATUS_EVENT } from "pi-mcp-adapter"` | Forbidden: soft dependency may be absent, static import breaks load (STACK RH-4). |
| `status: Type.String()` + closed lookup | `Type.Union` of 7 literals in the schema | A union rejects the whole snapshot when the adapter adds an 8th status in a minor release; per-server lookup degrades only that server to `status unknown`. |

**Installation:** none. No new package.

## Package Legitimacy Audit

No external packages are installed by this phase. `typebox`, `strong-mock` and the Pi peer are already in the lockfile; `pi-mcp-adapter` stays an optional peer that CI installs into `$RUNNER_TEMP` only.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Answers to the Planner's Questions

### Q1. How the extension gets `pi.events`

- Pi 1.0 declares `/** Shared event bus for extension communication. */ events: EventBus;` on `ExtensionAPI` [VERIFIED: dist/core/extensions/types.d.ts:1360-1361], with `export interface EventBus { emit(channel: string, data: unknown): void; on(channel: string, handler: (data: unknown) => void): () => void; }` [VERIFIED: dist/core/event-bus.d.ts].
- The bus is a Node `EventEmitter`. `emit` is synchronous, and `on` wraps the handler in `async (data) => { try { await handler(data); } catch (err) { console.error(\`Event handler error (${channel}):\`, err); } }` [VERIFIED: dist/core/event-bus.js:2-24]. **A throwing handler makes Pi print to stderr**, so the tracker's handler must be total.
- `pi.events.on` is tracked: `runtime.trackEventBusSubscription(eventBus.on(channel, handler))`, and `invalidate()` calls every tracked unsubscribe [VERIFIED: extensions/loader.js:145-160, 412-422]. Subscribing during the factory (`state === "loading"`) is allowed.
- What the project exposes today: `pi-api.ts` re-exports `ExtensionAPI` (type) and declares consumer-owned views (`NotificationUi`, `NotificationContext`, `ToolInventoryItem`, `CommandInventoryItem`, `PiInventory`) [VERIFIED: platform/pi-api.ts:45-63, 133-163]. **Nothing exposes `events` yet.** `index.ts` already holds `pi: ExtensionAPI`, so it can pass `pi.events` straight to the tracker. No new peer import is needed.
- Recommendation: add a consumer-owned view to `pi-api.ts`, for example `export interface PiEventSource { on(channel: string, handler: (data: unknown) => void): () => void; }`. `ExtensionAPI["events"]` satisfies it structurally. Add module-scope type evidence in `tests/platform/pi-api.test.ts` that `Peer.ExtensionAPI["events"]` is assignable to the view, beside the existing `void (true satisfies Same<...>)` lines [VERIFIED: tests/platform/pi-api.test.ts:84-95].

### Q2. Timing across the lifecycle

**Adapter publish points (5.1.0 source):**

| When | What is published | Evidence |
|------|-------------------|----------|
| Runtime finalization after init (after direct-tool surface sync) | full snapshot (`updateStatusBar` -> `publishMcpStatusSnapshot`) | `nextState.statusEvents = pi.events; ... loadedCoreRuntime.updateStatusBar(nextState)` [VERIFIED: index.ts:1186-1191; init.ts:697-700] |
| Every status/metadata change after that (connect, auth required, idle shutdown, failure backoff start/expiry, `/mcp` changes) | full snapshot | `recordFailure`/`clearFailure` [VERIFIED: init.ts:62-97]; `updateStatusBar` callers [VERIFIED: init.ts:541-553] |
| `session_start` (every reason: startup, reload, new, resume, fork) | **empty** snapshot first, via `shutdownState(previousState, "session_restart")`; with `previousState === null` it still emits `publishMcpStatusShutdown(pi.events)` | [VERIFIED: index.ts:313-319, 1305-1337] |
| `session_start`, deferred session | **nothing more** until first runtime use | `getDeferredSessionSnapshot` returns a config -> sync tools from cache, set footer, `return` without `startInitialization` [VERIFIED: index.ts:1373-1398] |
| `session_start`, non-deferred | full snapshot after async init | `startInitialization(ctx, owner, generation, "stale_session_start")` [VERIFIED: index.ts:1401] |
| `session_shutdown` | empty snapshot | `shutdownState(currentState, "session_shutdown")` [VERIFIED: index.ts:1462-1481] |
| Interrupted finalization | empty snapshot | [VERIFIED: index.ts:1220-1222] |

The adapter documents the same contract: "An initial snapshot is emitted after initialization, updates are emitted for status and metadata changes, and an empty snapshot is emitted when the session shuts down" [CITED: adapter docs/extension-api.md:248].

**Deferral condition** [VERIFIED: index.ts:751-773]: no project-file server definitions; no enabled `eager`/`keep-alive` server; and a valid metadata cache for every enabled server (unless `deferWithMissingMetadata`). Plugin entries leave `lifecycle` unset, so they default to lazy (ROADMAP settled point 3). **Consequence (MEDIUM, derived from source):** after the first session that discovered a newly installed server, later sessions with only user-scope plugin servers defer, so info reads `status unknown` until the user uses MCP. The first session after an install (no cache for the new server) and any session with project-scope plugin servers (project servers block deferral) initialize and publish. Runtime init triggers include direct-tool execution [VERIFIED: index.ts:491], the `mcp`/`mcp-adapter` commands [VERIFIED: index.ts:1551-1553, 1720-1722], prompt commands [VERIFIED: index.ts:819] and runtime tool calls [VERIFIED: index.ts:978].

**Resting states (success criterion 2):** status precedence is `blocked` > `disabled` > `connected` > `needs-auth` > `failed` (active backoff only) > `cached` (metadata present) > `not-connected` [VERIFIED: mcp-status.ts:36-54]. A lazy server that has not connected rests in `cached` (or `not-connected` when never discovered), and those render `cached, connects on first use` / `not connected`. `failed` appears only during the failure backoff window.

**Pi side:**
- One bus per resource loader, shared by every extension in the load pass [VERIFIED: loader.js:545-566 `resolvedEventBus`; resource-loader.js:243 `this.eventBus = options.eventBus ?? createEventBus()`, 506 `loadExtensionsCached(extensionPaths, this.cwd, this.eventBus)`].
- `/reload`: `await emitSessionShutdownEvent(oldRunner, ...)` then `oldRunner.invalidate()`, then `_resourceLoader.reload()` re-runs every factory, then `session_start` with `reason: "reload"` [VERIFIED: agent-session.js:2899-2930]. The adapter's empty shutdown snapshot reaches our old tracker before invalidation; the old tracker is then unsubscribed and dropped with its closure; the new factory run builds a fresh, empty tracker.
- Session replacement (`/new`, `/resume`, `/fork`): `teardownCurrent` emits `session_shutdown`, then `session.dispose()` invalidates, then a new runtime is created [VERIFIED: agent-session-runtime.js:102-112; agent-session.js:975-995]. Same outcome.
- **A cached snapshot from before a reload cannot be stale**, because the tracker object does not outlive the factory run. A snapshot published by the adapter's load-time initialization before our factory subscribes (only when an `eager`/`keep-alive` server exists, via `setImmediate`) is superseded at `session_start` by the empty snapshot and the re-init snapshot [VERIFIED: index.ts:1274-1292, 1337].

**Recommendation on lifecycle (discretion item):** subscribe once in the factory and keep no unsubscribe handle. Do **not** add a `session_shutdown` handler. Pi's invalidate already unsubscribes. An extra `pi.on("session_shutdown")` would add a strict-mock expectation to `tests/index.test.ts` and do nothing useful. Treat the empty snapshot as "no usable snapshot".

### Q3. D-06-09: can both scopes hold the same key, and who wins?

- **It can occur.** `otherDeclarers` drops any declaration `isOwnedBy(declaration.entry, check.pluginName, check.marketplaceName)`: "An entry marked for the same plugin never counts, whichever source holds it, because the adapter still loads one effective server (AFILE-05)" [VERIFIED: bridges/mcp/stage.ts:147-182]. `isOwnedBy` compares `m.plugin === plugin && m.marketplace === marketplace` [VERIFIED: bridges/mcp/marker.ts:130-133]. Test: `"AFILE-05: the plugin's own entry in the other scope's mcp-adapter.json does not block its install"` [VERIFIED: tests/bridges/mcp/stage.test.ts:1027].
- Same plugin name from a **different marketplace** has the same key (`plugin_<p>_<s>_` does not include the marketplace) and is refused as a collision. So the shared-key case is exactly the same `plugin@marketplace` in both scopes.
- **Precedence:** sources are pushed in order, and `pi-global` (`getPiGlobalConfigPath` = agent dir `mcp-adapter.json`) comes before `pi-project` (`resolve(cwd, getConfigDirName(), ADAPTER_CONFIG_NAME)`), which is pushed last [VERIFIED: config.ts:212-213, 233-235, 738-746, 812-821]. `mergeConfigs -> mergeServerMaps` merges per field, later wins [VERIFIED: config.ts:894-904, 913-972]. A project-file name is also registered as a project server (`if (source.scope === "project") ... projectServers.set(name, sourceRef)`) [VERIFIED: config.ts:494-501], so it is subject to project trust. A blocked project server is replaced by `{ ...definition, disabled: true }` and does **not** fall back to the user definition [VERIFIED: project-server-trust.ts:183-224].
- **So the project row owns the snapshot entry** (its status, including `blocked` -> `pending approval`), and the user row's server with the same key is shadowed.
- **How info knows:** use the project-scope install record, not the snapshot (the snapshot carries no source). The user row's server `s` is shadowed iff the project-scope state has `marketplaces[mp].plugins[p]` that is **enabled** (`!isRecordedButDisabled(record)` [VERIFIED: persistence/state-io.ts:293-295]) and whose `resources.mcpServers` includes `s`. A disabled project record has no adapter entry (ENBL-08), so the user entry loads and the user row gets the real status.
- `found` from `collectMarketplaceRecordsByScope` holds the project record only when the fan-out read project scope [VERIFIED: orchestrators/scope-fanout.ts:55-93]. With `--scope user`, info must read project state itself: `loadState(locationsFor("project", cwd).extensionRoot)`, read-only and network-free. Catch a load failure and treat it as "not shadowed", so a corrupt project state cannot fail a user-scope info.
- Known imprecision (LOW impact): `PI_MCP_CONFIG_MODE=exclusive` or `--mcp-config` makes the adapter read one file only [VERIFIED: config.ts:685-695], so the project entry is not loaded and the shadow attribution is wrong. Accept it and note it in the catalog prose if desired.
- **Token wording (discretion; draft for operator review):** recommend `overridden by project scope`. Claude Code 2.1.294 uses "overridden by" for a plugin defined in two places (`Plugin ${s} from --add-dir (${n[s]}) overridden by ${i} (${u})`) and "shadowed by local copy" for synced plugins [VERIFIED: grep of the 2.1.294 binary this session]. The project's reason vocabulary says `... in project scope` [VERIFIED: shared/notification-types.ts:56-57]. Alternative: `shadowed by project scope`.

### Q4. Where info builds and renders per-server detail

- `composeMcpEntries(pluginName, servers, dropped = [], scans?)` builds both arms. Written servers get `name: mcpServerDisplayName(pluginName, server)` plus `variableFields(scan)`. Left-out servers get `unsupportedFeature`. The result is sorted by name [VERIFIED: orchestrators/plugin/info.ts:1794-1809].
- Manifest arm: `composeResolvedComponents` passes `Object.keys(resolved.mcpServers)` (the **current on-disk declaration**, not the record) [VERIFIED: info.ts:1016-1027]. State-only arm: `composeMcpEntries(pluginName, record.resources.mcpServers)` [VERIFIED: info.ts:1738].
- Row status: `(installed)` from `buildInstalledRow`/`buildInstalledGitRow` [VERIFIED: info.ts:2169, 2279]. `(partially-installed)` from `derivePersistedInstalledStatus` or a `partially-available` re-resolve [VERIFIED: info.ts:1691-1695, 2326]. `applyDisabledRowShape` overrides to `"disabled"` [VERIFIED: info.ts:1502-1515]. A cold git clone or npm source renders `componentsResolved: false`, so there is **no `mcp:` line and no status** [VERIFIED: info.ts:2001-2018].
- ADET-01 probe path: one `const probe = softDepStatus(opts.pi)` per invocation [VERIFIED: info.ts:3030], applied by the post-pass `withCompanionRequirements(built, probe)` on both the single-block and fan-out paths [VERIFIED: info.ts:2957-2973, 3057, 3094].
- **Recommended join point:** a second post-pass applied at the same two sites, after `withCompanionRequirements`, e.g. `withMcpServerStatus(built, record, lookup)`. It only touches blocks whose `plugin.status` is `"installed"` or `"partially-installed"` and `componentsResolved === true`. For each `mcp` entry with no `unsupportedFeature`, it finds the recorded declared server whose `mcpServerDisplayName(plugin, server) === entry.name`. If none matches, the server is not in the record and gets no status (D-06-08). Otherwise it stamps the token. Display names are injective for a fixed plugin, so this match is exact. The block's own record comes from `found[i].record.plugins[opts.plugin]`.
- Types: `McpServerSummaryEntry { name; unsupportedFeature?; unsetVariables?; withheldVariables? }` [VERIFIED: shared/notification-types.ts:878-883]. Add `readonly status?: McpServerStatus`.
- Renderer today: `mcpEntryText` returns `` `${entry.name} (unsupported ${entry.unsupportedFeature})` `` for left-out entries, otherwise `parts = [...variablePart("unset", ...), ...variablePart("withheld", ...)]` joined by `"; "` [VERIFIED: shared/notification-grammar.ts:1396-1407]. Add the status as the first part: `parts = [...(entry.status ? [entry.status] : []), ...unset, ...withheld]`. This satisfies D-06-03 for both "status alone" and "status; unset ...".
- Consider extracting the stamping into a leaf `orchestrators/plugin/info-mcp-status.ts` with its own small paired test. `info.ts` is 3,136 lines and its test is 9,277 lines; a pure leaf keeps direct coverage tractable. It is still an orchestrator-zone module, so BLOCK F gates it and it must name no git surface.

### Q5. Key mapping and adapter-side normalization

- `generatedMcpServerKey(plugin, server)` returns `` `${mcpServerDisplayName(plugin, server).replaceAll(/[^A-Za-z0-9_-]/g, "_")}_` ``; `mcpServerDisplayName` returns `` `plugin:${plugin}:${server}` `` [VERIFIED: domain/name.ts:227-229, 248-252]. This is the only copy of the pattern.
- The record stores the **declared** server name: `StagedMcpRecord.generatedName` is documented as "The server's declared name, which state.json records. Its entry in mcp-adapter.json sits under `generatedMcpServerKey(plugin, name)`" [VERIFIED: bridges/mcp/types.ts:53-58]; install records `mcpServers: [...c.stagedMcpServerNames]` from `result.recorded.map((r) => r.generatedName)` [VERIFIED: orchestrators/plugin/install-outcome.ts:979, 1163].
- The adapter does **not** normalize config keys on load. Snapshot `name` is `Object.keys(state.config.mcpServers)` [VERIFIED: mcp-status.ts:20], and `loadMcpConfigWithSources` merges keys verbatim [VERIFIED: config.ts:462-545]. `foldedMcpServerKey` (`-` -> `_`) applies only to tool namespaces, not config keys [VERIFIED: name.ts:261-263]. So the lookup is an exact string match on `generatedMcpServerKey(plugin, recordedServer)`. Never match on display names or folded keys.
- Edge case: a legacy `mcp.json` entry that the reload move left in place (Phase 5 D-05-02) is served under its old name, so its new key is absent and info says `not loaded`. That is truthful for the plugin's key. Mention it in pitfalls, not in the code.

### Q6. Closed-catalog machinery and what an amendment touches

Precedent commits: `b645d820` (AVAR-04/05 lists) and `2502cbf3` (ADET-01 `requires:`) [VERIFIED: git show --stat]. An amendment touches:

1. `shared/notification-types.ts`: the new token union (and its doc comment with the decision IDs), plus `status?` on `McpServerSummaryEntry`.
2. `shared/notification-grammar.ts`: render the token (no glyph change, so the COMPAT-01 `ICON_*` declaration count is untouched [VERIFIED: compat-01-no-expansion.test.ts:186, 596-606]).
3. `docs/output-catalog.md`: a prose paragraph in the info section preamble (beside the "Companion line (ADET-01, closed-catalog amendment)" paragraph at line 2590), a token table, new `<!-- catalog-state: ... -->` blocks, **and edits to the existing installed states whose `mcp:` line now carries a status**: `installed-with-missing-companion` (line ~2702, becomes `(status unknown)`), `installed-with-every-companion` (~2717) and `installed-with-mcp-variables` (~2970, e.g. `(needs authentication; unset ...)`).
4. `tests/architecture/catalog-uat/fixtures/plugin-info.ts`: a fixture message per new state, and `status` on the three existing fixtures.
5. `tests/architecture/catalog-uat/catalog-contract.test.ts`: `EXPECTED_STATE_COUNT = 266` and `EXPECTED_UTF8_BYTES = 40_785` (sum of example-block bytes) plus the test title [VERIFIED: catalog-contract.test.ts:38-40, 337-342].
6. `tests/architecture/catalog-uat/catalog-parser.test.ts`: the `266` in the title and assertion [VERIFIED: catalog-parser.test.ts:69-74].
7. `tests/architecture/notify-closed-set-locks.test.ts`: add a hand-written `Record<McpServerStatus, true>` enrollment and an exact-length test, following the `Reason`/`StatusToken` pattern ("a `Record<Reason, true>` is exhaustive in both directions ... Bump the expected count in the SAME change that grows the set") [VERIFIED: notify-closed-set-locks.test.ts:1-25, 187-221].
8. Optional: the `compat-01-no-expansion.test.ts` enumeration clause pins `Reason`, `StatusToken`, `PluginStatus` and `MarketplaceStatus` only. The new union is not one of those, so no edit is required there (research ARCHITECTURE.md: "NOT a `StatusToken`").

Note: the research doc's `lint:type-members` / `scripts/check-unused-type-members.contracts.json` gate **no longer exists**. `package.json` has no such script and `scripts/` has no such file [VERIFIED: package.json scripts; ls scripts/]. Ignore that row of `.planning/research/ARCHITECTURE.md`.

Every token must appear in at least one catalog example so the byte gate pins it. Recommended states: (a) a plugin with several servers covering `connected`, `cached, connects on first use`, `needs authentication; unset ...`, `failed`; (b) `pending approval`, `disabled`, `not connected`; (c) `not loaded`; (d) `status unknown` (the updated ADET-01 state covers it); (e) a both-scopes fan-out with the project row's status and the user row's shadow token. Planner may merge (a) and (b).

### Q7. Snapshot validation

Recommended schema, compiled once at module load. Only the fields read are declared. `Type.Object` allows extra properties by default:

```ts
// Source: project idiom, persistence/agents-index-schema.ts:15-16; adapter types.ts:39-58
import Type from "typebox";
import { Compile } from "typebox/compile";

const MCP_STATUS_SNAPSHOT = Compile(
  Type.Object({
    version: Type.Literal(1),
    servers: Type.Array(Type.Object({ name: Type.String(), status: Type.String() })),
  }),
);
```

Probe run this session against the installed typebox 1.3.34 [VERIFIED: node run, output `real true / v2 false / empty true / null false badserver false`]: a full adapter-shaped snapshot with extra fields passes; `version: 2` fails; `{version:1, servers:[]}` passes the schema (so emptiness is a separate rule); `null` and a non-string `name` fail.

Reading rules:
- Payload fails `Check` (malformed, `version !== 1`, not an object) -> no usable snapshot -> every lookup `status unknown`. The latest payload **replaces** the cache even when invalid, because keeping the previous one would be a guess.
- `servers.length === 0` -> no usable snapshot. The adapter's shutdown snapshot is byte-identical to a zero-server config snapshot [VERIFIED: mcp-status.ts:95-105 vs 13-80], so the two cannot be told apart. Both read `status unknown`, which matches D-06-06.
- Per server, `status` outside the seven known values -> that server `status unknown`. Other servers are unaffected.
- Copy into a private `Map<string, string>` at receipt. Never keep or render the payload object, `blockedReason`, or any raw string from it.
- Adapter status set to mirror, verbatim: `"connected" | "cached" | "failed" | "needs-auth" | "not-connected" | "blocked" | "disabled"` [VERIFIED: adapter types.ts:22-29].

### Q8. Architecture gates and module placement

- Fallow zones [VERIFIED: .fallowrc.json `boundaries`]: `entry` may import `edge, orchestrators, bridges-hooks, persistence, platform, shared`; `edge` may import `orchestrators, domain, shared, platform`; `orchestrators` may import `platform` and others; `platform` may import `shared` only. So `platform/mcp-status.ts` is reachable from `index.ts`, `edge/types.ts`, `edge/handlers/plugin/info.ts` and `orchestrators/plugin/info*.ts`, and the tracker must import nothing but `typebox` and `platform/pi-api.ts` (same zone) or `shared/`.
- ESLint BLOCK C: "platform/ may only import from shared/" and "edge/ may only import from orchestrators/, domain/, shared/, platform/" [VERIFIED: eslint.config.js:231, 281-291].
- BLOCK F (NFR-5) covers `orchestrators/` and `domain/`. `info.ts` and any new leaf must not name `platform/git`, `gitOps`, etc. The tracker is under `platform/` and touches no network.
- Rule packs: no new peer import (only `pi-api.ts` may), no `console`/stdio, no network modules. `typebox` is unrestricted (already imported by `domain/`, `persistence/`, `edge/handlers/tools.ts`).
- `no-test-only-production-surface.test.ts`: no `_setForTest`, no reset hooks. The factory-owned tracker satisfies this.
- Pairing: `extensions/pi-claude-marketplace/platform/mcp-status.ts` -> `tests/platform/mcp-status.test.ts` (100% direct coverage alone). A new leaf `orchestrators/plugin/info-mcp-status.ts` -> `tests/orchestrators/plugin/info-mcp-status.test.ts`.

### Q9. Testing without the adapter

- Unit: build the real tracker over a plain stub event source that captures the handler (`{ on: (channel, handler) => { captured.push({channel, handler}); return () => {}; } } satisfies PiEventSource`), then call the handler with literal payloads. Alternatively use Pi's own `createEventBus()` from the peer in tests (tests may import the peer; the chokepoint covers `extensions/**` only). The real tracker is pure, so no `*-fake.ts` module is needed.
- `tests/index.test.ts` uses a strict `strong-mock` `ExtensionAPI` from `tests/edge/notification-boundary.ts` [VERIFIED: notification-boundary.ts:118-126; index.test.ts:262-395]. The factory's new `pi.events` read needs `when(() => pi.events).thenReturn(bus)` with an exact count. A case can then emit a snapshot through the captured handler and run `/claude:plugin info` through the captured command to prove the factory-to-info wiring.
- `tests/orchestrators/plugin/info.test.ts` calls `getPluginInfo({...})` 156 times [VERIFIED: grep count of `makeCtx()`]. With `mcpStatus` required, add a local wrapper in that test file that supplies a no-snapshot tracker by default. Existing installed-row expectations with an `mcp:` line change to `(status unknown)`: lines 2103, 2148, 2646, 4228, 7157 [VERIFIED: row status read beside each]. Lines 3047 (disabled), 6873, 7046, 7195 (available) do not change.
- Integration against real adapter 5.1.0 (CI installs it, `PI_MCP_ADAPTER_ROOT`): the adapter's `exports["./types"]` ships `dist/types.js` with `export const MCP_STATUS_EVENT = "pi-mcp-adapter/status/v1"; export const MCP_STATUS_SNAPSHOT_VERSION = 1;` [VERIFIED: dist/types.js:3-4; package.json exports]. `mcp-status.ts` ships **only as TS source** (no `dist/mcp-status.js`), and Node refuses to strip types under `node_modules`, so the snapshot builder cannot run in an integration test [VERIFIED: ls dist]. Recommended conformance test: `tests/integration/mcp-status-conformance.test.ts` loads `dist/types.js` through `importPeerModule`, publishes on a real `createEventBus()` using the adapter's own `MCP_STATUS_EVENT`, with `version: MCP_STATUS_SNAPSHOT_VERSION` and a server entry shaped like `McpServerStatusSnapshot`, and asserts the tracker reads it. It skips only when `PI_MCP_ADAPTER_ROOT` is unset, as the existing conformance tests do [VERIFIED: tests/integration/adapter-expansion-conformance.test.ts:14, 76, 166].
- A live proof against the real adapter (including the deferred-session reading) belongs to the Phase 7 live UAT. The existing RPC e2e `tests/e2e/adapter-detection-rpc.test.ts` asserts only the `requires:` lines [VERIFIED: lines 41, 419-495], so this phase does not break it. Optionally, a stand-in fixture extension there could emit one snapshot to prove the real Pi bus path.

## Architecture Patterns

### System Architecture Diagram

```text
pi-mcp-adapter (other extension)
  init/finalize ─┐  changes ─┐  session_start/shutdown ─┐
                 ▼           ▼                          ▼  (empty snapshot)
           pi.events.emit("pi-mcp-adapter/status/v1", snapshot)
                              │  shared EventBus (one per resource loader)
                              ▼
index.ts factory ── createMcpStatusTracker(pi.events) ──► handler: Check(schema)?
                              │                               ├─ invalid / version≠1 / servers=[] → latest = none
                              │                               └─ valid → latest = Map<key, status>
                              ▼
EdgeDeps.mcpStatus ─► register.ts ─► makePluginInfoHandler(pi, mcpStatus)
                              │
/claude:plugin info p@m ──────┘─► getPluginInfo({..., mcpStatus})
     buildBlock (per scope) → withCompanionRequirements → withMcpServerStatus
          for row status ∈ {installed, partially-installed}, componentsResolved:
            for each written entry matched to record.resources.mcpServers:
              key = generatedMcpServerKey(plugin, server)
              user row && project record enabled && lists server → "overridden by project scope"
              lookup(key): "unknown" → "status unknown"; "unlisted" → "not loaded";
                           adapter status → D-06-01 word
          → notify(ctx, pi, block)  (severity unchanged)
               └─ notification-grammar mcpEntryText: name (status; unset ...; withheld ...)
```

Precedence when building one entry's token (recommendation): (1) no usable snapshot -> `status unknown` (D-06-07: one rule, even in the both-scopes case); (2) user row shadowed by an enabled project record listing the server -> shadow token; (3) key not in snapshot -> `not loaded`; (4) mapped adapter status. Open Question 2 asks the operator to confirm (1) before (2).

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── platform/pi-api.ts               # + PiEventSource view
├── platform/mcp-status.ts           # NEW: createMcpStatusTracker, schema, lookup
├── edge/types.ts                    # EdgeDeps + mcpStatus
├── edge/register.ts                 # makePluginInfoHandler(pi, deps.mcpStatus)
├── edge/handlers/plugin/info.ts     # pass mcpStatus into getPluginInfo
├── orchestrators/plugin/info.ts     # GetPluginInfoOptions.mcpStatus (required); post-pass call
├── orchestrators/plugin/info-mcp-status.ts  # NEW (recommended): stamping + adapter→token map
├── shared/notification-types.ts     # McpServerStatus union; McpServerSummaryEntry.status?
├── shared/notification-grammar.ts   # status first in parentheses
└── index.ts                         # create tracker, thread into deps
```

### Pattern 1: Factory-owned tracker (no module global)

```ts
// Source: recommended; mirrors createCompletionCache wiring (index.ts:73, 233-242)
export type McpServerRuntimeStatus =
  | "connected" | "cached" | "failed" | "needs-auth" | "not-connected" | "blocked" | "disabled";
export type McpServerLookup = McpServerRuntimeStatus | "unlisted" | "unknown";
export interface McpStatusReader {
  lookup(key: string): McpServerLookup;
}

export function createMcpStatusTracker(events: PiEventSource): McpStatusReader {
  let latest: ReadonlyMap<string, string> | undefined;
  events.on("pi-mcp-adapter/status/v1", (data) => {
    latest = readSnapshot(data); // total: never throws (Pi prints handler throws to stderr)
  });
  return {
    lookup(key) {
      if (latest === undefined) return "unknown";
      const status = latest.get(key);
      if (status === undefined) return "unlisted";
      return isRuntimeStatus(status) ? status : "unknown";
    },
  };
}
```

### Pattern 2: Total map from adapter status to Claude words (compile-time totality)

```ts
// Source: OUT-03 total-map idiom used in info.ts ("as const satisfies" over a closed union)
const ADAPTER_STATUS_TOKENS = {
  connected: "connected",
  cached: "cached, connects on first use",
  "needs-auth": "needs authentication",
  blocked: "pending approval",
  disabled: "disabled",
  "not-connected": "not connected",
  failed: "failed",
} as const satisfies Record<McpServerRuntimeStatus, McpServerStatus>;
```

The `McpServerStatus` union (in `notification-types.ts`) holds the ten display tokens. The seven above are locked by D-06-01/02. `status unknown` and `not loaded` are locked by D-06-06. The shadow token wording is the operator's call.

### Anti-Patterns to Avoid
- **Module-global snapshot cell:** forbidden by the ROADMAP note and by no-test-only-production-surface; it would leak across reloads in tests.
- **Rendering anything from the payload:** a spoofed or hostile emitter on the shared bus could inject terminal text. Render only closed tokens chosen by our own code.
- **Optional `mcpStatus` on `GetPluginInfoOptions` / `EdgeDeps`:** an omitted field would silently drop status on a production path (memory: optional-field silent-omission class). Make it required and default it in tests with a local wrapper.
- **Gating status on `softDepStatus`:** D-06-07 wants `status unknown` beside `(missing)`. The tracker alone decides; the probe stays independent.
- **Matching snapshot names by display name or folded key:** the snapshot uses raw config keys.
- **Stamping servers the record does not list:** the manifest arm lists current on-disk servers, which can differ from what install wrote (D-06-08).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payload validation | ad-hoc `typeof` ladders | `typebox` `Compile` | Project idiom, compiled once, tested pattern |
| Server key | new string formatting | `generatedMcpServerKey` (domain/name.ts) | "This is the only copy of the pattern" |
| Display name match | parsing `plugin:<p>:<s>` | `mcpServerDisplayName(plugin, server)` comparison | Injective, same source as rendering |
| Disabled check | `record.enabled === false` | `isRecordedButDisabled` | Single definition of disabled-ness |
| Event bus in tests | custom emitter | stub `{ on }` or peer `createEventBus()` | Real semantics, no fake module needed |
| Adapter channel constant | importing the adapter | string literal in the tracker, conformance-tested against `dist/types.js` | Adapter is a soft dependency |

## Common Pitfalls

### Pitfall 1: The deferred session publishes no live snapshot
**What goes wrong:** the operator expects `cached, connects on first use` in a fresh session but sees `status unknown`.
**Why:** the adapter defers runtime init when all servers are lazy, no project servers exist and metadata is cached. It emits only the empty snapshot at `session_start` [VERIFIED: index.ts:751-773, 1337, 1373-1398].
**How to avoid:** state it in the catalog prose for `status unknown` and in Phase 7 docs. Do not trigger adapter init from info: that would connect or discover servers, which ASTAT-01 forbids.
**Warning signs:** UAT reports "status unknown everywhere" right after `pi` starts.

### Pitfall 2: A handler throw prints to stderr
**What goes wrong:** Pi's bus logs `console.error("Event handler error ...")` [VERIFIED: event-bus.js:9-16], a visible IL-2-style leak.
**How to avoid:** the handler only calls `Check` and builds a Map. Test it with `null`, strings, arrays, objects without `servers`, and servers with non-string names.

### Pitfall 3: Over-strict schema
**What goes wrong:** a literal union for `status` rejects the whole snapshot when the adapter adds a status.
**How to avoid:** `status: Type.String()` plus a closed lookup. An unknown value maps to `status unknown` for that server only.

### Pitfall 4: Byte churn in existing tests and catalog
**What goes wrong:** gates go red in unrelated-looking places.
**How to avoid:** plan the edits: info.test.ts installed rows (lines 2103, 2148, 2646, 4228, 7157), the three catalog states, both count pins (state count, UTF-8 bytes), the parser count, and the strict `pi.events` expectation in `tests/index.test.ts` / `tests/edge/notification-boundary.ts`. Also update `tests/edge/register.test.ts`, `tests/edge/types.test.ts` and `tests/edge/handlers/plugin/info.test.ts` (7 `makePluginInfoHandler(pi)` sites) for the new parameter.

### Pitfall 5: Shadow detection under `--scope user`
**What goes wrong:** the user row shows the project definition's status as its own.
**How to avoid:** read the project record even when only user scope is rendered; catch read failures.

### Pitfall 6: `pending approval` covers three block reasons
`blocked` means untrusted project, approval required (headless), or approval denied [VERIFIED: project-server-trust.ts:35-44]. D-06-01 maps all three to `pending approval` and D-06-04 omits the reason. Say so in the catalog prose so the "denied" case is not read as a bug.

### Pitfall 7: Left-in-place legacy entries read `not loaded`
A Phase 5 left-in-place `mcp.json` entry is loaded under its old name, so the new key is absent. That reading is truthful and needs no special case.

## Code Examples

### Rendering the status first (grammar)

```ts
// Source: extends shared/notification-grammar.ts:1396-1407
function mcpEntryText(entry: McpServerSummaryEntry): string {
  if (entry.unsupportedFeature !== undefined) {
    return `${entry.name} (unsupported ${entry.unsupportedFeature})`;
  }

  const parts = [
    ...(entry.status === undefined ? [] : [entry.status]),
    ...variablePart("unset", entry.unsetVariables),
    ...variablePart("withheld", entry.withheldVariables),
  ];
  return parts.length === 0 ? entry.name : `${entry.name} (${parts.join("; ")})`;
}
```

Target bytes (D-06-03): `    mcp: plugin:analytics:api (needs authentication; unset ANALYTICS_TOKEN), plugin:analytics:db (connected)`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse `/mcp-adapter` or `mcp({})` text | Subscribe to `pi-mcp-adapter/status/v1` | adapter 5.0.0 | Machine-readable, push-only, never connects |
| `lint:type-members` contracts gate | removed | before this phase | The research ARCHITECTURE.md row about repinning is stale |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | In a warm user-scope-only session, info shows `status unknown` until first MCP use (inferred from adapter source, not run live) | Q2, Pitfall 1 | Catalog prose would describe the wrong steady state; Phase 7 UAT should confirm |
| A2 | `overridden by project scope` is acceptable wording for the D-06-09 token | Q3 | Costly to rename after byte locks; needs operator review before catalog lands |
| A3 | Ordering "no usable snapshot beats shadow" is the intended reading of D-06-07 for the both-scopes case | Architecture diagram | Shadow token would be missing when the adapter is absent; one catalog state changes |
| A4 | Status-free rows for `components: not resolved` installed rows (cold git clone, npm source) are acceptable under ASTAT-01 "each plugin MCP server" | Q4 | A cold-clone installed plugin's servers show no status at all; would need a record-based `mcp:` line, outside D-06-03 |

## Open Questions

1. **Deferred-session steady state reads `status unknown`.**
   - What we know: the adapter publishes only an empty snapshot in deferred sessions until first runtime use (source lines above).
   - What's unclear: whether the operator wants the catalog prose to say so explicitly, or wants a different token for "adapter loaded but idle". The latter would amend D-06-06.
   - Recommendation: keep D-06-06 as locked; document the case in the `status unknown` prose; verify in Phase 7 UAT.
2. **Shadow vs unknown precedence (D-06-07 vs D-06-09).**
   - Recommendation: no usable snapshot -> `status unknown` on every row (D-06-07's "one rule"). Apply the shadow token only when a usable snapshot exists. Confirm with the operator.
3. **Shadow token wording** — draft `overridden by project scope`; alternative `shadowed by project scope`.
4. **`components: not resolved` installed rows** carry no `mcp:` line today, so they get no status. Recommend leaving this alone (no change to the not-resolved shape); confirm.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all tests | ✓ | v26.11.0 (CI uses 24) | — |
| `@earendil-works/pi-coding-agent` | `pi.events` type, test bus | ✓ | 1.0.0 | — |
| `typebox` | schema | ✓ | 1.3.34 | — |
| pi-mcp-adapter scratch install | integration conformance | ✓ | 5.1.0 at `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter` | test skips when `PI_MCP_ADAPTER_ROOT` unset |
| Claude Code binary (parity grep) | wording evidence | ✓ | 2.1.294 | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` |
| Config file | none (npm scripts in `package.json`) |
| Quick run command | `node --test tests/platform/mcp-status.test.ts` (or the owner test being edited) |
| Full suite command | `npm run check` (gate only; do not run per task) |
| Pair coverage | `npm run test:coverage:direct -- <source path>` |
| Integration | `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter node --test tests/integration/mcp-status-conformance.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ASTAT-01 | Tracker subscribes once on `"pi-mcp-adapter/status/v1"` and maps a valid snapshot's seven statuses | unit | `node --test tests/platform/mcp-status.test.ts` | ❌ Wave 0 |
| ASTAT-01 | Key join uses `generatedMcpServerKey(plugin, recorded)`; record-unlisted servers get no status; disabled/not-installed/left-out get none | unit | `node --test tests/orchestrators/plugin/info-mcp-status.test.ts` (or info.test.ts) | ❌ / ✅ |
| ASTAT-01 (SC2) | `cached` -> `cached, connects on first use`, `not-connected` -> `not connected` (resting, not failure) | unit + catalog | `node --test tests/orchestrators/plugin/info.test.ts`; catalog contract | ✅ |
| ASTAT-01 | Never imports adapter, never connects: no adapter import in `extensions/**`; channel conformance with real 5.1.0 constants | static + integration | `npm run fallow` (rule packs); `node --test tests/integration/mcp-status-conformance.test.ts` | ❌ Wave 0 |
| ASTAT-01 | Factory creates tracker from `pi.events`, info reflects an emitted snapshot | unit | `node --test tests/index.test.ts` | ✅ (edit) |
| ASTAT-02 (SC3) | No snapshot, empty snapshot, malformed, `version: 2`, adapter absent -> `status unknown`; usable snapshot without key -> `not loaded` | unit | `node --test tests/platform/mcp-status.test.ts`; `node --test tests/orchestrators/plugin/info.test.ts` | ❌ / ✅ |
| ASTAT-02 (SC3) | Adapter absent: `status unknown` beside `requires: pi-mcp-adapter (missing)`; severity stays info | unit + catalog | info.test.ts; catalog `installed-with-missing-companion` | ✅ (edit) |
| D-06-09 | Both scopes: project row status, user row shadow token, also under `--scope user`; disabled project record does not shadow | unit | info.test.ts (hermetic HOME, both state files) | ✅ (new cases) |
| ASTAT-02 (SC4) | Every token in catalog, byte-locked; token-set enrollment count | architecture | `npm run test:unpaired` (catalog-contract, catalog-parser, notify-closed-set-locks) | ✅ (edit) |
| D-06-03 | Status first, `;` before AVAR lists, status alone in parens | unit | `node --test tests/shared/notification-grammar.test.ts` | ✅ (edit) |

### Sampling Rate
- **Per task commit:** the owner test(s) via `node --test <path>`; the pre-commit hook runs `check:commit` for staged pairs.
- **Per wave merge:** `npm run check`.
- **Phase gate:** full `npm run check` green before `/gsd-verify-work`; integration conformance run with `PI_MCP_ADAPTER_ROOT` set.

### Wave 0 Gaps
- [ ] `tests/platform/mcp-status.test.ts` — pairs the new tracker (covers ASTAT-01/02 tracker behavior)
- [ ] `tests/orchestrators/plugin/info-mcp-status.test.ts` — if the stamping leaf is extracted
- [ ] `tests/integration/mcp-status-conformance.test.ts` — channel/version conformance vs adapter 5.1.0 `dist/types.js`; add a `dist/types.js` loader to `tests/integration/pi-mcp-adapter-peer.ts`
- [ ] Local wrapper in `tests/orchestrators/plugin/info.test.ts` supplying a default no-snapshot tracker

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (status `needs-auth` is display only; no credential handling) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | typebox `Compile` schema of the read fields; closed per-server status lookup |
| V6 Cryptography | no | — |
| V7 Error handling / logging | yes | handler is total; no stderr, no `console.*` (IL-2) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Any extension emits a forged snapshot on the shared bus | Spoofing | Display-only data; never persisted, never drives severity or actions; only closed tokens rendered |
| Payload carries control characters / long strings | Tampering (terminal injection) | Never render payload strings (names, `blockedReason`); lookup by our own key; render our own tokens |
| Malformed payload crashes handler | Denial of service | Total handler; schema `Check` returns boolean; invalid -> `status unknown` |
| Disclosure of server config | Information disclosure | Snapshot carries no definitions (adapter docs); we read only `name`/`status` |

## Sources

### Primary (HIGH confidence)
- Pi 1.0.0 in `node_modules/@earendil-works/pi-coding-agent/dist/core/`: `event-bus.js`, `event-bus.d.ts`, `extensions/loader.js` (105-160, 189-200, 405-425, 500-570), `extensions/types.d.ts:1360-1361`, `agent-session.js:975-995, 2899-2930`, `agent-session-runtime.js:102-112`, `resource-loader.js:238-246, 498-510`.
- pi-mcp-adapter 5.1.0 source at `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter/`: `types.ts:17-58`, `mcp-status.ts:1-112`, `init.ts:50-110, 540-560, 690-705`, `index.ts:313-319, 751-773, 1072-1240, 1262-1292, 1305-1401, 1462-1481, 1545-1558, 1720-1722`, `config.ts:212-239, 453-545, 679-821, 894-972`, `project-server-trust.ts:35-66, 183-245`, `docs/extension-api.md:234-248`, `dist/types.js:3-4`.
- Repository: `platform/pi-api.ts`, `index.ts`, `edge/types.ts`, `edge/register.ts`, `edge/handlers/plugin/info.ts`, `orchestrators/plugin/info.ts`, `orchestrators/scope-fanout.ts`, `orchestrators/edge-deps.ts`, `shared/notification-types.ts`, `shared/notification-grammar.ts`, `domain/name.ts`, `bridges/mcp/{stage,marker,types,legacy}.ts`, `persistence/state-io.ts`, `.fallowrc.json`, `eslint.config.js`, `package.json`, `.github/workflows/ci.yml`, `tests/architecture/{catalog-uat/*,notify-closed-set-locks,compat-01-no-expansion,closed-set-enrollment,gate-targets}.ts`, `tests/index.test.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/integration/{pi-mcp-adapter-peer,optional-peer}.ts`, `docs/output-catalog.md`, git commits `b645d820`, `2502cbf3`.
- typebox 1.3.34 behavior probe (node run this session).

### Secondary (MEDIUM confidence)
- Claude Code 2.1.294 binary strings (`overridden by`, `shadowed by local copy`), grep this session.
- `.planning/research/{ARCHITECTURE,FEATURES,PITFALLS,STACK}.md` (milestone research; one stale gate row noted).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; versions read from installed packages.
- Architecture: HIGH — zones, wiring and join points read from source with line numbers.
- Pitfalls: HIGH for code-level pitfalls; MEDIUM for the deferred-session runtime consequence (source-derived, not run live).

**Research date:** 2026-10-09
**Valid until:** 2026-11-08 (pi-mcp-adapter moves fast; re-check `index.ts` deferral and `types.ts` status union on any adapter bump)
