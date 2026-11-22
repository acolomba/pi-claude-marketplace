---
phase: 06-hooks-and-auth
reviewed: 2026-11-22T14:07:58Z
depth: standard
iteration: 3
files_reviewed: 4
files_reviewed_list:
  - features/lib/turn-records.ts
  - features/lib/hook-files.ts
  - features/step_definitions/hook/session.steps.ts
  - features/support/world.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
  necessity: 0
status: issues_found
---

# Phase 6: Code Review Report (iteration 3, final)

**Reviewed:** 2026-11-22T14:07:58Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found (info only)

## Summary

Scope: the iteration-2 fixes `d6136f4`, `1c6e3ff`, and `5dc92b2` (`git diff eda4a23 HEAD -- features/`), read in full context. No product code changed. I did not re-run `npm run check`, because it is already running on this tree.

The three findings in scope are fixed. No blocker or warning remains. The four info items are the two carried by decision (IN-01, IN-04) and two new narrow ones (IN-05, IN-06). Neither new item is a regression in a path that scenarios use today.

**WR-01 (a line in flight at a turn boundary) is fixed.**

- I ran the fixer's repros against `HEAD` and against `fix-06b/before/`. I checked that `before/`'s `turn-records.ts` and `hook-files.ts` are byte-identical to `eda4a23`.
  - `lost-line-concurrent-repro.ts`: before prints `turn N: [] turn N+1: [] FAIL (line in 0 turns)`, exit 1. HEAD prints `turn N: [["hook-runs.jsonl",[{"event":"Stop"}]]] turn N+1: [] ok (line in 1 turns)`, exit 0.
  - `partial-line-finishes-repro.ts`: before prints `FAIL [["hook-runs.jsonl",[{"a":1}]]]`. HEAD prints `ok [... {"a":1},{"b":"unfinished"}]`.
  - My iteration-2 `lost-line-repro.ts` and the research `partial-line-repro.ts` (lines that never finish) now throw `... ends in a line whose write never finished`, after 1.1 s wall time. That is the loud failure the orchestrator accepted.
- The new loop in `finishedLogLines` (`turn-records.ts:82-93`) is correct:
  - It waits only when the first read saw a partial line, and only until `complete` grows past the first read's count.
  - A baseline taken while line X was partial counts X. A close read that then waits for X slices it off at `lengths`, so X stays in the earlier window.
  - A shrinking or rewritten file stays at or below the count, so it ends at the deadline with the loud message. It never loops forever.
  - Inside `Promise.all`, a rejection from one log leaves the other polls to settle against handlers that are already attached, so no unhandled rejection follows.
- Cost per turn: none in practice. Every harness writer appends a whole line in one call. I checked `appendFileSync` and `appendFile` in `hook-recorder.ts:106`, `scripted-model/extension.ts:256`, the MCP, Device Flow, and probe stand-ins, and `run-start-probe.ts:22`. So a partial line is visible only for the span of one `write(2)`. A writer that never finishes fails after 1 s. Before this fix, `assertStandInsStopped`'s partial-line check (iteration 1) already failed that case at release, so it fails earlier now, not differently.
- What remains is by design: a line whose write starts after a close read's first read and before the next baseline belongs to no turn. That includes a second line that starts during the 1-s wait. It is the same gap as any line logged wholly between two `When` steps. The docstring's "exactly one turn" claim covers lines whose write began before the read, and that claim holds.

**IN-02 (group scan errors, wrong fallback target) is fixed.**

- `processGroupOf` (`hook-files.ts:686-698`) returns `undefined` only on ENOENT or ESRCH.
- The scan's `carriesMarker` catch (`:713-720`) treats only ENOENT, ESRCH, and EACCES as "not marked".
- `registeredHookMatch` returns `"leader" | "group" | "none"`. `stopRegisteredHookProcess` (`:770-779`) falls back to `kill(pid)` only for `"leader"`.
- I re-ran `fix-06/zombie-group-repro.ts` (leader in state `Z`) and `fix-06/reaped-group-repro.ts` (leader reaped) on HEAD. Both print `child killed: ok`.
- The new kill throws do not fail a release in a normal race:
  - A leader that exits and is reaped between the match and the kill gives ESRCH on `kill(-pid)`. The fallback `kill(pid)` then gives ESRCH, and both return `false`.
  - A group that empties between the scan and the kill gives ESRCH, with no fallback.
  - On Linux, `kill(-pgid)` gives EPERM only when it can signal no member of the group. For both `"leader"` and `"group"`, the code has just read a same-user member's environ, so EPERM needs that member to exit and an other-user member to stay.
- See IN-05 for two narrow paths that now throw, and for what a throw skips.

**IN-03 (startup wait counts any run; inner waits equal the step timeout) is fixed.**

- `recordTerminalAction` (`hook/session.steps.ts:158-168`) reads one baseline. It passes that baseline to its action and uses it again for the closing read. So the start step's `waitForStartupRun`, the reload step's `waitForRun`, and the turn's logs all measure from the same point.
- The quit step's action ignores the argument, and its type still checks.
- The non-scripted `Given` (`:367-376`) now reads its baseline before `startTuiSession()`. `profileHarness()` already asserts that a profile Pi started, and the background `Given` (`:380-399`) uses the same order.
- The scripted start step's timeout is now `SCRIPTED_TERMINAL_START_TIMEOUT_MS` = 60 s + 30 s + 10 s = 100 s. That is above its inner deadlines. The 10 s also covers the up to 1 s that the last `waitForRun` poll can run past its deadline because of the partial-line wait, plus the closing read's own 1-s bound. The exported `SCRIPTED_TUI_READY_MS` (`world.ts:132`) has a doc comment, as the cucumber rule on named timeouts asks.
- The non-scripted `Given` waits 15 s (`DEFAULT_READY_MS`) plus 30 s, inside its 90 s timeout.
- The fixer verified the adapter profile only (`2267 scenarios (2267 passed)`). The running `npm run check` also runs the builtin profile, which covers the stricter baseline in the two terminal `Given` steps.

Out of scope as decided: `fallow audit` `weakened-tests`, HOOK-E2E-04 pinning today's documented drop, and the print-mode `apply` silence (a documented Pi gap). IN-01 and IN-04 are carried open by decision.

## Narrative Findings (AI reviewer)

## Info

### IN-01: One launch shape has three names, and the print output type is written out again (carried, open by decision)

**File:** `features/support/world.ts:220-231`, `features/lib/pi-one-shot.ts:27-32`, `features/lib/pi-json-mode.ts:20`, `features/step_definitions/command.steps.ts:186-190`
**Issue:** `OneShotPiLaunch` (world) and `OneShotLaunch` (pi-one-shot) are the same interface, kept in sync by hand, each with its own `extensions` doc comment. `JsonModeLaunch` is only an alias. `printModeOutput` spells out `{ exitCode; stdout; stderr }` instead of using `OneShotOutput`.
**Fix:** Have `oneShotPiLaunch()` return `OneShotLaunch` and delete `OneShotPiLaunch`. Drop `JsonModeLaunch`. Annotate `printModeOutput(...): OneShotOutput`.

### IN-04: The reload step reuses any terminal Pi the scenario started, scripted or not (carried, open by decision)

**File:** `features/step_definitions/session.steps.ts:148-166`, `features/support/world.ts:1001-1003`
**Issue:** The step reuses `this.startedTuiSession()`, which returns any TUI. That includes one that `startTuiSession()` started with the default `"none"` model. A future scenario that combines such a TUI with this reload would wait for a scripted reply that never comes, and it would time out with a misleading message. No current scenario does this.
**Fix:** Have the world record the model each TUI started with, and make the reload step fail at once when the reused TUI is not scripted.

### IN-05: A throw while stopping one registered hook aborts the rest of the release, and the leader's EACCES throws while a member's EACCES counts as "not marked"

**File:** `features/lib/hook-files.ts:815-833` (`stopHookScripts`), `:730-749` (`registeredHookMatch`), `:756-766` (`killIfPresent`)
**Issue:**
- **A throw skips the remaining cleanup.** `1c6e3ff` makes `stopRegisteredHookProcess` throw on any kill error other than ESRCH, and on any scan error other than the listed codes. That is the loud failure IN-02 asked for. But `stopHookScripts` stops the entries one by one, sequentially. If one entry throws, the remaining entries of that scope and of the other scope are never stopped. Neither are the pid-file scripts (`:827-833`), and `assertStandInsStopped` never runs. The scenario fails, as it should. But a waiting script that is still running can take the release marker of a later scenario in the same emptied sandbox home. The function's own doc comment (`:808-810`) names exactly that risk. So the later scenario fails with a message that does not point here.
- **The two EACCES cases disagree.** If `entry.pid` was reused by another user's process, `carriesMarker(entry.pid)` fails with EACCES. `registeredHookMatch` rethrows it (`:748`), so the release fails. In the group scan, the same EACCES counts as "not marked" (`:715`). Both mean the same thing: the process is not the hook, because the hook runs as the harness user and its environ is readable. The leader rule predates this iteration, and iteration 2 described it without objection. But the new scan rule makes the asymmetry visible. `pid_max` on this host is 32768, so a wrap within a scenario is unlikely but possible.

Both need rare conditions: PID reuse by another user, EMFILE, or EPERM from a group whose only same-user member just exited. Neither affects a scenario today.
**Fix:**
- Stop every entry and every pid-file script first, collect the errors, and throw one `AggregateError` at the end:
  ```ts
  const errors: unknown[] = [];
  for (const scopeRoot of scopeRoots) {
    for (const entry of await registeredHookProcesses(scopeRoot)) {
      await stopRegisteredHookProcess(entry).catch((error: unknown) => errors.push(error));
    }
  }
  // ... pid-file kills as today ...
  if (errors.length > 0) {
    throw new AggregateError(errors, "the release could not stop every registered hook process");
  }
  ```
- In `registeredHookMatch`, return `"none"` for EACCES on the leader, with the same comment as the scan.

### IN-06: The hooks-recording terminal reload step's inner waits exceed its default step timeout (pre-existing, same class as IN-03)

**File:** `features/step_definitions/hook/session.steps.ts:564-582`
**Issue:** The step `the user reloads pi in the terminal and then prompts {string} with the hooks recording` sets no timeout, so it runs under the 30 s `STEP_TIMEOUT_MS` (`world.ts:93`). Its inner waits are `tui.reload()` (`DEFAULT_RELOAD_MS`, 20 s, `pi-tui.ts:28`) plus `TERMINAL_PROMPT_RUN_TIMEOUT_MS` (20 s, `:97`). Together that is 40 s. The comment at `:95-96` ("stays below the step timeout") holds for one wait alone, not for both. A slow reload followed by a slow run fails as a bare cucumber step timeout, without either wait's message. This predates the phase: the constant dates from `bdbb5f2`. `5dc92b2` touched the step only to pass the baseline, so this is not a regression. I list it because it is the IN-03 defect in the step next door.
**Fix:** Give the step a named timeout above the sum, as `SCRIPTED_TERMINAL_START_TIMEOUT_MS` does. For example, `TERMINAL_RELOAD_PROMPT_TIMEOUT_MS = DEFAULT_RELOAD_MS + TERMINAL_PROMPT_RUN_TIMEOUT_MS + 10_000`, which needs `DEFAULT_RELOAD_MS` exported from `pi-tui.ts`. Or lower the two inner waits so that their sum stays under 30 s.

---

_Reviewed: 2026-11-22T14:07:58Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
