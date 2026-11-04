---
phase: 04-agent-grants
plan: "05"
subsystem: agents-bridge
status: complete
tags: [agents, pi-subagents, mcp, builtin-mcp, install, update, cucumber, agents-index]

requires:
  - phase: 04-agent-grants
    provides: "04-03: StageAgentsInput.mcpGrantForms and per-form staging with both forms on the index row"
  - phase: 04-agent-grants
    provides: "04-04: the session-start grant rewrite and the legacy translation"
  - phase: 04-agent-grants
    provides: "04-02: the MGRT-02 child gate and the background-child Pi step"
provides:
  - "agentsPhase passes mcpGrantForms { active: opts.run.softDeps.mcpImplementation, declaredMcpServers }"
  - "update-swap.ts prepareUpdateAgents and updateAgentImplementation (direct run, else preflightNotification.run, else none)"
  - "features/lib/upstream/subagents.ts projects a built-in server or selector in a pi-subagents error"
  - "features/lib/mcp-agent-earlier-index.ts stripAgentGrantForms, readAgentIndexRows, holdsAgentGrantForms"
  - "steps: pi runs with the scripted model, pi-subagents, and the mcp implementation; the agents index of the user scope holds the rows an earlier release wrote"
  - "13 new scenarios in features/mcp-server/agent-grants.feature (17 in all)"
affects: [04-06 docs and parent lines, Phase 3 verdict-markers row]

estimate:
  tokens: 160000
  tasks: 3
actuals:
  tokens: 15400
  tasks: 3
  commits: 3
plan_head_before: b5ef98844aacb7b86d72241306610c5df5f2c96e
plan_head_after: 34a38c389d3b7ea4ae5ad3f57d9f2846cda9a1a7

tech-stack:
  added: []
  patterns:
    - "A shared-by-function file keeps its owner's edits in one extracted module-private function (prepareUpdateAgents), so the caller changes by one call"
    - "A Given that rewrites a fixture asserts its postcondition, not a changed count, so the red run on an older tree fails in the Then"

key-files:
  created:
    - features/lib/mcp-agent-earlier-index.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/orchestrators/plugin/install-outcome.test.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - features/mcp-server/agent-grants.feature
    - features/step_definitions/mcp-server/agent-grants.steps.ts
    - features/lib/upstream/subagents.ts

key-decisions:
  - "The update staging reads the active implementation from the direct run, then from preflightNotification.run, and otherwise stages the adapter form (P4-DC-13); a parent line repoints updateAgentImplementation once Phase 3's ThreePhaseArgs field lands"
  - "The verb scenarios install and run the verb inside the profile Pi, or install before it and run the verb inside it, so the session-start rewrite cannot mask the staging"
  - "The built-in D-CF6-10 twin states the model calls only; it has no stub-message step"

requirements-completed: [MGRT-01, MGRT-02]

coverage:
  - id: D1
    description: "An install, enable, import, or install cascade stages an agent's MCP grant in the active implementation's form and records both forms"
    requirement: MGRT-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/install-outcome.test.ts#MGRT-01: an install under Pi's built-in MCP stages the built-in grant and records both forms"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/agent-grants.feature#Installing a plugin in a pi session stages its agent with Pi's built-in mcp grant (MGRT-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An update, reinstall, or dependency move restages the grant in the active form, and a cascade with no run snapshot stages the adapter form"
    requirement: MGRT-01
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-swap.test.ts#MGRT-01: a direct swap under Pi's built-in MCP restages the agent with the built-in grant"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/agent-grants.feature#Updating / Reinstalling / Enabling ... (MGRT-01) pairs"
        status: pass
    human_judgment: false
  - id: D3
    description: "A switch, a session with no MCP, an agent an earlier release installed, and a background child behave as MGRT-01 and MGRT-02 require, as pi-subagents reports"
    requirement: MGRT-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/agent-grants.feature @own-implementation scenarios"
        status: pass
    human_judgment: false

duration: ~95 min
completed: 2026-11-04
---

# Phase 4 Plan 05: Active-implementation grants at every staging site Summary

**Install (`agentsPhase`) and update (`prepareUpdateAgents`) now stage each agent's MCP grant in the active implementation's form, taken from the run snapshot: `mcp:plugin_demo_stub/echo` under Pi's built-in MCP and `mcp:plugin_demo_stub_/echo` under pi-mcp-adapter or with no implementation. Thirteen new scenarios show what pi-subagents reports for install, update, reinstall, enable, the built-in foreground refusal, a switch, a session with no MCP, an agent an earlier release installed, and a background child.**

## Performance

- **Duration:** about 95 min
- **Completed:** 2026-11-04T15:15Z
- **Tasks:** 3 of 3
- **Files:** 1 created, 7 modified

## Accomplishments

- `install-outcome.ts` `agentsPhase` (only that function): passes `mcpGrantForms: { active: opts.run.softDeps.mcpImplementation, declaredMcpServers: installCtx.resolved.declaredMcpServers }` beside `mcpServerNames`, with an MGRT-01 / D-05 comment.
- `update-swap.ts`: the agents block of `prepareUpdateHandles` moved into the module-private `prepareUpdateAgents(ops, args, preflight, inputs)`, and `prepareUpdateHandles` calls it in the same place. Nothing else in that function changed. The module-private `updateAgentImplementation(args)` returns `args.run.softDeps.mcpImplementation` for a direct run, else `args.preflightNotification?.run.softDeps.mcpImplementation`, else `"none"`. Its comment records P4-DC-13 and the parent line that will repoint it.
- Unit cases:
  - `install-outcome.test.ts`: a built-in run writes `tools: read,mcp:plugin_empty_db/query`, emits the built-in async warning, and records `mcpImplementation: "builtin"` with both forms. A run with no implementation writes the adapter line and records `"adapter"` with both forms.
  - `update-swap.test.ts`: a direct swap with a built-in run, and a cascade swap whose `preflightNotification.run` reports built-in, both restage the built-in line and record `"builtin"`. A cascade swap with no snapshot writes the adapter line.
- `features/lib/upstream/subagents.ts`: adopted the verified regex, with the built-in alternative after the adapter one, and extended the header and pattern comments. The three existing `subagent failed` rows still project as before: the adapter profile passes the whole feature.
- `features/lib/mcp-agent-earlier-index.ts` (new; registers nothing and imports no product module): `stripAgentGrantForms` drops `mcpImplementation` and `mcpForms` from every row and writes the file back through a temporary file and a rename. `readAgentIndexRows` and `holdsAgentGrantForms` let the step assert the postcondition.
- Steps: `pi runs with the scripted model, pi-subagents, and the mcp implementation` composes `mcpImplementationLaunch(this.mcpProfile)` with pi-subagents. `the agents index of the user scope holds the rows an earlier release wrote` strips the index, then asserts that it holds at least one row and that no row keeps either field.
- Feature: the description now covers both implementations. New scenarios: four `@adapter-only` / `@builtin-only` verb pairs (install, update, reinstall, enable), the `@builtin-only` D-CF6-10 refusal twin, and four `@own-implementation` scenarios. In all: 5 `@builtin-only`, 7 `@adapter-only`, 4 `@own-implementation`, 17 `Scenario:`.

## Task Commits

1. **Task 1: An install in a session gives the agent the active implementation's grant** (tracer): `95c9b41` (feat)
2. **Task 2: Update, reinstall, and enable restage the active grant; the built-in refusal names the server**: `88f30b0` (feat)
3. **Task 3: The switch, a session with no MCP, an earlier release's agent, and a background child**: `34a38c3` (test)

## RED proofs

The commit hook refuses a commit with only failing tests, so each unit RED ran before its commit against the base source, which was then put back.

**Unit, Task 1** (base `install-outcome.ts`, new cases): 2 of 2 failed.
- The built-in case had actual `'tools: read,mcp:plugin_empty_db_/query'` where `'tools: read,mcp:plugin_empty_db/query'` was expected.
- The none case had actual `mcpImplementation: undefined, storedForms: []` where `'adapter'` and `['adapter','builtin']` were expected.

**Unit, Task 2**: there was no separate RED run, because the cases were written after the code. Before the change `prepareStagePluginAgents` got no `mcpGrantForms`, so all three cases would see `mcpImplementation: undefined` and the stage would write the adapter form for both built-in cases. The cucumber red runs below cover the same change end to end.

**Cucumber, pre-phase product tree** (`git checkout f5069e0 -- extensions/pi-claude-marketplace`, run, then `git checkout HEAD -- extensions/pi-claude-marketplace`; `git status --porcelain` was empty afterwards and nothing was committed in between):

- Builtin profile, whole file: `5 scenarios (5 failed)`, `73 steps (68 passed, 5 failed)`. Each failed at `Then the model receives these calls:`:
  - Installing ... Pi's built-in mcp grant: `+ tools mcp:plugin_demo_stub_/echo` / `- tools mcp:plugin_demo_stub/echo`
  - Updating ... Pi's built-in mcp grant: the same diff
  - Reinstalling ... Pi's built-in mcp grant: the same diff
  - Enabling a disabled plugin ... Pi's built-in mcp grant: the same diff
  - Foreground refusal under Pi's built-in MCP: `+ subagent failed: error naming plugin_demo_stub_/echo` / `- ... error naming plugin_demo_stub`
- Adapter profile, whole file: `12 scenarios (8 passed, 4 failed)`, `167 steps (161 passed, 2 skipped, 4 failed)`.
  - Three new `@own-implementation` scenarios failed at `the model receives these calls:` with `+ tools mcp:plugin_demo_stub_/echo` / `- tools mcp:plugin_demo_stub/echo`: the switch scenario (both runner rows), the no-MCP scenario, and the earlier-release scenario.
  - The fourth failure is 04-02's "A pi-subagents background child with autoapply on installs nothing (MGRT-02)". It fails at the session report, as its own SUMMARY records for the pre-phase `load.ts`.
  - Passed, as regression pins: the four new `@adapter-only` verb scenarios, the three D-CF6-10 adapter scenarios, and the background-child grants scenario (P4-DC-19).
- **Mutation red, background child** (adapter profile): the `isSubagentChild(env)` gate in `agent-grants-step.ts` was disabled, the scenario run, and the file restored with `git checkout HEAD -- ...agent-grants-step.ts`. `1 scenario (1 failed)`, `13 steps (12 passed, 1 failed)`, with `+ tools mcp:plugin_demo_stub/echo` / `- tools mcp:plugin_demo_stub_/echo`.

## Green runs (HEAD 34a38c3)

- `npm run test:cucumber:profile -- --profile adapter features/mcp-server/agent-grants.feature`: `12 scenarios (12 passed)`, `167 steps (167 passed)`.
- `npm run test:cucumber:profile -- --profile builtin features/mcp-server/agent-grants.feature`: `5 scenarios (5 passed)`, `73 steps (73 passed)`.
- Task 1 tracer gate, before expansion: builtin `1 scenario (1 passed)`, adapter `1 scenario (1 passed)`. Logged: Tracer verified end-to-end, expanding.
- `npm run test:coverage:direct` for `install-outcome.ts` and `update-swap.ts`: exit 0, 100% from each pair.
- `npm run test:modules`: exit 0, both after Task 1 and on the final tree. No other test pinned a whole agent-index row, so no other test file changed.
- `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features): passed before each commit.
- Acceptance greps: `mcpGrantForms` in install-outcome.ts 1; `prepareUpdateAgents` in update-swap.ts 2; `mcpGrantForms` in update-swap.ts 1; `@builtin-only` 5; `@adapter-only` 7; `@own-implementation` 4; `Scenario:` 17; `stripAgentGrantForms` in the step module 2.

## Cross-phase check: verdict-markers (for plan 04-06's parent line)

`npm run test:cucumber:profile -- --profile builtin features/mcp-server/verdict-markers.feature`: `9 scenarios (8 passed, 1 failed)`. The one failure is the expected `@builtin-only` "Update preserves dependency move warnings and MCP notices, under Pi's built-in MCP" (line 604). It fails only at the `lines` cell of its `diagnostic` row:

```
-  ... where Claude Code runs it in the foreground; a launch before pi-mcp-adapter has cached the server's tools still fails, [helper] dropped fields: color
+  ... where Claude Code runs it in the foreground; a launch before Pi's built-in MCP has listed the server's tools still fails, [helper] dropped fields: color
```

The dependency move now passes `preflightNotification.run` to the update staging, so it renders the built-in async warning (Pitfall 8). Phase 3 owns the file, and it was not edited. The parent line for 04-06: under the builtin profile, that row's `lines` cell should read "a launch before Pi's built-in MCP has listed the server's tools still fails".

## Deviations from Plan

None that change behavior. Two notes:
- The plan's filtered `npx cucumber-js --name '^(?!...)'` command for verdict-markers could not run: the worktree guard refuses that quoting. I ran the whole file under the builtin profile instead. That is stricter, and it shows the single expected failure and its diff.
- The mutation red disabled the gate with an always-false condition, not a line deletion. The effect is the same, and the file was restored from HEAD.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-18 is mitigated: the earlier-index step writes only `path.join(this.scopeRoot("user"), "pi-claude-marketplace", "agents-index.json")` inside the run's sandbox, through a `wx` temporary file and a rename. T-04-19 is mitigated: every red run restored with `git checkout HEAD -- extensions/pi-claude-marketplace` (or the one mutated file), and `git status --porcelain` was empty before the next action. T-04-17 is accepted as P4-DC-13 (see Dubious Choices).

## Coordinator note (Pi 1.5.0 `new_session` leak)

None of this plan's `@builtin-only` scenarios starts a new session. Each one starts one profile Pi and prompts it. The `@own-implementation` scenarios switch through `the user restarts pi ...`. So the After-hook stand-in leak does not apply, and no scenario was retagged.

## Parent lines

- Phase 3 / 04-06: the verdict-markers `diagnostic` row text above.
- When Phase 3's implementation field on `ThreePhaseArgs` lands, repoint `updateAgentImplementation` in `update-swap.ts` at it (P4-DC-13). Then autoupdate and apply convergence stage the active form directly.
- No frozen file changed.

## Dubious Choices

1. **Claude-Session trailer value**
   - Severity: Low
   - Choice: All three commits end with `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`, the value the child brief gives.
   - Alternatives: The harness attribution reminder names `session_01EDUMG87PKcySw33ikhvFmE`.
   - Why dubious: The two sources disagree. The executor prompt says "trailer lines exactly as in the child brief", and plans 04-01 to 04-04 did the same.
   - Recorded in: this SUMMARY.
2. **Autoupdate and apply convergence stage the adapter form until the next load (P4-DC-13 carried)**
   - Severity: High
   - Choice: `updateAgentImplementation` falls back to `"none"` when a cascade has neither a run nor `preflightNotification`. Under Pi's built-in MCP, those paths write the adapter grant and the adapter async warning text. The next session rewrites the file.
   - Alternatives: Thread an implementation field into `ThreePhaseArgs` here. Phase 3 owns that change, and the plan forbids it.
   - Why dubious: Until `/reload`, a user under built-in MCP who autoupdates sees the adapter warning text, and the agent has a grant pi-subagents cannot resolve.
   - Recorded in: P4-DC-13 in the phase DUBIOUS-CHOICES.md (existing), the function comment, and this SUMMARY's parent lines.
3. **The adapter-profile verb twins pass on the pre-phase tree**
   - Severity: Medium
   - Choice: The four new `@adapter-only` verb scenarios (install, update, reinstall, enable) are regression pins. They passed on the pre-phase tree, because the adapter form is what every earlier release wrote. Only their `@builtin-only` twins carry a red proof.
   - Alternatives: Drop the adapter twins, or make each adapter twin start from a built-in-form file.
   - Why dubious: The project rule asks for a scenario that fails without the change under each profile where it applies. Under the adapter profile the observable result did not change, so no red is possible. The plan names this as expected for the install pair, and I applied the same reading to the other three.
   - Recorded in: this SUMMARY (RED proofs).
4. **The built-in D-CF6-10 twin has no stub-message step**
   - Severity: Medium
   - Choice: The built-in refusal scenario states the model calls only: no child call, and `subagent failed: error naming plugin_demo_stub`. The adapter twin also checks the stub server's messages. That step was left out here, because the built-in stand-in's client handshake differs and the plan did not ask for it.
   - Alternatives: Measure the stand-in's handshake and add the messages table.
   - Why dubious: The adapter twin also proves that no `tools/call` reached the server. The built-in twin proves only that no child turn ran. A refusal that reached the server after the model turn would still pass.
   - Recorded in: this SUMMARY.
5. **The feature description is longer than the skill's two or three lines**
   - Severity: Low
   - Choice: The description takes ten lines to cover MGRT-01, D-MB-03, D-CF6-10, MGRT-02, and the stand-ins, as the plan asked.
   - Alternatives: Cut it to three lines and move detail to the scenario titles.
   - Why dubious: `.agents/skills/cucumber/rules/features.md` says two or three lines. `check:features` does not enforce that, and the file was already longer than that before this plan.
   - Recorded in: this SUMMARY.
6. **No standalone unit RED run for the update-swap cases**
   - Severity: Low
   - Choice: The three `update-swap.test.ts` MGRT-01 cases were written after the code. Their RED is argued from the base code path and shown end to end by the cucumber red runs, not by a recorded unit run.
   - Alternatives: Restore the base `update-swap.ts`, run the cases, and record the output.
   - Why dubious: A reviewer may want a unit-level failing run for each new case.
   - Recorded in: this SUMMARY (RED proofs).

## Next Phase Readiness

- Plan 04-06 can write the docs and the parent lines above. MGRT-01 and MGRT-02 now hold end to end, as pi-subagents reports them, under both profiles.
- I did not edit STATE.md, ROADMAP.md, or REQUIREMENTS.md. The orchestrator marks the requirements after the wave.

## Self-Check: PASSED

- FOUND: features/lib/mcp-agent-earlier-index.ts
- FOUND: 95c9b41, 88f30b0, 34a38c3 (ancestors of HEAD)
- `npm run check:static`, `npm run test:modules`, direct coverage for both pairs, and both cucumber profiles on agent-grants.feature exited 0 on HEAD 34a38c3.
