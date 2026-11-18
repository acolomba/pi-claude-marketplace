---
phase: 05-stop-continuation-and-hook-failures
plan: "02"
subsystem: hooks-bridge
status: complete
tags: [hooks, notices, failures, cucumber]
requires:
  - "05-01 (runtime.ts as it stands after the Stop move)"
provides:
  - "HookFailure (exec-result.ts): the failure carrier on the noop arm, kinds exit, spawn, run"
  - "hookFailureText(label, failure) (hook-labels.ts)"
  - "failureNotices (dispatch.ts, module-private): the failure notice builder"
  - "HooksRuntime.claimStartFailureNotice(key)"
affects:
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
tech-stack:
  added: []
  patterns:
    - "Failure notices read each hook's own outcome, never the folded result"
    - "Once-only test-and-set over a Set in the createHooksRuntime closure, emptied by prepareSettleForRegistration"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
    - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - test/bridges/hooks/exec-result.test.ts
    - test/bridges/hooks/wire-protocol.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/hook-labels.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/runtime.test.ts
    - features/hook/failures.feature
decisions:
  - "Failure notices come after the systemMessage notices and the block notices, each group in routing order (D-PG5-12)."
  - "A JSON array on stdout is plain text, as Claude Code reads it, so an exit 1 that prints one is a failure (D-CF5-11, D-PG5-10)."
  - "In a multi-pair edit the failure notices show once, after the per-pair systemMessage and block notices, under the one label of the edit (D-PG5-12)."
metrics:
  duration: "~27 min"
  completed: 2026-11-14
estimate:
  tokens: 98000
actuals:
  tokens: 18018
  tasks: 2
  commits: 2
plan_head_before: d8e9d0b195d5290c4965c92b9eac3b41470f9c86
plan_head_after: d3ff20b055704a55080e85ec1c807373a7f866fd
---

# Phase 5 Plan 02: Hook Failure Notices Summary

A synchronous hook that fails without blocking now shows the user one `<label> hook error: ...` notice, with Claude Code 2.1.323's texts. A failed exit shows the first line of its stderr, cut at 200 characters. A hook that cannot start shows its notice once for each event and resolved command in a bridge load. A hook that fails the same way for each pair of a multi-pair edit shows one notice.

`actuals.tokens` is chars/4 over the realized diff `d8e9d0b1..d3ff20b0` (72,072 characters). The plan estimate counted reading and test runs as well.

## Commits

| Task | Commit | Title | Files |
|------|--------|-------|-------|
| 05-02-01 | `b38f5bbf` | feat(hooks): show a notice for a hook that exits with an error | 11 |
| 05-02-02 | `d3ff20b0` | feat(hooks): show a start failure once and an edit failure once | 7 |

Both commits went through the real hook (`npm run check:commit`). Each first attempt failed in the hook and made no commit. The fixes are listed under Deviations. Node v26.13.1, Linux.

## Exported names

- `HookFailure` (exec-result.ts): `{ kind: "exit"; stderr }`, `{ kind: "spawn"; error }`, `{ kind: "run"; error }`. Only the `noop` arm has the optional readonly member `failure`. exec-result.ts still imports nothing.
- `hookFailureText(label: string, failure: HookFailure): string` (hook-labels.ts). It imports only the `HookFailure` type from the leaf exec-result.ts, and no Pi or runtime module.
- `HooksRuntime.claimStartFailureNotice(key: string): boolean` (runtime.ts).
- Module-private in dispatch.ts: `failureNotices(runtime, claudeEvent, label, outcomes)`, `showsFailures`, `startFailureKey`, `claimsFailureNotice`, and `decisionNotices` (the systemMessage and block notices, split out of `hookNotices` so that `runEditPreflight` can show them for each pair). Plan 05-03 exports the builder for Stop.

## Task 05-02-01: failed exits

### Red on the unchanged tree

The scenario "A failing prompt hook without onFailure lets the prompt through and shows its error" now ends with `the hooks show the user these messages:` (`info`, `UserPromptSubmit hook error: Failed with non-blocking status code: boom`).

- `npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature` gave exit 1: 6 scenarios (5 passed, 1 failed), 82 steps (81 passed, 1 failed). The failing step is the notice step, with actual `[]`: the turn showed no notice.

### Green

| Command | Exit | Result |
|---|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/{exec-result,wire-protocol,dispatch-exec,hook-labels,dispatch}.test.ts` | 0 | 432 tests, 432 pass (before the lint fix; dispatch-exec then gained one case, 86 pass) |
| `npm run test:coverage:direct -- <exec-result, wire-protocol, dispatch-exec, hook-labels, dispatch>` | 0 | 100% direct coverage for all five; dispatch-exec rerun alone after the lint fix, exit 0 |
| `npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature` | 0 | 6 scenarios (6 passed), 82 steps |
| `npm run test:cucumber:profile -- --profile adapter features/hook` | 0 | 239 scenarios (239 passed), 3264 steps; no other hook scenario changed |
| `npm run check:features` | 0 | passed |

## Task 05-02-02: start failures and multi-pair edits

### Red (tree of `b38f5bbf` plus the two new scenarios)

- `npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature` gave exit 1: 8 scenarios (6 passed, 2 failed), 113 steps (110 passed, 1 skipped, 2 failed).
  - "A prompt hook that cannot start lets the prompt through and shows its error": the notice step failed with actual `[]`.
  - "An edit hook that fails for each pair of an edit shows its error once": the notice step failed, because actual held `PreToolUse:Edit hook error: Failed with non-blocking status code: boom` twice, two equal notices.

### Green

| Command | Exit | Result |
|---|---|---|
| `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/{dispatch-exec,runtime,dispatch}.test.ts` | 0 | 392 tests, 392 pass (dispatch.test.ts then gained one case and a type fix: 261 pass) |
| `npm run test:coverage:direct -- <dispatch-exec, runtime, dispatch>` | 0 | 100% direct coverage. The first run reported dispatch.ts branches 369/370, the `?? ""` of a hook with no command; one owner case fixed it |
| `npm run test:cucumber:profile -- --profile adapter features/hook/failures.feature` | 0 | 8 scenarios (8 passed), 113 steps. The Outline counts 3 |
| `npm run test:cucumber:profile -- --profile adapter features/hook` | 0 | 241 scenarios (241 passed), 3295 steps |
| `npm run check:features` | 0 | passed |

The scenario "A prompt hook that cannot start stops the prompt when onFailure is block" passes with its expectations unedited. bridges/hooks/event-router.ts is not in either commit. No module-level `Set`, `Map`, or `let` was added to dispatch.ts or dispatch-exec.ts.

The full `npm run check` gate was not run. The orchestrator owns it after wave 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A JSON array on stdout counted as a JSON object**
- **Found during:** Task 05-02-01, the wire-protocol owner case "exit 1 with a JSON array stdout".
- **Issue:** `stdoutObject` accepted an array, because `typeof [] === "object"`. The module header, and Claude Code, read an array as plain text. So an exit 1 that printed `["deny"]` decided as an empty object and carried no failure.
- **Fix:** `stdoutObject` now also requires `!Array.isArray(parsed)`. An exit 2 with an array behaves as before, because the stderr block was already the result.
- **Files:** wire-protocol.ts, wire-protocol.test.ts. **Commit:** `b38f5bbf`.

**2. [Rule 3 - Blocking] Lint in the commit hook of task 1**
- `sonarjs/no-unused-vars` rejected the `{ failure: _failure, ...answer }` rest destructure in `withoutTimeoutFailure`. The function now returns `{ kind: "noop" }` when a timed-out noop carries a failure, because the wire protocol's failure noop holds nothing else. A new owner case keeps a timed-out exit 1 whose JSON gives a `systemMessage` with no failure. This also covers the third operand of the condition.

**3. [Rule 3 - Blocking] Typecheck in the commit hook of task 2**
- `payload.text` of a captured entry is `unknown`. The `promptNotices` test helper now returns the whole captured entries, and the cases compare them with `hookNoticeEntry(...)`. This is a stronger assertion than texts alone.

**4. Owner cases outside the plan's list**
- dispatch-exec.test.ts: a signal other than the timeout keeps its failure; a JSON object at exit 1 carries no failure; a spawn error with an absolute path is redacted (`spawn guard.sh ENOENT`).
- dispatch.test.ts: a failed exit shows on every event, which proves that the once-only claim applies to start failures only; `$CLAUDE_PLUGIN_ROOTS` is not the bare plugin-root variable (the `\b`); per-pair systemMessage notices come before the one failure notice; a hook with no command keys on `<event>:`.
- Five existing dispatch-exec cases changed their whole-value expectations to the new `run` or `spawn` failure, and their titles say so: the null payload, the wrong-shape payload, the child spawn error, the synchronous stdin end failure, and the PostCompact start error. A `throw` inside the stdin `end` call reaches the outer catch, so it is a `run` failure.
- The null-payload case takes its expected error text from the `exec: caught` debug line of the same run, so no V8 message is pinned. Each start-failure case takes its text from the error that it injects.

**5. Small choices left to the executor**
- The edit scenario's Then steps are the two hook runs in any order, the one notice, and the file text, as the plan lists them. It does not restate the model calls.
- `runEditPreflight` builds its label once from the native event. Each pair event has the same `toolName`, so the label is the same as before.

## Flagged assumptions

- **A9 (open for Node 24):** the start-failure scenario states `spawn missing-guard.sh ENOENT`. I measured `child_process.spawn` on a missing absolute path on Node v26.13.1 here: `spawn /tmp/nonexist-dir-xyz/missing-guard.sh ENOENT`, which `redactAbsolutePaths` turns into `spawn missing-guard.sh ENOENT`. The scenario passed on Node 26. Planning measured Node 22.22.2 with the same text. CI runs Node 24, which no one has measured. A spawn `ENOENT` message comes from libuv's `spawn <file> <code>` form, not from the fs errno form that Node 26 changed, so I expect the same text. If CI words it differently, the fix is a run token of the kind `features/lib/run-tokens.ts` holds. Do not loosen the comparison. No owner case pins a Node message.
- **Notice order:** failure notices come after the systemMessage notices and the block notices, each group in routing order. A failed hook has no `systemMessage` of its own, so no hook shows in two groups.
- **The cut:** a plain string slice of 200 UTF-16 units, as Claude Code 2.1.323's renderer makes it. A cut inside a surrogate pair leaves a lone unit.
- **Once-only scope:** per bridge load (the set lives in the runtime and `prepareSettleForRegistration` empties it). Upstream's set is per session.
- **The start-failure key:** it uses the declared `command` only, not an exec-form hook's `args`. Two exec-form hooks with one command and different `args` share one notice.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-06: every failure notice goes through `showHookNotices`, then `notifyHookNotice`, and the text is one line cut at 200 characters behind the `<label> hook error: ` prefix. T-05-07: one notice for each failed hook and event, one for all pairs of an edit, and one start-failure notice for each event and command in a bridge load. T-05-08: start-failure error text passes `redactAbsolutePaths` before it is carried. The diff adds no `ctx.ui.notify`, `console`, or stdio call.

## Parent-owned edits needed (orchestrator)

1. PROJECT.md amendment 3 of 05-CONTEXT.md "Parent lines for the orchestrator": append to the D-CF5-24 row: "Amended by D-PG5-10, D-PG5-11 and D-PG5-13 (accepted without review): the kind also carries the non-blocking failure notice, the missing-script notice, and the `stopReason` notices."
2. BACKLOG.md (once the phase verifies): narrow HOOKERRNOTE-01 to its `SessionEnd` half. A failure notice now shows on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `UserPromptSubmit`, `SessionStart`, and `PreCompact`. `Stop` comes in plan 05-03.
3. VALIDATION.md: merge the red and green runs above.
4. Optional, for plan 05-06 docs: the bridge now reads a JSON array on stdout as plain text on every exit code (deviation 1).

## Self-Check: PASSED

- FOUND: `b38f5bbf`, `d3ff20b0` (both ancestors of HEAD)
- `git rev-list --count d8e9d0b1..d3ff20b0` = 2
- FOUND: every file in key-files.modified
