# Stack Research

**Domain:** Pi extension that bridges Claude plugin MCP servers into either pi-mcp-adapter or Pi's built-in MCP (milestone mcp-builtin)
**Researched:** 2026-11-04
**Confidence:** HIGH for Pi 1.5.0 and pi-mcp-adapter 7.0.0 facts (read from the published tarballs); MEDIUM for handler-ordering conclusions; LOW only where marked

All package citations below refer to files inside the published npm tarballs, unpacked as data (never executed) under the session scratchpad. Path prefixes:

- `pca@1.5.0/` = `@earendil-works/pi-coding-agent@1.5.0` (published 2026-11-02)
- `pca@1.4.0/` = the installed `node_modules/@earendil-works/pi-coding-agent` (1.4.0, published 2026-10-21)
- `adapter@7.0.0/` = `pi-mcp-adapter@7.0.0` (published 2026-10-26; still `latest` on npm)
- `subagents@0.84.0/` = `pi-subagents@0.84.0` (still `latest` on npm)

## Bottom line

1. **No new runtime or dev dependency is needed.** Built-in MCP is driven entirely through the Pi peer's `ExtensionAPI` (`registerMcpServer` / `unregisterMcpServer` / `getMcpServers`, `getCommands`, `getAllTools`, `ctx.isProjectTrusted()`). Do NOT add an MCP SDK; Pi's built-in client (`@earendil-works/pi-mcp`, a transitive dep of the peer) does the connecting.
2. **The Pi 1.5.0 bump is a small, mechanical phase.** The built-in MCP extension (`dist/extensions/mcp/index.js`), its runtime, config, tools, the registry loader and `runner.js` are byte-identical between 1.4.0 and 1.5.0 (diffed). The MCP API exists in 1.4.0 too. What 1.5.0 changes for this repo is: the `clientRegistration: "auto"` value, the `isProjectTrusted()` saved-"no" fix, `createReadTool()`'s return type, pi-ai no longer re-exporting TypeBox, and the version pins in five repo files.
3. **pi-subagents 0.84.0 (the current floor) already resolves `mcp:` selectors against Pi's built-in MCP when the adapter is absent.** The agent-grant form stays `mcp:<server>[/<tool>]` for both implementations; only the server name differs. But servers added with `pi.registerMcpServer()` work only in **background** (`async: true`) children (subagents@0.84.0 `docs/agents.md:573`). No companion version bump is required.
4. **Two findings contradict or constrain the brief and need a user decision** (detailed in "Open problems the roadmap must carry"):
   - `piBuiltinMcpHandledVersion` does **not** prove the adapter wrote `-builtin:mcp`. The adapter records it also when it found an existing entry, and `pi config` writes the identical string.
   - Removing `-builtin:mcp` cannot activate built-in MCP in the session that removes it. Pi resolves built-in extensions before any extension loads, and an extension event handler cannot trigger a reload. The first session after the adapter is uninstalled has no MCP.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@earendil-works/pi-coding-agent` | dev `^1.5.0`, peer `>=1.5.0` | Pi host API, and the built-in MCP implementation itself (`builtin:mcp`) | The milestone target (brief). 1.5.0 adds `clientRegistration: "auto"` (`pca@1.5.0/dist/core/mcp-servers.d.ts:79-85`) and fixes `ctx.isProjectTrusted()` ignoring a saved "Do not trust" (`pca@1.5.0/CHANGELOG.md`, 1.5.0 Fixed, #10947). That fix is what makes the project-trust gate on project-scope registrations meaningful. |
| `@earendil-works/pi-ai` | exact `1.5.0` | Faux provider for the cucumber scripted model (`features/lib/scripted-model/extension.ts:18-32`) | Keep it exact: pca@1.5.0 depends on `@earendil-works/pi-ai` `1.5.0` exactly, so npm dedupes to one copy and the faux provider registers into the same pi-ai module instance that Pi uses. `providers/faux.d.ts` is identical between 1.4.0 and 1.5.0 (diffed). |
| `@earendil-works/pi-tui` | dev `^1.5.0`, peer `*` (unchanged) | Autocomplete types, browse TUI | 1.5.0 is additive only: it adds `getSelectPageIndex` and `replaceControlCharacters` to `dist/index.d.ts` (diffed); `autocomplete.d.ts` is identical. |

### Optional peers (PIFL-02/PIFL-03: never `dependencies`, `devDependencies`, or lockfile packages). No range change.

| Peer | Range (unchanged) | Floor the test cache installs | Relevance to this milestone |
|------|-------------------|-------------------------------|-----------------------------|
| `pi-mcp-adapter` | `>=7.0.0 <8` | 7.0.0 (latest on npm) | Detected implementation "adapter". It registers both `/mcp-adapter` and `/mcp` (`adapter@7.0.0/index.ts:2264-2266`), so Pi drops `builtin:mcp` from the session (`pca@1.5.0/dist/core/resource-loader.js:85-115`). It handles `mcp_servers_change` (`index.ts:1404-1410`), so it would connect our registrations as proxy-only servers. Never register while it is active. |
| `pi-subagents` | `>=0.84.0` | 0.84.0 (latest) | Already supports built-in MCP `mcp:` selectors (`subagents@0.84.0/CHANGELOG.md:507`, `docs/agents.md:450,573`) and treats `-` and `_` in server names as the same (`CHANGELOG.md:440,480`). Peer ranges `@earendil-works/pi-coding-agent: *`, `pi-ai: >=1.2.0` admit Pi 1.5.0. |
| `@quintinshaw/pi-dynamic-workflows` | `>=3.15.0 <4` | 3.15.0 (latest) | Not touched. Its peer `pi-coding-agent >=0.80.8` admits 1.5.0. |

### Supporting Libraries

No new library. Existing ones cover the new work:

| Library | Version | Purpose in this milestone | When to Use |
|---------|---------|---------------------------|-------------|
| `proper-lockfile` | `^4.1.2` (existing) | Take Pi's own advisory lock on `<agentDir>/settings.json` before removing `-builtin:mcp` (decision 1) | Only in the settings-cleanup step. Pi locks that file with `lockfile.lockSync(path, { realpath: false })` and retries 10 x 20 ms on `ELOCKED` (`pca@1.5.0/dist/core/settings-manager.js:126-149`). Our lock must use the same file and `realpath: false`, and retry briefly. The current chokepoint uses `retries: 0`. |
| `write-file-atomic` via `shared/atomic-json.ts` | `^8.0.0` (existing) | Atomic rewrite of `settings.json` (NFR-1) | Serialize as Pi does, `JSON.stringify(settings, null, 2)` (`settings-manager.js:449-470`), and change only the `extensions` array. |
| `typebox` | `^1.3.34` (existing) | Schema for the recorded Claude-shaped server form and for the `McpServerConfig` the built-in materializer emits | Inside Pi, an extension's `typebox` import is aliased to Pi's own copy, 1.3.27 (`pca@1.5.0/dist/core/extensions/loader.js:42-44,80-82`). This is unchanged from 1.4.0. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@cucumber/cucumber` `^13.3.0` (existing) | `@adapter` / `@builtin` profiles | `cucumber.json` has only `default`. Add one profile per implementation that selects on tags. No new tool is needed. |
| Pi CLI `--no-mcp` | Simulates the "none" implementation in the harness | It sets `disabledBuiltinExtensions: ["mcp"]` (`pca@1.5.0/dist/main.js:644`, `dist/cli/args.js:163-164,321`). That is cleaner than writing `-builtin:mcp` into the sandbox settings. |
| RPC `get_commands` `sourceInfo.path` | Harness assertion that `/mcp` is `builtin:mcp` | `test/e2e/_rpc.ts:494-523` (`listedCommands`) already extracts `sourceInfo.path`. |

## What changes from 1.4.0 to 1.5.0 that touches this repo

| Change | Evidence | Repo impact | Action |
|--------|----------|-------------|--------|
| Peer/dev pins | — | `package.json:19-21,61`; `package-lock.json` | Set dev `^1.5.0` (coding-agent, tui) and exact `1.5.0` (pi-ai); set the peer floor to `>=1.5.0`; regenerate the lock. The scratch resolve gives pi-agent-core, pi-ai, pi-codemode, pi-mcp, pi-telemetry, pi-tui all 1.5.0, plus a new **`@earendil-works/pi-schema` 1.5.0** (dep of pi-ai and pi-agent-core). pi-ai no longer nests a `typebox`. |
| Floor gate tests | `test/architecture/peer-floor.test.ts:38-47,74-90` | They assert `>=1.4.0`, `^1.4.0`, `1.4.0` | Update the literals and test titles (FLOOR-01, VER-01). |
| e2e peer-floor fixture | `test/e2e/pi-peer-floor/package.json:6` (+ its `package-lock.json`); `test/e2e/pi-json-output.test.ts:39,41`; CI runs `npm --prefix test/e2e/pi-peer-floor ci` (`.github/workflows/ci.yml:197`, `e2e-nightly.yml:36`) | Pinned to 1.4.0 | Pin to `1.5.0`, regenerate the fixture lock, update both asserts. |
| Tool-argument validation moved to `@earendil-works/pi-schema` (breaking) | `pca@1.5.0/CHANGELOG.md` 1.5.0 Breaking | The extension registers tools (`edge/handlers/tools.ts`). The brief verified it uses no `Type.Refine`/`BigInt`/`Undefined`/codecs. | None. Validation messages the model sees change wording. A cucumber or e2e expectation that quotes a TypeBox validation message would break, so grep for "must have required properties" during the bump. |
| pi-ai root no longer re-exports `Type`/`Static`/`TSchema` | diff of `pi-ai/dist/index.d.ts`: `export { Type } from "typebox"` removed | The repo imports only `AssistantMessage`, `Message`, `Tool` types from the pi-ai root | None. Inside Pi, extensions get an "extension view" that still provides them (`loader.js:56-60`). |
| `createReadTool()` returns `TypeBoxAgentTool<typeof readSchema>` instead of `AgentTool<…>` | `pca@1.5.0/dist/core/tools/read.d.ts:53`; `dist/core/tools/tool-definition-wrapper.d.ts:9-12` | `platform/pi-api.ts:296-307` (`readToolReturns`) | Likely none: `execute(toolCallId, params, …)` keeps its shape. Confirm with `tsc`. |
| `oauth.clientRegistration` gains `"auto"` (now the default) | `mcp-servers.d.ts:79-85` (1.4.0 had `"dcr" | "cimd"`, default `dcr`) | A built-in translation that emits `oauth` | Omit `clientRegistration` and let Pi's default apply, unless the Claude config forces one. |
| OAuth metadata URLs that are not http/https are rejected | CHANGELOG 1.5.0 Fixed | Security only | None. |
| `isProjectTrusted()` honors a saved "Do not trust" for projects without protected resources | CHANGELOG 1.5.0 Fixed (#10947); trust resolution `pca@1.5.0/dist/main.js:603-607` | The project-scope registration gate | See the trust caveat under the API surface. |
| `ToolRenderContext`/`MessageRenderOptions`/`EntryRenderOptions` extend a new `KeybindingHints`; `SourceInfo` gains `changelogPath?` | diff of `core/extensions/types.d.ts`, `core/source-info.d.ts:10` | No direct use | None. |
| Extension changelogs after update | `pca@1.5.0/docs/packages.md:80-98` | The package ships `CHANGELOG.md` with `## [x.y.z] - date` headings (`CHANGELOG.md:5`), the format Pi parses | Free feature, no action. `pi.changelogPath` is optional. |
| Comments naming 1.4.0 | `bridges/skills/frontmatter-scan.ts:17`; `demos/browse-demo.ts:83` (demo data) | `utils/frontmatter.js` is byte-identical in 1.5.0 | Update the comment's version wording or leave it. Not behavioral. |

## Built-in MCP API surface (Pi 1.5.0, identical in 1.4.0 unless noted)

### Registration

```ts
// pca@1.5.0/dist/core/extensions/types.d.ts:1411-1415
registerMcpServer(name: string, config: McpServerConfig): void;
unregisterMcpServer(name: string): void;
getMcpServers(): RegisteredMcpServer[];   // { name, config, extensionPath } (mcp-servers.d.ts:125-130)
```

The `McpServerConfig` union is defined in `pca@1.5.0/dist/core/mcp-servers.d.ts:24-114`:

- Base fields (`:25-44`): `exposure?: "codemode" | "deferred" | "direct" | "hidden"` (default `codemode`; `codemode-deferred` is an alias), `description?`, `toolExposure?: Record<string, McpExposure>` (exact names or `*` patterns), `enabled?`, and `timeout?` **in seconds** (default 60; progress notifications reset it).
- Stdio (`:45-53`): `type?: "stdio"`, `command`, `args?`, `env?`, `cwd?`. A relative `cwd` resolves against the session cwd. `~/` expands in `command`, `args` and `cwd` (`dist/extensions/mcp/runtime.js:39-68`).
- HTTP (`:100-113`): `type?: "http"` (`"streamable-http"` also accepted), `url`, `headers?`, `oauth?: { clientId?, clientSecret?, callbackPort?, callbackUrl?, scope?, clientName?, clientRegistration?: "auto"|"dcr"|"cimd", authServerMetadataUrl? }` (`:55-92`), and `auth?: { provider }`, a Pi login token (no Claude equivalent; do not emit).
- `type: "sse"` is rejected (`dist/core/mcp-servers.js:178-179`). There is no `headersHelper`, prompts, sampling or elicitation (docs/mcp.md has no such fields; the brief verified this).

Validation (`dist/core/mcp-servers.js:151-211`, called from `dist/core/extensions/loader.js:380-398`):

- The name must match `/^[A-Za-z0-9_-]+$/` (`mcp-servers.js:58`). Otherwise registration **throws**.
- `url` must parse as http/https **before** registration (`:180-183`). Built-in does not expand `${VAR}` inside `url`.
- It throws when another extension registered the name (`loader.js:386-389`), or when a registered name differs only in `-` versus `_` (`:390-395`; namespace = `mcp__` + name with `-`→`_`, `mcp-servers.js:60-62`).
- Unknown keys (such as `alwaysLoad`) pass validation and are ignored. Strip them anyway, so the registration has a stable `JSON.stringify` shape: the built-in re-connects on any config string change (`dist/extensions/mcp/index.js:1084-1087`).

Lifecycle and timing:

- Registrations are per session and never saved. Register again on every load (`docs/extensions.md:2789`).
- The built-in reads `pi.getMcpServers()` in its own `session_start` (`mcp/index.js:971-985`). It starts each session with an **aborted** controller (`:224-225`, "registrations before that are read on session_start"), so a registration made before its `session_start` runs is not connected twice.
- Built-in extensions load after disk extensions (`resource-loader.js:547-562`). Our `session_start` therefore most likely runs first. If it runs later, the registration triggers `mcp_servers_change` and connects at once (`runner.js:244-247`; `mcp/index.js:1078-1113`). **Both orders are safe** (MEDIUM: the ordering itself was inferred, not traced end to end).
- After `session_start` is emitted, Pi calls `reportUnhandledMcpServers()` (`pca@1.5.0/dist/core/agent-session.js:2698-2699`, and `:3047` on reload). When no extension handles `mcp_servers_change`, it emits an extension error per registration: `MCP server "<name>" is registered, but no loaded extension connects MCP servers…` (`runner.js:503-519`). This is the "none" failure mode: never register when the active implementation is not builtin.
- An `mcp.json` server whose namespace matches wins over the registration, and `/mcp` lists the override (`mcp/index.js:247-262`). A leftover plugin entry in `~/.pi/agent/mcp.json` or `.pi/mcp.json` (for example from a stopped AMIG-01 move) would silently shadow the registration.

### Values Pi interprets in a registration (translation-critical)

Values are resolved by `pca@1.5.0/dist/core/resolve-config-value.js:21-69,199-240`, called for `env` values, `headers` and `oauth.clientSecret` only (`mcp/runtime.js:51-68,157`):

- `${NAME}` and **bare `$NAME`** expand from `process.env`. A missing variable makes the whole value undefined, so the connection fails (`resolveTemplate`, `:93-106`; `resolveConfigValueOrThrow`, `:199`).
- `${VAR:-default}` is **not** supported: the name fails `/^[A-Za-z_][A-Za-z0-9_]*$/` and the text stays literal (`:42-49`).
- `$$` is a literal `$` and `$!` a literal `!` (`:32-35`).
- A value that **starts with `!` runs as a shell command** (`:66-68`).
- `command`, `args` and `url` get no variable expansion at all.

Consequence: the builtin materializer must fully expand Claude's `${VAR}`/`${VAR:-default}` itself (in `command`, `args`, `env`, `url`, `headers`, as Claude Code does), then **escape** every remaining `$` as `$$` and a leading `!` as `$!` in `env`/`headers`. Otherwise a plugin value such as `"!rm …"` or `"price$5"` behaves differently than in Claude Code, and the first case is a command-injection vector.

### Naming

- Tool name: `mcp__<server>__<tool>`, with every character outside `[A-Za-z0-9_]` replaced by `_` (`dist/extensions/mcp/tools.js:45-46`).
- **Names over 64 characters are cut and given an `_<8-hex sha256>` suffix** (`tools.js:29,47-50`). `mcp__plugin_<plugin>_<server>__<tool>` passes 64 characters for ordinary names. Those tools get names that hook matchers and grant writers cannot predict without the hash rule. Reproduce the rule in the builtin naming module, and record the divergence beside the `-`→`_` one.
- Repo names allow more than Pi does: `domain/name.ts` admits printable ASCII (`:176`), while Pi server names allow only `[A-Za-z0-9_-]`. A plugin or server name containing `.` or another character yields an invalid `plugin_<plugin>_<server>` registration name. It needs either a builtin "blocked" verdict or a sanitizing rule with a collision check.

### Exposure (decision 2)

- `deferred`: declared to the model only after `tool_search` loads it, and Pi activates `tool_search` for it (`docs/mcp.md:193-206`).
- `direct`: declared at once, and the first prompt waits up to 10 s for such servers (`docs/mcp.md:100`; `mcp/index.js:1009-1030`). Map `alwaysLoad: true` to `direct`.

### Status reader for `info` (builtin)

Pi 1.5.0 exposes **no** connection-state accessor and no event-bus status channel for the built-in. `pi.events` is never used in `dist/extensions/mcp/*.js` (grepped). `getMcpServers()` returns registrations only. What is observable:

- `pi.getAllTools(): ToolInfo[]` (`types.d.ts:1307,1600-1605`) carries `name`, `exposure`, `namespace` (`{ name: "mcp__<ns>", aliases: [server] }`, set by `mcp/index.js:283-293`) and `sourceInfo` (`{ path: "builtin:mcp", source: "builtin" }` for built-in MCP tools, `docs/extensions.md:1907-1918`).
- Tools appear only after the server connects. Tools a server withdraws, and tools of a disabled server, are re-registered with `exposure: "hidden"` (`mcp/index.js:338-354`).

Recommended reader: registered by us (from `getMcpServers()`, name match) + connected with N tools (non-hidden `builtin:mcp` tools whose `namespace.name === mcpNamespace(name)`) + otherwise "not connected" (which covers connecting, failed and needs sign-in, which cannot be told apart). Read it at command time, not at `session_start`, because connections run in the background (`docs/mcp.md:100`).

### Detecting the active implementation (at `session_start`)

- `getCommands(): SlashCommandInfo[]` (`types.d.ts:1316`), with `SlashCommandInfo = { name, description?, source: "extension"|"prompt"|"skill", sourceInfo: SourceInfo }` (`dist/core/slash-commands.d.ts:2-8`) and `SourceInfo = { path, source, scope, origin, baseDir?, changelogPath? }` (`dist/core/source-info.d.ts:4-11`).
- Built-in: an entry with `source === "extension"`, `name === "mcp"`, and `sourceInfo.path === "builtin:mcp"` (`sourceInfo.source === "builtin"`). Synthetic paths get `source: "builtin"` (`dist/core/source-info.js:14-16`; `dist/core/extensions/loader.js:498-504`). Command entries copy `command.sourceInfo` (`agent-session.js:2761-2767`).
- Adapter: unchanged ADET-02 probe (`platform/pi-api.ts:214-265`).
- Precedence: adapter first. When the adapter is loaded, built-in is absent from the session anyway (`resource-loader.js:85-115`, which warns "Extension … registers command `/mcp`, so built-in extension `mcp` was not loaded").

### Built-in enablement in settings

- `extensions` entries `builtin:mcp`, `builtin:llama.cpp`, `builtin:codemode`, `builtin:tool-search` load by default; `-builtin:mcp` disables one (`pca@1.5.0/docs/settings.md:164`).
- A `+`/`-`/`!` entry in **project** `.pi/settings.json` overrides the user setting (`dist/core/package-manager.js:764-770`). So removing the user line does not enable built-in MCP when the project says `-builtin:mcp`. The `session_start` detection covers that case.
- Pi resolves this during resource loading, before extension factories run. `/reload` re-reads settings and re-resolves (`agent-session.js:3016-3028`). `reload()` exists only on `ExtensionCommandContext` (`types.d.ts:305,341`), not on the event-handler context.
- `pi config` disables built-in MCP by writing `-builtin:mcp`, the same string the adapter writes (`dist/modes/interactive/components/config-selector.js:420`).

### Project trust

- `ctx.isProjectTrusted(): boolean` (`types.d.ts:257`).
- Resolution order: `cached ?? --approve/--no-approve ?? trust.json ?? !hasTrustRequiringResources` (`dist/main.js:607`). A project whose `.pi/` holds none of Pi's protected entries (`settings.json`, `mcp.json`, `extensions`, `skills`, `prompts`, `themes`, `SYSTEM.md`, `APPEND_SYSTEM.md`, or an ancestor `.agents/skills`; `dist/core/trust-manager.js:150-175`, `docs/security.md:35-45`) is **auto-trusted**.
- `.pi/pi-claude-marketplace/` and `.pi/agents/` are not protected entries. A cloned repo that commits a project `state.json` and plugin clone could therefore have its stdio commands launched by our registration with no trust prompt. `isProjectTrusted()` alone is a weak gate. Flag this for the PITFALLS/architecture owners.

## pi-mcp-adapter 7.0.0: the facts behind decision 1

`turnOffPiBuiltinMcp()` (`adapter@7.0.0/pi-builtin-mcp.ts:14-27`) does the following:

1. It returns early when `loadOnboardingState().piBuiltinMcpHandledVersion === ADAPTER_VERSION` (`:15`).
2. It opens `SettingsManager.create(process.cwd(), getAgentDir(), { projectTrusted: false })`, reading **user** settings only (`:16`).
3. When no user `extensions` entry equals `builtin:mcp` after stripping a leading `+`, `!` or `-` (`:19`), it appends **exactly** `"-builtin:mcp"` at the end of the array (`setExtensionPaths([...extensions, "-builtin:mcp"])`) and flushes (`:20-23`).
4. **In both branches** it records `piBuiltinMcpHandledVersion = "7.0.0"` (`:25`). The field's own doc says "Adapter version that last turned off, **or found configured**, Pi's built-in MCP" (`onboarding-state.ts:12-13`).

Where the onboarding state lives:

- File: `<agentDir>/mcp-onboarding.json` (`onboarding-state.ts:22-24`).
- `agentDir` honors `PI_CODING_AGENT_DIR` (or `<APPNAME>_CODING_AGENT_DIR` via `PI_PACKAGE_DIR`'s `piConfig.name`), else `~/.pi/agent` (`agent-dir.ts:10-29`). This matches Pi's `getAgentDir` (`pca@1.5.0/dist/config.js:495,510-516`).
- Format: pretty JSON `{ "version": 1, "sharedConfigHintShown": bool, "setupCompleted": bool, "lastDiscoveryFingerprint"?, "piSignInImportsAsked"?, "piBuiltinMcpHandledVersion"?: string }`, written as tmp + rename (`onboarding-state.ts:5-14,55-61`).
- The adapter runs this fire-and-forget during its own `session_start` (`index.ts:1720-1735`). It skips it when the adapter is embedded with a programmatic config or an explicit config path.

`applyPiMcpServers` (`index.ts:1365-1401`):

- It takes Pi registrations (`piRegistered` from `getMcpServers()` at `session_start`, `:1705`, and from `mcp_servers_change`, `:1404-1410`) through `translatePiMcpServer`.
- It **drops `directTools`** (`:1385-1393`), so `exposure: "direct"` and `alwaysLoad` are lost. It reports the dropped settings as a warning notification, and lets an adapter-configured server of the same name override the registration (`:1381-1384`).
- It also sets `setPiMcpConfigEnabled(true)` on Pi versions with `registerMcpServer` (`index.ts:263`), so the adapter reads Pi's `mcp.json` files too.

Newer release: npm `latest` is 7.0.0. The upstream `CHANGELOG.md` `[Unreleased]` section lists only startup, link-wrapping, log-injection and schema-warning fixes, nothing about built-in MCP. (LOW: read through WebFetch of raw GitHub, because the session has no gh access to that repo.)

## `platform/pi-api.ts` additions (NFR-11 chokepoint)

All are types from the package root (`pca@1.5.0/dist/index.d.ts:8,11,32`), except the probe changes. Add:

```ts
export type {
  McpExposure,            // index.d.ts:32 (from extensions/mcp/config.ts -> core/mcp-servers.ts)
  McpServerConfig,        // index.d.ts:32
  McpServersChangeEvent,  // index.d.ts:8  (only if the builtin side ever handles the event; see below)
  RegisteredMcpServer,    // index.d.ts:11
  SlashCommandInfo,       // index.d.ts:8  (tests already import it directly: test/platform/pi-inventory-seed.ts:14)
  ToolInfo,               // index.d.ts:8
} from "@earendil-works/pi-coding-agent";

// Not root-exported (only McpServerConfig is): derive structurally.
export type McpStdioServerConfig = Extract<McpServerConfig, { command: string }>;
export type McpHttpServerConfig = Extract<McpServerConfig, { url: string }>;
export type McpOAuthConfig = NonNullable<McpHttpServerConfig["oauth"]>;

/** Consumer-owned view of the registration API, like PiInventory. */
export interface PiMcpRegistry {
  registerMcpServer(name: string, config: McpServerConfig): void;
  unregisterMcpServer(name: string): void;
  getMcpServers(): readonly { readonly name: string; readonly extensionPath: string }[];
}
```

Changes to existing members:

- `CommandInventoryItem.sourceInfo` and `ToolInventoryItem.sourceInfo` gain `readonly path?: unknown`. `ToolInventoryItem` gains `readonly exposure?: unknown` and `readonly namespace?: { readonly name?: unknown }` for the status reader.
- Add a `hasLoadedBuiltinMcp(pi: PiInventory)` probe (`/mcp` from `builtin:mcp`) beside `hasLoadedPiMcpAdapter`. Either add `builtinMcpLoaded` to `SoftDepStatus` or replace the boolean pair with one `activeMcp: "adapter" | "builtin" | "none"` field computed adapter-first. The second is cleaner, because "none" is a state the markers name.

Do NOT re-export the runtime class `SettingsManager` (`index.d.ts:22`) unless the planner picks alternative (a) for the settings write (below). Do NOT re-export `createMcpExtension` (`index.d.ts:33`).

Add an `McpServersChangeEvent` handler only if a later design needs it. **Registering a handler for `mcp_servers_change` would mark this extension as "the one that connects registered servers"** (`docs/extensions.md:467`; `runner.js:503-508` checks `hasHandlers`). That suppresses Pi's "no loaded extension connects" error for everyone else's registrations. Avoid it.

## Test infrastructure

- `scripts/install-test-peers.mjs`: **no change.** It installs only the three companion floors (`:29,36-52`), whose ranges are unchanged. It caps resolution with `--before` at the newest floor's publish time (adapter 7.0.0, 2026-10-26). The cache has no Pi copy: companions resolve the peer from the repo's `node_modules` (`--omit=peer`), so the Pi bump reaches them automatically. The adapter imports `SettingsManager` from the host peer (`pi-builtin-mcp.ts:2`), and 1.5.0's `SettingsManager` keeps `create`, `getGlobalSettings`, `setExtensionPaths`, `flush`, `drainErrors` (`pca@1.5.0/dist/core/settings-manager.d.ts:64,77,97-98,194`).
- e2e floor fixture: bump to 1.5.0 (see the table above).
- Cucumber harness:
  - Pi runs with `--offline --no-session --extension …` (`test/e2e/_rpc.ts:242-254`) and does not pass `--no-extensions`, so `builtin:mcp` loads by default in a sandbox without the adapter. That is the `@builtin` profile with no extra setup.
  - For "none", add `--no-mcp`.
  - An `@adapter` scenario's sandbox gets `-builtin:mcp` written by the adapter at `session_start`. That is a ready fixture for the decision-1 scenarios.
  - Built-in sends `initialize` with `clientInfo.name: "pi"`, protocol `2025-11-25` (accepts back to `2024-11-05`), no sampling or elicitation capabilities (`@earendil-works/pi-mcp@1.5.0/dist/client.js:124-136`, `dist/protocol/types.js:1-6`; `mcp/runtime.js:279-280`). The stub server already echoes the requested version (`features/lib/mcp-stub-server.ts:109-113`). Expectations that quote the adapter's `initialize` params (`features/mcp-server/invocation.feature`) belong in `@adapter`-only scenarios.
  - Trust: `features/support/world.ts:753-758` already writes `trust.json`.

## Installation

```bash
# Dev pins (exact pi-ai keeps one pi-ai instance with Pi's own exact dep)
npm pkg set 'devDependencies.@earendil-works/pi-coding-agent=^1.5.0' \
  'devDependencies.@earendil-works/pi-tui=^1.5.0' \
  'devDependencies.@earendil-works/pi-ai=1.5.0' \
  'peerDependencies.@earendil-works/pi-coding-agent=>=1.5.0'
npm install   # regenerates package-lock.json, including the root peerDependencies mirror FLOOR-01 checks

# e2e floor fixture
npm --prefix test/e2e/pi-peer-floor pkg set 'dependencies.@earendil-works/pi-coding-agent=1.5.0'
npm --prefix test/e2e/pi-peer-floor install --package-lock-only --ignore-scripts
```

No `npm install` of any MCP library.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Register built-in servers with `pi.registerMcpServer` from `session_start` (or `resources_discover`, which Pi emits after `session_start`, `agent-session.js:2698-2700`) | Write plugin servers into Pi's `mcp.json` | Never. It is a file the user owns and edits through `/mcp`. It persists across implementation switches, the adapter also reads it (`adapter index.ts:263`), and it wins over registrations, so stale entries would shadow us. |
| Lock `settings.json` with proper-lockfile (`realpath: false`, short retry) and rewrite it atomically through `shared/atomic-json.ts` (alternative b) | (a) `SettingsManager.create(cwd, getAgentDir(), { projectTrusted: false })` → `setExtensionPaths(filtered)` → `flush()`, exactly as the adapter writes it | Choose (a) if byte-for-byte parity with Pi's own merge (`persistScopedSettings`, `settings-manager.js:449-470`) matters more than NFR-1. Pi writes with `writeFileSync`, not atomically (`:150-176`), so (a) needs a recorded NFR-1 exception and a `SettingsManager` re-export. (b) needs a `proper-lockfile-chokepoint` exemption, or a new export from `transaction/with-state-guard.ts` that locks an arbitrary file with a retry. |
| Separate materializers per implementation (brief) | One registration path consumed by both (adapter `applyPiMcpServers`) | Not viable: it drops `directTools`/`alwaysLoad` (`index.ts:1385-1393`) and warns per server. |
| Detect builtin via `getCommands()` `sourceInfo.path === "builtin:mcp"` | Read `pi.getSettings().extensions` for `-builtin:mcp` | Never as the primary signal. Settings miss `--no-mcp`, `--no-extensions`, `-e builtin:mcp`, project overrides and replacement by another `/mcp` extension. The command probe sees the actual session. |
| Status from `getAllTools()` + `getMcpServers()` | Hosting Pi's MCP via `createMcpExtension()` (root-exported, `index.d.ts:33`) to get connection objects | Never. Our extension would register `/mcp`, replace the user's built-in (it is `replaceable`, `dist/extensions/index.js:7-11`), and clash with the adapter's `/mcp`. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@modelcontextprotocol/sdk`, `@earendil-works/pi-mcp` as a direct dep | Pi already connects. A second client would duplicate connections, and `pi-mcp` is an internal transitive package with no stability promise. | `pi.registerMcpServer` |
| A `pi.on("mcp_servers_change", …)` handler | It makes Pi treat this extension as the MCP connector (`runner.js:503-508`), hiding real "nothing connects" errors | Register only when builtin is active, and never handle the event |
| Registering while the adapter is active | The adapter connects registrations as proxy-only and warns per server (`index.ts:1365-1401`) | Adapter path keeps `mcp-adapter.json` |
| Passing Claude values through to built-in unescaped | `!`-prefixed values execute, `$NAME` expands, `${VAR:-x}` stays literal (`resolve-config-value.js:21-69`) | Expand Claude variables ourselves, then escape `$`→`$$` and leading `!`→`$!` |
| `piBuiltinMcpHandledVersion` alone as proof of authorship | It is set when the adapter found an existing entry too (`pi-builtin-mcp.ts:19-25`), and `pi config` writes the same `-builtin:mcp` | See open problem 1 |
| `ctx.reload()` from a hook | Not on `ExtensionContext`; command context only (`types.d.ts:305,341`) | A reload hint, or accept next-start activation (open problem 2) |
| `typebox` features outside JSON Schema in tool params | pi-schema validation ignores them since 1.5.0 | Plain JSON Schema shapes (already the case) |

## Stack Patterns by Variant

**If the adapter is active (`/mcp-adapter` loaded):**
- Keep writing `mcp-adapter.json` entries. Register nothing with Pi.
- Status comes from the `pi-mcp-adapter/status/v1` channel (unchanged).

**If built-in is active (`/mcp` from `builtin:mcp`):**
- Register each recorded server as `plugin_<plugin>_<server>` (validated against `[A-Za-z0-9_-]`) with `exposure: "deferred"`, or `"direct"` for `alwaysLoad: true`.
- Use `timeout` in seconds, and keep `cwd` (built-in honors it; the adapter drops it).
- Gate project scope on `ctx.isProjectTrusted()` plus whatever stronger gate the trust caveat leads to.
- Catch per-server throws so one invalid server does not stop the others.

**If neither is active:**
- Register nothing (it would raise extension errors). Show the "requires MCP support" marker.
- Run the decision-1 settings cleanup if its conditions hold. Built-in turns on at the next start or `/reload`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@earendil-works/pi-coding-agent@1.5.0` | `@earendil-works/pi-ai@1.5.0` (exact dep), `pi-tui@1.5.0`, `pi-agent-core@1.5.0`, `pi-schema@1.5.0`, `typebox@1.3.27` (nested) | Engines `node >=22.19.0`, within the repo's `^22.22.2 || ^24.15.0 || >=26.0.0` |
| `pi-mcp-adapter@7.0.0` | Pi `>=0.99` for the built-in takeover; peer `pi-ai ^1.0.0` (optional) | Uses `typeof pi.registerMcpServer === "function"` as its "Pi has MCP" test (`index.ts:80-82`) |
| `pi-subagents@0.84.0` | Pi built-in MCP since Pi 0.99.2 (CHANGELOG `:264`) | Registered servers are reachable only from background children (`docs/agents.md:573`); this matches the existing recorded gap D-CF6-10 for foreground agents |
| `@quintinshaw/pi-dynamic-workflows@3.15.0` | Pi `>=0.80.8` | Unaffected |

## Phase sequencing implications

- **Phase 1 (serial, everyone waits): "Pi 1.5.0 + McpImplementation seam".** It contains:
  - The pin bump in `package.json` and the lock, the `peer-floor.test.ts` literals, the e2e floor fixture and lock, and the `pi-json-output.test.ts` asserts.
  - The `pi-api.ts` additions above (types, `PiMcpRegistry`, `path`/`namespace`/`exposure` inventory fields, `activeMcp` probe).
  - The interface skeleton plus an adapter implementation that wraps today's behavior unchanged.
- **After Phase 1, these can run in parallel worktrees.** Each touches a different zone or file set:
  1. Builtin translation, verdict table and naming (`domain/`): variable expansion and escaping, the name validity and 64-character hash rule, exposure mapping.
  2. Builtin materialization and status reader (`orchestrators/` load path + `platform/`): `registerMcpServer` at `session_start` and the tool-inventory status.
  3. Record-at-install change (install records keep the Claude-shaped form; read-time verdicts).
  4. Decision-1 settings cleanup (`persistence/` + a lock seam). It has its own NFR-1/NFR-10 amendments and depends only on the `activeMcp` probe.
  5. Agent-grant re-materialization (`bridges/agents/`). The grant form is the same, the server key differs, and foreground children cannot use registered servers.
  6. Cucumber `@adapter`/`@builtin` profiles plus the `--no-mcp` "none" lever (`features/`, `cucumber.json`).
  7. Docs (`docs/mcp-compatibility.md` built-in column, README, CHANGELOG).
- Items 1, 2 and 3 share the recorded-server type. Define that type in Phase 1 so they do not collide.

## Open problems the roadmap must carry (need user decisions)

1. **Authorship of `-builtin:mcp` is not provable from the adapter's state.** The adapter sets `piBuiltinMcpHandledVersion` whether it wrote the line or found one (`pi-builtin-mcp.ts:19-25`, `onboarding-state.ts:12`). `pi config` writes the identical `-builtin:mcp` (`config-selector.js:420`). A user who disabled built-in MCP in `pi config` before installing the adapter is indistinguishable after the fact. Possible tightenings:
   - (i) Remove only an exact `-builtin:mcp` that is the **last** element. The adapter appends; `pi config` might too, so this alone is weak.
   - (ii) Have our extension keep its own provenance record. While the adapter is active, snapshot the user `extensions` array and the handled version on every load. Treat the line as adapter-written only when an earlier snapshot showed no `builtin:mcp` entry and a later one showed `-builtin:mcp` with the handled version set. Otherwise leave it and notify.

   Decision 1 as worded ("the onboarding state shows the adapter wrote it") cannot be implemented literally. Ask the user.
2. **Activation lag.** The session that finds the adapter gone and removes the line still runs without built-in MCP. Built-in extensions are resolved before any extension factory runs (`package-manager.js:764-770`), and only command contexts can `reload()`. The requirement "a switch must never require action from the user" is met only from the next start or `/reload`. Ask the user whether a one-time `/reload` hint is acceptable, or whether a silent next-start activation is preferred.
3. **Project-trust strength** (see the trust caveat). It belongs to architecture and pitfalls, but it determines whether `isProjectTrusted()` is the whole gate.

## Sources

- `@earendil-works/pi-coding-agent@1.5.0` tarball (npm pack): `CHANGELOG.md` §1.5.0; `docs/mcp.md:28-100,191-206,260-270`; `docs/extensions.md:407,465-467,1907-1918,2103-2105,2780-2791`; `docs/settings.md:150-164`; `docs/security.md:35-90`; `docs/packages.md:80-98`; `dist/core/mcp-servers.{d.ts,js}`; `dist/core/extensions/{types.d.ts,loader.js,runner.js}`; `dist/core/{agent-session.js,resource-loader.js,package-manager.js,settings-manager.js,trust-manager.js,resolve-config-value.js,source-info.js,slash-commands.d.ts,config.js}`; `dist/extensions/{index.js,mcp/index.js,mcp/runtime.js,mcp/tools.js}`; `dist/main.js`; `dist/cli/args.js`; `dist/index.d.ts`. HIGH.
- Installed `@earendil-works/pi-coding-agent@1.4.0`: diffed against 1.5.0. The MCP extension, runtime, config, tools, resolve-config-value and runner are identical. HIGH.
- `@earendil-works/pi-ai@1.5.0` and `@earendil-works/pi-tui@1.5.0` tarballs: export diffs. HIGH.
- `@earendil-works/pi-mcp@1.5.0` tarball: `dist/client.js`, `dist/protocol/types.js`. HIGH.
- `pi-mcp-adapter@7.0.0` tarball: `pi-builtin-mcp.ts`, `onboarding-state.ts`, `agent-dir.ts`, `index.ts`, `package.json`, `CHANGELOG.md`. HIGH.
- `pi-subagents@0.84.0` tarball: `docs/agents.md`, `CHANGELOG.md`, `src/api/preflight.d.ts`. HIGH.
- npm registry `dist-tags`/`time` for all five packages. HIGH.
- Scratch `npm install --package-lock-only` of the 1.5.0 trio, which shows the new `@earendil-works/pi-schema` and no nested pi-ai typebox. HIGH.
- `raw.githubusercontent.com/nicobailon/pi-mcp-adapter/main/CHANGELOG.md` `[Unreleased]` via WebFetch. LOW.
- Repo files: `package.json`, `platform/pi-api.ts`, `scripts/install-test-peers.mjs`, `test/architecture/peer-floor.test.ts`, `test/e2e/pi-peer-floor/package.json`, `test/e2e/pi-json-output.test.ts`, `test/e2e/_rpc.ts`, `features/lib/{companions.ts,scripted-model/extension.ts,mcp-stub-server.ts}`, `bridges/mcp/adapter-entry.ts`, `domain/name.ts`.

---
*Stack research for: mcp-builtin (Pi built-in MCP as an equal alternative to pi-mcp-adapter)*
*Researched: 2026-11-04*
