---
phase: 05-stop-continuation-and-hook-failures
plan: "01"
subsystem: hooks-bridge
status: complete
tags: [hooks, stop, agent_before_settle, asyncRewake, cucumber]
requires: []
provides:
  - "beforeSettleHandlerFor: Stop on agent_before_settle with a hidden continuation draft"
  - "HooksRuntime.takeStopEnding / openStopBoundary / closeStopBoundary / recordRewakeSent"
  - "features/lib/run-start-probe.ts (RUN_START_PROBE_EXTENSION, RUN_STARTS_LOG)"
affects:
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
tech-stack:
  added: []
  patterns:
    - "Boundary handler returns { entries: [...event.entries, draft], continue: true } or undefined, never continue: false"
    - "Stop boundary cell in the runtime, opened and closed around the Stop bucket in a finally"
key-files:
  created:
    - features/lib/run-start-probe.ts
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - test/platform/pi-api.test.ts
    - test/bridges/hooks/runtime.test.ts
    - test/bridges/hooks/settle.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - test/architecture/hooks-lifecycle.test.ts
    - test/architecture/closed-set-enrollment.test.ts
    - test/index.test.ts
    - features/step_definitions/hook/prompt-and-stop.steps.ts
    - features/hook/prompt-and-stop.feature
    - features/step_definitions/hook/async.steps.ts
    - features/hook/async.feature
    - features/step_definitions/plugin/subagent-hooks.steps.ts
    - features/plugin/subagent-child.feature
decisions:
  - "Stop runs on agent_before_settle in every mode through one handler; agent_settled runs StopFailure only (D-PG5-01, D-PG5-03)."
  - "The boundary reads the stop reason from the agent_end cache through takeStopEnding, never from event.outcome or event.context (D-PG5-03)."
  - "A wake sent while the Stop boundary is open sets the D-BG-210 mark through recordRewakeSent, called after sendMessage returns (D-PG5-06)."
metrics:
  duration: "~45 min"
  completed: 2026-11-14
estimate:
  tokens: 144000
actuals:
  tokens: 32100
  tasks: 3
  commits: 3
plan_head_before: dbc49cd82efd73258b32a4e4111e24777c16b56d
plan_head_after: 5be4072fa686945c72575e57ab77ec7020873a98
---

# Phase 5 Plan 01: Stop Continuation on agent_before_settle Summary

A blocking `Stop` hook now continues the run it ended: the bridge runs the Stop bucket on Pi's `agent_before_settle` event and returns the event's entries plus one hidden `claude-hook-stop-block` `custom_message` with `continue: true`. A run that a Stop hook blocks twice now raises one `agent_settled` and one `before_agent_start`, and the model gets three calls.

`actuals.tokens` is chars/4 over the realized diff `dbc49cd8..5be4072f` (128,405 characters). The plan estimate counted reading and test runs as well, so the two numbers measure different things.

## Commits

| Task | Commit | Title | Files |
|------|--------|-------|-------|
| 05-01-01 | `434c7da4` | test(hooks): count run starts and guard a rewake during stop hooks | 5 (harness and features only) |
| 05-01-02 | `7262390e` | fix(hooks): continue a blocked stop run on agent_before_settle | 16 |
| 05-01-03 | `5be4072f` | docs(hooks): name agent_before_settle as the stop fire point | 3 (comments only) |

Every commit went through the real hook (`npm run check:commit` reported Passed in the pre-commit pass). Node v26.13.1, Linux.

## Task 05-01-01: probe and guard on the unchanged production tree

- `git diff --quiet HEAD -- extensions test` gave exit 0 before the commit.
- `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-and-stop.feature features/hook/async.feature` gave exit 0: 26 scenarios (26 passed), 395 steps. It ran twice, before and after the clone refactor below (seeds 507065, 625316).
- The cap scenario's new counts row read **9 settlements, 9 run starts, 9 model calls** on the unchanged tree, as predicted. This is the control reading: the probe logs every run start.
- `npm run check:features` gave exit 0.

### What the guard step waits on

The step is `the user prompts {string} and the hook {string} wakes the model while the stop hook {string} runs`. Every wait has a named deadline (`ASYNC_STEP_DEADLINE_MS`, 20 s), and no wait is a fixed sleep:

1. The prompt response is `started`.
2. The first `end` line of the rewake hook (`keep`), through `waitForHookLifecycle`.
3. The rewake summary record (`isRewakeSummaryRecord`), through `waitForRecord`.
4. `releaseWaitingHook(slow)`: it writes the marker, waits until the held hook takes it, then waits for `slow`'s first `end` line.
5. The second `start` line of `slow`, through `lengthsPast` past `slow`'s first end line.
6. It reads the record count, then calls `releaseWaitingHook(slow)` again, past the first end line.
7. `waitForSettleAt` at or after that count. This asserts that the settle was not aborted, and it returns the index after the settle.
8. The second `end` line of `keep`, past its first end line.
9. `waitForHandledExit(second.pid)`: it waits until Pi reaps the process, then makes two `get_state` round trips that must show `isStreaming: false`.
10. It asserts that no `agent_start` record follows the settle, then calls `keepTurn`.

## Task 05-01-02: the move

### Red on the unchanged production tree (step 1)

- `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-and-stop.feature` gave exit 1: 7 scenarios (2 passed, 5 failed). The 5 that failed are the new two-block scenario and the 4 switched scenarios ("Every blocking stop hook's reason...", "A stop hook's additional context...", the cap scenario, and the tool-reset scenario). In each one the turn ended after the first run: one Stop run, one model call. The two-block scenario first fails at `the hooks record these runs:`.
- `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature` gave exit 1: 19 scenarios (18 passed, 1 failed). The failure is "A main session still runs its lifecycle hooks", at `the hooks record these runs:`.

### Green after the move (tree of `7262390e`)

| Command | Exit | Result |
|---|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/settle.test.ts test/bridges/hooks/runtime.test.ts test/bridges/hooks/event-router.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/platform/pi-api.test.ts test/index.test.ts` | 0 | 582 tests, 582 pass |
| `node --import ... --test test/architecture/hooks-lifecycle.test.ts` | 0 | 6 pass (13 stale and 13 live registrations) |
| `npm run test:coverage:direct -- <settle, runtime, event-router, registry, pi-api>` | 0 | 100% direct coverage for all five sources |
| `npm run test:cucumber:profile -- --profile adapter features/hook/prompt-and-stop.feature features/hook/async.feature features/hook/stop-failure.feature features/hook/matchers.feature` | 0 | 66 scenarios (66 passed), 862 steps |
| `npm run test:cucumber:profile -- --profile adapter features/plugin/subagent-child.feature` | 0 | 19 scenarios (19 passed) |
| `npm run test:cucumber:profile -- --profile builtin features/plugin/subagent-child.feature` | 0 | 14 scenarios (14 passed) |
| `node scripts/install-test-peers.mjs && node --import ... --test test/integration/pi-subagents-child-identity.test.ts` | 0 | 6 tests, 6 pass |
| `npm run check:features` (inside the commit hook) | 0 | passed |

The cucumber and integration runs ran on the final production code of the commit. After them only test files changed, and the owner tests and direct coverage above were run again on those test files. `features/lib/real-subagent-child.ts` needed no change. Neither feature in the stop-failure or matchers files needed an edit.

### The guard after the move

- The guard passed green inside the 66-scenario run, with the text task 05-01-01 gave it. Its feature, its step module, and the probe are not in `7262390e`.
- Negative control: I removed `runtime.recordRewakeSent();` from `wakeOnExitTwo` in the working tree only and ran `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature:298`. It gave exit 1, `AssertionError: the model was called past its script`, 16 steps (11 passed, 4 skipped, 1 failed). I then restored the file and confirmed with `cmp` that it is byte-identical to the committed text.

### New step texts

- `Given pi runs with the scripted model and counts its run starts` (prompt-and-stop.steps.ts)
- `Then the stop sequence has these counts:`, with the columns `agent settlements | run starts | model calls` (prompt-and-stop.steps.ts)
- `When the user prompts {string} and the stop hooks continue the run`, with a 120 s step timeout and a 110 s `STOP_CONTINUATION_DEADLINE_MS` (prompt-and-stop.steps.ts)
- `When the user prompts {string} and the hook {string} wakes the model while the stop hook {string} runs` (async.steps.ts)

Removed: `the user prompts {string} and the stop hooks send the turn back`, `the user prompts {string} through {int} agent settlements`, and `the user prompts {string} in pi's startup session and the stop hooks send the turn back`. `promptInStartupSession` now waits for one settlement and has no `settlements` parameter.

### Runtime operations

`takeStopEnding()`, `openStopBoundary()`, `closeStopBoundary()`, and `recordRewakeSent()`. `prepareSettleForRegistration` also closes the boundary. The counters and `STOP_OVERRIDE_CAP` did not change.

## Task 05-01-03

`node --import ... --test test/architecture/closed-set-enrollment.test.ts test/bridges/hooks/payloads/stop.test.ts test/domain/components/hook-events.test.ts` gave exit 0: 39 tests, 39 pass. The diff of `5be4072f` changes comment lines only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Clone groups in the guard step**
- **Found during:** Task 05-01-01, first commit attempt (`fallow dupes`, 2 groups, both in async.steps.ts).
- **Issue:** The guard's prompt send duplicated the "while the tool runs" step, and its tail duplicated the "wakes the model once" step.
- **Fix:** I added `SentPrompt`, `sendPrompt` (which `promptToSettle` now calls), and `keepTurnWokenOnce` (now used by the "wakes the model once" step too), and `waitForSettleAt` now returns the index after the settle. I added no suppression marker. Both features were re-run green afterwards.
- **Commit:** `434c7da4`

**2. [Rule 2 - Correctness] The guard waits for Pi to handle the last exit**
- The guard step calls `waitForHandledExit(second.pid)` before it checks for `agent_start`, as its analog step does. The plan's wait list does not name this wait. Without it, a second wake that Pi has not handled yet could go unseen. The negative control shows the guard turns red.

**3. [Rule 1 - Coverage] A stale-generation settle case**
- Case E of settle.test.ts moved to the boundary handler, which left the generation guard of `settleHandlerFor` uncovered (branches 96/97). I added "a stale settle handler runs no StopFailure hook and leaves the cached ending".

**4. [Rule 1 - Obsolete case] The send-failure case of settle.test.ts**
- "a send failure is contained and a later input starts a clean run" tested the removed `sendMessage` path. It is now "a Stop continuation sends no message through Pi (D-PG5-01)". With a `sendMessage` that throws, the boundary still resolves to the whole continuation, so no Stop path calls it.

**5. [Rule 3 - Blocking] Lint and typecheck in the task 2 commit hook**
- Three cases left `sent` unused, and two lines needed padding. I fixed them by adding `assert.deepStrictEqual(sent, [])` and blank lines, then committed again. No `--amend`.

**6. Small choices left to the executor**
- The probe logs `{ messageType }` on each line. The plan asked for "one JSON line" and did not say what it holds.
- The comment of `REENTERED_TURNS_DEADLINE_MS` was rewritten, because the constant now serves only the steer and follow-up steps.
- The rule that a stale-generation boundary handler is inert is proven by the 13-registration stale slice of `test/architecture/hooks-lifecycle.test.ts`, not by a new router case. I added a dedicated router case for the child boundary (no hook runs, the cache is left).

## Flagged assumptions

- **PG-HOOK-02 / unclassified edge (unresolved):** the cases of D-PG5-01 to D-PG5-07 are in the owner tests: a block; context alone; two hooks; `continue: false` beside a block; an empty bucket; `length` and `error` at the boundary; a boundary skipped before settle; a second settle with no `agent_end`; a stale generation at entry and after the bucket; a rejected mode; an executor that rejects; the ninth block; each reset of the count; a wake inside and outside the boundary; a wake whose send fails; a child session. The verifier keeps or clears this flag.
- **A1 (open, not measured):** a follow-up typed while a Stop hook runs may lose its `UserPromptSubmit` context when the bucket does not continue.
- **A2, A5 (open):** I did not measure them. This plan does not depend on them.
- **A6 (open):** every run here was on Linux.
- **F3 (resolved):** a wake inside the boundary now sets the mark. The guard proves it, red without the mark and green with it.
- **Another extension at the boundary:** a later handler that replaces `entries` or returns `continue: false` wins. The bridge adds no code for that (D-PG5-05). Plan 05-06 documents it.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-01 (cap of eight on the boundary) and T-05-02 (rewake mark) are mitigated, with owner cases and scenarios. T-05-05 holds: the handler returns `[...event.entries, draft]` and never `continue: false`.

## Parent-owned edits needed (orchestrator)

1. PROJECT.md amendments 1, 2, and 5 of 05-CONTEXT.md "Parent lines for the orchestrator" (the `agent_settled` fire-point row, the D-CF5-25 row, and the D-PG2-11 row).
2. `.agents/skills/cucumber/rules/layout.md`: two changes.
   - It says `prompt-and-stop.steps.ts` holds "the Stop re-entry `When`". The module now holds the Stop continuation `When`, the run-start `Given`, and the counts `Then`.
   - Add the new library `features/lib/run-start-probe.ts` to its harness lists.
3. `.planning/codebase/CONVENTIONS.md`: the count of `fallow-ignore` markers goes up by one (`unused-export` on the default export of `features/lib/run-start-probe.ts`), and with it the `unused-export` count and the list of harness extensions.
4. `.planning/codebase/ARCHITECTURE.md` (optional): the hooks bridge now registers 13 `pi.on` call sites, and Stop runs on `agent_before_settle`.
5. `test/live-uat/stop-canary.mjs` still asserts one `agent_settled` for each block. Plan 05-06 owns it.

## Self-Check: PASSED

- FOUND: features/lib/run-start-probe.ts
- FOUND: 434c7da4, 7262390e, 5be4072f (each an ancestor of HEAD)
- `git rev-list --count dbc49cd8..5be4072f` = 3
