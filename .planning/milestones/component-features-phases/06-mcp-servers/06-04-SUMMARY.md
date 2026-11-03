---
phase: 06-mcp-servers
plan: 04
subsystem: testing
tags: [cucumber, pi-mcp-adapter, pi-subagents, mcp, scripted-model]

requires:
  - phase: 06-mcp-servers
    provides: "06-01: the shared MCP steps in listing.steps.ts and publishMcpServerAgent in mcp-server-files.ts"
provides:
  - "features/mcp-server/invocation.feature: the MCP-02 direct call and its negative control, and the two MCP-07 / D-CF6-10 pins"
  - "features/step_definitions/mcp-server/invocation.steps.ts: the two agent Givens"
affects: [06-07, 06-09]

actuals:
  tokens: 5189
  tasks: 2
  commits: 2
plan_head_before: 38f3900e2eae43d2ac45a3fef8cb3aee95395a16
plan_head_after: dd50a4d7473b36b4a9af31e62ba4301d122758cf

tech-stack:
  added: []
  patterns:
    - "A pi-subagents scenario in an MCP feature installs through the shared Pi, then starts the profile Pi with pi-subagents and pi-mcp-adapter, and waits for the startup listing before the turn"

key-files:
  created:
    - features/step_definitions/mcp-server/invocation.steps.ts
  modified:
    - features/mcp-server/invocation.feature

key-decisions:
  - "The negative control pins the stub log as measured: pi-mcp-adapter reconnects and lists the tools again for a proxy call to an unknown tool, and sends no tools/call. The title says the call is never sent to the server, not that the server is never reached"
  - "Both D-CF6-10 scenarios also compare the stub log (startup listing only), and the no-tools scenario keeps the stub server, so it proves the child is offered no plugin tool while one exists"

patterns-established:
  - "Agent fixtures of the MCP features are written by publishMcpServerAgent; their Givens check the file's tools: lines whole"

requirements-completed: [MCP-02, MCP-07]

coverage:
  - id: D1
    description: "After mcp({ search: \"echo\" }), a direct call mcp__plugin_demo_stub__echo {\"text\":\"direct\"} reaches the stub as tools/call and returns echo:direct to the model"
    requirement: MCP-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature#A direct call to the tool a search activated reaches the plugin's server"
        status: pass
    human_judgment: false
  - id: D2
    description: "Negative control: a proxy call to mcp__plugin_demo_stub__missing returns the adapter's whole not-found answer, and the stub receives no tools/call"
    requirement: MCP-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature#A call to a tool the plugin's server does not list is never sent to the server"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-CF6-10: a foreground run of an agent granted mcp__plugin_demo_stub__echo is refused with the whole Unresolved MCP direct-tool selectors result; the stub logs only the startup listing"
    requirement: MCP-07
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature#A foreground run of an agent granted a plugin MCP tool is refused before the child runs (D-CF6-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-CF6-10: a foreground agent with no tools: list runs; its child call is offered no mcp tool and no plugin tool"
    requirement: MCP-07
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature#A foreground agent without a tools list runs without the plugin's MCP tools (D-CF6-10)"
        status: pass
    human_judgment: false
  - id: D5
    description: "MCP-07 is met only as a recorded pi-subagents gap, not as a working call from an agent"
    verification: []
    human_judgment: true
    rationale: "Whether a pinned companion gap satisfies MCP-07 is a requirement-level judgment for the verifier and the parent (D-CF6-10); no test can decide it"

duration: 35min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 04: MCP server calls from the model and from agents Summary

**The model reaches the plugin's server on both call paths: the `mcp` proxy (the seed) and a direct call to `mcp__plugin_demo_stub__echo` after an activating search. A proxy call to an unknown tool never sends a `tools/call`. MCP-07 is pinned as the pi-subagents 0.84.0 gap (D-CF6-10): a foreground agent granted the plugin tool is refused whole, and a foreground agent without `tools:` gets no MCP tool.**

## Performance

- **Duration:** about 35 min
- **Started:** 2026-11-01T15:17Z
- **Completed:** 2026-11-01T15:52Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `features/mcp-server/invocation.feature` now has six scenarios. The two seed scenarios are byte-for-byte unchanged. The feature description gained one sentence that names the D-CF6-10 gap.
- MCP-02, direct path: "A direct call to the tool a search activated reaches the plugin's server".
- MCP-02, negative control: "A call to a tool the plugin's server does not list is never sent to the server".
- MCP-07 / D-CF6-10: "A foreground run of an agent granted a plugin MCP tool is refused before the child runs (D-CF6-10)" and "A foreground agent without a tools list runs without the plugin's MCP tools (D-CF6-10)".
- `features/step_definitions/mcp-server/invocation.steps.ts` adds two Givens, both through `publishMcpServerAgent` (D-CF6-07). Each checks the written file's `tools:` lines whole.

## Task Commits

1. **Task 1: the direct call and the negative control (tracer):** `80d972a` (test)
2. **Task 2: the D-CF6-10 pins and the agent Givens:** `dd50a4d` (test)

Tracer gate: the tracer's `<verify>` is automated only, and the mode is `end-of-phase`. So the gate re-ran `npx cucumber-js features/mcp-server/invocation.feature` (three green runs, seeds 675824, 397652, 413307) and `npm run check:features` (passed) before Task 2 started.

## Step texts added

- Given `the published plugin {string} of the marketplace {string} has the agent {string} granted the mcp tool {string}`
- Given `the published plugin {string} of the marketplace {string} has the agent {string} with no mcp tools`

## Measured literals (Pi 1.4.0, pi-mcp-adapter 7.0.0, pi-subagents 0.84.0)

Direct call (script: `mcp {"search": "echo"}`, then `mcp__plugin_demo_stub__echo {"text": "direct"}`, then `Done.`):

- The search result matches the 06-01 tracer: `mcp returned: Activated as direct tools: mcp__plugin_demo_stub__echo.\n\nFound 1 tool matching "echo":\n\nmcp__plugin_demo_stub__echo\n  Echoes the text it is given.\n\n  Shape:\n    { text: string; }`
- Call 3: `tool call mcp__plugin_demo_stub__echo {"text":"direct"}`, then `mcp__plugin_demo_stub__echo returned: echo:direct`.
- The stub log has the startup listing, a second `initialize` / `notifications/initialized` / `tools/list` round, then `tools/call` `{"name":"echo","arguments":{"text":"direct"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 2}","progressToken":2}}`.

Negative control (script: `mcp {"tool": "mcp__plugin_demo_stub__missing", "args": {"text": "ping"}}`):

- The tool result is `mcp returned: Tool "mcp__plugin_demo_stub__missing" not found. Server "plugin_demo_stub_" has: mcp__plugin_demo_stub__echo`.
- The stub log has two listing rounds and no `tools/call`. The adapter connects and lists the tools before it answers. See Deviations.

Agent granted the tool (`tools: mcp__plugin_demo_stub__echo`, call `subagent {"agent":"demo:runner","task":"say ping","async":false}`):

- The tool result is `subagent failed: Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; runtime-registered servers require a host/pi-mcp-adapter handoff before child launch.` This is the text research probe P4 measured.
- The script needs only two steps (`subagent`, then `Done.`). The child never calls the model, so call 2 is the parent's continuation.
- The stub log has only the startup listing.

Agent without `tools:` (call `subagent {"agent":"demo:helper","task":"say ping","async":false}`, child reply `pong`):

- Call 1 (parent) and call 3 (parent) are offered `read, bash, edit, write, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, subagent, contact_supervisor, bg_wait, mcp, subagent_supervisor`.
- Call 2 (the child) is offered `read, bash, edit, write, bg_wait, contact_supervisor`, with no `mcp` and no plugin tool. This matches probe P5.
- The child's call receives `Task: say ping`. The parent receives `subagent returned: Run fan-out: 1/64 used, 63 remaining\npong\nMission: {uuid} (completed)`.
- The stub log has only the startup listing.

No measured literal holds an em dash, so every literal is pinned whole.

## Files Created/Modified

- `features/mcp-server/invocation.feature`: four new scenarios and one added description sentence.
- `features/step_definitions/mcp-server/invocation.steps.ts`: the two agent Givens.

## Decisions Made

- The negative control pins the two listing rounds it measured (see Deviations).
- The no-tools agent scenario keeps the stub server and also compares the stub log. So the scenario proves that the child gets no plugin tool while one exists, and that nothing called the server.
- The D-CF6-10 reference sits in both scenario titles and in the feature description. The layout rule says a scenario that pins a divergence names its ID or gap.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The negative control's expected stub log was wrong**
- **Found during:** Task 1
- **Issue:** The plan and the must-have truth say the stub's log "holds only the startup listing". As measured, pi-mcp-adapter 7.0.0 reconnects to the lazy server and lists its tools again before it answers that the tool is not found. So the log holds two `initialize` / `notifications/initialized` / `tools/list` rounds and no `tools/call`.
- **Fix:** The scenario pins the measured log whole. Its title is "A call to a tool the plugin's server does not list is never sent to the server", not "... never reaches the server", because the adapter does reach the server to list it.
- **Files modified:** `features/mcp-server/invocation.feature`
- **Verification:** 3 green runs of the feature after Task 1, 3 after Task 2, and 1 run of the 13 MCP scenarios.
- **Committed in:** `80d972a`

---

**Total deviations:** 1 auto-fixed (1 bug in a plan expectation).
**Impact on plan:** The negative control still proves its point, that no `tools/call` reaches the server. The literal pinned is what the adapter does, not what the plan expected. No product file changed.

## Issues Encountered

- No red proof applies. These scenarios pin existing adapter and pi-subagents behavior. Neither task changes `/claude:plugin` behavior, and no product break was found.
- No "Handed-over fix" for 06-07.
- No background (`async: true`) run was attempted, as the plan said (research Pitfall 6). In this harness a background child loads neither the adapter nor the scripted model.

## Verification

- `npx cucumber-js features/mcp-server/invocation.feature`: 6/6 passed three times in a row (seeds 974609, 592814, 31682). The seed scenarios passed every time with their text unchanged.
- `npx cucumber-js features/mcp-server`: 13/13 passed (seed 287368).
- `npm run check:static` passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- `npx fallow dupes --fail-on-issues --format human --quiet`: exit 0, no clone group.
- Acceptance greps: `echo:direct` 1, `mcp__plugin_demo_stub__missing` 3, `^  Scenario` 6, `D-CF6-10` 3, `Unresolved MCP direct-tool selectors` 1, `agent-files` in the step module 0.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 06-09 can file the pi-subagents gap report from the facts below and write the docs row.
- `publishMcpServerAgent` now has an importer. Its `/** @public */` tag can go in the post-wave cleanup that 06-01 listed.

## Parent lines

Ready-to-file pi-subagents gap facts, for plan 06-09 (docs row and gap report):

- **Versions:** Pi 1.4.0, pi-subagents 0.84.0, pi-mcp-adapter 7.0.0. Both companions are loaded into the parent Pi through `--extension`.
- **Agent frontmatter** (a plugin agent, `agents/runner.md`): `name: runner`, `description: Calls the tools the task names.`, `tools: mcp__plugin_demo_stub__echo`.
- **Converted selector:** the agents bridge writes the tool as `mcp:plugin_demo_stub_/echo` (`bridges/agents/convert.ts`, ANAME-02), and its install warns: "tools include MCP tools, which pi-subagents runs only in background launches -- launch this agent with `async: true`; a foreground launch fails, and so does a launch before pi-mcp-adapter has cached the server's tools".
- **Foreground launch:** `subagent {"agent":"demo:runner","task":"say ping","async":false}`. pi-mcp-adapter had already listed the server's tools (the scenario waits for that). The tool result is an error: `Unresolved MCP direct-tool selectors: plugin_demo_stub_/echo. Direct MCP tools require a matching configured server and fresh metadata cache; runtime-registered servers require a host/pi-mcp-adapter handoff before child launch.` The child never runs, and the server receives nothing after the startup listing.
- **Foreground child without `tools:`:** it runs, and it is offered `read, bash, edit, write, bg_wait, contact_supervisor`, with no `mcp` proxy and no plugin MCP tool.
- **pi-subagents' own statement** (`docs/agents.md`, about line 553): "Agents that need MCP tools from an ambient adapter such as pi-mcp-adapter (including `mcp:` entries the adapter resolves) must therefore run as background children (`async: true`). A foreground launch of such an agent fails with a diagnostic that says exactly that."
- **Not claimed:** the root cause. The diagnostic text names a cache problem ("fresh metadata cache"), not the background-only rule, although the adapter's cache held the server. Research assumption A2, a cache-hash mismatch between the two packages, was not isolated.
- **Not tested:** a background run. In this harness a background child loads neither the parent's `--extension` companions nor the scripted model, so the working call that MCP-07 describes cannot be observed here.
- **Ask for the report:** either give a foreground child the ambient adapter's MCP tools, or make the foreground diagnostic say that MCP tools need `async: true`, as the docs promise.

Other parent lines:

- Phase 6 log (the orchestrator appends): the negative-control deviation above. pi-mcp-adapter 7.0.0 connects and lists a lazy server's tools for a proxy call to a tool that server does not list.
- REQUIREMENTS.md: this executor did not mark MCP-02 or MCP-07 complete. Wave-2 siblings may declare the same IDs, and MCP-07 is met only as the D-CF6-10 gap. The orchestrator or the phase verifier decides.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-10 and T-06-11 are mitigated as planned: the no-tools scenario pins that a foreground child is offered no MCP tool, and both D-CF6-10 scenarios compare the whole result.

## Self-Check: PASSED

- FOUND: features/mcp-server/invocation.feature, features/step_definitions/mcp-server/invocation.steps.ts
- FOUND commits: 80d972a, dd50a4d (2 commits, measured `git rev-list --count 38f3900..HEAD`)
- Acceptance criteria of both tasks re-run: all PASS
- Plan verification re-run: invocation.feature three green runs, check:features and fallow dupes pass

## Dubious Choices

1. **The negative control pins two listing rounds and is retitled "is never sent to the server".** Alternatives: keep the planned title and expect one round, which fails; or compare only the absence of `tools/call`, which is a partial check that the cucumber rules forbid. Dubious because the plan's must-have truth says "never reaches the stub (its log holds only the startup listing)", and the pinned behavior contradicts that wording.
2. **The feature description gained a D-CF6-10 sentence, and both titles end with "(D-CF6-10)".** Alternatives: name the gap in the titles only, or in Gherkin comments. Dubious because the cucumber rules forbid "ticket and plan references" in titles. A decision ID is allowed only because the layout rule asks a divergence scenario to name its ID.
3. **The no-tools scenario keeps a stub server and compares its log.** The plan listed only the calls and the offered tools. Alternative: a plugin without MCP servers, which would not show that a plugin tool exists but is withheld. Dubious only because it goes beyond the plan's list.
4. **The agent Givens check the `tools:` lines, not the whole file text.** Alternative: compare the whole text, which would copy the writer's description and body into the step. Dubious because a wrong `name:` or body would pass the Given. The later scenario steps would still catch it.
5. **REQUIREMENTS.md was not updated** (see Parent lines). Dubious because execute-plan's metadata step normally marks the plan's requirements in worktree mode.
