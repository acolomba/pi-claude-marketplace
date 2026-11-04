# mcp-builtin milestone brief

The user's opening brief for the mcp-builtin milestone, 2026-11-04, kept
verbatim. Researchers, the roadmapper, and every phase read it.

## Goal

Support Pi's built-in MCP as a first-class alternative to pi-mcp-adapter. Work on branch features/mcp-builtin.

## Requirements

- If pi-mcp-adapter is installed, plugin MCP servers run through the adapter, as today. If it isn't, they run through Pi's built-in MCP.
- Treat the two as equal implementations. The adapter is a superset today, but design as if either could be the richer one. Switching between them at will should be possible in principle, but don't build a switch: the trigger is installing or uninstalling the adapter.
- A switch must never require action from the user. On startup and /reload, materialize every plugin's MCP components correctly for the active implementation.
- A plugin's state (supported or partially supported) depends on the active implementation.
- Every MCP behavioral test runs against both implementations. Share step definitions where possible; some duplication is expected.
- Upgrade Pi to 1.5.0 (dev deps and the peer floor >=1.5.0; update package-lock).

## Decisions already made (record each with a decision ID)

1. The adapter writes `-builtin:mcp` into the user's ~/.pi/agent/settings.json once per adapter version, which leaves built-in MCP off after the adapter is uninstalled. Remove that line only when both hold: the adapter is absent, and the adapter's onboarding state (piBuiltinMcpHandledVersion) shows the adapter wrote it. Never touch a `builtin:mcp` entry the user set themselves. This amends the containment rule NFR-10 and the "never edit Pi settings" rule; update PROJECT.md and docs.
2. Built-in exposure: plugin servers get `exposure: "deferred"`, found through tool_search and called directly. A server with `alwaysLoad: true` gets `"direct"`.
3. Run this as a GSD milestone.

## Verified findings

Pi 1.5.0 (npm pack @earendil-works/pi-coding-agent@1.5.0; see docs/mcp.md, docs/extensions.md "MCP Servers", dist/core/mcp-servers.d.ts):

- MCP gains in 1.5.0: OAuth metadata URLs that aren't http/https are now rejected (security fix); `clientRegistration` defaults to "auto" (CIMD, else dynamic registration); tool_search ranking is much better; plain JSON Schema MCP tool arguments are now coerced. No new transports.
- Breaking change: tool argument validation moved to pi-schema. The extension uses no Type.Refine, BigInt, Undefined or codecs, so it is unaffected.
- `pi.registerMcpServer(name, config)` / `unregisterMcpServer` / `getMcpServers()` register servers for the current session only. Nothing is saved, so re-register on every load. Registrations made during load connect at session start, and later ones connect at once. An `mcp.json` entry with the same name takes precedence. The API also exists in 1.4.0.
- Registered servers bypass Pi's project-trust gate. Register project-scope plugin servers only when ctx.isProjectTrusted().
- When nothing connects registered servers (built-in MCP disabled or replaced), Pi reports each registration as an extension error. Never register while the adapter is active.
- Built-in tool names are `mcp__<server>__<tool>`, with every character outside letters, digits and `_` replaced by `_`. Server name `plugin_<plugin>_<server>` therefore keeps Claude Code names, except that `-` becomes `_`. Record this as a divergence licensed by a Pi capability gap; hook matchers that contain `-` won't match.
- Built-in supports stdio and streamable HTTP, `cwd` (which the adapter drops), `timeout` in seconds, and oauth (clientId, clientSecret, callbackPort/callbackUrl, scope, clientName, clientRegistration, authServerMetadataUrl). It has no SSE (rejected), headersHelper, elicitation, sampling or prompts.
- An extension that registers /mcp replaces the built-in. Built-in's /mcp comes from builtin:mcp.

pi-mcp-adapter 7.0.0 (npm pack):

- pi-builtin-mcp.ts `turnOffPiBuiltinMcp()` is the settings write behind decision 1.
- index.ts `applyPiMcpServers` consumes Pi registrations, but only as proxy-only runtime servers: it drops `directTools`, so `alwaysLoad` is lost. So no single registration path can serve both implementations; each needs its own materialization.

This repo:

- Detection is `hasLoadedPiMcpAdapter` in platform/pi-api.ts, which uses getCommands and the `mcp-adapter` command. It is reliable only after every extension has loaded, at session_start.
- domain/mcp-server-features.ts (`classifyMcpServer`, `translateMcpServer`) and domain/mcp-resolution.ts decide supported/blocked against the adapter at install time and drop blocked servers.
- bridges/mcp/* writes entries into mcp-adapter.json.
- platform/mcp-status.ts reads the adapter's status channel `pi-mcp-adapter/status/v1`.
- bridges/agents/convert.ts writes pi-subagents `mcp:<key>` grants, which depend on the adapter.
- bridges/hooks/dispatch.ts special-cases the adapter's `mcp` proxy calls.
- shared/concerns/soft-dep.ts holds the `requires pi-mcp-adapter` marker.
- docs/mcp-compatibility.md is the parity reference.

## Proposed architecture (validate in planning)

- An `McpImplementation` interface with two implementations, adapter and builtin. Each owns its translation table, its verdict table (supported, blocked, malformed), its materialization, its status reader, its naming, and its agent-grant form.
- Install records every declared server in its Claude-shaped form, after plugin-variable substitution, instead of dropping servers the adapter can't run. Verdicts, the partial state, and the list, info and soft-dep markers are computed at read time against the active implementation.
- Pick the active implementation at session_start: adapter if /mcp-adapter is loaded; builtin if /mcp comes from builtin:mcp; otherwise none, with a marker such as "requires MCP support" (name per the messaging style guide).
- Materialization:
  - adapter: keep writing mcp-adapter.json entries at install, and reconcile them on load or apply. Built-in never reads that file, so the entries are harmless while built-in is active.
  - builtin: call registerMcpServer at session_start from the install records, gated on project trust.
- Re-materialize generated agents (pi-subagents MCP grants) for the active implementation on /reload, since they differ per implementation.
- Status in info: the adapter keeps its status channel. Builtin needs its own reader (getMcpServers and getAllTools, or whatever Pi exposes); research it.
- Cucumber: tag MCP features @adapter and @builtin, run a cucumber profile per implementation, keep step definitions shared, and put implementation-specific expectations in their own scenarios. Use features/mcp-server/* as the template.
- Update docs/mcp-compatibility.md with a built-in column, plus CHANGELOG and README.

Follow AGENTS.md: the GSD workflow, `npm run check` green with 100% direct coverage, a cucumber scenario for every user-visible change, Claude Code parity research via .agents/skills/claude-code-compat-research, merges rather than rebases, and never commit to main.

## Parallelism

"When you plan, plan for using maximum session parallelism through worktrees, with different sessions authorised to push to github."

## Amendments

2026-11-04, the user, after the stack, architecture, and pitfalls research
reported that decision 1 cannot be carried out as written (verbatim):

"for the removal of builtin mcp, then we report that plugins are partially
available because they require mcp -- up to the user to enable either the
builtin mcp or add the 3rd party mcp library"

This replaces decision 1: the extension does not edit Pi settings, and
NFR-10 is not amended.

2026-11-04, the user, refining the amendment above after a walk-through of
today's `{requires pi-mcp-adapter}` marker and `{unsupported mcp}` reason
(verbatim):

"or could we say "requires mcp" if the built-in mcp is sufficient (but not
enabled), "requires pi-mcp-adapter" (is that the verbiage today?) if the mcp
in the plugin requires features only available in pi-mcp-adapter, otherwise
"mcp" as the reason for partially available?"

Then, accepting the three-point proposal (a plugin stays installed with a
`requires` marker when no implementation is active; markers
`requires mcp`, `requires pi-mcp-adapter`, `requires builtin mcp`; the other
implementation's marker beside `{unsupported mcp}`): "yes, go with all three".
Recorded as D-MB-07.
