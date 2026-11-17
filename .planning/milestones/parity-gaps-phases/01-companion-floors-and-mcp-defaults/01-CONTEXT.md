# Phase 1: Companion Floors and MCP Defaults - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the user answered four grey areas (one changed, three accepted as recommended).

<domain>
## Phase Boundary

Phase 1 raises the two companion floors and models what the new floors do. It delivers four requirements:

- **PG-AGENT-02:** the declared pi-subagents floor is 0.87.0 in `package.json`, `README.md`, `README.es.md`, and `scripts/install-test-peers.mjs`, and the documentation no longer describes the two fixed pi-subagents bugs as open.
- **PG-AGENT-07b:** a model ID that `--map-model` writes has no provider prefix. It lands in the same change as PG-AGENT-02, because from pi-subagents 0.87.0 an ID with the `anthropic/` prefix always runs on that provider.
- **PG-MCP-02:** the declared pi-mcp-adapter floor is 7.0.1, and a plugin tool whose Claude Code name is longer than 64 characters works wherever the project names it under the adapter: the server listing, a hook matcher and the name a hook receives, and an agent's disallowed-tool entry.
- **PG-MCP-01:** a plugin MCP server that declares no `timeout` gets Claude Code's idle window under both implementations: 30 minutes for a stdio server and 5 minutes for a remote server.

The floor raises are the first work of the phase, because every later test of the milestone runs against them. The phase also lands the record corrections that name these requirements: `docs/mcp-compatibility.md` (lines 126, 277, 381, 588, and 592), BACKLOG MCPBG-01, and `.planning/upstream/pi-subagents-mcp-direct-tools.md`.

Out of this phase: reading `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`, the alias table update (AGENT-06), `model: inherit` (PG-AGENT-07a, Phase 7), and the launch mode of bridged agents (PG-AGENT-01, Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Companion floors (D-PG1-01 to D-PG1-03)

- **D-PG1-01:** peer ranges. `pi-subagents` is `>=0.87.0` with no upper bound, as today. `pi-mcp-adapter` is `>=7.0.1 <8`. These are decisions 2 and 3 of the PRD's section 5.1 in today's range form.
- **D-PG1-02:** the suites run pi-subagents 0.88.0, not the declared floor (the user's change). The declared floor stays 0.87.0, and `scripts/install-test-peers.mjs` installs pi-subagents 0.88.0, the milestone baseline. This amends PIFL-02 for pi-subagents only: pi-mcp-adapter (7.0.1) and pi-dynamic-workflows (3.15.0) still install the lowest version their range admits. It also amends the wording of the roadmap's success criterion 1 for this phase: the suites install and run pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1. The planner records the amendment in `PROJECT.md` with its consequence: no suite proves that 0.87.0 works, so the 0.87.0 floor rests on the pi-subagents changelog and source (decision 2's premise). The script's header comment and `--before` cap follow the new rule.
- **D-PG1-03:** the foreground-refusal scenarios stay. Both scenarios in `features/mcp-server/agent-grants.feature` ("A foreground run of an agent granted a plugin MCP tool is refused before the child runs", for each implementation) are kept and pinned to the text that the installed pi-subagents (0.88.0) prints, measured in this phase. If that version no longer refuses the run, the scenario pins what it does instead, and the D-CF6-10 text in `docs/mcp-compatibility.md` is corrected to match. A call of the tool by a real background child stays a live check (BACKLOG AGTASYNC-01), and the phase says how it was checked.

### Mapped model IDs (D-PG1-04 to D-PG1-06)

- **D-PG1-04:** `--map-model` writes a bare ID. Every alias of `MODEL_MAP` and a `claude-*` passthrough ID are written with no provider prefix, such as `model: claude-sonnet-5-5`.
- **D-PG1-05:** installed agents change at the next `update --map-model`. An agent file that holds `anthropic/claude-...` keeps it until then; `reinstall` has no `--map-model` flag. Nothing rewrites the file at load (APL-D1). The CHANGELOG entry says so.
- **D-PG1-06:** the alias table is unchanged. `fable` and `best` stay `claude-fable-5-1`. Bringing the table to 2.1.322 is AGENT-06 (P2, not scheduled).

### Long tool names under the adapter (D-PG1-07 to D-PG1-10)

- **D-PG1-07:** one rule, in the adapter profile. The 64-character rule of pi-mcp-adapter 7.0.1 (the first 55 characters, `_`, and the first 8 hexadecimal digits of the SHA-256 of the full joined name) lives in one function of the adapter profile in `domain/mcp-implementation.ts`. The listing, the hooks bridge, and the agents bridge call it.
- **D-PG1-08:** a hook receives the full Claude Code name whenever the bridge can recover it. A matcher written with the full Claude Code name matches the shortened tool, and the hook receives the full name. For a matcher that is not the full name (`*`, a server prefix), the research measures what adapter 7.0.1 exposes about a shortened tool (for example the original tool name in Pi's tool list or in the tool result), and the bridge sends the full name when it can build it. Where it cannot, the hook gets the shortened name, and `docs/mcp-compatibility.md` records that as a pi-mcp-adapter capability gap.
- **D-PG1-09:** a test holds the rule against the installed adapter. A test calls the installed adapter's own naming function at the floor and compares it with the project's function, over names of 64, 65, and 84 characters and a name with a `.`. An adapter release that changes the rule then fails the suite.
- **D-PG1-10:** every adapter tool name the agents bridge writes uses the rule. That covers `excludeTools` and a granted tool name.

### Default MCP timeouts (D-PG1-11 to D-PG1-14)

- **D-PG1-11:** precedence under the adapter. The plugin's declared `timeout` wins, then a `requestTimeoutMs` the user wrote on the entry, then the default: 1,800,000 ms for a stdio server and 300,000 ms for a remote server. ANAME-07 is amended only by the default; a carried field the plugin sets is still the plugin's.
- **D-PG1-12:** installed plugins. Under the adapter, the entry in `mcp-adapter.json` gets the default at the next `update` or `reinstall`. Under Pi's built-in MCP, the registration gets it at the next session start, because the registration is built from the record each time. The built-in is not held back to match the adapter.
- **D-PG1-13:** a default the project wrote stays the project's. A later restage recomputes it, so a server that changes from stdio to remote gets 5 minutes. A value the user changed on the entry is kept. The entry's marker has to tell the two apart; how is the planner's choice.
- **D-PG1-14:** no slow scenario in the suite. Scenarios pin the registered configuration under both profiles: 30 minutes for a stdio server with no declared `timeout`, 5 minutes for a remote server, and under the adapter a user-written timeout that is still there after an update. The phase runs a call that stays silent for more than 60 seconds once under each implementation and records the result in the verification report.

### Claude's Discretion

- How the marker of an adapter entry records a default the project wrote (D-PG1-13).
- How the hooks bridge recovers the full name of a shortened tool, within D-PG1-08.
- The fixture plugin and stub server for the long-name scenarios, and whether the adapter twin of the long-name scenario in `features/mcp-server/listing.feature` reuses the existing fixture.
- The wording of the corrected documentation lines and of the CHANGELOG entry (the `changelog` and `readme` skills apply; `README.es.md` changes with `README.md`).
- Whether the remote default mentions Claude Code's 60-second first-byte timer in `docs/mcp-compatibility.md` (it has no Pi equivalent; the PRD names it as the reason for Medium confidence).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/mcp-implementation.ts`: `ADAPTER_PROFILE` and `BUILTIN_PROFILE`. `adapterToolName` returns the full name today; `builtinToolName` already models Pi's 55-character cut with an 8-digit hash and is the shape to follow.
- `domain/components/hooks/builtin-mcp-tool-names.ts`: `toolLiteralNames`, `serverPrefixNames`, and `claudeFormToolName` map a built-in tool name to Claude's form for matchers and hook payloads. `McpToolIdentity` carries the Pi name and the built-in server.
- `bridges/hooks/mcp-tool-view.ts`: `HookToolView.identify` passes an adapter tool's Pi name through unchanged (`asPiNames`); it reads `pi.getAllTools()` once per event.
- `domain/mcp-server-features.ts`: `timeoutField` and `remoteTimeoutField` write `requestTimeoutMs` only when the plugin declares a `timeout` (or `request_timeout_ms` for a remote server). `domain/mcp-builtin-translation.ts` turns `requestTimeoutMs` into Pi's `timeout` in seconds.
- `bridges/mcp/adapter-entry.ts`: `CARRIED_FIELDS` holds `requestTimeoutMs`; `pluginSetFieldsIn`, `carriedFields`, and the marker's plugin-set list already tell a plugin value from a user value (ANAME-07, AFILE-06).
- `bridges/agents/convert.ts`: `MODEL_MAP` and `mapModel` write `anthropic/claude-...`; the `claude-` passthrough is at line 346. The same file writes the full adapter tool name into `excludeTools`.

### Established Patterns

- `scripts/install-test-peers.mjs` installs each optional peer at the lowest version its range admits into `node_modules/.cache/optional-peers`, with a `--before` cap (PIFL-02, PIFL-03). The cache holds pi-mcp-adapter 7.0.0, pi-subagents 0.84.0, and pi-dynamic-workflows 3.15.0 today.
- A scenario with an MCP surface carries `@mcp` and runs under both profiles, or an `@adapter-only` and `@builtin-only` pair (DUAL-02, D-BG-04).
- A user-visible change ships with a cucumber scenario that fails without it; `npm run check` is the gate.
- A closed table in the domain layer maps each Claude MCP field; the bridges add owned fields and the marker.

### Integration Points

- `package.json` `peerDependencies`, `README.md:39-40`, `README.es.md`, and `.planning/codebase/STACK.md` name the floors.
- `features/mcp-server/agent-grants.feature:280` and `:312` pin the pi-subagents refusal text; `features/mcp-server/listing.feature` has the built-in long-name scenario; `features/agent/frontmatter.feature:109-199` pins the `--map-model` output.
- `docs/mcp-compatibility.md` lines 126 (names "are not shortened"), 277 (about 28 hours), 381 and 592 (two pi-subagents bugs open), and 588 (no default timeout).

</code_context>

<specifics>
## Specific Ideas

- The user wants the suites to run pi-subagents 0.88.0 while the declared floor is 0.87.0 (D-PG1-02).
- Spike S3 measured the adapter 7.0.1 naming code outside a session: `mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot_of_the_current_page` (84 characters) becomes `mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_s_d9a1c2f1` (64). The hook effect in a session was not run; this phase's scenario is that run.
- The name budget is `12 + plugin + 1 + server + 2 + tool` characters.
- Open in the PRD: BACKLOG MCPV2-03 and `orchestrators/mcp/builtin-registration-step.ts:15` disagree about a background child under built-in MCP. Spike S2 found MCPV2-03 out of date by the code; correct the BACKLOG entry when the phase touches MCPBG-01.

</specifics>

<deferred>
## Deferred Ideas

- AGENT-06: bring the `--map-model` alias table to Claude Code 2.1.322 (P2).
- Reading `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` (out of scope in REQUIREMENTS.md).
- A session-start rewrite of the `anthropic/` prefix in installed agent files (rejected for this phase, D-PG1-05).

</deferred>
