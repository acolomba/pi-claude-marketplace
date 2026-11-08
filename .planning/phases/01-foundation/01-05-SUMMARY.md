---
phase: 01-foundation
plan: 05
subsystem: testing
tags: [cucumber, harness, hooks, async-rewake, pi-rpc, pi-tui]

requires:
  - phase: 01-foundation
    provides: "01-02: PiProcess.crash(), ScenarioWorld.crashPi(), and restartPi(\"after-crash\") (ASYNC-04)"
provides:
  - "Hooks table columns async, async rewake, rewake message, rewake summary (handler fields), and waits (script column, gives up after 60 s)"
  - "Lifecycle hooks: a script hook that sets async, async rewake, or waits writes <harness dir>/hook-<name>-<pid>.pid and logs start and end (with exit code) to hook-lifecycle.jsonl"
  - "hook-recorder.ts: HOOK_LIFECYCLE_LOG, HookLifecycleEvent, the --lifecycle mode, waitForHookLifecycle"
  - "hook-files.ts: readHookScriptPids"
  - "Ten steps: background prompt (When and Given), release (When and Given), terminal start with a background hook, crash, restart after crash, lifecycle events, no hook process, rewake summaries"
  - "Seeds: features/hook/async.feature, five scenarios (ASYNC-01, ASYNC-02, ASYNC-03, ASYNC-04 crash, ASYNC-04 reload)"
affects: [phase 2 hook async stream, 01-08 frozen record]

actuals:
  tokens: 10910
  tasks: 3
  commits: 3
plan_head_before: 5419a9d121783a227b042d3d4b2ae53fb99e4755
plan_head_after: 04e6ae1ee2ab1412faf829ebe8d2d6a59ad9aa1e

tech-stack:
  added: []
  patterns:
    - "A hook script that outlives its event logs its end from an EXIT trap, so every exit path records the code it exits with"
    - "A wait on a harness log polls at 50 ms up to a named deadline (waitForHookLifecycle), never a fixed sleep"

key-files:
  created:
    - features/hook/async.feature
  modified:
    - features/lib/hook-files.ts
    - features/lib/hook-recorder.ts
    - features/step_definitions/hook/prompt-and-stop.steps.ts
    - features/step_definitions/hook/session.steps.ts
    - features/step_definitions/hook/runs.steps.ts
    - features/step_definitions/hook/messages.steps.ts

key-decisions:
  - "The crash seed installs in the user scope: the product's startup reap never reads the project-scope PID table, so a project-scope seed fails (blocker finding for Phase 2)"
  - "The /reload seed starts its waiting hook on SessionStart startup, because a UserPromptSubmit hook would start again on the reload step's own prompt"
  - "Then no hook process is running fails when no hook pid file exists, so it cannot pass while checking nothing"
  - "The rewake summaries step compares whole payloads (info, no reload), with only the text stated"

requirements-completed: [FND-01]

coverage:
  - id: D1
    description: "An async rewake hook runs in the background: its prompt settles while the script waits, and the recorder logs its start (ASYNC-03 seed)"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/hook/async.feature#An async rewake hook goes on running after the prompt that started it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Releasing the hook logs its end with exit code 2 and shows the user its rewake summary (ASYNC-02 seed)"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/hook/async.feature#An async rewake hook shows the user its summary when it exits"
        status: pass
    human_judgment: false
  - id: D3
    description: "An exit-2 async rewake hook's message and stderr reach the model's next call as a user row (ASYNC-01 seed)"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/hook/async.feature#An async rewake hook that exits 2 puts its message into the model's next call"
        status: pass
    human_judgment: false
  - id: D4
    description: "A dead Pi's hook process survives the crash and the next start stops it; a /reload stops a waiting hook (ASYNC-04 seeds)"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "features/hook/async.feature#A hook process that a dead Pi left stops when Pi starts again"
        status: pass
      - kind: e2e
        ref: "features/hook/async.feature#Reloading Pi stops its waiting hook processes"
        status: pass
    human_judgment: false
  - id: D5
    description: "Existing hooks tables write the same hooks.json and scripts as before"
    requirement: FND-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/hook (92 scenarios)"
        status: pass
      - kind: other
        ref: "npm run typecheck; npm run lint; npm run fallow; npm run check:features"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-11-08
status: complete
---

# Phase 1 Plan 05: Async Hook Harness Summary

**The hooks table can now declare async rewake hooks whose scripts wait for a release. A script that outlives its event writes a pid file and logs its start and its exit code. New steps send a prompt past such a hook, release it, crash and restart Pi, and check the summary the user sees, the message the model gets, and that no hook process remains. Five seeds in `features/hook/async.feature` pass. Writing them found a product gap: the next start of Pi does not stop the hook processes that a dead Pi left in the project scope.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-11-08T03:22:15Z
- **Completed:** 2026-11-08T03:51:28Z
- **Tasks:** 3
- **Files modified:** 7 (1 created)

## Accomplishments

- `hook-recorder.ts` has a lifecycle mode. `--lifecycle start|end <hook> <pid> [<code>]` appends one line to `hook-lifecycle.jsonl` in one write. The line holds only those values: the lifecycle mode reads no stdin and records nothing of the environment (T-1-12). `waitForHookLifecycle` polls the log every 50 ms up to a named deadline.
- `hook-files.ts` has five new columns. `async`, `async rewake`, `rewake message`, and `rewake summary` become the handler fields `async`, `asyncRewake`, `rewakeMessage`, and `rewakeSummary`. `waits` (`true`, script forms only) makes the script poll for `$HOME/hook-releases/<name>` every tenth of a second, and give up after 60 seconds (T-1-11).
- A script hook that sets `async`, `async rewake`, or `waits` is a lifecycle hook. Right after recording, it writes `<harness dir>/hook-<name>-<pid>.pid` (through a temporary file and `mv`) and logs `start`. An EXIT trap logs `end` with the exit code and removes the pid file. Every other hook writes the same script as before. The printed scripts were compared, and all 92 hook scenarios pass.
- `once` now uses a shared `parseBoolean`, which the new boolean columns use too.
- The background prompt step waits for `agent_settled` and the hook's start line, in either order. It asserts the hook has not ended, and it makes the same fault and past-script checks as the other prompt steps. `checkedRun` now owns those checks, and `recordRun` keeps the turn.
- The release step creates the marker. It waits for the hook's `end` line, then for the `async-rewake-summary` entry, and asserts that no fault happened. It runs through `recordSessionAction`.
- The crash step calls `crashPi()` and asserts that some hook pid file exists and that every process it names still runs. The restart step calls `restartPi("after-crash")`. It keeps the new session's results and skills, checks the new Pi's records for faults, and keeps those records and the log lines the restart added as the last turn.
- `Then no hook process is running` reads only `hook-*.pid` files and waits up to 10 seconds for each process to exit.

## Final step texts

- `When the user prompts {string} and the hook {string} goes on in the background` (`hook/prompt-and-stop.steps.ts`)
- `Given the user has prompted {string} and the hook {string} goes on in the background` (`hook/prompt-and-stop.steps.ts`)
- `When the user releases the hook {string} with the hooks recording` (`hook/session.steps.ts`)
- `Given the user has released the hook {string}` (`hook/session.steps.ts`)
- `Given the user has started pi in the terminal and the hook {string} goes on in the background` (`hook/session.steps.ts`, added for the `/reload` seed)
- `Given pi's process has died, leaving its hook processes running` (`hook/session.steps.ts`)
- `When the user starts pi again with the hooks recording` (`hook/session.steps.ts`)
- `Then the hook processes record these lifecycle events:` with columns `hook | phase | exit code` (`hook/runs.steps.ts`)
- `Then no hook process is running` (`hook/runs.steps.ts`)
- `Then the hooks show the user these rewake summaries:` with column `text` (`hook/messages.steps.ts`)

## Seeds and red proofs

All five pass under the adapter profile. None carries an MCP implementation tag (D-BG-05). After every run, `pgrep -f "[/]hooks/wake.sh"` printed nothing, except after the two red proofs noted below.

**ASYNC-03: "An async rewake hook goes on running after the prompt that started it".** The prompt `say done` settles. The `wake` run is recorded, the lifecycle log holds one `wake | start` line, and the model gets one call.
- Red proof: with `async rewake` set to `false`, the background `When` fails with `function timed out, ensure the promise resolves within 30000 milliseconds`. The hook now runs on the synchronous path, so Pi answers the `prompt` request only after the hook returns, and the step's 30-second timeout fires before the step's own 20-second deadline. Restored.

**ASYNC-02: "An async rewake hook shows the user its summary when it exits".** After the release, the lifecycle log holds `wake | end | 2`, and the user sees the rewake summary `wake finished`.
- Red proof: with no rewake summary, the release `When` fails with `no matching record within 19794 ms` after the end line arrived. Restored.

**ASYNC-01: "An async rewake hook that exits 2 puts its message into the model's next call".** Call 2 holds the rows `user: say done`, `assistant: Done.`, `user: next`, and then `user: The hook woke the model.\n\nwoke up`. Pi delivers the rewake as a user row after the new prompt.
- Red proof: with exit code `0`, the calls table fails, because the rewake row is missing. Restored.

**ASYNC-04, crash: "A hook process that a dead Pi left stops when Pi starts again".** The install is in the user scope (see Issues). The session reports no results.
- Red proof 1: with the crash `Given` calling `this.pi.stop()` (a group kill) instead of `crashPi()`, the `Given` fails with `these hook processes were gone after pi died`. Restored.
- Red proof 2: without the restart `When`, `Then no hook process is running` fails with `these hook processes are still running`, and the scenario's release fails too. This run left the hook running, and I killed it. Restored.

**ASYNC-04, reload: "Reloading Pi stops its waiting hook processes".** The product does stop a waiting async hook on `/reload`. The waiting `wake` hook runs on `SessionStart` `startup` in the terminal Pi. The reload step's prompt is recorded by `marker`, a UserPromptSubmit hook that exits 2, and no hook process is running afterwards.
- Red proof: with `await tui.reload()` removed from the reload step, which leaves a plain terminal prompt, the `Then` fails with `these hook processes are still running`. Restored.

## Task Commits

1. **Task 1: Run an async rewake hook in the background and record its start** - `743451b6` (test). Tracer gate: the `<verify>` was run again after the commit, and it passed (17 scenarios, check:features clean).
2. **Task 2: Release an async hook and show its summary and its rewake** - `20bd45e4` (test)
3. **Task 3: Seed the stop of hook processes at a dead Pi's restart and at /reload** - `04e6ae1e` (test)

**Plan metadata:** the docs commit that carries this SUMMARY, STATE.md, and ROADMAP.md.

## Files Created/Modified

- `features/lib/hook-recorder.ts` - lifecycle mode, `HOOK_LIFECYCLE_LOG`, `HookLifecycleEvent`, `waitForHookLifecycle`, and a shared `appendHarnessLine`
- `features/lib/hook-files.ts` - five columns, lifecycle and release script lines, `readHookScriptPids`, `parseBoolean`
- `features/step_definitions/hook/prompt-and-stop.steps.ts` - background prompt `When` and `Given`; `checkedRun` split from `recordRun`
- `features/step_definitions/hook/session.steps.ts` - release, terminal background start, crash, and restart steps
- `features/step_definitions/hook/runs.steps.ts` - lifecycle events and no-hook-process steps
- `features/step_definitions/hook/messages.steps.ts` - rewake summaries step; `turnPayloads` replaces `turnNotices`
- `features/hook/async.feature` - created, five seeds

## Decisions Made

- The pid file is written through `<file>.tmp` and `mv`, so a reader never sees a partial pid.
- The end line comes from an EXIT trap rather than from a line before `exit`, so the `on reentry` early exit also logs it.
- The ASYNC-03 seed also states the model's calls, which shows that the prompt reached the model while the hook waited.
- The `/reload` seed installs in the user scope, as the existing terminal reload scenario in `session.feature` does.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Steps landed with their first seed, not in their task's commit**
- **Found during:** Task 1
- **Issue:** `check:features` fails on an unused step, and the plan says to stage each new step with the seed that uses it. The background `Given` has no user until Task 2. `readHookScriptPids` has none until Task 3, and fallow would report it as an unused export.
- **Fix:** the `Given` went into Task 2's commit, and `readHookScriptPids` into Task 3's. `readHookLifecycle` stays module-private, because only `waitForHookLifecycle` uses it.
- **Committed in:** `20bd45e4`, `04e6ae1e`

**2. [Rule 3 - Blocking] The `/reload` seed starts its hook at the terminal Pi's start**
- **Found during:** Task 3
- **Issue:** a UserPromptSubmit hook would start a new waiting process on the reload step's own prompt, so the `Then` could never pass.
- **Fix:** `wake` runs on `SessionStart` `startup`, and Pi runs no SessionStart on reload (D-CF5-03). A `marker` UserPromptSubmit hook that exits 2 records the prompt. A new terminal `Given` (`the user has started pi in the terminal and the hook {string} goes on in the background`) waits for the start line and checks that the process runs, as the plan allows ("add its terminal Given form").
- **Committed in:** `04e6ae1e`

**3. [Rule 1 - Bug in a seed's precondition] The crash seed installs in the user scope**
- **Found during:** Task 3
- **Issue:** with the project-scope install of the Task 1 setup, the restart does not stop the hook, and `Then no hook process is running` fails (pid 1180682 still ran `wake.sh`, with its dispatch marker in its environment). This is a product gap. See Issues Encountered.
- **Fix:** the seed installs in the user scope, where the restart's reap works. The project-scope behavior is left for Phase 2 to pin. No product code was edited.
- **Committed in:** `04e6ae1e`

---

**Total deviations:** 3 (2 Rule 3, 1 Rule 1). **Impact:** one extra step, one changed seed setup, and a product gap that this plan reports and does not fix.

## Issues Encountered

- **Product gap (ASYNC-04 blocker for Phase 2): the next load does not stop hooks that a dead Pi left in the project scope.** `extensions/pi-claude-marketplace/index.ts:153` registers the hooks bridge with `{ cwd: homedir() }`. `reapOrphans` runs only inside that registration (`bridges/hooks/event-router.ts:1077`, over `hydrateCacheFromDisk`). So its project-scope `loc` is `locationsFor("project", homedir())`, not the project Pi runs in. `hydrateProjectScopeForCwdWith` (`event-router.ts:769`), the later project hydrate, reaps nothing. A project-scope async rewake hook that a crashed Pi left therefore runs until it ends by itself. I ran the crash seed with a project-scope install and confirmed the failure, then with a user-scope install and confirmed that it passes. ASYNC-04 has no scope qualifier, so Phase 2 must fix this in the product or record a licensed divergence. Every step it needs exists: the project-scope scenario is the committed crash seed with `--scope project`.
- The session's worktree guard refuses commands whose text it cannot verify, so the edits and the red-proof feature copies ran from scripts in the scratchpad.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 2 can cover ASYNC-01 to ASYNC-04 with these columns and steps. The limits it should know about:

- **Project-scope reap:** see Issues. This needs product work, not harness work.
- **Release needs a summary:** the release steps wait for the `async-rewake-summary` entry, so a released hook must declare a `rewake summary`. A Phase 2 scenario that releases a hook without one cannot use these steps. The plan dictated this, and the frozen file would have to change to lift it.
- **Release in the terminal:** the release steps read the profile Pi's RPC records, so they cannot release a hook that a terminal Pi started.
- **ASYNC-05, plain `async: true`:** the column exists, but the product takes the background path only for `asyncRewake: true` (`dispatch-exec.ts`). Plain `async: true` with `waits` blocks the prompt request, as the Task 1 red proof shows, so the background prompt step cannot pin it. A divergence scenario can use `sleep` instead of `waits`.
- **A second prompt starts the hook again:** in the ASYNC-01 seed, `next` starts a second waiting `wake`. The profile Pi's release stops it, and the stand-in check confirms that it exited.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-1-11: the release wait gives up after 60 seconds. Every lifecycle hook writes a pid file that the profile Pi's release check reads, and no seed's hook script remained after the runs. T-1-12: a lifecycle line holds only the hook name, the pid, the phase, and the exit code, and the run line keeps its `CLAUDE_*` rule (T-01-31).

## Dubious Choices

- **Crash seed in the user scope (High):** the plan's setup is project scope. A project-scope seed fails because of the product gap, and a red seed would break the wave gate. The user-scope seed proves the steps and the reap that works, and this SUMMARY reports the project-scope gap as a blocker. The alternative was to stop the task and commit no crash seed at all.
- **`/reload` seed on SessionStart (Medium):** the plan suggested a terminal prompt that starts the hook. That cannot work, because the reload step's own prompt would start a new waiting hook. The seed still proves that `/reload` stops a waiting async hook.
- **New terminal `Given` (Low):** it is the eleventh step, beyond the plan's list. The plan allows a terminal `Given` form.
- **No-hook-process step fails on zero pid files (Low):** the plan does not say this. Without it, the step passes when nothing started.
- **Rewake summaries compare whole payloads (Low):** the plan says the step compares texts. The step also requires severity `info` and needs reload `false`, so a wrong severity fails it.
- **EXIT trap for the end line (Low):** the plan says the script logs the end "just before it exits". A trap does that on every exit path. A script killed by a signal logs no end line, and its pid file stays behind with a dead pid.
- **`once` now uses `parseBoolean` (Low):** a small refactor of an existing parser, so the three boolean columns share one parser. The error text is unchanged.
- **Extra model-calls `Then` in the ASYNC-03 seed (Low):** the plan lists only the runs and lifecycle steps. The extra step shows that the prompt reached the model.
- **Release and crash checks red-proved by temporary step edits (Low):** the crash and reload red proofs edited the step file in place, and the edits were reverted. The other red proofs ran from feature copies in the scratchpad.

## Self-Check: PASSED

- FOUND: `features/hook/async.feature`, and every modified file listed above
- FOUND: commits `743451b6`, `20bd45e4`, `04e6ae1e` on `features/behavioral-gaps` (3 commits since `5419a9d1`)
- Acceptance criteria: `async.feature` starts with `Feature: Hook async`; `hook-lifecycle` is in `hook-recorder.ts`; `hook-releases` is in `hook-files.ts`; five scenarios pass; the ASYNC-01 calls table holds the rewake as a user row of call 2; `pgrep -f "[/]hooks/wake.sh"` is empty after the runs
- Plan verification: `npm run test:cucumber:profile -- --profile adapter features/hook` (92 scenarios passed), `npm run check:features`, `npm run typecheck`, `npm run lint`, and `npm run fallow` all pass

---
*Phase: 01-foundation*
*Completed: 2026-11-08*
