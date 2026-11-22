---
phase: 06-hooks-and-auth
reviewed: 2026-11-22T12:38:38Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - features/lib/hook-files.ts
  - features/lib/turn-records.ts
  - features/lib/pi-one-shot.ts
  - features/lib/pi-json-mode.ts
  - features/support/world.ts
  - features/step_definitions/project.steps.ts
  - features/step_definitions/command.steps.ts
  - features/hook/session.feature
  - features/hook/lifecycle.feature
  - features/hook/additional-context.feature
  - features/marketplace/device-flow.feature
  - test/integration/hooks-dispatch-end-to-end.test.ts
  - test/integration/auth-e2e.test.ts
findings:
  critical: 0
  warning: 4
  info: 1
  total: 5
  necessity: 0
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-11-22T12:38:38Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Scope: the changes since `4a01e6d` (no product code changed). I checked each deleted or trimmed integration case (`git show 4a01e6d:<path>`) against the scenario that replaces it.

What holds up:
- I confirmed the ESRCH premise on this kernel. A forked child that exits but is not reaped makes `open("/proc/<pid>/environ")` fail with errno 3 (ESRCH).
- DISP-02 is replaced well. LC2 (`lifecycle.feature`) runs a fan-out `apply` with no `--scope`. `closeScopePass` (apply.ts) always rebuilds routing, and the next prompt checks both scopes' runs in any order.
- WR-05 (SS1) is checked more strongly than before: the whole project directory must be empty.
- The print add scenario's "files of the project scope are unchanged" step covers every entry under the scope root, so the staging check is stronger than the deleted test's `readdir(stagingRoot)`.
- The print apply scenario checks `sources`, `sources-staging` and `plugin-clones`.
- AUTH-07 is now proved end to end: the stored credential is evicted, and the next add starts Device Flow again.
- `pi-one-shot.ts` is a faithful lift of the json driver. The routed git env and the redirect extension in `oneShotPiLaunch()` match what `startTuiSession()` passes.

What is wrong:
- Each harness race fix trades a loud failure for a silent one in an edge case (WR-01, WR-02).
- The HOOK-E2E-04 scenario never checks its own precondition (WR-03).
- The AUTH-09 "whole notify log" check that the deleted Device Flow cases made is not carried by the scenarios that replace them (WR-04).

The `fallow audit` weakened-tests verdict, the HOOK-E2E-04 drop parity question, and the print-mode `apply` silence are excluded as decided.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: An ESRCH from `/proc/<pid>/environ` now skips the group kill when the leader is a zombie whose group still runs

**File:** `features/lib/hook-files.ts:672-700`
**Issue:** `stopRegisteredHookProcess` reads the leader's environ to prove the PID is still the hook before it sends `SIGKILL` to `-pid`. After this change, an ESRCH counts as "not the hook", so the group kill is skipped.

ESRCH means the leader is a zombie: it exited, and nothing has reaped it yet. This sandbox has no reaper for orphans, which is why the race showed up. A zombie leader does not mean the group is empty. Any child the hook started stays in group `pid`, and its environment carries the same `PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH=<id>` marker.

Before the change, this case threw and failed the release loudly. Now it returns quietly and leaves those children running into the next scenario. The release exists to prevent exactly that ("so that a waiting script cannot take the release marker of a later scenario"). The analog in 2c7d42d (`subagent-hook-session.ts:processEnvironment`) only reads a marker. No kill decision depends on it, so the same mapping does not carry over safely here.

**Fix:** On ESRCH, look for live members of the group that carry the marker instead of returning `false`. The group ID cannot be reused while any member lives, so killing `-pid` is safe once a member is found:
```ts
// ESRCH: the leader is a zombie, but its group can outlive it.
if (error instanceof Error && "code" in error && error.code === "ESRCH") {
  return groupHoldsMarker(entry); // scan /proc/*/stat for pgrp === entry.pid, check each environ for the marker
}
if (error instanceof Error && "code" in error && error.code === "ENOENT") {
  return false;
}
```

### WR-02: A line that is half-written at a baseline or final read now lands in the wrong window, or in none

**File:** `features/lib/turn-records.ts:36-45` (consumers: `readLogLengths` :48, `readLogLinesSince` :61)
**Issue:** `logLines` now drops a trailing line that has no newline in both readers. The count and the slice agree, but which window gets the line has changed:

1. **Baseline read** (`readLogLengths` at the start of a `When`). A line whose write began before the baseline is no longer counted. Once it completes, `slice(lengths)` reports it as gained during the turn. Before, the partial counted toward the baseline, so it stayed out of the turn. A background hook line written across the start of a `When` (for example after "the hook "wake" goes on in the background") is now charged to the turn. An exact `Then the hooks record these runs` table can then fail at random. An "expected one run" table can also pass on a run from before the turn.
2. **Final read** (`readLogLinesSince` after the action, as in `recordSessionAction` and `recordTerminalAction` in `hook/session.steps.ts:133-161`). A line still being written is silently left out of the turn. Before, it threw. A `Then the hooks record no runs` can now pass while a run was mid-write.
3. **A line that never ends.** Example: a recorder killed by `SIGKILL` inside `appendFileSync`, where a fatal signal can cut a regular-file write short. Its line is dropped for good. Before, it failed with a `SyntaxError`.

Only the polling path (`readHookRuns` with `new Map()`) needed "skip and retry".

**Fix:** Count a trailing partial in the baseline, and keep only the parse lenient. Also check, after the stand-ins have stopped, that no partial line is left:
```ts
async function logLines(file: string): Promise<{ complete: string[]; partial: boolean }> {
  const text = await readFile(file, "utf8");
  const end = text.lastIndexOf("\n") + 1;
  return { complete: text.slice(0, end).split("\n").filter((l) => l !== ""), partial: end < text.length };
}
// readLogLengths: complete.length + (partial ? 1 : 0)  -- a write that began before the baseline is not the turn's
// readLogLinesSince: parse complete.slice(base) only; partial waits for the next read
// assertStandInsStopped: after the wait, assert every *.jsonl ends with "\n"
```
For the end-of-turn read, the alternative is a short bounded wait until the file ends in `\n`, failing loudly if it never does.

### WR-03: The HOOK-E2E-04 scenario never proves that SessionStart context was waiting before `/reload`

**File:** `features/hook/additional-context.feature:230-247` (step: `features/step_definitions/session.steps.ts:147-164`)
**Issue:** The scenario asserts that the first model call holds only `hello there`. It never asserts that the startup SessionStart hook ran and buffered `ss-ctx` before the reload. The step `the user reloads pi in the terminal and then prompts {string}` calls `startTuiSession("scripted")`, then `tui.reload()` right away. Nothing waits for the startup SessionStart run.

`hook/session.steps.ts:347-357` and `waitForStartupRun` (`:186`) exist because the startup run can finish after the terminal shows its ready text ("so that run never lands in a later turn"). Whenever `/reload` wins that race, the scenario passes even with the bridge's buffer clear removed (break H4). It also passes if SessionStart never runs at startup at all.

The deleted HOOK-E2E-04 test asserted the precondition first (`pendingAfterFirstLoad === ["FIRST-LOAD-MARK"]`). H4 failing once in the red-proof run does not show that it fails every time.

**Fix:** Start the terminal Pi with the step that waits for the startup run, and show the run in the scenario. Then reload on that same session with the scripted model's turn recorded:
```gherkin
    Given the user has started pi in the terminal with the scripted model and the hooks recording
    Then the hooks record these runs:
      | event        | source  | arguments | ... |
      | SessionStart | startup | primer    | ... |
    When the user reloads pi in the terminal and then prompts "hello there"
    Then the model receives these calls:
      | call | role | text        |
      | 1    | user | hello there |
```
This needs a reload step that works on the existing TUI session (`requireTuiSession()`), not one that starts its own. Alternatively, have `session.steps.ts:147` wait for `waitForStartupRun` before `tui.reload()` when the hooks record their runs.

### WR-04: The AUTH-09 check on sign-in output is gone from the Device Flow and rejected-credential paths

**File:** `test/integration/auth-e2e.test.ts:1-11`; `features/marketplace/device-flow.feature:256-325`
**Issue:** The deleted AUTH-01 and AUTH-07 cases compared the whole notify log. For example, AUTH-07 required exactly one message, `"Open https://github.com/login/device and enter: WXYZ-5678"`. So any token text in output was a difference; that is how they enforced AUTH-09.

The scenarios that replace them compare only the columns they state. `the command reports these results:` and `the result has these fields:` go through `resultsTable` -> `recordTable`, which projects to the stated headers (`features/lib/result-rows.ts:185-194`). A token in any unstated field, such as a cause or a message, passes AUTH-07 and the Device Flow scenarios.

The new file header still claims that "Everything a user can see of the sign-in is in `features/marketplace/device-flow.feature`", and `06-RESEARCH.md:580` claims that "The scenarios compare whole outputs (AUTH-09)". That holds only for the two print scenarios. The static gate `test/architecture/no-credential-leak.test.ts` scans message templates only; it does not check a rendered result.

**Fix:** Add a whole-result guard, modeled on `the command result contains no absolute sandbox path` (`command.steps.ts:264`). Apply it to the AUTH-07 scenarios and the sign-in scenario:
```ts
Then("no result of the command contains {string}", function (this: ScenarioWorld, secret: string) {
  assert.strictEqual(JSON.stringify(this.resultsOf("command")).includes(secret), false);
});
```
```gherkin
    Then no result of the command contains "expired-token"
    Then no result of the command contains "stand-in-access-token"
```

## Info

### IN-01: One launch shape has three names, and the print output type is written out again

**File:** `features/support/world.ts:221-231`, `features/lib/pi-one-shot.ts:27-39`, `features/lib/pi-json-mode.ts:21`, `features/step_definitions/command.steps.ts:186-190`
**Issue:**
- `OneShotPiLaunch` (world) and `OneShotLaunch` (pi-one-shot) are the same interface, kept in sync by hand.
- `JsonModeLaunch` is only an alias of `OneShotLaunch`, and it is used only inside `pi-json-mode.ts`.
- `printModeOutput` spells out `{ exitCode; stdout; stderr }` inline instead of using `OneShotOutput`.

A field added to one copy reaches the others only because the types happen to match structurally.

**Fix:** Have `oneShotPiLaunch()` return `OneShotLaunch` and delete `OneShotPiLaunch`. Type `runJsonModeCommand(launch: OneShotLaunch, ...)` and drop the alias. Annotate `printModeOutput(...): OneShotOutput`.

---

_Reviewed: 2026-11-22T12:38:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
