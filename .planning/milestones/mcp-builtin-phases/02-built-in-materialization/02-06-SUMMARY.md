---
phase: 02-built-in-materialization
plan: "06"
subsystem: mcp
tags: [mcp, pi-builtin-mcp, lifecycle, cucumber, autoapply]
status: complete

requires:
  - phase: 02-built-in-materialization
    provides: "plan 02-01: builtinRegistrationStep, resyncBuiltinRegistrations, the tool-search calls step"
  - phase: 01-foundation-and-pi-1-5-0
    provides: "the dual cucumber profiles, the mcp implementation steps, the new-session setup step"
provides:
  - "features/mcp-server/lifecycle.feature lifted: eight @adapter-only adapter scenarios, seven @builtin-only twins, one @adapter-only new-session scenario"
affects: [02-08, 02-09]

actuals:
  tokens: 3300
  tasks: 3
  commits: 3
plan_head_before: c82df303c092c1fbb3319409c1c82e8bdded0e04
plan_head_after: 90a2090629bee10c0f6e78bdfde72a7270891d8f

tech-stack:
  added: []
  patterns:
    - "A next-session effect is a Given (`the user has started a new pi session`) followed by the registry listing When"

key-files:
  created: []
  modified:
    - features/mcp-server/lifecycle.feature

key-decisions:
  - "The new-session scenario is @adapter-only, not @mcp: under Pi's built-in MCP, Pi 1.5.0's RPC new_session emits session_start twice and the built-in MCP leaves the first connection's stub running past the profile Pi, which the frozen HAR-05 stand-in check reports"
  - "The built-in enable twin enables with `which did not fail`: under the builtin profile the enable result warns `requires pi-mcp-adapter` (the read-time verdicts, Pitfall 9)"

requirements-completed: [BLT-06]

coverage:
  - id: D1
    description: "Enabling a disabled plugin registers its server in the next session; the stub receives exactly one initialize"
    requirement: BLT-06
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#Enabling a disabled plugin registers its server again under Pi's built-in MCP (BLT-06)"
        status: pass
  - id: D2
    description: "A plugin disabled during a session keeps its server for that session; disabled or uninstalled, the next session has no server and no tool"
    requirement: BLT-06
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature (three @builtin-only BLT-06, D-MB-10 scenarios)"
        status: pass
  - id: D3
    description: "After an update the next session runs the new declaration (v2:echo:ping); a published change without an update does not (echo:ping)"
    requirement: BLT-06
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature (two @builtin-only update scenarios)"
        status: pass
  - id: D4
    description: "A plugin autoapply installs during a load is registered in that session by the resync"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#A plugin that autoapply installs during a load registers its server in the same session (BLT-01, D-MB-10)"
        status: pass
  - id: D5
    description: "A new session registers the plugin's server again and Pi offers its tool"
    requirement: BLT-01
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#A new session offers the plugin's tool again (BLT-01) (adapter profile only)"
        status: partial

duration: 1h
completed: 2026-11-04
---

# Phase 2 Plan 06: MCP server lifecycle under Pi's built-in MCP Summary

**`lifecycle.feature` loses its file-level `@adapter-only`: the eight adapter scenarios keep every step, and seven built-in twins show that enable, disable, uninstall, and update change a plugin's servers in the next session, that a published change reaches no session without an update, and that an autoapply install is registered in its own load. The new-session scenario runs under the adapter only, because of a Pi 1.5.0 RPC defect.**

## Performance

- **Duration:** about 1 h
- **Completed:** 2026-11-04T15:05Z
- **Tasks:** 3 of 3
- **Files:** 1 modified (plus the `.planning/WINDOWS.md` entry)

## Accomplishments

- The Background no longer installs. Each of the eight adapter scenarios installs first, in the strict form, and carries `@adapter-only`. The description cites BLT-06, D-MB-10, D-08-01, and D-08-02.
- `@builtin-only` scenarios:
  - Enable registers the server again. The stub log holds one `initialize`, then `notifications/initialized`, `tools/list`, and `tools/call` (`{"name":"echo","arguments":{"text":"ping"},"_meta":{"progressToken":3}}`). One `initialize` shows that the resync after the load opened no second connection.
  - Disable during a session: the server stays registered in that session.
  - Disable, or uninstall, then a new session: no registered server and no plugin tool.
  - Update: the next session's call returns `v2:echo:ping`.
  - Published change without an update: the call returns `echo:ping` (MREC-01).
  - Autoapply: `{ "autoapply": true }` in the user local layer and `fixtures`/`demo` in the user base layer. Pi starts, the server is listed, and `plugin_demo_stub` is registered. Only the resync after `loadReconcile` can register it, because no record exists at session_start.
- `A new session offers the plugin's tool again (BLT-01)` passes under the adapter profile. See Deviation 1.

## Task Commits

1. **Task 1: lift the file, built-in enable twin** - `a78a45d` (test)
2. **Task 2: disable and uninstall reach the next session, new session** - `f2bd313` (test)
3. **Task 3: update, published change, autoapply resync** - `90a2090` (test)

## Red runs

Each red run changed the working tree only. `git checkout HEAD -- extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts` restored the file each time, and `git status` showed only the feature file afterwards. Nothing reverted or reduced was committed.

- **Task 1, builtin, seed step file** (`git show 87d3f28:...builtin-registration-step.ts`): 1 scenario, 1 failed. The enable twin failed at `Given the mcp implementation has listed the tools of the stub mcp server "stub" of the plugin "demo"` with `the builtin mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`.
- **Task 2, builtin, seed step file**: 4 scenarios, 4 failed, all at the same listing wait with the same message. The four are the enable twin and the three new disable and uninstall scenarios.
- **Task 2, builtin, enabled filter removed** (extra, discriminating: `enabledRecords` also kept disabled records): 1 of 4 failed. `A plugin disabled during a session has no server in the next session ...` failed at `Then pi lists these registered mcp servers:`, because it listed `plugin_demo_stub`.
- **Task 3, builtin, seed step file**: 7 scenarios, 7 failed, all at the listing wait with the same message. These include the two update twins (lines 206 and 272) and the autoapply scenario (line 408).
- **Task 3, builtin, only the body of `resyncBuiltinRegistrations` reduced to `return Promise.resolve();`**: 7 scenarios, 6 passed, 1 failed. The autoapply scenario failed at the listing wait with `the builtin mcp implementation did not finish listing the tools of demo/stub: {"requests":[],"running":[]}`. So the session_start registration alone does not pass this scenario. Only the resync does.

## Verification

- Builtin profile, `features/mcp-server/lifecycle.feature`: 7 of 7 scenarios and 96 of 96 steps passed (seed 808686).
- Adapter profile, the same file: 9 of 9 scenarios and 131 of 131 steps passed (seed 494400). These are the eight adapter scenarios and the new-session scenario.
- `npm run check:static` passed before each commit: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features.
- Acceptance greps:
  - Line 1 is `Feature: MCP server lifecycle`.
  - `@adapter-only` appears 9 times at scenario level. The plan expected 8; the new-session scenario adds 1 (Deviation 1).
  - The strict install line appears 9 times.
  - `comm -23` against the `87d3f28` file prints nothing.
  - `the user has started a new pi session` appears 3 times.
  - `v2:echo:ping` appears 2 times and `"autoapply": true` once.
  - `@builtin-only` appears 7 times.
  - `@mcp` appears 0 times. The plan expected at least 1 (Deviation 1).
- Pitfall 10: the next-session scenarios also state `pi offers these plugin mcp tools:` with no rows. No tool of the earlier session remains in the new session.

## Deviations from Plan

### Blocked items

**1. [Rule 3 - Blocking, frozen fix] The new-session scenario is `@adapter-only`, not `@mcp`**
- **Found during:** Task 2
- **Issue:** Under the builtin profile, the planned `@mcp` scenario passed every step but failed in the After hook with `these stand-in processes outlived the profile Pi` (one `mcp-stub-<pid>.pid`). Temporary debug output (reverted, never committed) showed three `initialize` sequences in the stub log: one for the first session and two for the new session. The cause is in Pi 1.5.0:
  - `rpc-mode.js` `new_session` calls `runtimeHost.newSession()`. Its `finishSessionReplacement` already runs `rebindSession`, and then the RPC case runs `rebindSession()` again. So `bindExtensions` emits `session_start` twice.
  - The `session_start` handler of Pi's built-in MCP (`extensions/mcp/index.js`) replaces `servers` and starts new connections without closing the earlier ones. So the first connection of the new session is lost.
  - At `session_shutdown`, Pi closes only the second connection. The lost stub exits within 3 s of Pi's exit, when its stdin closes. The HAR-05 check in `world.ts` runs at once and sees it still running.
  The plan's flagged assumption ("the sync is idempotent, so the scenarios hold either way") holds for the extension's sync but not for Pi's built-in MCP. The disable and uninstall next-session scenarios pass because no server is registered in the new session.
- **Fix:** The scenario keeps its implementation-neutral steps. It carries `@adapter-only` and a comment that names the cause. The fix belongs in frozen harness files (see Parent lines), and a `.planning/WINDOWS.md` `unmet-truth` entry tracks it.
- **Files modified:** `features/mcp-server/lifecycle.feature`
- **Commit:** `f2bd313`

### Auto-fixed Issues

**2. [Plan-allowed] The enable in the built-in twin uses `which did not fail`**
- **Found during:** Task 1
- **Issue:** Under the builtin profile, `/claude:plugin enable demo@fixtures --scope user` returns a warning cascade with the reason `requires pi-mcp-adapter`. This is the read-time verdict that a later plan changes (Pitfall 9). The disable, uninstall, and update results were info, but the update twins use `which did not fail` as the plan says.
- **Fix:** `Given the user has run "/claude:plugin enable demo@fixtures --scope user", which did not fail`.
- **Commit:** `a78a45d`

**3. The built-in `tools/call` row has `_meta.progressToken` 3**
- Pi's built-in client sends `{"_meta":{"progressToken":3}}` with the call. The row states it as the run shows it, and it was the same in every run of this plan, since the connection makes the same requests before the call each time.

## Parent lines

- `features/support/world.ts` / `features/lib/turn-records.ts` (frozen harness): `assertStandInsStopped` runs at once after `pi.stop()`. A stand-in that Pi lost track of exits only when its stdin closes, a moment after Pi exits. Either poll briefly, for example up to the listing poll interval times a few, before the check fails, or make `startSession` (`features/lib/pi-commands.ts`) avoid the RPC double bind. Then lift `A new session offers the plugin's tool again (BLT-01)` in `features/mcp-server/lifecycle.feature` from `@adapter-only` to `@mcp`, and close the matching WINDOWS.md entry.
- Upstream Pi (report, not a repo edit): RPC `new_session` emits `session_start` twice (`modes/rpc/rpc-mode.js`, with `AgentSessionRuntime.finishSessionReplacement`), and the built-in MCP `session_start` handler does not close the connections of an earlier `session_start` in the same runtime.
- `.planning/phases/02-built-in-materialization/02-06-PLAN.md` flagged assumption 2 says "the scenarios hold either way". That is false for Pi's built-in MCP when a server stays registered across `new_session`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-02-24 is shown by the next-session scenarios: the registry is empty after a disable or an uninstall, and the enabled-filter red run fails. T-02-25 is shown by the published-change twin, whose call returns `echo:ping`.

## Dubious Choices

**DC-A: `@adapter-only` on a scenario whose expectation is implementation-neutral**
- **Choice:** Keep the new-session scenario and run it under the adapter profile only, with a comment that names the Pi defect.
- **Alternatives:**
  - (a) Drop the scenario until the harness is fixed.
  - (b) Keep `@mcp` and let the builtin profile fail.
  - (c) Edit the frozen harness.
- **Why dubious:** The tag rule says `@adapter-only` means the expectation holds only under pi-mcp-adapter. Here the expectation holds under both. A harness and Pi defect blocks only the built-in run. The BLT-01 reload half under Pi's built-in MCP is unproven end to end until the Parent line lands. The registration path is the same one the session_start scenarios already prove.
- **Severity:** Medium.

**DC-B: The red runs for disable and uninstall fail at the listing wait, not at their own Then**
- **Choice:** Use the seed step file as planned, and add one discriminating mutation (the enabled filter removed) for the disable next-session scenario.
- **Alternatives:** Add mutations for the uninstall scenario too.
- **Why dubious:** No mutation of the registration step can make the uninstall next-session scenario fail at its Then. The new runtime has an empty registry, and the record is gone. The scenario guards the record removal, which the uninstall ledger owns.
- **Severity:** Low.

## Self-Check: PASSED

- `features/mcp-server/lifecycle.feature` exists and holds the scenarios listed above.
- Commits `a78a45d`, `f2bd313`, and `90a2090` are ancestors of HEAD.
