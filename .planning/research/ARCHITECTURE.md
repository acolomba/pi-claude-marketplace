# Architecture Research

**Domain:** Pi extension bridge -- Claude plugin MCP servers served by either of two equal MCP implementations (pi-mcp-adapter 7.x, or Pi 1.5.0's built-in MCP)
**Milestone:** mcp-builtin
**Researched:** 2026-11-04
**Confidence:** HIGH for the integration map and the Pi event order (read from this repo's source and from the `@earendil-works/pi-coding-agent@1.5.0`, `pi-mcp-adapter@7.0.0` and `pi-subagents@0.84.0` tarballs). MEDIUM for the phase decomposition, which is a judgment built on the component-features precedent.

The research sets out the proposed `McpImplementation` design from the brief, checks it against the code as it is now, and splits the work into phases that own disjoint files. Every `file:line` below is relative to `extensions/pi-claude-marketplace/` unless it names another root. "Pi dist" means the unpacked `@earendil-works/pi-coding-agent@1.5.0` package.

---

## Standard Architecture

### System Overview (target)

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ entry: index.ts                                                              │
│  session_start ──► orchestrators/mcp/session-materialize.ts (NEW, frozen)     │
│                     1 settings-cleanup step  2 builtin-registration step       │
│                     3 agent-grants step                                       │
│  resources_discover ──► loadReconcile ... then builtin re-sync (autoapply)     │
└───────────────┬───────────────────────────────────────┬──────────────────────┘
                │ run.softDeps.mcpImplementation (D-05 snapshot, per run)      │
                ▼                                       ▼
┌──────────────────────────────┐   ┌───────────────────────────────────────────┐
│ edge/ + orchestrators/plugin │   │ orchestrators/mcp/ (NEW subdir, same zone)│
│ list / info / install /      │   │ active-profile selection, step modules,    │
│ apply read effective verdicts│   │ settings cleanup composition               │
└───────┬──────────────────────┘   └──────┬───────────────┬────────────────────┘
        │                                 │               │
        ▼                                 ▼               ▼
┌──────────────────────┐  ┌────────────────────────┐  ┌───────────────────────┐
│ domain/              │  │ bridges/mcp/           │  │ bridges/agents/       │
│ mcp-implementation.ts│  │ adapter: stage/unstage │  │ convert.ts takes the  │
│ (NEW, frozen):       │  │ (unchanged, install)   │  │ profile's grant form  │
│ ids, profiles,       │  │ builtin-entry/escape/  │  │ + rewrite on switch   │
│ verdicts, naming,    │  │ registration (NEW)     │  │                       │
│ grants, effective    │  └──────────┬─────────────┘  └───────────────────────┘
│ compatibility        │             │
│ mcp-server-features  │             ▼
│ (Claude schema +     │  ┌────────────────────────────────────────────────────┐
│ adapter table)       │  │ platform/: pi-api.ts (snapshot, McpServerConfig,   │
│ mcp-builtin-features │  │ PiMcpRegistry), mcp-status.ts (adapter channel),   │
│ (NEW verdict table)  │  │ mcp-builtin-status.ts (NEW reader)                 │
└──────────────────────┘  └────────────────────────────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ Disk: state.json records every declared server in Claude form (new optional  │
│ field); mcp-adapter.json (adapter entries, written at install as today);     │
│ agents/*.md + agents-index.json (grant form per implementation);             │
│ ~/.pi/agent/settings.json (only the adapter's `-builtin:mcp`, decision 1)     │
│ Pi runtime: pi.registerMcpServer registrations (per session, never saved)    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Zone (per `.fallowrc.json`) |
|---|---|---|
| `McpImplementationProfile` (pure) | id, verdict table (supported / blocked / malformed), server naming, tool prefix, agent-grant selector | `domain` |
| Claude schema classifier | "malformed" verdict, which is the same for every implementation (Claude Code 2.1.291 schemas) | `domain` (`mcp-server-features.ts`, split internally) |
| Adapter materializer | `mcp-adapter.json` entries at install, update, reinstall, enable, disable and uninstall; AMIG-01 move at load | `bridges-mcp` (existing files) |
| Builtin materializer | Claude form -> Pi `McpServerConfig` translation, Pi value encoding (`$$`, `$!`), registration sync against `pi.getMcpServers()` | `bridges-mcp` (new `builtin-*.ts` files) |
| Status readers | adapter: `pi-mcp-adapter/status/v1` channel; builtin: `getMcpServers()` plus `getAllTools()` | `platform` |
| Active-implementation probe | adapter, then builtin, then none, taken once per run in the D-05 snapshot | `platform/pi-api.ts` |
| Session materialization | the ordered session_start steps; re-sync after the load reconcile | `orchestrators` (new `orchestrators/mcp/`) |
| Settings cleanup | decision 1: remove the adapter's `-builtin:mcp` | `orchestrators` (composition), `transaction` (Pi-compatible lock), `shared/atomic-json.ts` (write) |
| Effective compatibility | the stored (implementation-neutral) compatibility joined with the active profile's blocked servers | `domain` (pure function); readers in `orchestrators/plugin` |

---

## 1. Map of every current adapter-coupled site

### 1a. Verdicts and resolution (install time, adapter only)

| Site | What is adapter-coupled | Consequence for the milestone |
|---|---|---|
| `domain/mcp-server-features.ts:25-35` `McpUnsupportedFeature` | The blocked-feature union is the adapter's gap list (`ws`, host types, `headersHelper`, `oauth.xaa`, `command ~`, `args ~`, `bareElicitationCapability`). It has no `sse`, which built-in rejects. | Becomes per-implementation. Add `"sse"`, a built-in gap. |
| `domain/mcp-server-features.ts:207-217` `translateMcpServer` | Writes the adapter `ServerEntry` fields: `directTools`, `toolPrefix: "mcp"`, `auth: "oauth"`, `requestTimeoutMs`, `httpTransport: "sse"`, and the OAuth mapping at `:101-130`. | Adapter profile's translation table. Built-in needs its own table (`exposure`, `timeout` in seconds, `callbackUrl`, `cwd`). |
| `domain/mcp-server-features.ts:421-444` `classifyMcpServer` | Mixes the implementation-neutral Claude schema (malformed) with adapter gaps (blocked) in one pass, and returns the first blocked feature only. | Split into a Claude-shape check and per-profile feature scanners. Otherwise a built-in table cannot see past the adapter's first feature. |
| `domain/mcp-server-features.ts:335-354` `unenforcedToolRules` | "pi-mcp-adapter has no per-tool rule". Built-in has `toolExposure` but no permission rules either. | Shared result for now; a profile hook so the two can diverge. |
| `domain/mcp-resolution.ts:87-103` `mergeServers` | Calls `classifyMcpServer` at merge time and keeps `blockedBy`. | Keep the merge. Record every non-malformed server. |
| `domain/mcp-resolution.ts:338-359` `recordMergedServers` | Drops blocked servers from `resolution.mcpServers`, pushes `"mcpServers"` into `unsupported`, and sets `droppedMcpServers`. This makes the resolver arm (`installable` or `partially-available`) depend on the adapter. | This is the root of "install drops what the adapter can't run". Phase 1 adds a parallel `declaredMcpServers`; Phase 3 makes `state` and `unsupported` neutral. |
| `domain/plugin-resolver.ts:150-175` `materializableFields` and `domain/resolver-types.ts:140-175` | Carry `mcpServers` (the adapter-supported subset) and `droppedMcpServers`. | Add `declaredMcpServers` (Phase 1). `droppedMcpServers` becomes read-time (Phase 3). |
| `domain/plugin-resolver.ts:815`, `:863`, called at `orchestrators/plugin/install-outcome.ts:840-842` and `orchestrators/plugin/update-preflight.ts:514-516` | The `--partial` consent gate reads the adapter-dependent arm. | Must be split: consent at user-initiated install and update reads the active profile; re-materialization paths read the neutral state (see correction C6). |

### 1b. Materialization (adapter file)

| Site | Coupling |
|---|---|
| `bridges/mcp/stage.ts:1-40` (header), `:449` `prepareStageMcpServers`, `:46`/`:330` `unenforcedToolRules` | Writes `<scopeRoot>/mcp-adapter.json` with the adapter's grammar, collision walk over the adapter's nine config sources (AFILE-05), MC-5 marker. |
| `bridges/mcp/adapter-entry.ts:18`, `:165-191` `translatedEntry` | `translateMcpServer`, then `substituteAndInject`, then the D-08-04 OAuth decision. The carried user fields are adapter `ServerEntry` fields (`:46-60`). |
| `bridges/mcp/substitute.ts:1-14`, `:181` `substituteAndInject` | Expands Claude variables, then **encodes in pi-mcp-adapter's escape grammar** through `adapter-escape.ts`. User-scope `${CLAUDE_PROJECT_DIR}` is left for the adapter to expand from Pi's process (`:24-33`). |
| `bridges/mcp/adapter-doc.ts`, `adapter-escape.ts`, `collision-*.ts`, `legacy.ts`, `marker.ts`, `unstage.ts` | Adapter-only file mechanics. They stay as they are. |
| `orchestrators/plugin/install-outcome.ts:1408-1455` `mcpPhase` | Stages `resolved.mcpServers` (the adapter-supported subset) and records `stagedMcpServerNames`. |
| `orchestrators/plugin/install-outcome.ts:1600-1625` `statePhase` | Records `compatibility` from the adapter-dependent resolve and `resources.mcpServers = stagedMcpServerNames`. |
| `orchestrators/reconcile/mcp-migration.ts:516-528`, `:577` | AMIG-01 load-time move reads `droppedMcpServers` and stamps `compatibility.unsupported += "mcpServers"`. It is adapter maintenance. |
| `shared/session-env.ts` `applyMcpAdapterEnv`, called at `index.ts:49-60`, `:84`, `:237` | Sets `CLAUDE_PROJECT_DIR` in Pi's process for the adapter's late expansion. Built-in also expands `${NAME}` in `env` and `headers` values from `process.env`, so this stays useful there. Built-in expands nothing in `command`, `args` or `url`. |

### 1c. Detection, markers, status

| Site | Coupling |
|---|---|
| `platform/pi-api.ts:140-144` `SoftDepStatus { piMcpAdapterLoaded }`; `:214-265` `hasLoadedPiMcpAdapter`; `:268-274` `softDepStatus` | The only MCP probe. The comment at `:253-255` already excludes built-in (an `mcp` command from `builtin:mcp`). It has no built-in probe. |
| `shared/notification-run.ts:67-89` `openNotificationSnapshot` / `openNotificationRun` | **D-05: one probe per run.** Every command, load, hook and tool run carries `run.softDeps` (consumers: `notification-present.ts:267,291,305`, `install-flow-ledger.ts:1324,1390`, `info.ts:3257,3297`, `enable-disable.ts:3059`, `update-cascade.ts:209`, `reinstall-flow.ts:343-348`, `dependency-move.ts:314-315`, `dependency-bindings.ts:117`, `index.ts:141`, `bridges/hooks/dispatch.ts:553`, `settle.ts:165`, `async-rewake/registry.ts:433`). |
| `shared/concerns/soft-dep.ts:37`, `:52`, `:64`, `:114`, `:147-149` | The `requires pi-mcp-adapter` marker and the info `requires:` companion entry. |
| `shared/notify-reasons.ts:89-104` `companionSeverity`; `:113` and `:120-121` (`"unsupported mcp"`, "a feature the adapter lacks") | Severity and reason wording are adapter-specific. |
| `shared/notification-types.ts:27`, `:1155-1180` `McpServerSummaryEntry.unsupportedFeature` / `status` | Closed-set reason `"requires pi-mcp-adapter"`. The status comes from "pi-mcp-adapter's last snapshot". |
| `platform/mcp-status.ts:25`, `:58-60`, `:109` `createMcpStatusTracker(pi.events)`; wired at `index.ts:94`, `edge/register.ts:97,121`, `edge/handlers/plugin/info.ts:32` | The adapter status channel. `McpStatusReader.lookup(key)` takes the adapter config key. |
| `orchestrators/plugin/info-mcp-status.ts:102-132` (`:80` `generatedMcpServerKey`) | Status lookup by the adapter key; the project-override rule follows the adapter's load order. |
| Display readers of `record.compatibility.*`: `orchestrators/plugin/list-installed-row.ts:66`, `plugin-state-classifier.ts:148`, `info.ts:1716`, `:1733`, `:2067`; `info.ts:1000-1065` `composeResolvedComponents` (`droppedMcpServers`) | Show the install-time adapter verdict. |
| Re-materialization readers of `record.compatibility.installable`: `enable-disable.ts:428,1004`, `install-cascade.ts:1463`, `install-flow-results.ts:412,514`, `update-preflight.ts:722-740`, `update-swap.ts:673-729,1672-1681`, `import/execute.ts:1160`, `reconcile/convergence.ts:436-454` | Pass `partial` consent into re-materialization, and decide growth and consent moves in `apply`. They must not flip when the implementation changes (C6). |

### 1d. Agents, hooks, naming

| Site | Coupling |
|---|---|
| `domain/name.ts:616-641` `mcpServerDisplayName`, `generatedMcpServerKey` (`plugin_<plugin>_<server>_`, trailing `_`) | Adapter key. Built-in needs `plugin_<plugin>_<server>` (no trailing `_`) to produce `mcp__plugin_<plugin>_<server>__<tool>`. |
| `domain/name.ts:650-652` `foldedMcpServerKey` | The adapter `-`/`_` fold. Built-in treats `-` and `_` as one server too (Pi `docs/mcp.md:77`), so the fold rule applies to both. |
| `bridges/agents/convert.ts:85-123` `McpGrant`, `MCP_ASYNC_WARNING`; `:335-375` `buildMcpGrants` / `matchMcpGrant` | Writes `mcp:<adapterKey>` grants. The warning text names pi-mcp-adapter. The grant table is fed from `install-outcome.ts:1318-1320` (`Object.keys(resolved.mcpServers)`). |
| `bridges/hooks/dispatch.ts:611-627` `isMcpProxyCall`; used at `:757`, `:818` | Special case for the adapter's `mcp` and `mcp__<server>` proxy. Inert under built-in, which has no such tool. |
| `domain/components/hooks/matcher.ts:87-133` (`toolPrefixes`), `bridges/hooks/if-field/index.ts:101-125,188-247` | Literal Claude names. Under built-in, `-` becomes `_`, so a matcher with `-` misses. The brief has already settled this as a licensed divergence. |

### 1e. Persistence (what state.json records today)

`persistence/state-io.ts:96-166` `PLUGIN_INSTALL_RECORD_SCHEMA`:

- `resources.mcpServers: string[]` (`:153`) holds the **declared names of the staged (adapter-supported) servers** only.
- `compatibility { installable, notes, supported, unsupported }` (`:143-148`) is the adapter-dependent resolve.
- `resolvedSource` is the absolute plugin root. The hooks bridge already uses it as `CLAUDE_PLUGIN_ROOT` at load (`bridges/hooks/hook-env.ts:43`), so a load can materialize from the record without reading the catalog.
- No server configuration is recorded. The only copy is the translated, adapter-encoded entry in `mcp-adapter.json`.
- Additive-field precedent: `hookEntries` (`:110-130`, D-100-01), `resolvedSha`, `resolvedVersion`, `dependencyDisabled` are all optional with **no schemaVersion bump and no backfill**; records self-heal on the next install, update, reinstall or enable (D-100-09). `persistence/migrate.ts:130-160` `ensurePluginResources` is the fill-before-validate pattern used for required fields only.

### 1f. Entry and reconcile wiring

- `index.ts:80-293` factory. `:94` builds the adapter status tracker per load. `:136-182` `prepareResources` (hooks hydrate, `loadReconcile`, PATH) runs inside `resources_discover` (`:190-222`). `:236-244` `session_start` sets the adapter env and the session env. Nothing MCP-related is materialized at load today, except the AMIG-01 move inside `loadReconcile`.
- `orchestrators/reconcile/load.ts` (read pass, AMIG-01 move, warnings, hook routing). It changes no installation state (APL-D1), except the autoapply path that runs `applyReconcile`.
- **The entry zone may import only `edge`, `orchestrators`, `bridges-hooks`, `persistence`, `platform`, `shared`** (`.fallowrc.json:79-82`). It may not import `bridges-mcp`, `bridges-agents` or `domain`. Every new load step must therefore sit behind an orchestrator module.

---

## 2. Validation of the proposed design, with corrections

### Verified Pi 1.5.0 facts that drive the design

| Fact | Evidence |
|---|---|
| **`session_start` fires BEFORE `resources_discover`**, on startup and on `/reload`. | Pi dist `core/agent-session.js:2698-2700` (`bindExtensions`: emit `session_start`, then `reportUnhandledMcpServers()`, then `extendResourcesFromExtensions`) and `:3046-3048` (`reload`). `docs/extensions.md` "resources_discover: Fired after session_start". This repo already relies on it (`index.ts:122-129`). |
| `/reload` = `session_shutdown(reload)`, a new runtime built from re-read settings, then `session_start(reload)`, then `resources_discover(reload)`. | `agent-session.js:3016-3048`. Registrations are per runtime and never saved (`docs/extensions.md` "MCP Servers"), so re-registering on each `session_start` is the contract. |
| A registration made after binding emits `mcp_servers_change` at once. The built-in handler connects it right away (`dist/extensions/mcp/index.js:1078-1110`), and its own `session_start` reads earlier registrations (`:971-990`, `registeredServers` at `:248-262`). | `core/extensions/runner.js:242-246`. Registering inside our `session_start` works whichever handler runs first; `session` is initialised at `mcp/index.js:224`, so an early change event does not throw. |
| When no extension handles `mcp_servers_change`, every registration is reported as an extension error. | `runner.js:503-520`. |
| **pi-mcp-adapter 7.0.0 handles `mcp_servers_change` and consumes registrations** (`index.ts:1259`, `:1365` `applyPiMcpServers`, `:1406`). | A registration made while the adapter is active becomes a duplicate, proxy-only server. Never register unless built-in is the active implementation. |
| An `mcp.json` server with the same `-`/`_`-folded name overrides a registration. | `mcp/index.js:252-256`. |
| Built-in value grammar: `env` and `headers` values are templates (`$NAME`, `${NAME}`, `$$` for a literal `$`, `$!` for a literal `!`); a value that starts with `!` runs a shell command; an unset variable throws. `command`, `args` and `cwd` are home-expanded (`~`). `url` is literal. | `core/resolve-config-value.js:21-128`, `extensions/mcp/runtime.js:43-70`. Built-in therefore has the same `command ~` and `args ~` gaps as the adapter, plus a new hazard: a literal Claude value that starts with `!` would run as a command unless it is encoded `$!`. |
| Built-in keeps OAuth beside non-`Authorization` headers, the same rule as Claude Code. | `runtime.js:39-41`. D-08-04's `auth: "oauth"` workaround is adapter-only. |
| Built-in detection: an extension command `mcp` whose `sourceInfo.path` is `builtin:mcp` (`sourceInfo.source` is `builtin`). An extension that registers `/mcp` replaces built-in. `--no-mcp`, a user `-builtin:mcp` and a project `-builtin:mcp` all turn it off. | `core/source-info.js:8-20`, `core/package-manager.js:764-770`, Pi `docs/mcp.md:266-268`. |
| Pi's `SettingsManager` locks `settings.json` with `proper-lockfile` (`realpath:false`, 10 x 20 ms retries) but writes with `writeFileSync`, which is not atomic. | `core/settings-manager.js:126-170`. |
| The adapter records `piBuiltinMcpHandledVersion` **whether or not it wrote the line**: it is also set when a `builtin:mcp` entry already existed. | `pi-mcp-adapter/pi-builtin-mcp.ts:14-26`; `onboarding-state.ts:12-13` ("Adapter version that last turned off, or found configured, Pi's built-in MCP"). The file is `<agentDir>/mcp-onboarding.json`. |
| pi-subagents 0.84.0 resolves `mcp:` selectors against the adapter when it is installed, otherwise against built-in, and accepts `-` and `_` spellings. Servers registered with `registerMcpServer` work only in **background** children, because the registering extension loads in the child. | pi-subagents `docs/agents.md:450,573`, `CHANGELOG.md:440,480,507,530`. |

### Corrections (C) and confirmations (OK)

**C1. The interface cannot be one object; split it by zone.** `domain` may import only `shared` and `platform`, bridge zones may not import each other, and the entry may not import `domain` or `bridges-mcp` (`.fallowrc.json:78-147`). So:

- **Pure profile in `domain/mcp-implementation.ts` (new, frozen in Phase 1):** `McpImplementationId = "adapter" | "builtin"`, `ActiveMcpImplementation = McpImplementationId | "none"`, and `McpImplementationProfile { id; classify(config) -> McpServerVerdict; serverName(plugin, server); toolNamePrefix(plugin, server); grantSelector(plugin, server) }`. It also exports `profileFor(id)` and the pure `effectiveMcpCompatibility(...)`. Every zone except the entry can import it.
- **Effectful ports live where their side effects are allowed:** adapter materialization in `bridges/mcp/*` (existing), built-in registration in `bridges/mcp/builtin-registration.ts` behind a `PiMcpRegistry` view declared in `platform/pi-api.ts`, status readers in `platform/`, grants in `bridges/agents/convert.ts`.
- **The composition** (pick a profile and run its effects) lives in `orchestrators/mcp/` (new subdirectory, already inside the `orchestrators` zone, so `.fallowrc.json` needs no new zone).

**C2. Carry the active implementation in the D-05 run snapshot, not in state captured at session_start.** Add `mcpImplementation: ActiveMcpImplementation` to `SoftDepStatus` (`platform/pi-api.ts:140`) and compute it in `softDepStatus(pi)`: adapter if `hasLoadedPiMcpAdapter`, else builtin if `hasLoadedBuiltinMcp`, else none. The command inventory is fixed once the runtime has bound (every extension has loaded before `session_start`), so the probe gives the same answer at `session_start` and in every later run of that runtime. This removes the need for a module-level mutable "active implementation", and list, info, install, apply, tools and hook runs already receive `run.softDeps`. Keep `piMcpAdapterLoaded` (26 test and feature files read it) as `mcpImplementation === "adapter"`. `session_start` uses the probe only to trigger materialization.

**C3. The event order is the reverse of what the question assumed, and that matters.** Registration in `session_start` precedes `resources_discover`, where `loadReconcile` runs and, with autoapply on, installs plugins. So the built-in sync must run **twice per load**: in `session_start` (so the first prompt's `waitForDirectServers` sees `alwaysLoad` servers) and again at the end of `prepareResources` (`index.ts:136-182`, after `loadReconcile`), which picks up plugins that autoapply installed or removed. The sync is idempotent: it diffs the desired set against `pi.getMcpServers()` filtered to this extension's registrations.

**C4. Record the Claude form *before* plugin-variable substitution, not after.** The brief says "after plugin-variable substitution". Substitution output is encoding-specific (`bridges/mcp/substitute.ts:181` writes adapter escapes; built-in needs `$$`/`$!`). Substituting `${CLAUDE_PLUGIN_ROOT}` into a raw Claude string would also make a plugin path that contains `$` or `${` be read again as a variable. The values substitution needs can all be derived at materialization time:

- `CLAUDE_PLUGIN_ROOT` = `record.resolvedSource` (the hooks precedent, `bridges/hooks/hook-env.ts:43`).
- `CLAUDE_PLUGIN_DATA` = `locationsFor(scope, cwd).pluginDataDir(...)` (`persistence/locations.ts`).
- `CLAUDE_PROJECT_DIR` = the session `ctx.cwd`. Built-in can then expand it in `command`, `args` and `url`, where Pi does not.

Frozen record shape (`persistence/state-io.ts`, optional and additive, the `hookEntries` precedent, no schemaVersion bump):

```ts
// Every server the plugin declares, in D-CF6-01 merge order, malformed ones
// excluded, verbatim Claude JSON. Absent = record predates the field.
mcpServerConfigs?: ReadonlyArray<{ readonly name: string; readonly config: unknown }>
```

Legacy records (field absent) read through one frozen accessor, `recordedMcpServers(record, reader)` in `orchestrators/mcp/recorded-servers.ts`. Its fallback re-resolves `.mcp.json` and the manifest from `record.resolvedSource` through `domain/mcp-resolution.ts` (read-only, no state write, APL-D1 holds). Records self-heal on the next install, update, reinstall or enable. Residual risk: a path-source plugin whose marketplace clone moved since install reads the newer declaration. Accept it, as D-100-09 accepted the same for hooks.

**C5. Write adapter entries at install whatever the active implementation, and drop "reconcile them on load or apply".** `bridges/mcp` keeps staging the adapter-supported subset into `mcp-adapter.json` at install and through its existing lifecycle. Built-in never reads that file, so the entries are inert. A switch to the adapter then needs nothing at load, because the adapter reads its file at its own `session_start`. That keeps APL-D1 for the adapter path and leaves `bridges/mcp/*` (except the new `builtin-*` files) almost untouched. The AMIG-01 load move stays as it is.

**C6. Store compatibility neutral, compute it effective, and split the consent gate.** "A plugin's state depends on the active implementation" reaches about 15 readers (1c). If the stored `compatibility` stays implementation-dependent, a switch makes `apply`'s convergence see a "newly partial" plugin and ask for `--partial` consent (`reconcile/convergence.ts:450-456`), and `enable` re-materialization refuses (`enable-disable.ts:428`, `install-outcome.ts:840`). That breaks "a switch never requires user action". Rule:

- **Stored** `compatibility` and the resolver arm hold only implementation-neutral defects (bundles, unsupported component kinds, hooks, structural).
- **Effective** = stored, plus `"mcpServers"` when any recorded server is blocked under the active profile. The pure function is `effectiveMcpCompatibility(stored, recorded, profile) -> { installable, unsupported, blocked: DroppedMcpServer[] }` in `domain/mcp-implementation.ts`.
- **Display** readers (list, info, classifier, reasons, markers) use the effective value.
- **Consent:** a user-initiated `install` or `update` asks for `--partial` against the effective value (today's adapter behavior is kept). Re-materialization (enable, cascade members, convergence moves, reinstall, import promotion) checks the neutral value only, so a switch never asks for consent.
- With today's tables the adapter's gaps are a subset of built-in's (built-in adds `sse`). Legacy adapter-era stored compatibility therefore joins correctly under built-in. The neutral write is still required by the "either could be richer" rule.

**C7. Agent grants must be rewritten on a switch, and that is a load-time write (amends APL-D1).** pi-subagents accepts `mcp:<server>` for either implementation, but the server names differ (`plugin_x_y_` adapter key versus `plugin_x_y` built-in name). A file that carries both selectors fails under the adapter with "Unresolved MCP direct-tool selectors". So:

- `bridges/agents/convert.ts` takes the selector from `profile.grantSelector`.
- The agents index gains an optional `mcpImplementation` per row (`persistence/agents-index-schema.ts:24-36`, additive, schema literal stays 1).
- A `session_start` step rewrites the rows whose recorded implementation differs from the active one, from `sourcePath`, **under the scope's state lock**. It skips an untrusted project (D-LOC-01) and does nothing when the active implementation is none.
- `MCP_ASYNC_WARNING` (`convert.ts:120-123`) becomes per profile. Built-in has the same foreground-child gap (pi-subagents `docs/agents.md:573`), so D-CF6-10's `async: true` stays.
- **Hazard:** a background child loads this extension too, and its `session_start` runs the same step. The child must never rewrite agents or settings. Detect a pi-subagents child, and make the step a no-op when nothing changed. This is a research flag.

**C8. Settings cleanup: write it ourselves, atomically, under Pi's lock.** Pi's `SettingsManager` is not atomic (NFR-1). A bare `atomicWriteJson` ignores Pi's lock, so it can race `pi config` or the adapter. Implementation:

- `transaction/with-state-guard.ts` gains `withPiSettingsLock(path, fn)`: `proper-lockfile` with `realpath:false` and short retries, the same protocol as Pi's. That file is the only sanctioned `proper-lockfile` importer, so `rule-packs/architecture.json` stays unchanged.
- The write goes through `shared/atomic-json.ts`.
- The paths come from new user-scope-only `ScopedLocations` getters (`piSettingsJsonPath`, `mcpOnboardingJsonPath`), so NFR-10 is amended in one place.
- Remove only an exact `-builtin:mcp` element, keep every other field, and leave the file alone if it does not parse.

Two gaps to settle in requirements:

- (a) `piBuiltinMcpHandledVersion` cannot prove that the adapter wrote the line (see the facts table). The best available test is: the adapter is absent, the onboarding state has a handled version, and the only `builtin:mcp` entry is exactly `-builtin:mcp`. That still misfires for a user who wrote `-builtin:mcp` before the adapter first ran.
- (b) The new runtime built after an adapter removal has already resolved its extension list, so built-in stays off **for that first session**. Session context has no `reload()`; only command contexts have one (Pi dist `core/extensions/types.d.ts:341`, `:1734`). The first session after uninstall is therefore "none" until the next `/reload` or start. This is a Pi capability gap that needs a decision ID, or a user-visible notice.

**C9. Gate built-in registration on trust and on the active implementation.** Register only when `mcpImplementation === "builtin"`. Register project-scope servers only when `ctx.isProjectTrusted()` (registrations bypass Pi's trust gate), and skip disabled records (`isRecordedButDisabled`). Use the `exposure` from decision 2. Names come from `profile.serverName`. A name that `mcp.json` already defines is overridden by Pi; report it through the built-in status reader as overridden.

**C10. Built-in status needs its own reader, with no event channel.** Built-in publishes no status. Its listeners are internal (`mcp/index.js:235-244`). `platform/mcp-builtin-status.ts` implements the existing `McpStatusReader` (`platform/mcp-status.ts:58-60`) from `pi.getMcpServers()` (registered and owned by us), the `mcp.json` override (Pi `docs/mcp.md:77`), and `pi.getAllTools()` (connected = tools with names under `mcp__<name>__` and source `builtin:mcp`). Whether deferred tools are listed before `tool_search` is a research flag. `lookup(key)` keeps its signature; `info-mcp-status.ts` passes `profile.serverName(...)` instead of `generatedMcpServerKey(...)`. `EdgeDeps.mcpStatus` becomes `{ adapter, builtin }`, and info picks the reader by `run.softDeps.mcpImplementation`.

**OK. Built-in materialization fits NFR-2 as proposed.** Registrations die with the runtime, `/reload` builds a new one and fires `session_start(reload)`, and the sync re-registers. No restart is needed and no file is written. An in-session `install` or `uninstall` does not (un)register at once. The servers follow at `/reload`, the same as every other component and the adapter. That keeps the reload hint uniform. A later decision may add an immediate sync; the idempotent sync makes it a one-line call.

**OK. The `@adapter` / `@builtin` cucumber profiles are feasible.** The harness launches Pi without `--no-mcp` (`test/e2e/_rpc.ts:242-253`), so built-in is already loaded in every profile Pi today. The "companion-missing" scenarios currently run with built-in present but unused. A third, "none" run needs `--no-mcp` support in `piArguments`.

---

## Recommended Project Structure

`NEW` = created, `MOD` = modified, `(Pn)` = owning phase after Phase 1. Files marked **frozen** are created or changed by Phase 1 and edited by no later phase.

```text
extensions/pi-claude-marketplace/
├── index.ts                                  MOD P1 frozen: session_start -> materializeMcpForSession;
│                                                prepareResources -> resyncBuiltinRegistrations; status readers
├── platform/
│   ├── pi-api.ts                             MOD P1 frozen: SoftDepStatus.mcpImplementation, hasLoadedBuiltinMcp,
│   │                                            McpServerConfig/RegisteredMcpServer types, PiMcpRegistry view
│   ├── mcp-status.ts                         unchanged (adapter channel)
│   └── mcp-builtin-status.ts                 NEW P1 seed ("no-snapshot") -> P3
├── domain/
│   ├── mcp-implementation.ts                 NEW P1 frozen: ids, profile type, profileFor, effectiveMcpCompatibility
│   ├── mcp-server-features.ts                MOD P1 frozen: Claude-shape check split from adapter scanner; "sse"
│   ├── mcp-builtin-features.ts               NEW P1 frozen: built-in verdict table
│   ├── mcp-builtin-translation.ts            NEW P2: Claude -> Pi McpServerConfig table
│   ├── name.ts                               MOD P1 frozen: builtinMcpServerName (own arm)
│   ├── mcp-resolution.ts                     MOD P1 (declaredMcpServers) -> P3 (neutral unsupported)
│   ├── plugin-resolver.ts, resolver-types.ts MOD P1 (declaredMcpServers) -> P3 (neutral state, effective gate)
├── bridges/mcp/
│   ├── builtin-entry.ts                      NEW P2: substitution + translation for built-in
│   ├── builtin-escape.ts                     NEW P2: Pi value encoding ($$, $!, leading !)
│   ├── builtin-registration.ts               NEW P2: idempotent sync over PiMcpRegistry
│   ├── substitute.ts                         MOD P2: encoder parameter (adapter-escape stays the default)
│   └── stage.ts, adapter-*.ts, legacy.ts ... unchanged
├── bridges/agents/convert.ts                 MOD P4: grant selector + async warning from profile
├── bridges/hooks/dispatch.ts                 MOD P5: isMcpProxyCall gated on the adapter (own function)
├── orchestrators/mcp/                        NEW dir (orchestrators zone)
│   ├── session-materialize.ts                NEW P1 frozen: ordered steps, NFR-2 try/catch per step
│   ├── recorded-servers.ts                   NEW P1 frozen: recordedMcpServers(record) + legacy fallback
│   ├── builtin-registration-step.ts          NEW P1 no-op seed -> P2
│   ├── agent-grants-step.ts                  NEW P1 no-op seed -> P4
│   └── settings-cleanup-step.ts              NEW P1 no-op seed -> P6
├── orchestrators/plugin/
│   ├── install-outcome.ts                    MOD P1 statePhase (writes mcpServerConfigs); P3 gate at :840;
│   │                                            P4 agentsPhase :1318-1320 (own function each)
│   ├── info-mcp-status.ts, info.ts,
│   │   list-installed-row.ts,
│   │   plugin-state-classifier.ts            MOD P3 (effective compatibility, status reader)
│   ├── enable-disable.ts, install-cascade.ts,
│   │   install-flow-results.ts, update-*.ts,
│   │   reinstall-*.ts                        MOD P3 (neutral consent only, own function)
├── orchestrators/reconcile/
│   ├── convergence.ts                        MOD P3 (neutral comparison)
│   └── mcp-migration.ts                      MOD P3 (explicit adapter profile)
├── persistence/
│   ├── state-io.ts                           MOD P1 frozen: optional mcpServerConfigs
│   ├── locations.ts                          MOD P1 frozen: piSettingsJsonPath, mcpOnboardingJsonPath (user only)
│   └── agents-index-schema.ts                MOD P4: optional mcpImplementation per row
├── transaction/with-state-guard.ts           MOD P6: withPiSettingsLock
└── shared/
    ├── notification-types.ts, notification-wire.ts,
    │   notify-reasons.ts (closed set)        MOD P1 frozen: one commit adding "requires MCP support"
    └── concerns/soft-dep.ts                  MOD P3 (MCP arm only)

features/ (cucumber)                          P1 frozen: cucumber.json profiles, world parameter, companion and
                                                "MCP implementation" steps, piArguments --no-mcp, check-features tags
docs/mcp-compatibility.md                     MOD P2 (built-in column)
```

### Structure Rationale

- **`domain/mcp-implementation.ts`** is the only file every phase imports. It holds types, pure tables and a pure join, so freezing it costs little and removes every cross-phase type conflict.
- **`orchestrators/mcp/`** exists because the entry cannot import bridges or domain. A frozen composition file with one seeded step module per phase lets three phases wire load-time behavior without editing `index.ts` or each other's files.
- **Built-in files sit beside the adapter files in `bridges/mcp/`.** It is the same component kind, so no new fallow zone is needed, and their file names keep ownership disjoint.

---

## Architectural Patterns

### Pattern 1: Pure profile plus effect ports (strategy split by layer)

**What:** One pure `McpImplementationProfile` per implementation in `domain`, chosen by id. Effects (file staging, registration, status) are separate modules in their own zones, each taking the profile or its id.
**When to use:** Every implementation-dependent decision: verdict, name, grant, translation.
**Trade-offs:** The behavior of one implementation is spread over three zones. In return the fallow boundaries hold, every piece is unit-testable with direct coverage, and a third implementation adds files without editing shared ones.

```ts
// domain/mcp-implementation.ts (frozen in Phase 1)
export type McpImplementationId = "adapter" | "builtin";
export type ActiveMcpImplementation = McpImplementationId | "none";
export interface McpImplementationProfile {
  readonly id: McpImplementationId;
  classify(config: unknown): McpServerVerdict;            // malformed is shared, blocked is per profile
  serverName(plugin: string, server: string): string;     // adapter: plugin_p_s_ ; builtin: plugin_p_s
  toolNamePrefix(plugin: string, server: string): string; // mcp__plugin_p_s__ (builtin folds - to _)
  grantSelector(plugin: string, server: string): string;  // mcp:<serverName>
}
export function profileFor(id: McpImplementationId): McpImplementationProfile;
export function effectiveMcpCompatibility(
  stored: { readonly installable: boolean; readonly unsupported: readonly string[] },
  recorded: readonly { readonly name: string; readonly config: unknown }[] | undefined,
  active: ActiveMcpImplementation,
): { installable: boolean; unsupported: readonly string[]; blocked: readonly DroppedMcpServer[] };
```

### Pattern 2: Desired-state sync for session-scoped registrations

**What:** `syncBuiltinRegistrations({ registry, desired })` computes the set from the records of both scopes (enabled; project only when trusted), lists this extension's current registrations (`getMcpServers()` filtered by `extensionPath`), and registers or unregisters the difference. A server whose config changed is registered again, which Pi treats as a replacement (`mcp/index.js:1086-1091`).
**When to use:** At `session_start`, and after `loadReconcile` in `resources_discover`.
**Trade-offs:** Two calls per load, both cheap. It never touches disk, and NFR-3 (safe to retry) holds by construction.

### Pattern 3: Neutral persistence, effective presentation

**What:** Persist only implementation-independent facts (the Claude configs and the neutral compatibility). Compute the implementation-dependent view at read time from `run.softDeps.mcpImplementation`.
**When to use:** Every list, info, marker, severity and install-time consent decision.
**Trade-offs:** About 15 reader sites move to one function (one phase owns them all). Records never need a rewrite on a switch.

### Pattern 4: Frozen composition with seeded, handed-over step modules

**What:** Phase 1 writes `orchestrators/mcp/session-materialize.ts`, which calls `settingsCleanupStep`, `builtinRegistrationStep` and `agentGrantsStep` in a fixed order. Each step catches its own errors (NFR-2: nothing escapes `session_start`). Each step module starts as a no-op with a paired test, and one phase owns it from then on. This is the component-features "created by Phase 1 with a seed, then handed over" pattern.

---

## Data Flow

### Startup and `/reload`

```text
Pi builds runtime (extension list fixed here; -builtin:mcp already applied)
  └─ factory (index.ts): adapter env, trackers, readers {adapter, builtin}
session_start(startup|reload|new|resume|fork)
  └─ materializeMcpForSession(pi, ctx)
       snapshot = softDepStatus(pi)            -> adapter | builtin | none
       1 settingsCleanupStep  (user scope; only if adapter absent + decision-1 test; atomic, Pi lock)
       2 builtinRegistrationStep (only if builtin): records(user, project if trusted, enabled)
            -> recordedMcpServers -> builtin-entry (substitute, translate, encode)
            -> syncBuiltinRegistrations      (Pi connects at once / at its session_start)
       3 agentGrantsStep (if adapter|builtin, not in a subagent child):
            agents-index rows with mcpImplementation != active -> rewrite under state lock
resources_discover
  └─ prepareResources: hooks hydrate, loadReconcile (may autoapply), PATH
       └─ resyncBuiltinRegistrations (picks up autoapply installs and uninstalls)
  └─ aggregateDiscoveredResources (unchanged)
```

### Install (any active implementation)

```text
resolveStrict -> declaredMcpServers (all non-malformed) + neutral state
consent gate: effectiveMcpCompatibility(neutral, declared, run.softDeps.mcpImplementation)
mcp phase: stage the adapter-supported subset into mcp-adapter.json (ALWAYS; C5)
agents phase: grants in the active profile's form (none -> adapter form) + index row records it
state phase: compatibility = neutral; resources.mcpServers = staged names;
             mcpServerConfigs = declared Claude configs (pre-substitution)
reload hint -> at /reload, builtin registers from the record
```

### Read time (list, info, pending, tools)

```text
record + run.softDeps.mcpImplementation
  -> effectiveMcpCompatibility -> (installed | partially-installed), reasons, unsupportedFeature per server
  -> marker: none -> "requires MCP support"; adapter or builtin -> no MCP marker
  -> info status: readers[active].lookup(profile.serverName(plugin, server))
```

### Switch: adapter uninstalled

```text
start 1: settings still hold -builtin:mcp -> active none -> cleanup removes it (decision 1)
         -> servers not connected this session (C8b gap)
start 2 or /reload: builtin loaded -> active builtin -> register from records; agents rewritten;
         list/info now show built-in verdicts (e.g. an sse server -> partially-installed)
```

Without the adapter's line, for example after a `pi config` change, start 1 is already built-in.

### State Management

- `state.json` stays the only source of truth. The new field is written only in `statePhase`; uninstall, update, reinstall and disable keep its lifecycle for free (disable keeps the record, and `enabled:false` means do not register).
- Pi registrations are derived and session-scoped. They are never authoritative.
- `agents-index.json` records which grant form each generated agent carries.

---

## Scaling Considerations

| Concern | Typical (1-20 plugins) | Heavy (100+ servers) |
|---|---|---|
| `session_start` cost | Two `loadState` reads, a few `registerMcpServer` calls. Negligible. | Registration is O(servers). Built-in connects lazily for deferred servers. The legacy re-resolve fallback reads plugin roots, so encourage self-heal. |
| Agents rewrite | Only on an implementation change, and only for agents with MCP grants. | Bounded by the agent count. Run once per switch, not per load. |
| Re-sync after load | Diff against `getMcpServers()`. Cheap. | The same. |

### Scaling Priorities

1. **First bottleneck:** the legacy fallback in `recordedMcpServers` re-reading plugin roots on every load. Mitigation: the record self-heals on the next materialization. An optional `apply` step could refresh the field.
2. **Second:** project switches (`/resume` into another cwd) re-run the full sync. That is already idempotent.

---

## Anti-Patterns

### Anti-Pattern 1: One `McpImplementation` object that spans zones

**What people do:** Put translation, registration, status and grants on one class in `bridges/mcp`, and import it from `bridges/agents` and the entry.
**Why it's wrong:** fallow forbids `bridges-agents -> bridges-mcp` and `entry -> bridges-mcp` (`.fallowrc.json:79-126`). `npm run fallow` fails.
**Do this instead:** Use the pure profile in `domain` (Pattern 1), with effects in their own zones and composition in `orchestrators/mcp/`.

### Anti-Pattern 2: A module-global "active implementation" set at `session_start`

**What people do:** Capture the probe result in a mutable variable read by list, info and install.
**Why it's wrong:** It duplicates D-05, adds hidden state that tests must reset, and can disagree with the run's snapshot, which the marker and the severity share (`notify-reasons.ts:89-104`).
**Do this instead:** Add `mcpImplementation` to `SoftDepStatus` (C2).

### Anti-Pattern 3: Registering while the adapter is active, or when nothing connects

**Why it's wrong:** The adapter consumes registrations as proxy-only duplicates (`pi-mcp-adapter/index.ts:1365,1406`). With built-in off, every registration is an extension error (`runner.js:503-520`).
**Do this instead:** Register only when the snapshot says built-in.

### Anti-Pattern 4: Persisting translated or encoded entries, or the implementation-dependent compatibility

**Why it's wrong:** Escapes and encodings differ between implementations (`substitute.ts` versus `resolve-config-value.js`). An implementation-dependent stored compatibility makes convergence and enable ask for `--partial` after a switch.
**Do this instead:** Persist the Claude form and neutral compatibility (C4, C6).

### Anti-Pattern 5: Load-time writes without the lock, in an untrusted project, or in a subagent child

**Why it's wrong:** Two Pi processes (parent and background child) would rewrite agent files against different probe results, so the files would flip back and forth. An untrusted project is written during load (D-LOC-01).
**Do this instead:** Run the agents and settings steps under the state lock or the Pi settings lock, only on a real change, never in a child, and never in an untrusted project.

### Anti-Pattern 6: Editing `settings.json` through Pi's `SettingsManager`, or without Pi's lock

**Why it's wrong:** `SettingsManager` writes with `writeFileSync` (NFR-1). A bare atomic write can lose a concurrent `pi config` change.
**Do this instead:** Use `withPiSettingsLock` plus `atomicWriteJson` (C8).

---

## Integration Points

### External Services

| Service | Integration pattern | Notes |
|---|---|---|
| Pi 1.5.0 MCP registry | `pi.registerMcpServer` / `unregisterMcpServer` / `getMcpServers` through the `PiMcpRegistry` view in `platform/pi-api.ts` (NFR-11 chokepoint) | Per runtime. Names `[A-Za-z0-9_-]`, with `-` and `_` folded. `mcp.json` overrides. Invalid configs throw, so validate before registering. The root exports only the types (`McpServerConfig`, `McpExposure`, `RegisteredMcpServer`; Pi dist `index.d.ts:11,32`), not `validateMcpServerConfig`, so wrap each register call in try/catch. |
| Pi command inventory | `getCommands()` -> `mcp` with `sourceInfo.path === "builtin:mcp"` | Read in `softDepStatus`. |
| pi-mcp-adapter 7.x | `mcp-adapter.json` (unchanged), `pi-mcp-adapter/status/v1`, `<agentDir>/mcp-onboarding.json` (read only) | Never import the package. The field name `piBuiltinMcpHandledVersion` is a string literal with a conformance test (the `test/integration/mcp-status-conformance.test.ts` precedent). |
| Pi settings | `<agentDir>/settings.json` `extensions[]` | User scope only. The only edit is removing the exact element `-builtin:mcp`. |
| pi-subagents 0.84 | `mcp:<serverName>` grants in agent frontmatter | The selector follows the active implementation. Registered servers work in background children only. |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `index.ts` -> `orchestrators/mcp/session-materialize.ts` | direct call in `session_start` and after `loadReconcile` | The entry may not import domain or bridges-mcp. |
| `orchestrators/mcp/*` -> `bridges/mcp/builtin-registration.ts`, `bridges/agents/*` | direct (orchestrators may import every bridge) | No bridge imports another bridge. |
| any zone -> `domain/mcp-implementation.ts` | pure import | Frozen after Phase 1. |
| `orchestrators/plugin/info*.ts` -> status readers | `McpStatusReader` interface, chosen by snapshot id | `EdgeDeps.mcpStatus: { adapter; builtin }`, frozen in Phase 1. |
| BLOCK F (network) | none of the new modules touch git or the network | New orchestrator files are gated by default (none join `NETWORK_SEAMS`). |
| BLOCK C (ledgers) | the new `orchestrators/mcp/*` modules are not ledgers | They must not import a plugin or marketplace ledger. |

---

## 3. Phase decomposition for parallel child sessions

The model is the component-features precedent (`.planning/milestones/component-features-ROADMAP.md:48-198`, `.planning/milestones/component-features-CHILD-SESSION-BRIEF.md`): one serial foundation phase, then parallel phases that each depend only on it, each on its own `features/mcp-builtin-phase-N` branch, merged by the parent.

```text
W0  Phase 1  Foundation: Pi 1.5.0, the seam, the record field, the frozen harness   (one session)
W1  Phases 2 3 4 5 6  in parallel                                                    (five sessions)
    (Phase 5 is small; if the session budget is tight, run it in Phase 4's session)
```

No closing phase: the parent applies the collected lines at merge, as in the precedent.

### Phase 1: Foundation (serial; everything below is frozen after it)

Internal waves:

1. **Wave 1:** Pi 1.5.0. `package.json` (dev `^1.5.0`, peer `>=1.5.0`, `@earendil-works/pi-ai` exact `1.5.0`, `pi-tui ^1.5.0`), `package-lock.json`, and type fixes in `platform/pi-api.ts`.
2. **Wave 2, in parallel:**
   - (a) The domain seam: `domain/mcp-implementation.ts`, the `mcp-server-features.ts` split plus `"sse"`, `domain/mcp-builtin-features.ts`, `domain/name.ts` `builtinMcpServerName`.
   - (b) The closed-set commit: reason `"requires MCP support"` in `notification-types.ts`, `notification-wire.ts` `REASONS`, `notify-reasons.ts`, `notify-closed-set-locks.test.ts`, `docs/json-output.md`, catalog counters. The exact wording comes from the messaging style guide.
   - (c) The cucumber harness: profiles in `cucumber.json` (`adapter` and `builtin` over `@mcp`, the default profile excluding `@mcp`), a world parameter `mcpImplementation`, a shared step "Given pi runs with the scripted model and the MCP implementation" (loads the adapter companion in the adapter profile, nothing in the built-in profile; a `none` variant passes `--no-mcp`), `test/e2e/_rpc.ts` `piArguments`, `features/lib/companions.ts`, `scripts/check-features.mjs` tag rules (`@adapter-only`, `@builtin-only`), `package.json` `test:cucumber` running both profiles, and splitting the MCP-07 agent scenario out of `features/mcp-server/invocation.feature` into `features/mcp-server/agent-grants.feature`.
3. **Wave 3:**
   - `platform/pi-api.ts` (snapshot field, `hasLoadedBuiltinMcp`, `PiMcpRegistry`, MCP config types).
   - `persistence/state-io.ts` (`mcpServerConfigs?`), `persistence/locations.ts` (two user-scope paths).
   - The resolver producer: `declaredMcpServers` in `mcp-resolution.ts`, `plugin-resolver.ts`, `resolver-types.ts`.
   - `install-outcome.ts` `statePhase` writes the field.
   - `orchestrators/mcp/{session-materialize,recorded-servers}.ts` plus three no-op step seeds.
   - `platform/mcp-builtin-status.ts` seed.
   - `EdgeDeps.mcpStatus` as `{adapter, builtin}`.
   - `index.ts` wiring.
4. **Wave 4:** the gate (`npm run check`, whole `test:modules`, both cucumber profiles), decisions, parent lines.

**Visible behavior change in Phase 1: none.** Stored compatibility is still the adapter verdict, the steps are no-ops, and the built-in profile runs the existing MCP features. Tag the features that fail under built-in `@adapter-only` for now; the owning phase removes the tag. That is how the phase stays green.

**Frozen after Phase 1:** `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `cucumber.json`, `scripts/check-features.mjs`, `scripts/install-test-peers.mjs`, `test/e2e/_rpc.ts`, `features/support/**`, `features/lib/{pi-process,pi-commands,companions,run-tokens,published-marketplace,mcp-stub-server}.ts`, the shared step modules (including `mcp-server/listing.steps.ts` and `companion`), `platform/pi-api.ts`, `domain/mcp-implementation.ts`, `domain/mcp-server-features.ts`, `domain/mcp-builtin-features.ts`, `domain/name.ts` (MCP functions), `persistence/state-io.ts`, `persistence/locations.ts`, `orchestrators/mcp/session-materialize.ts`, `orchestrators/mcp/recorded-servers.ts`, `index.ts`, `edge/register.ts`, the closed-set reason files, `.fallowrc.json`, `rule-packs/architecture.json`.

**Frozen cross-phase interfaces** (the contract each parallel phase codes against):

1. `McpImplementationProfile`, `ActiveMcpImplementation`, `profileFor`, `effectiveMcpCompatibility` signatures (Pattern 1).
2. `SoftDepStatus.mcpImplementation` and the probe precedence (adapter, then builtin, then none).
3. `mcpServerConfigs?: {name, config}[]` (pre-substitution Claude form) and `recordedMcpServers(record, reader)` with its legacy fallback.
4. `resolved.declaredMcpServers: Record<string, unknown>` (all non-malformed, merge order).
5. Step contracts: `settingsCleanupStep(ctx)`, `builtinRegistrationStep({pi, ctx, snapshot})`, `resyncBuiltinRegistrations(...)`, `agentGrantsStep({ctx, snapshot})`, each returning `Promise<void>`, never throwing.
6. `PiMcpRegistry { registerMcpServer; unregisterMcpServer; getMcpServers }` and `McpStatusReader.lookup(serverName)`.
7. `EdgeDeps.mcpStatus: { adapter: McpStatusReader; builtin: McpStatusReader }`.
8. The cucumber world parameter, the profile tags, and the "MCP implementation" step wording.
9. The reason literal `"requires MCP support"` (closed set).

### Wave-1 parallel phases: file ownership

| Phase | Goal | Owns (product) | Owns (tests and features) | Must not touch |
|---|---|---|---|---|
| **2 Built-in materialization** | Recorded servers connect through built-in on startup and `/reload`, with Claude names, configuration as upstream, trust gating, decision-2 exposure, and the adapter-to-built-in switch with no action | `domain/mcp-builtin-translation.ts` (NEW), `bridges/mcp/builtin-{entry,escape,registration}.ts` (NEW), `bridges/mcp/substitute.ts` (encoder parameter), `orchestrators/mcp/builtin-registration-step.ts`, `docs/mcp-compatibility.md` (built-in column) | `test/bridges/mcp/builtin-*`, `test/domain/mcp-builtin-translation.test.ts`, `test/orchestrators/mcp/builtin-registration-step.test.ts`, `features/mcp-server/{listing,configuration,sources,project-scope,lifecycle,invocation}.feature` (drop `@adapter-only`, add `@builtin-only` cases), new `features/mcp-server/implementation-switch.feature`, steps `mcp-server/{configuration,sources,lifecycle,invocation}.steps.ts`, `features/lib/mcp-server-{files,http,environment}.ts` | resolver, compatibility readers, agents, hooks, settings, frozen files |
| **3 Read-time verdicts, markers, list and info** | State, reasons, markers, severity and info status follow the active implementation. Stored compatibility is neutral. Consent is split per C6 | `domain/mcp-resolution.ts` and `domain/plugin-resolver.ts` / `resolver-types.ts` (neutral state, from Phase 1), `install-outcome.ts` gate at `:840` only, `update-preflight.ts:514-516`, `list-installed-row.ts`, `plugin-state-classifier.ts`, `info.ts` (compatibility and MCP component functions), `info-mcp-status.ts`, `platform/mcp-builtin-status.ts`, `shared/concerns/soft-dep.ts` (MCP arm), `shared/notify-reasons.ts` `companionSeverity`, the `partial` sites in `enable-disable.ts`, `install-cascade.ts`, `install-flow-results.ts`, `update-swap.ts`, `import/execute.ts` (own function each), `reconcile/convergence.ts`, `reconcile/mcp-migration.ts` | the unit pairs for those files, `features/mcp-server/{companion-missing,invalid-configs}.feature`, steps `mcp-server/{status,invalid-configs}.steps.ts`, the `features/plugin/*` MCP-marker rows they pin | `bridges/**`, `orchestrators/mcp/*` steps, frozen files |
| **4 Agent grants** | Generated agents carry the active implementation's grant; a switch rewrites them at load, safely | `bridges/agents/convert.ts` (grant and warning), `persistence/agents-index-schema.ts` (+ `agents-index-io.ts` if needed), `orchestrators/mcp/agent-grants-step.ts`, `install-outcome.ts` `agentsPhase` only (`:1300-1330`) | `test/bridges/agents/convert*.test.ts`, `test/persistence/agents-index-*`, `test/orchestrators/mcp/agent-grants-step.test.ts`, `features/mcp-server/agent-grants.feature` and its steps module | `bridges/mcp/**`, `bridges/hooks/**`, verdict readers |
| **5 Hook and tool naming** | Hooks on built-in MCP tools fire under `mcp__plugin_<p>_<s>__<t>`; the `-` divergence is recorded and pinned; the adapter proxy rule applies only under the adapter | `bridges/hooks/dispatch.ts` (`isMcpProxyCall` and its callers only), `docs/hooks-compatibility.md` (MCP row) | `test/bridges/hooks/dispatch*` cases for the proxy, `features/hook/mcp-tool-names.feature` (NEW) and `hook/mcp-tool-names.steps.ts` (NEW) | `domain/components/hooks/**` unless a fix is unavoidable (then a parent line), everything MCP outside hooks |
| **6 Settings cleanup** | Decision 1: the adapter's `-builtin:mcp` goes away when the adapter is gone; the user's own entries never do | `transaction/with-state-guard.ts` (`withPiSettingsLock`), `orchestrators/mcp/settings-cleanup-step.ts`, NEW `orchestrators/mcp/pi-settings-cleanup.ts` (pure decision plus edit), NEW `platform/mcp-onboarding-state.ts` (read-only reader of the adapter file) | their unit pairs, `test/integration/mcp-onboarding-conformance.test.ts` (NEW), `features/mcp-server/builtin-settings.feature` (NEW), `features/lib/pi-settings-files.ts` (NEW) and its steps | everything else. The NFR-10 and "never edit Pi settings" amendments in PROJECT.md are parent lines |

The feature-file split mirrors the "own feature file and step module" rule. Every MCP feature is tagged `@mcp`, so both profiles run it. A scenario whose expectation differs per implementation (for example the adapter's `mcp` proxy search against built-in's `tool_search`) becomes an `@adapter-only` / `@builtin-only` pair in the same file, owned by the same phase. Each phase removes the `@adapter-only` tags that Phase 1 placed on its own files.

### Milestone rules to carry over (with MCP-specific additions)

- Never edited by a child: `CHANGELOG.md`, `README*.md`, PROJECT.md Key Decisions (`D-MB-*`), `BACKLOG.md`. Children list "Parent lines".
- Closed sets are append-only. Phase 1 adds the one new reason. A later phase that needs another reason lands it as its own commit, and the merge keeps both entries.
- Own arm only: `soft-dep.ts` (Phase 3 only), `domain/name.ts` (frozen), `install-outcome.ts` (Phase 1 `statePhase`, Phase 3 gate, Phase 4 `agentsPhase`; each stays inside its own function).
- Every user-visible change ships a cucumber scenario that fails without it, under the profile(s) where it applies. Record the red proof per profile.
- The phase gate runs `npm run check`, plus `npm run test:cucumber` under **both** profiles, plus the whole `test:modules`.

### Merge procedure (suggested order, lowest conflict first)

Phase 6 (isolated files), then Phase 5 (hooks only), then Phase 4, then Phase 2, then Phase 3 last. Phase 3 touches the most shared orchestrator files and changes outcomes that other phases' scenarios pin (markers, `partially-installed`). After each merge, run `npm run check` and both cucumber profiles on the combined tree. After Phase 3 merges, re-verify Phase 2's `implementation-switch.feature`, because the switch scenario asserts the state flip that Phase 3 delivers. Rerun `npx fallow dupes` after merging Phase 2: `builtin-entry.ts` and `adapter-entry.ts` and the two escape modules are likely clone pairs that need reviewed markers.

---

## 4. Build order and dependencies

```text
Phase 1 W1 Pi 1.5.0 ──► W2 seam types │ closed-set reason │ cucumber profiles ──► W3 snapshot + record producer
                                                                                     + steps seeds + index wiring ──► W4 gate
        │
        ├──► Phase 2 needs: profile.serverName, recorded-servers, PiMcpRegistry, snapshot, step seed
        ├──► Phase 3 needs: effectiveMcpCompatibility, declaredMcpServers, snapshot, reason, readers seam
        ├──► Phase 4 needs: profile.grantSelector, snapshot, step seed
        ├──► Phase 5 needs: snapshot (hook runs already open a run), profile.toolNamePrefix
        └──► Phase 6 needs: locations paths, step seed
```

Dependency notes:

1. **Pi 1.5.0 comes first** because `PiMcpRegistry` and the `McpServerConfig` types are taken from 1.5.0's declarations, and `pi-schema` validation changes can break the type fixes. The extension uses no `Type.Refine`, BigInt, Undefined or codecs, per the brief.
2. **The record producer is in Phase 1, not a parallel phase,** because Phase 2's scenarios need records that hold every server, and Phase 3's scenarios need `declaredMcpServers`. It is additive and changes no output, so the foundation stays small.
3. **Phase 3 is the critical path** of wave 1 (the most files, the semantic change). Start it first, and do not let Phase 2 wait on it: Phase 2 asserts connection and naming, not the state reasons.
4. **Research flags** (resolve inside the owning phase's discuss step):
   - Phase 2: how Claude Code sets `cwd` for plugin stdio servers; the built-in `${VAR:-default}` strategy (Pi has no default syntax, so resolve at registration from the session env); whether to write `${VAR}` references or values (secrets in `/mcp` output); `timeout` ms to s rounding; `callbackPort` -> `callbackUrl http://localhost:<port>/callback` to keep Claude's redirect URI.
   - Phase 3: what "none" means for the partial state (a neutral table plus the marker is recommended).
   - Phase 4: how to detect a pi-subagents background child.
   - Phase 6: the onboarding-state authorship ambiguity and the first-session gap (C8a, C8b).
   - Phase 3/2: whether built-in lists deferred tools in `getAllTools()` before `tool_search`, for the status reader.

---

## Sources

- This repo (read directly): `index.ts`, `platform/pi-api.ts`, `platform/mcp-status.ts`, `shared/concerns/soft-dep.ts`, `shared/notification-run.ts`, `shared/notify-reasons.ts`, `domain/mcp-server-features.ts`, `domain/mcp-resolution.ts`, `domain/plugin-resolver.ts`, `domain/name.ts`, `bridges/mcp/{index,types,stage,adapter-entry,substitute}.ts`, `bridges/agents/convert.ts`, `bridges/hooks/dispatch.ts`, `bridges/hooks/hook-env.ts`, `persistence/state-io.ts`, `persistence/agents-index-schema.ts`, `orchestrators/plugin/{install-outcome,info,info-mcp-status,list-installed-row,plugin-state-classifier}.ts`, `orchestrators/reconcile/{convergence,mcp-migration}.ts`, `.fallowrc.json`, `test/e2e/_rpc.ts`, `cucumber.json`. Confidence HIGH.
- Pi 1.5.0 (`npm pack @earendil-works/pi-coding-agent@1.5.0`): `docs/extensions.md` (lifecycle diagram, `resources_discover`, `mcp_servers_change`, "MCP Servers"), `docs/mcp.md` (names, `${}` and `!cmd`, "Replace the built-in MCP support"), `dist/core/agent-session.js:2678-2710,3016-3048`, `dist/core/extensions/runner.js:242-246,503-520`, `dist/extensions/mcp/index.js:224-262,971-1110`, `dist/extensions/mcp/runtime.js:39-70`, `dist/core/resolve-config-value.js`, `dist/core/settings-manager.js:120-170`, `dist/core/package-manager.js:764-770`, `dist/core/source-info.js`, `dist/core/mcp-servers.d.ts`. Confidence HIGH (primary source).
- pi-mcp-adapter 7.0.0 (`npm pack`): `pi-builtin-mcp.ts`, `onboarding-state.ts`, `index.ts:1259,1365,1406,1705`. Confidence HIGH.
- pi-subagents 0.84.0 (`npm pack`): `docs/agents.md:450,573`, `CHANGELOG.md:440,480,507,530`, `docs/extension-api.md:294`. Confidence HIGH for the documented behavior; the child-detection mechanism was not found (flag).
- Precedent: `.planning/milestones/component-features-ROADMAP.md:48-198` (Parallelism, File ownership, Frozen after Phase 1, Milestone rules, Merge procedure), `.planning/milestones/component-features-CHILD-SESSION-BRIEF.md`.

---
*Architecture research for: mcp-builtin (Pi built-in MCP as an equal alternative to pi-mcp-adapter)*
*Researched: 2026-11-04*
