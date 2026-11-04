---
phase: 01-foundation-and-pi-1-5-0
plan: "10"
subsystem: testing
tags: [cucumber, harness, mcp, pi-builtin-mcp, pi-mcp-adapter, stand-in, profiles]

requires:
  - phase: 01-03
    provides: builtinMcpServerName, foldedMcpServerKey, profileFor("builtin").toolNamePrefix
  - phase: 01-07
    provides: cucumber profiles, world.mcpProfile, usePiWithProfile, features/lib/mcp-implementation.ts
provides:
  - features/lib/builtin-mcp-stand-in/ (stand-in Pi extension, server list reader and writer, decision log)
  - registry probe report field mcpServers
  - mcpImplementationLaunch(profile), settledRegistry(pi), waitForStubListing(implementation, pi, harness, plugin, server)
  - listedTools(requests, plugin, server) in mcp-stub-server.ts
  - steps "pi runs with the scripted model and the mcp implementation", "the mcp implementation has listed the tools of the stub mcp server {string} of the plugin {string}", "a stand-in registers the stub mcp server {string} of the plugin {string} with pi's built-in mcp", "pi lists these registered mcp servers:", "the user has run {string}, which did not fail"
  - two seed scenarios in features/mcp-server/implementation-profiles.feature (@builtin-only stand-in, @adapter-only twin)
affects: [01-13, 01-14, phase-2, phase-3, phase-4, phase-5]

actuals:
  tokens: 9600
  tasks: 2
  commits: 2
plan_head_before: 9a32dc213f8b31dc2db7d92afe507f3559562aa5
plan_head_after: cfa6282

tech-stack:
  added: []
  patterns:
    - "A harness Pi extension that needs scenario input reads a file a step wrote to the sandbox home before the profile Pi starts, and logs one JSON line per decision to the harness directory"
    - "One listing wait serves both implementations: the stub's tools/list plus no running stub (adapter), or plus a tool in the server's built-in namespace (builtin)"

key-files:
  created:
    - features/lib/builtin-mcp-stand-in/extension.ts
    - features/lib/builtin-mcp-stand-in/servers.ts
  modified:
    - features/lib/mcp-implementation.ts
    - features/lib/mcp-stub-server.ts
    - features/lib/pi-registry-probe/extension.ts
    - features/lib/pi-registry-probe/snapshot.ts
    - features/step_definitions/mcp-implementation.steps.ts
    - features/step_definitions/command.steps.ts
    - features/step_definitions/mcp-server/listing.steps.ts
    - features/mcp-server/implementation-profiles.feature
    - features/support/world.ts

key-decisions:
  - "The stand-in's server list lives at <home>/builtin-mcp-stand-in.json, not in the harness directory, because the harness directory does not exist until the profile Pi starts"
  - "Pi 1.5.0 lists a deferred built-in tool in getAllTools before any search, inactive, so the builtin seed also states pi offers these plugin mcp tools:"
  - "The adapter wait and the neutral wait share waitForStubListing in features/lib/mcp-implementation.ts"

patterns-established:
  - "Neutral MCP scenario: install with 'which did not fail', 'a stand-in registers ...', 'pi runs with the scripted model and the mcp implementation', 'the mcp implementation has listed ...'"

requirements-completed: [DUAL-01]

coverage:
  - id: D1
    description: "Under the builtin profile the stand-in registers plugin_demo_stub with Pi's built-in MCP, Pi connects and lists it, and the seed proves it through the shared steps"
    requirement: DUAL-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile builtin features/mcp-server/implementation-profiles.feature (1 scenario, 13 steps passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Under the adapter profile the same Givens start pi-mcp-adapter, wait for its listing, and the stand-in step registers nothing"
    requirement: DUAL-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter (1562 scenarios passed, 6m49s)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Static gates: every new step text used, no duplicated helper, typecheck, lint, fallow, format"
    verification:
      - kind: other
        ref: "npm run check:static"
        status: pass
    human_judgment: false

duration: 56min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 10: Built-in stand-in and shared MCP implementation steps Summary

**A harness Pi extension registers named stub servers with Pi 1.5.0's built-in MCP at `session_start` (deferred, stepping aside for a folded-name registration or `mcp.json` server), and five frozen steps plus two seeds let one scenario run under both cucumber profiles without naming pi-mcp-adapter.**

## Performance

- **Duration:** about 56 min
- **Started:** 2026-11-04T05:50Z (approximate)
- **Completed:** 2026-11-04T06:46:02Z
- **Tasks:** 2
- **Files modified:** 11 (2 created, 9 modified)

## Accomplishments

- `features/lib/builtin-mcp-stand-in/extension.ts`: at `session_start` it reads the list, computes `builtinMcpServerName(plugin, server)`, skips a name that `pi.getMcpServers()` or the `mcpServers` keys of `<agent dir>/mcp.json` or `<cwd>/.pi/mcp.json` hold with `-` folded to `_` (`foldedMcpServerKey`), and otherwise calls `pi.registerMcpServer(name, { command: process.execPath, args: [MCP_STUB_SERVER, plugin, server], exposure: "deferred" })`. Every decision and every failure becomes one line in `<harness>/builtin-mcp-stand-in.jsonl`, and the extension never throws. No `env: { HOME }` is needed: Pi 1.5.0's `StdioTransport` merges `process.env` (`pi-mcp/dist/transports/stdio.js:75`).
- `features/lib/builtin-mcp-stand-in/servers.ts`: `BUILTIN_MCP_STAND_IN_EXTENSION`, `readStandInServers(home)`, `writeStandInServers(home, servers)` (typebox-validated `{ plugin, server }[]`), `BUILTIN_MCP_STAND_IN_LOG`.
- Registry probe: the report gains `mcpServers: { name }[]` from `pi.getMcpServers()`, in Pi's order. The schema keeps `additionalProperties: false`.
- `features/lib/mcp-implementation.ts`: `mcpImplementationLaunch(profile)` (adapter: `["pi-mcp-adapter"]`, no extra; builtin: no companion, the stand-in), `settledRegistry(pi)` (moved), and `waitForStubListing(implementation, pi, harness, plugin, server)`. `listedTools` moved to `mcp-stub-server.ts`. `listing.steps.ts` now uses the library copies, so only one copy of each helper exists.
- Steps: the stand-in step (refuses once a profile Pi started), the MCP implementation step (`PROFILE_PI_START_TIMEOUT_MS`), the neutral wait, `pi lists these registered mcp servers:` (whole list, header `name`), and `the user has run {string}, which did not fail` (info or warning; fails on error).
- Seeds: `@builtin-only` "A stand-in registers the stub mcp server with pi's built-in mcp" and `@adapter-only` "Pi-mcp-adapter serves the stub mcp server under the adapter profile". The feature description names MGRT-01, MHK-01, and DUAL-01.

## Measurements

- **Deferred tool before a search:** Pi 1.5.0 lists `mcp__plugin_demo_stub__echo` in `getAllTools()` and leaves it out of the active tools. So the builtin seed states `pi offers these plugin mcp tools:` with `| mcp__plugin_demo_stub__echo | no |`. pi-mcp-adapter 7.0.0 under the adapter profile gives the same row.
- **Registered servers:** builtin `plugin_demo_stub`; adapter none (only the header row).
- **Fail-first proof (local):** with the `pi.registerMcpServer` call replaced by a no-op and the neutral wait removed from a scratch copy of the feature (the wait would time out first), `Then pi lists these registered mcp servers:` failed with actual `[["name"]]` against expected `[["name"],["plugin_demo_stub"]]`. The stand-in was then restored.
- **Stand-in decisions (fake-Pi scratch run):** registered `plugin_demo_stub`; skipped `plugin_demo_a-b` (`configured in <agent>/mcp.json` holding `plugin_demo_a_b`); skipped `plugin_demo_c` (`registered by /real/ext` for `plugin-demo-c`); `failed` with the thrown message when `registerMcpServer` throws; one `failed` line for a malformed list. The handler never threw.
- **Suite runs:** adapter profile 1562 scenarios passed in 6m49s (an earlier run took 7m51s, see Issues). Builtin profile: 1 scenario passed in 14.6s. In this worktree the shared Pi still loads no companion, and the `@builtin-only` rows of plan 01-09 have not merged. Builtin seed alone: 13 steps in 32s.

## Task Commits

1. **Task 1: The stand-in, the MCP implementation step, and a built-in seed scenario, end to end** - `ee12a0f` (test)
2. **Task 2: The adapter twin seed and both profiles green** - `cfa6282` (test)

The tracer gate re-ran the builtin verify before Task 2 and it passed.

## Files Created/Modified

- `features/lib/builtin-mcp-stand-in/extension.ts` - the stand-in Pi extension
- `features/lib/builtin-mcp-stand-in/servers.ts` - list file, reader, writer, extension path, log name
- `features/lib/pi-registry-probe/{extension,snapshot}.ts` - `mcpServers` field
- `features/lib/mcp-implementation.ts` - launch helper, settled registry, listing wait
- `features/lib/mcp-stub-server.ts` - `listedTools`
- `features/step_definitions/mcp-implementation.steps.ts` - four new steps
- `features/step_definitions/command.steps.ts` - `which did not fail`; `runSetup` takes a severity list
- `features/step_definitions/mcp-server/listing.steps.ts` - uses the library wait and registry
- `features/mcp-server/implementation-profiles.feature` - two seeds and the description sentence
- `features/support/world.ts` - `profilePiStarted` getter (outside files_modified)

## Decisions Made

See key-decisions and Dubious Choices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The stand-in list cannot live in the harness directory before the profile Pi starts**
- **Found during:** Task 1
- **Issue:** `usePiWithProfile` creates `<home>/harness` with a non-recursive `mkdir`, so a step that wrote `{harness}/builtin-mcp-stand-in.json` before the start would make the start fail with `EEXIST`.
- **Fix:** The list is at `<home>/builtin-mcp-stand-in.json`, as the launch environment's file is. The log stays in the harness directory. The reader and writer take the sandbox home.
- **Files modified:** features/lib/builtin-mcp-stand-in/servers.ts, extension.ts
- **Commit:** ee12a0f

**2. [Rule 3 - Blocking] The stand-in step needs to know whether a profile Pi started**
- **Found during:** Task 1
- **Issue:** The world keeps that state in a private field.
- **Fix:** A read-only `profilePiStarted` getter in `features/support/world.ts`.
- **Files modified:** features/support/world.ts
- **Commit:** ee12a0f

---

**Total deviations:** 2 auto-fixed (2 blocking). **Impact:** Neither changes a step text or the frozen contract. One file outside files_modified changed (world.ts, 4 lines).

## Issues Encountered

- One full adapter run had one failure: an http MCP scenario in `features/mcp-server/configuration.feature` (`plugin_demo_web_`) got `OAuth HTTP request failed -- probe: endpoint responded with a JSON-RPC 2.0 envelope`. `configuration.feature` alone passed, and a second full adapter run passed all 1562 scenarios. The scenario uses no file this plan changed, so I record it as a load flake and did not fix it. No `deferred-items.md` was written, to avoid a merge conflict with sibling plans.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phases 4 and 5 can write built-in scenarios with the stand-in step, the MCP implementation step, and the neutral wait. Child steps that need other companions compose `mcpImplementationLaunch(this.mcpProfile)`.
- Once plan 01-09 merges, the shared Pi follows the profile. Under the adapter profile, an MCP install then may not warn. `which did not fail` covers both states, and the seeds use it.
- Plan 01-13 reconciles the skill text. `world-and-stand-ins.md` already describes these steps verbatim. The list file location (`<home>`, not `<harness>`) is not stated there and needs no change.

## Dubious Choices

- **P1-10-DC-01: The stand-in list is at `<home>/builtin-mcp-stand-in.json`, not `{harness}/builtin-mcp-stand-in.json` as the plan says.** Alternatives: make `usePiWithProfile` create the harness directory recursively (a world change that plan 01-09 or 01-13 might also touch), or write the list in the harness directory and let the step create it. Why: the harness directory exists only after the profile Pi starts, and `pi-launch-environment.ts` already uses the home for the same reason. Severity: Low.
- **P1-10-DC-02: I added the getter `profilePiStarted` to `features/support/world.ts`, which is outside files_modified.** Alternatives: catch the `assert.fail` of `profileHarness()`, or test whether `<home>/harness` exists on disk (fragile once the shared Pi writes stub pid files). Why: it is the smallest reliable way, and it follows the guard in `turnOffBuiltinMcpBeforeStart`. Severity: Low.
- **P1-10-DC-03: The builtin wait computes the built-in namespace from `path.basename` of the stub's plugin argument.** A stub started with a plugin-root path, such as `{home}/marketplaces/fixtures/plugins/demo`, is named by its path, and the namespace needs the plugin name. Alternatives: wait only for a settled registry after the `tools/list`, which needs no name but is not server-specific. Why: the plan asks for "a tool under the server's built-in namespace", and the last path segment of a local plugin root is the plugin name. Severity: Low.
- **P1-10-DC-04: The adapter-specific wait and the neutral wait share one library function, and the adapter wait's failure text changed** from "pi-mcp-adapter did not finish listing ..." to "the adapter mcp implementation did not finish listing ...". Alternatives: keep two loops. Why: fallow dupes, and the layout rule that a helper two modules need moves to `features/lib`. Severity: Low.
- **P1-10-DC-05: The builtin seed also states `pi offers these plugin mcp tools:`,** because Pi 1.5.0 lists the deferred tool, inactive, before any search (measured). This pins Pi's choice to list deferred tools in `getAllTools()`. A Pi release that hides them until `tool_search` would break the seed, and the neutral wait too, since it looks for the tool in the registry. Alternatives: state only the registered servers. Why: the plan says to state it if measured, and the wait depends on the same fact. Severity: Low.
- **P1-10-DC-06: The decision log records the registered name, not the plugin and server, and a rebinding session logs its own earlier registration as `skipped`.** Alternatives: log both and treat its own registration as `registered`. Why: the name is what Pi and the steps compare. Re-registering would only replace an identical entry. Severity: Low.
- **P1-10-DC-07: I did not update the `fallow-ignore` marker count in `.planning/codebase/CONVENTIONS.md` (PATTERNS suggested it).** Its count covers `extensions test scripts`, and the three existing `features/lib` extension markers were never counted. Severity: Low.
- **P1-10-DC-08: I recorded the http MCP flake only in this SUMMARY,** not in `deferred-items.md` or `.planning/WINDOWS.md`. Alternatives: write `deferred-items.md` in the phase directory. Why: sibling plans may write the same file in parallel, and the flake is in an unchanged scenario. Severity: Low.
- **P1-10-DC-09: The seeds install at user scope, as `listing.feature` does.** Alternatives: project scope, which would exercise the stand-in's `.pi/mcp.json` read. Why: a project-scope adapter server needs `pi-mcp-adapter allows project mcp servers for the user`, an adapter-only step that a neutral scenario cannot name. Severity: Low.
- **P1-10-DC-10: The fail-first proof ran a scratch copy of the seed without the neutral wait.** With registration disabled, the wait times out first, which also fails the scenario but in an earlier step. Severity: Low.

## Self-Check: PASSED

- FOUND: features/lib/builtin-mcp-stand-in/extension.ts, features/lib/builtin-mcp-stand-in/servers.ts
- FOUND: ee12a0f, cfa6282 (ancestors of HEAD)
- Acceptance: `registerMcpServer` 1, `builtinMcpServerName` 2 in the stand-in; `mcpServers` 1 in snapshot.ts (baseline 0); the builtin seed passes; one `@adapter-only` and one `@builtin-only` seed besides the four `@own-implementation` seeds; `npm run check:features` passes.

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
