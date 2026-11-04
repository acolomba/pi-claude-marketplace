# Phase 2: Built-in Materialization - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 makes Pi's built-in MCP an equal implementation for the servers that
plugins declare. Without pi-mcp-adapter and with Pi's built-in MCP on, every
enabled plugin's runnable MCP servers are registered with
`pi.registerMcpServer` at every `session_start` and again after the load
reconcile, with the values and names Claude Code would give them. A
project-scope plugin's servers register only while Pi trusts the project.
`info` shows each built-in server's status. A switch between the adapter and
built-in needs no plugin command (turning built-in MCP back on after the
adapter turned it off stays the user's step, D-MB-01).

Requirements: MSEL-02, MSEL-03, MSEL-04, MREC-02, BLT-01, BLT-02, BLT-03,
BLT-04, BLT-05, BLT-06, MDOC-01.

The phase runs in a child session on `features/mcp-builtin-phase-2`, in
parallel with Phases 3, 4, and 5. It edits only the files the ROADMAP
ownership table gives Phase 2 and codes against the frozen interfaces in
`.planning/phases/01-foundation-and-pi-1-5-0/01-FROZEN.md`, which wins over
the ROADMAP text. It never changes a plugin state, a marker, or a per-server
verdict row (Phase 3 owns those); its scenarios pin connection, naming,
values, trust, status, and lifecycle.

The user's standing instruction for this run: decide by this project's
conventions and by Claude Code upstream parity (2.1.318), never stop to ask,
and log every questionable choice. Phase 2's log is `DUBIOUS-CHOICES.md` in
this directory (IDs `P2-DC-NN`); each step's new entries also go to the
parent session.

</domain>

<decisions>
## Implementation Decisions

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/mcp-implementation.ts` (frozen): `profileFor("builtin")` with
  `classify`, `serverName`, `toolName`, `toolNamePrefix`, `grantSelector`;
  `RecordedMcpServers`.
- `orchestrators/mcp/recorded-servers.ts` (frozen): `recordedMcpServers`,
  `createLegacyServersReader`, `LegacyServersUnreadableError`.
- `domain/claude-mcp-variables.ts` `expandClaudeValue` (Claude's expansion with
  the AVAR-05 deny-lists) and `bridges/mcp/substitute.ts` (the field walk the
  adapter path uses; it gains the encoder parameter).
- `domain/mcp-server-features.ts` `translateMcpServer` (the adapter table,
  including the timeout minimum and cap) as the model for the built-in table.
- `platform/pi-api.ts` (frozen): `PiMcpRegistry`, `McpServerConfig`,
  `RegisteredMcpServer`, `softDepStatus().mcpImplementation`.
- `shared/path-safety.ts` `assertPathInside` and `persistence/locations.ts`
  `locationsFor` (scope roots, plugin data directory).
- `bridges/mcp/adapter-doc.ts` `readMcpConfigDoc` and `PI_MCP_SERVER_KEYS` for
  reading the Pi-format `mcp.json` files in the override check.
- Harness (frozen): the "MCP implementation" step, the restart steps,
  `waitForStubListing` (built-in namespace or full tool names),
  `STUB_TOOL_NAMES`, `features/lib/earlier-version-state.ts`.

### Established Patterns

- Session steps never throw and debug-log on the `mcp` channel (NFR-2);
  `session-materialize.ts` already wraps each step.
- Pi's built-in MCP connects registrations read at its `session_start` and
  later ones through its own `mcp_servers_change` handler at once; a
  re-registration with the same config JSON is a no-op
  (`dist/extensions/mcp/index.js`).
- `mcp.json` wins over a registration of the same namespace
  (`registeredServers`), listed only in `/mcp` as `overridden:`.
- Dual-profile scenarios: `@mcp` for shared expectations, tagged pairs for
  implementation-specific ones; check-features enforces it.

### Integration Points

- `index.ts` (frozen) already calls `builtinRegistrationStep` through
  `createMcpSessionMaterializer` at `session_start`, and
  `resyncBuiltinRegistrations({ pi, ctx, snapshot: run })` after
  `loadReconcile`.
- `orchestrators/plugin/info.ts` (frozen call) hands `withMcpServerStatus` the
  `McpStatusLookup` with the reader of the active implementation,
  `projectTrusted`, and `cwd`.
- `index.ts` builds `createBuiltinMcpStatusReader(pi)` at factory time; the
  reader must not read `pi` until a lookup runs.

</code_context>

<specifics>
## Specific Ideas

- Pi 1.5.0 evidence (`node_modules/@earendil-works/pi-coding-agent/dist`):
  `extensions/mcp/index.js` `registeredServers` (namespace override),
  the `session_start` and `mcp_servers_change` handlers (registration read and
  config-JSON compare), `registerTools` (tools registered with their exposure
  on connection); `core/mcp-servers.js` `validateMcpServerConfig`
  (`timeout` must be a positive number of seconds, `oauth.scope` a string);
  `extensions/mcp/config.js` `loadMcpConfig` (user `mcp.json`, project
  `.pi/mcp.json` only when trusted).
- Claude Code 2.1.318 evidence: the plugin error type
  `mcp-server-suppressed-duplicate` (a plugin server suppressed as a duplicate
  of another configured server, reported in `/plugin`).
- Phase 1 security advisory UF-1 (`01-SECURITY.md`): the containment check is
  added at this phase's call site.

</specifics>

<deferred>
## Deferred Ideas

- A load-time notice for an overridden or failed built-in registration (needs
  a new closed-set message; info and Pi's `/mcp` report it for now).
- Immediate register and unregister on install, uninstall, enable, and disable
  (MCPV2-01); deny rules to `toolExposure: "hidden"` (MCPV2-02); background
  agents under built-in (MCPV2-03).
- A fallback when `tool_search` is turned off (`-builtin:tool-search`), which
  makes deferred tools unreachable: recorded gap.
- The `{requires mcp}` step of the switch scenario (DUAL-04, Phase 6) and every
  marker or state row that depends on the active implementation (Phase 3).

</deferred>

---

*Phase: 02-built-in-materialization*
*Context gathered: 2026-11-04*
