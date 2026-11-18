---
phase: 08-workflow-agents-and-run-paths
plan: "01"
subsystem: workflows
tags: [spike, workflows, pi-subagents, pi-mcp-adapter]
status: complete
requires: []
provides:
  - "08-SPIKE-S5.md: measured rows a1-a6 and b1-b5 and six verdict lines"
  - "The S5 Result cell of section 9 of docs/prd/parity-gaps-prd.md"
affects: ["08-04", "08-05", "08-06"]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md
  modified:
    - docs/prd/parity-gaps-prd.md
decisions:
  - "S5(a) is positive for a blocking call: a real pi-subagents 0.88.1 background child that loads engine 3.15.0 runs a saved plugin workflow with `background: false` and gets its result in the same turn, with and without a `tools` list."
  - "S5(a) default call: the result of a background-mode run never reaches the child's model."
  - "S5(b) is positive: `providerMiddlewareExtensions: [\"pi-mcp-adapter\"]` in `{agent dir}/workflows/settings.json` gives a workflow subagent the adapter's `mcp` tool and the plugin's MCP server."
metrics:
  duration: "about 25 minutes"
  completed: 2026-11-14
estimate:
  tokens: 70000
  tasks: 2
actuals:
  tokens: 4500
  tasks: 2
  commits: 2
plan_head_before: 0920efcb12ec726f61638fc28741adfd3be2dac3
plan_head_after: 507577f3eed9036f380433035283e6d1cba0b666
---

# Phase 8 Plan 01: Spike S5 Summary

Spike S5 measured, in hermetic real-Pi fixtures, that a pi-subagents 0.88.1 background child runs a saved plugin workflow of engine 3.15.0 with `background: false` and gets the result in the same turn. A default-mode call's result never reaches the child's model. pi-mcp-adapter 7.0.1 works in a workflow subagent when the engine's settings list it.

`actuals.tokens` is chars/4 over the realized diff (16,610 bytes of record plus the PRD cell). It does not count the scratch driver, which is not an artifact.

## Run

- Date: 2026-11-14 local (UTC 2026-11-15, 03:44 to 03:50). Linux 7.2.15-200.fc44.x86_64.
- Versions, read from the installed packages: Node v26.13.1, Pi 1.5.0, pi-subagents 0.88.1, engine `@quintinshaw/pi-dynamic-workflows` 3.15.0, pi-mcp-adapter 7.0.1.
- Peers: `node scripts/install-test-peers.mjs` (already current).
- Command, from the worktree root: `env -u PI_CM_TEST_HOME P0801_OUT=SCRATCH/out-<x>.json node --import "$PWD/test/platform/isolated-pi-home.ts" SCRATCH/driver.ts <a|b|c>`. `a` is S5(a), `b` is S5(b) with the engine settings file, and `c` is the S5(b) control with no settings file. Every run exited 0.
- Scratch directory: `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-gaps/46275468-1855-49b4-a234-f937cd40117e/scratchpad/p0801-5aCukq`. It held the driver (a copy of `features/lib/real-subagent-child.ts`) and the run outputs. It was deleted before the second commit. Each fixture (`mkdtemp` under `/tmp`, `pi-cm-features-real-child-*`) was removed by the harness release, and no fixture directory or process stayed after the runs.

## Verdict lines (copied from the record)

- S5(a) blocking call: Passed for both arms. A real pi-subagents 0.88.1 background child that loads engine 3.15.0 was offered `workflow`, ran `demo:scan` with `background: false`, and got `scan: Done.` in the same turn. This was true for an agent with no `tools` list and for an agent whose generated `tools` line lists `read, workflow`. The run's `status.json` was `complete`, and pi-subagents' required-tool check did not refuse the listed agent.
- S5(a) default call: The child got the text `Workflow "scan" started in the background.` and a run ID. Its model ended the turn, so the result never reached it. The run itself completed in the runner, and its record keeps `pendingDelivery` `{"kind":"complete"}`. In one of four default-call children, the engine appended a `workflow-result` message to the child's session file after the child's last answer, and no provider request came after that message.
- S5(a) agent with no tools list: Yes. A background child of an agent with no `tools` list was offered both `workflow` and `workflow_control`, beside this extension's tools, `mcp`, and pi-subagents' own tools. Claude Code gives neither tool to a subagent.
- S5(a) foreground control: Yes. pi-subagents refused the launch with `"async": false` before any model request, with `Agent 'demo:lst-fg' ran as a foreground child, which never loads the parent's ambient extensions, and these child tools were unavailable: workflow.`
- S5(b) adapter setting: Works. With `{"providerMiddlewareExtensions":["pi-mcp-adapter"]}` in `{agent dir}/workflows/settings.json` and the adapter in Pi's `settings.json` `extensions`, a workflow subagent was offered the adapter's `mcp` tool. It called the plugin's stub server through `mcp` (`echo:pg8-proxy`), and after that proxy call it also called `mcp__plugin_demo_stub__echo` directly (`echo:pg8-direct`). The run completed with no extension error, and the main session's plugin tool still worked afterwards.
- S5(b) control: With no engine settings file, a workflow subagent was offered only `read, bash, edit, write, store_put, store_get`. Both calls failed with `Tool mcp not found` and `Tool mcp__plugin_demo_stub__echo not found`, and the stub server got no request.

## Rows

Every row has a measured outcome. No row failed. The rows a1 to a4 and a6 passed, a5 is `recorded`, and b1 to b5 passed. The one negative finding is a5, which the plan does not judge: a default-mode run's result does not reach the child's model. The full rows, with the deciding outputs, are in `08-SPIKE-S5.md`.

## What this means for 08-04 and PG-WF-04

- 08-04 can state the adapter setting as measured to work. The page must give the exact conditions: the file `{agent dir}/workflows/settings.json` (or `~/.pi/workflows/settings.json` with no `PI_CODING_AGENT_DIR`) holds `providerMiddlewareExtensions: ["pi-mcp-adapter"]`, and the adapter is listed in Pi's `settings.json` `extensions`. The plugin tool is declared to the subagent only after an `mcp` call, because this extension writes `directTools: "search"`. Without the setting, a workflow subagent has no MCP tool.
- PG-WF-05 (for the record only, because the orchestrator has chosen option A pending maintainer review): a granted `workflow` would work in a background child only with `background: false`. The default call, which a real model sends, loses the result. Today, an agent with no `tools` list already gets `workflow` and `workflow_control` in a background child as ambient tools. Claude Code gives neither tool to a subagent. That is the backlog candidate below.

## Commits

- `d2bc5418` docs(workflows): record the workflow engine in a background child
- `507577f3` docs(workflows): record pi-mcp-adapter in a workflow subagent

## Deviations from Plan

1. **[Rule 3 - Blocking] The scratch directory is in the session scratchpad.** The orchestrator required probe files under the session scratchpad with the prefix `p0801-`. The plan says `mktemp -d` under the OS temp directory. The scratchpad is under `/tmp` and outside the worktree, so the plan's safety purpose holds. The fixtures still used the harness's `mkdtemp` under `tmpdir()`.
2. **[Rule 2 - Missing functionality] The provider also records tool result texts.** Row b2 needs the subagent's tool result text, and the engine keeps no session file of its subagent. So the scratch provider records the `tool` messages after the last user text. This is a fifth extension of the scratch copy, beyond the four in 08-PATTERNS.md. It is listed in the record's "Fixture" section.
3. **Two runs each of S5(a) and S5(b).** The first S5(a) run recorded only the keys of the engine's run records, and the first S5(b) run recorded no tool result texts. The driver was changed and each run was repeated. The record quotes the second runs and states the first runs' times and outcomes. Row a5 differed between the runs (see the record's note), and the record states this.
4. **`env -u PI_CM_TEST_HOME`** was added before the command, so the `--import` preload always makes a new temporary home. This is a precaution; the variable was not set in the shell.
5. **Agent names.** 08-RESEARCH.md calls the arms `ambient` and `listed`. The fixture names the agents `amb-block`, `amb-default`, `lst-block`, `lst-default`, and `lst-fg`, one per scripted call.

The fallback harness check of execution context (b) was not run, because no probe run failed before a child started.

## Flagged assumptions (from the plan)

- The spike spans the two tasks of this plan.
- The driver is a scratch copy, not a harness change. If option B is chosen later, plan 08-06 builds the "Fixture" section's extensions into the tracked harness.
- A1, A2, and A3 of 08-RESEARCH.md were predictions. This record replaces them. The run confirmed the predictions for a1 to a4 and a6 and for S5(b) b1. For b2, research rated a direct call of the plugin tool as likely refused. The run showed that it is declared and works after one `mcp` proxy call.
- Linux only.
- Markdown under `.planning/` is outside mdformat. The hooks skipped it and passed.

## Parent lines (for the orchestrator)

- PROJECT.md, decision row D-PG8-01: "Spike S5 ran 2026-11-14 (Pi 1.5.0, pi-subagents 0.88.1, engine 3.15.0, pi-mcp-adapter 7.0.1; hermetic fixture, scripted provider). S5(a): a background child runs a saved plugin workflow with `background: false` and gets its result in the same turn, with and without a `tools` list. The default background call's result never reaches the child's model. A foreground launch of an agent that lists `workflow` is refused and names the tool. S5(b): `providerMiddlewareExtensions: [\"pi-mcp-adapter\"]` in `{agent dir}/workflows/settings.json` gives a workflow subagent the adapter's `mcp` tool and the plugin's MCP server; with no settings file it gets no MCP tool. Record: `08-SPIKE-S5.md`."
- BACKLOG candidate: "Should a bridged agent with no `tools` list exclude `workflow` and `workflow_control` (for example through pi-subagents' `excludeTools`)? Evidence: spike S5 row a1 (ambient arm). A background child of such an agent was offered both tools as ambient tools of the workflow engine. Claude Code gives neither to a subagent (08-RESEARCH.md, Amendments item 12)."
- STATE.md note: "Spike S5 ran 2026-11-14. The record is `08-SPIKE-S5.md`, and the PRD S5 cell is filled. S5(a) blocking call passed, the default call loses its result, and S5(b) adapter setting works."

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-08-01: every Pi ran with the harness allowlist environment (fixture `HOME` and `PI_CODING_AGENT_DIR`, `PI_OFFLINE=1`), the driver ran under `--import` of `test/platform/isolated-pi-home.ts`, and the provider was the loopback server with the dummy key. No command read the real `~/.pi/agent`. T-08-02: the harness release removed every fixture, no fixture process stayed, and the scratch directory was deleted. T-08-03: the record has no home directory path and no credential. T-08-SC: no package was installed or changed.

## Self-Check: PASSED

- FOUND: .planning/phases/08-workflow-agents-and-run-paths/08-SPIKE-S5.md
- FOUND: docs/prd/parity-gaps-prd.md (S5 cell starts with `**Run 2026-11-14`)
- FOUND: d2bc5418, 507577f3 (ancestors of HEAD)
- Rows a1-a6 and b1-b5 present; six verdict leads present; zero home directory paths in the record; `git status` clean for extensions, features, test, scripts, package.json, package-lock.json.
