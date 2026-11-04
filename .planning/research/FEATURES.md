# Feature Research

**Domain:** Claude plugin MCP servers on Pi, served by one of two equal MCP implementations (pi-mcp-adapter 7.x or Pi 1.5.0 built-in MCP), chosen per session
**Milestone:** mcp-builtin
**Researched:** 2026-11-04
**Confidence:** HIGH for the field and transport verdicts (read from the Claude Code 2.1.318 binary, the Pi 1.5.0 and pi-mcp 1.5.0 package sources, and the pi-mcp-adapter 7.0.0 and pi-subagents 0.84.0 package sources). MEDIUM for the user-visible wording and the switch UX, which are recommendations with no direct upstream counterpart.

## Evidence base

Claude Code facts come from `/opt/claude-code/bin/claude`. `claude --version` prints **2.1.318**, not 2.1.316 as the brief assumed. I extracted strings from the binary and grepped them. Nothing ran beyond `--version`. Pi facts come from `npm pack @earendil-works/pi-coding-agent@1.5.0` and `@earendil-works/pi-mcp@1.5.0`. pi-mcp-adapter facts come from `npm pack pi-mcp-adapter@7.0.0`, and pi-subagents facts from `npm pack pi-subagents@0.84.0`. Each tarball was unpacked into its own scratch directory, and none of its code ran. Primary-source reads like these rank first in the compat-research skill's evidence order, so they are tagged HIGH. The `classify-confidence` seam has no provider for direct source reads. It rates every web provider MEDIUM, and no web source decided anything here.

### Claude Code 2.1.318 facts this milestone depends on

| # | Fact | Evidence |
|---|------|----------|
| CC-1 | The plugin server config union is `stdio`, `sse`, `http`/`streamable-http`, `ws`, `sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy` (schema `Lse`). The stdio fields are `type, command, args, env, timeout, alwaysLoad, bareElicitationCapability, role`. **There is no `cwd`.** The remote fields add `url, headers, headersHelper, oauth, request_timeout_ms, tools[], displayName, discoveryCache, toolPermissions`. | binary strings: `Ugt=…u({type:T("stdio").optional(),command:…,args:…,env:…,timeout:…,alwaysLoad:…,bareElicitationCapability:…,role:…})`; `q$t`/`xon` for http/sse |
| CC-2 | `oauth` accepts only `clientId, callbackPort, authServerMetadataUrl (https://), scopes, xaa`. It has no `clientSecret`. | `Qa=…u({clientId,callbackPort,authServerMetadataUrl…startsWith("https://"),scopes,xaa})` |
| CC-3 | `displayName` is new since 2.1.291 and marked `@internal`. It labels the server's tools and is `.catch(void 0)`, so it can never make a config malformed. | `WA=…describe("@internal A readable name for this server…")` |
| CC-4 | A plugin server whose type is host-only (`sse-ide`, `ws-ide`, `sdk`) or `claudeai-proxy` is **dropped at plugin load**. Claude records a plugin error, `MCP server "<name>" invalid: type "<t>" servers cannot be declared by a plugin; only the host application registers them`, and the plugin's other components still load. | `n.push({type:"mcp-config-invalid",…validationError:qe==="host-only"?…})`; render `case"mcp-config-invalid":return\`MCP server ${…} invalid: ${…}\`` |
| CC-5 | Claude has its own case of "the client will not run this server type". Under `CLAUDE_CODE_SKIP_PLUGIN_LOCAL_MCP_SERVERS`, a plugin's stdio servers are skipped with a debug-log line only (`only sse, http and ws servers load while … is set`), and the plugin stays enabled. So upstream's pattern for a server it will not run is to skip the server and keep the plugin. Claude never refuses the install. | binary string quoted |
| CC-6 | `bareElicitationCapability` exists only as a workaround for servers that reject Claude's elicitation capability object: `This server (Java MCP SDK 0.17.0 or older) rejected Claude Code's elicitation capability. Set "bareElicitationCapability": true…` | binary string quoted |
| CC-7 | Claude's OAuth redirect URI is `http://localhost:<port>/callback`, and its dynamic client registration sends `client_name: "Claude Code (<serverName>)"`. | `clientMetadata(){let e={client_name:\`Claude Code (${this.serverName})\`,redirect_uris:[this.redirectUri]…` |
| CC-8 | Tool names are `mcp__<normalized server>__<tool>`, and plugin servers are named `plugin:<plugin>:<server>`. The normalization replaces characters outside `[A-Za-z0-9_-]` with `_`, so **`-` is kept**. Hook matchers and agent `tools:` entries address `mcp__plugin_<plugin>_<server>__<tool>`. | binary `\`mcp__${En(n)}__\``; existing record ANAME-01/02 in `docs/mcp-compatibility.md` (2.1.291) |
| CC-9 | A config with `headersHelper` runs the helper only in a trusted workspace (`headersHelper not run — this workspace has no persisted trust`). | binary string quoted |
| CC-10 | Plugin load errors surface as `… error(s) during load. Run /plugin for details.` in the reload summary. | binary string; MEDIUM: the call site is minified |

### Pi 1.5.0 built-in MCP facts (beyond the brief)

| # | Fact | Evidence |
|---|------|----------|
| PI-1 | **Pi expands variables only in `env`, `headers` and `oauth.clientSecret`.** `url`, `command` and `args` are used verbatim. | `dist/extensions/mcp/runtime.js` `createDefaultTransport`: `resolveHeadersOrThrow(config.headers)`, `resolveConfigValueOrThrow` per env value; `command: expandHome(config.command)` |
| PI-2 | Pi's template syntax is `${NAME}` **and bare `$NAME`**. It has no `${NAME:-default}`: a `${…}` body that is not a plain name stays literal. A value that starts with `!` runs a shell command. `$$` escapes `$`, and `$!` escapes `!`. A variable that is unset **or empty** makes the value unresolved, and the `…OrThrow` call fails the connection. | `dist/core/resolve-config-value.js` `parseConfigValueTemplate`, `resolveEnvConfigValue` (`env?.[name] \|\| process.env[name] \|\| undefined`) |
| PI-3 | A leading `~`, `~/` (and `~\` on Windows) in `command`, `args` and `cwd` becomes the home directory. | `runtime.js` `expandHome` |
| PI-4 | `validateMcpServerConfig` rejects `type: "sse"` (`legacy SSE transport is not supported; use the streamable HTTP URL`) and a url that is not http/https. It passes unknown keys through. | `dist/core/mcp-servers.js` |
| PI-5 | HTTP servers use OAuth unless they have an `Authorization` header (in any case) or `auth`. This is Claude's rule, natively. | `runtime.js` `usesOAuth` |
| PI-6 | `auth: { provider }` sends a Pi `/login` provider token to `url`. It is a Pi-only power that a plugin must never set. | `mcp-servers.d.ts` `McpHttpServerConfig.auth` |
| PI-7 | `timeout` is in **seconds**, a positive number, and resets on progress. The default is 60. | `mcp-servers.d.ts` |
| PI-8 | Tool names are `mcp__<server>__<tool>` with `[^A-Za-z0-9_]`→`_`. **A name over 64 characters is cut and gets an 8-hex hash.** Tools whose names collide after sanitizing also get the hash. | `dist/extensions/mcp/tools.js` `createMcpToolName`, `MAX_TOOL_NAME_LENGTH = 64` |
| PI-9 | The client announces only `roots`. It announces no elicitation and no sampling, and it does not handle prompts. It does offer resources (`list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`). | `dist/extensions/mcp/runtime.js` `new McpClient({name:"pi",…roots})`; pi-mcp `dist/client.js` initialize; `docs/mcp.md` "Use resources" |
| PI-10 | Pi connects every enabled server in the background at session start and keeps it connected. A dropped connection reconnects on the next call. Pi turns `tool_search` on by itself when a `deferred` server exists. | `docs/mcp.md` "Diagnose connection problems", "Control tool exposure" |
| PI-11 | Handling `mcp_servers_change` "marks an extension as the one that connects registered servers". The extension must never subscribe to it. | `dist/core/extensions/types.d.ts` `McpServersChangeEvent` doc |
| PI-12 | Pi exposes no status channel. `getAllTools()` returns `name, description, parameters, exposure, namespace{name, aliases:[server]}, sourceInfo`, but not the tool `label` (`<server>/<original tool>`). Withdrawn and disabled tools are re-registered as `exposure: "hidden"`. | `dist/core/agent-session.js` `getAllTools`; `mcp/index.js` `hideTools` |
| PI-13 | Built-in MCP reads `~/.pi/agent/mcp.json` and `<project>/.pi/mcp.json`. **These are the same files that pre-AMIG releases of this extension wrote plugin servers into.** An `mcp.json` server whose namespace equals a registration wins, and the registration shows as overridden. | `docs/mcp.md`; `mcp/index.js` `registeredServers` |
| PI-14 | The extension set is computed from settings **before** any extension code runs. The only exception is the interactive project-trust pre-pass. So removing `-builtin:mcp` in session N loads built-in MCP from session N+1 on. | `dist/core/resource-loader.js` `reload()`, `dist/main.js` `shouldResolveProjectTrust` |
| PI-15 | `/mcp` changes to the enabled state or exposure of a registered server apply to the current session only. | `docs/mcp.md` "Add servers from extensions" |
| PI-16 | pi-subagents 0.84.0 already resolves `mcp:<server>[/<tool>]` against built-in MCP when the adapter is absent. Detection: `/mcp` with `sourceInfo.path === "builtin:mcp"`. Tool names are taken as the server reports them, and the server part may use `-` or `_`. A server registered by an extension works only in background children, because the registering extension loads there too. | `docs/agents.md` line 573; `src/runs/shared/mcp-direct-tool-allowlist.js` |
| PI-17 | The adapter's onboarding state is `<agentDir>/mcp-onboarding.json`. `piBuiltinMcpHandledVersion` records the adapter version that "last turned off, **or found configured**," built-in MCP. | pi-mcp-adapter 7.0.0 `onboarding-state.ts`, `pi-builtin-mcp.ts` |

## Three-column verdict table

Verdict vocabulary: **supported** (written as is), **translated** (written in the implementation's own form), **blocked** (the server is left out and the plugin is `(partially-available)` / `(partially-installed)` with `{unsupported mcp}` and `(unsupported <feature>)`), and **dropped-with-note** (the field is not written, the server runs, and the note or warning says what is lost). The Claude Code column states what upstream does with a plugin server.

### Transports and sources

| Claude field / transport | Claude Code 2.1.318 | pi-mcp-adapter 7.0.0 | Pi 1.5.0 built-in |
|---|---|---|---|
| `type` absent or `stdio` | runs | supported | supported |
| `type: "http"` / `"streamable-http"` | runs | supported (Streamable HTTP; falls back to SSE on 404/405/406/415) | supported (Streamable HTTP only; retries transient errors twice) |
| `type: "sse"` | runs | translated: `httpTransport: "sse"` | **blocked, `(unsupported sse)`**. Pi rejects SSE (PI-4). New feature token, licensed by a Pi gap |
| `type: "ws"` | runs | blocked `(unsupported ws)` | blocked `(unsupported ws)` |
| `sse-ide`, `ws-ide`, `sdk`, `claudeai-proxy` | dropped at load with a plugin error; the plugin stays (CC-4) | blocked | blocked |
| `mcpServers` path to `.mcpb` / `.dxt` | unpacks and runs | blocked | blocked |

### Stdio fields

| Field | Claude Code | Adapter | Built-in |
|---|---|---|---|
| `command` | `${…}` expanded at load | translated (variable rewrite into adapter syntax, AVAR-01..03) | **translated**: Pi expands nothing here (PI-1), so the extension expands `${NAME}` / `${NAME:-default}` itself, with Claude's rules, at registration |
| `args` | expanded | translated | translated (as `command`) |
| `env` | expanded | translated (split tokens, `!`→`!!`) | translated: escape `$`→`$$` and a leading `!`→`$!` (PI-2). Unset with no default → Claude's literal `${NAME}`, written `$${NAME}` |
| `CLAUDE_PLUGIN_ROOT` / `CLAUDE_PLUGIN_DATA` added to `env` | yes | translated | translated |
| leading `~` in `command` / `args` | kept literal | blocked `(unsupported command ~)` / `(unsupported args ~)` | blocked, same tokens (PI-3) |
| `cwd` | **not a Claude field** (CC-1); stripped | dropped | dropped. Never written; Pi's default is the session directory. Corrects the brief, which listed `cwd` as a built-in gain |

### Remote fields

| Field | Claude Code | Adapter | Built-in |
|---|---|---|---|
| `url` | expanded | translated | **translated**: the extension expands it, since Pi does not (PI-1) |
| `headers` | expanded | translated | translated (escaped as `env`) |
| OAuth beside headers without `Authorization` | OAuth stays on | translated: `auth: "oauth"` when every value is clean (D-08-04) | **supported natively** (PI-5). No field is written, and the D-08-04 residual gap does not exist here |
| `headersHelper` | runs (trusted workspace only, CC-9) | blocked | blocked. Pi has no helper; `!cmd` works per header and cannot produce header names |
| `oauth.clientId` | used | supported | supported |
| `oauth.callbackPort` | redirect `http://localhost:<port>/callback` (CC-7) | translated → `redirectUri` | **translated → `callbackUrl: "http://localhost:<port>/callback"`**. With `callbackPort` alone, Pi would use `127.0.0.1`, which a client registered for Claude Code rejects |
| `oauth.authServerMetadataUrl` | https only | supported | supported (Claude's stricter https check stays the malformed rule) |
| `oauth.scopes` | used | translated → `scope` | translated → `scope` |
| truthy `oauth.xaa` | cross-app access | blocked | blocked |
| any other `oauth` key (`clientSecret`, …) | not in the schema (CC-2) | dropped | dropped; never pass `clientSecret`, `clientName`, `clientRegistration`, `callbackUrl` from a plugin |
| `timeout` (ms, hard limit) | used | translated → `requestTimeoutMs` (≥1000, capped) | translated → `timeout: ms / 1000` seconds (≥1000 ms rule kept). Same gap: resets on progress, 60 s default |
| `request_timeout_ms` | stands in for `timeout`, capped at 300000 | via the timeout rule | via the timeout rule |
| `tools[].permission_policy`, `toolPermissions` | accepted; enforcement for plugin servers unknown | dropped-with-note: `MCP server tool rules not enforced.` (ANAME-07) | dropped-with-note, same warning (MVP). A differentiator below maps deny rules to `toolExposure: "hidden"` |
| `discoveryCache`, `role`, `displayName` | internal | dropped silently | dropped silently |

### Common fields and capabilities

| Field / capability | Claude Code | Adapter | Built-in |
|---|---|---|---|
| `alwaysLoad: true` | tools always in the prompt | translated → `directTools: true` | translated → `exposure: "direct"` (decision 2) |
| `alwaysLoad` other / absent | deferred behind tool search | translated → `directTools: "search"` | translated → `exposure: "deferred"` (decision 2) |
| `_meta["anthropic/alwaysLoad"]` per tool | honored | gap (entry written before the tool list is known) | gap (same reason; `toolExposure` exists but needs tool names up front) |
| `bareElicitationCapability: true` | sends a bare capability (CC-6) | blocked (adapter always announces form+url) | **supported**. Built-in announces no elicitation at all (PI-9), so the handshake the flag protects cannot fail. Recommendation, see Dubious Choices |
| plugin `description` (extension-owned) | -- | written as `description` | written as `description`; Pi also lists it in the system prompt and ranks tool search by it |
| Pi-only powers a plugin must never set | -- | dropped: `auth`, `approveTools`, `lifecycle`, … | dropped: `auth.provider` (PI-6), `enabled`, `exposure`, `toolExposure`, `cwd`, `oauth.clientName`/`clientRegistration`/`callbackUrl`/`clientSecret` |
| tools | yes | yes | yes |
| resources | yes | yes (`server-manager.ts` `readResource`) | yes (PI-9) |
| prompts as `/mcp__<server>__<prompt>` | yes | yes (`prompts.ts`) | **no**. Pi gap; the server still runs, no verdict |
| elicitation | form + url | form + url | **no** (Pi gap) |
| sampling | not checked | yes (`init.ts`) | no |
| connection lifecycle | connect at start, keep | lazy (ANAME-05) | connect at start, keep (PI-10). The ANAME-05 divergence disappears |
| project-scope approval | never asked for plugin servers | per-server approval (D-CF6-03) | none. Registered only when `ctx.isProjectTrusted()`; closer to Claude |
| tool-name length | no limit | no limit | **cut to 64 with a hash** (PI-8). New divergence, Pi gap |
| name sanitizing | `-` kept (CC-8) | `-` kept in tool names | `-`→`_` (PI-8). Brief's divergence, Pi gap |
| persisted `/mcp` choices | per project in `~/.claude.json` | `mcp-adapter.json` user overrides kept (D-08-01/02) | **session only** (PI-15). Pi gap |

The read-time verdict rule: a server is blocked when the **active** implementation cannot run it. When no implementation is active, blocked means "neither implementation can run it", and the soft-dependency marker says why nothing runs (see below).

## User-visible behavior per implementation

### Detection (one snapshot per command run)

| Active | Condition at `session_start` | Source |
|---|---|---|
| `adapter` | `/mcp-adapter` loaded (today's `hasLoadedPiMcpAdapter`) | `platform/pi-api.ts` |
| `builtin` | not adapter, and `/mcp`'s `sourceInfo.path === "builtin:mcp"` | the same test pi-subagents uses (PI-16) |
| `none` | neither, e.g. `-builtin:mcp` in settings, `--no-mcp`, `--no-extensions` | -- |

### list / install / update / enable rows

| Situation | adapter | builtin | none |
|---|---|---|---|
| Plugin with a stdio server, installed | `● demo v1.0.0 (installed)` | `● demo v1.0.0 (installed)` | `● demo v1.0.0 (installed) {requires mcp support}` |
| Not installed, with an `sse` server | `(available)` | `⊖ … (partially-available) {unsupported mcp}` | `(available) {requires mcp support}`: the union rule, since the adapter could run it |
| `install` of that plugin without `--partial` | installs | refused at error severity, `(partially-available) {unsupported mcp}` + `Re-run with --partial to install the supported components.` | installs with the marker |
| That plugin installed earlier, after a switch to built-in | -- | `◉ … (partially-installed) {unsupported mcp}`. The state is derived, never persisted (FSTAT-02 already works this way) | -- |
| Plugin installed `--partial` under the adapter only for `bareElicitationCapability` | `◉ (partially-installed)` | `● (installed)`: the full record now serves every server | marker |

Soft-dependency marker: **`requires mcp support`**, in place of `requires pi-mcp-adapter`, and only when `none` is active. The style guide (D-16-15) keeps reason tokens lowercase. Every `requires …` marker names what is missing, and the package name no longer fits here, because either implementation satisfies the plugin. The marker keeps the agents → mcp → workflows order inside the brace. `{requires pi-mcp-adapter}` leaves the REASONS closed set, or stays unused there (a breaking JSON-output change, so record it in the CHANGELOG).

### `info`

```text
● community-mp [user] <no autoupdate>
  ● analytics v1.0.0 (installed)
    mcp: plugin:analytics:api (connected; withheld ANTHROPIC_API_KEY)
    requires: builtin:mcp
```

- `mcp:` keeps Claude's name, `plugin:<plugin>:<server>`, under every implementation, and so do the `unset`/`withheld` lists (AVAR-04/05).
- `requires:` names the implementation that serves the servers: `pi-mcp-adapter`, or `builtin:mcp` (Pi's own name for the extension, in settings and in `sourceInfo`), or `mcp support (missing)` under `none`. JSON: `{"companion":"builtin:mcp","missing":false}`. The `Companion` union widens. The catalog sentence "Pi's built-in MCP client does not count as pi-mcp-adapter" goes.
- Status tokens:

| Token | adapter (unchanged, ASTAT-01) | builtin (derived from `getMcpServers` + `getAllTools` + the scope's `mcp.json` files) |
|---|---|---|
| `connected` | yes | a non-hidden tool under the server's namespace alias |
| `cached, connects on first use` | yes | never (Pi connects eagerly) |
| `not connected` | yes | registered, no tools yet (connecting, failed, or needs sign-in, which Pi does not tell apart; Pi reports sign-in and failures itself once after start) |
| `needs authentication`, `failed`, `pending approval` | yes | not derivable (PI-12) |
| `disabled` | yes | every tool of the server is `hidden` |
| `project not trusted` | -- | **new**: a project-scope server held back because the project is untrusted |
| `overridden by mcp.json` | -- | **new**: an `mcp.json` server with the same namespace wins (PI-13). Follows Claude's "overridden by" wording, as `overridden by project scope` does |
| `overridden by project scope` | yes | yes (register the project record and skip the user one) |
| `not loaded` | yes | only if installs register at the next load and not at once (see D2) |
| `status unknown` | adapter absent or no report | also under `none` |

### The switch (installing or uninstalling the adapter, then `/reload`)

**Built-in → adapter** (`pi install npm:pi-mcp-adapter`, `/reload`):
1. The adapter loads, takes `/mcp`, and writes `-builtin:mcp` once per version. The adapter reports that write itself.
2. The extension detects `adapter`, registers nothing, and reconciles `mcp-adapter.json` from the install records. Entries already exist when every install also writes them; a server the adapter blocks is removed or kept out.
3. It re-materializes generated agents: `mcp:plugin_<p>_<s>_/<tool>`.
4. Output: nothing for a clean switch. Each plugin the adapter runs only partly shows `◉ (partially-installed) {unsupported mcp}` in `list`/`info`, plus one load-time warning row per such plugin (recommended, see Gaps item 4).

**Adapter → built-in** (`pi remove pi-mcp-adapter`, start Pi or `/reload`):
1. Load N: the adapter is absent, but `-builtin:mcp` is still in `~/.pi/agent/settings.json`, so built-in MCP did not load (PI-14). Active = `none`.
2. If `mcp-onboarding.json` holds a `piBuiltinMcpHandledVersion` **and** the user settings' `extensions` hold exactly `-builtin:mcp`, the extension removes that one entry atomically (decision 1). It never touches `+builtin:mcp`, never touches a project `settings.json`, and never writes `mcp-onboarding.json`.
3. The extension **notifies**. Recommended standalone info message, through the notify chokepoint:
   `Turned Pi's built-in MCP back on: removed "-builtin:mcp", which pi-mcp-adapter had added, from ~/.pi/agent/settings.json.` followed by the `/reload to pick up changes` trailer. Reason to notify: the extension changed a user-owned settings file. The adapter reports its own write of the same line, and silence would leave rows showing `{requires mcp support}` with no explanation.
4. Load N+1 (`/reload`): active = `builtin`. The extension registers the servers and re-materializes the agents (`mcp:plugin_<p>_<s>/<tool>`). No output for a clean switch.

The extra `/reload` in step 4 conflicts with "a switch must never require action from the user." Pi's capability gap (PI-14) licenses it, with the same shape as the existing AMIG "one more `/reload`" divergence. Phase research should still test removing the line from the extension factory during the interactive trust pre-pass, where it would take effect at once.

## Feature Landscape

### Table Stakes (Users Expect These)

| # | Feature | Why Expected | Complexity | Depends on existing code |
|---|---|---|---|---|
| T1 | Pi 1.5.0: dev deps, peer floor `>=1.5.0`, lockfile | `registerMcpServer` exists since 1.4, but the 1.5.0 OAuth fix, tool-search ranking and argument coercion are what users get | LOW | `package.json`, `platform/pi-api.ts` (pi-schema move: unaffected per brief) |
| T2 | Active-implementation snapshot (`adapter`/`builtin`/`none`) taken once per run | Every verdict, marker and materialization keys on it | LOW | `platform/pi-api.ts` `softDepStatus`, `SoftDepStatus`, `shared/notify-reasons.ts` |
| T3 | Implementation-neutral install records: every declared server in its Claude-shaped form after plugin-variable substitution, plus a backfill for existing records that hold only names | Read-time verdicts and built-in registration need the full config; existing installs must work under built-in with no reinstall | HIGH | `persistence/state-io.ts` (`mcpServers: string[]` today), `domain/mcp-resolution.ts`, migration path (NFR-1, APL-D1 interaction) |
| T4 | Read-time verdicts per implementation on `list`, `info`, `install`, `update`, `enable`, `pending`, `apply` | "A plugin's state depends on the active implementation" (brief) | HIGH | `domain/mcp-server-features.ts` `classifyMcpServer` splits into per-implementation tables; resolver `partially-available`; FSTAT-02 derived state |
| T5 | Built-in verdict table: `sse` blocked (new `(unsupported sse)`), `bareElicitationCapability` supported, everything else as the adapter | Truthful `{unsupported mcp}` per implementation | MEDIUM | `McpUnsupportedFeature` union, output catalog |
| T6 | Built-in translation table (the verdict table above): extension-side expansion for `url`/`command`/`args`, `$$`/`$!` escaping in `env`/`headers`, seconds `timeout`, `callbackUrl` on localhost, `scope`, `description`, `exposure` | Servers must receive what Claude gives them | HIGH | `bridges/mcp/substitute.ts`, `adapter-escape.ts` (adapter-only), deny-lists (AVAR-05) reused |
| T7 | Built-in materialization: `pi.registerMcpServer` at `session_start` for every enabled record, project scope only when trusted, the project record winning over the user record, never under `adapter`/`none`, never handling `mcp_servers_change` (PI-11), registration errors reported as rows | "Materialize correctly on startup and /reload" | MEDIUM | `index.ts` `session_start`, notify chokepoint |
| T8 | Built-in naming: server `plugin_<plugin>_<server>` by ANAME-01 (keeps `-`); collision check against both scopes' `mcp.json` by namespace (`-`≡`_`) and against other extensions' registrations | Claude names wherever Pi allows; refuse a collision as ANAME-03 does | MEDIUM | `bridges/mcp/collision-*.ts` |
| T9 | Marker and `requires:` per implementation (`requires mcp support`; `requires: pi-mcp-adapter` / `builtin:mcp` / `mcp support (missing)`) | Today's `{requires pi-mcp-adapter}` lies under built-in | LOW | `shared/concerns/soft-dep.ts`, `notification-types.ts` REASONS, output catalog, JSON docs |
| T10 | Built-in status reader for `info` | `info` shows server state today | MEDIUM | `platform/mcp-status.ts` gains a sibling |
| T11 | Agent grants per implementation, re-materialized on load (`mcp:plugin_<p>_<s>_/<t>` vs `mcp:plugin_<p>_<s>/<t>`) | A generated agent must launch with its tools after a switch | MEDIUM | `bridges/agents/convert.ts`; **APL-D1 says a load changes no installation state, so this needs a recorded amendment** (like AMIG-01's load-time move) |
| T12 | Adapter `mcp-adapter.json` reconciled from the records on load or apply | Built-in → adapter switch; servers recorded while built-in was active | MEDIUM | `bridges/mcp/stage.ts`, AMIG-01 precedent for load-time writes |
| T13 | `-builtin:mcp` cleanup with a notice (decision 1) | Without it, uninstalling the adapter leaves no MCP | MEDIUM | new settings writer; NFR-10 amendment; `shared/atomic-json.ts` |
| T14 | Hooks under built-in: direct calls fire `PreToolUse`/`PostToolUse` with no adapter `mcp`-proxy special case; codemode-nested calls also fire | Hook parity on MCP tools (ANAME-02) | LOW | `bridges/hooks/dispatch.ts` `MCP_PROXY_TOOL` becomes adapter-only |
| T15 | Every MCP cucumber scenario runs under `@adapter` and `@builtin` profiles, with shared steps and implementation-specific expectations in their own scenarios | Brief requirement and the behavioral-test rule | HIGH | `features/mcp-server/*`, `features/lib/companions.ts`, `cucumber.json` (one `default` profile today) |
| T16 | `docs/mcp-compatibility.md` built-in column, output catalog, README, CHANGELOG | Parity reference | MEDIUM | docs |

### Differentiators (Competitive Advantage)

| # | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| D1 | **Hook `tool_name` server-segment restoration under built-in**: map `mcp__plugin_my_plugin_api__x` back to `mcp__plugin_my-plugin_api__x` before matching and before the hook gets its input | Most real plugin names contain `-`. Without this, hook matchers break under built-in for most plugins | MEDIUM | The extension owns the server half of the mapping, so the Pi gap licenses only the **tool** segment (Pi does not expose the original tool name, PI-12). **Parity question, see Gaps item 1** |
| D2 | Register and unregister at once on `install`/`uninstall`/`enable`/`disable` under built-in (Pi connects later registrations right away) | The MCP part needs no `/reload` | MEDIUM | The rest of the plugin still needs `/reload`, so the trailer stays; `not loaded` disappears under built-in |
| D3 | `tools[].permission_policy: "always_deny"` and `toolPermissions: "blocked"` → `toolExposure: "hidden"` | Built-in can enforce deny rules the adapter cannot | LOW | Ask rules stay unenforced with the warning; first establish whether Claude enforces them for plugin servers |
| D4 | Claude-literal variable semantics under built-in: unset `${NAME}` stays literal, empty stays empty, no split tokens, no install-time-only defaults | Removes six adapter-licensed divergences in the Variables section | (part of T6) | Keep set non-empty references as `${NAME}` for Pi to expand, so secrets stay out of `getMcpServers()` copies |
| D5 | pi-subagents bug A (`directTools: "search"` rejected) does not apply under built-in | Background agents may really get plugin MCP tools under built-in | LOW (verify) | Re-test MCPBG-01 under `@builtin` |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| A `/claude:plugin mcp use adapter\|builtin` switch or setting | Explicit control | The brief forbids it; the trigger is installing or uninstalling the adapter | Detection at `session_start` |
| One registration path for both (`registerMcpServer` + the adapter's `applyPiMcpServers`) | Less code | The adapter drops `directTools`, so `alwaysLoad` is lost (brief) | Separate materialization per implementation |
| Writing plugin servers into Pi's `mcp.json` for built-in | Persistent, with `/mcp` choices that persist | It edits a user-owned file outside NFR-10, an `mcp.json` entry outranks every registration, and it re-creates the legacy entries that AMIG-01 had to move out | Session registrations from the records |
| Handling `mcp_servers_change` | Status tracking | It marks the extension as the connector (PI-11) | Read `getAllTools` on demand |
| Writing `mcp-onboarding.json` or `mcp-project-approvals.json` | Clean state after cleanup | Adapter-owned files (NFR-10, D-CF6-03) | Read only |
| Turning on `tool_search`/`codemode` in settings | Make tools findable | Built-in turns `tool_search` on itself for `deferred` servers (PI-10) | Nothing to do |
| `exposure: "codemode"` for plugin servers | Pi's default | Decision 2 chose `deferred`/`direct`, the closest to Claude's tool search | Keep decision 2 |
| A load notice on every switch | Visibility | Claude has no switch; the noise repeats every session | Notice only for the settings cleanup and for plugins that become partial |
| Refusing or disabling a plugin that becomes partial after a switch, or asking for `--partial` again | Consent purity | Breaks "never require action"; upstream skips a server it will not run and keeps the plugin (CC-4, CC-5) | Derived `(partially-installed)` plus the warning row |
| Expanding every variable into the registration | Simpler | Copies secrets into a structure every extension can read through `getMcpServers()` | Expand only what Pi cannot or must not expand |
| Persisting `/mcp` disable choices for built-in plugin servers in an extension store | Parity with adapter overrides | New store and new UX surface for a session-only Pi feature | Document the gap; revisit if Pi adds persistence |
| `oauth.clientName: "Claude Code (<server>)"` under built-in | Servers that allow only Claude clients would sign in | It presents Pi as Claude Code to third-party authorization servers, and setting it turns CIMD off | User question (see Gaps item 2) |

## Feature Dependencies

```
T1 Pi 1.5.0
 └─> T2 detection snapshot
      ├─> T9 markers / requires:
      ├─> T4 read-time verdicts ──requires──> T3 Claude-shaped records (+ backfill)
      │                         └─requires──> T5 built-in verdict table
      ├─> T7 built-in materialization ──requires──> T3, T6 translation, T8 naming
      │     ├─> T10 status reader
      │     ├─> T14 hooks (proxy case adapter-only) ──enhanced by──> D1
      │     └─> D2 immediate registration
      ├─> T12 adapter reconcile from records ──requires──> T3
      ├─> T11 agent grants per implementation ──requires──> T8 naming, APL-D1 amendment
      └─> T13 settings cleanup (independent of T3; needs only T2)
T15 cucumber profiles ──requires──> T2 + harness Pi with and without the adapter (+ a `none` arrangement)
T16 docs ──requires──> T5, T6 frozen
```

- **T4 requires T3.** A server the adapter blocked was dropped at install and is not in today's record, so no read-time verdict can bring it back without the full config.
- **T11 conflicts with APL-D1** until a decision lets a load rewrite generated agent files, as AMIG-01 lets a load rewrite `mcp-adapter.json`.
- **T13 is independent.** It can ship in its own parallel phase.

## MVP Definition

### Launch With

- [ ] T1–T16. The brief makes each one a requirement. The only build choice is order.

### Add After Validation

- [ ] D1 hook server-segment restoration: P1 if the user rules that parity applies (the default under the upstream-parity constraint)
- [ ] D2 immediate registration: when users report needing `/reload` just for MCP
- [ ] D5 re-test of background agents under built-in: alongside MCPBG-01

### Future Consideration

- [ ] D3 deny rules → `hidden`: after establishing whether Claude enforces them for plugin servers
- [ ] Persisted built-in choices: only if Pi persists registration overrides

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| T2, T7, T6, T8 (built-in actually runs servers) | HIGH | MEDIUM–HIGH | P1 |
| T3 records + backfill | HIGH | HIGH | P1 |
| T4, T5, T9 read-time verdicts and markers | HIGH | HIGH | P1 |
| T13 settings cleanup | HIGH | MEDIUM | P1 |
| T11 agents, T12 adapter reconcile | MEDIUM | MEDIUM | P1 |
| T10 status | MEDIUM | MEDIUM | P1 |
| T15 dual-profile cucumber | HIGH (gate) | HIGH | P1 |
| D1 hook restoration | HIGH | MEDIUM | P1/P2 (user ruling) |
| D2 immediate registration | MEDIUM | MEDIUM | P2 |
| D3 deny rules | LOW | LOW | P3 |

## Parity flags (every behavior where Claude parity is unavailable)

| Behavior under built-in | Claude Code | License |
|---|---|---|
| Model-visible tool names turn `-` into `_` | keeps `-` | Pi gap (PI-8). Covers names the model and agents see |
| Hook matchers containing `-` in the **server** segment do not match | match | **Not licensed.** The extension can restore the segment (D1). The gap covers only the tool segment |
| Tool names over 64 characters are cut with a hash | no limit | Pi gap (PI-8), new |
| SSE servers left out (`unsupported sse`) | runs | Pi gap (PI-4) |
| `headersHelper`, `ws`, `xaa`, bundles, leading `~` left out | runs | Pi gap (same as adapter) |
| No MCP prompts as slash commands; no elicitation | yes | Pi gap (PI-9) |
| Timeout resets on progress; 60 s default | hard limit, ~28 h default | Pi gap |
| `_meta["anthropic/alwaysLoad"]` ignored | honored | Pi gap |
| `/mcp` choices for plugin servers last one session | persisted per project | Pi gap (PI-15) |
| Project-scope servers need project trust | Claude's workspace trust gates project settings too | Matches, no license needed |
| One extra `/reload` after uninstalling the adapter | no counterpart | Pi gap (PI-14) |
| A plugin that becomes partial after a switch keeps loading, with no `--partial` consent | Claude skips unrunnable servers and keeps the plugin (CC-4, CC-5) | Matches upstream; the project's own `--partial` refusal still applies to an explicit install |
| OAuth client name `pi` (or CIMD), not `Claude Code (<server>)` | `Claude Code (<server>)` | **Not licensed yet.** Parity is possible with `clientName`; user question |
| Deny rules not enforced (MVP) | unknown | Project decision ANAME-07, extended to built-in |
| Under the adapter, every existing divergence stays as recorded | -- | existing IDs |

## Cucumber-observable outcomes per implementation

Shared fixtures should use a plugin and server name with no `-` (`demo`/`stub`), so that the tool name `mcp__plugin_demo_stub__echo` is identical under both profiles and the steps can be shared. Implementation-specific scenarios carry the differences:

| Scenario family | `@adapter` expectation | `@builtin` expectation |
|---|---|---|
| Listing / search | `mcp({search})` result `found mcp__plugin_demo_stub__echo…`, then the tool is offered | `tool_search` call loads `mcp__plugin_demo_stub__echo`, then the tool is offered; first request offers `tool_search`, not `mcp` |
| `alwaysLoad: true` | tool offered in call 1 (`directTools: true`) | tool offered in call 1 (`exposure: "direct"`) |
| Stub `initialize` params | `clientInfo.name: "pi-mcp-plugin_demo_stub_"`, capabilities with elicitation, sampling, roots, ui extension | `clientInfo: {name:"pi", version:"1.5.0"}`, capabilities `{roots:{}}` only |
| Stub `tools/call` | `_meta` with `pi-mcp-adapter/toolCallId` and `progressToken` | no adapter `_meta` (assert exact params from a run) |
| Server start count | lazy: one start for listing, a second for the call | one start at session start, kept |
| Invocation through a proxy | `mcp({tool:…})` reaches the server | adapter-only scenario |
| Variables (`configuration.feature`) | as today, including the empty-header gap | unset `${NAME}` in a header reaches the server **literally** (Claude parity); `$`/`!` literals arrive unchanged |
| OAuth beside headers | `auth: "oauth"` in `mcp-adapter.json` | nothing written; connects with no sign-in |
| SSE server | installs and answers | `(partially-available) {unsupported mcp}`; info `(unsupported sse)` |
| `bareElicitationCapability: true` | `(partially-available)` | installs and answers |
| Project scope | approval rules (`pending approval`) | trusted: answers with no approval; untrusted: not registered, info `project not trusted` |
| Lifecycle disable/uninstall/enable/update | adapter no longer offers / offers the server | server not registered after `/reload` (or at once with D2) |
| User's disabled choice survives | adapter-only scenarios | none (PI-15) |
| Hook on an MCP tool | fires for the nested call under the `mcp` proxy and for direct calls | fires for the direct call; plugin `my-plugin` matcher with `-` fires only with D1 |
| `none` | arranged with `-builtin:mcp` in the sandbox user settings and no adapter onboarding state, or `--no-mcp` | -- |
| Switch built-in → adapter | install under built-in, start with the adapter: answers with no reinstall | -- |
| Switch adapter → built-in | -- | sandbox settings hold `-builtin:mcp` and `mcp-onboarding.json` a handled version; first start shows the cleanup notice and `{requires mcp support}`; the settings file loses only that entry; the next start answers through built-in |
| Cleanup refusal | -- | `-builtin:mcp` with no onboarding state, or `+builtin:mcp`: file unchanged, no notice |
| `info` | `requires: pi-mcp-adapter`, adapter status tokens | `requires: builtin:mcp`, built-in tokens (`connected`, `overridden by mcp.json`, …) |

## Gaps and Open Questions (for requirements)

1. **D1 parity ruling.** The brief records `-` in hook matchers as a divergence licensed by a Pi gap. The extension can restore the server segment, so under AGENTS.md's parity rule only the tool segment is licensed. Ask the user whether D1 is table stakes.
2. **OAuth client name.** Claude sends `Claude Code (<server>)`. Built-in sends `pi` or uses CIMD. Should the extension set `oauth.clientName` for parity? Neither license covers leaving it unset, so this goes to the user.
3. **Cleanup ambiguity.** `piBuiltinMcpHandledVersion` also records "found configured" (PI-17). A `-builtin:mcp` that the user wrote before installing the adapter is indistinguishable from one the adapter wrote, so decision 1's "shows the adapter wrote it" cannot be proven from the adapter's state alone. Ask whether to accept that, or to have the extension record its own evidence while the adapter is present (for example, the user settings' `extensions` as seen at a session start before the adapter's first write).
4. **Warning row when a switch makes a plugin partial.** Recommended: a load-time warning row for each enabled plugin that the active implementation runs only partly. It would be shown each load, as Claude lists plugin errors each reload (CC-10). The alternative is to rely on `list`/`info` alone. This needs a messaging decision.
5. **Verdict under `none`.** Recommended: the union rule (blocked only if neither implementation runs the server), so an install in a session with no MCP is not refused for a server the adapter could run.
6. **APL-D1 amendment** for load-time agent rewrites (T11) and load-time `mcp-adapter.json` reconcile (T12).
7. **Legacy `mcp.json` entries** (AMIG "entries that stay") are read by built-in MCP too (PI-13), with adapter-only syntax (`{env:PI_CLAUDE_MARKETPLACE_EMPTY}` split tokens, `directTools`). Under built-in they can run beside the registration under another name, or receive mangled values. The AMIG notice may need a built-in variant.
8. **Built-in status precision.** `needs authentication` and `failed` cannot be told apart from `not connected` (PI-12). Confirm the reduced token set with the user, or look for a Pi API in a later release.
9. **Removal timing (PI-14).** A phase spike should test whether removal in the extension factory during the interactive trust pre-pass takes effect in the same session.

## Competitor Feature Analysis

| Feature | Claude Code 2.1.318 | pi-mcp-adapter 7.0.0 path | Built-in path (recommended) |
|---|---|---|---|
| Server a client will not run | skipped, plugin stays, error in `/plugin` (CC-4/5) | blocked, `--partial`, derived partial state | same as adapter, per active implementation |
| Tool discovery | ToolSearch, `alwaysLoad` | `mcp` proxy + deferred tools | Pi `tool_search` (auto-on) + `direct` |
| Trust | workspace trust | per-server approval | project trust only |
| Status | `/mcp` | status channel | derived from tool registry |

## Sources

- Claude Code 2.1.318 binary `/opt/claude-code/bin/claude`, strings extracted 2026-11-04 (CC-1..CC-10). HIGH.
- `@earendil-works/pi-coding-agent@1.5.0`: `docs/mcp.md`, `docs/extensions.md` (MCP Servers, `getAllTools`), `dist/core/mcp-servers.{d.ts,js}`, `dist/core/resolve-config-value.js`, `dist/extensions/mcp/{runtime,index,tools,config}.js`, `dist/core/resource-loader.js`, `dist/main.js`, `dist/core/agent-session.js`. HIGH.
- `@earendil-works/pi-mcp@1.5.0` `dist/client.js` (initialize capabilities). HIGH.
- `pi-mcp-adapter@7.0.0`: `pi-builtin-mcp.ts`, `onboarding-state.ts`, `prompts.ts`, `server-manager.ts`, `init.ts`. HIGH.
- `pi-subagents@0.84.0`: `docs/agents.md`, `docs/extension-api.md`, `src/runs/shared/mcp-direct-tool-allowlist.js`. HIGH.
- Repo: `docs/mcp-compatibility.md`, `docs/output-catalog.md` (ADET-01, ASTAT-01/02, FSTAT-02), `docs/messaging-style-guide.md` (D-16-15), `domain/mcp-server-features.ts`, `shared/concerns/soft-dep.ts`, `platform/pi-api.ts`, `persistence/state-io.ts`, `features/mcp-server/*.feature`, `features/lib/companions.ts`, `.planning/PROJECT.md` (APL-D1, D-CF6-03, D-CF6-10).

---
*Feature research for: mcp-builtin (Pi built-in MCP as an equal alternative to pi-mcp-adapter)*
*Researched: 2026-11-04*
