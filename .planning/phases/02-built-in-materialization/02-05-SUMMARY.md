---
phase: 02-built-in-materialization
plan: "05"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, project-trust, cucumber]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "the built-in registration step with its per-call trust gate and per-name project precedence (02-01), the tool-search calls step (02-01), the env-echo stub step (configuration.steps.ts)"
provides:
  - "features/mcp-server/project-scope.feature lifted: four @adapter-only scenarios and two @builtin-only twins"
  - "features/mcp-server/builtin-trust.feature: a plugin installed in both scopes under trust and distrust"
affects: [02-04, 02-09]

actuals:
  tokens: 3700
  tasks: 2
  commits: 2
plan_head_before: b6c3aa592d1903634b05e11f87dff512383daffc
plan_head_after: 92ee52cea397fc4fecdf91b53b3d88726416e16b

tech-stack:
  added: []
  patterns:
    - "Gate-removed red runs: force the gate open in the working tree, run, record, restore"

key-files:
  created:
    - features/mcp-server/builtin-trust.feature
  modified:
    - features/mcp-server/project-scope.feature

key-decisions:
  - "The two misaligned adapter table rows of the first adapter scenario keep their original spacing, so every step and row of the adapter scenarios stays byte-identical"
  - "The trusted both-scope scenario lists the registered servers before the prompt, so it shows one plugin_demo_stub registration and then the project data directory in the call result"

requirements-completed: [BLT-03]

duration: 50m
completed: 2026-11-04
---

# Phase 2 Plan 05: Built-in MCP project trust Summary

**Under Pi's built-in MCP, a project-scope plugin server registers and answers only while Pi trusts the project, with no approval step, and a plugin installed in both scopes resolves to the project record only while trusted. `project-scope.feature` is lifted into adapter scenarios and built-in twins, and `builtin-trust.feature` adds the two-scope cases.**

## Performance

- **Duration:** about 50 min
- **Completed:** 2026-11-04
- **Tasks:** 2 of 2
- **Files:** 2 (1 created, 1 modified). No production, step, lib, or support file changed.

## Accomplishments

- `features/mcp-server/project-scope.feature` has no file-level tag. Its four pi-mcp-adapter scenarios carry `@adapter-only` each, with every step and table row unchanged (the plan's `comm -23` check prints nothing). The description names D-CF6-03 for the adapter, BLT-03 and D-MB-09 for the built-in MCP, and says that `builtin-status.feature` shows an untrusted server's info.
- `@builtin-only` twin "A trusted project's plugin server answers a scripted call with no approval or allow setting (BLT-03, D-MB-09)". It has no allow step. It searches, then calls, and checks the whole stub log: `initialize` with `{"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}}`, `notifications/initialized`, `tools/list`, and `tools/call` with `{"name":"echo","arguments":{"text":"ping"},"_meta":{"progressToken":3}}`. The model gets `mcp__plugin_demo_stub__echo returned: echo:ping`. The progress token was 3 in every run (5 runs).
- `@builtin-only` twin "An untrusted project registers no project-scope plugin server while a user-scope one connects (BLT-03, D-MB-09)". `demo` is installed in the project scope and `other` in the user scope. Pi's registry lists only `plugin_other_stub`, and Pi offers only `mcp__plugin_other_stub__echo | no`.
- `features/mcp-server/builtin-trust.feature` (`@builtin-only`) installs `demo` in both scopes with a stub that echoes `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`:
  - Untrusted (BLT-03, P2-DC-07): the call result is `{home}/marketplaces/fixtures/plugins/demo,{agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping`.
  - Trusted (BLT-03, P2-DC-14): Pi lists the one row `plugin_demo_stub`, and the call result is `{home}/marketplaces/fixtures/plugins/demo,{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo:echo:ping`.
- No scenario uses the Phase 1 stand-in step, puts `-builtin:mcp` into Pi settings, or reads a file the bridge wrote.

## Task Commits

1. **Task 1: a trusted project's server answers under Pi's built-in MCP** - `f99fc78` (test)
2. **Task 2: untrusted projects register no project MCP server, and the two-scope cases** - `92ee52c` (test)

## Red runs

Each run used the builtin profile. Every changed product file was restored with `git checkout HEAD -- extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts`, and `git status --porcelain extensions/` printed nothing before each commit.

**Against the seed step file (`87d3f28`):**

1. Trusted twin, `project-scope.feature:46` (Task 1 run): fails at `Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"` with `AssertionError: the builtin mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`. The Task 2 seed run repeated this at line 45.
2. Untrusted twin, `project-scope.feature:146`: fails at the listing wait for `other` with `the builtin mcp implementation did not finish listing the tools of other/stub: {"requests":[],"running":[]}`.
3. Untrusted both-scope, `builtin-trust.feature:8`: fails at the listing wait for `demo` with `... demo/stub: {"requests":[],"running":[]}`.
4. Trusted both-scope, `builtin-trust.feature:39`: fails at the listing wait for `demo` with the same message.

Result: 4 scenarios, 4 failed.

**Trust check forced to `true` (`ctx.isProjectTrusted()` replaced by `true`; T-02-21, T-02-22):**

5. Untrusted twin, `project-scope.feature:146`: fails at `Then pi lists these registered mcp servers:`. Actual rows are `plugin_other_stub` and `plugin_demo_stub`, and the expected row is `plugin_other_stub` only. So Pi itself does not keep the untrusted project's server out. The gate does.
6. Untrusted both-scope, `builtin-trust.feature:8`: fails at `Then the model receives these calls, with each tool search reduced to the tools it loads:`. The actual result is `mcp__plugin_demo_stub__echo returned: {home}/marketplaces/fixtures/plugins/demo,{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo:echo:ping`, and the expected `{agent dir}` path is missing.

**Per-name project precedence reversed (`new Map(perScope.flat())` replaced by `new Map([...perScope].reverse().flat())`, so the user entry wins; P2-DC-14):**

7. Trusted both-scope, `builtin-trust.feature:39`: fails at the model calls step. The actual result is `mcp__plugin_demo_stub__echo returned: {home}/marketplaces/fixtures/plugins/demo,{agent dir}/pi-claude-marketplace/data/fixtures/demo:echo:ping`, and the expected `{project dir}/.pi/...` path is missing. The registered-server step before it passed with one row, so the duplicate check alone would not catch a reversed precedence. The data directory does.

## Verification

- `npm run check:features` passes. `npm run check:static` passes after each task (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- Builtin profile, `project-scope.feature` and `builtin-trust.feature`: 4 of 4 scenarios passed, 62 steps (seed 944740, and seed 96519 after the last description edit).
- Adapter profile, the same two files: 4 of 4 scenarios passed, 54 steps (seed 401768). These are the four adapter scenarios; `builtin-trust.feature` is excluded there.
- Acceptance greps: `head -1` of project-scope.feature is `Feature: MCP server project scope`; scenario-level `@adapter-only` count is 4; `@builtin-only` count is 2; `plugin_other_stub` count is 2; `pi-claude-marketplace/data/fixtures/demo` count in builtin-trust.feature is 2 (one `{agent dir}`, one `{project dir}`); `a stand-in registers` count is 0 in both files.
- The commit hook ran `npm run check:commit` on the Task 1 commit and passed.

## Deviations from Plan

### Auto-fixed Issues

None in product code. Two small notes on the plan text:

**1. The original adapter table keeps its spacing**
- **Found during:** Task 1
- **Issue:** The `the scripted model plays these steps:` table of the first adapter scenario has a header row and a `Done.` row one column wider than its middle row. Re-aligning it would change two lines that the plan's `comm -23` check needs to keep.
- **Fix:** Those two lines keep their original spacing. Every new table is aligned.

**2. The builtin-trust description has three lines**
- The plan asked for two description lines. The IDs and the stand-ins fit in three lines of about 100 columns, which `.agents/skills/cucumber/rules/features.md` allows (two or three lines).

## Parent lines

- `features/mcp-server/project-scope.feature` description points to `builtin-status.feature` for the untrusted info row. That file belongs to plan 02-04 and was not on this branch when this plan ran. If 02-04 names the file differently, update the description.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-21 and T-02-22 are each proven by a passing scenario and by a red run with the trust check forced to `true` (runs 5 and 6). T-02-23 is accepted: the echoed paths are sandbox paths projected to run tokens.

## Dubious Choices

**DC-A: The trusted both-scope scenario has two `When` steps**
- **Choice:** `When the user lists the mcp tools pi offers`, `Then pi lists these registered mcp servers:`, then `When the user prompts "call the stub"` and the calls step.
- **Alternatives:** Split it into two scenarios: one for the single registration and one for the data directory.
- **Why dubious:** The cucumber rules say a second `When` usually hides a second behavior. Here both checks prove one behavior (the project entry replaces the user entry under one name), and the plan asks for both in one scenario. `implementation-switch.feature` uses the same pattern.
- **Severity:** Low.

**DC-B: The progress token `3` is stated as a literal**
- **Choice:** The built-in `tools/call` row states `"_meta":{"progressToken":3}` as Pi 1.5.0 sends it.
- **Alternatives:** A run token for the progress token, which needs a new step projection (out of scope: no step may change).
- **Why dubious:** The number comes from Pi's client request counter. A Pi release that sends one more request before the call would change it, and the scenario would fail on a value that is not the behavior under test. It was stable over five runs.
- **Severity:** Low.

**DC-C: The untrusted project twin checks the registry, not the stub log**
- **Choice:** The twin states Pi's registered servers and its plugin tools, as the plan says. It does not add `no stub mcp server receives a message`, because the user-scope stub does receive messages.
- **Alternatives:** A step that checks that the stub of `demo` received nothing (no such step exists).
- **Why dubious:** A wrong implementation that started the project server without registering it would pass. The registration step registers before Pi connects, so that wrong implementation is unlikely.
- **Severity:** Low.

## Self-Check: PASSED

- `features/mcp-server/project-scope.feature` and `features/mcp-server/builtin-trust.feature` exist.
- Commits `f99fc78` and `92ee52c` are ancestors of HEAD.
