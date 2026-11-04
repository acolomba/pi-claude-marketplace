---
phase: 02-built-in-materialization
plan: "07"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, pi-mcp-adapter, implementation-switch, cucumber, legacy-records]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "plan 02-01: builtinRegistrationStep with the MSEL-03 gate, the legacy reader path, and the tool-search calls step"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "the frozen restart steps, waitForStubListing, PiProcess.recordsSince, the @own-implementation onboarding handling"
provides:
  - "features/mcp-server/implementation-switch.feature: the MREC-02 @mcp scenario, the MSEL-04 and MSEL-02/MSEL-03 @own-implementation scenarios"
  - "dropRecordedMcpServers (features/lib/mcp-builtin-earlier-record.ts)"
  - "Then steps: pi-mcp-adapter / pi's built-in mcp lists the tools of the stub mcp server ... (after a restart); pi reports no extension error"
affects: [02-08, 02-09]

actuals:
  tokens: 4000
  tasks: 3
  commits: 3
plan_head_before: 776a9b3501b978dfe49ac9addfa3837de4fbf623
plan_head_after: d85481cf1deb59a3608dde7fafe8520af22e9049

tech-stack:
  added: []
  patterns:
    - "A post-restart listing wait is a Then that names the implementation, since no Given may follow a When"
    - "One scripted-model table serves every leg of a multi-restart scenario; call numbers continue across restarts"

key-files:
  created:
    - features/lib/mcp-builtin-earlier-record.ts
    - features/step_definitions/mcp-server/implementation-switch.steps.ts
    - features/mcp-server/implementation-switch.feature
  modified: []

key-decisions:
  - "The model-call rows of later legs keep the harness's global call numbers (3-5 for the built-in leg, 6-7 for the last adapter leg), because the frozen calls steps number calls by the harness log, which survives a restart"
  - "The lib checks every level of state.json through one member reader, the root wrapped as the one member of a holder, so it does not clone the private jsonObject guard of the frozen earlier-version-state.ts (fallow dupes)"
  - "No restart's load reports a result in any leg, so no `the session reports these results:` row is needed for the read-time-verdict re-verification"

requirements-completed: [MSEL-02, MSEL-03, MSEL-04, MREC-02]

coverage:
  - id: D1
    description: "A plugin whose record has no mcpServerConfigs or mcpBundle reaches its server under both profiles with no reinstall"
    requirement: MREC-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/implementation-switch.feature#A plugin an earlier release installed reaches its server with no reinstall (MREC-02) (adapter and builtin profiles)"
        status: pass
  - id: D2
    description: "A plugin installed under Pi's built-in MCP is served by pi-mcp-adapter after a restart, and the load reports nothing"
    requirement: MSEL-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/implementation-switch.feature#A plugin installed under pi's built-in mcp runs through pi-mcp-adapter after a restart, with no rewrite at load (MSEL-04)"
        status: pass
      - kind: other
        ref: "grep -c -E 'mcpImplementation|softDeps' on bridges/mcp/{stage,adapter-entry,adapter-doc}.ts prints 0 for each"
        status: pass
  - id: D3
    description: "One installed plugin is served by the adapter, by nothing (no registration, no extension error), by Pi's built-in MCP, and by the adapter again with built-in MCP on, with no plugin command in between"
    requirement: MSEL-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/implementation-switch.feature#A plugin's server moves from pi-mcp-adapter to pi's built-in mcp and back with no plugin command (MSEL-02, MSEL-03, D-MB-01)"
        status: pass
  - id: D4
    description: "Nothing registers with Pi under no implementation or under the adapter while built-in MCP is loaded"
    requirement: MSEL-03
    verification:
      - kind: e2e
        ref: "features/mcp-server/implementation-switch.feature (no-implementation and last adapter legs)"
        status: pass

duration: 1h 10m
completed: 2026-11-04
---

# Phase 2 Plan 07: MCP implementation switch Summary

**A new `implementation-switch.feature` proves, end to end, that one installed plugin's server follows whichever MCP implementation Pi loads after each restart with no plugin command, that an install under Pi's built-in MCP leaves adapter entries the adapter serves later, and that a record from before recorded servers needs no reinstall.**

## Performance

- **Duration:** about 1 h 10 min
- **Completed:** 2026-11-04
- **Tasks:** 3 of 3
- **Files:** 3 created

## Accomplishments

- `features/lib/mcp-builtin-earlier-record.ts` exports `dropRecordedMcpServers(scopeRoot, pluginId)`. It splits the id at its last `@`, removes `mcpServerConfigs` and `mcpBundle` from that one record of the scope's `state.json`, keeps every other member, and writes the file back with two-space indent and a trailing newline. It throws with the file path when the scope records no such plugin. The step re-reads the record and asserts neither member is present.
- `features/step_definitions/mcp-server/implementation-switch.steps.ts` holds the earlier-record Given, the two post-restart listing Thens (one local helper calls `waitForStubListing` with the named implementation), and `pi reports no extension error`, which compares every `extension_error` record since the running Pi started with an empty list, so a failure shows what Pi reported.
- `features/mcp-server/implementation-switch.feature` has no Feature-level tag, one `@mcp` scenario (MREC-02), and two `@own-implementation` scenarios (MSEL-04; MSEL-02/MSEL-03/D-MB-01).
- The switch scenario runs exactly one plugin command, the install, and every restart's load reports nothing.

## Task Commits

1. **Task 1: earlier-release record reaches its server (MREC-02)** - `df4bd9d` (test)
2. **Task 2: built-in install served by the adapter after a restart (MSEL-04)** - `dfb69e7` (test)
3. **Task 3: the four-leg implementation switch (MSEL-02, MSEL-03)** - `d85481c` (test)

## TDD Gate Compliance and red runs

The commit hook refuses a test-only commit, and these tasks add tests only, so each red run was made in the working tree and never committed. Every product file was restored with `git checkout HEAD -- <path>`, and `git status` was clean afterwards.

- **Task 1, builtin profile, seed step file** (`git show 87d3f28:.../builtin-registration-step.ts`): 1 scenario, 1 failed. Failing step: `Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"`, message `the builtin mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`.
- **Task 1, builtin profile, legacy reader replaced by a rejecting reader** (extra, line 159 of `builtin-registration-step.ts`): the same step failed with the same message, so the scenario depends on the legacy reader path and not only on registration existing.
- **Task 2, adapter profile, adapter entry write skipped** (`writeStagedDoc` skipped in `replacePreparedMcp` of `bridges/mcp/stage.ts`, the install path): 2 scenarios, 2 failed. The MSEL-04 scenario failed at `Then pi-mcp-adapter lists the tools of the stub mcp server "stub" of the plugin "demo"` with `the adapter mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`; the MREC-02 scenario failed at its listing Given with the same message. A first attempt that skipped the write in `commitPreparedMcp` stayed green: install does not call that function (update and the AMIG-01 move do).
- **Task 3, adapter profile, MSEL-03 gate removed** (`builtinRegistrationStep`'s `mcpImplementation !== "builtin"` return disabled): the switch scenario failed at `Then pi reports no extension error` with one record: `{ error: 'MCP server "plugin_demo_stub" is registered, but no loaded extension connects MCP servers; another extension may have replaced the built-in MCP support', event: 'register_mcp_server', type: 'extension_error' }`.
- **Task 3, adapter profile, seed step file**: the switch scenario failed at `Then pi's built-in mcp lists the tools of the stub mcp server "stub" of the plugin "demo"` with `the builtin mcp implementation did not finish listing the tools of demo/stub: {...}` (the log held only the first adapter leg's requests).

## Verification

- Adapter profile, `features/mcp-server/implementation-switch.feature`: 3 of 3 scenarios, 58 of 58 steps passed (seeds 841619 and 254972).
- Builtin profile, the same file: 1 of 1 scenario (the `@mcp` one), 12 of 12 steps passed.
- `npm run check:static` passed after each task: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features.
- The commit hook's `npm run check:commit` passed on all three commits.
- Acceptance greps: `@own-implementation` 2, `@mcp` 1, `the user restarts pi` 4, `the session reports no results` 4; the switch scenario's only `claude:plugin` line is the install; the `@mcp` scenario names no `pi-mcp-adapter`; `grep -c -E 'mcpImplementation|softDeps'` prints 0 for `bridges/mcp/{stage,adapter-entry,adapter-doc}.ts`.
- Restart results for the read-time-verdict re-verification: none. Every restart's load in both `@own-implementation` scenarios reported no result.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Model-call numbers of later legs**
- **Found during:** Task 3
- **Issue:** The plan's call tables restart at call 1 in each leg. The frozen calls steps number each call by its place in the harness log, which survives a restart, so the built-in leg's calls are 3 to 5 and the last adapter leg's are 6 and 7.
- **Fix:** The rows carry those numbers.
- **Files modified:** `features/mcp-server/implementation-switch.feature`
- **Commit:** `d85481c`

**2. [Rule 3 - Blocking] The lib's JSON guard**
- **Found during:** Task 1 (`npm run check:static`, fallow dupes)
- **Issue:** A local `jsonObject` guard shaped like the one in the frozen `earlier-version-state.ts` (as the plan suggested) is a six-line clone group, and fallow fails on every clone group.
- **Fix:** One `objectMember(holder, member, what)` reader checks every level; the parsed root is the one member of a holder. No suppression marker.
- **Commit:** `df4bd9d`

**3. [Rule 2 - Missing] An extra, more specific red run for MREC-02**
- The seed-step red run shows only that the seed registers nothing. A run with the legacy reader replaced by a rejecting one shows that the scenario depends on the legacy path. Not committed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-27 (empty registry in the last adapter leg), T-02-28 (empty registry, no plugin tool, and no extension error in the no-implementation leg, with a red run without the gate), T-02-29 (the harness's restart step turns built-in MCP on, as the user would), and T-02-30 (the lib writes only under `this.scopeRoot(scope)` in the sandbox and re-reads the record) are covered.

## Parent lines

None. No frozen or parent-owned file needed a change.

## Dubious Choices

**DC-A: The adapter listing wait after a restart is weak in the last adapter leg**
- **Choice:** `pi-mcp-adapter lists the tools ...` calls the frozen `waitForStubListing("adapter", ...)`, which is done once the stub log holds a tools/list for the server and no stub runs.
- **Alternatives:** A wait that reads only the log lines written after the restart, which needs a frozen lib change (`waitForStubListing` has no start offset).
- **Why dubious:** In the switch scenario's last leg the log already holds tools/list lines from earlier legs, so the wait can return before the new adapter connects. The leg still proves the adapter serves the plugin through the model's call (`mcp returned: echo:ping`) and the empty registry. In the MSEL-04 scenario the log is empty before the restart, so the wait is real there.
- **Severity:** Low.

**DC-B: Header-only tables state an empty registry and an empty tool list**
- **Choice:** `pi lists these registered mcp servers:` with only `| name |`, and `pi offers these plugin mcp tools:` with only `| tool | active |`, as `listing.feature` and `implementation-profiles.feature` already do and as the plan asks.
- **Alternatives:** Dedicated "lists no ..." steps, which would go in frozen shared step modules.
- **Why dubious:** features.md says a result with no rows has its own step, because a header-only table cannot be compared. The frozen steps do compare the header row, so the check is real.
- **Severity:** Low.

**DC-C: Global call numbers in later legs**
- **Choice:** The tables show calls 3 to 5 and 6 to 7, as the frozen calls steps number them.
- **Alternatives:** None without a frozen step change.
- **Why dubious:** A reader may expect each restarted session's calls to start at 1.
- **Severity:** Low.

**DC-D: The earlier-record rewrite removes only `mcpServerConfigs` and `mcpBundle`**
- **Choice:** The two members the plan names; `compatibilityBasis` (also additive, MREC-01) is left as it is.
- **Alternatives:** Also remove `compatibilityBasis`.
- **Why dubious:** An earlier release wrote no `compatibilityBasis` either. For this stdio stub plugin install writes none, so the record matches an earlier release's shape anyway; a bundle plugin would not.
- **Severity:** Low.

**DC-E: The root of `state.json` is checked as the one member of a holder**
- **Choice:** `objectMember({ root: parsed }, "root", stateFile)`, so one reader checks every level without cloning the frozen file's private guard.
- **Alternatives:** Export a guard from `field-rows.ts` (a foundation-owned lib), or a fallow marker.
- **Why dubious:** It reads a little indirect for the sake of the clone detector.
- **Severity:** Low.

**DC-F: Commit attribution line**
- **Choice:** The commits end with the `Claude-Session` URL the orchestrator gave (`session_01EDUMG7S9uXh4o5dikBwum8`), which the branch's earlier commits also carry. The runtime's reminder named a different session URL.
- **Alternatives:** The runtime's URL.
- **Why dubious:** The two sources disagree; the orchestrator's instruction said "exactly".
- **Severity:** Low.

## Self-Check: PASSED

- `features/lib/mcp-builtin-earlier-record.ts`, `features/step_definitions/mcp-server/implementation-switch.steps.ts`, and `features/mcp-server/implementation-switch.feature` exist.
- Commits `df4bd9d`, `dfb69e7`, and `d85481c` are ancestors of HEAD.
