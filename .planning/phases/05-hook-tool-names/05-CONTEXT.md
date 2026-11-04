# Phase 5: Hook Tool Names - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 runs in a parallel child session on `features/mcp-builtin-phase-5`. It
makes plugin hooks see Pi's built-in MCP tools under Claude Code's names, and
it limits pi-mcp-adapter's proxy rule to the adapter:

- Under Pi's built-in MCP, a plugin hook whose matcher (or `if` field) names an
  MCP tool with Claude's server segment, `-` kept, fires once on the built-in
  tool call. The hook's stdin, its notice label, and its matcher all see the
  tool under Claude's form, and only the tool segment keeps Pi's `-` to `_`
  fold, a divergence licensed by a Pi capability gap (MHK-01, D-MB-08).
- The pi-mcp-adapter `mcp` proxy special case (D-CF5-12) applies only while the
  adapter is the active MCP implementation. Under built-in, or with no
  implementation, no call is a proxy call (MHK-02).
- `docs/hooks-compatibility.md` states the built-in tool names and the
  divergences, and every MCP scenario in `features/hook/` runs under both
  profiles or carries an implementation tag.

Requirements: MHK-01, MHK-02. Phase 5 owns `bridges/hooks/**`,
`domain/components/hooks/**`, `docs/hooks-compatibility.md`, their unit pairs,
`test/integration/hooks-*`, `features/hook/**`, the `hook/**` step modules,
and `features/lib/hook-files.ts`. It edits no frozen file and no MCP file
outside hooks. Out of scope: every plugin state, marker, or per-server verdict
row (Phase 3), the extension's own built-in registration (Phase 2), and the
CHANGELOG and READMEs (Phase 6, MDOC-02).

The user's standing instruction for this run: decide by this project's
conventions and Claude Code upstream parity (2.1.318), never stop to ask, and
log every questionable choice in `DUBIOUS-CHOICES.md` in this directory
(`P5-DC-NN`), sending each step's new entries to the parent session.

</domain>

<decisions>
## Implementation Decisions

### What Pi tells the hooks bridge about a built-in tool

- **D-P5-01:** (built-in tool identity) A tool call is a built-in MCP tool call
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
- **D-P5-02:** (the Claude-form name) A built-in tool's Claude-form name is
  `mcp__<alias>__<rest>`, where `<rest>` is Pi's tool name after the
  namespace prefix `<namespace name>__` (Pi's namespace name already starts
  with `mcp__`, research Q1). The tool segment keeps Pi's
  sanitizing (`-` and every other character outside `[A-Za-z0-9_]` become
  `_`) and, for a name Pi cut at 64 characters, Pi's cut and hash. When Pi's
  cut falls inside the namespace, the name does not start with the namespace
  prefix and the hook sees Pi's name unchanged (a recorded gap). The rule
  covers every built-in server, plugin or `mcp.json`, because Claude Code
  names every server's tools `mcp__<server>__<tool>` with `-` kept.
- **D-P5-03:** (where the name shows) The Claude-form name is the tool name
  everywhere a hook sees one: the `tool_name` of the PreToolUse, PostToolUse,
  and PostToolUseFailure stdin, the `PreToolUse:<tool>` notice label
  (D-CF5-14), the matcher, and the `if` field.
- **D-P5-04:** (matching a built-in tool) An MCP literal `mcp__<S>__<T>` in a
  matcher or an `if` field fires on a built-in tool when `<S>` is the tool's
  alias and Pi 1.5.0's `createMcpToolName(S, T)` names the event's tool: the
  sanitized name, the 55-character cut with the 8-hex sha256 of `S\0T` for a
  long name, or the hashed form Pi gives two tools that sanitize to one name.
  So a matcher that names the tool as Claude Code does, `-` in the tool
  segment included, fires; a matcher with the tool segment folded fires too,
  because the two cannot be told apart; a matcher whose server segment is
  folded does not fire. A server prefix `mcp__<S>__.*` (and the `if` forms
  `mcp__<S>` and `mcp__<S>__*`) fires when `<S>` is the alias.
- **D-P5-05:** (every other tool) A tool pi-mcp-adapter serves keeps today's
  comparison against Pi's name, which already is Claude's form (ANAME-01).
  So does every non-MCP tool and every `mcp__` tool from another source.

### The adapter's proxy rule (MHK-02)

- **D-P5-06:** (proxy rule scope) The D-CF5-12 rule (a call to `mcp` or to a
  namespace proxy `mcp__<server>` with a string `tool` and no `action` runs no
  hook) applies only when the active MCP implementation is the adapter, as
  `softDepStatus(pi).mcpImplementation === "adapter"` defines it (MSEL-01,
  ADET-02), read through `openNotificationSnapshot(pi).softDeps`, the one
  caller of `softDepStatus` (D-JO-01). Under built-in or none, no call is a proxy call, so a built-in
  tool whose cut name has no second `__` and whose input holds a string
  `tool` still fires its hooks.
- **D-P5-07:** (when the bridge reads it) The bridge reads the active
  implementation lazily, at the first proxy-shaped call of a bridge
  generation, and keeps the answer for that generation: the set of loaded
  extensions changes only on `/reload` or a new Pi, and either one registers
  a new generation. No read is added at `session_start`, so the run
  snapshot's probe counts stay as Phase 1 froze them.

### Behavioral scenarios

- **D-P5-08:** (shared scenario) A new `features/hook/mcp-tool-names.feature`
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
- **D-P5-09:** (tool-segment fold) An `@builtin-only` scenario (MHK-01)
  pins the one divergence: a server that Pi's `mcp.json` configures, with a
  `-` in its name and a tool with a `-` in its name, served by a Phase 5 stub
  library with `direct` exposure. A matcher with Claude's full name fires, and
  the hook sees the server segment with `-` and the tool segment with `_`.
  The frozen stub offers only `echo`, and the extension's own registration
  (Phase 2) merges after this phase, so a plugin server cannot carry such a
  tool here.
- **D-P5-10:** (proxy-shaped built-in name) An `@builtin-only` scenario
  (MHK-02) installs a plugin whose name is long enough that Pi cuts the tool
  name inside the namespace, so the name has no second `__`; the model calls
  it with a string `tool` in its input. A `*` hook and a Claude-form literal
  hook fire. The hook sees Pi's cut name (D-P5-02 gap).
- **D-P5-11:** (the Phase 1 tag) The `@adapter-only` scenario Phase 1 left in
  `features/hook/tool-use.feature` ("A hook on a plugin MCP tool runs once per
  call under the real tool name") becomes an `@adapter-only` and
  `@builtin-only` pair in that file. The adapter half keeps the proxy de-dup
  (D-CF5-12, MHK-02): the outer `mcp` call runs no hook. The built-in half has
  no proxy: the PreToolUse `*` hook runs once on `tool_search` and once on the
  tool call; its PostToolUse hook is a Claude-form literal, because a `*`
  PostToolUse row would pin Pi's own `tool_search` result text. Both halves
  move to the plugin `hook-demo` and the server `stub-server`, so the built-in
  half fails on the Phase 1 tree (D-P5-12).
  The feature description's "until MHK-01, MHK-02 lift its tag" goes.
- **D-P5-12:** (red proof) Each new scenario fails on the Phase 1 tree under
  each profile where it applies, and the plan SUMMARY records the failing run
  per profile. The shared scenario applies to the behavior change under
  built-in only; under the adapter it is a parity guard and passes on the
  Phase 1 tree.

### Code placement and documentation

- **D-P5-13:** (modules) The pure Pi-name computation goes in a new module
  under `domain/components/hooks/` (with its unit pair), and the dispatch-time
  tool lookup in a new module under `bridges/hooks/`. The frozen profile's
  private `builtinToolName` in `domain/mcp-implementation.ts` takes a plugin
  and a server, not a registered name, so it cannot serve an `mcp.json` server
  and is not reused; both cite Pi 1.5.0 `createMcpToolName`. The translators,
  the label, the matcher check, and the `if` check read one per-event tool
  identity computed once per event.
- **D-P5-14:** (docs) `docs/hooks-compatibility.md` gains the built-in tool
  names, the tool-segment fold, the cut-name gap, and the proxy rule's scope.
  The CHANGELOG and README lines go to the parent (Phase 6, MDOC-02).

### Claude's Discretion

- The module and function names, the per-event identity's shape, whether the
  dispatch-time tool lookup is cached within a generation, the exact step
  texts, and the long plugin name of D-P5-10.
- Whether `domain/components/hook-tool-names.ts` (a hooks file outside the
  `domain/components/hooks/**` glob, owned by no other phase) changes; prefer
  leaving it as it is.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/components/hooks/matcher.ts` `parseMatcher`: MCP literals join
  `toolNames`, server prefixes join `toolPrefixes` (ANAME-02).
- `bridges/hooks/dispatch.ts`: `matcherFiresOnToolEvent`, `entryFires`,
  `noticeLabel`, `isMcpProxyCall`, `isProxiedToolCall`,
  `compositeHandlerFor`, `toolResultCompositeHandler`.
- `bridges/hooks/if-field/index.ts`: the `mcp-literal` and
  `mcp-server-prefix` predicates, compared against `event.toolName`.
- `domain/components/hook-tool-names.ts` `mapPiToClaudeToolName`, called by
  the three tool payload translators and `hook-labels.ts`.
- `platform/pi-api.ts` `softDepStatus` (frozen) for the active
  implementation; `ExtensionAPI["getAllTools"]` returns Pi's `ToolInfo` with
  `namespace` and `sourceInfo`.
- Harness (frozen): `a stand-in registers the stub mcp server {string} of the
  plugin {string} with pi's built-in mcp`, `pi runs with the scripted model
  and the mcp implementation`, `the mcp implementation has listed the tools of
  the stub mcp server {string} of the plugin {string}`, `the scripted model
  plays these steps:`, `the hooks record these runs`.

### Established Patterns

- Hook dispatch reads Pi only through the `pi` its handlers receive per
  generation; `capturedGeneration` guards every handler.
- Profile-specific expectations are `@adapter-only` and `@builtin-only` pairs
  in one file, each naming a requirement or decision ID.

### Integration Points

- The `tool_call` and `tool_result` handlers registered in
  `bridges/hooks/event-router.ts` `registerHooksBridgeWith`.
- Pi 1.5.0 calls only declared tools from the model: a deferred built-in tool
  needs `tool_search` first; `mcp.json` servers default to `codemode`
  exposure unless they set `exposure`.

</code_context>

<specifics>
## Specific Ideas

- Pi's `createMcpToolName(server, tool, isTaken)`: the name is
  `mcp__<server>__<tool>` with `[^A-Za-z0-9_]` replaced by `_`; over 64
  characters, or taken, it is the first 55 characters, `_`, and the first 8
  hex of `sha256(server + "\0" + tool)`.
- Upstream reference: Claude Code 2.1.318 names a plugin server's tools
  `mcp__plugin_<plugin>_<server>__<tool>` with `-` kept (ANAME-01, D-MB-13),
  and its hook matchers compare against that name.

</specifics>

<deferred>
## Deferred Ideas

- Naming Pi's `tool_search` as Claude Code's `ToolSearch` in hook stdin and
  matchers (both are the deferred-tool discovery tool); not an MHK
  requirement.
- Recovering the original tool segment from a tool result's `details.tool`:
  a PreToolUse event has no details, so the two events would disagree.

</deferred>
