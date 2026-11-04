---
phase: 02-built-in-materialization
plan: "02"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, pi-mcp-adapter, cucumber, configuration, invocation, tool-search]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "plan 02-01: the filled builtinRegistrationStep, BUILTIN_FIELD_ENCODER, and the tool-search calls step"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "the frozen launch-environment extension, settledRegistry, profileFor, the MCP implementation steps, the stub messages step, the dual cucumber profiles"
provides:
  - "Given pi runs with the scripted model, pi's built-in mcp, and the environment variable {string} set to {string}"
  - "Given pi's built-in mcp has listed the tools of the http mcp server {string} of the plugin {string}"
  - "Given the user has run {string}, which warned that the mcp server {string} of the plugin {string} reads the unset variable {string} (IN-02)"
  - "configuration.feature and invocation.feature under both profiles, with no file-level tag"
affects: [02-08, 02-09]

actuals:
  tokens: 12800
  tasks: 3
  commits: 3
plan_head_before: b6c3aa592d1903634b05e11f87dff512383daffc
plan_head_after: 73493cf95e7c3f3cb679b0d89e10509fe8ba727b

tech-stack:
  added: []
  patterns:
    - "A built-in http listing wait reads the server's log and Pi's settled tool registry"
    - "An adapter setup that warns asserts its MCP config notice whole (IN-02)"

key-files:
  created: []
  modified:
    - features/mcp-server/configuration.feature
    - features/mcp-server/invocation.feature
    - features/step_definitions/mcp-server/configuration.steps.ts

key-decisions:
  - "features/lib/mcp-server-http.ts is unchanged: Pi 1.5.0's streamable HTTP client works with its plain-JSON answers, its 202 for notifications, and its 405 for the event-stream GET"
  - "The IN-02 step names the server by its declared name and compares the notice's server key through profileFor(\"adapter\").serverName, since the notice names the key in mcp-adapter.json"
  - "The IN-02 step reads the notice's scope from the command's --scope flag and fails when the command names none"
  - "Built-in twins without a launch variable start Pi with the frozen 'pi runs with the scripted model and the mcp implementation', as the merged listing, sources, and builtin-direct twins do"

requirements-completed: [BLT-01, BLT-02]

coverage:
  - id: D1
    description: "A variable set when Pi starts reaches a built-in stdio server's env and a remote server's headers at registration, with no reinstall"
    requirement: BLT-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A variable set when Pi starts reaches the server's env (BLT-02); #A remote server receives the plugin's headers, a variable among them expanded at registration (BLT-02); features/mcp-server/invocation.feature#A variable set after install reaches the plugin's server when its session starts (BLT-02)"
        status: pass
  - id: D2
    description: "Env values reach a built-in stdio server byte for byte, `$NAME` and a leading `!` included, and no shell command runs"
    requirement: BLT-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A server's env value reaches it as Claude Code expands it, with nothing Pi reinterprets (BLT-02), 6 rows"
        status: pass
  - id: D3
    description: "An unset header variable reaches the server as Claude Code's literal ${NAME}"
    requirement: AVAR-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A header whose variable is unset reaches the server as Claude Code's literal reference (BLT-02, AVAR-02)"
        status: pass
  - id: D4
    description: "CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA in a built-in stdio server's env, and the plugin root in args"
    requirement: MENV-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature#A stdio server's environment holds the plugin's root and data directories as Claude Code sets them (MENV-01, MENV-02); #The plugin root variable in args reaches the server as the plugin's directory (BLT-02)"
        status: pass
  - id: D5
    description: "The model reaches a deferred built-in server's tool through tool_search and a direct call; a search for an unlisted tool loads nothing and sends no call"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature (builtin profile, 3 scenarios)"
        status: pass
  - id: D6
    description: "The adapter installs that warn of an unset variable assert the notice"
    requirement: BLT-02
    verification:
      - kind: e2e
        ref: "features/mcp-server/configuration.feature (adapter profile, 3 IN-02 setups)"
        status: pass

duration: 1h 05m
completed: 2026-11-04
---

# Phase 2 Plan 02: Built-in configuration and invocation twins Summary

**`configuration.feature` and `invocation.feature` now run under both profiles: ten built-in twins show what a plugin's server receives from Pi's built-in MCP (launch variables, headers, an unset header kept as `${NAME}`, env values with `$` and a leading `!` unchanged, the plugin directories, and the calls the model makes through `tool_search`), and the three adapter installs that warn now assert their `variables-missing` notice (IN-02).**

## Performance

- **Duration:** about 1 h 05 min
- **Completed:** 2026-11-04
- **Tasks:** 3 of 3
- **Files:** 3 modified

## Accomplishments

- `configuration.steps.ts` gained three steps. The built-in launch step writes the user variable, starts a profile Pi with no companion and the launch-environment extension, and asserts the variable was applied. The built-in http listing wait shares one poll helper with the adapter wait: the server must log a `tools/list`, and Pi's settled registry must hold a tool in the server's built-in namespace (or the full cut name). The IN-02 step asserts that every result except the MCP config notices is info, and that the notices are exactly one `variables-missing` section for that scope, plugin, server key, and variable.
- `configuration.feature` has no file-level tag: 7 `@adapter-only` scenarios and 7 `@builtin-only` twins (one an Outline with 6 rows). The description names D-CF6-05 and D-08-04 for the adapter, and BLT-02, AVAR-02, MENV-01, and MENV-02 for built-in.
- `invocation.feature` has no file-level tag: 4 `@adapter-only` scenarios and 3 `@builtin-only` twins. "A direct call to the tool a search activated" stays adapter-only with no twin, because under built-in every call after a search is direct.
- What Pi's built-in client sends, as pinned: over HTTP, `initialize`, `notifications/initialized`, `tools/list`, and `tools/call` once each, all with the plugin's headers, plus one event-stream `GET`. To a stdio stub: `initialize` with `{"protocolVersion":"2025-11-25","capabilities":{"roots":{}},"clientInfo":{"name":"pi","version":"1.5.0"}}`, then `notifications/initialized`, `tools/list`, and `tools/call` with `_meta: {"progressToken": 3}`.

## Task Commits

1. **Task 1 (tracer): a launch variable reaches a built-in stdio server's env** - `09e7ee2` (test)
2. **Task 2: built-in twins of every configuration scenario** - `72ed415` (test)
3. **Task 3: built-in twins of the invocation scenarios** - `73493cf` (test)

Tracer gate: Task 1's verify passed under both profiles before Task 2 started (builtin seed 421802, adapter seed 57366).

## TDD Gate Compliance and red runs

These tasks add tests only, and the product code is plan 02-01's. Each red run reverted a file in the working tree, ran, and restored it. No reverted file was committed, and `git status` was clean afterwards.

- **Task 1, builtin profile, seed step** (`git show 87d3f28:.../builtin-registration-step.ts`, seed 703379): 1 scenario, 1 failed. `A variable set when Pi starts reaches the server's env (BLT-02)` failed in `the mcp implementation has listed the tools of the stub mcp server "tag"` with `the builtin mcp implementation did not finish listing the tools of demo/tag: {"requests":[],"running":[]}`.
- **Task 1, adapter profile, IN-02 without a notice:** a temporary copy of `A variable reference in env reaches the server with the value Pi starts with` declared `${PI_CM_STUB_TAG:-set}`, so the install warned of nothing. The scenario failed in the IN-02 step: actual `[]`, expected the one `variables-missing` notice.
- **Task 2, builtin profile, seed step** (seed 604418): 12 scenarios, 12 failed. The 9 stdio scenarios (the Outline's 6 rows included) failed in the stub listing wait with `{"requests":[],"running":[]}`. The 3 http twins failed in the new wait with `pi's built-in mcp did not list the tools of web: []`.
- **Task 2, builtin profile, escaping removed** (extra; `escapedForPi` in `bridges/mcp/builtin-escape.ts` returned its input, seed 428309): 3 scenarios, 3 failed. `!echo pwned` came back as `pwned:echo:ping`, so Pi ran a shell command. `cost $5 and $HOME` came back as `cost $5 and {home}:echo:ping`. The unset-header twin never connected (`pi's built-in mcp did not list the tools of web: []`).
- **Task 2, adapter profile, IN-02 without a notice** (seed 128614): with `${PI_CM_TEAM:-core}` and `${PI_CM_UNSET_TEAM:-}`, both http adapter scenarios failed in the IN-02 step.
- **Task 3, builtin profile, seed step** (seed 219436): 3 scenarios, 3 failed in the stub listing wait with `{"requests":[],"running":[]}`.

## Verification

- `configuration.feature`: builtin 12 of 12 (seed 831953), adapter 10 of 10 (seed 682125).
- `invocation.feature`: builtin 3 of 3 (seed 359239), adapter 4 of 4 (seed 283591).
- Both files together at the end: builtin 15 of 15 scenarios, 189 steps (seed 823021); adapter 14 of 14 scenarios, 178 steps (seed 947541).
- `npm run check:static` passed after each task (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features).
- Acceptance greps: `^@adapter-only` prints 0 in both files; `@builtin-only` prints 7 in `configuration.feature` and 3 in `invocation.feature`; the awk check prints nothing, so no `@adapter-only` scenario uses `which did not fail`; both new step texts appear in `configuration.feature`.
- `features/lib/mcp-server-http.ts` is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The IN-02 notice names the server by its adapter key**
- **Found during:** Task 1 (adapter profile)
- **Issue:** The notice's `server` is the key in `mcp-adapter.json` (`plugin_demo_tag_`), not the declared name. The docs say "Server key in `file`."
- **Fix:** The step keeps the declared name in its text and compares `profileFor("adapter").serverName(plugin, server)`.
- **Commit:** `09e7ee2`

**2. [Rule 3 - Blocking] A clone of the adapter launch step**
- **Found during:** Task 1 (`npm run check:static`, fallow dupes)
- **Issue:** The new launch step's body was a 7-line clone of the frozen adapter step in `listing.steps.ts`.
- **Fix:** The variables and the launch are built first and passed by name. No suppression marker.
- **Commit:** `09e7ee2`

**3. [Plan detail] The tools/call progress token is 3, not the request id 2 the plan suggested**
- Pi's client sent `_meta: {"progressToken": 3}` in every run; the stub logs no request with id 2. The rows pin what the stub logged, as the plan asks.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-10 is mitigated: the `!echo pwned` and `cost $5 and $HOME` rows pass through Pi 1.5.0 itself, and with escaping removed the first row ran a shell command (red run above). T-02-11 and T-02-12 are accepted as planned: the launch file is released by the scenario, and the http stand-in listens on 127.0.0.1 only. T-02-SC: no package was added.

## Parent lines

None. No frozen or parent-owned file needed a change.

## Dubious Choices

**DC-A: The IN-02 step reads the notice's scope from the command's `--scope` flag**
- **Choice:** The scope is parsed from the command text, and the step fails when the command names no `--scope`.
- **Alternatives:** A `{word}` scope in the step text (the plan fixes the text), or leaving `scope` out of the comparison.
- **Why dubious:** The step reads a value from the command it runs. A command without `--scope` cannot use the step, even though install has a default scope.
- **Severity:** Low.

**DC-B: The IN-02 step fixes `file: "mcp-adapter.json"` and `commandId: "plugin install"`**
- **Choice:** The expected notice result is written whole with these two values.
- **Alternatives:** More step parameters.
- **Why dubious:** The step fits only an install whose notice is in pi-mcp-adapter's config. Every current use is like that.
- **Severity:** Low.

**DC-C: Twins without a launch variable start Pi with `pi runs with the scripted model and the mcp implementation`**
- **Choice:** The frozen MCP implementation step, which also loads the Phase 1 stand-in under the builtin profile. The stand-in registers only servers that a step names, and none of these scenarios name one.
- **Alternatives:** `pi runs with the scripted model`, which the plan lists as the no-companion launch.
- **Why dubious:** The context says Phase 2 scenarios never use the stand-in. It is loaded but idle, as in the merged listing, sources, and builtin-direct twins.
- **Severity:** Low.

**DC-D: The built-in client's progress token and event-stream count are pinned**
- **Choice:** `progressToken: 3` in the stub's `tools/call`, and one `GET` in the http twins' other-requests table.
- **Alternatives:** A projection that hides the token value or the number of `GET` requests.
- **Why dubious:** Both are Pi 1.5.0 client details. A later Pi could change them and fail these scenarios without a behavior change in the extension. Both held in every passing run of this plan (at least three per file).
- **Severity:** Low.

**DC-E: The seed red runs fail at the listing wait, not at the value rows**
- **Choice:** The plan's red proof (the seed step registers nothing) fails every twin in its listing Given. An extra mutation run (escaping removed) shows that the value rows themselves fail when the encoding breaks.
- **Alternatives:** One mutation per twin.
- **Why dubious:** The seed run alone proves only that the twins need the registration. The mutation run covers the escaping rows and the unset header, not the plugin-directory rows.
- **Severity:** Low.

**DC-F: Commit attribution line**
- **Choice:** The commits end with the `Claude-Session` URL that the orchestrator and the child-session brief give (`session_01EDUMG7S9uXh4o5dikBwum8`), as the branch's earlier commits do. The runtime reminder named a different session URL.
- **Alternatives:** The runtime's URL.
- **Why dubious:** The two sources disagree. The user's own brief says "exactly", so it was followed.
- **Severity:** Low.

## Self-Check: PASSED

- `features/mcp-server/configuration.feature`, `features/mcp-server/invocation.feature`, and `features/step_definitions/mcp-server/configuration.steps.ts` exist with the changes above.
- Commits `09e7ee2`, `72ed415`, and `73493cf` are ancestors of HEAD.
