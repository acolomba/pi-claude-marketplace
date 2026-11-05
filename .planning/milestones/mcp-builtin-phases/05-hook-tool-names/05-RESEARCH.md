# Phase 5: Hook Tool Names - Research

**Researched:** 2026-11-04
**Domain:** hooks bridge tool-event dispatch (matcher, `if`, stdin, labels, proxy rule) against Pi 1.5.0's built-in MCP; dual-profile cucumber
**Confidence:** HIGH (Pi 1.5.0 behavior read from `node_modules` and proved by two cucumber probes on this tree; Claude Code 2.1.318 read from the binary and the hooks docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### What Pi tells the hooks bridge about a built-in tool

- **D-P5-01 (built-in tool identity).** A tool call is a built-in MCP tool call
  when the tool that `pi.getAllTools()` lists under the event's tool name has
  `sourceInfo.path === "builtin:mcp"` and a `namespace` with at least one
  alias. Pi 1.5.0 registers each MCP tool with
  `namespace: { name: mcpNamespace(server), aliases: [server] }`
  (`dist/extensions/mcp/index.js` `registerTools`), so the first alias is the
  registered server name with `-` kept (`plugin_<plugin>_<server>` for a plugin
  server, D-MB-13, or the `mcp.json` key for a user server), and the namespace
  name is that name with `-` folded. The bridge reads the tool list at
  dispatch time only: for a tool event whose name starts with `mcp__`, after
  the bucket check, never at factory time (MSEL-01,
  `test/architecture/no-factory-time-probe.test.ts`). A read that throws, a
  missing tool, or a tool from another source leaves the name as it is today.
- **D-P5-02 (the Claude-form name).** A built-in tool's Claude-form name is
  `mcp__<alias>__<rest>`, where `<rest>` is Pi's tool name after the
  namespace prefix `mcp__<namespace name>__`. The tool segment keeps Pi's
  sanitizing (`-` and every other character outside `[A-Za-z0-9_]` become
  `_`) and, for a name Pi cut at 64 characters, Pi's cut and hash. When Pi's
  cut falls inside the namespace, the name does not start with the namespace
  prefix and the hook sees Pi's name unchanged (a recorded gap). The rule
  covers every built-in server, plugin or `mcp.json`, because Claude Code
  names every server's tools `mcp__<server>__<tool>` with `-` kept.
- **D-P5-03 (where the name shows).** The Claude-form name is the tool name
  everywhere a hook sees one: the `tool_name` of the PreToolUse, PostToolUse,
  and PostToolUseFailure stdin, the `PreToolUse:<tool>` notice label
  (D-CF5-14), the matcher, and the `if` field.
- **D-P5-04 (matching a built-in tool).** An MCP literal `mcp__<S>__<T>` in a
  matcher or an `if` field fires on a built-in tool when `<S>` is the tool's
  alias and Pi 1.5.0's `createMcpToolName(S, T)` names the event's tool: the
  sanitized name, the 55-character cut with the 8-hex sha256 of `S\0T` for a
  long name, or the hashed form Pi gives two tools that sanitize to one name.
  So a matcher that names the tool as Claude Code does, `-` in the tool
  segment included, fires; a matcher with the tool segment folded fires too,
  because the two cannot be told apart; a matcher whose server segment is
  folded does not fire. A server prefix `mcp__<S>__.*` (and the `if` forms
  `mcp__<S>` and `mcp__<S>__*`) fires when `<S>` is the alias.
- **D-P5-05 (every other tool).** A tool pi-mcp-adapter serves keeps today's
  comparison against Pi's name, which already is Claude's form (ANAME-01).
  So does every non-MCP tool and every `mcp__` tool from another source.

#### The adapter's proxy rule (MHK-02)

- **D-P5-06 (proxy rule scope).** The D-CF5-12 rule (a call to `mcp` or to a
  namespace proxy `mcp__<server>` with a string `tool` and no `action` runs no
  hook) applies only when the active MCP implementation is the adapter, as
  `softDepStatus(pi).mcpImplementation === "adapter"` defines it (MSEL-01,
  ADET-02). Under built-in or none, no call is a proxy call, so a built-in
  tool whose cut name has no second `__` and whose input holds a string
  `tool` still fires its hooks.
- **D-P5-07 (when the bridge reads it).** The bridge reads the active
  implementation lazily, at the first proxy-shaped call of a bridge
  generation, and keeps the answer for that generation: the set of loaded
  extensions changes only on `/reload` or a new Pi, and either one registers
  a new generation. No read is added at `session_start`, so the run
  snapshot's probe counts stay as Phase 1 froze them.

#### Behavioral scenarios

- **D-P5-08 (shared scenario).** A new `features/hook/mcp-tool-names.feature`
  holds an `@mcp` scenario that runs under both profiles: the plugin
  `hook-demo` holds hooks and the hooks' stub server `stub-server`; a literal
  PreToolUse matcher, a server-prefix PreToolUse matcher, and a PostToolUse
  literal, all in Claude's form, each record one run with the tool name
  `mcp__plugin_hook-demo_stub-server__echo` under both implementations. Under
  built-in the frozen stand-in serves the stub (Pi names the tool
  `mcp__plugin_hook_demo_stub_server__echo`), under the adapter
  pi-mcp-adapter does. A new profile-aware step in the `hook/tool-use` step
  module scripts the call: the `mcp` proxy under the adapter, `tool_search`
  then the direct call under built-in.
- **D-P5-09 (tool-segment fold).** An `@builtin-only` scenario (MHK-01)
  pins the one divergence: a server that Pi's `mcp.json` configures, with a
  `-` in its name and a tool with a `-` in its name, served by a Phase 5 stub
  library with `direct` exposure. A matcher with Claude's full name fires, and
  the hook sees the server segment with `-` and the tool segment with `_`.
  The frozen stub offers only `echo`, and the extension's own registration
  (Phase 2) merges after this phase, so a plugin server cannot carry such a
  tool here.
- **D-P5-10 (proxy-shaped built-in name).** An `@builtin-only` scenario
  (MHK-02) installs a plugin whose name is long enough that Pi cuts the tool
  name inside the namespace, so the name has no second `__`; the model calls
  it with a string `tool` in its input. A `*` hook and a Claude-form literal
  hook fire. The hook sees Pi's cut name (D-P5-02 gap).
- **D-P5-11 (the Phase 1 tag).** The `@adapter-only` scenario Phase 1 left in
  `features/hook/tool-use.feature` ("A hook on a plugin MCP tool runs once per
  call under the real tool name") becomes an `@adapter-only` and
  `@builtin-only` pair in that file. The adapter half keeps the proxy de-dup
  (D-CF5-12, MHK-02): the outer `mcp` call runs no hook. The built-in half has
  no proxy: the `*` hooks run once on `tool_search` and once on the tool call.
  The feature description's "until MHK-01, MHK-02 lift its tag" goes.
- **D-P5-12 (red proof).** Each new scenario fails on the Phase 1 tree under
  each profile where it applies, and the plan SUMMARY records the failing run
  per profile. The shared scenario applies to the behavior change under
  built-in only; under the adapter it is a parity guard and passes on the
  Phase 1 tree.

#### Code placement and documentation

- **D-P5-13 (modules).** The pure Pi-name computation goes in a new module
  under `domain/components/hooks/` (with its unit pair), and the dispatch-time
  tool lookup in a new module under `bridges/hooks/`. The frozen profile's
  private `builtinToolName` in `domain/mcp-implementation.ts` takes a plugin
  and a server, not a registered name, so it cannot serve an `mcp.json` server
  and is not reused; both cite Pi 1.5.0 `createMcpToolName`. The translators,
  the label, the matcher check, and the `if` check read one per-event tool
  identity computed once per event.
- **D-P5-14 (docs).** `docs/hooks-compatibility.md` gains the built-in tool
  names, the tool-segment fold, the cut-name gap, and the proxy rule's scope.
  The CHANGELOG and README lines go to the parent (Phase 6, MDOC-02).

### Claude's Discretion

- The module and function names, the per-event identity's shape, whether the
  dispatch-time tool lookup is cached within a generation, the exact step
  texts, and the long plugin name of D-P5-10.
- Whether `domain/components/hook-tool-names.ts` (a hooks file outside the
  `domain/components/hooks/**` glob, owned by no other phase) changes; prefer
  leaving it as it is.

### Deferred Ideas (OUT OF SCOPE)

- Naming Pi's `tool_search` as Claude Code's `ToolSearch` in hook stdin and
  matchers (both are the deferred-tool discovery tool); not an MHK
  requirement.
- Recovering the original tool segment from a tool result's `details.tool`:
  a PreToolUse event has no details, so the two events would disagree.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MHK-01 | A plugin hook whose matcher names a plugin MCP tool fires on the built-in tool call with the server segment matched in Claude's form (with `-`); only the tool segment's fold is a recorded divergence licensed by a Pi capability gap | Q1 (identity from `getAllTools`), Q4/Q6 (one per-event identity, `createMcpToolName` reproduction), Q7 (D-P5-08, D-P5-09 scenarios, probe evidence), Q8 (Claude Code naming and exact matching), Q9 (docs) |
| MHK-02 | The pi-mcp-adapter `mcp` proxy special case in hook dispatch applies only while the adapter is active | Q5 (lazy per-generation read through `openNotificationSnapshot`), Q7 (D-P5-10 name `hook-proxy-shaped-tool-names-of-a-long-plugin`, D-P5-11 pair), Q2 (unknown tools fire no event) |
</phase_requirements>

## Project Constraints (from AGENTS.md and the milestone)

- Never commit to `main`; branch `features/mcp-builtin-phase-5`; merge, never rebase; commit titles per `.agents/skills/committing/SKILL.md`, no milestone/phase/plan IDs in titles.
- Upstream parity is the default; a divergence needs a recorded decision ID or a Pi capability gap (D-MB-08 licenses the tool-segment fold).
- TypeScript strict; `npm run check` green: typecheck, ESLint (`--max-warnings 0`, `sonarjs/cognitive-complexity: 15`), fallow (dead code in production mode, `maxCognitive: 15`, `maxCyclomatic: 20`, dupes fail on every clone group, boundary zones, rule pack), Prettier, source/test pairing, 100% direct coverage per pair, `check:features`, both cucumber profiles.
- All output through `shared/notification-dispatch.ts`; no `process.stdout`/`console` inside `extensions/pi-claude-marketplace/**`; only `platform/pi-api.ts` imports `@earendil-works/pi-coding-agent`.
- D-JO-01 (PROJECT.md:1687): "`openNotificationRun(pi)` is the only `softDepStatus` caller and runs only at the command roots" -- see Pitfall 1 for its consequence on D-P5-06.
- Dependency injection over test seams; no `_setXForTest`.
- A user-visible behavior change ships a cucumber scenario that fails without it, per profile, with the red proof in the SUMMARY; profile-specific expectations are `@adapter-only`/`@builtin-only` pairs in one file naming an ID.
- Phase 5 edits only `bridges/hooks/**`, `domain/components/hooks/**`, `docs/hooks-compatibility.md`, their unit pairs, `test/integration/hooks-*`, `features/hook/**`, `features/step_definitions/hook/**`, `features/lib/hook-files.ts`, and NEW `features/lib/hook-*.ts`. Frozen files (01-FROZEN.md section 1) are parent lines only.
- Every plan SUMMARY has `## Threat Flags`; WINDOWS descriptions start with `[mcp-builtin]`.
- Run npm scripts with `npm_config_script_shell=/tmp/claude-0/-home-user-pi-claude-marketplace/5f93b531-ce41-57f0-a1f7-9f708584a490/scratchpad/nondac-sh NODE_OPTIONS=--max-old-space-size=6144` (root container).

## Summary

Pi 1.5.0 gives the hooks bridge exactly one signal that a tool is a built-in MCP tool and what its server is called: `pi.getAllTools()` lists it with `sourceInfo.path === "builtin:mcp"` and `namespace: { name: "mcp__<server with - folded>", aliases: ["<server as registered>"] }`. The original tool name (with `-`) is not in `ToolInfo` (it is only in the tool definition's `label`, which `getAllTools` omits), so the D-MB-08 Pi capability gap holds for the tool segment. A cucumber probe on this tree under the builtin profile confirmed today's behavior: the hooks see `mcp__plugin_hook_demo_stub_server__echo`, and Claude-form literal and server-prefix matchers (`mcp__plugin_hook-demo_stub-server__echo`, `mcp__plugin_hook-demo_stub-server__.*`) do not fire. A second probe under the adapter profile showed the same Claude-form hooks (literal, prefix, `*` + `if` literal, PostToolUse literal) already fire once each, under `mcp__plugin_hook-demo_stub-server__echo`. So the shared D-P5-08 scenario is red under builtin and a parity guard under the adapter, as D-P5-12 says.

The narrowest seam is one per-event tool identity (`{ piName, name, builtinServer }`) computed once in the two tool composite handlers, right after the bucket check. The matcher check and the `if` check read the identity; the executor (stdin translators, async-rewake), the notice label, and the event adapters (block reasons, ask dialog, PostToolUse feedback) read a shallow copy of the Pi event whose `toolName` is the hook-facing name. That copy shares `input` and `content` by reference, so in-place input mutation still reaches Pi. No translator, `dispatch-exec.ts`, `async-rewake/registry.ts`, `HookExecutor` type, or `domain/components/hook-tool-names.ts` change is needed.

The proxy rule (D-CF5-12) becomes "proxy-shaped AND the adapter is active", with the active implementation read lazily, once per bridge generation, at the first proxy-shaped call. Read it through `openNotificationSnapshot(pi).softDeps.mcpImplementation` (`shared/notification-run.ts`), not `softDepStatus(pi)` directly, to keep D-JO-01.

**Primary recommendation:** add `domain/components/hooks/builtin-mcp-tool-names.ts` (pure: `McpToolIdentity`, literal/prefix matching via Pi's `createMcpToolName` reproduced in a different shape, Claude-form name) and `bridges/hooks/mcp-tool-view.ts` (`createHookToolView(pi)`: `identify(piName)` and memoized `proxyRuleApplies()`); thread the view into `compositeHandlerFor`/`toolResultCompositeHandler` as a defaulted last parameter, created once per generation in `registerHooksBridgeWith`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pi-name computation (`createMcpToolName` reproduction, Claude-form name, literal/prefix matching) | domain (`domain/components/hooks/`) | -- | pure string + `node:crypto`; no I/O; reused by matcher and `if` |
| Dispatch-time tool lookup (`getAllTools`) and active-implementation memo | bridges-hooks (`bridges/hooks/mcp-tool-view.ts`) | shared (`openNotificationSnapshot`) | needs `pi` at dispatch time; hooks-only consumer |
| Per-event identity threading, matcher fire, proxy skip | bridges-hooks (`dispatch.ts`) | bridges-hooks (`if-field/index.ts`) | the composite handlers own the event lifecycle |
| Per-generation view creation | bridges-hooks (`event-router.ts`) | -- | generations are created there (`registerHooksBridgeWith`) |
| Behavioral proof | `features/hook/**`, `features/step_definitions/hook/**`, `features/lib/hook-*.ts` | frozen harness (stand-in, scripted model) | ownership table |
| Documentation | `docs/hooks-compatibility.md` | parent (CHANGELOG/README, Phase 6) | D-P5-14 |

## Standard Stack

No new package. Everything uses what the repo already has.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:crypto` `createHash` | Node built-in | sha256 of `server\0tool` (Pi's hash) | already used by `domain/mcp-implementation.ts:13` and `bridges/agents/discover.ts:38`; no rule-pack ban [VERIFIED: rule-packs/architecture.json read this session] |
| `@earendil-works/pi-coding-agent` | 1.5.0 | `ToolInfo` via `ExtensionAPI["getAllTools"]` (types only, through `platform/pi-api.ts`) | NFR-11 chokepoint [VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json `"version": "1.5.0"`] |
| `@cucumber/cucumber` | repo pin | scenarios | existing harness |

### Supporting (frozen harness, used read-only)
| Module | Purpose | When to Use |
|---------|---------|-------------|
| `features/lib/scripted-model/script.ts` `writeModelScript`, `ScriptStep` | write the profile-aware script | the D-P5-08 step |
| `domain/mcp-implementation.ts` `profileFor(id).toolName(plugin, server, tool)` | the tool name each profile exposes | the D-P5-08 step (adapter `mcp__plugin_hook-demo_stub-server__echo`, builtin `mcp__plugin_hook_demo_stub_server__echo`) |
| `features/support/world.ts` `mcpProfile`, `profileHarness()`, `tokens.agentDir` | profile and harness dir | steps |
| `test/platform/pi-inventory-seed.ts` `builtinMcpTool()`, `builtinMcpCommand()`, `adapterCommand()`, `toolInfo()` | unit-test inventories | dispatch / view tests |

**Installation:** none.

## Package Legitimacy Audit

No external package is installed by this phase. **Packages removed due to [SLOP] verdict:** none. **Packages flagged as suspicious [SUS]:** none.

## Research Answers (file:line evidence)

### Q1. What a built-in MCP tool's `ToolInfo` contains

- `getAllTools()` returns `name, description, parameters, promptGuidelines, exposure, namespace?, annotations?, reachesTools?, sourceInfo` -- no `label` [VERIFIED: dist/core/agent-session.js:1110-1122]:
  ```js
  getAllTools() {
      return Array.from(this._toolDefinitions.values()).map(({ definition, sourceInfo }) => ({
          name: definition.name, description: definition.description, parameters: definition.parameters,
          promptGuidelines: definition.promptGuidelines, exposure: this._getToolExposure(definition.name),
          ...(definition.namespace ? { namespace: definition.namespace } : {}),
          ...(definition.annotations ? { annotations: { ...definition.annotations } } : {}),
          ...(definition.reachesTools ? { reachesTools: definition.reachesTools } : {}),
          sourceInfo,
  ```
  Type: `export type ToolInfo = Pick<ToolDefinition, "name" | "description" | "parameters" | "promptGuidelines" | "reachesTools"> & { exposure: ToolExposure; namespace?: ToolNamespace; annotations?: ToolAnnotations; sourceInfo: SourceInfo; };` [VERIFIED: dist/core/extensions/types.d.ts:1600-1605]. `ToolNamespace { name: string; aliases?: readonly string[]; description?: string; instructions?: string }` [VERIFIED: types.d.ts:430-445].
- `sourceInfo.path` is `builtin:mcp`: a built-in extension is loaded with path `` `${BUILTIN_PATH_PREFIX}${name}` `` (`export const BUILTIN_PATH_PREFIX = "builtin:";` [VERIFIED: dist/core/source-info.js:9]; `loadExtensionFromFactory(builtin.factory, ..., path)` [VERIFIED: dist/core/resource-loader.js:546-556]); `createExtension` sets `sourceInfo: createSyntheticSourceInfo(extensionPath, { source, baseDir })` [VERIFIED: dist/core/extensions/loader.js:504]; `registerTool` stores `sourceInfo: extension.sourceInfo` [VERIFIED: loader.js:242]; the built-in list names it `{ name: "mcp", factory: mcpExtension, replaceable: true, builtin: true }` [VERIFIED: dist/extensions/index.js:11]. The e2e seed `builtinMcpTool()` (checked against a live Pi RPC inventory by `test/e2e/adapter-detection-rpc.test.ts:154,404-408`) is `namespace: { name: "mcp__stub", aliases: ["stub"] }, sourceInfo: { path: "builtin:mcp", source: "builtin", ... }` [VERIFIED: test/platform/pi-inventory-seed.ts:83-92].
- The namespace: `export function mcpNamespace(server) { return \`mcp__${server.replace(/-/g, "_")}\`; }` [VERIFIED: dist/core/mcp-servers.js:60-62] -- so `namespace.name` is `mcp__<folded>` (the `mcp__` is part of the name). `registerTools` builds `const namespace = { name: mcpNamespace(server), aliases: [server], ...description, ...instructions }` [VERIFIED: dist/extensions/mcp/index.js:287-292]. `aliases[0]` is the registered name with `-` kept.
- The original tool name lives only in `label = \`${server}/${tool.name}\`` on the definition [VERIFIED: dist/extensions/mcp/tools.js:244-247], and `ExtensionAPI` has no `getToolDefinition` (its tool reads are `getActiveTools(): string[]` and `getAllTools(): ToolInfo[]`) [VERIFIED: types.d.ts:1305-1307]. So D-MB-08's gap is real.
- pi-mcp-adapter 7.0.0 tools: deferred fields carry `namespace: { name: namespaceProxyName(spec.serverName), ...description, ...instructions }` with no `aliases` [VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/index.ts:519-533], `namespaceProxyName(s) = \`mcp__${formatServerNamespace(s)}\`` [VERIFIED: mcp-references.ts:38-40]; their `sourceInfo.path` is the adapter's extension file path, never `builtin:mcp` (same `registerTool` path, loader.js:242). D-P5-01's test therefore excludes every adapter tool.

### Q2. `tool_call` / `tool_result` events

- `ToolCallEventBase { type: "tool_call"; toolCallId: string; parentToolCallId?: string }`; `CustomToolCallEvent { toolName: string; input: Record<string, unknown> }`; "`event.input` is mutable. Mutate it in place" [VERIFIED: types.d.ts:950-960, 993-1003]. `ToolResultEventBase { type: "tool_result"; toolCallId; parentToolCallId?; input; content: (TextContent | ImageContent)[]; structuredContent?; isError: boolean; ... }`, `CustomToolResultEvent { toolName: string; details: unknown }` [VERIFIED: types.d.ts:1004-1056].
- Nested calls fire both events: `_executeNestedToolCall` runs `beforeToolCall: (context) => this._beforeToolCall(context, parentId)` and `afterToolCall` the same, against `_getCallableTools()` [VERIFIED: dist/core/agent-session.js:339-349, 397-428]. So a codemode script's call of a codemode-exposure MCP tool reaches hooks under the MCP tool's name, with `parentToolCallId` set; the bridge's per-event identity covers it unchanged.
- An unknown or not-loaded tool fires neither event: `const tool = tools.find((t) => t.name === toolCall.name); if (!tool) { return { kind: "immediate", result: createErrorToolResult(\`Tool ${toolCall.name} not found\`), isError: true }; }` before `config.beforeToolCall` [VERIFIED: pi-agent-core/dist/agent-loop.js:487-499]; `afterToolCall` runs only in `finalizeExecutedToolCall` for prepared calls (agent-loop.js:392-402). A deferred tool not yet loaded by `tool_search` is not in `currentContext.tools`, so a direct call before `tool_search` fires no hook.
- Pi's MCP header: "Every call runs through pi's tool pipeline, so `tool_call`/`tool_result` hooks and permission extensions apply to MCP tools" [VERIFIED: dist/extensions/mcp/index.js:20-21].

### Q3. Calling a deferred built-in tool from the scripted model; `mcp.json` exposure

- `tool_search` arguments: `Type.Object({ query: Type.String(...), limit: Type.Optional(Type.Number(...)) })` [VERIFIED: dist/extensions/tool-search/tool.js:199-202]. `searchAndLoad` activates the matches with `tools.setActiveTools([...active, ...matches.map((match) => match.name)])` and answers "They are available from your next call" [VERIFIED: tool.js:211-217, 247-249]. An exact-name query ranks first (`isExactNameQuery`, tool.js:110-113). Use `{"query": "<Pi name>", "limit": 1}` so only that tool loads.
- PROBED on this tree (builtin profile, frozen stand-in, scratch feature outside the repo): the script `tool_search {"query": "mcp__plugin_hook_demo_stub_server__echo", "limit": 1}`, then `mcp__plugin_hook_demo_stub_server__echo {"text": "ping"}`, then `Done.` ran; `*` PreToolUse and `*` PostToolUse hooks each recorded two runs (`tool_search` and the echo), the echo's `tool response` was `[{"type":"text","text":"echo:ping"}]`, and the Claude-form literal and prefix hooks recorded none [VERIFIED: probe output, scratchpad/researcher/probe/out.txt]. The `tool_search` PostToolUse `tool response` is Pi's own text, `"Loaded 1 tool. They are available from your next call:\n- mcp__plugin_hook_demo_stub_server__echo: Echoes the text it is given."` (upstream wording; see Pitfall 4).
- `mcp.json`: global `<agentDir>/mcp.json` always, project `<cwd>/.pi/mcp.json` only when trusted: `readConfigFile(join(options.agentDir, "mcp.json"), "global", state); const projectConfig = options.projectTrusted ? join(options.cwd, CONFIG_DIR_NAME, "mcp.json") : undefined;` [VERIFIED: dist/extensions/mcp/config.js:108-109 (lines 75-76 of the grep window starting at 34)]. So a user-scope `mcp.json` needs no trust entry.
- Default exposure: `return config.exposure ?? "codemode";` [VERIFIED: dist/core/mcp-servers.js:145]. `"direct"` "declares them to the model right away" and "the first prompt waits only for servers with `direct` tools" [VERIFIED: dist/extensions/mcp/index.js:7, 15; `waitForDirectServers` on `before_agent_start` at index.js:1014-1036]. So a `direct` server needs no `tool_search` and no listing wait.
- Validated keys for a stdio entry: the name must match `^[A-Za-z0-9_-]+$`; `exposure` one of `"codemode", "deferred", "direct", "hidden"`; `command` string; `args` array of strings; `env` string map; `cwd` string; also `enabled`, `timeout`, `toolExposure`, `description` [VERIFIED: dist/core/mcp-servers.js:59, 37, 151-212].

### Q4. Every hooks-bridge site that compares or emits a tool name

| Site | Today | Change |
|------|-------|--------|
| `bridges/hooks/dispatch.ts:131-144` `matcherFiresOnToolEvent(matcher, toolName)` | `toolNames.has(toolName) \|\| toolPrefixes.some(startsWith)` | take `McpToolIdentity`; literal/prefix via domain helpers |
| `dispatch.ts:892-905` `entryFires` (PreToolUse via `matchValue` 870-885) | Pi `event.toolName` | PreToolUse arm reads the identity |
| `dispatch.ts:761-764` tool_result matcher + label | `event.toolName` | identity + hook event |
| `dispatch.ts:912-921` `noticeLabel` | `hookEventLabel("PreToolUse", event.toolName)` | pass the hook event, so the value is the Claude-form name |
| `dispatch.ts:611-634` `isMcpProxyCall`, `812-819` `isProxiedToolCall`, `713`, `757` | shape only | shape AND `proxyRuleApplies()` (MHK-02) |
| `dispatch.ts:208-219` `matchingHooks` -> `ifFires(entry.ifPredicate, event, ctx, entry.claudeEvent)` | event | add the identity argument |
| `bridges/hooks/if-field/index.ts:529-533` `mcp-literal` / `mcp-server-prefix` arms, `extractToolName` 377-380 | `event.toolName` equality / `startsWith` | optional 5th parameter `tool?: McpToolIdentity`, default from `extractToolName(event)` |
| `bridges/hooks/payloads/{pre-tool-use,post-tool-use,post-tool-use-failure}.ts` `tool_name: mapPiToClaudeToolName(event.toolName)` (37 / 41 / 52) | Pi name | unchanged: they receive the hook event; `mapPiToClaudeToolName` passes `mcp__...` through (`domain/components/hook-tool-names.ts:143-145`) |
| `bridges/hooks/dispatch-exec.ts:200` `buildPayload(entry.claudeEvent, event, transCtx)`, `188` `spawnAndRegister(..., event, ...)`; `async-rewake/registry.ts:204` translators | event | unchanged: the executor receives the hook event |
| `bridges/hooks/event-adapters.ts:210` (`userAllows` dialog), `256` (block reason to the model), `285-288` (PostToolUse feedback) `hookEventLabel(..., event.toolName)` | Pi name | unchanged: adapters receive the hook event |
| `bridges/hooks/hook-labels.ts:29-33` `hookEventLabel` | `mapPiToClaudeToolName` | unchanged |
| `domain/components/hooks/matcher.ts` `parseMatcher` | parse only | unchanged (prefix kept as `mcp__<S>__`, literal kept verbatim) |
| `domain/components/hook-tool-names.ts` | table | unchanged (Discretion: leave it) |

Call graph after the change (PreToolUse; tool_result is the same minus the adapter switch):

```
event-router.registerHooksBridgeWith(runtime, reader, pi, opts)
  tools = createHookToolView(pi)                       # per generation, reads nothing
  pi.on("tool_call", bindWithMode(g => compositeHandlerFor(runtime, "PreToolUse", g, pi, opts.executor, tools)))
  pi.on("tool_result", bindWithMode(g => toolResultCompositeHandler(runtime, g, pi, opts.executor, tools)))

compositeHandlerFor(...)(event, ctx)
  generation check -> bucket = runtime.getRoutingBucket(claudeEvent) -> empty? return
  view = toolEventView(claudeEvent, event, tools)       # PreToolUse only; else { event, tool: undefined }
       isMcpProxyCall(event) && tools.proxyRuleApplies()  -> undefined (run no hook)   # MHK-02, lazy read
       tool = tools.identify(event.toolName)              # mcp__ names only read getAllTools
       hookEvent = tool.name === event.toolName ? event : { ...event, toolName: tool.name }
  runAndFold(runtime, bucket, view, ctx, pi, executor, entry => entryFires(claudeEvent, entry, view))
       matchingHooks -> matcherFires(entry) && ifFires(entry.ifPredicate, view.event, ctx, claudeEvent, view.tool)
       executor(entry, view.event, ctx, pi, runtime)      # stdin tool_name = Claude form
  label = noticeLabel(claudeEvent, view.event)            # PreToolUse:<Claude form>
  adaptForEvent(claudeEvent, folded, view.event, context) # block reason / ask dialog label
```

Signatures to change (all in owned files):

```ts
// dispatch.ts (module-private unless noted)
function matcherFiresOnToolEvent(matcher: ParsedMatcher, tool: McpToolIdentity): boolean;
interface ToolEventView { readonly event: unknown; readonly tool: McpToolIdentity | undefined }
function toolEventView(event: ToolCallEvent | ToolResultEvent, tools: HookToolView): ToolEventView | undefined;
function matchingHooks(bucket, event, ctx, matcherFires, tool?: McpToolIdentity): RoutingEntry[];
function runAndFold(runtime, bucket, view: ToolEventView, ctx, pi, executor, matcherFires): Promise<FoldedBucket>;
export function compositeHandlerFor<E extends CompositeDispatchEvent>(
  runtime, claudeEvent: E, capturedGeneration: number, pi?: ExtensionAPI,
  executor: HookExecutor = dispatchHookExec, tools: HookToolView = createHookToolView(pi),
): ...;
export function toolResultCompositeHandler(
  runtime, capturedGeneration: number, pi?: ExtensionAPI,
  executor: HookExecutor = dispatchHookExec, tools: HookToolView = createHookToolView(pi),
): ...;
// if-field/index.ts
export function ifFires(predicate, event, ctx, _claudeEvent, tool?: McpToolIdentity): boolean;
```

`collectBucketOutcomes` (the settle Stop path) keeps its signature and passes no identity. Complexity: `compositeHandlerFor` loses `isProxiedToolCall` and gains one ternary and one `if`; `toolEventView` is ~3 branches; each new helper stays far below 15 for both ESLint sonarjs and fallow. New edges: `dispatch.ts -> mcp-tool-view.ts -> {domain/components/hooks/builtin-mcp-tool-names.ts, shared/notification-run.ts}`, `event-router.ts -> mcp-tool-view.ts`, `if-field/index.ts -> domain/components/hooks/builtin-mcp-tool-names.ts`. None closes a cycle (`mcp-tool-view.ts` imports no bridge module).

### Q5. MHK-02: where `pi` is, and how to read the implementation lazily

- `compositeHandlerFor(runtime, claudeEvent, capturedGeneration, pi?: ExtensionAPI, executor)` and `toolResultCompositeHandler(runtime, capturedGeneration, pi?, executor)` [VERIFIED: dispatch.ts:696-702, 744-749]. Production always passes `pi` (event-router.ts:1196-1206). `bindRegistrationCallback` calls `callbackForGeneration(capturedGeneration)` once at registration [VERIFIED: event-router.ts:528-541], so a view created in `registerHooksBridgeWith` (event-router.ts:1012-1243) lives exactly one generation, and so does a default parameter evaluated inside the factory.
- `softDepStatus(pi)` reads `getCommands()` once and `getAllTools()` three times and never throws [VERIFIED: platform/pi-api.ts:356-372]; its `mcpImplementation` is `"adapter"` when an extension command `mcp-adapter` exists or a tool/command source contains `pi-mcp-adapter` (pi-api.ts:251-317). A double with no `getCommands` reads as `none` (pi-api.ts:290-296).
- D-JO-01 makes `shared/notification-run.ts` the only module that calls `softDepStatus`. It exports `export function openNotificationSnapshot(pi: PiInventory): NotificationSnapshot { return { softDeps: softDepStatus(pi) }; }` [VERIFIED: shared/notification-run.ts:71-73]. Use it: `openNotificationSnapshot(pi).softDeps.mcpImplementation === "adapter"`. `dispatch.ts` already imports `shared/notification-run.ts` (dispatch.ts:49), so the boundary is already allowed.
- Boundary zones: `bridges-hooks` may import `domain`, `persistence`, `shared`, `platform` [VERIFIED: .fallowrc.json boundaries rules]. Rule pack: `pi-peer-chokepoint` bans `@earendil-works/pi-coding-agent` outside `platform/pi-api.ts` (type through `ExtensionAPI["getAllTools"]` from `pi-api.ts` instead); no rule bans `node:crypto` [VERIFIED: rule-packs/architecture.json].
- Tests that count inventory reads: `test/architecture/no-factory-time-probe.test.ts` bans reads in the factory and requires one at `session_start` -- the view reads nothing at creation, so it stays green [VERIFIED: test file lines 43-171]. `test/index.test.ts` uses a strict `strong-mock` Pi with `.times(probes * 3)` `getAllTools` expectations (index.test.ts:364-374), and its tool events use `toolName: "bash"` (index.test.ts:1739-1744) -- the view must therefore read nothing for a non-`mcp__`, non-`mcp` tool. `test/bridges/hooks/settle.test.ts:261` counts 27 `getAllTools` calls on the Stop path, which the change does not touch. `test/bridges/hooks/dispatch.test.ts:3179-3275` ("mcp proxy calls (D-CF5-12)") passes `pi = undefined`; under the new rule those `runs: false` cases flip, so they must pass an adapter inventory (`getCommands: () => [adapterCommand()]`) and gain built-in and none cases.

### Q6. The Pi tool-name computation and fallow dupes

- Pi 1.5.0 [VERIFIED: dist/extensions/mcp/tools.js:29, 45-51]:
  ```js
  const MAX_TOOL_NAME_LENGTH = 64;
  export function createMcpToolName(server, tool, isTaken = () => false) {
      const name = `mcp__${server}__${tool}`.replace(/[^A-Za-z0-9_]/g, "_");
      if (name.length <= MAX_TOOL_NAME_LENGTH && !isTaken(name))
          return name;
      const hash = createHash("sha256").update(`${server}\0${tool}`).digest("hex").slice(0, 8);
      return `${name.slice(0, MAX_TOOL_NAME_LENGTH - hash.length - 1)}_${hash}`;
  }
  ```
  `isTaken` is true for a name another owner holds or that two of the server's tools sanitize to (index.js:300-310); the hashed form depends only on `(server, tool)`, so "plain when it fits, and always the hashed form" are the only two candidates.
- The frozen `builtinToolName(plugin, server, tool)` is module-private and takes a plugin [VERIFIED: domain/mcp-implementation.ts:109-123], so D-P5-13's new module is right.
- PROBED fallow dupes (fallow from this repo, default settings = this repo's, since `.fallowrc.json` has no `duplicates` key) on an isolated scratch tree holding `mcp-implementation.ts` and a draft: a naive copy of `builtinToolName` makes a 10-line clone group (`src/mcp-implementation.ts:113-122` with the copy); the draft below (one helper that returns the candidate list, constants named differently, hash computed before the branch) reports "No code duplication found" in `mild`, `strict`, `weak`, and `semantic` modes [VERIFIED: probe in scratchpad/researcher/dupes]. No marker is needed; the frozen file cannot hold one anyway. Re-run `npx fallow dupes` on the real tree after writing it.

### Q7. Cucumber

- **(a) Profile-aware step.** `world.mcpProfile` (`"adapter" | "builtin"`), `profileFor(id).toolName(plugin, server, tool)`, `writeModelScript(this.profileHarness(), steps)`, `ScriptStep = { reply } | { tool, arguments }` [VERIFIED: features/lib/scripted-model/script.ts:21-24, 126-160; features/step_definitions/model.steps.ts:85-93]. Adapter script: `[{ tool: "mcp", arguments: { tool: "<adapter name>", args } }, { reply }]`; builtin: `[{ tool: "tool_search", arguments: { query: "<Pi name>", limit: 1 } }, { tool: "<Pi name>", arguments: args }, { reply }]`. Put the builder in a NEW `features/lib/hook-mcp-calls.ts` (lib modules register nothing; step modules export nothing).
- **(b) Names with `-`.** `the published plugin {string} of the marketplace {string} has the stub mcp server {string} for its hooks` writes `{ mcpServers: { [server]: { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server] } } }` [VERIFIED: features/step_definitions/hook/tool-use.steps.ts:35-38]; the stand-in registers `builtinMcpServerName(plugin, server)` with `exposure: "deferred"` [VERIFIED: features/lib/builtin-mcp-stand-in/extension.ts:94-114]. Both took `hook-demo`/`stub-server` in the probes.
- **(c) Long plugin name.** No length limit on plugin names (`assertSafeName` checks type, emptiness, `.`/`..`, separators, control characters only [VERIFIED: domain/name.ts:35-66]; Pi server names have no length limit [VERIFIED: mcp-servers.js:59, 213-227]). Computed with Pi's algorithm (scratchpad/researcher/names.mjs):

  | plugin (length) | registered server | Pi tool name | proxy-shaped |
  |---|---|---|---|
  | `hook-demo` (9) | `plugin_hook-demo_stub-server` | `mcp__plugin_hook_demo_stub_server__echo` | no |
  | `hook-proxy-shaped-tool-names-of-a-long-plugin` (45) | `plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server` | `mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d` | **yes** |
  | `hooks-on-a-built-in-mcp-tool-whose-name-pi-cuts` (47) | ... | `mcp__plugin_hooks_on_a_built_in_mcp_tool_whose_name_pi__5426b2a5` | no (char 54 is `_`, so `_` + `_hash` makes `__`) |

  Use `hook-proxy-shaped-tool-names-of-a-long-plugin`. Its built-in profile `toolNamePrefix` is `undefined`, so the frozen listing wait matches the full `toolName` (`features/lib/mcp-implementation.ts:463-469`). Forced-hash vector for unit tests: `createMcpToolName("plugin_hook-demo_stub-server", "echo", taken)` = `mcp__plugin_hook_demo_stub_server__echo_9bab19c4`; collision vectors `("docs-server","a-b")` -> `mcp__docs_server__a_b_e1640312`, `("docs-server","a_b")` -> `mcp__docs_server__a_b_35d05d6d`; `("echo-server","echo-text")` plain `mcp__echo_server__echo_text`, hashed `mcp__echo_server__echo_text_ba79b118`.
- **(d) `the hooks record these runs`** projects every stdin field as a column (`tool_name` -> `tool name`), plus `arguments` and the environment; a stated table must list every column, or the missing ones appear appended [VERIFIED: features/step_definitions/hook/runs.steps.ts:40-43, 77-131]. The any-order variant sorts rows (runs.steps.ts:138-141).
- **(e) Dashed-tool stub + `mcp.json` step.** New `features/lib/hook-mcp-tool-server.ts`: a stdio JSON-RPC server that lists one tool named by `argv[2]` (schema `{ text: string }`), answers `tools/call` with `[{type:"text", text:"<tool>:<text>"}]`, ignores notifications, exits on stdin end. It needs no request log or pid file, because `direct` exposure makes Pi wait for it before the first prompt. Write it in a different shape from `features/lib/mcp-stub-server.ts` (a handler table, a `data`-chunk splitter) so `fallow dupes` finds no clone group. The step (in `hook/tool-use.steps.ts`) writes `{agent dir}/mcp.json` with `{ "mcpServers": { "<server>": { "command": process.execPath, "args": [HOOK_MCP_TOOL_SERVER, "<tool>"], "exposure": "direct" } } }`, refuses an existing file (`flag: "wx"`), and reads it back.
- **(f) Tag rules** (`scripts/check-features.mjs`): a scenario is MCP when a step's text has the word `mcp` (`/\bmcp\b/i`, so `mcp.json` counts and `mcp__x` in a table does not) or a doc string/table holds `mcpServers`/`.mcp.json`; it carries exactly one of `@mcp`, `@adapter-only`, `@builtin-only`, `@own-implementation`; an `@mcp` scenario never names `pi-mcp-adapter`; an `@adapter-only`/`@builtin-only` scenario names an ID in its title or the feature description [VERIFIED: scripts/check-features.mjs:36-49, 559-590; .agents/skills/cucumber/rules/features.md:107-124].
- **(g) Running.** `npx cucumber-js --profile builtin <file>` and `npx cucumber-js --profile adapter <file>` (both used for the probes, ~35 s each including the shared Pi); `npm run test:cucumber:profile -- --profile <p> <paths>`; one scenario with `--name '<title>'` [VERIFIED: .agents/skills/local-verification/rules/commands.md]. CI shards: `features/hook` is in the adapter components leg and the builtin leg's `features` path [VERIFIED: .github/workflows/ci.yml:140-147]; `behavioral-shard-coverage.test.ts` matches files by directory prefix (lines 102-121), so a new `features/hook/mcp-tool-names.feature` needs no shard entry.

### Q8. Claude Code 2.1.318 upstream

- Version: `2.1.318 (Claude Code)` (`/opt/claude-code/bin/claude --version`).
- Tool name: `function Wr(e,n){return\`${io(e)}${En(n)}\`}`, `function io(e){return\`${gR}${En(e)}__\`}`, `gR="mcp__"`, `function En(t){let r=t.replace(/[^a-zA-Z0-9_-]/g,"_");if(t.startsWith("claude.ai "))r=r.replace(/_+/g,"_").replace(/^_|_$/g,"");return r}` [VERIFIED: binary grep]. So both segments keep `-` and fold every other character outside `[a-zA-Z0-9_-]` to `_` (`.` included). No length cut appears in `Wr`/`io`/`En` [VERIFIED: binary grep]; whether another layer cuts names over 64 was not found [ASSUMED: no cut].
- Matching: `function M4(e,n,r,...){if(!n||n==="*")return!0;let S=cst(n,r,s)...;if(S!==void 0)return S.includes(e)||...; ... let H=fgr(n);if(H.test(e))return!0;...}` and `function cst(e,n,...){if(!(n?/^[a-zA-Z0-9_|, -]+$/:/^[a-zA-Z0-9_|]+$/).test(e))return;return e.split(n?/[|,]/:"|").map((y)=>y.trim())...}`, `function fgr(t){if(!q())return new RegExp(t);...}` [VERIFIED: binary grep]. Docs: "Only letters, digits, `_`, `-`, spaces, `,`, and `|`" -> exact string list; any other character -> "JavaScript regular expression, unanchored"; "Tools from a plugin-bundled MCP server use ... `mcp__plugin_<plugin-name>_<server-name>__<tool>`", e.g. `mcp__plugin_my-plugin_db__query`, and "`mcp__brave-search__.*` matches all tools from a server whose name contains a hyphen" [CITED: https://code.claude.com/docs/en/hooks]. So a Claude literal is compared exactly against the `-`-kept name, and a folded-server literal never fires upstream (matches D-P5-04).
- `tool_name` for an MCP tool in PreToolUse stdin is the tool's registered name (`mcp__<server>__<tool>`): "For tool events, that field is `tool_name`" [CITED: hooks docs]; the stdin builders pass the tool name verbatim (`tool_name:e,tool_input`) [VERIFIED: binary grep].
- Discovery tool: `ToolSearch` (`"ToolSearch"` in the built-in tool name lists; prompt text "load them with ToolSearch", `select:mcp__claude-in-chrom...`) [VERIFIED: binary grep]. Deferred (out of scope).

### Q9. `docs/hooks-compatibility.md` lines to change

- Line 119 (MCP literal row): add that under Pi's built-in MCP the matcher compares the server segment with the server's registered name (`-` kept) and fires when Pi's name for `<tool>` is the call's name, so Claude's full name (with `-` in the tool) fires, and a folded tool segment fires too; a folded server segment does not.
- Line 120 (MCP server prefix row): under built-in it compares `<server>` with the registered server name, not a prefix of Pi's tool name.
- Line 144 (prose after the unmapped list): the same, in one sentence.
- Line 146 (plugin MCP tools prose): built-in names. Under Pi's built-in MCP, a hook sees `mcp__<server>__<tool>` with the server as registered (`plugin_<plugin>_<server>`, or the `mcp.json` key), `-` kept; the tool segment keeps Pi's fold of `-` and other characters to `_` (Pi capability gap: Pi does not report the original tool name, D-MB-08); a name Pi cuts to 64 characters keeps Pi's cut and hash, and when the cut falls inside the server part the hook sees Pi's name (gap). The proxy paragraph gains "only while pi-mcp-adapter is the active MCP implementation; under Pi's built-in MCP, or with no MCP implementation, no call is a proxy call" (MHK-02).
- Lines 163-164 (`if` rows): note "under built-in, as the matcher above".
- Keep the table columns aligned (mdformat/Prettier run in pre-commit).

## Architecture Patterns

### System Architecture Diagram

```
 model / codemode script
        |  tool call (name = Pi's name, e.g. mcp__plugin_hook_demo_stub_server__echo)
        v
 Pi agent loop --unknown tool--> error result, no event
        | tool_call / tool_result (also for nested ctx.executeTool calls)
        v
 hooks composite handler (generation-guarded)
   bucket empty? --------------------------------------> return
   proxy-shaped? --yes--> proxyRuleApplies()? (lazy, once per generation,
        |                    openNotificationSnapshot -> "adapter")
        |                         --yes--> return (D-CF5-12)
        v
   identify(toolName): mcp__ name? --no--> {piName, name = piName}
        | yes: pi.getAllTools() -> tool with sourceInfo.path "builtin:mcp"
        |      and namespace.aliases[0]? --no / throws--> {piName, name = piName}
        v
   {piName, name = mcp__<alias>__<rest> | piName (cut in namespace), builtinServer = alias}
        |
   +----+-------------------+----------------------------+
   v                        v                            v
 matcher (literal: alias +  if field (same helpers)    hook event = {...event, toolName: name}
 createMcpToolName; prefix:                              -> stdin tool_name, notice label,
 S === alias)                                               block reason, ask dialog, feedback
        \______________________ run + fold ______________/
                                 v
                    adapters -> Pi (input mutated in place)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
  domain/components/hooks/builtin-mcp-tool-names.ts   # NEW pure: McpToolIdentity, toolLiteralNames, serverPrefixNames, claudeFormToolName
  bridges/hooks/mcp-tool-view.ts                       # NEW: HookTool, HookToolView, createHookToolView(pi)
  bridges/hooks/dispatch.ts                            # identity threading, proxy rule
  bridges/hooks/if-field/index.ts                      # optional identity parameter
  bridges/hooks/event-router.ts                        # one view per generation
test/domain/components/hooks/builtin-mcp-tool-names.test.ts   # NEW pair
test/bridges/hooks/mcp-tool-view.test.ts                      # NEW pair
test/bridges/hooks/{dispatch,event-router}.test.ts, if-field/index.test.ts  # extended
features/hook/mcp-tool-names.feature                  # NEW (D-P5-08, D-P5-09, D-P5-10, notice label)
features/hook/tool-use.feature                         # D-P5-11 pair, description edit
features/step_definitions/hook/tool-use.steps.ts       # profile-aware call step, mcp.json step
features/lib/hook-mcp-calls.ts                         # NEW script builder
features/lib/hook-mcp-tool-server.ts                   # NEW dashed-tool stdio stub
docs/hooks-compatibility.md
```

### Pattern 1: One per-event tool identity, a hook event copy for everything that prints

**What:** compute `HookTool` once per tool event; give the matcher and `if` the identity, and give the executor, labels, and adapters a shallow copy of the event with `toolName` replaced.
**When:** only PreToolUse (`compositeHandlerFor`) and `toolResultCompositeHandler`.
**Example (skeleton, values from the verified quotes above):**

```ts
// domain/components/hooks/builtin-mcp-tool-names.ts
import { createHash } from "node:crypto";

// Pi 1.5.0 `createMcpToolName` (`dist/extensions/mcp/tools.js`): 64 characters at most,
// a cut name keeps 55 and appends `_` and 8 hex of sha256(`<server>\0<tool>`).
const PI_TOOL_NAME_LIMIT = 64;
const PI_TOOL_NAME_HASH = 8;

/** The tool of a tool event as the hooks compare it (D-P5-01, D-P5-05). */
export interface McpToolIdentity {
  readonly piName: string;
  /** The registered server name of a tool Pi's built-in MCP serves; undefined for any other tool. */
  readonly builtinServer: string | undefined;
}

function piNames(server: string, tool: string): readonly string[] {
  const sanitized = `mcp__${server}__${tool}`.replaceAll(/\W/g, "_");
  const digest = createHash("sha256").update(`${server}\0${tool}`).digest("hex");
  const cut = `${sanitized.slice(0, PI_TOOL_NAME_LIMIT - PI_TOOL_NAME_HASH - 1)}_${digest.slice(0, PI_TOOL_NAME_HASH)}`;
  return sanitized.length <= PI_TOOL_NAME_LIMIT ? [sanitized, cut] : [cut];
}

/** D-P5-04 / D-P5-05: whether a matcher or `if` literal names the tool. */
export function toolLiteralNames(literal: string, tool: McpToolIdentity): boolean {
  if (tool.builtinServer === undefined) {
    return literal === tool.piName;
  }

  const prefix = `mcp__${tool.builtinServer}__`;
  return (
    literal.startsWith(prefix) &&
    literal.length > prefix.length &&
    piNames(tool.builtinServer, literal.slice(prefix.length)).includes(tool.piName)
  );
}

/** D-P5-04: whether a server prefix `mcp__<S>__` names the tool's server. */
export function serverPrefixNames(prefix: string, tool: McpToolIdentity): boolean {
  return tool.builtinServer === undefined
    ? tool.piName.startsWith(prefix)
    : prefix === `mcp__${tool.builtinServer}__`;
}

/** D-P5-02: `mcp__<server>__<rest>`, or Pi's name when Pi cut it inside `<namespace>__`. */
export function claudeFormToolName(piName: string, namespace: string, server: string): string {
  const prefix = `${namespace}__`;
  return piName.startsWith(prefix) ? `mcp__${server}__${piName.slice(prefix.length)}` : piName;
}
```

Note: `\W` without the `u` flag is exactly `[^A-Za-z0-9_]` per UTF-16 code unit (the frozen module states the same, `domain/mcp-implementation.ts:111-113`); `namespace` is Pi's `namespace.name`, which already starts with `mcp__`.

```ts
// bridges/hooks/mcp-tool-view.ts
import { claudeFormToolName, type McpToolIdentity } from "../../domain/components/hooks/builtin-mcp-tool-names.ts";
import { openNotificationSnapshot } from "../../shared/notification-run.ts";

import type { ExtensionAPI } from "../../platform/pi-api.ts";

// Pi marks the tools of its built-in MCP extension with this source path (MSEL-01).
const BUILTIN_MCP_SOURCE_PATH = "builtin:mcp";
const MCP_TOOL_PREFIX = "mcp__";

type PiTool = ReturnType<ExtensionAPI["getAllTools"]>[number];
export type HookToolSource = Pick<ExtensionAPI, "getAllTools" | "getCommands">;

export interface HookTool extends McpToolIdentity {
  /** The name every hook sees: stdin `tool_name`, the notice label (D-P5-03). */
  readonly name: string;
}

export interface HookToolView {
  identify(piName: string): HookTool;
  /** MHK-02 / D-P5-07: read once, at the first proxy-shaped call of the generation. */
  proxyRuleApplies(): boolean;
}

function asIs(piName: string): HookTool {
  return { piName, name: piName, builtinServer: undefined };
}

function builtinTool(piName: string, tool: PiTool | undefined): HookTool {
  const server = tool?.namespace?.aliases?.[0];
  if (tool?.sourceInfo.path !== BUILTIN_MCP_SOURCE_PATH || server === undefined) {
    return asIs(piName);
  }

  return { piName, name: claudeFormToolName(piName, tool.namespace.name, server), builtinServer: server };
}

export function createHookToolView(pi: HookToolSource | undefined): HookToolView {
  let adapterActive: boolean | undefined;
  return {
    identify(piName) {
      if (pi === undefined || !piName.startsWith(MCP_TOOL_PREFIX)) {
        return asIs(piName);
      }

      try {
        return builtinTool(piName, pi.getAllTools().find((tool) => tool.name === piName));
      } catch {
        return asIs(piName); // D-P5-01: a read that throws leaves the name as it is
      }
    },
    proxyRuleApplies() {
      adapterActive ??= pi !== undefined && openNotificationSnapshot(pi).softDeps.mcpImplementation === "adapter";
      return adapterActive;
    },
  };
}
```

(`tool.namespace.name` after the alias check needs a narrowing step the type checker accepts; write it as `const namespace = tool?.namespace` first. The literal `"builtin:mcp"` is quoted verbatim from `platform/pi-api.ts:323-328`: `command.sourceInfo?.path === "builtin:mcp"`; the pi-api helper is module-private and frozen, so a local constant is the only option.)

```ts
// dispatch.ts, inside the factories
function toolEventView(
  event: ToolCallEvent | ToolResultEvent,
  tools: HookToolView,
): ToolEventView | undefined {
  if (isMcpProxyCall(event) && tools.proxyRuleApplies()) {
    return undefined; // D-CF5-12, only under the adapter (MHK-02)
  }

  const tool = tools.identify(event.toolName);
  return { event: tool.name === event.toolName ? event : { ...event, toolName: tool.name }, tool };
}

function matcherFiresOnToolEvent(matcher: ParsedMatcher, tool: McpToolIdentity): boolean {
  switch (matcher.kind) {
    case "match-all":
      return true;
    case "tool-set":
      return (
        [...matcher.toolNames].some((literal) => toolLiteralNames(literal, tool)) ||
        (matcher.toolPrefixes?.some((prefix) => serverPrefixNames(prefix, tool)) ?? false)
      );
    case "regex":
    case "unmapped":
      return false;
  }
}
```

### Pattern 2: Profile-aware MCP call step (D-P5-08)

```ts
// features/lib/hook-mcp-calls.ts
import { profileFor } from "../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import type { McpProfile } from "./mcp-implementation.ts";
import type { ScriptStep } from "./scripted-model/script.ts";

export function hookMcpCallScript(profile: McpProfile, plugin: string, server: string,
  tool: string, args: Readonly<Record<string, unknown>>, reply: string): ScriptStep[] {
  const name = profileFor(profile).toolName(plugin, server, tool);
  return profile === "adapter"
    ? [{ tool: "mcp", arguments: { tool: name, args } }, { reply }]
    : [{ tool: "tool_search", arguments: { query: name, limit: 1 } }, { tool: name, arguments: args }, { reply }];
}
```

The step in `hook/tool-use.steps.ts` writes it with `writeModelScript(this.profileHarness(), steps)` and asserts `readModelScript` round-trips, as `model.steps.ts:85-93` does. Its text names the hooks' topic (D-08), e.g. `Given the scripted model calls the tool {string} of the hooks' stub mcp server {string} of the plugin {string} through the mcp implementation with {string}, then replies {string}`.

### Anti-Patterns to Avoid

- **Mutating `event.toolName` in place:** the Pi event object is shared with later extensions' handlers and Pi's own pipeline; use a shallow copy.
- **Deep-copying the event (`structuredClone`) for the hook view:** `replaceToolCallInput` (event-adapters.ts:138-155) rewrites `event.input` in place; a deep copy would drop the rewrite. A shallow spread keeps `input` and `content` shared.
- **Comparing `toolNames.has(piName)` for a built-in tool:** a folded-server literal equals Pi's name and would fire, against D-P5-04 and upstream.
- **Building a `RegExp` from plugin text** for matching: keep string operations (matcher.ts header, MATCH-02).
- **Reading the inventory at factory time or for every tool event:** read only for `mcp__` names, and the implementation only on proxy-shaped calls (strict-mock tests in `test/index.test.ts`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Which implementation is active | a new probe of commands/tools | `openNotificationSnapshot(pi).softDeps.mcpImplementation` | MSEL-01/ADET-02 precedence and D-JO-01 single caller |
| Which server a built-in tool belongs to | parsing `mcp__<x>__<y>` from Pi's name | `namespace.aliases[0]` from `getAllTools()` | the folded and cut name cannot be inverted |
| The tool name each profile gives the stub | hard-coded strings in the step | `profileFor(id).toolName(plugin, server, tool)` | frozen, already matches both implementations |
| Waiting for the stand-in's listing | a new poll | `the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}` | handles cut names (CR-02) |
| JSON-RPC for the dashed-tool stub | an SDK dependency | a tiny hand-written stdio server in a different shape from the frozen stub | no undeclared dependency (fallow unlisted-dependency), no clone group |

## Common Pitfalls

### Pitfall 1: D-P5-06 says `softDepStatus(pi)`, D-JO-01 says only notification-run calls it
**What goes wrong:** a direct `softDepStatus` import in `bridges/hooks` breaks the recorded "one soft-dep snapshot caller" decision (PROJECT.md:1687), although no test enforces it.
**How to avoid:** call `openNotificationSnapshot(pi)` from `shared/notification-run.ts` (it is `{ softDeps: softDepStatus(pi) }`). Same answer, same probe counts.

### Pitfall 2: D-P5-02's "namespace prefix `mcp__<namespace name>__`"
**What goes wrong:** Pi's `namespace.name` already is `mcp__<folded>`; prepending `mcp__` again never matches, so every built-in name stays in Pi's form.
**How to avoid:** strip `` `${namespace.name}__` ``. Unit-test with `namespace: { name: "mcp__plugin_hook_demo_stub_server", aliases: ["plugin_hook-demo_stub-server"] }`.

### Pitfall 3: A long name whose 55th kept character is `_`
**What goes wrong:** `slice(0, 55)` ending in `_` plus `_<hash>` yields `__`, so the name is not proxy-shaped and D-P5-10 tests nothing (`hooks-on-a-built-in-mcp-tool-whose-name-pi-cuts`). A namespace of exactly 56 characters (`<ns>__` cut to `<ns>_`) also makes a name that still starts with `<ns>__`, with an 8-hex rest.
**How to avoid:** use `hook-proxy-shaped-tool-names-of-a-long-plugin`; decide "kept" by `startsWith(\`${namespace.name}__\`)`, never by a length rule; unit-test both edges.

### Pitfall 4: Upstream text in the D-P5-11 built-in twin
**What goes wrong:** a `*` PostToolUse hook also runs on `tool_search`, whose `tool response` is Pi's wording (probe). The cucumber rules forbid stating upstream wording, and the runs table must list every column.
**How to avoid:** in the built-in twin keep `any | PreToolUse | *` (its `tool input` is our script's `{"query":...,"limit":1}`, empty `tool response`) and make the PostToolUse hook a Claude-form literal.

### Pitfall 5: The D-P5-11 built-in twin is not red with `demo`/`stub`
**What goes wrong:** with no `-` the Pi name equals the Claude name and no proxy shape occurs, so the twin passes on the Phase 1 tree (D-P5-12 asks for red).
**How to avoid:** move the pair to `hook-demo`/`stub-server` (both halves; the adapter half is an owned file) so the twin's Claude-form literal fails on the Phase 1 tree, or record the twin as a coverage-only scenario.

### Pitfall 6: Existing proxy unit tests flip
**What goes wrong:** `dispatch.test.ts:3179-3275` passes `pi = undefined`; under MHK-02 that is "none", so the `runs: false` rows run hooks.
**How to avoid:** give those rows an adapter inventory (`{ getAllTools: () => [], getCommands: () => [adapterCommand()] }`) and add built-in (`builtinMcpCommand()`) and none rows; assert the memo reads once (`t.mock.fn` call count).

### Pitfall 7: `mcp.json` written while another Pi could read it
**What goes wrong:** the shared Pi shares the sandbox agent dir; a session restart there would start the stub too.
**How to avoid:** write `{agent dir}/mcp.json` after the install `Given` and right before `pi runs with the scripted model and the mcp implementation`; the next scenario's `Before()` empties the sandbox.

### Pitfall 8: fallow dead code and type leaks in new modules
**What goes wrong:** `production.deadCode: true` reports an export used only by tests; an exported signature using a non-exported type reports `private-type-leak`.
**How to avoid:** export only what `dispatch.ts`, `event-router.ts`, and `if-field/index.ts` import (`McpToolIdentity`, `toolLiteralNames`, `serverPrefixNames`, `claudeFormToolName`, `HookTool`, `HookToolView`, `HookToolSource`, `createHookToolView`); export every type named in an exported signature.

## Code Examples

See Pattern 1 and Pattern 2. Scenario sketches (step texts are the writer's; `|` columns as the runs step needs them):

```gherkin
Feature: Hook mcp tool names

  A hook of a bridged plugin sees a plugin MCP tool under Claude Code's name,
  whichever MCP implementation serves it. A scripted model, the hooks' stub
  MCP server, and a recording hook stand in for real ones.

  @mcp
  Scenario: Hooks on a plugin MCP tool match and see the tool under Claude's server name
    # plugin hook-demo, server stub-server; hooks: literal PreToolUse mcp__plugin_hook-demo_stub-server__echo,
    # prefix PreToolUse mcp__plugin_hook-demo_stub-server__.*, iffed PreToolUse * if mcp__plugin_hook-demo_stub-server__echo,
    # after PostToolUse mcp__plugin_hook-demo_stub-server__echo
    # install --scope user (which did not fail); stand-in step; pi runs with the scripted model and the mcp implementation;
    # listing wait; profile-aware call step; prompt; 4 runs, tool name mcp__plugin_hook-demo_stub-server__echo

  @builtin-only
  Scenario: A hook sees a built-in tool's server segment with "-" and its tool segment folded (MHK-01, D-MB-08)
    # hooks-only plugin; literal PreToolUse mcp__echo-server__echo-text; user mcp.json server echo-server, tool echo-text, direct;
    # script: mcp__echo_server__echo_text {"text":"ping"}, Done.; 1 run, tool name mcp__echo-server__echo_text

  @builtin-only
  Scenario: A built-in tool whose cut name looks like a proxy call still runs its hooks (MHK-02)
    # plugin hook-proxy-shaped-tool-names-of-a-long-plugin with stub-server; hooks any PreToolUse *,
    # literal PreToolUse mcp__plugin_hook-proxy-shaped-tool-names-of-a-long-plugin_stub-server__echo;
    # script: tool_search {"query":"mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d","limit":1},
    # mcp__plugin_hook_proxy_shaped_tool_names_of_a_long_plug_b152d32d {"text":"ping","tool":"echo"}, Done.;
    # runs: any on tool_search, any and literal on the tool, tool name = Pi's cut name
```

Optional fourth `@mcp` scenario for the D-P5-03 label: a hook with a `systemMessage` output on the Claude-form literal, then `the hooks show the user these messages:` with `PreToolUse:mcp__plugin_hook-demo_stub-server__echo says: ...` (red under builtin on the Phase 1 tree, parity under the adapter).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D-CF5-12 proxy rule always on | only while the adapter is the active implementation | this phase (MHK-02) | built-in tools with proxy-shaped cut names fire hooks |
| Hooks compare Pi's name for every tool | built-in tools compare by registered server + Pi's `createMcpToolName` | this phase (MHK-01) | Claude Code matchers fire under built-in |

**Deprecated/outdated:** the `tool-use.feature` description line "until the built-in tool names (MHK-01, MHK-02) lift its tag".

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Claude Code 2.1.318 does not cut MCP tool names over 64 characters anywhere outside `Wr`/`io`/`En` | Q8 | the D-P5-02 "gap" for long names would be smaller than stated; docs wording only |
| A2 | Pi's argument validation (pi-schema `compile(..., { coerce: true })`) accepts the extra `tool` property in `{"text":"ping","tool":"echo"}` for the stub's echo schema (no `additionalProperties: false`) | D-P5-10 | the D-P5-10 call fails validation before `tool_call`; fall back to a stub schema with an optional `tool` property (needs a new stub) |
| A3 | A user `mcp.json` stdio server with `direct` exposure connects and is declared before the scripted model's first call in the profile Pi | D-P5-09 | the direct call reads "Tool not found"; then add `tool_search` or a listing wait |
| A4 | The new dashed-tool stub, written in a handler-table shape, forms no fallow clone group with `features/lib/mcp-stub-server.ts` | Q7(e) | `npm run fallow` fails; reshape or add a reviewed `fallow-ignore-next-line code-duplication` marker in the new file only |

## Open Questions

1. **Should a built-in tool ever be a proxy call under the adapter?**
   - Known: D-P5-06 keys only on the active implementation. With both the adapter and built-in loaded (user re-enabled built-in), a built-in cut-name tool with a string `tool` input would still be skipped.
   - Recommendation: optional hardening `isMcpProxyCall(event) && tools.proxyRuleApplies() && tools.identify(name).builtinServer === undefined` (one extra `getAllTools` read on adapter proxy calls). Planner decides; log as a dubious choice if adopted.
2. **Cache identities per generation?** Recommendation: no cache (one `getAllTools` per MCP tool event; tools can (re)register while connected). Discretion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | runs `.ts` natively (probes ran) | -- |
| Pi | profile Pis | ✓ | 1.5.0 | -- |
| pi-mcp-adapter (peer cache) | adapter profile | ✓ | 7.0.0 (`node scripts/install-test-peers.mjs`, run this session) | -- |
| pi-subagents, pi-dynamic-workflows (peer cache) | other scenarios | ✓ | 0.84.0, 3.15.0 | -- |
| Claude Code binary | upstream greps | ✓ | 2.1.318 at `/opt/claude-code/bin/claude` | docs |
| `nondac-sh` wrapper | npm scripts as root | stated by parent | -- | -- |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock`; cucumber-js with profiles `adapter`/`builtin` |
| Config file | `package.json` scripts, `cucumber.json` (frozen) |
| Quick run command | `node --test test/bridges/hooks/dispatch.test.ts` (any pair) |
| Full suite command | `npm run check` (includes both cucumber profiles) plus `npm run test:modules` at the phase gate |

### Phase Requirements -> Test Map
| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-P5-04 | literal with `-` tool, folded tool, folded server (no fire), long cut, forced hash, collision pair; prefix by alias | unit | `node --test test/domain/components/hooks/builtin-mcp-tool-names.test.ts` | ❌ Wave 0 |
| D-P5-02 | Claude-form name: kept prefix, cut inside namespace, 56-char namespace edge | unit | same | ❌ Wave 0 |
| D-P5-01 | identify: non-`mcp__` reads nothing; throwing read, missing tool, foreign source, no alias -> as is; built-in -> alias | unit | `node --test test/bridges/hooks/mcp-tool-view.test.ts` | ❌ Wave 0 |
| D-P5-06/07 | proxyRuleApplies: adapter true, builtin false, none false, `pi` undefined false; one read across calls | unit | same | ❌ Wave 0 |
| D-P5-03 | stdin `tool_name`, notice label, block reason, ask label, PostToolUse feedback use the Claude-form name; Pi `input` mutation still lands | unit | `node --test test/bridges/hooks/dispatch.test.ts` | ✅ extend |
| MHK-02 | proxy rows under adapter (skip), builtin and none (run); tool_result too | unit | same | ✅ extend (rows at 3179-3275) |
| D-P5-04 (`if`) | `mcp-literal`/`mcp-server-prefix` arms with a built-in identity | unit | `node --test test/bridges/hooks/if-field/index.test.ts` | ✅ extend |
| D-P5-07 | one view per generation passed to both tool handlers | unit | `node --test test/bridges/hooks/event-router.test.ts` | ✅ extend |
| MSEL-01 | no factory-time read | architecture | `node --test test/architecture/no-factory-time-probe.test.ts` | ✅ |
| MHK-01 / D-P5-08 | Claude-form literal, prefix, `if`, PostToolUse literal run once each with `mcp__plugin_hook-demo_stub-server__echo` | cucumber `@mcp` | `npx cucumber-js --profile builtin features/hook/mcp-tool-names.feature` and `--profile adapter` | ❌ Wave 0 |
| MHK-01 / D-P5-09 | `mcp__echo-server__echo-text` fires; hook sees `mcp__echo-server__echo_text` | cucumber `@builtin-only` | `npx cucumber-js --profile builtin features/hook/mcp-tool-names.feature` | ❌ Wave 0 |
| MHK-02 / D-P5-10 | proxy-shaped cut name runs `*` and literal hooks under built-in | cucumber `@builtin-only` | same | ❌ Wave 0 |
| MHK-02 / D-P5-11 | adapter half keeps de-dup; built-in half runs `*` on `tool_search` and the tool | cucumber pair | `npx cucumber-js --profile <p> features/hook/tool-use.feature` | ✅ edit |
| tags | every MCP scenario in `features/hook/` has one implementation tag and an ID | static | `npm run check:features` | ✅ |
| coverage | 100% direct coverage of each touched pair | coverage | `npm run test:coverage:direct -- <source>` | ✅ |

Red proofs (D-P5-12): run each new scenario on the Phase 1 tree before the product change, for example from a scratch copy of the feature file (`npx cucumber-js --profile builtin <scratch file>` works for files outside `features/`; used for the probes), and record the failing run per profile in the SUMMARY. Expected: D-P5-08 red under builtin, green under adapter (probe-confirmed both ways); D-P5-09 and D-P5-10 red under builtin; D-P5-11 twin red only with dashed names (Pitfall 5).

### Sampling Rate
- **Per task commit:** the owner tests of the touched pairs plus `npm run check:static`; the commit hook runs `check:commit`.
- **Per wave merge:** `npm run check` (both cucumber profiles included).
- **Phase gate:** `npm run check` plus `npm run test:modules`, both profiles green.

### Wave 0 Gaps
- [ ] `test/domain/components/hooks/builtin-mcp-tool-names.test.ts` -- D-P5-02, D-P5-04
- [ ] `test/bridges/hooks/mcp-tool-view.test.ts` -- D-P5-01, D-P5-06, D-P5-07
- [ ] `features/hook/mcp-tool-names.feature`, `features/lib/hook-mcp-calls.ts`, `features/lib/hook-mcp-tool-server.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes (hooks can block or rewrite tool calls) | a hook must not be skipped where it ran before except under the adapter's proxy rule; built-in calls never skip |
| V5 Input Validation | yes | matcher and `if` text from plugins compared with string operations only, no `RegExp` from plugin text; tool data read from Pi's own registry |
| V6 Cryptography | no (sha256 reproduces a name, not a secret) | `node:crypto` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A guard hook stops firing because the name a hook sees changed | Elevation (bypass) | D-P5-04 fires both Claude's and the folded tool spelling; folded-server literals stop firing only under built-in -- document in hooks-compatibility.md |
| Proxy rule skipping a real built-in call | Elevation | MHK-02: rule only under the adapter |
| Another extension's tool posing as built-in MCP | Spoofing | identity requires `sourceInfo.path === "builtin:mcp"`, which only Pi's built-in loader sets (loader.js:504) |
| ReDoS from plugin matcher text | DoS | no regex built; `startsWith`/equality only |

## Sources

### Primary (HIGH confidence)
- `node_modules/@earendil-works/pi-coding-agent` 1.5.0: `dist/core/agent-session.js`, `dist/core/source-info.js`, `dist/core/resource-loader.js`, `dist/core/extensions/loader.js`, `dist/core/extensions/types.d.ts`, `dist/core/mcp-servers.js`, `dist/extensions/mcp/{index,tools,config}.js`, `dist/extensions/tool-search/tool.js`, `dist/extensions/index.js`; `node_modules/@earendil-works/pi-agent-core/dist/agent-loop.js`.
- pi-mcp-adapter 7.0.0 in `node_modules/.cache/optional-peers` (`index.ts`, `mcp-references.ts`, `types.ts`).
- Repo sources read this session: `bridges/hooks/{dispatch,event-router,event-adapters,dispatch-exec,hook-labels,translation-context}.ts`, `bridges/hooks/if-field/index.ts`, `bridges/hooks/payloads/*tool*.ts`, `domain/components/{hook-tool-names,hooks/matcher}.ts`, `domain/mcp-implementation.ts`, `domain/name.ts`, `platform/pi-api.ts`, `shared/notification-run.ts`, the frozen harness files listed in Q7, `.fallowrc.json`, `rule-packs/architecture.json`, `cucumber.json`, `.github/workflows/ci.yml`.
- Two cucumber probes on this tree (builtin and adapter) and one fallow dupes probe, all in `/tmp/claude-0/-home-user-pi-claude-marketplace/5f93b531-ce41-57f0-a1f7-9f708584a490/scratchpad/researcher/`.
- Claude Code 2.1.318 binary greps (`/opt/claude-code/bin/claude`).

### Secondary (MEDIUM confidence)
- https://code.claude.com/docs/en/hooks (matcher evaluation table, MCP naming, plugin server naming).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependency.
- Architecture: HIGH -- every site read; call graph and skeleton checked against the boundary zones and a dupes probe.
- Pitfalls: HIGH for 1-6 (read or probed), MEDIUM for 7-8.

**Research date:** 2026-11-04
**Valid until:** 2026-12-04 (Pi pinned at 1.5.0; re-check if Pi or pi-mcp-adapter moves)
