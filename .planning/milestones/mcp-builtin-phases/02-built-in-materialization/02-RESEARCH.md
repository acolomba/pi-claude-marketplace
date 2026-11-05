# Phase 2: Built-in Materialization - Research

**Researched:** 2026-11-04
**Domain:** Registering Claude plugin MCP servers with Pi 1.5.0's built-in MCP (`pi.registerMcpServer`), value encoding for Pi's config resolver, status inference, dual-profile cucumber scenarios
**Confidence:** HIGH for Pi 1.5.0 behavior (read from the installed `dist/` sources this session); MEDIUM for Claude Code 2.1.318 behavior (minified binary strings, symbol names not stable across chunks); HIGH for repo structure and frozen interfaces (read this session).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(Copied verbatim from `02-CONTEXT.md` `## Implementation Decisions`.)

### Translation and value encoding (BLT-02; D-MB-02, D-MB-04, D-MB-11)

- **Source of each server:** the recorded Claude form, read only through
  `recordedMcpServers(record, reader)` (frozen interface 3), then classified
  with `profileFor("builtin").classify`. A server the built-in profile blocks
  or finds malformed is never registered. A record's install-time verdict does
  not filter: a server the adapter blocked but built-in runs (for example
  `bareElicitationCapability: true`) is registered from the record's full
  `mcpServerConfigs`. A `{ kind: "unreadable" }` answer registers nothing for
  that plugin and is debug-logged on the `mcp` channel.
- **Variables: resolved by the extension at registration, never written as
  references.** Pi expands only `env`, `headers`, and `oauth.clientSecret`,
  reads bare `$NAME`, has no `${NAME:-default}`, runs a value that starts with
  `!` as a shell command, and fails the connection on an unset variable
  (research PI-1, PI-2). So the built-in encoder expands every Claude reference
  itself with Claude's rule (`domain/claude-mcp-variables.ts`
  `expandClaudeValue`, the AVAR-05 deny-lists included), from the session's
  environment at registration time, and then encodes for Pi:
  - in `env` and `headers` values (the fields Pi expands): every `$` becomes
    `$$`, and a leading `!` becomes `$!`, so the server gets the expanded value
    byte for byte;
  - in `command`, `args`, and `url` (fields Pi does not expand): the expanded
    value as is;
  - an unset variable with no default keeps Claude's literal `${NAME}` text
    (AVAR-02), encoded as above (`$${NAME}` in `env` and `headers`).
  - Resolved values live only in memory and in Pi's session registry; nothing
    is persisted (D-MB-04). `getMcpServers()` exposes them to extensions in the
    same Pi process, which already sees `process.env`; recorded as a dubious
    choice.
- **Builtins:** `${CLAUDE_PLUGIN_ROOT}` is the record's plugin root
  (`record.resolvedSource`, checked for containment first, see Registration),
  `${CLAUDE_PLUGIN_DATA}` is the scope's plugin data directory, and
  `${CLAUDE_PROJECT_DIR}` is the session's `ctx.cwd` for both scopes (the
  registration happens per session, so the value Claude Code would compute is
  known). The stdio `env` gets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`
  injected as literal values, as the adapter path does (MENV-01..03).
- **Encoder parameter:** `bridges/mcp/substitute.ts` takes the encoder as a
  parameter (adapter encoding from `adapter-escape.ts` stays the default the
  adapter path passes; built-in encoding lives in NEW
  `bridges/mcp/builtin-escape.ts`), so one walk serves both implementations.
  The adapter files keep writing `mcp-adapter.json` byte for byte.
- **Field table** (NEW `domain/mcp-builtin-translation.ts`, pure; the
  research FEATURES.md three-column table is the reference):
  - transport: stdio (`type` absent or `stdio`) and streamable HTTP (`http`,
    `streamable-http`, written as `type: "http"`); `sse`, `ws`, host-only
    types, and bundles never reach the table (blocked by the profile).
  - stdio: `command`, `args`, `env`. `cwd` is never written (not a Claude
    field, CC-1); Pi then uses the session directory. Whether Claude Code
    starts a plugin stdio server in the project directory is to be confirmed
    by the phase researcher; if it differs, record the gap, do not write a
    Pi-only `cwd`.
  - remote: `url`, `headers`; `headersHelper` is blocked by the profile.
  - `timeout` (milliseconds, with `request_timeout_ms` standing in and the
    same minimum and cap the adapter translation applies) becomes Pi's
    `timeout` in seconds, `ms / 1000` with no rounding (Pi accepts any
    positive number). Pi resets it on progress; that difference stays a
    recorded gap.
  - OAuth: `clientId` as is; `callbackPort` becomes
    `callbackUrl: "http://localhost:<port>/callback"` (Claude's redirect,
    CC-7; Pi would use `127.0.0.1` from `callbackPort` alone); `scopes`
    becomes `scope` (a string, Pi's type); `authServerMetadataUrl` as is.
    D-MB-11 as amended: `clientName` and `clientRegistration` are never
    written, so Pi keeps CIMD. Any other `oauth` key, `auth`, `enabled`,
    `toolExposure`, `cwd`, and every Pi-only power are never written.
  - `exposure`: `"deferred"`, or `"direct"` when `alwaysLoad === true`
    (D-MB-02).
  - `description`: the plugin's description, as the adapter entry writes it.
  - Dropped silently as with the adapter: `discoveryCache`, `role`,
    `displayName`; tool permission fields are dropped (the adapter path's
    `tool-rules-unenforced` warning comes from the install, which still
    stages adapter entries under every implementation).

### Registration and sync (BLT-01, BLT-03, BLT-06, MSEL-03, MREC-02; D-MB-09, D-MB-10, D-MB-12)

- **Gate (MSEL-03):** both steps register and unregister only when
  `snapshot.softDeps.mcpImplementation === "builtin"`. Under `adapter` or
  `none` they do nothing at all, so Pi reports no extension error and the
  adapter never sees a proxy-only duplicate.
- **Desired set:** every enabled record (not disabled and not
  dependency-disabled) of the user scope, and of the project scope only while
  `ctx.isProjectTrusted()` is true (D-MB-09, checked on every call, background
  children included). Each runnable server of each such record is one
  registration named `profileFor("builtin").serverName(plugin, server)`
  (`plugin_<plugin>_<server>`, D-MB-13). The same plugin in both scopes: the
  trusted project record wins and the user record's servers are not
  registered (`overridden by project scope`, as under the adapter); with an
  untrusted project the user record registers.
- **Containment (UF-1 / NFR-10):** before a record's servers are read or
  expanded, the step checks `record.resolvedSource` with `assertPathInside`
  against the scope's `pi-claude-marketplace/` root (the plugin clone for a git
  record, the marketplace clone for a path record). A record that fails
  registers nothing and is debug-logged. The check lives in the step (owned),
  not in the frozen `recorded-servers.ts`, and runs for every record, legacy or
  not, because the same root feeds `${CLAUDE_PLUGIN_ROOT}`.
- **Legacy records (MREC-02):** a record without `mcpServerConfigs` reads its
  servers through `createLegacyServersReader` (frozen), wired in the step with
  the record's marketplace from the scope's state. The read is read-only and
  network-free. Its known limit stays: a path plugin that changes its servers
  without a version bump reads the new servers.
- **Idempotent sync:** `builtinRegistrationStep` (at `session_start`) and
  `resyncBuiltinRegistrations` (after `loadReconcile`) share one sync over
  `PiMcpRegistry`: compute the desired name-to-config map, unregister each
  `plugin_` registration Pi lists that the map lacks (Pi's
  `unregisterMcpServer` leaves other extensions' servers alone), and register
  each desired server whose config differs from what Pi lists. Pi's built-in
  MCP compares the config JSON, so an unchanged re-registration does not
  reconnect. Registrations are session-only and die with the runtime, so
  every load starts from an empty registry.
- **Failure isolation:** each `registerMcpServer` call has its own try/catch;
  a throw (another extension owns the name, Pi's validation refuses the
  config) is debug-logged and the loop goes on. Neither step throws (NFR-2).
- **Never handle `mcp_servers_change`** (it would mark the extension as the
  connector, PI-11).
- **Timing (D-MB-10):** registrations change only at `session_start` and after
  the load reconcile, never at once on install, uninstall, enable, disable, or
  update (MCPV2-01). The reload hint stays the same for every component kind.
  So disable and uninstall remove a server from the next session, enable
  restores it, and update replaces it with the new declaration (BLT-06). An
  `autoapply` load that changes records inside `loadReconcile` is picked up by
  the resync in the same load.
- **Background children (D-MB-12):** they run the same steps and register for
  their own session under the same trust gate; registration writes nothing.
  Child detection is Phase 4's; Phase 2 adds none.

### Naming, collisions, overrides, and status (BLT-04, BLT-05; D-MB-13)

- **Names:** servers `plugin_<plugin>_<server>` (`-` kept); tools follow the
  frozen profile (`toolName`, `toolNamePrefix`, which returns `undefined` past
  Pi's 55-character cut, so status and scenarios then match full tool names).
  The `-` to `_` fold in the namespace and tool names and the 64-character cut
  are recorded divergences licensed by Pi capability gaps in
  `docs/mcp-compatibility.md`.
- **Collisions between plugin servers** are already refused at install by
  ANAME-03 (the adapter key is the built-in name plus `_`, so a folded adapter
  collision is a folded built-in collision), because install stages adapter
  entries under every implementation (MSEL-04). No second check at load.
- **`mcp.json` overrides and registration failures are reported in `info`,**
  not by a new load-time notice: an `mcp.json` server (user
  `<agentDir>/mcp.json`, and the project `.pi/mcp.json` only while trusted, the
  files Pi's built-in MCP reads) whose namespace (`-` folded to `_`) equals a
  plugin server's shows `overridden by mcp.json` (the BLT-05 token Phase 1
  appended); Pi's own `/mcp` lists the same override. A server whose
  registration failed shows `not loaded` (the reader answers `unlisted`). No
  closed-set message is added. Upstream reports a suppressed duplicate plugin
  server (`mcp-server-suppressed-duplicate`) in `/plugin`, the analog of
  `info`. Recorded as a dubious choice.
- **Status reader** (`platform/mcp-builtin-status.ts`, frozen signature,
  lookup by registered server name), computed per lookup from Pi's live
  registry and tool list (no event exists, PI-12):
  - not in `getMcpServers()` → `unlisted` (renders `not loaded`);
  - registered, with a tool in the server's namespace whose exposure is not
    `hidden` → `connected` (Pi registers deferred tools in `getAllTools()` as
    soon as the server connects, before any `tool_search`);
  - registered, every tool of the namespace `hidden` → `disabled` (Pi hides a
    server's tools when `/mcp` disables it for the session);
  - registered, no tool yet → `not-connected` (connecting, failed, or needs
    sign-in; Pi does not tell them apart, and reports failures and sign-in
    itself once after start).
- **`withMcpServerStatus`** (`orchestrators/plugin/info-mcp-status.ts`, owned
  body) keys the lookup by `lookup.implementation`: the adapter key
  (`generatedMcpServerKey`) under `adapter` and `none`, the built-in name under
  `builtin`. Under `builtin` it stamps, in this order: `project not trusted`
  for a project row while `lookup.projectTrusted` is false;
  `overridden by mcp.json` from the scope files above read through
  `lookup.cwd`; `overridden by project scope` for a user row the enabled,
  trusted project record overrides; otherwise the reader's answer. The adapter
  path keeps its bytes.

### Switch, legacy entries, scenarios, and docs (MSEL-02, MSEL-04, MREC-02, MDOC-01)

- **Switch scenario:** `features/mcp-server/implementation-switch.feature`,
  `@own-implementation`, uses the frozen restart steps: install under the
  adapter and reach the server; restart without the adapter (the adapter's
  `-builtin:mcp` stays, so the session is `none`; Phase 2 asserts only that the
  server is not reached and Pi reports no extension error, and Phase 6 adds the
  `{requires mcp}` row, DUAL-04); restart with Pi's built-in MCP turned on and
  reach the server under built-in; restart with the adapter and reach it
  again. No plugin command runs in between.
- **MSEL-04:** a scenario installs under built-in, restarts with the adapter,
  and reaches the server with no rewrite of `mcp-adapter.json` at load.
- **MREC-02:** a scenario rewrites a record to drop `mcpServerConfigs` (the
  earlier-version precedent in `features/lib/earlier-version-state.ts`) and
  reaches the server under built-in with no reinstall; the adapter leg needs
  no change, since the adapter entries already exist.
- **Legacy `mcp.json` entries** (written by releases before AMIG-01) are keyed
  by the declared server name, so their namespace never equals a
  `plugin_<plugin>_<server>` registration and never overrides it. In the
  first built-in session after an upgrade from such a release, Pi's built-in
  MCP also runs the legacy entry under its old name, until the same load's
  AMIG-01 move (Phase 3's `mcp-migration.ts`) takes it out of `mcp.json`.
  Phase 2 adds no code for it and records the one-session gap.
- **Scenarios:** every owned feature (`listing`, `configuration`, `sources`,
  `project-scope`, `lifecycle`, `invocation`) loses Phase 1's file-level
  `@adapter-only`. A scenario whose expectation is the same under both
  implementations becomes `@mcp` with the shared "MCP implementation" steps; a
  scenario whose expectation differs is an `@adapter-only` and `@builtin-only`
  pair in the same file, its title naming the requirement or decision ID.
  Built-in twins assert what Pi reports (tool names, the model's calls, the
  stub's received messages and environment), never the files the bridge
  wrote. Phase 2's scenarios never use the Phase 1 stand-in. New built-in
  scenarios go in NEW `features/mcp-server/builtin-*.feature` files when they
  have no adapter twin (trust, status in `info`, OAuth values, `alwaysLoad`
  direct calls).
- **IN-02:** where `configuration.feature`'s installs use "which did not fail"
  although the adapter output is fixed, the lifted file restores an assertion
  that fails when the notice disappears.
- **Red proof:** every new or lifted built-in scenario is shown failing
  against the Phase 1 seeds (no registration) under the builtin profile, and
  each adapter-profile change is shown failing without its change.
- **MDOC-01:** `docs/mcp-compatibility.md` gains a built-in column; each
  built-in statement cites a scenario or the Pi 1.5.0 source file. The
  CHANGELOG and README lines are parent lines (Phase 6).

### Claude's Discretion

- Plan split and waves follow the ROADMAP's suggested structure (Wave 1
  tracer: translation, encoding, sync, the step, `listing.feature` under both
  profiles; Wave 2 parallel per feature file; Wave 3 docs and gate). The
  planner may split further when plans of one wave own disjoint files.
- Module boundaries inside the owned set (`builtin-entry.ts`,
  `builtin-escape.ts`, `builtin-registration.ts`), the step-module and lib
  names (`mcp-server/builtin-*`, `mcp-builtin-*.ts`), and whether the status
  reader caches per lookup.
- How the encoder parameter is threaded through `substitute.ts` without
  changing the adapter output.

### Deferred Ideas (OUT OF SCOPE)

- A load-time notice for an overridden or failed built-in registration (needs
  a new closed-set message; info and Pi's `/mcp` report it for now).
- Immediate register and unregister on install, uninstall, enable, and disable
  (MCPV2-01); deny rules to `toolExposure: "hidden"` (MCPV2-02); background
  agents under built-in (MCPV2-03).
- A fallback when `tool_search` is turned off (`-builtin:tool-search`), which
  makes deferred tools unreachable: recorded gap.
- The `{requires mcp}` step of the switch scenario (DUAL-04, Phase 6) and every
  marker or state row that depends on the active implementation (Phase 3).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MSEL-02 | After a switch and `/reload`/restart, every installed plugin's servers run through the new implementation with no plugin action | Q1/Q2: registrations are per-runtime and re-read at every `session_start`; switch scenario mechanics (frozen restart steps, `recordsSince(0)` for extension errors) in "Cucumber" |
| MSEL-03 | Never register while adapter or none is active; no extension error | Q1: `reportUnhandledMcpServers` fires on every registry change and after `session_start` when no `mcp_servers_change` handler exists; pi-mcp-adapter handles `mcp_servers_change` and proxies registrations; gate on `snapshot.softDeps.mcpImplementation` |
| MSEL-04 | Adapter entries keep being written at install under every implementation | Already true (Phase 1 producer); scenario recipe: install through a builtin profile Pi, restart with adapter |
| MREC-02 | Pre-milestone record materializes under either implementation with no reinstall | Frozen `createLegacyServersReader` + `recordedMcpServers`; new `mcp-builtin-*` lib to rewrite `state.json` (earlier-version precedent); `@mcp` scenario |
| BLT-01 | Under built-in, every enabled plugin's runnable servers register at every startup and `/reload`; deferred via `tool_search`, `alwaysLoad` direct | Q1/Q2/Q3; tool_search output needs a Phase 2 projection step (see Pitfall 6) |
| BLT-02 | Claude's values: transports, fields, variable expansion, `timeout` seconds, OAuth; `$` and leading `!` reach the server unchanged | Q4/Q5: encoder rules verified against Pi's `resolve-config-value.js`; derive the field table from frozen `translateMcpServer` |
| BLT-03 | Project-scope servers only while Pi trusts the project | `ctx.isProjectTrusted()` is bound before `session_start` (`runner.js` `bindCore`); untrusted step `pi runs with the scripted model in an untrusted project` + `the project holds a pi settings file` |
| BLT-04 | Names `plugin_<p>_<s>`, tools `mcp__plugin_<p>_<s>__<tool>`; collisions and `mcp.json` overrides reported | Q1 (Pi `registeredServers` namespace override), Q4e (Claude's `mcp-server-suppressed-duplicate` is signature-based), Q7 |
| BLT-05 | `info` shows connected / not connected / disabled / overridden by `mcp.json` / project not trusted | Q3: status mapping confirmed with caveats; `withMcpServerStatus` is synchronous so the `mcp.json` read must be synchronous |
| BLT-06 | Disable/uninstall remove from next session; enable restores; update replaces | Registry rebuilt per runtime; resync after `loadReconcile`; lifecycle twins |
| MDOC-01 | Built-in column in `docs/mcp-compatibility.md`, each statement cited | Q11: doc structure and where columns go |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Read a file before editing it; trace callers before modifying a function. Use CodeGraph (`codegraph explore`) before grep in this repo.
- Never commit to `main`; branch `features/mcp-builtin-phase-2`; merge, never rebase; no `--no-verify`, no amend, no force-push.
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap. Research Claude Code with `claude-code-compat-research` (binary 2.1.318, never run beyond `--version`).
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, cycles, health `maxCognitive 15`/`maxCyclomatic 20`, dupes fail on every clone group), Prettier, source/test pairing, unit tests, integration tests, cucumber (both profiles), 100% direct coverage per source-test pair.
- Output only through `shared/notification-dispatch.ts`; no `process.stdout`/`stderr`, no `console.*` (rule pack). Debug through `hookDebugLog(detail, "mcp")` only (`shared/debug-log.ts`, the sanctioned `console.error`).
- NFR-1 atomic writes; NFR-2 no Pi restart needed, steps never throw; NFR-5 network: `list`, `info`, load without autoapply never touch the network; NFR-10 containment; IL-4 no telemetry; IL-1 English only.
- Behavioral tests: every user-visible `/claude:plugin` behavior change ships a cucumber scenario that fails without it, per profile where it applies; scenarios observe what Pi/companions report, never bridge-written files.
- Every plan `SUMMARY.md` has `## Threat Flags`; prefix `gsd-tools windows append --description` with `[mcp-builtin]`.
- Child-session rules (CHILD-SESSION-BRIEF.md): edit only Phase 2-owned files; frozen-file changes are "Parent lines" in the last SUMMARY; closed sets append-only, one commit per new entry; commit titles carry no milestone/phase/plan identifiers; run npm scripts with `npm_config_script_shell=<scratchpad>/nondac-sh NODE_OPTIONS=--max-old-space-size=6144`.
- Unit-test design rules (`typescript-unit-tests`): no test-only exports, no module-level mutable state, explicit dependencies (no hidden `process.env` reads inside logic; read env in the composition module), `strong-mock` strict mocks, no coverage ignores.
- `no-await-in-loop` is an error under `extensions/pi-claude-marketplace/**`; every sequential await needs `// eslint-disable-next-line no-await-in-loop -- <reason>`.

## Summary

Pi 1.5.0's built-in MCP behaves as CONTEXT.md assumes on every point that matters for the design. `pi.registerMcpServer` validates the config, refuses a name owned by another extension or one that folds (`-`/`_`) onto another registration, and stores a `structuredClone` per extension runtime; `/reload` builds a new runtime with an empty registry. The built-in extension reads registrations at its own `session_start` and later ones through its `mcp_servers_change` handler, which drops and reconnects a server only when `JSON.stringify(config)` changed. Our extension's `session_start` handler runs before the built-in's in both the CLI and settings load orders, but both orders connect, and the built-in's session controller is live during `resources_discover`, so the resync connects at once. `getAllTools()` lists a deferred server's tools with `exposure: "deferred"` and a `namespace { name, aliases: [server] }` the moment the server connects; `/mcp` disable re-registers them as `hidden`. Pi gives extensions no connection state, so the CONTEXT status mapping is the best available and correct.

The encoder rules are verified against Pi's `resolve-config-value.js`: `$$` → `$`, `$!` → `!` anywhere in a template, a leading `!` runs a command, `$NAME` and `${NAME}` expand, and only `env` values, `headers` values and `oauth.clientSecret` are resolved (`runtime.js`). Claude Code 2.1.318's expansion (`n8`) uses a set value even when it is empty, and uses the `:-` default only when the variable is unset, which fixes the built-in encoder's reference rule. Claude spawns stdio MCP servers with `cwd` = its project config root when known, which equals Pi's session directory in a normal launch, so P2-DC-04 holds (no `cwd` written; residual gap only when Claude's project root differs from the launch directory). Claude's `mcp-server-suppressed-duplicate` is a signature (same command/URL) duplicate check reported in `/plugin`, so it is a loose analog of Pi's name-based `mcp.json` override, not an exact one.

The evidence contradicts three CONTEXT details: (1) the UF-1 containment root cannot be `<scopeRoot>/pi-claude-marketplace/`, because a `dir`/`file` marketplace's `marketplaceRoot` is the user's own directory, so the check must be "inside `marketplaceRoot` or inside `pluginClonesDir`"; (2) `withMcpServerStatus` is synchronous behind a frozen call, so the `mcp.json` override read must be synchronous; and (3) under built-in, `info` must stamp the servers named in `mcpServerConfigs`, not `resources.mcpServers` (the adapter subset). Two harness gaps need Phase 2-owned steps: Pi's `tool_search` result has no upstream projector (the frozen `the model receives these calls:` would show raw Pi wording), and the `none` leg of the switch scenario needs a restart-scoped "no extension error" and "not reached" assertion.

**Primary recommendation:** Derive the built-in field table from the frozen `translateMcpServer` output (rename `requestTimeoutMs`→`timeout`/1000, `oauth.redirectUri`→`oauth.callbackUrl`, drop `directTools`/`toolPrefix`/`auth`, add `type: "http"` and `exposure`), thread a required `McpFieldEncoder` through `substituteAndInject`, and build one idempotent sync in `bridges/mcp/builtin-registration.ts` that both frozen step functions call after the `builtin` gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field table (Claude → Pi built-in config) | domain (`domain/mcp-builtin-translation.ts`) | -- | Pure mapping; reuses frozen `translateMcpServer` (domain→domain edge allowed) |
| Value encoding for Pi's resolver | bridges-mcp (`builtin-escape.ts`) | domain (`claude-mcp-variables.ts`) | Mirrors `adapter-escape.ts`; domain owns Claude's rule, the bridge owns the target encoding |
| Field walk (expand + inject env) | bridges-mcp (`substitute.ts`) | -- | Shared walk, encoder injected (consumer-declared port) |
| Built-in entry assembly | bridges-mcp (`builtin-entry.ts`) | domain | Translation + walk + description, no Pi calls |
| Idempotent registry sync | bridges-mcp (`builtin-registration.ts`) | platform types | Operates on the `PiMcpRegistry` port; testable with a strict mock |
| Desired-set computation (state, trust, containment, legacy reader) | orchestrators (`orchestrators/mcp/builtin-registration-step.ts`) | persistence, orchestrators/mcp (frozen readers) | Composition root; reads `process.env`, `ctx`, state |
| Status inference from Pi's live registry | platform (`platform/mcp-builtin-status.ts`) | -- | External-system boundary; may import only `shared` (so no domain naming helpers) |
| `mcp.json` override read (sync) | bridges-mcp (new sync reader) | persistence (`locationsFor(...).mcpJsonPath`) | Bridge owns MCP config files; must be sync for the frozen info call |
| Status stamping in `info` | orchestrators (`info-mcp-status.ts`) | bridges-mcp, platform | Owned body behind the frozen call in `info.ts` |
| Behavioral proof | cucumber (`features/mcp-server/*`) | Phase 2 libs `mcp-builtin-*.ts` | Dual profile; built-in twins observe Pi |

## Standard Stack

No new packages. Phase 2 uses only what the repo already has.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | 1.5.0 (dev `^1.5.0`, peer `>=1.5.0`) | `pi.registerMcpServer` / `unregisterMcpServer` / `getMcpServers`, `getAllTools`, `isProjectTrusted` | The Pi host; reached only through `platform/pi-api.ts` (rule `pi-peer-chokepoint`) [VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json `"version": "1.5.0"`] |
| `typebox` | `^1.1.38` | Not needed for new code unless a validator is added | Already the project's schema lib [CITED: .planning/codebase/STACK.md] |
| `strong-mock` | (dev, existing) | Strict mocks for `PiMcpRegistry`, `ExtensionContext` in unit tests | Mandated by `typescript-unit-tests` [CITED: .agents/skills/typescript-unit-tests/SKILL.md] |
| `@cucumber/cucumber` | (dev, existing) | Behavioral scenarios, two profiles | Existing harness [CITED: cucumber.json] |

### Supporting (test-only, existing)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Pi dist modules by file URL | 1.5.0 | Conformance tests against Pi's real `resolveConfigValueOrThrow`, `validateMcpServerConfig`, `mcpNamespace`, `createMcpToolName` | `test/integration/mcp-builtin-*` (Pi's `exports` map publishes only `.` and `./rpc-entry`, so import `node_modules/@earendil-works/pi-coding-agent/dist/core/*.js` by absolute file URL, as `pi-mcp-adapter-peer.ts` does for the adapter) |
| pi-mcp-adapter 7.0.0 (optional peer cache) | 7.0.0 | Adapter profile and switch scenario | Installed by `node scripts/install-test-peers.mjs` (verified this session: "Installed optional test peers pi-mcp-adapter@7.0.0 pi-subagents@0.84.0 @quintinshaw/pi-dynamic-workflows@3.15.0") |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deriving the built-in table from `translateMcpServer` output | A second independent table in `mcp-builtin-translation.ts` | The timeout minimum/cap and OAuth mapping live in module-private helpers of a frozen file; a copy would drift and trip `fallow dupes` |
| Comparing desired vs listed config JSON before `registerMcpServer` | Always re-registering | Re-registering an unchanged config does not reconnect, but every call fires `mcp_servers_change` and `ensureDiscoveryActive`; the compare keeps the registry quiet |
| Driving Pi's real built-in extension in an integration test (`createMcpExtension` + fake `pi`) | Conformance tests + cucumber builtin profile | Faking the full `ExtensionAPI` surface is large; the builtin cucumber profile already runs the real thing end to end |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed or added by this phase (`package.json` and `package-lock.json` are frozen). The only install step is the existing `node scripts/install-test-peers.mjs`, which installs the declared optional-peer floors into `node_modules/.cache/optional-peers` (pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, @quintinshaw/pi-dynamic-workflows 3.15.0), already audited in Phase 1 (T-01-SC).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none new) | -- | -- | -- | -- | -- | -- |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Evidence Answers to the Twelve Research Questions

### Q1. Pi 1.5.0 registration semantics

All [VERIFIED: read this session] from `node_modules/@earendil-works/pi-coding-agent/dist/`.

**`registerMcpServer` throws when** (`core/extensions/loader.js:380-397`):
```js
registerMcpServer(name, config) {
    assertActive();
    const validated = validateMcpServerConfig(name, config);
    if (typeof validated === "string") {
        throw new Error(`Invalid MCP server registered by extension "${extension.path}": ${validated}`);
    }
    const owner = runtime.mcpServers.get(name)?.extensionPath;
    if (owner !== undefined && owner !== extension.path) {
        throw new Error(`MCP server "${name}" is already registered by extension "${owner}"`);
    }
    // Names that differ only in `-` and `_` would share a namespace.
    const clash = runtime.mcpServers
        .list()
        .find((server) => server.name !== name && mcpNamespace(server.name) === mcpNamespace(name));
    if (clash)
        throw new Error(`MCP server "${name}" conflicts with registered server "${clash.name}"`);
    const server = { name, config: structuredClone(validated), extensionPath: extension.path };
    applyRuntimeChange(() => runtime.mcpServers.register(server));
},
```
So it throws for: (a) a stale runtime (`assertActive`), (b) a validation error, (c) a name another extension owns, (d) a fold clash with any other registration, including one of our own (two of our servers folding to one namespace). Registering our own name again replaces it.

`validateMcpServerConfig` (`core/mcp-servers.js:151-213`) rejects: a name not matching `/^[A-Za-z0-9_-]+$/`; `exposure` outside `"codemode", "deferred", "direct", "hidden"`; `timeout` not a positive number ("timeout must be a positive number of seconds"); `type === "sse"`; a `url` that is not http/https; non-string `headers` values; OAuth errors (`oauth.scope must be a string`, `oauth.callbackUrl must be an http URI on localhost, 127.0.0.1, or [::1] without query or fragment`, `oauth.callbackUrl and oauth.callbackPort name different ports`, `oauth.authServerMetadataUrl must be an https URL, or http on localhost, 127.0.0.1, or [::1]`); a stdio entry with non-string `args`/`env`/`cwd`; and an entry with neither `command` nor `url`. It passes unknown keys through and returns a shallow copy with exposure aliases resolved.

Consequence for BLT-02: an unset variable in a `url` keeps Claude's literal `${NAME}` (AVAR-02), so `new URL()` may fail and Pi throws `url must be an http or https URL`. The registration is debug-logged and `info` reads `not loaded`. That matches Claude, which also cannot connect such a server.

**`getMcpServers()`** (`loader.js:403-406` → `mcp-servers.js:234-236`) returns copies of every extension's registrations in registration order: `{ name, config: structuredClone(config), extensionPath }`. `extensionPath` is `extension.path`, the path as given to the loader (`loader.js:498-503`: `path: extensionPath`), which can be relative for a CLI `--extension`. Do not use it to identify our own registrations; use the `plugin_` prefix plus Pi's owner check.

**`unregisterMcpServer` on a name we do not own** is a silent no-op (`mcp-servers.js:223-229`): `if (this.servers.get(name)?.extensionPath !== extensionPath) return;`.

**Re-registration** with the same config: `McpServerRegistry.register` always calls the change listener (`mcp-servers.js:219-222`), so `mcp_servers_change` fires. The built-in handler (`extensions/mcp/index.js:1078-1113`) drops a server only when `next.get(name)?.registeredConfig !== server.registeredConfig`, where `registeredConfig: JSON.stringify(config)` (`index.js:256-260`). Same JSON: no drop, no reconnect. Changed JSON: the old server is removed (`hideTools`, `connection.close()`), the new one added and connected.

**Survives `/reload`?** No. `createExtensionRuntime()` builds `mcpServers: new McpServerRegistry()` (`loader.js:141`), and `loadExtensionsInternal` uses `runtime ?? createExtensionRuntime()` (`loader.js:561`). `AgentSession.reload` reloads the resource loader and rebuilds the runtime, then emits `session_start` with `reason: "reload"` (`agent-session.js:3028-3048`). Every load starts empty.

**`reportUnhandledMcpServers`** (`core/extensions/runner.js:506-519`): if no extension has a `mcp_servers_change` handler, it emits one extension error per not-yet-reported server: `MCP server "<name>" is registered, but no loaded extension connects MCP servers; another extension may have replaced the built-in MCP support` (event `register_mcp_server`). It runs on every registry change (`runner.js:244-246`) and once after `session_start` in both `bindExtensions` (`agent-session.js:2698-2699`) and reload (`agent-session.js:3046-3047`). With `none` (`--no-mcp` or `-builtin:mcp`), any registration is an extension error. With the adapter, pi-mcp-adapter 7.0.0 handles `mcp_servers_change` (`node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/index.ts:1406`) and proxies registrations (Pitfall 4). Hence the MSEL-03 gate.

### Q2. Event order and the session AbortController

[VERIFIED: agent-session.js, runner.js, resource-loader.js, index.js]

- Emission order: `session_start` for all extensions, then `reportUnhandledMcpServers()`, then `resources_discover` (`agent-session.js:2698-2700`; reload `3046-3048`). `runner.emit` awaits each handler in extension order (`runner.js:813-840`).
- Extension order: `mergePaths(cliEnabledExtensions, enabledExtensions)` puts CLI `--extension` paths first (`resource-loader.js:424`), and built-in extensions are appended after packages and local entries (`package-manager.js:765-770`). So our `session_start` handler runs **before** the built-in MCP's, both in the cucumber harness (`--extension`, `test/e2e/_rpc.ts:268`) and for a settings-installed package.
- The built-in's `session` controller starts aborted (`index.js:221-222`) and is replaced at its own `session_start` (`index.js:980`). A registration made before that fires `mcp_servers_change`, whose handler returns at once because `signal.aborted` (`index.js:1079-1081`); the built-in then reads the registration in its own `session_start` through `registeredServers()` (`index.js:983-985`) and connects it. A registration made after it (the other order) connects through `mcp_servers_change`. **Both orders connect.**
- `resyncBuiltinRegistrations` runs inside our `resources_discover` handler after `loadReconcile` (`extensions/pi-claude-marketplace/index.ts:188-195`), which is after every `session_start` handler, so the built-in controller is live and a changed registration connects at once. `ensureDiscoveryActive(ctx)` also runs in that handler, so `tool_search` is activated for a newly added deferred server.

### Q3. Status: what Pi exposes

[VERIFIED: agent-session.js:1110-1122, extensions/mcp/index.js:288-355, tools.js:25-27,245-252]

- `getAllTools()` returns, per tool: `name, description, parameters, promptGuidelines, exposure, namespace?, annotations?, reachesTools?, sourceInfo`. `exposure` is `this._getToolExposure(name)`, the definition's exposure (default `"direct"`).
- On connection, `registerTools` calls `pi.registerTool` for **every** tool of the server with `exposure: getMcpToolExposure(config, tool)` mapped through `toToolExposure` (`codemode` → `deferred`) and `namespace = { name: mcpNamespace(server), aliases: [server], description?, instructions? }`. The definition registry keeps every registered tool regardless of exposure (`agent-session.js:2892-2917`). So **a deferred server's tools are in `getAllTools()` as soon as it connects, before any `tool_search`.** Confirmed.
- `/mcp` disable (`setEnabled(false)`, `index.js:621-647`) calls `hideTools`, which re-registers every tool of the server with `exposure: "hidden"`. A server whose dropped tools are re-registered hidden keeps its other tools. Changing the exposure to `hidden` through `/mcp` also hides every tool, so it reads `disabled` too (acceptable, recorded).
- No connection state is exposed. A server still connecting, failed, or waiting for sign-in has no tools. A server that connected with zero tools also has none.
- The CONTEXT mapping is confirmed: not listed → `unlisted`; any tool in the namespace not `hidden` → `connected`; all `hidden` → `disabled`; none → `not-connected`.

**Two caveats the planner must handle:**
1. An `mcp.json` server whose namespace equals ours owns the namespace: its tools carry `aliases: [<mcp.json name>]`. If the `mcp.json` name is spelled exactly `plugin_<p>_<s>`, the aliases match too, so the reader alone would say `connected`. The `overridden by mcp.json` check in `info-mcp-status.ts` must run before the reader (CONTEXT's order already does).
2. `platform/` may import only `shared/` (`.fallowrc.json` rule `"from": "platform", "allow": ["shared"]`), so the reader cannot use `domain/name.ts` `foldedMcpServerKey`. Match on the tool's own `namespace` field: `namespace.name === "mcp__" + serverName.replaceAll("-", "_")`. `ToolInventoryItem` (`platform/pi-api.ts:195-198`) declares only `name` and `sourceInfo`, so read `exposure` and `namespace` through `in`-narrowing (`"namespace" in tool`), not a cast. Matching on `namespace.name` avoids the 55-character `toolNamePrefix` problem entirely.

### Q4. Claude Code 2.1.318

Binary `/opt/claude-code/bin/claude`, `--version` → `2.1.318 (Claude Code)` (verified this session). Strings extracted with `grep -a -o`; minified symbol names are chunk-local, so attribution across chunks is MEDIUM.

**(a) Stdio `cwd`.** The stdio spawn site builds:
```
let{CLAUDE_CODE_CHILD_SESSION:Re,CLAUDE_CODE_CHROME_MCP_ORG_DENIED:xe,...je}=H,Je=po(),ot={...je,CLAUDE_PROJECT_DIR:Je??Mo(),CLAUDE_CODE_SESSION_ID:G(),CLAUDECODE:"1",...r.env,...};Lre(r.pluginSource,ot,je),eUn(ot),q=new yt({command:Q,args:pe,env:ot,stderr:"pipe",...Je!==null&&{cwd:Je}})
```
with `function po(){return t().host.launchOptions.projectConfigRoot()}` and `function Mo(){return c()?.projectRoot??Oo(t()).projectRoot}`. So Claude starts every stdio MCP server (plugin servers included) with `cwd` = the project config root when it is known, else the process's own cwd, and sets `CLAUDE_PROJECT_DIR`, `CLAUDE_CODE_SESSION_ID`, `CLAUDECODE=1` in its environment before the config `env`. [CITED: binary 2.1.318 strings; MEDIUM because `po`/`Mo` are resolved by name in a minified bundle]
Pi starts the server in `resolve(sessionCwd, expandHome(config.cwd ?? "."))` (`extensions/mcp/runtime.js:67`), the session's `ctx.cwd`, and passes `{...process.env, ...config.env}` (`pi-mcp/dist/transports/stdio.js:75`). The extension already sets `CLAUDE_PROJECT_DIR` (`shared/session-env.ts` `applyMcpAdapterEnv`) and `CLAUDECODE`/`CLAUDE_CODE_SESSION_ID` (`claudeSessionEnvFor`) in Pi's `process.env` before the steps run (`index.ts:270-281`). **P2-DC-04 confirmed**: write no `cwd`. Residual gap: Claude's project config root can differ from the launch directory (Claude resolves a project root; Pi uses the session cwd).

**(b) Variable expansion.** The 2.1.318 plugin MCP expansion:
```
switch(e.type){case void 0:case"stdio":{let He={...e};if(He.command)He.command=Te(He.command,{selectsEndpoint:!0});if(He.args)He.args=He.args.map((qe)=>Te(qe,{selectsEndpoint:!0}));let Re={CLAUDE_PLUGIN_ROOT:n.path,CLAUDE_PLUGIN_DATA:BXe(n.source),...He.env||{}};for(let[qe,Ve]of Object.entries(Re))if(!CYr.has(qe))Re[qe]=Te(Ve,{selectsEndpoint:!0});...}case"sse":case"http":case"ws":{...if(He.url)He.url=Te(He.url,{remoteSink:!0,selectsEndpoint:!0});...if(He.headers){...qe[Ve]=Te(ft,{remoteSink:!0})}
```
where `Te` does `Rge(He,n)` (builtins), then `J8t(Ve,r)` (`${user_config.*}` substitution, new since 2.1.291), then `n8(Ve,void 0,void 0,{remoteSink,blankList})`. The scan `n8`:
```
Te=e.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g,(Ee,Ce)=>{...qe=z[He],...rt=(ne.has(Ve)||Y&&NWe(He,qe)||s&&(IWe(Ve)||DWe(Ve,qe)))&&(qe!==void 0||s);...let Qe=rt?"":qe;if(typeof Qe==="string"){...return Qe}if(Re!==void 0)return Re;let bt=r?.[He];...return S.push(He),Ee})
```
So: same five fields and `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` env injection with those two keys left literal (`CYr`) [CITED: binary 2.1.318]. **A set variable, the empty string included, wins over the `:-` default; the default is used only when the variable is unset; an unset variable with no default keeps its literal `${NAME}` text and is reported missing.** This fixes the built-in encoder's reference rule (Code Examples). The deny-list structure matches `domain/claude-mcp-variables.ts` (plain set, remote-sink superset, base-URL credential check). Two 2.1.318 additions are outside Phase 2's files: `${user_config.*}` substitution (the project does not bridge `userConfig`, so it stays literal under both implementations), and a value-based scrub arm `NWe` gated by `qbo()`, which is true only for `CLAUDE_CODE_ENTRYPOINT === "local-agent"` or the HIPAA/scrub modes (`function qbo(){if(hf())return!0;if(Qo(process.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB))return!1;return process.env.CLAUDE_CODE_ENTRYPOINT==="local-agent"}`), which `domain/claude-credential-denylist.ts` already documents as excluded. The list contents are pinned to 2.1.291 and were not re-diffed against 2.1.318 (Open Question 3).

**(c) OAuth.** 2.1.318 schema: `Qa=p(()=>u({clientId:o().optional(),callbackPort:E().int().positive().optional(),authServerMetadataUrl:o().refine((e)=>e.length<=Cy,...).url().startsWith("https://",...).optional(),scopes:o().min(1).optional(),xaa:by().optional()}))`. `scopes` is a non-empty **string** (Pi's `scope` is a string too). The MCP OAuth redirect is `function Cst(n=f){return\`http://localhost:${n}/callback\`}` with port from `MCP_OAUTH_CALLBACK_PORT`, the configured `callbackPort`, or a free port; dynamic registration sends `client_name:\`Claude Code (${this.serverName})\``. [CITED: binary 2.1.318] Notes: 2.1.318 has no `callbackPort` maximum in the schema (the frozen domain schema caps at 65535) and adds length limits (url 65536, `authServerMetadataUrl` 4096); both are frozen-file drift, not Phase 2 work. Claude always redirects to `localhost`, even without `callbackPort`; CONTEXT writes `callbackUrl` only when `callbackPort` is set, so a server with `clientId` and no `callbackPort` gets Pi's `127.0.0.1` redirect (dubious, Low).

**(d) Timeout.** 2.1.318: `timeout:pt().optional()` with `pt=p(()=>E().int().positive())`; `request_timeout_ms` is `int().positive().optional().catch(void 0)` described `@internal CCR backend wire hint`, folded by `function Awo({request_timeout_ms:e,...n}){return{...n,...n.timeout===void 0&&e!==void 0&&{timeout:Math.min(e,Sy)}}}` with `Sy=300000`, remote types only. Use site: `function li(e){let r=(e?.timeout!==void 0&&e.timeout>=1000?e.timeout:void 0)??i.MCP_TOOL_TIMEOUT??tc;return Math.min(Math.max(r,1000),wc)}`. So milliseconds, a value below 1000 is ignored, floor 1000, capped at `wc`. This matches the frozen adapter table (`MIN_TIMEOUT_MS = 1000`, `MAX_TIMEOUT_MS = 2_147_483_647`, `MAX_REQUEST_TIMEOUT_MS = 300_000`, `domain/mcp-server-features.ts:57-61`) [VERIFIED: read this session]. Pi: `timeout` in seconds, positive, default 60, reset by progress (`mcp-servers.d.ts`), used as `requestTimeoutMs: (timeout ?? 60) * 1000` (`runtime.js:142-143`). With no declared timeout, Pi uses 60 s while Claude uses `MCP_TOOL_TIMEOUT ?? tc` (value of `tc` not established) — a recorded gap.

**(e) Suppressed duplicates.** 2.1.318 `XYr` suppresses a plugin server whose signature `x0(config,{includeEnv:false})` (command/URL) equals a manually configured server's, or whose full signature equals an earlier plugin server's, and pushes `{type:"mcp-server-suppressed-duplicate",source,plugin,serverName,duplicateOf}`, rendered `MCP server "<s>" skipped — same command/URL as already-configured "<y>"` with the remedy `Remove "<y>" from your MCP config if you want the plugin's version instead`, shown in `/plugin`. [CITED: binary 2.1.318] So it is the analog of the `mcp.json` override in outcome (a user-configured server wins and `/plugin` says so) but **not in trigger**: Claude matches by command/URL; Pi by namespace. Claude's plugin-vs-plugin signature dedupe has no counterpart under either implementation (pre-existing gap, not Phase 2 scope).

### Q5. The adapter translation this phase mirrors

[VERIFIED: read this session]

- `translateMcpServer(server, description)` (`domain/mcp-server-features.ts:214-225`, frozen) returns `{...serverFields(server), description?, directTools: alwaysLoad === true ? true : "search", toolPrefix: "mcp"}`. `serverFields` maps stdio to `command/args/env` + `requestTimeoutMs`, http/streamable-http to `url/headers` + `auth: "oauth"` (D-08-04) + `oauth` + `requestTimeoutMs`, sse adds `httpTransport: "sse"`. `oauthField` (lines 108-137) maps to `{clientId, redirectUri: "http://localhost:<port>/callback", authServerMetadataUrl (https only), scope}`; the timeout helpers (139-166) are module-private.
- `substitute.ts` `substituteAndInject(translated, ctx)` walks `command` (plain), `url` (remote), `args` (plain), `env` (plain, `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` literal), `headers` (remote, secret), `oauth` (literal); every other field is copied (`substitute.ts:116-140`). It calls `serializeSegments(expanded.segments, secret)` (line 81) and `serializeLiteral(raw, true|false)` (lines 104, 135) from `adapter-escape.ts`. `withInjectedEnv` puts `{CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA}` first and spreads the declared `env` over it (MENV-01/02).
- `adapter-entry.ts` calls `substituteAndInject(translateMcpServer(entry, description), substitution)` (line 187) then `withOAuthDecision` (adapter-only).
- **Recommended seam (no frozen change):**
  - `substitute.ts` declares the port and requires it:
    `export interface McpFieldEncoder { readonly expanded: (segments: readonly Segment[], secret: boolean, env: ClaudeEnv) => string; readonly literal: (text: string, secret: boolean) => string; }`
    `export function substituteAndInject(translated: Readonly<Record<string, unknown>>, ctx: McpSubstitutionContext, encoder: McpFieldEncoder): SubstitutedEntry`
    and stops importing `adapter-escape.ts`. `secret` keeps its meaning: "a field Pi and the adapter resolve" (`env` and `headers` values).
  - `adapter-escape.ts` adds `export const ADAPTER_FIELD_ENCODER: McpFieldEncoder = { expanded: (segments, secret) => serializeSegments(segments, secret), literal: serializeLiteral };` and `adapter-entry.ts` passes it. Output stays byte-identical; the existing `substitute.test.ts` cases pass `ADAPTER_FIELD_ENCODER` and keep their expectations, which is the byte-identity proof.
  - `builtin-escape.ts` exports `BUILTIN_FIELD_ENCODER: McpFieldEncoder` (resolve segments from `env`, then escape when `secret`).
  - `domain/mcp-builtin-translation.ts` exports `translateBuiltinMcpServer(server: Readonly<Record<string, unknown>>, description: string | undefined): Record<string, unknown>` derived from `translateMcpServer` (Code Examples).
  - `builtin-entry.ts` exports `builtinServerConfig(server: unknown, ctx: McpSubstitutionContext, description: string | undefined): McpServerConfig | undefined` (translate, walk with `BUILTIN_FIELD_ENCODER`, narrow to Pi's type).
  - A reviewed clone pair between `adapter-escape.ts` and `builtin-escape.ts`, or the two entry modules, gets a `fallow-ignore-next-line code-duplication` marker in both copies (ROADMAP milestone rule).

### Q6. Legacy `mcp.json` entries

[VERIFIED: bridges/mcp/legacy.ts:1-20, orchestrators/reconcile/mcp-migration.ts:1-9, extensions/mcp/config.js:45-94, index.js:971-985]

- Released builds before AMIG-01 wrote each server into the scope's `mcp.json` "under its declared name" with the `_piClaudeMarketplace` marker; AMIG-01 re-stages them under `generatedMcpServerKey(plugin, server)` in `mcp-adapter.json` and removes the marked entries.
- Pi's built-in reads `<agentDir>/mcp.json` and, only when trusted, `<cwd>/.pi/mcp.json` synchronously at its `session_start` (`defaultLoadConfig`, `index.js:1201-1203`). Pi validates each entry and passes unknown keys (`_piClaudeMarketplace`, `directTools`, `toolPrefix`) through, so a legacy stdio entry runs with default `exposure: "codemode"`.
- The AMIG-01 move runs inside `loadReconcile` in `resources_discover`, after every `session_start`. The move is not gated on the active implementation in the current tree (`grep` of `softDeps|piMcpAdapterLoaded|mcpImplementation` in `reconcile/{mcp-migration,load,apply}.ts` found nothing), so it removes the legacy entries in the first built-in session's own load.
- **P2-DC-11 confirmed**, with one addition: in that one session Pi resolves the legacy entry's `env` and `headers` values with **Pi's** rules (`$NAME` expands, a leading `!` runs a shell command, `$env:` reads variable `env`), which the old adapter-format encodings were not written for. The legacy name never equals `plugin_<p>_<s>`, so no override. Record as a one-session gap with a security note (see Security Domain). If Phase 3 gates AMIG-01 on the adapter profile, the gap becomes every built-in session: flag for the Phase 3 merge re-verification.

### Q7. Fallow zones, lint, frozen files

[VERIFIED: .fallowrc.json `boundaries` read this session]

| New/changed file | Zone | Allowed imports (rule) |
|------------------|------|------------------------|
| `domain/mcp-builtin-translation.ts` | domain | shared, platform (and domain) — may import `domain/mcp-server-features.ts` and the type `McpServerConfig` from `platform/pi-api.ts` |
| `bridges/mcp/builtin-escape.ts`, `builtin-entry.ts`, `builtin-registration.ts`, a sync `mcp.json` reader | bridges-mcp | domain, persistence, shared, platform |
| `bridges/mcp/index.ts` (barrel, add exports) | bridges-mcp | -- (orchestrators import `bridges/mcp/index.ts`, as `install-outcome.ts:94` does) |
| `orchestrators/mcp/builtin-registration-step.ts` | orchestrators | bridges-mcp, domain, transaction, persistence, platform, shared |
| `orchestrators/plugin/info-mcp-status.ts` | orchestrators | same |
| `platform/mcp-builtin-status.ts`, `platform/mcp-status.ts` | platform | **shared only** |

- ESLint BLOCK F (network): every new `orchestrators/` and `domain/` module is gated from its first commit; none of the Phase 2 modules needs `platform/git` or a `gitOps` identifier. `recorded-servers.ts` (frozen, outside `NETWORK_SEAMS`) is already the network-free path.
- Rule-pack chokepoints: no `ctx.ui.notify` (use `hookDebugLog(..., "mcp")` — Phase 2 adds no notice), no `console`, no Pi peer import outside `platform/pi-api.ts` (all Pi types come through it: `McpServerConfig`, `RegisteredMcpServer`, `PiMcpRegistry`, `ExtensionContext`, `getAgentDir`), no `write-file-atomic` (Phase 2 writes nothing).
- fallow dead code: the new exports are reachable from `index.ts` through the two step functions and `createBuiltinMcpStatusReader`. Once the step imports `recordedMcpServers` and `createLegacyServersReader`, the `.fallowrc.json` `entry` and `ignoreExports` items for `recorded-servers.ts` become unnecessary; fallow never reports an `ignoreExports` name as stale, so they stay until Phase 6 (record as a parent line for Phase 6, no action now).
- `fallow health` (cognitive 15, cyclomatic 20) and `sonarjs/cognitive-complexity: 15`: split the desired-set computation into small functions (per scope, per record, per server).
- **No frozen-file change is required** by the recommended design. Optional parent lines: (1) a `tool_search` projector in `features/lib/upstream/index.ts` (Phase 6 consolidation; see Pitfall 6); (2) a re-pin of the deny-lists against 2.1.318 (Open Question 3).

### Q8. Containment (UF-1)

[VERIFIED: persistence/locations.ts:40-90,162-175,219-228; shared/path-safety.ts:1-18; shared/path-containment.ts:106-140; orchestrators/marketplace/add.ts:1895-1903; domain/plugin-resolver.ts:468-525; orchestrators/plugin/clone-gc.ts:37-58]

- `ScopedLocations` gives `extensionRoot` (`<scopeRoot>/pi-claude-marketplace`), `pluginClonesDir` (`<extensionRoot>/plugin-clones/`), `sourcesDir` (`<extensionRoot>/sources/`), `mcpJsonPath` (`path.join(scopeRoot, "mcp.json")`), and `pluginDataDir(mp, plugin): Promise<string>` (contained, no mkdir).
- **A local `dir`/`file` marketplace's `marketplaceRoot` is the user's own directory**: `if (probe.isDirectory()) { marketplaceRoot = onDiskPath; ... } else if (probe.isFile()) { ... marketplaceRoot = path.dirname(path.dirname(manifestPath)); }` (`add.ts:1896-1903`). An unpinned path plugin resolves to `path.resolve(ctx.marketplaceRoot, parsedSource.raw)` (`plugin-resolver.ts:519`), so its `resolvedSource` is outside `<scopeRoot>/pi-claude-marketplace/`. Git sources and pinned path sources resolve under `pluginClonesDir`.
- `assertPathInside(parent, child, label): Promise<void>` refuses lexical traversal, a child outside the parent, and any symlink segment below the parent (the parent itself is trusted). Call style elsewhere: `await assertPathInside(marketplaceRoot, pluginRoot, \`plugin source for "${source.raw}"\`)` (`orchestrators/plugin/info.ts:314`).
- **Correction to CONTEXT:** check `record.resolvedSource` inside `mp.marketplaceRoot` (path records, local or cloned marketplaces) **or** inside `locations.pluginClonesDir` (git records and pinned path records). Checking against `<scopeRoot>/pi-claude-marketplace/` would refuse every plugin of every local marketplace, which is every cucumber fixture (`{home}/marketplaces/<name>`). This is still NFR-10's "owning clone root" rule, re-anchored by url-source.

### Q9. Cucumber

[VERIFIED: features files and step modules read this session; timings measured]

- **Owned features today:** all six carry a file-level `@adapter-only` and use adapter-only mechanics: the `mcp` proxy tool, `pi runs with the scripted model and these companions: | pi-mcp-adapter |`, `pi-mcp-adapter has listed the tools...`, adapter `initialize` params (`"clientInfo":{"name":"pi-mcp-plugin_demo_stub_"...}`), `_meta.pi-mcp-adapter/toolCallId`, `pi-mcp-adapter allows project mcp servers for the user`, `pi-mcp-adapter has reported the mcp servers...`, `the user has disabled the mcp server ... in the mcp-adapter.json file`.
- **Frozen shared steps** (01-FROZEN.md §9 and §1): `pi runs with the scripted model and the mcp implementation`; `the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}`; the restart steps; `pi lists these registered mcp servers:` (names only); `the user has run {string}, which did not fail`; and every step of `command`, `session`, `config`, `companion`, `model`, `mcp-configuration`, `mcp-server/listing`, `mcp-server/status`, `plugin/publishing`, `marketplace/publishing`. Useful ones: `the user lists the mcp tools pi offers` + `pi offers these plugin mcp tools:` (rows `tool | active`, every tool starting `mcp__plugin_`, hidden included), `the stub mcp server {string} of the plugin {string} receives these messages:` (the stub's whole log), `no stub mcp server receives a message` (whole log empty), `the model receives these calls:`, `the model calls are offered these marketplace tools:`, `pi runs with the scripted model in an untrusted project`, `the project holds a pi settings file`.
- **What a built-in scenario observes:** the stub's `initialize` params become `{"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}}` (`runtime.js:279-283`, `pi-mcp/dist/client.js:125-130`, `LATEST_PROTOCOL_VERSION = "2025-11-25"`, `VERSION = pkg.version`); Pi connects eagerly at session start (one `initialize`/`tools/list`, no lazy restart before a call as with the adapter); a `tools/call` carries `_meta: { progressToken: <id> }` (`tools.js:257-260`, `client.js:249-252`); tool names `mcp__plugin_<p>_<s>__<tool>` with `-` folded; the script calls `tool_search` with `{"query": "echo"}` (`toolSearchSchema`) then the tool by name, or the tool directly for `alwaysLoad: true`.
- **Shared `@mcp` candidates** (same expectation under both): tool registration names and `active` state before a search (`pi offers these plugin mcp tools:` gives `mcp__plugin_demo_stub__echo | no` under both; the frozen stand-in seeds prove the builtin side), per-server tool naming for names without `-`, MREC-02 (legacy record reaches the server with no reinstall), lifecycle outcomes stated as tool lists, and plugins without MCP servers (registered tool list empty). **Pairs** (`@adapter-only` + `@builtin-only`, ID in the title): everything that states the model's tool calls (`mcp` vs `tool_search`), the stub's `initialize`/`tools/call` params, project trust (adapter approvals vs Pi trust only, D-CF6-03 vs BLT-03), header/env values where Claude parity differs under the adapter (the "unset header reaches it empty, a documented Pi gap" scenario becomes a builtin twin that receives Claude's literal), `info` statuses, and user-disabled choices in `mcp-adapter.json` (adapter-only by nature).
- **New built-in-only features** (no adapter twin): `builtin-trust.feature` (BLT-03), `builtin-status.feature` (BLT-05), `builtin-oauth.feature` (BLT-02 OAuth values), `builtin-direct.feature` (D-MB-02 `alwaysLoad`). OAuth values are not observable through the frozen registry probe (it records names only: `mcpServers: pi.getMcpServers().map((server) => ({ name: server.name }))`, `features/lib/pi-registry-probe/extension.ts:32`); options in Open Question 2.
- **Running one profile:** `npm run test:cucumber:profile -- --profile builtin <paths>` (also installs peers). Measured: builtin profile on `implementation-profiles.feature` + `agent-grants.feature` ran 1 scenario in 17.7 s wall (cold shared Pi, 8 workers). CI (01-FROZEN.md): builtin all 39 scenarios 55 s; adapter components 390 scenarios 3 min 47 s; the brief says about 7 min locally for the adapter profile.
- **Restart steps for the switch:** each restart waits for the adapter's onboarding write when the old Pi had the adapter, stops the Pi, keeps sandbox, trust, script, and installed plugins, starts a new profile Pi, and records its first session as the last session results. In `@own-implementation`, the harness removes the onboarding seed, so the adapter really writes `-builtin:mcp`; "restart without pi-mcp-adapter" then gives `none`, and "restart with pi's built-in mcp turned on" removes that entry (P1-DC-08). The script file persists across restarts, so one `the scripted model plays these steps:` covers all legs; every turn must be compared before the next (`recordTurn` asserts `lastTurnCompared`).
- **"No extension error" in the `none` leg:** Pi's RPC mode prints startup extension errors as `{"type":"extension_error",...}` lines (`modes/rpc/rpc-mode.js:259-261`), and `PiProcess.recordsSince(index)` is public (`features/lib/pi-process.ts:173-175`), so a Phase 2 step can assert none since the restarted Pi started. The frozen `no stub mcp server receives a message` reads the whole scenario log, so the "not reached" assertion after a restart needs a Phase 2 step scoped to the restart (or state it through `pi offers these plugin mcp tools:` with no rows plus `pi lists these registered mcp servers:` with no rows, which frozen precedent allows).
- **MREC-02 record rewrite:** `features/lib/earlier-version-state.ts` writes marketplace records only and is a shared lib; Phase 2 adds `features/lib/mcp-builtin-earlier-record.ts` (name is the planner's) that removes `mcpServerConfigs` (and `mcpBundle`) from one plugin record in `{scopeRoot}/pi-claude-marketplace/state.json`, following that file's read-modify-write pattern, behind a `Given` in a Phase 2 step module.
- **Project trust:** `pi runs with the scripted model in an untrusted project` (model.steps.ts) starts a profile Pi with no trust entry and no companion, which is built-in under either profile; pair it with `the project holds a pi settings file` (Pi trusts a project with no trust-requiring resource otherwise). Do not put `-builtin:mcp` in the project settings of an untrusted scenario (01-REVIEW IN-04: the harness would expect `none`).
- **IN-02:** `configuration.feature:20,97,171` use `which did not fail` in an adapter-only setup; the fix is a precise setup or a `Then` on the notice, in the adapter twin.

### Q10. Unit and integration tests

[VERIFIED: test tree listed; skills read; timings measured]

- Pairing: every source has exactly one `test/<mirrored path>.test.ts`; 100% line/function/branch direct coverage per pair run alone (`npm run test:coverage:direct -- <source>`). Existing pairs to extend: `test/orchestrators/mcp/builtin-registration-step.test.ts`, `test/platform/mcp-builtin-status.test.ts`, `test/orchestrators/plugin/info-mcp-status.test.ts`, `test/bridges/mcp/substitute.test.ts`, `test/bridges/mcp/adapter-escape.test.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `test/bridges/mcp/index.test.ts`. New pairs: `test/domain/mcp-builtin-translation.test.ts`, `test/bridges/mcp/builtin-{escape,entry,registration}.test.ts` (plus one for any new sync reader module).
- Measured: `node --test test/bridges/mcp/substitute.test.ts` 0.18 s; `info-mcp-status.test.ts` 0.32 s; direct coverage of `substitute.ts` 0.5 s; `recorded-servers.test.ts` 1.1 s; `test/integration/adapter-expansion-conformance.test.ts` 6.1 s.
- Existing `test/integration/mcp-*` tests run **in-process**, not a real Pi: they import the extension's orchestrators and the adapter's `dist/` functions from the optional peer cache (`pi-mcp-adapter-peer.ts`), and Pi's `createEventBus` from the package root. A `test/integration/mcp-builtin-*` test can import Pi's real `dist/core/resolve-config-value.js` and `dist/core/mcp-servers.js` by absolute file URL and reuse `test/bridges/mcp/expansion-cases.ts` (`EXPANSION_CASES`, `EXPANSION_BUILTINS`) to prove that the built-in encoder's output resolves to Claude's value through Pi's own resolver. Driving the whole built-in extension in process is possible (`createMcpExtension` is exported from the package root) but needs a fake `ExtensionAPI`; the builtin cucumber profile covers that end to end.
- `@earendil-works/pi-mcp` is a transitive dependency, not a declared one (`package.json` frozen); do not import it from tests.

### Q11. `docs/mcp-compatibility.md`

[VERIFIED: read this session, 516 lines]

Sections: intro + legend; Server and tool names; Server sources; Tool search (table `Feature | Claude Code | Pi | Notes`); Name length; Connection lifecycle; Project-scope servers; pi-mcp-adapter settings; Translated fields (table `Claude Code field | Server types | pi-mcp-adapter field | Rule`); OAuth beside headers; Dropped fields; Partially available plugins (table `Feature | Claude Code | Pi | Notes`); Tool permission rules; Invalid server configs; User overrides; Hooks and agents; Variables; Upgrading; Server status in info; Divergences and documented absences; Further reading. No test pins the file. Fit for MDOC-01:
- Rename the `Pi` column to `pi-mcp-adapter` and add `Pi built-in` in the two feature tables; add a `Pi built-in field` column to "Translated fields"; add a built-in column to the name table (`plugin_foo_api` registered, `mcp__plugin_foo_my_db__<tool>`).
- Add sections or subsections for: how the extension registers (session start + after the load reconcile, trust gate, no settings edits), variables under built-in (resolved at registration; `$$`/`$!` escaping; unset keeps literal), project trust under built-in (Pi trust only, no approval, closer to Claude), status tokens under built-in, the `-`→`_` fold and 64-character cut as Pi gaps, `tool_search` replaces the `mcp` proxy, eager connection (ANAME-05 divergence disappears), `/mcp` choices are session-only, the one-session legacy entry gap, the Claude `cwd` residual gap, the timeout default (60 s) and progress reset.
- Every built-in statement ends with a citation: a `features/mcp-server/*.feature` file, or a Pi 1.5.0 path such as `dist/extensions/mcp/index.js` or `dist/core/mcp-servers.js`. Update the intro ("This extension does not run MCP servers itself...") and the "Name length" paragraph that says pi-mcp-adapter turns built-in support off. `mdformat` and `markdownlint-cli2` run on it in pre-commit.

### Q12. Validation Architecture

See `## Validation Architecture` below.

## Architecture Patterns

### System Architecture Diagram

```text
 Pi runtime (per load; registry starts empty)
   │
   ├─ session_start ──► our handler (runs before builtin:mcp's)
   │                      applyMcpAdapterEnv / applySessionEnv (process.env)
   │                      createMcpSessionMaterializer → builtinRegistrationStep({pi, ctx, snapshot})
   │                                                        │
   │   resources_discover ──► loadReconcile (may change records; AMIG-01 move)
   │                          → resyncBuiltinRegistrations({pi, ctx, snapshot: run})
   │                                                        │
   │                     ┌──────────────────────────────────┘
   │                     ▼
   │        gate: snapshot.softDeps.mcpImplementation === "builtin" ? ── no ──► return (MSEL-03)
   │                     │ yes
   │                     ▼
   │        desired set (orchestrators/mcp/builtin-registration-step.ts)
   │          scopes: user; project only if ctx.isProjectTrusted()
   │          loadState(persistMigration:false) per scope
   │          each enabled record:
   │            containment(resolvedSource ⊂ marketplaceRoot | pluginClonesDir) ── fail ──► debug log, skip
   │            recordedMcpServers(record, createLegacyServersReader(mp)) ── unreadable ──► debug log, skip
   │            description (plugin.json → marketplace entry)
   │            each server: profileFor("builtin").classify ── blocked/malformed ──► skip
   │              name = profile.serverName(plugin, server)
   │              config = builtinServerConfig(server, {pluginRoot, pluginData, projectDir: ctx.cwd, env}, description)
   │          Map<name, McpServerConfig>, project overwrites user per name
   │                     │
   │                     ▼
   │        syncBuiltinRegistrations(pi, desired, log)  (bridges/mcp/builtin-registration.ts)
   │          unregister plugin_* not desired (no-op for other owners)
   │          register desired whose JSON differs (each in try/catch)
   │                     │
   │                     ▼
   │        Pi registry ──► builtin:mcp (session_start read / mcp_servers_change)
   │                          mcp.json same namespace? ── yes ──► overridden (listed in /mcp)
   │                          connect stdio (cwd = session cwd) / streamable HTTP
   │                          registerTools(exposure deferred|direct, namespace)
   │
   └─ /claude:plugin info ──► withMcpServerStatus(block, record, lookup, projectRecord)
                               builtin: project not trusted → overridden by mcp.json (sync read)
                                        → overridden by project scope → reader.lookup(name)
                               reader: getMcpServers + getAllTools (namespace, exposure)
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/mcp-builtin-translation.ts        # NEW: Claude server → Pi built-in fields (pure)
├── bridges/mcp/
│   ├── substitute.ts                        # McpFieldEncoder port, required parameter
│   ├── adapter-escape.ts                    # + ADAPTER_FIELD_ENCODER
│   ├── adapter-entry.ts                     # passes ADAPTER_FIELD_ENCODER (bytes unchanged)
│   ├── builtin-escape.ts                    # NEW: BUILTIN_FIELD_ENCODER (resolve + Pi escape)
│   ├── builtin-entry.ts                     # NEW: builtinServerConfig (translate + walk + type narrow)
│   ├── builtin-registration.ts              # NEW: syncBuiltinRegistrations over PiMcpRegistry
│   ├── (sync mcp.json name reader)          # NEW or inside builtin-registration.ts: for info overrides
│   └── index.ts                             # barrel exports the new public API
├── orchestrators/mcp/builtin-registration-step.ts   # fill both bodies (composition)
├── orchestrators/plugin/info-mcp-status.ts          # builtin arm
├── platform/mcp-builtin-status.ts                   # fill the reader
└── platform/mcp-status.ts                           # unchanged unless needed (interface frozen)
features/
├── mcp-server/{listing,configuration,sources,project-scope,lifecycle,invocation}.feature  # lift @adapter-only
├── mcp-server/implementation-switch.feature          # NEW @own-implementation
├── mcp-server/builtin-{trust,status,oauth,direct}.feature   # NEW @builtin-only
├── step_definitions/mcp-server/{invocation,implementation-switch,builtin-*}.steps.ts
└── lib/mcp-builtin-*.ts                              # tool_search projection, earlier-record rewrite, optional config probe
test/
├── domain/mcp-builtin-translation.test.ts
├── bridges/mcp/builtin-{escape,entry,registration}.test.ts
└── integration/mcp-builtin-*.test.ts                 # Pi resolver/validator conformance
```

### Pattern 1: Derive the built-in table from the frozen adapter table
**What:** call `translateMcpServer(server, description)` and rename/drop its owned fields, so the timeout floor/cap and the OAuth mapping can never drift between implementations.
**When to use:** always; the alternative copies module-private logic from a frozen file.

### Pattern 2: Consumer-declared encoder port
**What:** `substitute.ts` declares `McpFieldEncoder`; each escape module supplies one; the walk stays implementation-neutral and stops importing `adapter-escape.ts`.

### Pattern 3: Composition step + pure sync
**What:** the frozen step functions read `process.env`, `ctx`, and state (composition); `syncBuiltinRegistrations(registry, desired, log)` is a pure function of its port, unit-tested with a `strong-mock` `PiMcpRegistry`.

### Anti-Patterns to Avoid
- **Handling `mcp_servers_change`:** marks our extension as the connector (PI-11), so Pi stops reporting and the built-in no longer owns connections.
- **Registering under `adapter` or `none`:** extension errors (none) or adapter proxy duplicates (adapter).
- **Reading `resolvedSource` before containment:** UF-1.
- **Using `extensionPath` to find our registrations:** it is the path as given to the loader, possibly relative.
- **Using `generatedMcpServerKey` in built-in code:** trailing `_` gives `mcp__plugin_p_s___tool` (Pitfall 7 of PITFALLS.md).
- **`String.replaceAll("$", "$$")`:** in a replacement *string* `$$` means one `$`; use a function replacer.
- **Persisting resolved values:** D-MB-04, T-01-17.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude's `${…}` rule and deny-lists | A new expansion scanner | `expandClaudeValue` (`domain/claude-mcp-variables.ts`) | AVAR-01..05 decided there; a second copy drifts |
| Timeout floor/cap, OAuth mapping | A second table | `translateMcpServer` output, renamed | Frozen, module-private helpers |
| Server/tool names, classification | String building | `profileFor("builtin")` (`serverName`, `toolName`, `toolNamePrefix`, `classify`) | Frozen interface 1/8; Pi's hash rule already reproduced |
| Recorded or legacy servers | Reading `mcpServerConfigs` directly / re-resolving | `recordedMcpServers` + `createLegacyServersReader` | Frozen interface 3, the only reader |
| Path containment | `startsWith` checks | `assertPathInside` | Lexical traversal + symlink walk |
| Scope paths | String joins | `locationsFor(scope, cwd)` (`mcpJsonPath`, `pluginClonesDir`, `pluginDataDir`) | Branded, contained |
| Pi config validation in tests | A mirror of Pi's validator | Pi's own `dist/core/mcp-servers.js` by file URL | Conformance against the real code |

## Common Pitfalls

### Pitfall 1: Containment against the wrong root
**What goes wrong:** checking `resolvedSource` against `<scopeRoot>/pi-claude-marketplace/` refuses every local-marketplace plugin.
**How to avoid:** inside `mp.marketplaceRoot` or inside `locations.pluginClonesDir`; unit-test both arms plus a `../` escape and a symlinked segment.
**Warning signs:** builtin scenarios with `dir`/`file` marketplaces register nothing.

### Pitfall 2: Escaping `$` with a replacement string
**What goes wrong:** `value.replaceAll("$", "$$")` returns the value unchanged (the replacement pattern `$$` inserts one `$`).
**How to avoid:** `value.replaceAll("$", () => "$$")`; conformance test through Pi's `resolveConfigValueOrThrow`.

### Pitfall 3: Comparing configs with different key order
**What goes wrong:** Pi's built-in compares `JSON.stringify(config)`; a builder that emits keys in a varying order reconnects a server on every resync.
**How to avoid:** build the config in one fixed order; compare `JSON.stringify(desired)` with `JSON.stringify(listed.config)` (Pi's copy preserves key order: `{...value}` then an in-place alias rewrite, then `structuredClone`).

### Pitfall 4: `info` stamps the wrong server set under built-in
**What goes wrong:** `stampEntries` keys on `record.resources.mcpServers` (the adapter-supported subset), so a `bareElicitationCapability` server registered under built-in gets no status.
**How to avoid:** under `builtin`, stamp the names in `record.mcpServerConfigs` (fall back to `resources.mcpServers` for a legacy record, since `withMcpServerStatus` is synchronous and cannot call the async legacy reader).

### Pitfall 5: Async work in a synchronous frozen call
**What goes wrong:** `withServerStatus` in `info.ts` (frozen) calls `withMcpServerStatus` synchronously; an `await readMcpConfigDoc(...)` cannot be used.
**How to avoid:** a synchronous reader (`readFileSync` + `JSON.parse`, BOM stripped, any error → no override) of `locationsFor("user", cwd).mcpJsonPath` and, only while `lookup.projectTrusted`, `locationsFor("project", lookup.cwd).mcpJsonPath`, `mcpServers` key only (`PI_MCP_SERVER_KEYS`). Count an entry as configured when it is an object (Pi also drops invalid entries; recorded approximation).

### Pitfall 6: `tool_search` output is Pi's wording
**What goes wrong:** the frozen `the model receives these calls:` projects tool results through `features/lib/upstream/index.ts`, which has projectors for `mcp`, `read`, and `subagent` only. A built-in turn would state `tool_search returned: Loaded 1 tool. They are available from your next call:\n- mcp__plugin_demo_stub__echo: ...`, which is Pi's text and spans lines.
**How to avoid:** a Phase 2 step (for example `the model receives these calls through pi's tool search:`) that builds rows with the exported `callMessageRows` (`features/lib/scripted-model/script.ts:278`) and then reduces each `tool_search returned:` text through a Phase 2 lib (`features/lib/mcp-builtin-tool-search.ts`) to a fixed form such as `loaded mcp__plugin_demo_stub__echo` / `loaded no tools`, throwing on unparsable text, and calls `markTurnCompared()`. Parent line: move the projector into `features/lib/upstream/` in Phase 6 so Phases 4 and 5 can share it.

### Pitfall 7: `no-await-in-loop` and complexity gates
**What goes wrong:** a natural per-scope/per-record loop with `await` fails ESLint, and one big function fails fallow's cognitive limit.
**How to avoid:** `Promise.all` over records (reads are independent), or a disabled line with a reason; one function per level.

### Pitfall 8: The `info` scenario pins Phase 3's rows
**What goes wrong:** `the result has these fields:` states every field, including `plugin requires` (today `[{"companion":"pi-mcp-adapter","missing":true}]` under built-in, from `companionRequirements`) and `plugin status`, which Phase 3 changes.
**How to avoid:** accept it and list the rows for the Phase 3 merge re-verification (ROADMAP "After the last merge (Phase 3): re-verify ... Phase 2's `info` status scenarios"), or add a Phase 2 step that compares only the `mcp` component list. Recommended: the full-field step plus a SUMMARY note, since the ROADMAP already schedules the re-verification.

### Pitfall 9: Install output differs by profile
**What goes wrong:** under the builtin profile, today's install of an MCP plugin warns `requires pi-mcp-adapter` (`companionRequirements` reads `piMcpAdapterLoaded`), so `the user has run ...` (info only) fails in `@mcp` scenarios.
**How to avoid:** `the user has run {string}, which did not fail` in `@mcp` setups (frozen step, P1-DC-33); keep the strict form in adapter-only setups (IN-02).

### Pitfall 10: Hidden tools of an earlier connection
**What goes wrong:** after an unregister in the same session, the namespace's tools stay registered as `hidden`; the status reader then says `disabled` for a server Pi no longer lists.
**How to avoid:** the reader checks `getMcpServers()` first (`unlisted` wins).

## Code Examples

Shapes the planner can hand to executors. Values quoted from Pi and the repo are the verified ones above; everything else is a recommendation.

### Built-in field encoder (`bridges/mcp/builtin-escape.ts`)
```ts
// Pi 1.5.0 dist/core/resolve-config-value.js: in an env or headers value,
// `$$` -> `$` and `$!` -> `!` anywhere, a leading `!` runs a shell command,
// `$NAME` and `${NAME}` expand. command, args and url are never resolved.
import type { ClaudeEnv, Segment } from "../../domain/claude-mcp-variables.ts";
import type { McpFieldEncoder } from "./substitute.ts";

// Claude Code 2.1.318 `n8`: a set value wins, the empty string included; an
// unset variable takes its `:-` default, else keeps its literal text (AVAR-02).
function segmentValue(segment: Segment, env: ClaudeEnv): string {
  if (segment.kind === "text") {
    return segment.text;
  }

  const value = Object.hasOwn(env, segment.name) ? env[segment.name] : undefined;
  if (typeof value === "string") {
    return value;
  }

  return segment.fallback ?? `\${${segment.name}}`;
}

function escapedForPi(value: string): string {
  const escaped = value.replaceAll("$", () => "$$"); // function replacer: see Pitfall 2
  return escaped.startsWith("!") ? `$${escaped}` : escaped;
}

export const BUILTIN_FIELD_ENCODER: McpFieldEncoder = {
  expanded: (segments, secret, env) => {
    const value = segments.map((segment) => segmentValue(segment, env)).join("");
    return secret ? escapedForPi(value) : value;
  },
  literal: (text, secret) => (secret ? escapedForPi(text) : text),
};
```

### Built-in translation (`domain/mcp-builtin-translation.ts`)
```ts
import { translateMcpServer } from "./mcp-server-features.ts";

// D-MB-02: deferred behind tool_search, direct for alwaysLoad: true.
// The adapter table already applies Claude's timeout floor and caps and maps
// callbackPort to Claude's redirect URI, so the built-in table renames.
export function translateBuiltinMcpServer(
  server: Readonly<Record<string, unknown>>,
  description: string | undefined,
): Record<string, unknown> {
  const adapter = translateMcpServer(server, description);
  const remote = typeof adapter.url === "string";
  const fields: Record<string, unknown> = remote ? { type: "http" } : {};
  for (const key of ["command", "args", "env", "url", "headers"] as const) {
    if (Object.hasOwn(adapter, key)) {
      fields[key] = adapter[key];
    }
  }
  // oauth: clientId, redirectUri -> callbackUrl, authServerMetadataUrl, scope (planner: fixed order)
  // requestTimeoutMs -> timeout: ms / 1000 (no rounding, P2-DC-05)
  // exposure: server.alwaysLoad === true ? "direct" : "deferred"
  // description last, when given
  return fields;
}
```
(`auth`, `directTools`, `toolPrefix`, `httpTransport` are never copied; `sse`/`ws` never reach it because the built-in profile blocks them.)

### Idempotent sync (`bridges/mcp/builtin-registration.ts`)
```ts
import type { McpServerConfig, PiMcpRegistry } from "../../platform/pi-api.ts";

const PLUGIN_SERVER_PREFIX = "plugin_";

export function syncBuiltinRegistrations(
  registry: PiMcpRegistry,
  desired: ReadonlyMap<string, McpServerConfig>,
  log: (detail: string) => void,
): void {
  for (const { name } of registry.getMcpServers()) {
    if (name.startsWith(PLUGIN_SERVER_PREFIX) && !desired.has(name)) {
      registry.unregisterMcpServer(name); // a no-op for another extension's server
    }
  }

  const listed = new Map(registry.getMcpServers().map((s) => [s.name, JSON.stringify(s.config)]));
  for (const [name, config] of desired) {
    if (listed.get(name) === JSON.stringify(config)) {
      continue; // Pi's built-in compares the same JSON and would not reconnect
    }
    try {
      registry.registerMcpServer(name, config);
    } catch (err) {
      log(`MCP server ${name} not registered: ${errorMessage(err)}`);
    }
  }
}
```

### Status reader (`platform/mcp-builtin-status.ts`)
```ts
// Pi 1.5.0 core/mcp-servers.js mcpNamespace: `mcp__<server>` with `-` -> `_`.
function namespaceOf(server: string): string {
  return `mcp__${server.replaceAll("-", "_")}`;
}

export function createBuiltinMcpStatusReader(
  pi: Pick<PiMcpRegistry, "getMcpServers"> & Pick<PiInventory, "getAllTools">,
): McpStatusReader {
  return {
    lookup(serverName) {
      if (!pi.getMcpServers().some((server) => server.name === serverName)) {
        return "unlisted";
      }
      const namespace = namespaceOf(serverName);
      const exposures = pi
        .getAllTools()
        .filter((tool) => "namespace" in tool && namespaceName(tool.namespace) === namespace)
        .map((tool) => ("exposure" in tool ? tool.exposure : undefined));
      if (exposures.length === 0) {
        return "not-connected";
      }
      return exposures.every((exposure) => exposure === "hidden") ? "disabled" : "connected";
    },
  };
}
```
(`namespaceName` is a small `unknown` guard; building the reader still reads nothing, which `no-factory-time-probe.test.ts` enforces.)

### Step composition (`orchestrators/mcp/builtin-registration-step.ts`)
```ts
async function syncSession({ pi, ctx, snapshot }: BuiltinRegistrationStepInput): Promise<void> {
  if (snapshot.softDeps.mcpImplementation !== "builtin") {
    return; // MSEL-03
  }
  try {
    const desired = await desiredRegistrations({
      cwd: ctx.cwd,
      projectTrusted: ctx.isProjectTrusted(), // D-MB-09, read on every call
      env: process.env, // composition root: the only env read
    });
    syncBuiltinRegistrations(pi, desired, (detail) => hookDebugLog(detail, "mcp"));
  } catch (err) {
    hookDebugLog(`MCP built-in registration skipped: ${errorMessage(err)}`, "mcp"); // NFR-2
  }
}

export function builtinRegistrationStep(input: BuiltinRegistrationStepInput): Promise<void> {
  return syncSession(input);
}

export function resyncBuiltinRegistrations(input: BuiltinRegistrationStepInput): Promise<void> {
  return syncSession(input);
}
```

## Corrections to 02-CONTEXT.md (evidence contradicts or refines)

1. **Containment root** (Registration, UF-1): use `mp.marketplaceRoot` or `locations.pluginClonesDir`, not `<scopeRoot>/pi-claude-marketplace/`. Evidence: `orchestrators/marketplace/add.ts:1896-1903`; `domain/plugin-resolver.ts:519`. Severity High (as written, every local-marketplace plugin would register nothing).
2. **`info` override read must be synchronous** and **under built-in must stamp `mcpServerConfigs` names**: the frozen call `withMcpServerStatus(built.block, record, lookup, projectRecord)` is synchronous (`orchestrators/plugin/info.ts:3146-3160`), and `stampEntries` keys on `record.resources.mcpServers` (`info-mcp-status.ts:79-102`). Medium.
3. **"The same plugin in both scopes"**: recommend per registered server name (project overwrites user per name), which is what the adapter's file merge and `projectOverrides` (`info-mcp-status.ts:64-77`, per server) do. CONTEXT says the whole user record is skipped. Low; the results differ only when the two scopes' records declare different server sets.
4. **`description`** is not stored in the record; "as the adapter entry writes it" needs a manifest read at registration (plugin's `plugin.json` description, else the marketplace entry's, empty counts as absent: `resolveDescription`, `domain/plugin-resolver.ts:449-459`). The resolver's reader is private to a Phase 3 file; follow the existing third-reader precedent with `MANIFEST_CANDIDATES` (`domain/manifest-path.ts`) and `locateManifestCandidate`/`sourceManifestBoundary` (`domain/manifest-containment.ts`), plus `loadMarketplaceManifest` + `lookupDeclaredPlugin`. Medium (watch `fallow dupes`).
5. **Claude's duplicate report is signature-based**, not name-based (Q4e). The CONTEXT analogy holds in outcome only; keep P2-DC-08 and note the difference.
6. **`${VAR:-default}` with `VAR=""`** resolves to `""` in Claude 2.1.318 (Q4b); the encoder must use "set → value" before the default.
7. Confirmed as written: the status mapping (Q3), no-reconnect on the same config JSON (Q1), event order (Q2), P2-DC-04 no `cwd` (Q4a), P2-DC-11 one session (Q6, given today's ungated AMIG-01).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Plugin servers written to `mcp.json` | `mcp-adapter.json` (AMIG-01); built-in via `registerMcpServer` (this phase) | AMIG-01 (mcp-4), Pi 1.5.0 | Legacy entries can run once more under built-in |
| pi-mcp-adapter turns built-in off (`-builtin:mcp`) | Built-in is an equal implementation; the user turns it back on (D-MB-01) | this milestone | Switch scenario passes through `none` |
| Claude 2.1.291 variable rule | 2.1.318 adds `${user_config.*}` and scrub-mode arms | between 2.1.291 and 2.1.318 | No change for default CLI sessions; deny-list re-pin is a follow-up |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `po()`/`Mo()` in the stdio spawn chunk are the project config root / project root helpers grepped by the same names | Q4a | If they are other functions, Claude's stdio `cwd` is unknown; P2-DC-04 then rests on CC-1 (no `cwd` field) only |
| A2 | Claude's default tool timeout `tc` is not 60 s | Q4d | The "60 s default" gap note would be wrong; doc wording only |
| A3 | Counting any object entry in `mcp.json` as an override approximates Pi's validated set well enough | Pitfall 5 | An invalid `mcp.json` entry with our namespace would show `overridden by mcp.json` while Pi actually connects ours |
| A4 | The 2.1.318 deny-list contents equal the 2.1.291 snapshot for default CLI sessions | Q4b | A credential could reach a built-in server's env/url/headers that 2.1.318 would blank (same exposure exists under the adapter today) |
| A5 | Phase 4/5 builtin scenarios will also need a `tool_search` projection | Pitfall 6 | Only affects whether the projector should move to `upstream/` in Phase 6 |
| A6 | `enabled === false` covers dependency-disabled records (`isRecordedButDisabled` reads only `enabled`) | Desired set | A dependency-disabled record with `enabled: true` would register; check LOAD-02 writes when planning |

## Open Questions

1. **Where the description is read.**
   - What we know: no record field; Claude's order is `plugin.json` then entry.
   - What's unclear: whether a fourth `MANIFEST_CANDIDATES` reader trips `fallow dupes`.
   - Recommendation: a small reader in `bridges/mcp/builtin-entry.ts` or the step; if it clones, mark the reviewed pair, or drop `description` under built-in and record the gap (Pi uses it only for the `mcp_servers` prompt section and `tool_search` ranking).
2. **How to observe OAuth and timeout values** (BLT-02 under built-in).
   - Options: (a) a Phase 2 probe extension `features/lib/mcp-builtin-registry-probe/` loaded through `extraExtensions` that reports `getMcpServers()` configs (Pi's registry is what Pi reports); (b) a loopback HTTP stand-in that answers 401 and logs Pi's metadata/registration requests (observes `authServerMetadataUrl` and `clientId` use but not `callbackUrl`/`scope` without an interactive `/mcp login`, which also calls `openBrowser`); (c) unit/integration proof only (translation + Pi validator) with a cucumber scenario that the HTTP server connects.
   - Recommendation: (a) for values, plus (c) for Pi acceptance. Record as a dubious choice.
3. **Deny-list re-pin to 2.1.318.** Not Phase 2's file (`domain/claude-credential-denylist.ts` and `claude-mcp-variables.ts` are unowned). Recommend a Phase 6 parent line or backlog entry.
4. **AMIG-01 gating by Phase 3.** If Phase 3 gates the move on the adapter profile, legacy entries run under built-in every session. Re-verify after the Phase 3 merge.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v24.22.1 | -- |
| npm | scripts | ✓ | 10.9.9 | -- |
| Pi 1.5.0 (devDependency) | runtime, cucumber, conformance | ✓ | 1.5.0 | -- |
| Optional peers (pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, pi-dynamic-workflows 3.15.0) | adapter profile, integration | ✓ (installed this session in 7.3 s) | as listed | `node scripts/install-test-peers.mjs` |
| `setpriv` + `nondac-sh` wrapper | running npm scripts as root | ✓ | `/usr/bin/setpriv`; wrapper present in the session scratchpad | -- |
| Claude Code binary | compat research | ✓ | 2.1.318 | -- |
| CodeGraph CLI | code exploration | ✓ | 1.6.2 (`.codegraph/` present) | grep |
| `/usr/bin/time` | timing | ✗ | -- | `date` arithmetic |

**Missing dependencies with no fallback:** none.

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (unit, integration), `@cucumber/cucumber` (behavioral, profiles `adapter` and `builtin`), `strong-mock` |
| Config file | `cucumber.json` (frozen), `package.json` scripts (frozen) |
| Prefix for every npm script | `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/c8fa846b-6efd-592e-ae3c-12be087a8d83/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` |
| Quick run command | `node --test <test file>` (0.2-1.2 s measured) and `npm run test:coverage:direct -- <source>` (about 0.5 s measured) |
| Full suite command | `npm run check` in parts: `check:static`, `test:unpaired`, `test:integration`, `test:cucumber:profile -- --profile adapter <paths>` and `-- --profile builtin features`, `test:coverage:direct:all`; phase gate adds `npm run test:modules` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MSEL-03 | No registration under adapter/none | unit | `node --test test/orchestrators/mcp/builtin-registration-step.test.ts` | ✅ (seed; extend) |
| MSEL-03 | Adapter profile Pi lists no registered servers; `none` leg shows no extension error | cucumber adapter | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/implementation-switch.feature features/mcp-server/listing.feature` | ❌ Wave 2 |
| MSEL-02 | Switch adapter → none → built-in → adapter with no plugin command | cucumber (`@own-implementation`, adapter run only) | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/implementation-switch.feature` | ❌ Wave 2 |
| MSEL-04 | Installed under built-in, reached under adapter after restart | cucumber adapter (`@own-implementation`) | same file | ❌ Wave 2 |
| MREC-02 | Legacy record (no `mcpServerConfigs`) reaches its server | unit (legacy reader wiring) + cucumber `@mcp` | `node --test test/orchestrators/mcp/builtin-registration-step.test.ts`; both profiles on the owning feature | ❌ |
| BLT-01 | Registered at startup and `/reload`; deferred via `tool_search`, `alwaysLoad` direct | unit (sync, step) + cucumber builtin | `node --test test/bridges/mcp/builtin-registration.test.ts`; `npm run test:cucumber:profile -- --profile builtin features/mcp-server/listing.feature features/mcp-server/invocation.feature features/mcp-server/builtin-direct.feature` | ❌ |
| BLT-02 | Values: transports, fields, expansion, `$`/`!`, timeout seconds, OAuth | unit (translation, escape, entry) + integration conformance + cucumber builtin | `node --test test/domain/mcp-builtin-translation.test.ts test/bridges/mcp/builtin-escape.test.ts test/bridges/mcp/builtin-entry.test.ts`; `node --test test/integration/mcp-builtin-*.test.ts`; builtin profile on `configuration.feature`, `sources.feature`, `builtin-oauth.feature` | ❌ |
| BLT-02 | Adapter output byte-identical | unit (existing expectations, encoder passed) | `node --test test/bridges/mcp/substitute.test.ts test/bridges/mcp/adapter-entry.test.ts`; `node --test test/integration/adapter-expansion-conformance.test.ts` (6 s) | ✅ |
| BLT-03 | Project servers only while trusted | unit (step) + cucumber builtin | builtin profile on `features/mcp-server/builtin-trust.feature features/mcp-server/project-scope.feature` | ❌ |
| BLT-04 | Names, fold, collisions/overrides reported | unit (profile already frozen-tested; sync clash path) + cucumber | builtin profile on `listing.feature`, `builtin-status.feature` | ❌ |
| BLT-05 | `info` statuses | unit (`info-mcp-status`, `mcp-builtin-status`) + cucumber builtin | `node --test test/orchestrators/plugin/info-mcp-status.test.ts test/platform/mcp-builtin-status.test.ts`; builtin profile on `builtin-status.feature` | ✅ pairs exist; ❌ feature |
| BLT-06 | Disable/uninstall/enable/update in the next session | cucumber both profiles | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/lifecycle.feature` (and adapter) | ❌ (lift tags) |
| MDOC-01 | Built-in column with citations | manual review + pre-commit `mdformat`/`markdownlint-cli2` | `pre-commit run --files docs/mcp-compatibility.md` | ✅ file |

Estimated runtimes in this container: one unit test file 0.2-1.2 s; one pair's direct coverage about 0.5 s; one integration conformance file about 6 s; one builtin feature file 20-60 s (17.7 s measured for one scenario with a cold shared Pi); the adapter profile on `listing.feature` + `invocation.feature` (10 scenarios) measured 36 s wall; the full builtin profile about 1-3 min once Phase 2 adds its scenarios (55 s for 39 scenarios in CI before); the full adapter profile about 7 min (brief), so run it as a background call or split by directories to stay under the 10-minute Bash cap.

### Sampling Rate
- **Per task commit:** the touched pairs' `node --test` + `npm run test:coverage:direct -- <source>`, `npm run check:static` (executors in `.claude/worktrees` must run it by hand), and the owned feature file under each profile it applies to.
- **Per wave merge:** `npm run check` in parts plus both cucumber profiles on the whole tree.
- **Phase gate:** the above plus `npm run test:modules`; red proofs recorded per profile (builtin scenarios against the Phase 1 seeds, adapter changes without their change).

### Wave 0 Gaps
- [ ] `test/domain/mcp-builtin-translation.test.ts`, `test/bridges/mcp/builtin-{escape,entry,registration}.test.ts` — new pairs (BLT-02, BLT-01)
- [ ] `test/integration/mcp-builtin-encoding-conformance.test.ts` — Pi resolver/validator conformance over `EXPANSION_CASES` (BLT-02)
- [ ] `features/lib/mcp-builtin-tool-search.ts` + its step — `tool_search` projection (BLT-01)
- [ ] `features/lib/mcp-builtin-earlier-record.ts` + its `Given` — legacy record rewrite (MREC-02)
- [ ] A restart-scoped "no extension errors" / "not reached" step (MSEL-02/03)
- [ ] Optional `features/lib/mcp-builtin-registry-probe/` for OAuth/timeout values (Open Question 2)

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (OAuth fields passed to Pi) | Pass only Claude's four OAuth fields; never `clientSecret`, `clientName`, `clientRegistration`, `auth` (D-MB-11 amended, PI-6) |
| V3 Session Management | no | -- |
| V4 Access Control | yes | Project trust gate on every call (`ctx.isProjectTrusted()`, D-MB-09); MSEL-03 gate |
| V5 Input Validation | yes | `checkClaudeShape` via `profileFor("builtin").classify`; Pi's `validateMcpServerConfig` on register; encoding neutralizes `$` and leading `!` |
| V6 Cryptography | no | -- |
| V12 Files and Resources | yes | `assertPathInside` on `resolvedSource` (UF-1); `locationsFor` for every path; registration writes nothing (`persistMigration: false`) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plugin value starting with `!` runs a shell command in Pi | Elevation of privilege | Built-in encoder writes `$!` (and `$$`) in `env`/`headers`; conformance test through Pi's resolver |
| Path traversal through a tampered `resolvedSource` feeding `${CLAUDE_PLUGIN_ROOT}` and the legacy reader | Tampering | Containment check before any read or expansion (UF-1) |
| Untrusted project's plugin starts a process | Elevation of privilege | Trust gate per call, background children included; builtin-only scenario with an empty stub log |
| Resolved secrets visible to other extensions through `getMcpServers()` | Information disclosure | Accepted (P2-DC-02): same process already holds `process.env`; nothing persisted |
| Legacy `mcp.json` entry resolved with Pi's `!`/`$` rules in the first built-in session | Elevation of privilege | Accepted one-session gap (P2-DC-11); AMIG-01 removes it in the same load; document it |
| Plugin sets Pi-only powers (`auth.provider`, `cwd`, `toolExposure`) | Elevation of privilege | Closed table: never copied |
| Registration under the adapter duplicates servers through the adapter's proxy | Spoofing / DoS | MSEL-03 gate |

## Sources

### Primary (HIGH confidence)
- `node_modules/@earendil-works/pi-coding-agent@1.5.0/dist/core/mcp-servers.js` (validation, registry), `core/extensions/loader.js:110-210,380-406,498-531,561`, `core/extensions/runner.js:208-246,506-519,813-840`, `core/agent-session.js:1110-1171,2678-2700,2892-2917,3020-3048`, `core/resource-loader.js:424,546-600`, `core/package-manager.js:763-770`, `core/resolve-config-value.js`, `extensions/mcp/index.js:188-355,621-647,971-1120,1201-1203`, `extensions/mcp/config.js:1-110`, `extensions/mcp/runtime.js:36-70,142-147,279-298`, `extensions/mcp/tools.js:25-51,245-260`, `extensions/tool-search/tool.js:199-260`, `modes/rpc/rpc-mode.js:259-261`; `@earendil-works/pi-mcp/dist/transports/stdio.js:75`, `client.js:125-130,249-252`
- Repo source read this session: `index.ts`, `orchestrators/mcp/*`, `platform/{mcp-status,mcp-builtin-status,pi-api}.ts`, `orchestrators/plugin/info-mcp-status.ts`, `orchestrators/plugin/info.ts:3110-3330`, `bridges/mcp/{substitute,adapter-escape,adapter-entry,index,legacy}.ts`, `domain/{claude-mcp-variables,mcp-server-features,mcp-builtin-features,name}.ts`, `persistence/{state-io,locations}.ts`, `shared/{path-safety,path-containment,session-env,notification-types,notification-run,debug-log}.ts`, `.fallowrc.json`, features and step modules listed in Q9
- Planning: `02-CONTEXT.md`, `01-FROZEN.md`, `ROADMAP.md`, `CHILD-SESSION-BRIEF.md`, `01-SECURITY.md`, `REQUIREMENTS.md`, `research/{FEATURES,PITFALLS}.md`, cucumber and unit-test skills

### Secondary (MEDIUM confidence)
- Claude Code 2.1.318 binary strings (`/opt/claude-code/bin/claude`): stdio spawn env and `cwd`, `n8` expansion, plugin field switch, `J8t`, `qbo`, `t8`, OAuth schema `Qa`, `Cst`, `client_name`, `Awo`, `li`, `XYr`, `mcp-server-suppressed-duplicate` renderers

### Tertiary (LOW confidence)
- None used for a decision.

## Metadata

**Confidence breakdown:**
- Pi 1.5.0 behavior: HIGH — every claim read from the installed dist this session.
- Claude Code parity: MEDIUM — minified strings; the rules are clear, symbol attribution across chunks is not guaranteed.
- Architecture and seams: HIGH — zones, frozen signatures, and callers read this session.
- Cucumber design: MEDIUM-HIGH — harness read; the `tool_search` projection and the `none`-leg steps are new designs.

**Research date:** 2026-11-04
**Valid until:** 2026-12-04 (Pi and Claude Code release often; re-check if Pi moves past 1.5.0 or the Claude reference changes from 2.1.318)
