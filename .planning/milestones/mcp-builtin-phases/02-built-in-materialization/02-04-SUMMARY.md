---
phase: 02-built-in-materialization
plan: "04"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, info, status, mcp-json, cucumber, tui]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "plan 02-01: the built-in registration step and sync, which register plugin servers under plugin_<plugin>_<server>"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "the frozen McpStatusReader and McpStatusLookup, the frozen synchronous withMcpServerStatus call in info.ts, profileFor(\"builtin\"), the McpServerStatus tokens overridden by mcp.json and project not trusted"
provides:
  - "createBuiltinMcpStatusReader filled: unlisted, connected, disabled, not-connected, read from Pi at lookup time"
  - "readMcpJsonServerNamespaces (bridge barrel): the synchronous read of the server names Pi's mcp.json files configure"
  - "the built-in arm of withMcpServerStatus, with the stamp order project not trusted, overridden by mcp.json, overridden by project scope, then the reader"
  - "features/mcp-server/builtin-status.feature and its step module, the terminal /mcp manager step included"
affects: [02-08, 02-09, "Phase 3 read-time verdicts (companion-missing.feature, info.test.ts)"]

actuals:
  tokens: 14650
  tasks: 3
  commits: 3
plan_head_before: 776a9b3501b978dfe49ac9addfa3837de4fbf623
plan_head_after: 87a9b77f286ad41b5a1219cfbc8a75a736ba871e

tech-stack:
  added: []
  patterns:
    - "Status inferred per lookup from Pi's registry and tool list, with `in` narrowing over Pi's undeclared tool fields"
    - "One stamp walk with a per-implementation status function"
    - "The extension's only synchronous file read, for a frozen synchronous caller, with every error read as no override"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts
    - test/bridges/mcp/builtin-overrides.test.ts
    - features/mcp-server/builtin-status.feature
    - features/step_definitions/mcp-server/builtin-status.steps.ts
  modified:
    - extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
    - extensions/pi-claude-marketplace/bridges/mcp/index.ts
    - test/platform/mcp-builtin-status.test.ts
    - test/orchestrators/plugin/info-mcp-status.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/bridges/mcp/index.test.ts

key-decisions:
  - "Under builtin, a project row of an untrusted project reads project not trusted without reading any mcp.json file"
  - "The project-scope override under builtin applies only while the project is trusted, and reads the project record's mcpServerConfigs names with resources.mcpServers as the legacy fallback"
  - "The disabled scenario waits for the stub's tools/list log before it opens Pi's /mcp manager, and creates the harness directory the stub logs into"

patterns-established:
  - "Built-in info status: name each recorded server with profileFor(\"builtin\").serverName, compare mcp.json names after foldedMcpServerKey"

requirements-completed: [BLT-05, BLT-04]

coverage:
  - id: D1
    description: "Under builtin, info shows connected, not connected, not loaded, overridden by mcp.json, project not trusted, overridden by project scope, and disabled"
    requirement: BLT-05
    verification:
      - kind: e2e
        ref: "features/mcp-server/builtin-status.feature (builtin profile, 7 scenarios)"
        status: pass
      - kind: unit
        ref: "test/platform/mcp-builtin-status.test.ts, test/orchestrators/plugin/info-mcp-status.test.ts"
        status: pass
  - id: D2
    description: "An mcp.json override and a refused registration are reported in info"
    requirement: BLT-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/builtin-status.feature#Plugin info shows a plugin server that the user's mcp.json overrides as overridden by mcp.json (BLT-04, BLT-05); #Plugin info shows a server Pi refused to register as not loaded (BLT-04, P2-DC-08)"
        status: pass
      - kind: unit
        ref: "test/bridges/mcp/builtin-overrides.test.ts"
        status: pass
  - id: D3
    description: "Under adapter and none, info output is unchanged"
    requirement: BLT-05
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/info-mcp-status.test.ts (every adapter and none case unchanged), test/orchestrators/plugin/info.test.ts"
        status: pass

duration: 1h 50m
completed: 2026-11-04
---

# Phase 2 Plan 04: Built-in MCP status in info Summary

**`/claude:plugin info` now shows each plugin MCP server's state under Pi's built-in MCP: the reader infers it from Pi's registry and tool list at lookup time, a synchronous read of Pi's `mcp.json` names reports overrides, and the stamp runs project trust, `mcp.json` override, and project override before the reader, proven by seven builtin-only scenarios, one of them through Pi's terminal `/mcp` manager.**

## Performance

- **Duration:** about 1 h 50 min
- **Completed:** 2026-11-04
- **Tasks:** 3 of 3
- **Files:** 11 changed (4 created, 7 modified)

## Accomplishments

- `platform/mcp-builtin-status.ts`: every read happens inside `lookup`. A name `getMcpServers()` lacks answers `unlisted`, even with hidden tools of an earlier registration (Pitfall 10). Otherwise the tools whose `namespace.name` is `mcp__` plus the name with `-` folded decide: one not hidden is `connected`, all hidden is `disabled`, none is `not-connected`. `namespace` and `exposure` are read through `in` narrowing. The header records the P2-DC-46 gap.
- `bridges/mcp/builtin-overrides.ts`: `readMcpJsonServerNamespaces(files)` follows Pi's `readConfigFile` checks (BOM strip, plain JSON, object top level, object `mcpServers`), counts an object entry with a string `command` or `url`, folds `-` to `_`, and merges the files. Any read or parse error adds nothing. It is the only `readFileSync` in the extension.
- `orchestrators/plugin/info-mcp-status.ts`: `stampEntries` now takes a status function. The adapter and none arm keeps its key, its server list, and its project override rule. The built-in arm stamps the record's `mcpServerConfigs` names (legacy fallback `resources.mcpServers`), named by `profileFor("builtin").serverName`, in this order: `project not trusted` for a project row while untrusted; `overridden by mcp.json` from the user file and, only while trusted, the project file; `overridden by project scope` for a user row the enabled, trusted project record lists; then the reader's token.
- `features/mcp-server/builtin-status.feature` (`@builtin-only`): seven scenarios, each comparing the full info fields or the info line.
- `features/step_definitions/mcp-server/builtin-status.steps.ts`: the user `mcp.json` Given, the terminal When that disables the server in Pi's `/mcp` manager and runs info, and the Then that compares the terminal's set of `mcp: plugin:...` lines.

## Task Commits

1. **Task 1: info shows a built-in server as connected** - `30a2e89` (feat)
2. **Task 2: overrides, refusals, trust, and the unconnected state** - `dc0258e` (feat)
3. **Task 3: the disabled status through Pi's terminal /mcp manager** - `87a9b77` (test)

## TDD Gate Compliance and red runs

The commit hook refuses a test-only commit, so each task committed its tests and code together. The red runs (P1-DC-28):

- **Task 1, unit:** `node --test test/platform/mcp-builtin-status.test.ts test/orchestrators/plugin/info-mcp-status.test.ts` with `platform/mcp-builtin-status.ts` and `orchestrators/plugin/info-mcp-status.ts` at `87d3f28`: 58 tests, 45 pass, 13 fail. The failures are the 11 reader cases (every one but the build-reads-nothing case), `D-MB-13 / MSEL-01: under builtin the lookup's reader is asked for the recorded server's registered built-in name`, and `BLT-05: under builtin every server the record's mcpServerConfigs names is stamped, the ones the adapter blocks included`.
- **Task 1, builtin profile:** `features/mcp-server/builtin-status.feature` with the same two files at `87d3f28`: 1 scenario, 1 failed, 10 of 11 steps passed. The only difference was the cell `[{"name":"plugin:demo:stub","status":"status unknown"}]` where `connected` was expected.
- **Task 2, unit:** `test/orchestrators/plugin/info-mcp-status.test.ts` against the Task 1 module (`30a2e89`): 59 tests, 53 pass, 6 fail: the user `mcp.json` override, the trusted project `mcp.json` override, `project not trusted`, the project-scope override, its legacy-record variant, and the `mcp.json`-before-project order. `test/bridges/mcp/builtin-overrides.test.ts` cannot run before its module exists.
- **Task 2, builtin profile:** the six scenarios of that point with both product files at `87d3f28`: 6 scenarios, 6 failed, 60 of 66 steps passed. Each failed only on its status cell, which read `status unknown` (the refused one: `[{"name":"plugin:demo:remote","unsetVariables":["PI_CM_UNSET_PORT"],"status":"status unknown"}]`).
- **Task 3, builtin profile:** the disabled scenario with `platform/mcp-builtin-status.ts` at `87d3f28`: 1 scenario failed, 8 of 9 steps passed; the terminal showed `mcp: plugin:demo:stub (status unknown)` where `mcp: plugin:demo:stub (disabled)` was expected.

The reverted product files were never committed.

## Verification

- Direct coverage at 100% for `platform/mcp-builtin-status.ts`, `orchestrators/plugin/info-mcp-status.ts`, `orchestrators/plugin/info.ts` (Task 1), and `bridges/mcp/builtin-overrides.ts`, `bridges/mcp/index.ts`, `orchestrators/plugin/info-mcp-status.ts`, `orchestrators/plugin/info.ts` (Task 2): `npm run test:coverage:direct` exited 0 both times. `info.test.ts` passes with its one fixture change.
- `test/architecture/no-factory-time-probe.test.ts` passes.
- `npm run check:static` passes after each task: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features.
- Cucumber, builtin profile, `features/mcp-server/builtin-status.feature`: 7 of 7 passed in two consecutive full runs (`--parallel 2`).
- `features/mcp-server/companion-missing.feature`, builtin profile: 4 scenarios, 3 passed, 1 failed, the expected sibling failure. `Plugin info names pi-mcp-adapter as a missing companion` (line 61) reads `[{"name":"plugin:demo:stub","status":"not loaded"}]` where line 76 pins `"status":"status unknown"`. The plugin was installed after the shared Pi's session started, so it is not registered in that session, and `not loaded` is the correct built-in reading. See Parent lines.
- Wider runs: the builtin profile on all of `features`, 49 scenarios, 48 passed, 1 failed (seed 173880). The one failure is the expected `companion-missing.feature` scenario above; no other scenario changed. The adapter profile on `features/mcp-server`, 66 of 66 passed (seed 44867), so the adapter info output is unchanged.
- Acceptance greps: `git diff 87d3f28 --stat -- test/orchestrators/plugin/info.test.ts` shows 1 file, 2 lines (1+, 1-); `"status":"connected"` appears in the feature; the five Task 2 tokens appear 10 times; `readFileSync` appears only in `builtin-overrides.ts`; `(disabled)` appears once; `Disable`, `Reconnect`, and `Exposure` appear 0 times.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The feature title is `MCP server builtin status`**
- **Found during:** Task 1 (`npm run check:features`)
- **Issue:** The layout rule requires the title to be `<function> <capability>` of the file name, so a free title failed the gate.
- **Fix:** `Feature: MCP server builtin status`, with a two-line description naming BLT-05, BLT-04, D-MB-09, and P2-DC-16.
- **Commit:** `30a2e89`, `dc0258e`

**2. [Rule 3 - Blocking] The reader's build-reads-nothing case records calls instead of verifying a strict mock**
- **Found during:** Task 1 (lint, `sonarjs/assertions-in-tests`)
- **Issue:** A case whose only check is strong-mock's `verify()` has no assertion Sonar counts.
- **Fix:** A hand-built Pi double records each read, and the case asserts the record is empty.
- **Commit:** `30a2e89`

**3. [Rule 2 - Missing] Built-in unit cases run in a case-owned Pi environment**
- **Found during:** Task 2
- **Issue:** The built-in arm reads `<agentDir>/mcp.json` and the project's `.pi/mcp.json`; without isolation the cases would read the developer's own files.
- **Fix:** Every built-in case uses `createHermeticEnvironment(t, ...)` and passes its `cwd`. The adapter and none cases read no file and are unchanged.
- **Commit:** `dc0258e`

**4. [Rule 3 - Blocking] The terminal step waits for the stub's tool listing and creates the stub's log directory**
- **Found during:** Task 3
- **Issue:** The stub writes its pid file into `<home>/harness`, which only a profile Pi creates, so without it the stub exits and the server never connects. Disabling a server before it connected would leave it with no tools, so info would read `not connected`, not `disabled`.
- **Fix:** The When creates the harness directory before it starts the terminal Pi, and waits until the stub logged `tools/list` for the server before it opens `/mcp`. The waits in the manager anchor on the server's name or on a quiet terminal.
- **Commit:** `87a9b77`

**5. [Rule 3 - Blocking] The Then reads the whole terminal text, not the text after a mark**
- **Found during:** Task 3
- **Issue:** A step module holds no state and exports nothing, and the frozen world has no field for a terminal mark.
- **Fix:** Only the When's info command prints plugin info in that terminal, so the Then reduces the whole terminal text to its set of `mcp: plugin:...` lines and compares that set with the stated line.
- **Commit:** `87a9b77`

**6. The refused-registration scenario's `mcp` cell carries `unsetVariables`**
- The build reports the unset `PI_CM_UNSET_PORT` on the entry today, so the full-field comparison states it (P2-DC-16). Pi's `validateMcpServerConfig` rejects the url, the sync logs the refusal, and the row reads `not loaded`.

**7. The existing MSEL-01 unit loop covers adapter and none only**
- `ANAME-01 / ASTAT-01 / MSEL-01: under ${implementation} the lookup's reader is asked for the recorded server's generated adapter key` ran for `builtin` too. That expectation is the behavior this plan changes, so the loop now runs for `adapter` and `none`, and a new case proves the built-in reader is asked for `plugin_alpha_my_api`.

## Parent lines

- `features/mcp-server/companion-missing.feature` line 76 (Phase 3, `@builtin-only` scenario `Plugin info names pi-mcp-adapter as a missing companion`): `"status":"status unknown"` becomes `"status":"not loaded"` in the `plugin components mcp` cell, with the table realigned.
- `test/orchestrators/plugin/info.test.ts` (shared, P2-DC-31): in the MSEL-01 `builtin` case, the built-in reader snapshot names `plugin_alpha_srv` instead of `plugin_alpha_srv_` (`builtin: statusSnapshot([{ name: "plugin_alpha_srv", status: "failed" }])`). This plan changed that one line; keep it when the read-time verdicts merge.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-17 (the project `mcp.json` is read only while trusted; unit case), T-02-18 (every read or parse error reads as no override; unit cases for absent, empty, invalid, non-object, directory, and comment-bearing files), and T-02-19 (`overridden by mcp.json` is stamped before the reader, and the strict reader mock proves the reader is not asked) are implemented and tested. T-02-20 and T-02-35 are accepted as planned: info shows only fixed tokens, and the P2-DC-46 gap is stated in the reader's header.

## Dubious Choices

**DC-A: A project row is the block's `marketplaceScope`**
- **Choice:** The built-in arm treats a block with `marketplaceScope: "project"` as a project row, as the adapter arm's `projectOverrides` already does.
- **Alternatives:** Read the plugin row's own scope.
- **Why dubious:** The two scopes agree for every record info stamps today (a project install records its marketplace in the project, D-MF-04), but the arm depends on that.
- **Severity:** Low.

**DC-B: The terminal step reaches the stub's log and creates its directory**
- **Choice:** Wait for the stub's `tools/list` log entry before opening `/mcp`, and create `<home>/harness` first.
- **Alternatives:** Poll the info command until it shows `(connected)`, which prints more info lines into the same terminal and would need a terminal mark the world cannot carry; start a profile Pi as well, which costs a second Pi start.
- **Why dubious:** The step depends on the stub's log, a harness detail, and maps the registered name back as `plugin_<plugin>_<server>`, which holds for the simple names the scenarios use.
- **Severity:** Low.

**DC-C: The up arrow from the first action reaches Disable**
- **Choice:** Pi's select list wraps, and Disable is the last action Pi 1.5.0 offers for an enabled server an extension registered (no project variant for that scope).
- **Alternatives:** Count down by the state's actions, which depends on the connection state Pi shows.
- **Why dubious:** A later Pi that adds an action after Disable for extension servers would make the step choose another action; the scenario would then fail, not pass wrongly.
- **Severity:** Low.

**DC-D: An `mcp.json` entry counts when it has a string `command` or `url`**
- **Choice:** The P2-DC-15 approximation of Pi's validated set.
- **Alternatives:** Reproduce Pi's whole `validateMcpServerConfig`.
- **Why dubious:** An entry Pi rejects for another reason (for example a non-http url) still reads `overridden by mcp.json`, while Pi connects the plugin's server (RESEARCH A3).
- **Severity:** Low.

**DC-E: An untrusted project row reads `project not trusted` without reading any `mcp.json`**
- **Choice:** The first stamp short-circuits the whole row.
- **Alternatives:** Read the user file anyway.
- **Why dubious:** None functionally, since `project not trusted` precedes every other stamp; listed because the plan did not name it.
- **Severity:** Low.

## Self-Check: PASSED

- All created and modified files listed above exist in the worktree.
- Commits `30a2e89`, `dc0258e`, and `87a9b77` are ancestors of HEAD.
