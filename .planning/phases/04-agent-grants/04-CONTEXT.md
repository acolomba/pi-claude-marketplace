# Phase 4: Agent Grants - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 runs in a parallel child session on `features/mcp-builtin-phase-4`. It
makes a generated pi-subagents agent carry the MCP grant of the active MCP
implementation, and it keeps the files right across a switch:

- Install, update, reinstall, enable, and import (every path that stages
  agents through `agentsPhase` in `install-outcome.ts` or the agent staging in
  `update-swap.ts`) write each agent's `mcp:` grants, per-tool MCP
  `excludeTools` names, and MCP warnings in the form of the active
  implementation (MGRT-01, install side).
- After a switch and `/reload` (or a new Pi), the load rewrites exactly the
  agent files whose grant form changed, atomically, under the scope's state
  lock, with no user action (D-MB-03). With no active implementation, or for
  the project scope of a project Pi does not trust, the files stay as they are
  (MGRT-01, switch side).
- A pi-subagents background child that loads the extension rewrites no agent
  file and runs no load-time apply or MCP move (MGRT-02, D-MB-12).

Requirements: MGRT-01, MGRT-02. Out of scope: proving that a background child
calls a plugin MCP tool (MCPV2-03, MCPBG-01), immediate grant changes without
`/reload`, and every plugin state, marker, or per-server verdict row (Phase 3).

The user's standing instruction for this run: decide by this project's
conventions and Claude Code upstream parity (2.1.318), never stop to ask, and
log every questionable choice in `DUBIOUS-CHOICES.md` in this directory
(`P4-DC-NN`), sending each step's new entries to the parent session.

</domain>

<decisions>
## Implementation Decisions

### Research answers (ROADMAP discuss and research flags)

- **Built-in grant syntax (P1-DC-28 closed).** pi-subagents 0.84.0 resolves
  `mcp:<server>` and `mcp:<server>/<tool>` against Pi's built-in MCP when the
  `mcp` command comes from `builtin:mcp` and no `mcp-adapter` command exists
  (`bundle/chunk-V2BZYLEP.js` `usesBuiltinMcp`, `resolveBuiltinMcpSelections`).
  A whole-server selector matches every tool whose namespace is
  `mcp__<server with - folded to _>`; a per-tool selector matches the tool Pi
  names `mcp__<server>__<tool>` sanitized (`builtinMcpToolNames`, the same
  rule as Pi 1.5.0 `createMcpToolName`, long-name hash included). So the
  frozen built-in `grantSelector`, `mcp:<builtinMcpServerName(plugin, server)>`,
  is correct as built, with `-` kept. No parent line.
- **What shows that a grant resolved.** Two things pi-subagents reports,
  neither of which needs a background launch:
  1. `subagent {"action":"get","agent":...}`: the agent detail's `tools`
     line, which pi-subagents reads from the file (`mcp:plugin_demo_stub_/echo`
     under the adapter, `mcp:plugin_demo_stub/echo` under built-in).
  2. The D-CF6-10 foreground refusal. Under the adapter it names the adapter
     selector (`error naming plugin_demo_stub_/echo`, pinned today). Under
     built-in, a resolved grant is refused because the server is registered
     by an extension: "Agent 'demo:runner' selects MCP tools from servers
     that extensions registered (plugin_demo_stub). Only background children
     (async: true) load those extensions; ..." (`chunk-JG4QKI5M.js`
     `buildInProcessChildLaunch`). An unresolved built-in grant (the adapter
     form under built-in) fails earlier with "selects MCP tools that Pi's
     built-in MCP does not offer: mcp:plugin_demo_stub_/echo". The difference
     between the two texts is the red proof under the built-in profile.
  A background launch is not used: the harness's background children load
  neither the companions nor the scripted model (MCPBG-01), and background
  agents calling plugin MCP tools under built-in are v2 (MCPV2-03).
- **Stand-in or Phase 2.** Every built-in leg uses the Phase 1 stand-in
  server (`a stand-in registers the stub mcp server ... with pi's built-in mcp`),
  which registers through `pi.registerMcpServer` like Phase 2 will, so the
  extension-registered refusal is the same before and after Phase 2 merges.
  No Phase 4 scenario waits on Phase 2.
- **Do launches re-read agent files?** Yes. pi-subagents discovers agents on
  each `subagent` call through a cache whose fingerprint is every watched
  file's size and mtime (`src/agents/agents.js` `getAgentDiscoverySources`,
  `discoveryFingerprint`, `watchPathSignature`), so a file the load rewrote
  at `session_start` is read on the next call. No session snapshot is kept.
- **Background child detection.** pi-subagents runs background children as
  sessions inside its detached runner process, and the runner sets
  `process.env.PI_SUBAGENT_CHILD = "1"` before any child session starts
  (`src/runs/background/subagent-runner.js:89`: "This process hosts child
  sessions"). pi-subagents itself registers nothing when the variable is `"1"`
  (`index.js`, `registerSubagentExtension`). Ambient extensions, this one
  among them, load into those sessions in `print` mode, and Pi emits
  `session_start` and then `resources_discover` there (`child-session.js`
  `bindExtensions`). Foreground children are sessions inside the parent
  process with `noExtensions: true`, so this extension never runs in one.
  The detection is `PI_SUBAGENT_CHILD === "1"`, the exact signal pi-subagents
  uses.

### Grant form per implementation (MGRT-01, install side)

- `bridges/agents/convert.ts` takes the implementation it renders for. The
  `mcp:` entry of a written server comes from `profileFor(id).grantSelector`
  (plus `/<tool>` for a per-tool grant); a per-tool MCP name that joins
  `excludeTools` on an omitted `tools:` list comes from `profile.toolName`;
  the cannot-narrow warning names the profile's selector. The Claude-form
  match (`mcp__plugin_<p>_<s>` prefix) stays as it is: it is the Claude Code
  name, the same under both implementations.
- **Server set per implementation.** The adapter form maps the servers the
  adapter runs, today's `Object.keys(resolved.mcpServers)` (MSEL-04's
  adapter-supported subset). The built-in form maps the declared servers
  (`resolved.declaredMcpServers`, every non-malformed server) whose built-in
  verdict (`profileFor("builtin").classify`) is supported. A grant of a
  server the implementation cannot run is dropped with today's warning, so
  an `sse` server's grant is kept under the adapter and dropped under
  built-in.
- **Which form the file gets.** The active implementation's form;
  `none` gets the adapter form (ARCHITECTURE "none -> adapter form": the
  form every earlier release wrote). The staging reads the active
  implementation from the run snapshot (`opts.run.softDeps.mcpImplementation`
  in `agentsPhase`, the update staging's run in `update-swap.ts`).
- **Async warning per implementation (D-CF6-10 stays).** Built-in has the
  same foreground gap, so `async: true` stays for an agent that runs plugin
  MCP tools under both. The adapter text stays byte for byte. The built-in
  text ends "a launch before Pi's built-in MCP has listed the server's tools
  still fails", which is what pi-subagents does: it resolves built-in
  selectors against the parent's `getAllTools()` at launch.
- **Agents index (additive, `schemaVersion` stays 1).** A row gains two
  optional fields when the two implementations render the agent differently:
  `mcpImplementation` (the form the file holds now) and the rendered forms,
  one per implementation that rendered: the file's frontmatter block (from
  the opening `---` through the closing `---` line), its warnings, and its
  dropped tools. The body is the same under both, so it is not stored. A row
  whose agent renders the same under both gets neither field, and the load
  never touches it.
- **AG-11 per form.** When the active form maps an explicit `tools:` list to
  nothing, staging fails as it does today. When only the inactive form does,
  that form is not stored, and a later load under that implementation leaves
  the file as it is.

### Load-time rewrite after a switch (MGRT-01, switch side, D-MB-03)

- `orchestrators/mcp/agent-grants-step.ts` fills the frozen seed. It keeps
  the frozen `agentGrantsStep(input)` export and delegates to a testable body
  that takes its environment and file operations as parameters (the
  dependency-injection convention); the production binding passes
  `process.env`.
- It does nothing when the active implementation is `none`, in a background
  child, and for the project scope when `ctx.isProjectTrusted()` is false
  (D-LOC-01). Scopes: user, then project.
- Per scope it first reads the agents index without the lock. Only when a
  row's `mcpImplementation` differs from the active implementation and the
  row holds the active form does it take `withLockedStateTransaction` (no
  `tx.save()`, so `state.json` stays untouched), read the index again, and
  for each such row: when the file's frontmatter equals the recorded form,
  write the active form plus the unchanged body to a temporary file and
  rename it over the target (NFR-1); when it already equals the active form
  (an earlier rewrite whose index save failed), only fix the row; otherwise
  (edited by the user, missing, foreign) leave it and debug-log. The index is
  saved last with the rows' `mcpImplementation`, warnings, and dropped tools
  set to the active form, so a failure before the save self-heals on the
  next load.
- Silent: it reports nothing to the user (a load with nothing to report is
  silent, RECON-05), adds no closed-set entry, and debug-logs every skip and
  failure on the `mcp` channel. A held lock (`StateLockHeldError`) skips the
  scope until the next load. It never throws (NFR-2; the materializer also
  catches).
- **Legacy rows.** A row written before this phase has no stored forms, and
  its file holds the adapter form. The load leaves it. `reinstall`,
  `update`, and disable-then-enable re-stage it with forms.

### Background child (MGRT-02, D-MB-12)

- New leaf `platform/subagent-child.ts`: `isSubagentChild(env)` reads
  `PI_SUBAGENT_CHILD === "1"` from an injected environment (pure; callers
  pass `process.env`). It names pi-subagents' variable as a string literal
  with a cited source line, as the adapter-status field names do.
- The agent grants step is a no-op in a child (above).
- The load reconcile in a child: `orchestrators/reconcile/load.ts` skips the
  autoapply apply step (the read-only pass runs instead, as with autoapply
  off) and passes a no-op AMIG-01 MCP move. `createLoadReconcile` gains an
  optional environment parameter with the `process.env` default, so the
  frozen `index.ts` call stays as it is. The read-only pass still rebuilds
  the hook routing tables, which the child's hooks need.
- Not gated, by design: the MIG-01 first-run config migration and
  `loadState`'s legacy migration (both idempotent, and the parent's load runs
  them before any child exists), the background autoupdate (it arms only in
  `tui`, and a child binds in `print`), and the built-in registrations of
  Phase 2 (a registration lasts for the session and writes nothing; D-MB-12
  allows it).

### Behavioral tests

- `features/mcp-server/agent-grants.feature` drops its feature-level
  `@adapter-only`. Profile-neutral scenarios use a new Phase 4 step that
  starts the profile Pi with pi-subagents plus the profile's MCP launch
  (`mcpImplementationLaunch`), and the frozen listing step `the mcp
  implementation has listed the tools of the stub mcp server ...`. An
  expectation that differs by implementation is an `@adapter-only` and
  `@builtin-only` pair naming MGRT-01 or D-CF6-10.
- **Install side (both profiles).** Installing (and updating, reinstalling,
  enabling) a plugin whose agent is granted `mcp__plugin_demo_stub__echo`
  shows the active implementation's selector in `subagent get`, and the
  foreground refusal names the profile's selector or server.
- **Switch side (`@own-implementation`).** Install under the adapter; restart
  so built-in is active; `subagent get` shows the built-in selector while an
  agent with no MCP grant is unchanged; a restart with no MCP keeps the files
  as they are.
- **Background child.** A profile Pi started with `PI_SUBAGENT_CHILD=1`
  through the launch-environment stand-in (`features/lib/pi-launch-environment.ts`)
  plays the background child: it leaves an adapter-form agent alone under
  built-in, and with `autoapply` on it installs nothing; a later Pi with
  pi-subagents and no MCP reports the unchanged selector, and `list` reports
  the plugin still missing.
- `features/lib/upstream/subagents.ts`'s error projection learns the
  built-in names (`plugin_<p>_<s>` and `plugin_<p>_<s>/<tool>`), keeping the
  adapter projection unchanged.
- Red proof per profile: each new scenario fails on the pre-phase tree under
  every profile it runs in, recorded in the plan SUMMARY.

### Ownership and parent lines

- Phase 4 edits only its own files plus two that no phase owns:
  `orchestrators/reconcile/load.ts` (the MGRT-02 gate) and
  `features/lib/upstream/subagents.ts` (the projection). Both are logged.
- Cross-phase note (parent line): Phase 3's `@builtin-only` scenario
  "Update preserves dependency move warnings and MCP notices, under Pi's
  built-in MCP" in `features/mcp-server/verdict-markers.feature` expects the
  adapter's async warning text; after the Phase 4 merge, its row reads the
  built-in text. Phase 3 re-runs its rows after merging the milestone branch.
- Parent lines for `docs/mcp-compatibility.md` (Phase 2's file): the agents
  section's `mcp:` entry and override examples gain the built-in form.
  CHANGELOG and README lines go to the last plan's SUMMARY.

### Claude's Discretion

- Exact names of the new index fields, the new convert input, and the step's
  internal helpers.
- Whether the rewrite helper lives in `bridges/agents/` (preferred: it owns
  the file format) with the step orchestrating the lock.
- How the update, reinstall, and enable legs are grouped in the feature file
  (a Scenario Outline is fine), within the CI time budget.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/mcp-implementation.ts` (frozen): `profileFor(id)` with
  `grantSelector`, `toolName`, `classify`; `ActiveMcpImplementation`.
- `bridges/agents/convert.ts`: `buildMcpGrants`, `matchMcpGrant`, `mcpEntry`,
  `perToolMcpName`, `explicitMcpWarnings`, `MCP_ASYNC_WARNING`,
  `runsMcpTools`; `emitGeneratedAgentFile` in `frontmatter.ts`.
- `bridges/agents/stage.ts`: prepare/commit/abort, tmp + rename writes,
  index saved last; `persistence/agents-index-{schema,io}.ts`.
- `transaction/with-state-guard.ts` `withLockedStateTransaction`;
  `shared/debug-log.ts` `hookDebugLog(msg, "mcp")`.
- `features/lib/pi-launch-environment.ts` (`writeLaunchEnvironment`,
  `PI_LAUNCH_ENVIRONMENT_EXTENSION`, `readAppliedLaunchEnvironments`);
  `features/lib/mcp-implementation.ts` `mcpImplementationLaunch`;
  `features/lib/upstream/subagents.ts` `projectSubagentResult`.

### Established Patterns

- Injected environment and operations, never module globals
  (`background-update.ts` takes `env`; `createGitOps`).
- Additive optional record fields with `schemaVersion` unchanged.
- The load is silent unless it has something to report (RECON-05).
- Profile Pis through `usePiWithProfile` / `restartPi`; implementation tags
  checked by `scripts/check-features.mjs`.

### Integration Points

- `index.ts` (frozen) composes the materializer with `agentGrantsStep` and
  calls `createLoadReconcile({ loadState }, applyReconcile)`.
- `agentsPhase` (`install-outcome.ts`, Phase 4's function) and the agent
  staging in `update-swap.ts` (Phase 4's function) pass the grant inputs.

</code_context>

<specifics>
## Specific Ideas

- The red proof under built-in is the change of the foreground refusal from
  "does not offer mcp:plugin_demo_stub_/echo" to "servers that extensions
  registered (plugin_demo_stub)".
- A background child is modeled by the variable pi-subagents sets, through
  the existing launch-environment stand-in, because the harness cannot start
  a real background child that loads the extension (MCPBG-01).

</specifics>

<deferred>
## Deferred Ideas

- Rewriting legacy rows (written before this phase, no stored forms) at load
  without a reinstall: needs a lossy reverse mapping for long built-in tool
  names; left for a follow-up if the user wants it.
- A user-visible warning when a load cannot rewrite an agent (edited file,
  held lock): would need a new closed-set entry.
- Background agents calling plugin MCP tools under built-in (MCPV2-03).

</deferred>
