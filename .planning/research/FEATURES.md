# Feature Research

**Domain:** Claude plugin MCP servers delivered through pi-mcp-adapter 5 on Pi 1.0 (milestone `mcp-4`)
**Researched:** 2026-10-01
**Confidence:** HIGH for upstream and adapter facts (read first-hand from shipped code). MEDIUM for the ordering race and the design recommendations.

## Evidence base

Each fact below comes from one of these sources. I read the code myself; the release notes alone were not taken as proof.

| Source | What it settles | Confidence |
|--------|-----------------|------------|
| Claude Code **2.1.287** binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.287/claude`, `strings -n 20` then grep, 2026-10-01) | Server key, name normalization, tool-name format, the expansion pipeline, the variable grammar, handling of unset variables, the server schema | HIGH (primary source) |
| `code.claude.com/docs/en/mcp` and `/plugins-reference` (WebFetch, 2026-10-01) | Tool-search default, the documented field list for expansion, the "uses the unexpanded `${VAR}` text as-is" rule, the tool-name example | The research seam rates WebFetch LOW. Every claim used here also matches the binary, so treat them as corroborated |
| `pi-mcp-adapter@5.0.0` tarball (`docs/*.md`, `types.ts`, `config.ts`, `utils.ts`, `server-manager.ts`, `direct-tool-surface.ts`, `index.ts`, `mcp-status.ts`) | `ServerEntry` schema, what the adapter expands, tool naming, precedence and merge rules, the status snapshot, its own config writers, JSONC parsing | HIGH (primary source) |
| `@earendil-works/pi-coding-agent@1.0.0` tarball (`dist/core/agent-session.js`, `dist/core/mcp-servers.js`, `dist/extensions/mcp/*`) | Built-in MCP tool names, built-in validation, the order of `session_start` and `resources_discover` | HIGH (primary source) |
| Repo: `bridges/mcp/*`, `domain/mcp-resolution.ts`, `shared/vars.ts`, `platform/pi-api.ts`, `bridges/hooks/*`, `.planning/BACKLOG.md` (MCPSRC-01, ENVLIT-01, MENVX-01) | Dependencies on existing code | HIGH |

## Upstream contract: Claude Code 2.1.287

| # | Behavior | Evidence |
|---|----------|----------|
| U1 | **Server key.** Each plugin server registers as `plugin:<pluginName>:<serverKey>`. In `VCr()` this is ``H=`plugin:${h}:${S}` `` with `h = wx(name, source)`, which returns the plugin name unchanged except for the `@builtin` alias case. | binary `VCr`, `wx`; docs |
| U2 | **Normalization.** `Tn(name) = name.replace(/[^a-zA-Z0-9_-]/g, "_")`. Only `claude.ai ` servers also collapse runs of `_`. So `plugin:my-plugin:db` becomes `plugin_my-plugin_db`. Hyphens are kept. | binary `Tn` |
| U3 | **Tool name.** `qa(server, tool) = "mcp__" + Tn(server) + "__" + Tn(tool)`, giving `mcp__plugin_<p>_<s>__<tool>`. The separator before the tool is a **double** underscore. This name is what hook matchers, permission rules, agent `tools:`, and skill `allowed-tools` use. | binary `qa`, `Hs`, `us` (parser splits on `__`); docs |
| U4 | **Tool search on by default.** `ENABLE_TOOL_SEARCH` takes `true`, `false`, `auto` (the default), or `auto:N`. MCP tools are deferred behind ToolSearch unless the server sets `alwaysLoad: true`, or a tool sets `_meta["anthropic/alwaysLoad"]`. A server-level `alwaysLoad: false` defers every tool. Search is off for a custom `ANTHROPIC_BASE_URL` and for older Vertex models. | docs; binary schema has `alwaysLoad` on stdio, http, sse, and ws |
| U5 | **Expansion pipeline.** `NAn()` runs once per string: first `Vne` replaces `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PROJECT_DIR}` (always, with the project root or cwd, **for any install scope**), and `${CLAUDE_PLUGIN_DATA}`. Next, `opt` replaces `${user_config.KEY}` and throws if the key is unset. Last, `cG` expands environment variables. It runs at **load time on every session**, against the live environment. | binary `NAn`, `Vne`, `opt`, `cG` |
| U6 | **Variable grammar.** The pattern is `/\$\{([A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?)\}/g`. Only `${NAME}` and `${NAME:-default}` are recognized. There is no `$NAME`, no `${NAME-default}`, no `$env:`, no `!`, no `~`, and no escape. A set variable expands to its value, and **an empty string counts as set**, so `:-` does not fall back on empty, unlike POSIX. An unset variable with a default expands to the default text verbatim. An unset variable without a default **stays literal**: `${VAR}` is kept, and the name goes into `missingVars`. | binary `cG` |
| U7 | **Fields.** stdio: `command`, `args`, and every `env` value, except the keys `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` (`LAn = new Set(["CLAUDE_PLUGIN_ROOT","CLAUDE_PLUGIN_DATA"])`). The env is built as `{CLAUDE_PLUGIN_ROOT, CLAUDE_PLUGIN_DATA, ...declared}`, so declared keys win. http/sse/ws: `url` and `headers` (the "remote sink" mode), plus `headersHelper` (special rules, and `${user_config}` is rejected). Nothing else is expanded. The stdio schema has **no `cwd`**. | binary `NAn`, `qSe`; plugins-reference table |
| U8 | **Missing variables.** Claude Code logs ``Missing environment variables in plugin MCP config: X`` and records an `mcp-config-invalid` error that `/plugin` Errors shows. **The server still loads** with the literal text. A remote `url` that is invalid after expansion becomes `configError` with reason `env_missing`, `url_invalid`, or `user_config_missing`, and that server fails. | binary `NAn` tail; docs ("uses the unexpanded `${VAR}` text as-is") |
| U9 | **Credential blanking.** Claude Code's own credentials (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, and so on) always expand to `""`. Toward a remote sink, git/cargo token patterns and `*_BASE_URL` values pointing at Anthropic hosts are blanked too, with a warning. This guard protects Claude's own secrets. | binary `cG`, `Hq`, `J_e`, `eke`, `tke` |
| U10 | **Server schema (2.1.287).** stdio: `{type?, command, args, env, timeout, alwaysLoad, bareElicitationCapability, role}`. http: `{url, headers, headersHelper, oauth{clientId, callbackPort, ...}, timeout, request_timeout_ms, tools, alwaysLoad, discoveryCache, toolPermissions}`. `sse`, `ws`, and the IDE types also exist. | binary zod schemas |

**ENVLIT-01 is now settled:** Claude Code *does* interpolate `${VAR}` in stdio `env` values (U7). By ENVLIT-01's own rule, `literalEnv` stays unused.

## Adapter contract: pi-mcp-adapter 5.0.0

| # | Behavior | Evidence |
|---|----------|----------|
| A1 | **Nine file sources, later wins:** `~/.config/mcp/mcp.json` → `~/.agents/mcp.json` → `~/.agents/mcp/mcp.json` → `<agentDir>/mcp.json` → `<agentDir>/mcp-adapter.json` → opted-in ancestors → `.mcp.json` → `.pi/mcp.json` → `.pi/mcp-adapter.json`. Lower-precedence non-file sources also exist: `pi.mcp` package manifests, `settings.agentPluginPaths`, `claudePlugins`, `imports`, and runtime registrations. `PI_MCP_CONFIG_MODE=exclusive` reads only the global `mcp-adapter.json`, and `--mcp-config` replaces that path. | `docs/configuration.md`; `config.ts::getConfigSources`, `isExclusiveConfigMode` |
| A2 | **Merge is a shallow per-field merge** (`mergeServerMaps`), not "first declarer owns the name". When a later source switches the transport, the earlier transport's fields are dropped. When the `url` changes, inherited auth is dropped. A later partial entry such as `{ "x": { "directTools": true } }` acts as an **override**. | `config.ts:902-960` |
| A3 | **`mcp-adapter.json` is parsed as JSONC** (comments and trailing commas allowed) by `parseJsonWithComments`. Entries pass through untouched, unknown keys included, so the `_piClaudeMarketplace` marker survives and server names are not checked. | `config.ts::readValidatedConfig`, `toServerEntries` |
| A4 | **Pi-format `mcp.json` is translated**, not passed through. The name must match `[A-Za-z0-9_-]+`, `type:"sse"` is skipped, only Pi's fields survive (no `directTools` or `lifecycle`), and every unknown key, **our marker included**, is reported as "ignored" at every startup. | `config.ts::translatePiMcpServer` |
| A5 | **`ServerEntry` fields:** `description`, `command`, `args`, `socket`, `env`, `inheritEnv`, `cwd`, `url`, `caFile`, `headers`, `requestHeadersCommand{command,args,env,timeoutMs}`, `auth` (`oauth`, `bearer`, `false`, or `{provider}`), `bearerToken`, `bearerTokenEnv`, `bearerTokenStore`, `oauth{grantType, clientId, clientSecret, clientMetadataUrl, scope, redirectUri, clientName, clientUri, logoUri, authServerMetadataUrl, skipIssuerMetadataValidation, authorizationParams}`, `lifecycle` (`lazy`, `eager`, `keep-alive`, `lazy-keep-alive`), `idleTimeout`, `requestTimeoutMs`, `exposeResources`, `directTools` (`boolean`, `string[]`, or `"search"`), `toolPrefix` (`server`, `short`, `none`, `mcp`), `includeTools`, `excludeTools`, `searchKeywords`, `approveTools` (`boolean`, `"destructive"`, or `string[]`), `debug`, `trace`, `httpTransport` (`streamable-http` or `sse`), `pluginDataDir`, `literalEnv`, `protocolVersion`, `tasks`, `disabled`. | `types.ts:438-525`; `docs/servers.md` |
| A6 | **What the adapter expands at connect time.** `interpolateEnvVars` replaces `${\w+}`, `$env:\w+`, and `{env:\w+}`; **an unset variable becomes `""`**. There is **no `:-` support**: `${A:-b}` does not match `\w+` and passes through literally. There is **no escape for `${`**. By field: `command` gets env and `~/`. `args` get env and `~/`. `cwd` gets env and `~/`. Each `env` value runs a shell command when it starts with `!`; `!!` stands for a literal `!` (and still interpolates); `literalEnv: true` turns off both behaviors. `headers` support `!` and `!!` plus env. `bearerToken` supports `!` plus env. `url` gets env, and an unset variable **throws** before connecting. `caFile`, `socket`, and `requestHeadersCommand.*` get env. | `utils.ts:136-275`; `server-manager.ts:1115-1145, 1575-1600, 2140-2160` |
| A7 | **Tool name.** `formatToolName(tool, server, mode)` returns `prefix + "_" + tool.replace(/\./g, "_")`. The prefix depends on the mode: `server` (default) uses the sanitized server name, `short` strips `-mcp`, `none` uses no prefix, and `mcp` uses **`mcp__` + server**. So `mcp` mode yields `mcp__<server>_<tool>` with a **single** underscore. Sanitizing keeps `[A-Za-z0-9_-]` and encodes anything else as `_<hex>_`. A per-server `toolPrefix` overrides the global `settings.toolPrefix`. Direct tool names have **no length cap** (Pi's built-in MCP hashes names to fit). | `types.ts:864-905` |
| A8 | **`directTools: "search"`** on Pi ≥0.99 registers Pi **deferred** tools. They are grouped in a namespace named ``mcp__${server.replace(/-/g,"_")}`` (this is the raw name, not `formatServerNamespace`, so a `:` would leak into it). Pi's `tool_search` and `mcp({search})` activate them, and the activation lasts across resume. A per-server value overrides the global `settings.directTools`. | `index.ts:436-460`; `docs/tools.md` |
| A9 | **Status snapshot.** `pi.events.on("pi-mcp-adapter/status/v1", ...)` delivers `{version:1, servers[], totalTools, totalResources, connectedCount, disabledCount}`. Each server has `{name, status: connected/cached/failed/needs-auth/not-connected/blocked/disabled, toolCount, directToolCount, resourceCount?, failedAgoSeconds?, disabled, listenState, catalogStale?, blockedReason?}`. It is **push-only**, with no pull API. The first snapshot comes after initialization and after direct tools are reconciled; an empty snapshot comes at shutdown. Building it never connects a server. `MCP_STATUS_EVENT` is exported from the root, and `./types` is a dist subpath. | `docs/extension-api.md`; `mcp-status.ts`; `types.ts:18-60` |
| A10 | **The adapter writes into the file that owns a server.** A direct-tools toggle in the `/mcp-adapter` panel rewrites `directTools` **in place** in the owning file (`writeDirectToolsConfig`). `/mcp-adapter disable` writes `disabled: true` into the project `.pi/mcp-adapter.json`, editing an existing entry when there is one. Both use tmp+rename and do not lock. | `config.ts:1715-1766, 1961-2000, 1624-1650` |
| A11 | **Project trust.** Servers from project files, `.pi/mcp-adapter.json` included, are blocked in untrusted projects. In trusted interactive sessions they wait for an approval prompt that defaults to "Don't allow". The approval covers the **complete effective definition**, so a changed definition asks again. Headless sessions skip unapproved servers. | `docs/configuration.md#project-server-trust` |
| A12 | **Adapter detection.** The adapter registers a tool named `mcp` at factory time; `disableProxyTool` is ignored while any server uses `"search"`. Pi 1.0's built-in MCP registers `mcp__<server>__<tool>` and the `list_mcp_resources`, `list_mcp_resource_templates`, and `read_mcp_resource` tools with `builtin:` source info, and **never a tool named `mcp`**. The adapter takes over `/mcp` and turns the built-in off (`-builtin:mcp`). | adapter `index.ts:2058`, `pi-builtin-mcp.ts`; Pi `dist/extensions/mcp/index.js`, `tools.js:49` |
| A13 | **Ordering.** Pi 1.0 emits `session_start` **before** `resources_discover`, both at startup and on `/reload` (`agent-session.js:2582-2584, 2928-2930`). The adapter loads its config at factory load (`index.ts:370`) and in the init it starts from `session_start` (`init.ts:149`). Our reconcile runs in `resources_discover`, so whatever it writes reaches the adapter **one reload late**. Confidence is MEDIUM: initialization is asynchronous, but it starts before our handler runs. | Pi and adapter source |

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes / dependency on existing code |
|---------|--------------|------------|--------------------------------------|
| **TS-1 Deliver entries to `<scopeRoot>/mcp-adapter.json`** | Pi-format `mcp.json` drops every adapter field (A4) and warns about our marker at every start. Only the adapter-native file can carry `directTools`, `toolPrefix`, `httpTransport`, and `description`. | MEDIUM | Retarget `persistence/locations.ts` (`mcpJsonPath`, line 203) and the stage/commit/replace/rollback/unstage set in `bridges/mcp/stage.ts` and `unstage.ts`. Change the NFR-10 write set to match (and keep `mcp.json` for the migration window). The read path **must accept JSONC** (A3). Today `readScopedDoc` sees a commented file as malformed and **overwrites it**, and `unstage` throws on it. Keep the top-level `settings`, `imports`, and `claudePlugins` (the current code already spreads `...doc`). |
| **TS-2 Upstream naming `plugin_<plugin>_<server>`** | Claude users see `plugin:<p>:<s>` and `mcp__plugin_<p>_<s>__*` (U1-U3). Today's raw server keys collide easily, which is the MCPSRC-01 failure. | MEDIUM | `generatedName = Tn("plugin:"+plugin+":"+key)`. `StagedMcpRecord.generatedName` stops being the input key (the `types.ts` comment "no rename today" has to change). Detect normalization collisions inside our own namespace: `plugin:a_b:c` and `plugin:a:b_c` both become `plugin_a_b_c`. Fail closed with `McpServerCollisionError`. `info` should list the Claude key, and the generated name is what state stores. Marker-based ownership is unaffected. |
| **TS-3 Tool-search exposure `directTools: "search"`** | This is Claude Code's default (U4), and on Pi ≥0.99 the adapter maps it to Pi deferred tools found by Pi's `tool_search` (A8). | LOW | Stamp it in `stampServers`. Map `alwaysLoad: true` to `directTools: true`, the only per-server opt-out upstream has. Remove `alwaysLoad` and the other Claude-only keys from the written entry, or leave them as harmless extras: the adapter passes unknown keys through. |
| **TS-4 Explicit per-server `toolPrefix: "mcp"`** | Without it, a user's global `settings.toolPrefix: "none"` or `"short"` silently renames our tools (A7). `mcp` is the closest available form to U3. | LOW | Comes with TS-2. See gap G-1: it still produces `mcp__<s>_<tool>`, not `mcp__<s>__<tool>`. |
| **TS-5 Automatic migration on `/reload`** | Existing users have marked entries in `<agentDir>/mcp.json` and `<cwd>/.pi/mcp.json` under the old raw names. NFR-2 means `/reload` has to fix this without a reinstall. | HIGH | Do it in the reconcile path under the state lock, one scope at a time. Write `mcp-adapter.json`, then `state.json` (new `generatedName`/`targetPath`), then remove the entries from `mcp.json`. Each step must be idempotent so a crash in between converges on the next try (NFR-3). Project scope migrates only for the cwd's project; other projects migrate when they are opened. **Ordering (A13):** writes made in `resources_discover` are seen by the adapter only on the next reload. Servers keep working through the old `mcp.json` translation in the meantime, but search exposure arrives one reload later. Either accept that and document it, or run the migration in the extension factory. That needs a phase-level spike. Users who rely only on Pi's built-in MCP lose these servers after migration (see Anti-Features). |
| **TS-6 Variable expansion parity, plus escaping what the adapter would expand again** | Plugins use `${VAR}` and `${VAR:-default}` in `command`, `args`, `env`, `url`, and `headers` (U5-U7). The adapter has no `:-` and expands `!`, `$env:`, `{env:}`, and `~/`, which Claude does not (A6). This closes MENVX-01 and ENVLIT-01. | HIGH | Extend `bridges/mcp/substitute.ts`; leave `shared/vars.ts` alone, since D-92-01 keeps it separate. **Recommended rules (decision needed, see G-2/G-3):** (a) keep install-time `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and project-scope `${CLAUDE_PROJECT_DIR}` substitution. (b) Leave plain `${VAR}` for the adapter to expand at runtime: Claude also expands at load time against the live environment, and this keeps secrets off disk. (c) Rewrite `${VAR:-d}` at install time: if `VAR` is set, write `${VAR}`; if not, write `d`. (d) In `env` and `headers` values, turn a leading `!` into `!!`, which closes MENVX-01 by escaping. (e) Restrict the expansion fields to Claude's set (U7). Today's deep walk also rewrites `cwd`, `oauth`, and other keys Claude never touches. (f) Do not expand the values of `env.CLAUDE_PLUGIN_ROOT` or `env.CLAUDE_PLUGIN_DATA` (`LAn`). |
| **TS-7 Missing-variable warnings at install** | Claude warns `Missing environment variables in plugin MCP config: X` (U8). The adapter silently swaps in `""`, except in `url`, where it throws at connect. | LOW | Report through the existing warning channel used for the malformed-`env` warning in `stampServers`. Check against `process.env` at install time and count a name as missing only when it has no `:-`. |
| **TS-8 Collision walk that follows adapter 5** | Required by MCPSRC-01: nine sources, later wins (A1). A partial entry is an override, not a collision (A2). | MEDIUM | Rewrite `collision-slots.ts`: reorder the frozen tuple, add the two `.agents` paths and both `mcp-adapter.json` files, read with JSONC, and change "first declarer wins" to last-wins attribution. Count a name as a collision only when another source has a **full** definition (`command`, `url`, or `socket`) that we do not own. Our own entries in the other scope's file are not a collision: user plus project scope means one effective server, like upstream. Update the snapshot test and the MC-4/RN-5 contract text in the same change. With TS-2 names, real collisions become rare. |
| **TS-9 Keep user adapter overrides when re-staging** | Writing the adapter-native file means the panel's direct-tools toggle and `/mcp-adapter disable` now edit **our** entries in place (A10). Re-staging on update, reinstall, or enable would silently undo them. | MEDIUM | In `prepareStageMcpServers`, when an owned entry is replaced, carry over a closed set of user-owned fields (`disabled`, `includeTools`, `excludeTools`, `approveTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `searchKeywords`). Carry `directTools` and `toolPrefix` only if they differ from what we last wrote, which means recording our stamped values, for example in the marker. This rule only works if the field set stays closed; see the optional-field silent-omission class. |
| **TS-10 Detection that only the adapter satisfies** | Entries in `mcp-adapter.json` are invisible to Pi's built-in MCP, so the `{pi-mcp-adapter}` soft-dependency marker must stay accurate when only the built-in is active. | LOW | `platform/pi-api.ts::hasLoadedPiMcpAdapter` already qualifies (A12). Add a test that plants built-in-only tools (`mcp__x__y` and `read_mcp_resource` with `builtin:` source) and asserts "not loaded". |
| **TS-11 Dependency floors** | Pi `>=1.0.0`, pi-subagents `>=0.74.0`, pi-mcp-adapter `>=5.0.0`. On Pi 0.84-0.87, adapter 5 does not read Pi's `mcp.json`. The adapter's `pi-ai` peer range stops at `^0.99.0`; record this as an upstream gap. | MEDIUM | Re-apply the typing and canary fixes from features/mcp. These are package and peer-test changes, not bridge logic. |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **D-1 Live adapter status in `/claude:plugin info`** | One view of each plugin MCP server's runtime state (`connected`, `cached`, `failed` with age, `needs-auth`, `blocked` with reason, `disabled`) plus tool counts. No upstream analog was found: Claude shows status in `/mcp`, and `claude plugin details` reports an "inventory and projected token cost". The adapter's own `claudePlugins` loader has nothing like it either. | MEDIUM | Subscribe once in `index.ts` at factory time (A9 is push-only) and cache the latest snapshot in a leaf module with process lifetime, like `shared/completion-cache.ts`. The `info` orchestrator looks up each record's `generatedName` and stamps the status; notify stays a dumb renderer. New status tokens are amendments to the closed catalog. States to render: no snapshot yet (adapter absent or still initializing), snapshot without our server (needs `/reload`, or shadowed), and `blocked` (project trust, A11). Reading the snapshot never touches the network or connects a server, so `info` stays inside the NFR-5 `FORBIDDEN_TARGETS` gate. |
| **D-2 Claude-form tool names in the hooks bridge** | The plugin's own hooks with `mcp__plugin_p_s__tool` matchers fire, and the payload `tool_name` matches upstream, even though the adapter emits `mcp__plugin_p_s_tool` (G-1). | MEDIUM | `domain/components/hook-tool-names.ts::mapPiToClaudeToolName` currently passes MCP names through unchanged. Use the known generated server names from state to map the `mcp__<key>_` prefix to `mcp__<key>__` exactly. This is not a regression, because tool names do not match today either, but TS-2 makes the fix deterministic. |
| **D-3 `description` on each entry** | The adapter ranks `mcp({search})` by server description and shows it in the panel (5.0.0). Using the plugin's manifest description, or "Claude plugin `<p>@<mp>`", improves tool discovery and shows provenance, like Claude's plugin indicator in `/mcp`. | LOW | The resolver already has the manifest. |
| **D-4 Field translation to adapter-native form** | Claude fields the adapter would otherwise ignore start working: `type:"sse"` → `httpTransport:"sse"` (Pi-format files skip SSE entirely, A4); `request_timeout_ms` → `requestTimeoutMs`; `oauth.callbackPort` → `oauth.redirectUri: http://127.0.0.1:<port>/callback`, as the adapter's Pi translation does. `ws` and `headersHelper` have no equivalent and should produce a warning (G-7, G-8). | MEDIUM | A new pure translation step in the bridge. |
| **D-5 PreToolUse parity for proxied MCP calls (future)** | Pi's `tool_call` sees only `mcp` for proxied calls. The adapter's approval broker (`pi-mcp-adapter:tool-approval-request`, with `serverName`, `originalToolName`, `args`, and `origin`) sees every MCP call and can be claimed synchronously. | HIGH | Out of scope for mcp-4. Record it in the backlog. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Deliver through Pi's built-in `pi.registerMcpServer()` | It is native and needs no adapter. | The abandoned `builtin-mcp` milestone. The adapter treats runtime registrations as **proxy-only**: `direct` and `deferred` exposure are ignored, so search exposure is lost. Moving off the adapter regresses its users. | Write `mcp-adapter.json`. |
| Write to both `mcp.json` and `mcp-adapter.json` | It keeps Pi-built-in-only users working. | Two sources for the same name get merged (A2), every startup warns about the marker (A4), and unstage has to clean up twice. It also contradicts the "without adopting Pi's built-in MCP" goal. | Adapter only, with an accurate `{pi-mcp-adapter}` soft-dependency row (TS-10). Document that built-in-only users lose plugin servers after migration. |
| Resolve every `${VAR}` at install time with Claude's rules | It looks like the most literal reading of "expand with Claude Code's rules". | It **writes secrets to disk** (`Authorization: Bearer ${API_KEY}` would land in plain text in `mcp-adapter.json`). It freezes values Claude reads fresh every session, and setting a variable after install does nothing until reinstall. It also needs `literalEnv: true` to keep `env` literal, and `args`, `headers`, and `url` have no escape for `${` anyway (G-3). | Hand plain `${VAR}` to the adapter's runtime expansion, and resolve at install time only the `${VAR:-default}` form the adapter cannot express (TS-6). |
| `literalEnv: true` on every entry | It looks like an easy fix for the adapter's `!` execution. | Claude does interpolate `env` (U7). This would stop `${VAR}` expansion in `env`, the exact regression ENVLIT-01 warns about. | Escape `!` as `!!` (TS-6d) and close ENVLIT-01 with no change. |
| Emulate `:-` at runtime with `!printf '%s' "${VAR:-d}"` | It gives true runtime default semantics. | It is shell-dependent, breaks on Windows, runs a process per connection, works only in `env` and `headers`, and has a 10-second timeout. | Rewrite at install time (TS-6c). |
| Name servers `plugin_<p>_<s>_` (trailing underscore) so that `mcp` mode yields `mcp__plugin_p_s__tool` exactly | It gives exact upstream tool names today with no upstream change. | It depends on an undocumented `formatToolName` quirk the adapter could change. The trailing `_` shows up on every adapter surface (panel, `/mcp-adapter enable`, status names, the `mcp:` references in pi-subagents, the `mcp__plugin_p_s_` namespace). | D-2 now, plus an upstream adapter request for a `__` separator mode. **This is a user decision**; see G-1. |
| Pre-approve project servers (write adapter approvals, or set `projectServers: "allow"`) | It avoids the trust prompt after each update. | It bypasses a security gate the adapter owns, writes outside the NFR-10 set, and only user-global config may set `projectServers`. | Document the prompt (G-10). |
| Poll or connect servers to get status for `info` | It gives fresher data. | It breaks the network-free `info` guarantee (NFR-5) and the adapter's lazy model. | Use only the cached push snapshot (D-1). |
| Import the adapter's `./config` (`getServerProvenance`) at runtime for collision provenance | It removes path drift for good (an idea from MCPSRC-01). | It turns an optional peer into a real runtime dependency. Packaging a dist subpath is a scope decision. | Keep our own walk (TS-8). Revisit only if the precedence list drifts again. |

## Parity Gaps: where the adapter cannot express Claude Code behavior

| ID | Gap | Impact | Disposition |
|----|-----|--------|-------------|
| **G-1** | **Tool-name separator.** In `mcp` mode the adapter produces `mcp__<server>_<tool>`; Claude produces `mcp__<server>__<tool>` (A7 vs U3). No adapter mode yields `__` from a clean server name. | **High.** Plugin hook matchers on their own MCP tools never fire. `tool_name` in hook payloads differs. Skill and agent text that names `mcp__plugin_x_y__tool` refers to a tool that does not exist under that name: the model has to find it through search, and the adapter's fuzzy proxy lookup may or may not resolve it (unverified). Agent `tools:` entries in that form are dropped by the agents bridge. | **Decision needed.** Recommended: clean key + D-2 + an upstream request (`toolPrefix` mode or a `__` separator). Alternative: the trailing-underscore key (see Anti-Features). |
| G-2 | **No `${VAR:-default}`** at adapter runtime (A6). | The default is picked at install time and kept until reinstall or update. If `VAR` is set at install but unset at runtime, the result is `""`, not the default. | Install-time rewrite (TS-6c). Document it. |
| G-3 | **Unset `${VAR}` becomes `""`, not literal**, and nothing can escape `${` in `command`, `args`, `cwd`, `url`, or `headers`. Only `env` can opt out, through `literalEnv`. | A literal `${X}` argument differs; that is almost always an authoring bug upstream too. For `url`, both sides fail the server. | Install-time warning (TS-7). Document it. |
| G-4 | **Syntax the adapter adds:** `$env:VAR`, `{env:VAR}`, `~/` in `command`, `args`, and `cwd`, and a leading `!` in `env`, `headers`, and `bearerToken`. | Rare in plugin manifests, but the values differ from Claude's. | Escape `!` as `!!`. The others cannot be escaped; document them. |
| G-5 | **No credential blanking** (U9). | A Pi provider key in `process.env` could be expanded into a plugin server's `url` or `headers`. Claude blanks its own keys. | Document it. Mirroring Pi provider keys is a possible follow-up. |
| G-6 | **Per-tool `_meta["anthropic/alwaysLoad"]`** | No per-tool equivalent of "always load" exists in config; `directTools: string[]` needs the tool names ahead of time. | Those tools stay deferred. Document it. |
| G-7 | **`headersHelper` ≠ `requestHeadersCommand`.** Claude runs a shell helper that returns headers per connection; the adapter runs an executable per request with a JSON envelope on stdin. | Plugins using `headersHelper` lose dynamic auth. | Warn, and do not translate (D-4). |
| G-8 | **No `ws` transport.** `sse` works only through `httpTransport`. | `ws` servers cannot run. | Warn (D-4). |
| G-9 | **Lifecycle.** Claude connects plugin servers at session start and keeps them for the session. The adapter defaults to `lazy` with a 10-minute idle shutdown, which loses server-side state. | Stateful servers (browsers, database sessions) reset after idle time. | **Ask the user.** `keep-alive` is closest to upstream (it reconnects remote servers, as Claude does); the adapter's default favors memory. Leaving `lifecycle` unset diverges silently. |
| G-10 | **Project trust re-prompts** (A11). The approval is tied to the full definition, and `pluginRoot` paths change on every update. | Each project-scope plugin update prompts again ("Don't allow" is the default), and headless sessions skip the server. | This already happens with `.pi/mcp.json`. Document it. |
| G-11 | **Tool names over 64 characters** are not truncated by the adapter (A7). | Long `mcp__plugin_<long>_<long>_<tool>` names may be rejected by providers. Claude Code's truncation behavior is unknown. | Warn at stage time when name length plus the known prefix is over 64? Research during the phase. |
| G-12 | **User-scope `${CLAUDE_PROJECT_DIR}`.** Claude resolves it for every scope (U5). We leave it literal (MENV-03/T-92-06), and the adapter then expands the literal to `""`, because `CLAUDE_PROJECT_DIR` is not in `process.env`. | The value is empty, not literal. The decision record assumed it stays literal. | Re-check T-92-06 against A6. Either note it or set the variable for MCP spawns only, which the adapter's `env` allows through the declared-wins merge. |
| G-13 | **Same-reload visibility** (A13). | Entries that migration or reconcile installs are seen by the adapter on the second reload. | Spike during the phase. Document if accepted. |

## Feature Dependencies

```
TS-11 Dependency floors (Pi 1.0 / adapter 5)
    └──enables──> TS-3 search = Pi deferred tools (Pi ≥0.99 only)
                  TS-10 detection test (Pi 1.0 built-in shape)

TS-1 mcp-adapter.json delivery (JSONC-safe read, new NFR-10 write set)
    ├──requires──> TS-8 collision walk (must include mcp-adapter.json files)
    ├──requires──> TS-2 naming (+ TS-4 toolPrefix)
    │                  └──enables──> D-2 hooks Claude-form mapping
    │                  └──enables──> D-1 info status (snapshot keyed by generated name)
    ├──requires──> TS-6 expansion/escaping (+ TS-7 warnings)
    ├──requires──> TS-3 directTools search
    └──requires──> TS-9 override preservation (panel now edits our file)

TS-5 Auto migration ──requires──> TS-1, TS-2, TS-6 (re-stage under new rules)

D-3 description, D-4 field translation ──enhance──> TS-1
```

### Dependency Notes

- **TS-1 requires TS-8:** a stage into `mcp-adapter.json` that skips the adapter-file sources in its collision walk would miss the highest-precedence slots: `.pi/mcp-adapter.json` and the global `mcp-adapter.json`.
- **TS-5 requires TS-1, TS-2, and TS-6:** migration has to write the final shape once. Re-staging from the recorded plugin root (offline, NFR-5-safe for cached sources) reuses one code path. Fall back to transforming the entry in place when the source is gone.
- **TS-9 conflicts with naive re-stage:** `prepareStageMcpServers` replaces every owned entry outright ("replace ours with stamped"), so that branch has to merge the carried fields.
- **D-1 depends on the factory-time subscription:** the snapshot is push-only, so subscribing late means waiting for the next status change.
- **The ENVDOC-01 doc drift is now worse:** `docs/env-vars.md` §"MCP runtime env inheritance" says the adapter does not interpolate `command` or `args`. In 5.0.0 it does both, and it expands `~/` (A6). Rewrite that section together with TS-6.

## MVP Definition

### Launch With (mcp-4)

- [ ] TS-11 Floors: every later step depends on the Pi 1.0 deferred-tool path
- [ ] TS-1 + TS-8: delivery and a correct collision walk, including the JSONC-safe read
- [ ] TS-2 + TS-4 + TS-3: upstream naming and tool-search exposure, the core of the milestone
- [ ] TS-6 + TS-7: expansion parity, escaping, and warnings (closes MENVX-01 and ENVLIT-01)
- [ ] TS-9: otherwise the panel's own controls stop holding
- [ ] TS-5: existing installs converge on `/reload` (NFR-2)
- [ ] TS-10: pin the detection behavior
- [ ] D-1: live status in `info`, a stated milestone target

### Add After Validation

- [ ] D-2 Hooks Claude-form mapping: add it once G-1 is decided. It is cheap if the clean-key option wins.
- [ ] D-3 Server `description`: a trivial ranking improvement
- [ ] D-4 Field translation (`sse`, timeouts, oauth callback): add it when a real plugin needs it

### Future Consideration

- [ ] D-5 PreToolUse via the approval broker: a separate hooks milestone
- [ ] An upstream adapter request for a `__` tool separator mode (G-1), and for `:-` support (G-2)
- [ ] Mirroring credential blanking for Pi provider keys (G-5)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-1 adapter-file delivery | HIGH | MEDIUM | P1 |
| TS-2/TS-4 naming + prefix | HIGH | MEDIUM | P1 |
| TS-3 search exposure | HIGH | LOW | P1 |
| TS-5 auto migration | HIGH | HIGH | P1 |
| TS-6/TS-7 expansion + warnings | HIGH | HIGH | P1 |
| TS-8 collision walk | MEDIUM | MEDIUM | P1 |
| TS-9 override preservation | MEDIUM | MEDIUM | P1 |
| TS-10 detection pin | MEDIUM | LOW | P1 |
| TS-11 floors | HIGH | MEDIUM | P1 |
| D-1 live status in info | MEDIUM | MEDIUM | P1 (stated target) |
| D-2 hooks name mapping | MEDIUM | MEDIUM | P2 |
| D-3 description | LOW | LOW | P2 |
| D-4 field translation | LOW | MEDIUM | P3 |
| D-5 broker PreToolUse | MEDIUM | HIGH | P3 |

## Competitor Feature Analysis

| Feature | pi-mcp-adapter `claudePlugins` loader (5.0.0) | Pi 1.0 built-in MCP | `@nklisch/pi-plugins` | Our approach (mcp-4) |
|---------|-----------------------------------------------|---------------------|-----------------------|----------------------|
| Plugin discovery | Explicit local paths only; reads only the root `.mcp.json` | None | Marketplaces, with a forked adapter | Marketplace install with lifecycle |
| Server names | As written (no plugin namespace) | n/a | Not verified | `plugin_<p>_<s>` (U1/U2) |
| Tool names | `<server>_<tool>` (default prefix) | `mcp__<server>__<tool>` (Claude form) | Not verified | `mcp__plugin_<p>_<s>_<tool>`, plus D-2 mapping |
| Variables | `${CLAUDE_PLUGIN_ROOT}` only | Pi's own | Has `${user_config}` | ROOT/DATA/PROJECT_DIR plus `${VAR}`/`:-` parity (TS-6) |
| Tool search | Global setting | `exposure: deferred` | Not verified | `directTools: "search"` per server |
| Runtime status | `/mcp-adapter` panel | `/mcp` | `doctor`/`status` | Per-plugin rows in `info` (D-1) |

The built-in MCP is the only one that reaches Claude-form tool names. It loses on lazy start, proxy, and UI features, and leaving the adapter would regress users. So G-1 stays open, and the fix belongs on the adapter side.

## Sources

- Claude Code 2.1.287 binary, functions grepped on 2026-10-01: `VCr`, `wx`, `Tn`, `qa`, `Hs`, `us`, `NAn`, `Vne`, `opt`, `cG`, `Hq`, `qSe`/`LAn`, and the stdio/http zod schemas
- https://code.claude.com/docs/en/mcp (tool search, expansion fields, the unset-variable rule, plugin tool naming)
- https://code.claude.com/docs/en/plugins-reference (the "Where each variable resolves" table, `mcpServers` shapes, `userConfig`)
- pi-mcp-adapter 5.0.0: `docs/configuration.md`, `docs/servers.md`, `docs/tools.md`, `docs/extension-api.md`, `CHANGELOG.md` [5.0.0], `types.ts`, `config.ts`, `utils.ts`, `server-manager.ts`, `direct-tool-surface.ts`, `index.ts`, `mcp-status.ts`, `claude-plugin-loader.ts`, `pi-builtin-mcp.ts`, `package.json`
- @earendil-works/pi-coding-agent 1.0.0: `dist/core/agent-session.js` (event order), `dist/core/mcp-servers.js` (validation), `dist/extensions/mcp/{index,tools,resources}.js`
- Repo: `.planning/BACKLOG.md` MCPSRC-01, ENVLIT-01, MENVX-01, ENVDOC-01; `bridges/mcp/*`; `platform/pi-api.ts`; `domain/components/hook-tool-names.ts`; `docs/env-vars.md`

---
*Feature research for: Claude plugin MCP delivery via pi-mcp-adapter 5 (mcp-4)*
*Researched: 2026-10-01*
