---
phase: 01-harness-and-version-raise
plan: 06
subsystem: testing
tags: [cucumber, pi-mcp-adapter, mcp-stub, scripted-model, project-servers, mcp-variables]

requires:
  - phase: 01-harness-and-version-raise (01-03)
    provides: "the profile Pi, the scripted model, the model-turn When, the calls Then, and the stand-in convention"
  - phase: 01-harness-and-version-raise (01-14)
    provides: "the written ${NAME:-default} shape that pi-mcp-adapter expands at connect time (D-CF1-13)"
provides:
  - "features/lib/mcp-stub-server.ts: a dependency-free stdio MCP stub that logs every message, keeps a pid file, and exits on stdin close (HAR-04, D-CF1-17)"
  - "features/lib/mcp-server-files.ts: the .mcp.json writer that runs the stub with Node, with an optional env map"
  - "features/lib/pi-launch-environment.ts: an extension that gives a profile Pi a variable from the user's launch environment"
  - "features/mcp-server/invocation.feature: three scenarios (user-scope call, allowed project-scope call, connect-time ${NAME:-default})"
  - "The project-server approval Given in mcp-configuration.steps.ts (D-CF1-07)"
affects: [01-09 (cucumber skill reconciliation), MCP servers phase (Phase 6), FG-29]

actuals:
  tokens: 7927    # chars/4 over the added diff lines (31,706 chars, 7 files)
  tasks: 3
  commits: 3      # MEASURED: git rev-list --count c5a8396..HEAD
plan_head_before: c5a8396c78f5d9c5f11097f31b1b5c02da0f63ef
plan_head_after: fba96f716ff958c40258e05a423fbe0a0bb3f3b3

tech-stack:
  added: []
  patterns:
    - "A stand-in child script under features/lib/ exports its own path and runs its main code only when process.argv[1] is that path"
    - "A scenario that needs pi-mcp-adapter's startup listing settled waits for it with a Given before its model turn"
    - "A profile Pi gets a launch variable through the pi-launch-environment extension, never through the worker's process.env"

key-files:
  created:
    - features/lib/mcp-stub-server.ts
    - features/lib/mcp-server-files.ts
    - features/lib/pi-launch-environment.ts
    - features/step_definitions/mcp-server/calls.steps.ts
    - features/mcp-server/invocation.feature
  modified:
    - features/lib/mcp-configuration.ts
    - features/step_definitions/mcp-configuration.steps.ts

key-decisions:
  - "Each MCP scenario installs through the run's shared Pi, before the profile Pi starts, with the setup step ', which warned'. After a new_session, the adapter's startup connections varied (2 or 3 across 9 runs). With this order the log was the same in 11 of 11 runs."
  - "A Given waits until the stub logged tools/list and no stub process is left, so the model's call never shares or loses the adapter's listing connection"
  - "The stub log Then shows the n-th tool call id of the last turn as {tool call <n>}, because Pi makes up a new id for each call"
  - "A profile Pi gets PI_CM_STUB_TAG from a new extension, features/lib/pi-launch-environment.ts, loaded through PiProfile.extraExtensions, because world.ts (owned by 01-04 this wave) passes only TMPDIR"
  - "The approval Given writes <agent dir>/mcp-adapter.json, the file pi-mcp-adapter 7.0.0 reads as its user-global config (getPiGlobalConfigPath -> getAgentPath('mcp-adapter.json'), with PI_CODING_AGENT_DIR as the agent dir)"

patterns-established:
  - "Stub log rows: kind (request or notification), method, and params as JSON, with every message from the named plugin and server"

requirements-completed: [HAR-04, HAR-06, HAR-07, VER-05]

coverage:
  - id: D1
    description: "A scripted mcp call through pi-mcp-adapter reaches the plugin's stub server. The stub's whole log and the model calls are compared."
    requirement: HAR-04
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature#A scripted call through the mcp tool reaches the plugin's server and returns its result"
        status: pass
    human_judgment: false
  - id: D2
    description: "With the approval Given, a project-scope plugin server in the trusted profile project connects and answers. Without it, the adapter never starts the server."
    requirement: HAR-06
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature#An allowed project-scope plugin server connects and answers a scripted call"
        status: pass
      - kind: manual_procedural
        ref: "red run without the approval Given (this SUMMARY): the listing wait timed out with no stub request"
        status: pass
    human_judgment: false
  - id: D3
    description: "features/mcp-server/, mcp-server-files.ts, and mcp-server/calls.steps.ts exist and are used, and check:features passes"
    requirement: HAR-07
    verification:
      - kind: other
        ref: "npm run check:features; npm run fallow"
        status: pass
    human_judgment: false
  - id: D4
    description: "A ${NAME:-default} in a plugin server's env is expanded at connect time: a variable set after install reaches the stub without a reinstall"
    requirement: VER-05
    verification:
      - kind: e2e
        ref: "features/mcp-server/invocation.feature#A variable set after install reaches the plugin's server when it connects"
        status: pass
      - kind: manual_procedural
        ref: "red run with 01-14's three product files reverted (this SUMMARY): install-default:echo:ping"
        status: pass
    human_judgment: false

duration: 46min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 06: MCP Stub Server and MCP Seed Summary

**A dependency-free stdio MCP stub now stands in for a plugin's server. Three scenarios cover pi-mcp-adapter's `mcp` proxy at user scope, at project scope (with the separate approval Given that D-CF1-07 requires), and with a `${PI_CM_STUB_TAG:-install-default}` env value that the adapter expands at connect time.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-11-01T04:40:47Z
- **Completed:** 2026-11-01T05:26:05Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 modified)

## Accomplishments

- `features/lib/mcp-stub-server.ts` answers `initialize` with the client's protocol version, `tools/list` with one `echo` tool, and `tools/call` with `echo:<text>`, or `<STUB_TAG>:echo:<text>` when `STUB_TAG` is set. It gives any other request an empty result and sends nothing for a notification. It logs `{plugin, server, notification, method, params}` per message to `<harness dir>/mcp-stub-requests.jsonl` and keeps `<harness dir>/mcp-stub-<pid>.pid`. When its stdin closes, it removes the pid file and exits 0. It finds the harness directory through `HOME`, which the adapter passes on from Pi, so each scenario's stub logs into its own sandbox.
- `features/lib/mcp-server-files.ts` writes a `.mcp.json` whose stdio server runs `process.execPath` with the stub path and the plugin and server names, plus an optional `env` map.
- `features/mcp-server/invocation.feature` holds three scenarios, all compared whole.
- The approval Given writes `{"settings":{"projectServers":"allow"},"mcpServers":{}}` to `<agent dir>/mcp-adapter.json` with `wx`, registers its removal, and asserts the text. The default profile never writes it.

## Task Commits

1. **Task 1: A scripted mcp call reaches the plugin's stub server and returns its result**: `4a468b2` (test). Tracer gate re-run passed (cucumber 1/1, check:features, fallow dead-code).
2. **Task 2: Allow project MCP servers in a separate Given and prove a project server connects**: `c67ca6f` (test)
3. **Task 3: A default-carrying variable set after install reaches the server at connect time**: `fba96f7` (test)

## Step texts added

| Keyword | Text | Module |
| --- | --- | --- |
| Given | `the published plugin {string} of the marketplace {string} has the stub mcp server {string}` | `mcp-server/calls.steps.ts` |
| Given | `the published plugin {string} of the marketplace {string} has the stub mcp server {string} with "STUB_TAG" set to "${PI_CM_STUB_TAG:-install-default}"` (registered with `$\{` escaped) | `mcp-server/calls.steps.ts` |
| Given | `pi runs with the scripted model, pi-mcp-adapter, and the environment variable {string} set to {string}` | `mcp-server/calls.steps.ts` |
| Given | `pi-mcp-adapter has listed the tools of the stub mcp server {string} of the plugin {string}` | `mcp-server/calls.steps.ts` |
| Then | `the stub mcp server {string} of the plugin {string} receives these messages:` (columns `kind`, `method`, `params`) | `mcp-server/calls.steps.ts` |
| Given | `pi-mcp-adapter allows project mcp servers for the user` | `mcp-configuration.steps.ts` |

## Evidence

### The stub log (user scope; the project-scope log is identical)

| kind | method | params |
| --- | --- | --- |
| request | initialize | `{"protocolVersion":"2025-11-25","capabilities":{"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}},"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}}` |
| notification | notifications/initialized | |
| request | tools/list | |
| request | initialize | (same as above) |
| notification | notifications/initialized | |
| request | tools/list | |
| request | tools/call | `{"name":"echo","arguments":{"text":"ping"},"_meta":{"pi-mcp-adapter/toolCallId":"{tool call 1}","progressToken":2}}` |

The first three messages are the adapter's startup listing for a lazy server with no cached metadata (`init.ts` `needsDiscovery`). The adapter closes that connection afterwards. The last four come from the connection that serves the call. The model calls are `call the stub`, then `tool call mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"ping"}}`, then `mcp returned: echo:ping`.

### Research A7: the nested call emits its own RPC tool records

Yes. The turn's records hold `tool_execution_start` `mcp` (id `tool:<n>:<r>`), two non-dialog `extension_ui_request` records, `tool_execution_start` `mcp__plugin_demo_stub__echo` (id `tool:<n>:<r>/1`), `tool_execution_end` for the nested tool, then `tool_execution_end` for `mcp`. So a step that lists tool events has two rows per proxy call, and the nested call's id is the outer id plus `/1`.

### Research A5: the user-global file

pi-mcp-adapter 7.0.0 reads its user-global config from `getPiGlobalConfigPath()` = `getAgentPath("mcp-adapter.json")`. `agent-dir.ts` resolves the agent dir from `PI_CODING_AGENT_DIR`, which the harness sets to the sandbox agent dir. That source has `scope: "global"`, so `settings.projectServers` is honored there (`config.ts:651-661`). It is ignored with a warning in a project file. In RPC, `applyProjectServerTrust` allows an unapproved project server only when the project is trusted and the policy is `allow` (`project-server-trust.ts:279`). The default is `ask`, which blocks the server with `approval-required`.

### Red runs (temporary edits, reverted, not committed)

1. **Task 1, without the stub-server Given:** the plugin has no MCP server, so the install reports info, and `Given the user has run "...", which warned` fails on the info cascade (`reasons: []`, `severity: 'info'`).
2. **Task 2, without the approval Given:** `pi-mcp-adapter did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`. The adapter never started the project server.
3. **Task 3, with 01-14's change reverted** (`claude-mcp-variables.ts`, `adapter-escape.ts`, and `adapter-entry.ts` restored from `c04a32c^`): `+ 'mcp returned: install-default:echo:ping'` / `- 'mcp returned: late:echo:ping'`. The files were restored with `git checkout --`, and `git status` showed only the plan's files.

### Runs

- `npx cucumber-js features/mcp-server`: 3/3 on 5 runs (random order).
- Determinism probes: with install in the profile Pi and a new session, the startup listing ran 2 or 3 times across 9 runs. With install first and the listing wait, the log was the same in 8 of 8 probe runs and in every later run.
- `npm run check:features`, `npm run fallow` (all four sub-gates), `npx tsc --noEmit`, and ESLint `--max-warnings 0` on the changed files all passed. `check:commit` was skipped on all three commits, because files under `features/` are not build inputs.

## Files Created/Modified

- `features/lib/mcp-stub-server.ts`: the stub, its path, `readStubRequests`, and `stubPidFiles`.
- `features/lib/mcp-server-files.ts`: `stubMcpFileText`, `publishStubMcpServer`, and `LATE_TAG_ENVIRONMENT`.
- `features/lib/pi-launch-environment.ts`: the launch-environment extension and its file and log helpers.
- `features/step_definitions/mcp-server/calls.steps.ts`: the steps listed above.
- `features/mcp-server/invocation.feature`: three scenarios.
- `features/lib/mcp-configuration.ts`: `PROJECT_SERVERS_ALLOWED_CONFIG` and `writeProjectServersAllowedConfig`.
- `features/step_definitions/mcp-configuration.steps.ts`: the approval Given.

## Decisions Made

See `key-decisions` in the frontmatter. The install-first order and the listing wait both come from one measured fact: a new RPC session binds the extension twice. Each binding starts the adapter's startup listing, and the first one is aborted at a varying point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's step order gave a stub log that changed from run to run**
- **Found during:** Task 1
- **Issue:** The plan's order was profile Pi, install, new session, then prompt. With it, the stub log held 2 or 3 adapter connections (9 runs), so a whole-log comparison could not be stable.
- **Fix:** Each scenario installs before the profile Pi starts, through the run's shared Pi, which has no adapter, so the install warns `requires pi-mcp-adapter`. The setup uses `the user has run "...", which warned`, and `pi-mcp-adapter has listed the tools of ...` waits for the startup listing to finish before the turn. The scenarios have no `new session` step, because the profile Pi's own startup session loads the server.
- **Files modified:** `features/mcp-server/invocation.feature`, `features/step_definitions/mcp-server/calls.steps.ts`
- **Verification:** 8/8 probe runs gave the same log, and so did every later run.
- **Committed in:** `4a468b2`

**2. [Rule 3 - Blocking] Pi makes up a new tool call id for each call, and the adapter forwards it in `_meta`**
- **Found during:** Task 1
- **Fix:** The messages Then reads the tool call ids from the last turn's model calls and shows the n-th one as `{tool call <n>}`.
- **Committed in:** `4a468b2`

**3. [Rule 3 - Blocking] A new library file for the launch environment**
- **Found during:** Task 3
- **Issue:** The profile Pi's environment is the allowlist plus `TMPDIR`, and `world.ts` (01-04's file this wave) passes no other variable.
- **Fix:** I added `features/lib/pi-launch-environment.ts`, which is not in `files_modified`. The Pi extension reads `<home>/pi-launch-environment.json` at load, copies it into `process.env`, and logs it to the harness. A Given in `mcp-server/calls.steps.ts` writes the file and starts the profile Pi with `extraExtensions: [PI_LAUNCH_ENVIRONMENT_EXTENSION]`. The worker's own `process.env` is never touched.
- **Committed in:** `fba96f7`

**4. [Scope] A stub fixture argument and one more stub export**
- The stub takes the plugin and server names as arguments and logs them, so the messages Then names the server by plugin and server. It also exports `stubPidFiles` for the listing wait.

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking), plus 1 scope note.
**Impact on plan:** The behaviors and the step contracts are the ones the plan asked for. The step order differs from the plan's, and one library file was added.

## Issues Encountered

- The worktree guard refused heredocs and compound git commands, so the edits ran through the Write tool and small scripts in the scratch folder.
- The Task 1 commit took more than 10 minutes in the hook (TruffleHog and the other pre-commit stages; `check:commit` was skipped). It completed with exit 0.

## Known Stubs

None. (The MCP stub is a deliberate stand-in, not a stub in the product.)

## Dubious Choices

1. **Install before the profile Pi, with `, which warned`.** The plan says to install in the profile Pi and then start a new session. That order made the adapter's startup connections vary. The install now runs in a Pi without pi-mcp-adapter, so its result carries `requires pi-mcp-adapter`. That matches a real flow (install, then start Pi with the adapter), but the scenarios no longer show an install in a Pi that already has the adapter.
2. **The listing-wait Given polls** the stub log and pid files every 50 ms, with a 15 s deadline. It is not a fixed sleep. The other option, an `fs.watch`, is less portable.
3. **`{tool call <n>}` is a projection local to one step.** It is not in the run-token list in `.agents/skills/cucumber/rules/features.md`. Plan 01-09 should add it there or move it.
4. **The startup listing is in the expected log.** Phase 6 inherits two connections per call scenario (listing, then call). If a later adapter version caches differently, these rows change.
5. **The new file `features/lib/pi-launch-environment.ts`** is outside `files_modified`. Like the other stand-ins, it is a harness library, and plan 01-09 should list it among the frozen harness libraries in the cucumber skill. A world-level `environment` field on `PiProfile` (01-04's file) would be the cleaner long-term home.
6. **The Task 3 step text holds the env value literally** (`"${PI_CM_STUB_TAG:-install-default}"`, registered with an escaped brace), as the acceptance grep requires. It is not a `{string}` parameter.
7. **The stub logs the plugin and server names** from its arguments, which the plan did not ask for. The messages Then needs them to name the server.
8. **FG-29 is not decided.** The approval scenario shows only that an allowed project server connects. It does not show what Claude Code does for an unapproved one.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-33: the stub exits on stdin close and removes its pid file, and the profile release asserts that no recorded pid is alive. T-01-34: the stub logs only JSON-RPC messages, in the sandbox harness directory. The launch-environment log records only the variables a scenario chose, never the inherited environment. T-01-35: the approval file is written with `wx` in the sandbox agent dir and removed by the scenario's release.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 6 has the stub, the fixture writer, the step module, and the seed. It decides FG-29 on top of the approval Given.
- Plan 01-09 should reconcile `.agents/skills/cucumber/rules/world-and-stand-ins.md` with the listing wait, `{tool call <n>}`, the launch-environment extension, and the A7 finding (two tool event pairs per proxy call).

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*

## Self-Check: PASSED

- FOUND: all five created files, and `features/mcp-server/invocation.feature` holds 3 scenarios.
- FOUND on HEAD: `4a468b2`, `c67ca6f`, `fba96f7` (`git rev-list --count c5a8396..fba96f7` = 3).
- Acceptance re-checked: `grep -c 'mcp-stub-requests.jsonl' features/lib/mcp-stub-server.ts` = 1. `grep -c projectServers features/lib/mcp-configuration.ts` >= 1. `grep -c 'PI_CM_STUB_TAG:-install-default'` totals 2 across `calls.steps.ts` and `mcp-server-files.ts`.
