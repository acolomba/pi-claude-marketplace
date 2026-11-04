---
phase: 04-agent-grants
plan: "02"
subsystem: reconcile
tags: [pi-subagents, background-child, autoapply, load-reconcile, cucumber]
status: complete

requires: []
provides:
  - "platform/subagent-child.ts: SubagentChildEnv, isSubagentChild(env) (PI_SUBAGENT_CHILD === \"1\")"
  - "createLoadReconcile(reader, applyReconcile, env = process.env) with the MGRT-02 child gate"
  - "features/mcp-server/agent-grants.feature: per-scenario @adapter-only on the D-CF6-10 scenarios, plus the background-child autoapply scenario"
  - "step: pi runs with the scripted model and pi-subagents as a pi-subagents background child"
affects: [04-04-agent-grants-step, 04-05-builtin-scenarios, 04-06-docs]

actuals:
  tokens: 3900
  tasks: 2
  commits: 2
plan_head_before: 1b695f261776e3d6b49676641a48827fdafa933f
plan_head_after: 2054b1b

tech-stack:
  added: []
  patterns:
    - "Event-time read of an injected env (default process.env, never copied) so a marker set after the factory still counts"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/subagent-child.ts
    - test/platform/subagent-child.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
    - test/orchestrators/reconcile/load.test.ts
    - features/mcp-server/agent-grants.feature
    - features/step_definitions/mcp-server/agent-grants.steps.ts

key-decisions:
  - "A child load runs readOnlyPass(reader, SCOPES, { ...opts, migrateMcpEntries: NO_MCP_MOVE }) and never calls autoapplyScopes; the per-scope loop and closing notifications moved into readOnlyPass, shared with the non-child path"
  - "The MIG-01 config migration and loadState's legacy migration stay ungated in a child (idempotent; the parent's load runs them first, P4-DC-08)"

patterns-established:
  - "A profile Pi plays a pi-subagents background child through the launch-environment stand-in setting PI_SUBAGENT_CHILD=1"

requirements-completed: [MGRT-02]

duration: ~40 min
completed: 2026-11-04
---

# Phase 4 Plan 02: Background-child load gate Summary

When a load runs in a pi-subagents background child (`PI_SUBAGENT_CHILD === "1"`, read when the load runs from the live `process.env`), it runs only the read-only pass for both scopes. It runs no autoapply apply step and its AMIG-01 MCP move does nothing. A cucumber scenario shows that a child Pi with autoapply on installs nothing.

## What was built

- **`platform/subagent-child.ts`** (new, imports nothing): `SubagentChildEnv` and `isSubagentChild(env)`. The variable name appears once, in a module constant whose comment cites pi-subagents 0.84.0 `src/runs/shared/child-runtime-config.js:6` and `src/runs/background/subagent-runner.js:89` (both checked against the peer cache copy).
- **`orchestrators/reconcile/load.ts`** (unowned, MGRT-02 gate only, P4-DC-08): `createLoadReconcile` takes a third parameter, `env: SubagentChildEnv = process.env`. The frozen `index.ts` call `createLoadReconcile({ loadState }, applyReconcile)` is unchanged (`git diff --stat` of `index.ts` against the phase base is empty). The returned `loadReconcile` checks `isSubagentChild(env)` each time it runs. A child load runs the new `readOnlyPass` helper over both scopes with the module constant `NO_MCP_MOVE`. A non-child load runs the old path, which now ends in the same helper. The header comment records the MGRT-02 / D-MB-12 rule, the migrations that stay ungated, and that the child still prints pending's block (P4-DC-21).
- **Unit cases**: `subagent-child.test.ts` has one case for `"1"` and one data-driven case each for an absent variable, `""`, `"0"`, `"true"`, `" 1"`, and `"1 "`. `load.test.ts` gains five MGRT-02 cases. (1) In a child with autoapply on, no apply step runs, pending's block is printed, and no file changes. (2) In a child, the injected MCP move is never called. (3) Outside a child (`{}`), the move runs for `project` and `user`. (4) A marker set after `createLoadReconcile` makes the next load a child load. (5) `"0"` still runs the apply step. `recordingLoad` gained an optional `env` parameter. Every case that existed before passes unchanged.
- **Feature retag**: the feature-level `@adapter-only` is gone. Each of the three D-CF6-10 scenarios now carries its own `@adapter-only`. The description now says that those three pin pi-mcp-adapter's grant form, and that a pi-subagents background child, modeled by the marker its runner sets, changes no installation state (MGRT-02).
- **Step**: `pi runs with the scripted model and pi-subagents as a pi-subagents background child`, with a timeout of `PROFILE_PI_START_TIMEOUT_MS`. It writes `{ PI_SUBAGENT_CHILD: "1" }` through `writeLaunchEnvironment` and removes the file in `onRelease`. It starts the profile Pi with `companions: ["pi-subagents"]` plus `PI_LAUNCH_ENVIRONMENT_EXTENSION`, then asserts that the applied launch environments are exactly `[{ PI_SUBAGENT_CHILD: "1" }]`. The `@fileoverview` now describes the step.
- **Scenario** (untagged, not an MCP scenario): "A pi-subagents background child with autoapply on installs nothing (MGRT-02)".

## Verification

- `npm run typecheck`, then `node --test` on both owner suites: 35/35 pass.
- Direct coverage at 100%: `subagent-child.ts` (branches 2/2, functions 1/1, lines 30/30) and `load.ts` (branches 30/30, functions 8/8, lines 246/246).
- `npm run check:static` exits 0 after each task (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- Commit hook `npm run check:commit`: Passed on both commits.
- Acceptance greps: `PI_SUBAGENT_CHILD` occurs 1 time in subagent-child.ts. `isSubagentChild` occurs 3 times in load.ts. The frozen call in index.ts occurs 1 time. The feature file's first line is `Feature: MCP server agent grants`. `@adapter-only` occurs 3 times and `Scenario:` 4 times.

### RED proofs

**Unit (Task 1)**: these cases ran against the unchanged `load.ts` (Node strips the types, so the extra argument was ignored):

```
✖ MGRT-02 / D-MB-12: in a pi-subagents background child, autoapply runs no apply step and the load prints pending's block
✖ MGRT-02 / AMIG-01: in a pi-subagents background child, the load runs no MCP move
✖ MGRT-02 / NFR-2: a child marker set after the load step was created makes the next load a child load
ℹ tests 35  ℹ pass 32  ℹ fail 3
```

The `"0"` case and the outside-a-child case passed on the old code, as they should: both pin behavior that must not change.

**Cucumber (Task 2), adapter profile, pre-phase load** (`git checkout f5069e0 -- .../reconcile/load.ts`, `--name "background child"`):

```
Failed scenarios:
  1) A pi-subagents background child with autoapply on installs nothing (MGRT-02) # features/mcp-server/agent-grants.feature:125
       Then the session reports these results: # features/step_definitions/session.steps.ts:172
           AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
           + actual - expected
             [
           +   []
           -   [ 'kind', 'severity', ... ], [ 'cascade', 'info', 'false', 'true', 'Reconcile pending', '0', '0', '1' ], ...
1 scenario (1 failed)
12 steps (9 passed, 2 skipped, 1 failed)
```

The session reported nothing because the child Pi's startup load, during the Given, had already run autoapply and installed `demo`. The next session found the config and the records in agreement. `load.ts` was then restored with `git checkout HEAD -- ...`, and `git status --porcelain` listed no product file.

**Cucumber green, adapter profile** (whole file): `4 scenarios (4 passed)`, `52 steps (52 passed)`.

**Builtin profile** (whole file): `0 scenarios`, `0 steps`, as the plan expects. The three D-CF6-10 scenarios are `@adapter-only`, and the untagged child scenario runs under the adapter profile only.

`npm run check:features` exits 0.

## Task Commits

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Read pi-subagents' child marker and keep a child's load read-only | 335269a |
| 2 | Prove that a background child with autoapply on installs nothing | 2054b1b |

## Deviations from Plan

None. The plan executed as written. One small test-side refactor: to keep the two MCP-move cases free of duplicated setup (fallow `dupes`, and a padding lint error), they share two helpers, `createHelloScope(t, label, autoapply)` and `recordingMove()`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-04-03 (a child's apply step and MCP move) and T-04-04 (a marker read when the factory runs) are mitigated as planned. Unit cases 1-4 and the cucumber scenario cover them.

## Parent lines

None. No frozen file changed. `index.ts` is unchanged.

## Dubious Choices

### 1. Commit trailer session URL taken from the child brief

- **Severity:** Low
- **Choice:** both commits end with `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`, as the child brief and the executor instructions require ("trailer lines exactly as in the child brief").
- **Alternatives:** the harness attribution reminder for this agent gives a different session URL (`session_01EDUMG87PKcySw33ikhvFmE`).
- **Why dubious:** the two sources disagree. The commits follow the task instructions, not the harness default.
- **Recorded in:** this SUMMARY.

### 2. The red run fails at the session report, not at "no installed plugins"

- **Severity:** Low
- **Choice:** the scenario states the whole session report: two pending blocks with `will install` rows. On the pre-phase load it fails at that step, with an empty report. The cause is that the profile Pi's startup load already applied autoapply during the Given, so the later step "the project scope has no installed plugins" was skipped, not run.
- **Alternatives:** add a step that checks the installation record right after the child Pi starts, so the red run would fail on an installed plugin directly.
- **Why dubious:** a reader of the red output must infer the install from the empty report. The scenario still fails without the gate and passes with it.
- **Recorded in:** this SUMMARY (RED proofs).

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/platform/subagent-child.ts
- FOUND: test/platform/subagent-child.test.ts
- FOUND: 335269a (ancestor of HEAD)
- FOUND: 2054b1b (ancestor of HEAD)
