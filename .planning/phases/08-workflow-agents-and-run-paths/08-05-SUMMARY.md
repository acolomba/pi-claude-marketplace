---
phase: 08-workflow-agents-and-run-paths
plan: "05"
subsystem: agents
tags: [agents, workflows, parity, docs]
status: complete
requires: ["08-01", "08-04", "08-07"]
provides:
  - "The recorded option-a choice for PG-WF-05 (plan 08-06 reads it and does not apply)"
  - "Guard scenario: An agent that grants Workflow gets no workflow tool, as Claude Code gives the tool to no subagent"
  - "docs/mcp-compatibility.md passage on the dropped Workflow grant (D-PG8-11) and the Agents divergence bullet on the ambient engine tools (D-PG8-14)"
  - "One README sentence in each of README.md and README.es.md"
affects: [features/agent/frontmatter.feature, docs/mcp-compatibility.md, README.md, README.es.md]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified: [features/agent/frontmatter.feature, docs/mcp-compatibility.md, README.md, README.es.md]
decisions:
  - "D-PG8-11 as amended, option-a: a tools entry Workflow or Workflow(<name>) of a bridged agent stays dropped, as Claude Code gives the Workflow tool to no subagent and Pi has no main-session agent mode"
  - "D-PG8-14 as amended: the ambient workflow/workflow_control tools of a background child of an agent with no tools list are a recorded residual, not changed here"
metrics:
  completed: 2026-11-15
  tasks: 2
  files: 4
actuals:
  tokens: 3199
  tasks: 2
  commits: 1
plan_head_before: 9871a2568fa40a120e81b43aec3b45b80e71d4b2
plan_head_after: a179ee044883a50b909a1874c250337a39ce732a
---

# Phase 8 Plan 05: The Workflow grant of a bridged agent Summary

Decision: option-a. Answered by the orchestrator for the autonomous run, pending the maintainer's review (not by this executor). Decision ID: D-PG8-11 as amended (option A of the amended D-PG8-11..15); no new divergence ID, because option A is the upstream-parity default.

The four S5(a) verdict lines of `08-SPIKE-S5.md` the choice was made on, as recorded:

- S5(a) blocking call: Passed for both arms. A real pi-subagents 0.88.1 background child that loads engine 3.15.0 was offered `workflow`, ran `demo:scan` with `background: false`, and got `scan: Done.` in the same turn. This was true for an agent with no `tools` list and for an agent whose generated `tools` line lists `read, workflow`. The run's `status.json` was `complete`, and pi-subagents' required-tool check did not refuse the listed agent.
- S5(a) default call: The child got the text `Workflow "scan" started in the background.` and a run ID. Its model ended the turn, so the result never reached it. The run itself completed in the runner, and its record keeps `pendingDelivery` `{"kind":"complete"}`. In one of four default-call children, the engine appended a `workflow-result` message to the child's session file after the child's last answer, and no provider request came after that message.
- S5(a) agent with no tools list: Yes. A background child of an agent with no `tools` list was offered both `workflow` and `workflow_control`, beside this extension's tools, `mcp`, and pi-subagents' own tools. Claude Code gives neither tool to a subagent.
- S5(a) foreground control: Yes. pi-subagents refused the launch with `"async": false` before any model request, with `Agent 'demo:lst-fg' ran as a foreground child, which never loads the parent's ambient extensions, and these child tools were unavailable: workflow.`

Upstream evidence shown for the choice (08-RESEARCH.md E3, E4, E8): Claude Code's sub-agents page lists `Workflow` among the tools removed from every subagent "even when listed in the `tools` field"; the 2.1.323 binary puts it in the always-denied set for every Agent-tool subagent; the official `claude-security` agent says it runs only as the main agent of a session.

## Commits

- `a179ee04` docs(agents): say why a Workflow grant of an agent is dropped (features/agent/frontmatter.feature, docs/mcp-compatibility.md, README.md, README.es.md; no path under extensions/ or test/)

Plan base `9871a256`; `git rev-list --count 9871a256..HEAD` = 1 before this SUMMARY commit.

## Task 08-05-01 (checkpoint:decision)

Answered by the orchestrator as option A before this executor started (dispatch message). No file changed before the answer. Option B is not implemented; plan 08-06 does not apply.

## Task 08-05-02: guard scenario, red/green

Scenario "An agent that grants Workflow gets no workflow tool, as Claude Code gives the tool to no subagent" in `features/agent/frontmatter.feature`, after "A disallowed Agent or Task entry removes the subagent tool from a tools list". Companions pi-subagents and pi-dynamic-workflows, builtin agents hidden, plugin `demo` with the workflow `scan` and the agent `lead` whose `tools` cell is `Read, Workflow, Workflow(demo:scan)`. One When, no tag. Final tool result row (complete calls table of four rows):

```text
subagent returned: agent demo:lead\npath {agent dir}/agents/pi-claude-marketplace-demo-lead.md\ndescription Delegates the tasks.\naliases pi-claude-marketplace-demo-lead\ntools read\nsystem prompt mode replace\ninherit project context true\ninherit skills false\nsystem prompt:\nAnswer the task.
```

No launch-mode line.

- Green on the unchanged tree: `node scripts/install-test-peers.mjs && npx cucumber-js --profile adapter --name 'An agent that grants Workflow gets no workflow tool'` -> 1 scenario (1 passed), 15 steps passed.
- Mutation (working tree only): added `["Workflow", "workflow"],` after `["Task", "subagent"],` in `TOOL_MAP` of `extensions/pi-claude-marketplace/bridges/agents/convert.ts`. Red: 1 scenario (1 failed), 15 steps (14 passed, 1 failed). Failing step `Then the model receives these calls:` with `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal`; actual `...aliases pi-claude-marketplace-demo-lead\ntools read, workflow\nsystem prompt mode replace...`, expected `...tools read\n...`.
- Restored with `git checkout -- extensions/pi-claude-marketplace/bridges/agents/convert.ts`; `git diff --quiet HEAD -- extensions test` exit 0. Green again: 1 scenario (1 passed).
- `npm run check:features` exit 0. Under `--profile builtin` the untagged scenario is not selected (0 scenarios), as the profile runs only `@mcp`/`@builtin-only`.
- `SKIP=npm-check pre-commit run --files features/agent/frontmatter.feature docs/mcp-compatibility.md README.md README.es.md` exit 0, no file rewritten.

## Text added

docs/mcp-compatibility.md, "Customizing generated agents", after the `Agent`/`Task` paragraph:

> A `tools:` entry `Workflow` or `Workflow(<name>)` is dropped (D-PG8-11):
>
> - Claude Code gives the Workflow tool to no subagent. Its sub-agents page lists `Workflow` among the tools that are removed from every subagent, also when the `tools` field lists it. The 2.1.323 binary denies the tool to every subagent that the Agent tool starts. The official `claude-security` agent lists the grant, and it says that it runs only as the main agent of a session.
> - On Pi, every bridged agent runs as a pi-subagents child, and Pi has no main-session agent mode. So the grant has nothing to map to.
> - A plugin's commands and skills start its workflows from the main session. Their references to a workflow name the installed workflow (D-PG4-08, see [Naming](workflows-compatibility.md#naming)). [What a workflow subagent can reach](workflows-compatibility.md#what-a-workflow-subagent-can-reach) describes the subagents of a run.
> - The generated file lists the dropped entries in `droppedTools`, and the staging warning of `apply` and of the update cascades names them. An agent whose `tools:` holds only `Workflow` entries maps to no tool, so its install is refused (AG-11). Claude Code fails such an agent when it launches.
>
> Evidence: the scenario "An agent that grants Workflow gets no workflow tool, as Claude Code gives the tool to no subagent" in `features/agent/frontmatter.feature`.

docs/mcp-compatibility.md, "Divergences and documented absences" > "Agents", new last bullet:

> - A background child of an agent with no `tools:` list is offered the workflow engine's `workflow` and `workflow_control` tools when the engine is installed. Claude Code gives a subagent neither tool. This was measured by spike S5 on 2026-11-14, with Pi 1.5.0, pi-subagents 0.88.1, and the engine 3.15.0. A `disallowedTools` entry `Workflow` does not remove the two tools: the entry has no Pi tool mapping, so it gets the warning that it cannot narrow the default tool set (D-PG8-14). Reason: pi-subagents loads the user's extensions in a background child, and the engine turns on its tools there. Whether this extension should exclude them is an open question for the maintainer.

README.md, Agents bullet of Features: "An agent's `Workflow` grant is dropped, because Claude Code gives the Workflow tool to no subagent."
README.es.md, same bullet: "El permiso `Workflow` de un agente se descarta, porque Claude Code no da la herramienta Workflow a ningún subagente."

## Deviations from Plan

- The passage is an intro line plus a four-item list (the plan's own five points; evidence as a closing line), not one paragraph, so `grep -c Workflow docs/mcp-compatibility.md` counts lines >= 3 (it is 5). Content as the plan lists it.
- The `disallowedTools: Workflow` sentence rests on the converter's code path (no `TOOL_MAP` entry -> the `cannot narrow the default tool set -- ignored` warning at `convert.ts:637`), not on a spike run; the plan asks for it so (D-PG8-14).

## Flagged assumptions (from the plan)

- Two plans for PG-WF-05: under option A plan 08-06 does not apply; each of its tasks stops when this SUMMARY records option-a.
- The checkpoint was `blocking-human` with no `auto_select`; it was answered by the orchestrator for the autonomous run, pending the maintainer's review.
- A guard scenario under option A gives the page's claim a proof; the maintainer can strike it and the text stands.
- The README sentence sits in the Agents bullet of the Features list, as neither README named an agent tool grant before.
- The open question of 08-RESEARCH.md item 12 (exclude `workflow`/`workflow_control` for a bridged agent with no `tools` list) is not answered; it is a BACKLOG candidate below.

## Parent lines (for the orchestrator; not edited here)

- PROJECT.md decision row, pending the maintainer's review: D-PG8-11 (as amended, option-a): a `tools` entry `Workflow` or `Workflow(<name>)` of a bridged agent stays dropped. Premise: Claude Code 2.1.323 gives the Workflow tool to no subagent (sub-agents page; the always-denied agent set of the binary; `claude-security`'s main-agent-only note), and Pi has no main-session agent mode; checked against Claude Code 2.1.323, Pi 1.5.0, pi-subagents 0.88.1, and pi-dynamic-workflows 3.15.0. Evidence: `features/agent/frontmatter.feature` "An agent that grants Workflow gets no workflow tool, as Claude Code gives the tool to no subagent"; `docs/mcp-compatibility.md` "Customizing generated agents".
- REQUIREMENTS.md: close PG-WF-05 as not a gap: `- [x] **PG-WF-05**: ... — closed as not a gap (D-PG8-11, option A): Claude Code gives Workflow to no subagent, so a bridged agent keeps dropping the grant; proof: the guard scenario in features/agent/frontmatter.feature and docs/mcp-compatibility.md.` Traceability row: `| PG-WF-05 | Phase 8 | Complete (not a gap, D-PG8-11) |`.
- ROADMAP.md, Phase 8 criterion 5, amend to: `5. For a bridged agent whose source grants \`Workflow\` or \`Workflow(<name>)\`, in a plugin that stages a workflow, \`subagent get\` shows no \`workflow\` tool and no forced launch mode, as Claude Code gives the Workflow tool to no subagent, and docs/mcp-compatibility.md says why (PG-WF-05, closed as not a gap under D-PG8-11 option A).` Plan 08-06: mark skipped (option A).
- BACKLOG candidate: `[parity-gaps] A background pi-subagents child of a bridged agent with no tools list is offered the engine's workflow and workflow_control tools (spike S5, 2026-11-14, pi-subagents 0.88.1, engine 3.15.0), where Claude Code gives a subagent neither; disallowedTools: Workflow does not remove them. Decide whether the converter should write excludeTools: workflow, workflow_control (or map a Workflow deny to them) for such an agent (D-PG8-14, 08-RESEARCH.md item 12). No code changed for it in Phase 8.`
- CHANGELOG: none; nothing a user sees changed (docs and a guard scenario only).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-08-16 is mitigated as planned: `TOOL_MAP` keeps no `Workflow` entry and the guard scenario fails when one is added (red run above). T-08-17 is accepted as planned: the ambient tools are stated in the Agents bullet and carried as the BACKLOG candidate. T-08-SC: no package installed or changed.

## Self-Check: PASSED

- `features/agent/frontmatter.feature` contains "gets no workflow tool"; `docs/mcp-compatibility.md` contains "D-PG8-11", "spike S5", and "workflows-compatibility.md".
- `grep -c Workflow`: docs/mcp-compatibility.md 5, README.md 2, README.es.md 2.
- Commit `a179ee04` is an ancestor of HEAD and lists no path under extensions/ or test/.
