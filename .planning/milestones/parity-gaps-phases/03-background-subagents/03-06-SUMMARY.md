---
phase: 03-background-subagents
plan: "06"
subsystem: hooks
tags: [hooks, subagents, identity, pi-subagents, cucumber, integration]
requires:
  - phase: 03-background-subagents
    provides: Child identity on all three tool payloads (03-03, 03-05), child lifecycle suppression and process ownership (03-01, 03-05), and the multi-session stand-in driver (03-05)
provides:
  - Real-process identity checks for PreToolUse, PostToolUse and PostToolUseFailure in the synchronous, plain async and asyncRewake lanes
  - Stand-in children that carry pi-subagents' agent tag in their system prompt, with scenarios for both prompt modes, escaping, a body tag, siblings, main sessions and missing metadata
  - One maintained real-companion driver (features/lib/real-subagent-child.ts) used by an integration test and by cucumber steps
  - Permanent acceptance of detached and concurrent real pi-subagents children under both MCP implementations
affects: [03-07, 03-08]
actuals:
  tokens: 28973
  tasks: 2
  commits: 4
plan_head_before: 2625f6f92d154fe82b897f6e0a431395dd0f63ed
plan_head_after: 4349dc5eb6302ed4ad0c16e0b2a90d320955b72f
commits: 4
tech-stack:
  added: []
  patterns:
    - A stand-in child gets pi-subagents' agent tag from Pi's own prompt files, `<agent dir>/APPEND_SYSTEM.md` (append mode) or `SYSTEM.md` (replace mode), which Pi reads into the structured sections at start and at a new session.
    - A real-child run builds its own fixture, serves a scripted loopback OpenAI-compatible provider with a dummy key, installs through `/claude:plugin`, and releases idempotently in `finally` and through a caller's release hook.
key-files:
  created:
    - features/lib/real-subagent-child.ts
    - test/integration/pi-subagents-child-identity.test.ts
  modified:
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - features/plugin/subagent-child.feature
    - features/step_definitions/plugin/subagent-hooks.steps.ts
    - features/lib/subagent-hook-session.ts
    - features/support/pi-process.ts
key-decisions:
  - The stand-in writes pi-subagents' exact tag (its escapeXmlAttr, a blank line, the body) into Pi's agent-dir prompt files rather than adding Pi CLI arguments, so no shared launcher changes.
  - The real child's session id is read from the header of the session file pi-subagents records, never from a hook payload, so agent_id is compared against an independent observation.
  - The concurrent case runs pi-subagents' own launch module and session factory in one runner process with the child marker, as its background runner builds a child.
  - The shared Pi's reset removes the harness directory after its new session, because that session's end runs the SessionEnd hooks of the last scenario's plugin.
patterns-established:
  - Real-child observations keep each child session in launch order and name sessions by launch-order ordinal in steps.
requirements-completed: ["PG-HOOK-07a", "PG-AGENT-01"]
coverage:
  - id: D1
    description: Each of the three child tool events carries the captured child identity through the synchronous, plain async and asyncRewake lanes, keeps it after a later capture, and main-session dispatches carry neither field.
    requirement: PG-HOOK-07a
    verification:
      - kind: unit
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Stand-in children name their own agent and session in tool hooks for both prompt modes, an escaped name, an empty body and a body tag; a main session with the tag names no child; a sibling of another agent keeps its own identity; missing or malformed metadata clears the identity, logs the bounded diagnostic and keeps lifecycle suppression.
    requirement: PG-HOOK-07a
    verification:
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature
        status: pass
    human_judgment: false
  - id: D3
    description: The installed pi-subagents 0.88.1 runs detached children of an explicit background agent and an MCP-granted agent under a foreground default, under both MCP implementations; each child's tool hooks carry its actual agent type and session id, it runs no lifecycle hook and completes past a blocking Stop hook; concurrent same-PID sessions in append and replace mode keep distinct identities across repeated prompts and new sessions; a main session keeps its hooks.
    requirement: PG-AGENT-01
    verification:
      - kind: integration
        ref: node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature
        status: pass
      - kind: e2e
        ref: npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature
        status: pass
    human_judgment: false
duration: "about 2 h 10 min from the base commit"
completed: 2026-11-13
status: complete
---

# Phase 03 Plan 06: Real Child Identity Acceptance Summary

**Every child tool hook lane, a tagged stand-in child, and the installed pi-subagents' own detached and concurrent children now prove that a child's tool hooks carry its actual agent type and session id, while it runs no main-session hook.**

## Performance

- Base commit `2625f6f9` (2026-11-13T20:14Z, the resume record). First task commit 2026-11-13T20:32:58Z, last 2026-11-13T21:28:02Z.
- Tasks: 2. Commits: 4 (two task commits and two harness fixes found while verifying).
- Files modified: 8 (2 created). Measured patch: 115,893 characters / 4 = 28,973 estimate-scale tokens.
- Production code: unchanged. Every change is in tests, cucumber steps, features and harness libraries.

## Accomplishments

- `dispatch-exec.test.ts` records real Node hook stdin for the three tool events in the synchronous lane, child and main. `registry.test.ts` does the same for plain async and asyncRewake, a 3 x 2 x 2 matrix. Each case captures another session's identity once the hook process runs, and asserts complete stdin plus `Object.hasOwn` absence for main.
- The stand-in driver (`subagent-hook-session.ts`) writes pi-subagents' exact tag into the prompt section Pi loads, can start a sibling with its own section, and runs a settled turn. New scenarios: "A child tool hook identifies its own agent and session" (append with an empty body, replace with a body, `a&amp;b "q" <x>` decoded once, a second body tag), "A main tool hook has no child identity", "A child keeps its own identity after another session runs", and "Missing child metadata clears the previous identity" (missing and malformed, across a new session, with the diagnostic read from the child's debug log).
- `features/lib/real-subagent-child.ts` resolves pi-subagents and pi-mcp-adapter with `resolveCompanion`, builds a fresh HOME, agent dir, project, marketplace and plugin, and serves a loopback provider with a dummy key. The provider refuses any model other than the scripted one. The driver installs through `/claude:plugin`, and the main Pi's model calls `subagent` without a launch mode. For a detached child, the driver waits for pi-subagents' status, waits for the runner's exit, and reads the child's session id from its session file. For concurrency, it runs pi-subagents' launch and session modules in one runner process. It writes pi-subagents' config only to `extensions/subagent/config.json` under the isolated agent dir. Cleanup is idempotent: it stops the main Pi and the provider, kills every process with the fixture's HOME, and removes the fixture.
- `pi-subagents-child-identity.test.ts`: detached adapter and builtin cases (explicit `background: true` agent with bash and a failing read, `tools:` MCP agent with the stub tool, `asyncByDefault: false`), and a concurrent case (two generations of `demo:alpha` append/empty and `demo:beta` replace/spoof tag with a fork cache key, two concurrent prompts each).
- Two real-child scenarios: "A real background child runs its plugin tool hooks and completes" (`@mcp`, both profiles) and "Concurrent companion children keep separate hook identities" (adapter profile; not an MCP scenario).

## Task Commits

1. **Task 1: Exercise child identity, every execution lane and parent controls** - `52871464` (`test(hooks): prove child identity in every tool hook lane`)
2. **Task 2: Promote detached and concurrent companion probes into permanent acceptance** - `4963f504` (`test(hooks): accept real pi-subagents children as hook evidence`)
3. **Harness fix found during Task 2 verification** - `1b6faa8b` (`test(hooks): clear hook runs the shared pi reset records`)
4. **Harness fix found during Task 2 verification** - `4349dc5e` (`test(hooks): stop real child waits from holding the test process`)

Every commit used the normal hook (`npm run check:commit`); none used `--no-verify` or `--amend`.

## Validation

All runs on Node v26.13.1, final tree `4349dc5e`, unless noted.

| Scope | Command | Result |
|---|---|---|
| Task 1 owner RED | Pre/Post/PostFailure translators made to omit identity in the working tree; the 18 new real-process cases | Exit 1; 9 child cases fail on missing `agent_type`/`agent_id`, the 9 main controls pass. `/tmp/pg3-06-task1-owner-red.log` |
| Task 1 cucumber RED (identity) | Same translator change; the 8 new stand-in scenario rows, adapter | Exit 1; 7 fail at "the hooks record these runs" on missing `agent type`/`agent id`; the main-session control passes. `/tmp/pg3-06-task1-cucumber-red-payload.log` |
| Task 1 cucumber RED (sticky identity) | Capture made to reuse the last known agent type through `process.env` when metadata is missing | Exit 1; both "Missing child metadata" rows fail with `demo:runner` on the new session's runs. `/tmp/pg3-06-task1-cucumber-red-sticky.log` (an in-runtime sticky variant passed, because a new session reloads the extension) |
| Task 2 integration RED (identity) | Translator change | Exit 1; all 3 cases fail on missing `agent_type`. `/tmp/pg3-06-task2-integration-red-identity.log` |
| Task 2 integration RED (lifecycle) | `dispatchesInCurrentSession` forced true | Exit 1; the detached adapter case fails on the child's SessionStart/UserPromptSubmit runs. `/tmp/pg3-06-task2-integration-red-lifecycle.log` |
| Task 2 cucumber RED | Translator change; the two real-child scenarios, adapter | Exit 1; both fail at the hook-runs step. `/tmp/pg3-06-task2-cucumber-red-identity.log` |
| Task 1 owners | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts` | Exit 0; 191 pass, 0 fail/cancelled/skipped. `/tmp/pg3-06-final-owner.log` |
| Task 2 integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/pi-subagents-child-identity.test.ts` | Exit 0; 3 pass, 0 fail/cancelled/skipped, 80 s (39 s, 22 s, 17 s). No fixture directory or owned process left. `/tmp/pg3-06-final-integration.log` |
| Adapter behavior | `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature` | Exit 0; 19 scenarios, 259 steps passed (seed 878094; also seeds 561857, 949819, 709168). `/tmp/pg3-06-final-cucumber-adapter.log` |
| Builtin behavior | `npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature` | Exit 0; 14 scenarios, 185 steps passed (seed 240829; also 167258, 941183). `/tmp/pg3-06-final-cucumber-builtin.log` |
| Static | `npx tsc --noEmit`, ESLint on changed files, `npm run fallow`, `npm run check:features`, `npm run test:corresponding` | All exit 0 before the last commit |
| Wave gate | `npm run check` on the combined tree | Not run here; orchestrator-owned. |

Observed versions: pi-subagents 0.88.1, pi-mcp-adapter 7.0.1, Node v26.13.1.

## Decisions Made

- The stand-in uses Pi's own prompt files for the structured sections. Pi re-reads them only at start and at a new session, so a sibling written after the profile child started does not change the profile child's metadata. The driver restores the sections after a sibling starts.
- The real-child hook step compares every child run (session, event, tool, agent type, agent id) in any order, because concurrent sessions append in any order. The integration test checks the exact order per session. Main-session runs include pi-subagents' notice turns, so the step asserts only that none of them names a child. A separate step compares the main session's six control-prompt runs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared Pi reset leaked a SessionEnd run into the next scenario**
- **Found during:** Task 2 full-feature verification (adapter: 5 of 19 failed on an extra `SessionEnd` row with reason `clear`).
- **Issue:** `Before()` empties the sandbox, then starts a new shared-Pi session. Ending the old session runs the SessionEnd hook of a plugin that the last scenario installed through the shared Pi (D-CF5-26), and its recorder writes into the emptied harness. The startup-session steps read the harness from its start, so they saw that line. This affected the 03-05 scenarios too; the new SessionEnd-declaring scenarios made it frequent.
- **Fix:** Remove the harness directory again right after the reset's new session.
- **Files modified:** `features/support/pi-process.ts` (outside the plan's file list).
- **Commit:** `1b6faa8b`. Seven later full-feature runs passed (adapter ×4, builtin ×3, random seeds).

**2. [Rule 1 - Bug] Driver timers held the test process for 90 s**
- **Found during:** Task 2 integration verification (163 s total for about 80 s of tests).
- **Issue:** The provider's listen wait and the concurrent runner's wait raced a timer that was never cancelled.
- **Fix:** Export the session driver's bounded `within` wait and use it in the driver.
- **Files modified:** `features/lib/real-subagent-child.ts`, `features/lib/subagent-hook-session.ts`.
- **Commit:** `4349dc5e`.

### Other deviations and interpretations

- **Reload/fork/resume:** As in 03-05, the RPC `new_session` stands in for a reload in the stand-in scenarios. The concurrent case covers a fork cache key and a session transition through a second generation of sessions. Pi's RPC `fork` and `switch_session` were not run separately.
- **Trust controls:** No new untrusted-project child scenario was added. The existing child load-time protection scenarios in this feature still pass, and project trust stays covered by `features/plugin/project-trust.feature`, which this plan did not re-run.
- **Concurrent case profiles:** The concurrent scenario is not an MCP scenario, so it runs under the adapter profile only, and the integration concurrent case uses the adapter. The detached case runs under both implementations.
- **MCP agent:** The MCP-granted child makes one successful MCP call. The failing call is the background agent's missing-file read.
- **asyncByDefault:** It is exercised as `false`; both agents still detach through their own launch settings. The `true` default is pi-subagents' own default and runs in the concurrent and stand-in paths unchanged.
- **Fixture root:** The prefix is `pi-cm-features-real-child-`, because `writeAdapterOnboardingSeed` accepts only directories under a `pi-cm-features-` root.

## Issues Encountered

- The sandbox allowed the loopback provider to bind; no environment failure occurred.
- The first real-child test in a cold cache takes about 39 s. The bounds (30 s per start, 90 s per child, 180 s per run) held with room to spare.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The loopback provider, dummy key, environment allowlist and owned-process cleanup are the T-03-13 mitigations; no package was installed (T-03-SC).

## Self-Check: PASSED

- Files exist: `features/lib/real-subagent-child.ts`, `test/integration/pi-subagents-child-identity.test.ts`.
- Commits `52871464`, `4963f504`, `1b6faa8b`, `4349dc5e` are ancestors of HEAD.
- Every plan verify command passed after the commits; each new acceptance check failed for the intended reason with production neutralized.

## Next Phase Readiness

Ready for the wave-4 combined-tree `npm run check`. 03-07 can reuse `runRealSubagentChild` with `asyncByDefault`, agent `background` and `tools` rows, and the concurrent launch table.
