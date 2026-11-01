# Phase 6: MCP Servers - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning
**Mode:** autonomous (smart discuss in a child session; decisions made from
upstream evidence, no user prompts). The user's standing instruction for this
run: "make decisions as you see fit, but when in doubt research how claude code
upstream operates, and try to maintain compatibility unless we need to deviate
for reasons specific to the implementation of this project." Every decision
below was settled autonomously; `DUBIOUS-CHOICES.md` in this directory lists
the ones a user might have decided differently (P6-DC-NN).

<domain>
## Phase Boundary

Phase 6 proves, with cucumber scenarios under `features/mcp-server/`, that a
bridged plugin MCP server looks to pi-mcp-adapter 7.0.0 (on Pi 1.4.0) the way
Claude Code 2.1.316 defines it, and fixes in-phase every product break the
scenarios expose (bug policy). The scenarios observe only what Pi or a
companion reports: the MCP stub server's log, the scripted model's call log
(including the `mcp` proxy's tool results), the registry probe, a child
agent's run, and `/claude:plugin` output. They never read the files the bridge
wrote.

1. **Connection and naming (MCP-01):** a bridged stdio server connects (the
   stub logs `initialize` and `tools/list`) and its tools are named
   `mcp__plugin_<plugin>_<server>__<tool>`.
2. **Calls (MCP-02, MCP-07):** a scripted call through the adapter's `mcp`
   proxy reaches the stub with its arguments and returns the stub's result to
   the model; an agent granted a plugin MCP tool calls it in a foreground run.
3. **Configuration (MCP-03, MCP-04):** args, env, `${VAR}`, `${VAR:-default}`,
   `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and a loopback remote
   server with headers reach the server as upstream; multiple server sources
   (FG-27) and a malformed server (FG-28) behave as decided here.
4. **Project scope and companion-missing (MCP-05, MCP-06):** project-scope
   plugin servers start as FG-29 decides, with the blocked cases pinned;
   without pi-mcp-adapter the install shows `{requires pi-mcp-adapter}`, and
   loading the adapter then `/reload` makes the servers available with no
   reinstall.
5. **Lifecycle (MCP-08):** disable, uninstall, and update remove or replace
   the server entries the adapter sees.
6. **Docs (FG-30):** every row of `docs/mcp-compatibility.md` re-measured on
   adapter 7.0.0, with any break fixed in-phase.

Out of scope (v2, RM-01..RM-05): a model choosing a tool on its own, remote
MCP OAuth end to end. Fixtures avoid `protocolVersion: "auto"`, `npx`, and
`http` without a loopback stand-in.

</domain>

<decisions>
## Implementation Decisions

### Server sources and malformed servers (FG-27, FG-28)

- **D-CF6-01 (source merge; FG-27):** Follow upstream. A plugin's MCP servers
  are the union of its sources: the plugin root `.mcp.json` first, then each
  declared `mcpServers` value (plugin manifest, and the marketplace entry where
  upstream reads it), and a server name declared by a later source replaces
  the earlier one. Evidence: the 2.1.316 binary describes manifest
  `mcpServers` as "MCP servers to include in the plugin (in addition to those
  in the .mcp.json file, if it exists)", and the plugins reference documents
  the merge [FEATURES.md FG-27]. Supersedes PRD MC-1's "first match wins, no
  merge". The researcher pins the exact order across the marketplace entry,
  the manifest, and `.mcp.json`, and the array form, from the binary; if the
  binary contradicts the docs, the binary wins. `.mcpb` bundles stay
  unsupported unless the bridge already handles them; that residual is
  recorded under this ID with the Pi-gap reason (no adapter bundle runner).
  The `strict: false` conflict rule (MM-7) is kept unless the binary shows a
  merge there too.
- **D-CF6-02 (one malformed server; FG-28):** Follow upstream. A server whose
  config Claude's schema rejects is skipped with an install warning, and the
  plugin's other servers and components install. Today's whole-plugin
  `(unavailable) {malformed mcp}` cites ANAME-07, which covers unsupported
  transport features, not malformed servers, so no recorded decision licenses
  the divergence. A failure that upstream also treats as fatal for the whole
  MCP source (the researcher measures an unparseable `.mcp.json` and an
  unreadable string reference) keeps today's handling only if upstream
  matches it; otherwise it follows upstream. Prefer an existing warning
  reason over a new closed-set entry. The AMIG-01 migration follows the same
  per-server rule if it shares the resolver; otherwise its own wording stays.

### Project scope (FG-29)

- **D-CF6-03 (project-scope plugin servers; FG-29):** Keep adapter-owned
  project trust as a licensed divergence. pi-mcp-adapter 7.0.0 keeps each
  approval in `<agent dir>/mcp-project-approvals.json`, keyed by project root,
  server name, and definition hash, and offers no API for another extension
  to pre-approve a server. Writing that file is outside the NFR-10 write set,
  and the docs already record that this extension never writes the adapter's
  approval files. Licensed by the Pi capability gap plus NFR-10. Pinned
  behavior: in a trusted project with the user-global
  `settings.projectServers: "allow"` the server connects and answers a call
  (Phase 1 scenario, moved to `project-scope.feature`); in a trusted project
  without it, a headless (RPC) session leaves the server blocked; in an
  untrusted project the server is blocked even with the setting. A blocked
  server never starts (empty stub log), and the scenario pins what the model
  sees from the `mcp` proxy and what `/claude:plugin info` shows (`pending
  approval`), as whole literal values.

### Adapter 7.x re-measure (FG-30)

- **D-CF6-04 (doc rows on 7.0.0; FG-30):** Re-measure every row and
  run-time statement of `docs/mcp-compatibility.md` on pi-mcp-adapter 7.0.0
  and Pi 1.4.0 (the header still names 5.2.0 on Pi 1.0.0): `toolPrefix`,
  `directTools`, `auth: "oauth"`, `mcp-adapter.json`,
  `pi-mcp-adapter/status/v1`, `lifecycle: lazy`, project trust, the three
  adapter settings, and the variable rows. A row that holds is rewritten to
  name 7.0.0; a break is fixed in-phase in the owned product files, with a
  scenario where it is user-visible. New 7.x features that touch plugin
  servers (the adapter's own `claudePlugins` loader, `projectServers`
  policy) get a row or a note. `test/live-uat/mcp-adapter-canary.mjs` still
  pins 5.2.0; raising it is a parent line, not a Phase 6 edit.

### Harness and observation

- **D-CF6-05 (tool names, MCP-01):** The listing scenario observes the tool
  name through what the adapter returns to the model (a scripted `mcp`
  search or server listing, compared whole), and the connection through the
  stub log. The registry probe is used only if the researcher shows the
  deferred tools appear in it after an activating search.
- **D-CF6-06 (new stand-ins):** The frozen stdio stub
  (`features/lib/mcp-stub-server.ts`) is not edited. Where a scenario must
  see a server's argv, its environment, or HTTP headers that the frozen stub
  cannot report, Phase 6 adds its own stand-in under
  `features/lib/mcp-server-*.ts` (a Phase 6-owned name), such as a loopback
  Streamable HTTP MCP server that the step starts in the worker and stops in
  the scenario's release, logging each request's method, params, and headers.
  Prefer reflecting values through the frozen stub (its `STUB_TAG` echo and
  its logged plugin and server names) when that suffices.
- **D-CF6-07 (agent fixture for MCP-07):** The agent that is granted the
  plugin MCP tool is written by a Phase 6 helper in
  `features/lib/mcp-server-files.ts` through the frozen
  `writePublishedPluginFile`, never through `features/lib/agent-files.ts`
  (Phase 4 owns it). The run uses Phase 1 stand-ins only: the scripted model
  (whose script the child agent's Pi also reads, D-CF1-17), the MCP stub, and
  pi-subagents 0.84.0. If pi-subagents cannot give a child agent the plugin
  MCP tool, the gap is recorded under a decision ID with the observed
  behavior pinned, not left untested.
- **D-CF6-08 (companion-missing, MCP-06):** Without pi-mcp-adapter the
  install and `info` keep `{requires pi-mcp-adapter}` / `(missing)` (MC-8,
  D-01-01); then a profile Pi with the adapter, after `/reload`, reaches the
  server with no reinstall. Any fix stays in the pi-mcp-adapter arm of
  `shared/concerns/soft-dep.ts`.
- **D-CF6-09 (lifecycle, MCP-08):** Disable, uninstall, and update are
  observed through a Pi started after the change (or after `/reload`): the
  `mcp` proxy no longer reaches the server, or reaches the replaced one (a
  changed `STUB_TAG` or tool shows the new version). User overrides kept
  across update and disable (D-08-01/02, AFILE-06) are observed through what
  the adapter does with them, not the file.

### Claude's Discretion

- The plan split and wave placement inside the ROADMAP template (wave 1
  tracer, wave 2 parallel topics, wave 3 docs and gate), module names of new
  stand-ins, and parameter type names (prefixed `mcp-server`).
- Warning wording for the D-CF6-02 skip, in the style of the existing
  staging warnings, preferring an existing reason.
- Whether the Phase 1 project-scope scenario moves to `project-scope.feature`
  or stays in `invocation.feature` (recommended: move).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `features/mcp-server/invocation.feature` (Phase 1 seed): a user-scope call,
  an allowed project-scope call, and the connect-time `${NAME:-default}`
  scenario (D-CF1-13). The expected stub log includes the adapter 7.0.0
  startup listing (two connections per call scenario).
- `features/step_definitions/mcp-server/calls.steps.ts`: stub publishing,
  the launch-environment Given, the "has listed the tools" wait, and the
  whole-log messages Then with the `{tool call <n>}` projection.
- `features/lib/mcp-server-files.ts` (owned): `publishStubMcpServer`,
  `stubMcpFileText`, `LATE_TAG_ENVIRONMENT`.
- Frozen: `features/lib/mcp-stub-server.ts` (echo tool, `STUB_TAG` prefix,
  JSONL log under the harness dir, pid files), `features/lib/mcp-configuration.ts`
  and `mcp-configuration.steps.ts` (declared servers, commented
  `mcp-adapter.json`, `pi-mcp-adapter allows project mcp servers for the
  user`), the scripted model, the registry probe, `published-marketplace.ts`.
- `features/lib/pi-launch-environment.ts`: sets variables in a profile Pi.

### Established Patterns

- Profile Pi per scenario with companions through a `Given`; the shared Pi
  has no model and no companions.
- Expected values are whole literals in the feature file; each kind has a
  negative control; a red proof precedes each product fix.

### Integration Points

- Product (owned): `bridges/mcp/**`, `platform/mcp-status.ts`,
  `domain/mcp-resolution.ts`, `domain/components/mcp.ts`,
  `docs/mcp-compatibility.md`, `test/bridges/mcp/**`, `test/integration/mcp-*`.
- FG-27/FG-28 land in `domain/mcp-resolution.ts` (and possibly
  `domain/plugin-resolver.ts`, not owned: a minimal edit there is recorded
  as a dubious choice).
- pi-mcp-adapter 7.0.0 source: `node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/`
  (`project-server-trust.ts`, `config.ts`, `claude-plugin-loader.ts`).

</code_context>

<specifics>
## Specific Ideas

- Upstream evidence so far: binary 2.1.316 string "MCP servers to include in
  the plugin (in addition to those in the .mcp.json file, if it exists)";
  adapter 7.0.0 `project-server-trust.ts` (approval store
  `mcp-project-approvals.json`, `allowUnapproved` only for non-interactive
  sessions with user-global `projectServers: "allow"`, RPC treated as
  non-interactive since 5.3.0).
- Offline probes may use `/opt/claude-code/bin/claude` (2.1.316, no
  credentials), as Phase 2 did.

</specifics>

<deferred>
## Deferred Ideas

- Raising `test/live-uat/mcp-adapter-canary.mjs` from 5.2.0 to 7.0.0 (parent
  line).
- An interactive (TUI) project-server approval scenario: the dialog is the
  adapter's own, and headless behavior is what this phase pins.

</deferred>
