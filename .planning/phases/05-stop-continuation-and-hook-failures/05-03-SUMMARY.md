---
phase: 05-stop-continuation-and-hook-failures
plan: "03"
subsystem: hooks-bridge
status: complete
tags: [hooks, missing-script, notices, stopReason, cucumber]
requires:
  - "05-01 (settle.ts: the Stop bucket on agent_before_settle)"
  - "05-02 (HookFailure, hookFailureText, the failure notice builder)"
provides:
  - "HookFailure kind missing-script (exec-result.ts)"
  - "The missing-script rule in the exit-2 arm of parseHookStdout (wire-protocol.ts, module-private)"
  - "hookFailureText(label, failure, hook: FailedHook), FailedHook, hookStoppedText, promptStoppedText (hook-labels.ts)"
  - "failureNotices and FailureNoticeEvent exported from dispatch.ts"
  - "The token {em dash} in the hook notice steps (messages.steps.ts)"
affects:
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
tech-stack:
  added: []
  patterns:
    - "The wire protocol decides the missing-script rule once and marks it on the noop; on-failure.ts reads the marker"
    - "A notice text holding U+2014 keeps it as the escape \\u2014 in source and tests and as the token {em dash} in features"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - extensions/pi-claude-marketplace/bridges/hooks/on-failure.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - test/bridges/hooks/exec-result.test.ts
    - test/bridges/hooks/wire-protocol.test.ts
    - test/bridges/hooks/on-failure.test.ts
    - test/bridges/hooks/hook-labels.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/settle.test.ts
    - test/bridges/hooks/event-adapters.test.ts
    - features/hook/failures.feature
    - features/hook/messages.feature
    - features/step_definitions/hook/messages.steps.ts
decisions:
  - "A missing-script exit 2 shows its notice on every run, as a failed exit does; only a start failure is once-only (D-PG5-12)."
  - "failureNotices takes the exported FailureNoticeEvent (the notice events plus Stop) so settle.ts can pass Stop; showsFailures returns true for Stop (D-PG5-10)."
  - "One module-private showAdapterNotice in event-adapters.ts serves the ignored-rewrite notice and both stop notices, so no clone group forms."
metrics:
  duration: "~70 min"
  completed: 2026-11-14
estimate:
  tokens: 99000
actuals:
  tokens: 18294
  tasks: 3
  commits: 3
plan_head_before: deaa35c4092468ad7dd8e20deeefcc0888a6ffbd
plan_head_after: 8005c9c36c7571c15d5b4907fbfef1dffa9a29e6
---

# Phase 5 Plan 03: Missing Scripts, Stop Failures, and Stop Reasons Summary

A `Stop` or `UserPromptSubmit` hook that exits 2 with a blank stdout and a stderr that matches `/no such file|can't open/i` no longer blocks. It shows one notice, `<label> hook error: Hook script appears to be missing — "<command>" exited 2 with: <stderr>. Treating as non-blocking. Run /claude:plugin reinstall <plugin>@<marketplace> --scope <scope> to reinstall it.` (the dash is U+2014). With `onFailure: "block"`, the prompt is still blocked. A `Stop` hook that fails now shows its failure notice. A `continue: false` shows its `stopReason` on `Stop`, `UserPromptSubmit`, and `PreToolUse`, with Claude Code 2.1.323's texts.

`actuals.tokens` is chars/4 over the realized diff `deaa35c4..8005c9c3` (73,175 characters). The plan estimate counted reading and test runs as well.

## Commits

| Task | Commit | Title | Files |
|------|--------|-------|-------|
| 05-03-01 | `43b6fbb5` | fix(hooks): let a prompt hook with a missing script pass | 12 |
| 05-03-02 | `2c95f4bc` | feat(hooks): show a stop hook's failure and its stop reason | 8 |
| 05-03-03 | `8005c9c3` | feat(hooks): show the stop reason of a prompt or tool hook | 6 |

Every commit went through the real hook (`npm run check:commit` Passed). The first attempt of task 2 failed in the hook and made no commit (Deviation 2). Node v26.13.1, Linux. Every unit run used `--import test/platform/isolated-pi-home.ts`, and every scenario ran in the cucumber sandbox.

## Exported names

- `HookFailure` gains `{ readonly kind: "missing-script"; readonly stderr: string }` (exec-result.ts).
- `hookFailureText(label: string, failure: HookFailure, hook: FailedHook): string`, with `FailedHook = { command; plugin; marketplace; scope: Scope }` (hook-labels.ts). The missing-script arm is not cut at 200 characters.
- `hookStoppedText(label: string, reason: string | undefined): string` and `promptStoppedText(stopReason: string | undefined): string` (hook-labels.ts).
- `failureNotices(runtime, claudeEvent: FailureNoticeEvent, label, outcomes)` and `FailureNoticeEvent` (dispatch.ts).
- Module-private: `MISSING_SCRIPT_EVENTS`, `MISSING_SCRIPT_STDERR`, `isMissingScriptExit`, `exitTwoResult` (wire-protocol.ts); `showStopNotice`, `showStopReason` (settle.ts); `showAdapterNotice` (event-adapters.ts).

## The em dash (verified)

The plan's handling worked on the first scenario. The source and the tests hold `—` as an escape, the feature file holds `{em dash}`, and `turnPayloads` in messages.steps.ts reads each U+2014 of a payload's text as `{em dash}` after the run tokens. The `fix-unicode-dashes` fixer rewrote no dash in task 1. The new scenarios passed, and the seven scenarios that were in messages.feature passed unchanged.

One trap, which Deviation 2 records: a test case appended through a shell heredoc came out with a literal U+2014 in place of the escape. The owner test passed, the fixer then rewrote the dash to `--`, and the commit hook's test run failed. Write the escape with a tool that keeps the backslash, and grep for `u2014` before you commit.

## Task 05-03-01: missing script on UserPromptSubmit

### Red (production tree of `deaa35c4` plus the new scenario and Outline row)

`npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature` gave exit 1: 10 scenarios (8 passed, 2 failed), 141 steps (138 passed, 1 skipped, 2 failed).
- "A prompt hook whose script is missing lets the prompt through and shows its error" failed at `the model receives these calls:`. The prompt was blocked, so the model got no call.
- The new Outline row of "A failing prompt hook with onFailure block stops the prompt" failed at the notice step. The actual text was the plain exit-2 block, `UserPromptSubmit operation blocked by hook:\n[${CLAUDE_PLUGIN_ROOT}/hooks/guard.sh]: python3: can't open file ...`.

### Green (tree of `43b6fbb5`)

| Command | Exit | Result |
|---|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/{exec-result,wire-protocol,on-failure,hook-labels,dispatch}.test.ts` | 0 | 421 tests, 421 pass |
| `npm run test:coverage:direct -- <exec-result, wire-protocol, on-failure, hook-labels, dispatch>` | 0 | 100% direct coverage for all five |
| `npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature features/hook/messages.feature` | 0 | 17 scenarios (17 passed), 237 steps |
| `npm run check:features` | 0 | passed |
| Caller tests: `node --import ... --test test/bridges/hooks/event-router.test.ts test/bridges/hooks/dispatch*.test.ts test/index.test.ts test/bridges/hooks/async-rewake/*.test.ts test/bridges/hooks/tool-batch.test.ts` | 0 | 801 tests, 801 pass |

- The regular expression exists once in the tree: `grep -rnF "no such file|can't open" extensions/` gives only `wire-protocol.ts:58`.
- wire-protocol.test.ts has one case for each of the eight other events (`SessionStart`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `PostCompact`, `SessionEnd`, `StopFailure`). The cases come from `BUCKET_A_EVENTS`, and each asserts that the exit 2 still blocks.
- The new fixture is a script-form hook that prints the interpreter's line on stderr and exits 2. No hooks table runs `sh` or `bash` on a path.
- The reinstall sentence names `<plugin>@<marketplace> --scope <scope>` and no other flag.

## Task 05-03-02: Stop failures and the Stop stop reason

### Red (tree of `43b6fbb5` plus the two scenarios)

`npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature features/hook/messages.feature` gave exit 1: 19 scenarios (17 passed, 2 failed), 267 steps (264 passed, 1 skipped, 2 failed).
- "A stop hook whose script is missing lets the run end and shows its error": the runs step and the one-call step passed (task 1 already lets the run end). The notice step failed with actual `[]`.
- "A stop hook that stops shows its stop reason": the notice step failed with actual `[]`.

### Green (tree of `2c95f4bc`)

| Command | Exit | Result |
|---|---|---|
| `node --import ... --test test/bridges/hooks/{settle,hook-labels,dispatch}.test.ts` | 0 | 401 tests, 401 pass (settle.test.ts alone: 92 pass after the dash fix) |
| `npm run test:coverage:direct -- <settle, hook-labels, dispatch>` | 0 | 100%. The first run gave dispatch.ts branches 372/373 (the `Stop` arm of `showsFailures`); one dispatch.test.ts case fixed it |
| `npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature features/hook/messages.feature features/hook/prompt-and-stop.feature features/hook/stop-failure.feature` | 0 | 58 scenarios (58 passed), 720 steps |
| `npm run check:features` | 0 | passed |
| Caller tests: `event-router`, `dispatch-exec`, `test/index.test.ts`, `test/architecture/hooks-lifecycle.test.ts` | 0 | 360 tests, 360 pass |

- The scenarios of prompt-and-stop.feature and stop-failure.feature passed, and their expectations were not edited.
- settle.ts keeps no second copy of the dedupe or of the once-only check. `showStopNotices` calls `failureNotices(runtime, "Stop", "Stop", outcomes)`.
- A StopFailure owner case asserts that a failed hook shows no notice.

## Task 05-03-03: prompt and tool stop reasons

### Red (tree of `2c95f4bc` plus the two scenarios)

`npm run test:cucumber:profile -- --profile adapter features/hook/messages.feature` gave exit 1: 10 scenarios (8 passed, 2 failed), 139 steps (136 passed, 1 skipped, 2 failed). Both new scenarios failed at the notice step with actual `[]`.

### Green (tree of `8005c9c3`)

| Command | Exit | Result |
|---|---|---|
| `node --import ... --test test/bridges/hooks/event-adapters.test.ts test/bridges/hooks/hook-labels.test.ts` | 0 | 161 tests, 161 pass |
| `npm run test:coverage:direct -- <event-adapters, hook-labels>` | 0 | 100% |
| `npm run test:cucumber:profile -- --profile adapter features/hook/messages.feature features/hook/tool-use.feature` | 0 | 74 scenarios (74 passed), 1111 steps |
| `npm run check:features` | 0 | passed |
| `npx fallow dupes --quiet`, `npx fallow dead-code --quiet`, `npx fallow health --quiet` (exit status checked) | 0, 0, 0 | no clone group, no dead code, no complexity finding |
| Caller tests: `event-router`, `dispatch*`, `test/index.test.ts`, `tool-batch`, `event-adapters`, `hook-labels`, `settle` | 0 | 882 tests, 882 pass (after Deviation 3) |

- `adaptToolCallResult` returns the same value for a `stop` result as before, with and without a `stopReason`: the existing cases pass unchanged, and new cases assert the value next to the notice.
- No stop notice was added for `PostToolUse`, `PostToolUseFailure`, or `PreCompact`. Owner cases assert this.
- Both scenarios of tool-use.feature that stop a tool call still pass.

### Wider safety run (after all three commits)

- `npm run test:cucumber:profile -- --profile adapter features/hook`: exit 0, 249 scenarios (249 passed), 3409 steps.
- `npm run test:cucumber:profile -- --profile builtin features/hook/failures.feature features/hook/messages.feature`: exit 0, 0 scenarios. The builtin profile's tag filter selects none of these.

I did not run the full `npm run check`. The orchestrator owns the wave 3 gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `failureNotices` had to accept `Stop`**
- **Found during:** Task 05-03-02.
- **Issue:** The builder took the private `NoticeEvent`, which has no `Stop`, and its switch in `showsFailures` had no `Stop` arm. Exporting it as it was would also leak a private type, and fallow reported a `private-type-leak`.
- **Fix:** I added the exported `FailureNoticeEvent` (`CompositeDispatchEvent | "PostToolUse" | "PostToolUseFailure" | "Stop"`, written out so that it names no private type). `failureNotices`, `showsFailures`, `startFailureKey`, and `claimsFailureNotice` take it, and `showsFailures` returns true for `Stop`. The plan asked for "no other change". This is the smallest change that type-checks.
- **Commit:** `2c95f4bc`

**2. [Rule 1 - Bug] A literal em dash in a test**
- **Found during:** The first commit attempt of task 05-03-02.
- **Issue:** The settle.test.ts cases went in through a shell heredoc, and `—` arrived as a literal U+2014. The owner test passed. The `fix-unicode-dashes` fixer then rewrote the dash to `--`, and the hook's direct coverage run failed two cases. No commit was made.
- **Fix:** I put the escape back with Python, checked it with `grep -c u2014`, ran the owner tests again, and committed again. No `--amend`.
- **Commit:** `2c95f4bc`

**3. [Rule 1 - Stale expectation] A dispatch.test.ts row expected no notice for a stopped prompt**
- **Found during:** Task 05-03-03, the caller-test run.
- **Issue:** The row "no blocked-prompt notice for a prompt a hook stops" expected `[]`. A stopped prompt now also shows `Operation stopped by hook: enough`.
- **Fix:** The row is now "the stop notice and no blocked-prompt notice for a prompt a hook stops (D-PG5-13)" and expects that one notice. dispatch.test.ts is in the plan's file list but not in task 3's, so the change is in commit `8005c9c3`.

**4. [Rule 2 - Correctness] A missing-script notice is not once-only**
- `claimsFailureNotice` lets a `missing-script` failure through on every run, as an `exit` failure is. Without this change, the start-failure set would have shown it once for each bridge load. An owner case asserts two notices for two prompts.

**5. Owner cases beyond the behavior list**
- wire-protocol.test.ts: a JSON object on stdout keeps the block; exit codes 1, 127, and a signal end (`null`) with a missing-file stderr are plain failed exits; a debug line reports the missing script.
- event-adapters.test.ts: `showAdapterNotice` now also serves `notifyIgnoredToolInputRewrite`. Its existing cases pass unchanged.
- dispatch.test.ts: a direct case for `failureNotices` with `Stop`.

## Flagged assumptions

- **onFailure detail (open question 3, decided in planning):** an `onFailure` block for a missing script keeps the bridge's detail, the trimmed stderr on its own line. Claude Code 2.1.323 uses the missing-script sentence without `Treating as non-blocking.` (record U1). Plan 05-06 records the difference.
- **PreToolUse model text (open question 5, decided in planning):** the model still receives `Operation stopped by hook`. Upstream sends `Execution stopped by PreToolUse hook`. Only the user notice changed.
- **F12:** upstream's predicate is also false when the output streams did not end cleanly. The bridge has no such state, so the rule has no arm for it.
- **Reinstall sentence:** `Run /claude:plugin reinstall <plugin>@<marketplace> --scope <scope> to reinstall it.` It names the scope because `reinstall` with no scope picks the project scope first.
- **Whole notice:** the missing-script notice is not cut at 200 characters. Only the 2,000-character bound of `notifyHookNotice` applies.
- **Em dash:** handled as decided (see above).
- **Stop failure notices:** upstream hides the failure row on `Stop` (record U4). The bridge shows it, per D-PG5-10. This divergence was decided before this plan.
- **A timed-out exit 2 (new, edge case):** a hook that traps SIGTERM after its own timeout and then exits 2 with a missing-file stderr gets the missing-script noop from the wire protocol. `withoutTimeoutFailure` in dispatch-exec.ts then removes its failure, so the run passes as a plain noop and shows no notice. Before this plan, that run was an exit-2 block. With `onFailure: "block"` it still blocks as `timed out`. A run that a signal ended has `exitCode === null` and never reaches the rule. dispatch-exec.ts is outside this plan's files, so I left it unchanged. The verifier should decide whether this run needs to keep its block.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-09: the rule covers `Stop` and `UserPromptSubmit` only, needs a blank stdout, and has owner cases for the eight other events. `onFailure: "block"` keeps the block on `UserPromptSubmit`. T-05-10: the notice quotes the declared command and the recorded plugin, marketplace, and scope, and it goes through `notifyHookNotice`. T-05-11: the stop texts start with the event label and `hook stopped continuation:`, or are upstream's `Operation stopped by hook`. Every stop text goes through `notifyHookNotice`. No stop notice shows where the bridge does not stop. The diff adds no `ctx.ui.notify`, `console`, or stdio call, and no package.

## Parent-owned edits needed (orchestrator)

1. BACKLOG.md: close HOOKPROMPTSTOP-01. A `UserPromptSubmit` hook's `stopReason` is now shown.
2. BACKLOG.md, new line: the reason the model receives on a `PreToolUse` stop is `Operation stopped by hook`, where Claude Code 2.1.323 sends `Execution stopped by PreToolUse hook` (record U5).
3. BACKLOG.md, new line: a `stopReason` kept in the conversation. The bridge shows it to the user only and adds nothing to the transcript.
4. BACKLOG.md: reword the `asyncRewake` missing-script item. That lane has a rule of its own: an exit 2 whose output shows a script that cannot be opened still wakes the model once, with a "broken hook installation" text, and identical repeats are dropped (record U2).
5. BACKLOG.md (once the phase verifies): HOOKERRNOTE-01. `Stop` now shows failure notices too. Only the `SessionEnd` half stays open.
6. `.agents/skills/cucumber/rules/features.md`, section "Run tokens": add `{em dash}`. It stands for U+2014 in a hook notice. Only the hook notice steps of `features/step_definitions/hook/messages.steps.ts` project it, and a command never expands it.
7. VALIDATION.md: merge the red and green runs above.
8. Optional, for plan 05-06 docs: the timed-out exit-2 edge case under Flagged assumptions.

Prefix any `gsd-tools windows append --description` with `[parity-gaps]`. This plan appended no entry.

## Self-Check: PASSED

- FOUND: `43b6fbb5`, `2c95f4bc`, `8005c9c3` (each an ancestor of HEAD)
- `git rev-list --count deaa35c4..8005c9c3` = 3
- FOUND: every file in key-files.modified
