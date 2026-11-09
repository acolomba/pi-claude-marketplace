# Phase 16: Background-Child Load - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Behavioral coverage for the load of a pi-subagents background child
(CHILD-01, CHILD-02). A child loads the installed plugins as its parent does,
but its load changes nothing that is installed (D-MB-12). The product gates
already exist (`platform/subagent-child.ts`, the child branch of
`createLoadReconcile` in `orchestrators/reconcile/load.ts`, and the early
return of `agentGrantsStep` in `orchestrators/mcp/agent-grants-step.ts`), so
the phase adds scenarios that pin them, each with a red proof. A product
change happens only if a scenario exposes a bug in this phase's own files.

The phase owns `features/plugin/subagent-child.feature` (it holds the Phase 1
seed) and, only if a scenario needs a step that no shared module has, a new
`features/step_definitions/plugin/subagent-child.steps.ts`. Product files it
may fix: `platform/subagent-child.ts` and the background-child gates in
`orchestrators/reconcile/load.ts` and `orchestrators/mcp/agent-grants-step.ts`,
with their unit pairs.

Upstream position (claude-code-compat-research, one line): the child gate
itself is a Pi-only surface with no upstream analogue (D-MB-12 is a recorded
project decision), but "its hooks run" touches the hooks contract, which was
researched (see Hooks below).

</domain>

<decisions>
## Implementation Decisions

### Which load steps a child runs (settled by D-MB-12 / P4-DC-08, not reopened)
- A child skips the autoapply apply step, the AMIG-01 legacy `mcp.json` move,
  and the agent grants step. It runs the read-only pass (the MIG-01 first-run
  config migration and `loadState`'s legacy migration stay ungated because they
  are idempotent and the parent's load runs them first), the hooks hydration
  and routing rebuild, the built-in MCP resync (session-only registrations,
  no file), the plugin PATH recompute, and resource discovery.
- The background autoupdate pass needs no child gate: it arms only in `tui`
  mode (D-PL8-02), and pi-subagents 0.84.0 binds every child session with
  `mode: "print"` (`src/runs/shared/child-session.js`). The load's read-only
  pass never touches the completion cache file, which only the apply step
  writes. No scenario pins either fact; both are recorded here so the planner
  does not add a gate.
- The phase pins no MIG-01 or state-migration write in a child: those stay as
  P4-DC-08 left them, and pinning a write would cut against D-MB-12's "writes
  no file" wording without a criterion asking for it.

### What a child reports for a pending change (D-BG-1601)
- **D-BG-1601:** a child's load reports a pending change exactly as a parent
  load with autoapply off does: the `Reconcile pending` cascade with
  `needs apply` true and the `will install` / `will uninstall` /
  `will update` rows. It is not silenced. This is what the read-only pass
  already does, and the Phase 1 seed pins it. Rejected: a silent child load
  (a new branch in the shared load path for no user benefit; a real child's
  notices go nowhere a user sees anyway).

### CHILD-01: autoapply on, and the next parent load (D-BG-1602)
- One scenario covers criterion 1: a project-scope config with
  `{ "autoapply": true }` and, at the child's load, one pending install
  (declared, not recorded), one pending uninstall (recorded, no longer
  declared), and one pending update (recorded at 1.0.0, the dir-source
  marketplace now offers 1.1.0). The child's load reports the three as pending
  and the installation record of the project scope keeps exactly the two
  recorded plugins at 1.0.0.
- The installs that set it up run through the run's shared Pi
  (`the user has run "/claude:plugin install ..."`) before the child Pi
  starts, so the child's start load and its new session are its only loads.
- **D-BG-1602:** "the next parent load still shows the change as pending" is
  proven by a Pi without the child marker whose load, with autoapply still on,
  applies all three changes. A parent load with autoapply on acts on a pending
  change by applying it, so the applied changes are what shows that the child
  left them pending. The parent is a one-shot Pi in json mode
  (`the user runs "/claude:plugin list" in pi's json mode`, D-BG-09): it runs
  in the same sandbox with no `PI_SUBAGENT_CHILD`, and its step names no MCP
  word, so the scenario needs no implementation tag. Its outcome is checked
  through its results (whatever payloads json mode records, the load's
  included) and through `the installation record of the project scope holds
  these plugins:`. Rejected: restarting through the launch-environment child
  step of `mcp-server/agent-grants.steps.ts` (its restart steps name
  pi-mcp-adapter or mcp, which would turn a non-MCP scenario into an MCP one),
  and turning autoapply off between the two loads (a `Given` after a `When`).
- The seed "A background child's load leaves a declared plugin pending while
  autoapply is on" is rewritten into this scenario, which keeps every step it
  used in use (`pi runs with the scripted model as a pi-subagents background
  child` above all). `mcp-server/agent-grants.feature` keeps its own
  install-nothing scenario (MGRT-02); it is unowned and left alone.

### CHILD-02: the legacy move and the agent grants (D-BG-1603, D-BG-1604)
- **D-BG-1603:** one new scenario: a user-scope plugin with an MCP server,
  `mcp.json` rewritten as release 0.19.2 wrote it beside the user's own server
  (the Phase 9 shared step), then the child Pi and a new session. The child
  moves nothing: no `mcp-migration` result, and both `mcp.json` and
  `mcp-adapter.json` hold the text they held before. Then a parent one-shot
  json-mode run moves the entries, as Phase 9's seed shows a parent load does,
  so the scenario proves the child left a move that a parent makes. The child
  runs Pi's built-in MCP under both profiles (its step loads no companion), so
  the scenario chooses its own implementation and carries
  `@own-implementation` (runs once, under the adapter profile).
- **D-BG-1604:** the grant half of criterion 2 is already pinned by the
  unowned scenario "A pi-subagents background child leaves an agent's grant in
  the form it holds (MGRT-02)" in `features/mcp-server/agent-grants.feature`.
  The phase does not duplicate it in its own file; it re-runs that scenario's
  red proof (the child gate removed from `agentGrantsStep` makes it fail) and
  records it in the plan SUMMARY, and the verification cites it for
  criterion 2.

### CHILD-02: the child still loads the components (D-BG-1605)
- Skills and slash commands: one scenario with a project-scope plugin that has
  a skill and a slash command, installed through the shared Pi; the child's
  new session reports no results, offers the skill (`the session offers these
  skills:`), and lists the command (`the user lists the slash commands pi
  offers` / `pi offers these slash commands from prompt templates:`). Two
  `When` steps are acceptable here: the session and the registry listing are
  two reads of one behavior.
- **D-BG-1605:** "its hooks run" is proven with a `PreToolUse` hook on a tool
  call that the child's scripted model makes (`the hooks record these runs:`),
  in a scenario of its own. Upstream evidence (code.claude.com/docs/en/hooks,
  read 2026-11-08): "Hooks from settings files, managed policy settings, and
  plugins also run inside subagents. When a subagent calls a tool, tool events
  such as `PreToolUse` and `PostToolUse` fire the same configured hooks as in
  the main conversation". The docs say nothing about `SessionStart` in a
  subagent (a subagent's start is `SubagentStart`, which Pi cannot fire), so
  no scenario pins a `SessionStart` run in a child.
- The hooks table selects only the columns the tool-use scenarios already
  pin; it does not select `agent_id` or `agent_type`, which upstream adds
  inside a subagent and this extension cannot know (see Deferred).

### Red proofs and gates
- Every new or rewritten scenario fails without the behavior it names, shown
  by a temporary, uncommitted mutation: the autoapply skip (the child branch
  of `createLoadReconcile` falls through to `loadReconcileWithReader`), the
  move skip (`NO_MCP_MOVE` replaced by the default move), the grants skip
  (the `isSubagentChild` return removed), and, for the component scenarios, a
  child load that discovers nothing and routes no hook. Each plan SUMMARY
  records the mutation, the failing run, and the passing run.
- No product change is expected. If a scenario exposes a bug in an owned file,
  the fix lands with a unit test in the paired test file; a bug elsewhere is a
  parent line and a dubious choice.

### Claude's Discretion
- Plan split and wave count. The scenarios share one feature file, so plans
  that edit it cannot share a wave; fewer waves mean fewer full gates on a
  machine shared with fourteen other phases.
- Plugin, skill, command, and hook names, and the exact tables, once observed.
- Whether a new verb step module is needed at all (none is expected).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pi runs with the scripted model as a pi-subagents background child`
  (`companion.steps.ts`): a profile Pi with `PI_SUBAGENT_CHILD=1` and no
  companion (D-BG-10). A restart of it keeps the marker.
- `pi runs with the scripted model and pi-subagents as a pi-subagents
  background child` (`mcp-server/agent-grants.steps.ts`): the
  launch-environment child, whose restart starts a Pi without the marker.
- `the user runs {string} in pi's json mode` (`command.steps.ts`): a one-shot
  Pi in the run's sandbox, without the child marker, whose payloads become the
  command results (D-BG-09).
- Pending setups: `features/plugin/pending.feature` (update to the version a
  path-source marketplace now offers; one hand edit that causes install and
  uninstall), `features/plugin/autoapply.feature`.
- Legacy move: `the mcp.json file of the {word} scope holds the servers of the
  plugin {string} as release 0.19.2 wrote them, beside the user's own server
  {string}` and `the mcp configuration file {string} of the {word} scope holds
  this text:` (`mcp-configuration.steps.ts`), as in
  `features/mcp-server/legacy-move.feature`.
- Hooks: `the published plugin {string} of the marketplace {string} has these
  hooks, each recording its runs:`, `the scripted model plays these steps:`,
  `the user prompts {string}`, `the hooks record these runs:`, as in
  `features/hook/tool-use.feature`.
- Records: `the installation record of the {word} scope holds these plugins:`
  (id, version, enabled) and `... holds no plugins`.

### Established Patterns
- `createLoadReconcile(reader, applyReconcile, env = process.env)` reads the
  marker on every load; a child runs `readOnlyPass(reader, SCOPES, { ...opts,
  migrateMcpEntries: NO_MCP_MOVE })`.
- `agentGrantsStep(input, env)` returns before it reads the context in a
  child or with no active implementation.
- Unit tests already cover the gates: `test/platform/subagent-child.test.ts`,
  `test/orchestrators/reconcile/load.test.ts`, and the agent grants step test.

### Integration Points
- `index.ts` wires `agentGrantsStep(input, process.env)` and the default `env`
  of `createLoadReconcile`; it is a shared load-path file (Phases 7, 8, 9, 16)
  and the phase does not need to edit it.

</code_context>

<specifics>
## Specific Ideas

- The Phase 1 seed's child report shows each pending row twice, because Pi
  1.5.0 runs the load twice for one RPC new session; the rewritten scenario
  keeps both rows, as every new-session scenario does.
- Reread `.agents/skills/cucumber/rules/features.md` before writing: whole
  tables, no `And`, no `Given` after a `When`, whole literals.

</specifics>

<deferred>
## Deferred Ideas

- Hook input inside a child lacks upstream's `agent_id` and `agent_type`:
  pi-subagents runs several children in one runner process and gives the
  extension no per-child identity, so this is a Pi capability gap for now.
  It belongs to the hook phases, not here (P16-DC-03).
- Whether `SessionStart` hooks should run in a child: upstream documents no
  `SessionStart` for subagents and Pi has no `SubagentStart`. The extension
  runs them today; left unpinned (P16-DC-03).
- Byte-level proof that a child leaves `state.json` untouched (the record step
  compares id, version, and enabled only).

</deferred>
