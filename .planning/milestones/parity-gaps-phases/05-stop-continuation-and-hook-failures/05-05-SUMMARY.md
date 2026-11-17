---
phase: 05-stop-continuation-and-hook-failures
plan: "05"
subsystem: hooks-bridge
status: complete
tags: [hooks, async, timeout, reload, cucumber]
requires:
  - "05-01 (registry.ts as it stands after the Stop move)"
provides:
  - "INERT_TIMER_LADDER (exec-timer.ts): a TimerLadder that sets no timer"
  - "ladderFor (registry.ts, module-private): the lane choice of a background child's timer"
affects:
  - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
tech-stack:
  added: []
  patterns:
    - "Lane choice before the spawn returns a function that installs the ladder after the spawn, so the order of calls and debug lines stays as it was"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
    - test/bridges/hooks/exec-timer.test.ts
    - test/bridges/hooks/async-rewake/registry.test.ts
    - features/hook/async.feature
decisions:
  - "A plain async hook gets INERT_TIMER_LADDER and no timer; a declared timeout writes one `async-hook:` debug line, and resolveTimeoutSeconds is not called for it (D-PG5-17)."
  - "The timeout scenario's hook exits 3, not 0, because a hook that SIGTERM ends also logs `end` with exit code 0 (measured; see Deviations)."
metrics:
  duration: "~40 min"
  completed: 2026-11-14
estimate:
  tokens: 54000
actuals:
  tokens: 5300
  tasks: 2
  commits: 2
plan_head_before: aa32faf772321401041e7abd923db2b6fe4c5df4
plan_head_after: b3c05c9df97e8d7e74d22951a40472c916598358
---

# Phase 5 Plan 05: No Timer for a Plain Async Hook Summary

A plain `async` hook now runs until it ends, with no timeout, as in Claude Code 2.1.323. Its declared `timeout` is ignored with one debug line. An `asyncRewake` hook, and a hook with both flags, keeps its declared `timeout`, or 600 seconds, and the SIGTERM and SIGKILL ladder. A reload and the reap of a later load still stop a plain `async` hook.

`actuals.tokens` is chars/4 over the realized diff `aa32faf7..b3c05c9d` (21,195 characters). The plan estimate counted reading and test runs as well.

## Commits

| Task | Commit | Title | Files |
|------|--------|-------|-------|
| 05-05-01 | `6e47f30a` | feat(hooks): run a plain async hook past its declared timeout | 6 |
| 05-05-02 | `b3c05c9d` | test(hooks): prove a reload still stops a plain async hook | 2 (test and feature only) |

Both commits went through the real hook: `npm run check:commit` reported Passed on the first attempt each time. Node v26.13.1, Linux.

## Task 05-05-01

### Production change

- `INERT_TIMER_LADDER` in exec-timer.ts: `cancel` does nothing, `fired` returns false.
- `ladderFor(entry, lane)` in registry.ts runs where `resolveTimeoutSeconds` ran before, after `planSpawn` and before the spawn. For `rewake` it calls `resolveTimeoutSeconds` with the same arguments and returns `(child) => installTimerLadder(child, seconds, label)`. For `plain` it writes `async-hook: timeout <json> ignored (<plugin>/<event>); a plain async hook runs until it ends` when `handlerDecl.timeout` is not undefined, and returns `() => INERT_TIMER_LADDER`. `spawnAndRegister` calls the returned function on `hookProcess`, so its complexity did not grow.
- The file header and the `detached` comment now say that only an asyncRewake hook's ladder signals the group. timeout.ts changes comment lines only.
- Unchanged, as `git diff aa32faf7 HEAD` shows: `finalizeChild`, `EXIT_HANDLERS`, the PID-table and journal code, `stopUnrecordedChild`, the three `ladder.cancel()` calls of the child listeners, and bridges/hooks/runtime.ts (0 diff lines).

### Marker check

The `fallow-ignore-next-line code-duplication` marker in the child `error` listener did not move: the edit did not touch that span. `npx fallow dupes --quiet` gave exit 0.

### Red on the unchanged production tree

The plan's scenario, with the hook's exit code 0, **passed on the unchanged tree** (`npm run test:cucumber:profile -- --profile adapter features/hook/async.feature:261`: exit 0, 1 scenario passed, 15 steps, seed 57347). I then measured the fixture script in the scratchpad. It is `#!/bin/sh` (bash on this host). When the ladder sends SIGTERM to the group, the `sleep` and the shell die, and bash runs the EXIT trap with `$?` equal to the status of the last command that finished, the recorder's `start` line, which is 0. So a killed hook and a hook that ends on its own both log `end` with exit code 0. See Deviation 1.

With the hook's exit code set to 3, the red run on the unchanged production tree gave exit 1: 1 scenario (1 failed), 15 steps (13 passed, 1 skipped, 1 failed), seed 678073. It failed at `Then the hook processes record these lifecycle events:` with actual `slow | end | 0` against expected `slow | end | 3`. The ladder ended the hook at 1 second, before its own `exit 3`.

### Green (tree of `6e47f30a`)

| Command | Exit | Result |
|---|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/exec-timer.test.ts test/bridges/hooks/async-rewake/registry.test.ts test/bridges/hooks/timeout.test.ts` | 0 | 167 tests, 167 pass |
| `npm run test:coverage:direct -- <exec-timer.ts, registry.ts, timeout.ts>` | 0 | 100% direct coverage for all three |
| `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature` | 0 | 21 scenarios (21 passed), 325 steps, seed 372778 |
| `npm run check:features` | 0 | passed |
| `npx tsc --noEmit -p .`, `npx eslint <the five .ts files>`, `npx fallow dupes --quiet` | 0 | clean |

"A background hook process that ignores SIGTERM stops at its timeout" passed in the 21-scenario run with its expectations unedited.

### Owner cases added

- exec-timer.test.ts: the inert ladder reports `fired()` false before and after two `cancel()` calls.
- registry.test.ts, under mocked timers (`observeTimers`), with no real timer waited on:
  - a plain hook with `timeout: 1` receives no signal after 6 seconds, sets no `setTimeout` handle, and its runtime entry's ladder reports `fired()` false;
  - a plain child's `error` finalizes it (the registry forgets it), sends no answer, and a later `exit` and `close` send nothing;
  - debug lines for a declared `timeout: 1` (one ignored-timeout line), no timeout (none), and `"soon"` (the ignored-timeout line only, not the unusable-timeout line of `resolveTimeoutSeconds`);
  - an `asyncRewake` hook and a hook with both flags receive SIGTERM at 1,000 ms and not at 999 ms, and their ladder reports `fired()` true;
  - an `asyncRewake` hook with no timeout receives SIGTERM at 600,000 ms, not at 599,999 ms, with the line `exec-timer: SIGTERM after 600s`.
- The existing cases "gives a plain async hook's answer to the next call after exit 2 / exit 0 / a signal / plain stdout" now run on the inert ladder and prove that exit and close still send the answer.

### What each step of "A plain async hook runs past its declared timeout" waits on

- `Given` steps: setup only; no step waits on time.
- `When the user prompts "say done" and 1 background hook runs finish`: waits for the prompt's `started` response, then for the settle record of the prompt (`waitForSettleAt`), then reads the logs until one hook run and one `end` lifecycle line exist, until its deadline `ASYNC_STEP_DEADLINE_MS` (20 s). The poll interval `ASYNC_POLL_MS` is a poll, not a wait for an elapsed time.
- `Then` steps compare what the logs and the model calls hold.

No step waits for an elapsed time. The hook's own `sleep 3` owns the time. After the change no timer exists, so a slow machine only moves the `end` line later inside the 20-second deadline.

## Task 05-05-02

### Scenario "Reloading Pi stops a plain async hook that is running"

It is "Reloading Pi stops its waiting hook processes" with the column `async` in place of `async rewake`. Green on the tree of `b3c05c9d`: `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature` gave exit 0, 22 scenarios (22 passed), 338 steps, seed 336576. `npm run check:features` gave exit 0.

### Working-tree red run

I made `killOrphanGroup` return before it signals, in the working tree only, and ran `npm run test:cucumber:profile -- --profile adapter features/hook/async.feature:432`. It gave exit 1: 1 scenario (1 failed), 13 steps (12 passed, 1 failed), seed 971469. It failed at `Then no hook process is running` with `AssertionError: these hook processes are still running`, actual `[1186856]`. The step reached its own 10-second deadline; no timer of the test failed it. I restored the file from a copy, `git diff --quiet` on it gave exit 0, and `ps` showed that the process 1186856 had ended after the harness cleanup.

### What each step waits on

- `Given the user has started pi in the terminal and the hook "wake" goes on in the background`: waits for the `start` lifecycle line of `wake` that the log gained after the terminal Pi started (`TERMINAL_STARTUP_RUN_TIMEOUT_MS`, 30 s; step timeout `PROFILE_PI_START_TIMEOUT_MS`, 90 s), then checks that the process of that line runs.
- `When the user reloads pi in the terminal and then prompts "after the reload" with the hooks recording`: waits for Pi's reload-done text (`DEFAULT_RELOAD_MS`, 20 s), then for the `UserPromptSubmit` run of the typed prompt (`TERMINAL_PROMPT_RUN_TIMEOUT_MS`, 20 s).
- `Then the hooks record these runs:` compares the runs.
- `Then no hook process is running`: waits until the process of each pid file exits (`HOOK_EXIT_TIMEOUT_MS`, 10 s, polled every 50 ms).

No step waits for an elapsed time. The waiting script gives up only after 60 seconds (`RELEASE_TENTHS` 600), six times the last step's deadline, so the pass cannot come from the hook ending on its own.

### Owner cases added

- `shutdownInMemoryChildren` sends a plain child (`timeout: 1`, inert ladder) SIGKILL: the child's signals are `["SIGKILL"]`, the registry no longer holds it, and `pidTableEntries` is empty.
- `reapOrphans` of a fresh runtime (a later load) on Linux stops the plain child that the first runtime recorded in the PID table: the probe signals are `[[24720, 0], [-24720, "SIGKILL"]]`, and the child itself received no direct signal.

No case showed a plain child that is not stopped, so task 05-05-02 changed no production code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Measurement] The timeout scenario's hook exits 3, and its `end` line reads 3**
- **Found during:** Task 05-05-01, the first red run.
- **Issue:** The plan's scenario (`exit code` 0, `end | 0`) passed on the unchanged tree. The fixture's EXIT trap logs `$?` of the last finished command, so a hook that SIGTERM ends at 1 second also logs `end` with exit code 0. The research had flagged this as not measured.
- **Fix:** The hook row adds `exit code | 3`, and the lifecycle table expects `slow | end | 3`. The script reaches its own `exit 3` only if nothing kills it during `sleep 3`. A plain `async` hook's exit code changes nothing the user or the model sees (`EXIT_HANDLERS.plain` sends the answer for any code). This makes the must-have truth "logs its end with exit code 0" read "logs its end with the code it exits with, 3". The fixture harness (`features/lib/hook-files.ts`) is not in this plan's file list, so I did not change the trap.
- **Files modified:** features/hook/async.feature
- **Commit:** `6e47f30a`

**2. Small choices left to the executor**
- The plain-lane debug line uses the `async-hook:` prefix that `sendAsyncAnswer` uses for the plain lane, and `JSON.stringify` for the value, as `resolveTimeoutSeconds` prints an unusable value.
- The lane choice runs before the spawn and returns the installer. This keeps the order of calls and debug lines of the rewake lane as it was: the unusable-timeout line is still written before the spawn, and a spawn that throws still follows it.
- The new owner cases sit at the top level of each test file, as the existing cases of both files do, and are not wrapped in `describe()` blocks.
- The registry tests save and restore `PI_CLAUDE_MARKETPLACE_DEBUG` the way the file's existing cases do (`t.mock.property` cannot mock an absent `process.env` key).

## Flagged assumptions

- **PG-HOOK-21 / unclassified edge (unresolved):** the owner cases cover a declared, an absent, and an unusable `timeout`; a hook with both flags; an `asyncRewake` hook with and without a `timeout`; the exit and close (existing plain cases) and the error of a plain child; the reload walk; the reap of a later load. An unrecorded child (`stopUnrecordedChild`) did not change and has no new plain-lane case. The verifier keeps or clears this flag.
- **D-PG5-18 (pending maintainer review):** outside Linux the reap cannot prove that a live process is the hook, so nothing stops a plain `async` hook that never ends. The reload scenario proves the Linux reap only. Plan 05-06 states the residual in the compatibility page.
- **What the red run shows (now measured):** a hook that SIGTERM ends logs an `end` line, and its exit code is the trap's `$?`, which is 0 here. Deviation 1 records the consequence.
- **ASYNCLIFECYCLE-01 and ASYNCRELOADTABLE-01** stay open. Neither new scenario failed once and passed on a second run.
- Every run here was on Linux, Node v26.13.1.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-18 is accepted as decided: a plain `async` hook now runs as long as its process runs, and a reload and the reap still stop it on Linux. T-05-19 holds: `finalizeChild`, the exit handlers, and the PID-table and journal code are unchanged, and the two owner cases of task 05-05-02 show that the reload walk and the reap still stop a plain child. T-05-SC: no package was installed or changed.

## Parent-owned edits needed (orchestrator)

1. PROJECT.md amendment 4 of 05-CONTEXT.md: append to the D-BG-205 row "Amended by D-PG5-17: a plain `async` hook has no timeout ladder; an `asyncRewake` hook keeps it."
2. BACKLOG.md, ASYNCRELOADTABLE-01: add that a plain `async` hook has no timer after D-PG5-17, so outside Linux nothing stops one that never ends.
3. BACKLOG.md: a new line for `async` hooks left running when a print or json run ends.
4. `.agents/skills/cucumber/rules/world-and-stand-ins.md` (about line 143) still says a plain `async` hook with `waits` blocks its prompt; since D-BG-205 it does not (`features/hook/async.feature`, "A plain async hook goes on running after the prompt that started it").
5. The must-have truth of PG-HOOK-21 and success criterion 5 say "with exit code 0". The scenario measures exit code 3 (Deviation 1). If VALIDATION.md or the ROADMAP criterion quotes exit code 0, the wording needs the same change.
6. Optional ledger entry, which I did not write because the dispatch limits my writes: `gsd-tools windows append --kind deviation --phase 05 --file features/hook/async.feature --description "[parity-gaps] the plain async timeout scenario expects exit code 3, not 0: the fixture's EXIT trap logs 0 for a hook SIGTERM ends"`.
7. Wave 2 combined-tree gate: run `npm run check` once every plan of wave 2 has landed. This plan did not run it, as the dispatch said.

## Self-Check: PASSED

- FOUND: 6e47f30a, b3c05c9d (each an ancestor of HEAD)
- `git rev-list --count aa32faf7..b3c05c9d` = 2
- FOUND: `INERT_TIMER_LADDER` in exec-timer.ts (1) and registry.ts (2); `D-PG5-17` in registry.ts (2) and timeout.ts (1); "plain async hook" in async.feature (4); `Scenario` in async.feature (22)
