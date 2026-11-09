---
phase: 04-posttoolusefailure-hooks
plan: 01
subsystem: hooks
tags: [cucumber, hooks, PostToolUseFailure, interrupt]
requires:
  - phase: 01-foundation
    provides: "the frozen hook recorder, runs steps, and scripted model"
provides:
  - "A cancelled running tool runs no PostToolUseFailure hook (D-BG-402)"
  - "Every PostToolUseFailure payload carries is_interrupt: false after error (D-BG-401)"
  - "features/hook/tool-failure.feature and features/step_definitions/hook/tool-failure.steps.ts with the interrupt step"
key-files:
  created:
    - features/hook/tool-failure.feature
    - features/step_definitions/hook/tool-failure.steps.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
    - docs/hooks-compatibility.md
    - features/hook/tool-use.feature
requirements: [TFAIL-01]
completed: 2026-11-08
---

# Plan 04-01 Summary: the cancelled-call guard and is_interrupt

## Accomplishments

- `toolResultCompositeHandler` (`bridges/hooks/dispatch.ts`) gained the private predicate `isCancelledFailure(failed, ctx)`. After the empty-bucket check and before `toolEventView`, a failed result under the turn's aborted signal runs no PostToolUseFailure hook (sync or async), writes the debug line `dispatch: no PostToolUseFailure hook on a cancelled tool call`, and returns `undefined` (D-BG-402). The signal is read only when the bucket has hooks.
- `translatePostToolUseFailure` sends `is_interrupt: false` directly after `error`; `tool_use_id` and `duration_ms` stay out (D-BG-401, D-BG-403).
- New `features/hook/tool-failure.feature` ("Hook tool failure") with the scenario "Interrupting a running command runs no PostToolUseFailure hook (D-BG-402)", and the verb module `features/step_definitions/hook/tool-failure.steps.ts` with the When step `the user prompts {string} and interrupts the running tool once it has created {string}`: it prompts over RPC, waits for the marker the command writes (10 s deadline), sends `abort`, waits for `agent_settled` with `aborted: true`, fails on extension errors, dialogs, and model calls past the script, removes the marker on release, and records the turn.
- `docs/hooks-compatibility.md`: the `PostToolUseFailure` events row names D-BG-402, and the `error` (PostToolUseFailure stdin) row states `is_interrupt` is always `false`.

## Task Commits

| Commit | Title | Files |
| --- | --- | --- |
| 48dfc857 | fix(hooks): run no PostToolUseFailure hook on a cancelled call | dispatch.ts, dispatch.test.ts, tool-failure.feature, tool-failure.steps.ts, hooks-compatibility.md |
| b07d902a | fix(hooks): send is_interrupt in the PostToolUseFailure payload | post-tool-use-failure.ts, its unit test, dispatch-exec.test.ts |
| f627409b | test(features): expect is_interrupt in a failed bash hook run | features/hook/tool-use.feature only |

**Unowned feature file:** `features/hook/tool-use.feature`, scenario "A failed tool call runs PostToolUseFailure and not PostToolUse": its runs table gained the column `is interrupt` with `false`, in commit f627409b alone.

## Red proofs

- **Interrupt scenario (D-BG-402):** before the guard, under the adapter profile, the `failure` hook (PostToolUseFailure, matcher Bash) recorded one run with `"error": "Command aborted"`, `tool_name: "Bash"`, and the loop command, so `Then the hooks record no runs` failed (12 steps passed, 1 failed). The PostToolUse hook recorded nothing. With the guard the scenario passes.
- **Unit (D-BG-402):** three cases at the end of `describe("toolResultCompositeHandler")` in `dispatch.test.ts`: a failed result under an aborted signal runs no hook and logs one debug line; a failed result under a live signal runs `failure`; a successful result under an aborted signal runs `after`. They share the helper `runBashToolResult(isError, signal)`.
- **is_interrupt (D-BG-401):** with the new expectations and the old translator, `post-tool-use-failure.test.ts` and `dispatch-exec.test.ts` exited 1. With the translator at HEAD~ and the new feature row, the tool-use scenario failed on the `is interrupt` column (13 steps, 1 failed). Both green after the change.

## Checks

- `node --import <worktree>/test/platform/isolated-pi-home.ts --test test/bridges/hooks/dispatch.test.ts`: 149 pass.
- `node --import ... --test test/bridges/hooks/payloads/post-tool-use-failure.test.ts test/bridges/hooks/dispatch-exec.test.ts`: exit 0.
- `npm run test:coverage:direct -- bridges/hooks/dispatch.ts`, and `-- payloads/post-tool-use-failure.ts bridges/hooks/dispatch-exec.ts`: exit 0.
- `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/tool-use.feature features/hook/tool-failure.feature`: 22 scenarios, 305 steps passed.
- `npm run check:features`, `npx fallow dupes --fail-on-issues`, `npm run typecheck`, eslint and prettier on the changed files: exit 0.
- The commit hook (`npm run check:commit`) passed on each commit.

## Deviations from Plan

- The plan's executor subagent wrote Task 1 and ran its red and green checks, then the coordinator moved execution inline; the orchestrating session ran the remaining checks, Task 2, the commits, and this SUMMARY.
- The Task 2 docs row edit landed in the Task 1 commit 48dfc857: `git commit -- <paths>` takes the working-tree content, and the docs file held both edits. Commit b07d902a therefore holds no docs change.
- The first attempt at the Task 1 commit failed with "files were modified by this hook", because the session edited Task 2 files while the hook ran; every check had passed. The retry passed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- Marker deadline 10 s and settle wait 15 s (the plan allowed 15 s and 20 s), so the step stays inside the 30 s step timeout.
- The three unit cases share one helper, `runBashToolResult`, defined after the describe block, so fallow finds no clone group.
- The step checks the marker with `existsSync`.
- The Task 2 docs row went into the Task 1 commit (see Deviations).
