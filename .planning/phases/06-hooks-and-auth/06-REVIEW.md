---
phase: 06-hooks-and-auth
reviewed: 2026-11-22T13:28:15Z
depth: standard
iteration: 2
files_reviewed: 15
files_reviewed_list:
  - features/lib/hook-files.ts
  - features/lib/turn-records.ts
  - features/lib/pi-one-shot.ts
  - features/lib/pi-json-mode.ts
  - features/support/world.ts
  - features/step_definitions/project.steps.ts
  - features/step_definitions/command.steps.ts
  - features/step_definitions/session.steps.ts
  - features/step_definitions/hook/session.steps.ts
  - features/hook/session.feature
  - features/hook/lifecycle.feature
  - features/hook/additional-context.feature
  - features/marketplace/device-flow.feature
  - test/integration/hooks-dispatch-end-to-end.test.ts
  - test/integration/auth-e2e.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
  necessity: 0
status: issues_found
---

# Phase 6: Code Review Report (iteration 2)

**Reviewed:** 2026-11-22T13:28:15Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Scope: the phase diff since `4a01e6d`, with the iteration-1 fixes `355388b..74d1eef`. No product code changed.

**Iteration-1 findings, re-checked:**

- **WR-01 (zombie or reaped leader) is fixed.** I re-ran the fixer's `zombie-group-repro.ts` and `reaped-group-repro.ts` against a tree from `355388b~1` (`git archive`) and against `HEAD`. Before the fix, both print `child still running: FAIL`. After it, both print `child killed: ok`.
  - The ENOENT extension cannot kill an unrelated group on its own. The group kill needs a live member of group `entry.pid` whose environ holds `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<dispatchId>`. The dispatch ID is a `randomUUID()` (`registry.ts:358`), read from this sandbox's PID table.
  - If `entry.pid` was reused, the leader's environ read succeeds without the marker and returns `false`. Linux also never gives out a PID while a live process still uses it as a group ID.
  - What remains is a microsecond scan-to-kill window that needs a full PID wrap, and a single-PID fallback; see IN-02. The scan cost is negligible: it runs only for table entries whose leader is gone, and the table holds only children that Pi still tracks.
- **WR-02 (baseline) is fixed.** `baseline-partial-repro.ts` prints `baseline: FAIL` and `unfinished line at stop: FAIL` on `355388b~1`, and `ok` for both on `HEAD`. `readLogLengths` now counts a trailing partial line, as the base `4a01e6d` did, so `harnessLogWindow` (`support/github-device-flow.ts`) and its slicing readers agree again.
  - Item 2 of the old WR-02 (the end-of-turn read) is still open, and the new baseline makes the two reads disagree about which turn owns a line in flight. See WR-01 below.
- **WR-03 is fixed.** The scenario now states the startup `SessionStart` run of `primer` before the reload. The reload step reuses that same terminal Pi. The three H4 logs (`WR03-H4-{1,2,3}-adapter.log`) each fail at `Then the model receives these calls:`, where call 1 holds `ss-ctx`.
  - The fixer says the hook's output can still trail its logged run. That gap cannot make the green run flaky. `index.ts:116` builds a new hooks runtime on each load, so a write that lands after `/reload` goes to the old runtime's buffer.
  - The other three scenarios that use the reload step (`matchers.feature:223`, `builtin-reload.feature:23`, `config-migration.feature:133`) start no terminal Pi before it, so they keep the old path. Nothing checks that a reused terminal Pi is a scripted one; see IN-04.
- **WR-04 is fixed.** The new step `no result of the command contains {string}` (`command.steps.ts:273`) follows the shape of the existing `the command result contains no absolute sandbox path` step.
  - The WR-04 leak log fails all three scenarios at the new step (`3 scenarios (3 failed)`).
  - The fixer corrected my premise from iteration 1. `recordTable` does not drop unstated columns, because `namesLike` adds them. The real gap was `UNSTATED_FIELDS` (`origin`, `schemaVersion`, `result-rows.ts:31`).
  - `runCommandPayloads` asserts `assertQuiet`, so the payloads are the command's whole visible output in RPC mode.

The fixer's logs record `npm run check:static` and a full adapter run as green: `2267 scenarios (2267 passed)`.

Out of scope as decided: `fallow audit` `weakened-tests`, HOOK-E2E-04 pinning today's drop, and the print-mode `apply` silence. IN-01 is carried open by decision.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A log line in flight at the end of one turn lands in no turn, and the stop check cannot see it

**File:** `features/lib/turn-records.ts:61-92` (`readLogLengths` :61, `readLogLinesSince` :80); consumers include `features/step_definitions/hook/session.steps.ts:133-161` (`recordSessionAction`, `recordTerminalAction`), `features/step_definitions/session.steps.ts:113-132`, `:155`
**Issue:** The two readers now put a half-written line in different windows:
- `readLogLengths` (the baseline at the start of a `When`) counts the partial line, so it belongs to the window before the read.
- `readLogLinesSince` (the final read that closes a turn) leaves the partial line out, so it does not belong to the window that is ending.

A line whose write starts before turn N's final read and ends before turn N+1's baseline is in neither turn. Turn N skips it as partial. Turn N+1's baseline counts it as a complete earlier line. `assertStandInsStopped` does not catch it, because by then the log ends in a newline.

Proof: `/tmp/claude-0/-home-user-pi-claude-marketplace/ba73c1d1-11d2-59e0-b5d6-895ae262ca9f/scratchpad/scripts/lost-line-repro.ts` (run with the checkout root as its argument) prints:
```
turn N: [] turn N+1: [] stop check: passed
```

This is item 2 of iteration-1 WR-02 ("a line still being written is silently left out of the turn"). The fix report does not address it. At the base `4a01e6d`, the final read threw a `SyntaxError`, so this case failed loudly. It has been silent since `b054c45`. `66a3bbc` keeps it silent and adds the baseline half that makes the line belong to no turn.

The risk is real for terminal turns:
- `recordTerminalAction` ends as soon as `waitForRun` sees the `UserPromptSubmit` run (`hook/session.steps.ts:553`).
- Runs that follow it in the same turn race the final read.
- A wrong implementation that adds an extra run at that moment can pass an exact `Then the hooks record these runs` or `no runs` table.
- A correct run that is lost fails with a confusing "missing row" diff, not a "partial line" message.

**Fix:** Make the final read agree with the baseline: a line whose write began before a read belongs to the window that read closes. In `readLogLinesSince`, wait a short bounded time for a trailing partial line to finish, then include it. Fail loudly if it never finishes. The polling callers (`readHookRuns`, `waitForRun`) pass `new Map()` and only gain from this.
```ts
const PARTIAL_LINE_WAIT_MS = 1_000;
const PARTIAL_LINE_POLL_MS = 10;

// The log's lines once its last line has finished, failing when it never does.
async function finishedLogText(file: string): Promise<readonly string[]> {
  const deadline = Date.now() + PARTIAL_LINE_WAIT_MS;
  for (;;) {
    const { complete, partial } = await logText(file);
    if (!partial) {
      return complete;
    }

    assert.ok(Date.now() < deadline, `${file} ends in a line whose write never finished`);
    await new Promise((resolve) => setTimeout(resolve, PARTIAL_LINE_POLL_MS));
  }
}
// readLogLinesSince: const complete = await finishedLogText(path.join(directory, name));
```
`assertStandInsStopped`'s new partial-line check can stay as a last guard.

## Info

### IN-01: One launch shape has three names, and the print output type is written out again (carried, open by decision)

**File:** `features/support/world.ts:220-231`, `features/lib/pi-one-shot.ts:27-32`, `features/lib/pi-json-mode.ts:20`, `features/step_definitions/command.steps.ts:186-190`
**Issue:**
- `OneShotPiLaunch` (world) and `OneShotLaunch` (pi-one-shot) are the same interface, kept in sync by hand.
- The WR-03 fix added `extensions` to both copies, with two separate doc comments.
- `JsonModeLaunch` is only an alias.
- `printModeOutput` spells out `{ exitCode; stdout; stderr }` instead of using `OneShotOutput`.

**Fix:** Have `oneShotPiLaunch()` return `OneShotLaunch` and delete `OneShotPiLaunch`. Drop `JsonModeLaunch`. Annotate `printModeOutput(...): OneShotOutput`.

### IN-02: The group scan treats every read error as "not marked", and a failed group kill after a scan falls back to a PID that is known not to be the hook

**File:** `features/lib/hook-files.ts:684-710`, `:734-748`
**Issue:**
- **Silent read errors.** `processGroupOf` catches every error with a bare `catch`. `groupHoldsMarker` maps every `carriesMarker` rejection to `false` (`:706`). So an `EMFILE` from the unbounded `Promise.all` over `/proc`, or any other unexpected error, skips the kill without a word. That is the failure mode iteration-1 WR-01 was about, made narrower. For the leader, the code throws on any code other than ESRCH or ENOENT, so the scan path breaks that rule.
- **Wrong fallback target.** When the scan finds a marked member, `stopRegisteredHookProcess` sends `kill(-pid)`. If that throws (the group emptied in between), it falls back to `process.kill(entry.pid, "SIGKILL")`. On this path, `entry.pid` was already shown to be a zombie or reaped, so the fallback can only reach a reused PID.

Both need narrow races. Neither can reach a process outside the hook's group unless PIDs wrap within that window.

**Fix:**
- Return `undefined` from `processGroupOf` only on `ENOENT` or `ESRCH`, and treat only those codes, plus `EACCES`, as "not marked" in the scan. Rethrow anything else.
- Have `isRegisteredHookProcess` report whether the leader itself was confirmed, for example `"leader" | "group" | "none"`. Skip the single-PID fallback for `"group"`.

### IN-03: The new terminal start step waits for any startup run in the log, and its inner waits add up to its step timeout

**File:** `features/step_definitions/hook/session.steps.ts:482-492` (helper `waitForStartupRun` :186, `readHookRuns` :165)
**Issue:**
- **Any startup run counts.** `waitForStartupRun` scans the whole log (`readLogLinesSince(harness, new Map())`), not the lines gained since the turn's baseline. In a scenario where the profile Pi already logged a `SessionStart` `startup` run, the step returns at once, and the reload can overtake the terminal Pi's own run. That would contradict the step's comment ("a later reload cannot overtake it"). Today the turn's exact `Then the hooks record these runs` table would catch this loudly, and the HOOK-E2E-04 scenario installs the hook after the profile Pi started, so it is not affected.
- **No margin for the inner deadlines.** The step's inner waits, `SCRIPTED_TUI_READY_MS` (60 s) plus `TERMINAL_STARTUP_RUN_TIMEOUT_MS` (30 s), equal its 90 s `PROFILE_PI_START_TIMEOUT_MS`. A slow start can then fail as a bare step timeout instead of with the step's own message.

**Fix:** Pass the baseline that `recordTerminalAction` read into the wait, and accept only a run gained since then, as `waitForHookLifecycle` does with `lengths`. Give the step a timeout above the sum of its inner deadlines.

### IN-04: The reload step reuses any terminal Pi the scenario started, scripted or not

**File:** `features/step_definitions/session.steps.ts:142-165`, `features/support/world.ts:998-1001`
**Issue:** The comment says the reused terminal Pi is one "which a step started with the scripted model". `startedTuiSession()` returns any TUI, including one that `startTuiSession()` started with the default `"none"` model, such as the step `the user has started pi in the terminal with the hooks recording`. A future scenario that combines that step with this reload would wait for a scripted reply that never comes, and it would time out with a misleading message. No current scenario does this.

**Fix:** Have the world record the model each TUI started with, and make the reload step fail at once when the reused TUI is not scripted. For example, `startedTuiSession(model: "scripted")` could return `undefined` or throw on a mismatch.

---

_Reviewed: 2026-11-22T13:28:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
