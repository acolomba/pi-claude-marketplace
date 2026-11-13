---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "09"
subsystem: hooks
tags: [stop, tool-call, reload, cucumber]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Native hook routing and matcher behavior through plan 02-08
provides:
  - Eight consecutive Stop continuations with the ninth blocking outcome overridden
  - Native tool-call reset of the Stop count and cap-notice latch
  - Runtime and reload isolation evidence for the Stop budget
affects: [hook-settlement, native-tool-routing, reload]
actuals:
  tokens: 10162
  tasks: 3
  commits: 3
plan_head_before: 22619727b8b725526650f2807cac2a51ca4c680a
plan_head_after: 60dc0e9beb8238abb7cfca1a9ed96f0ccd69b0ec
tech-stack:
  added: []
  patterns:
    - Reset Stop budget at the generation-checked native PreToolUse entry
    - Keep Stop continuation on agent_settled with a bounded runtime transition
key-files:
  created:
    - .planning/phases/02-hook-payloads-matchers-and-stop-limit/02-09-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - test/bridges/hooks/runtime.test.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/settle.test.ts
    - test/bridges/hooks/event-router.test.ts
    - test/architecture/hooks-cap-notify.test.ts
    - features/hook/prompt-and-stop.feature
    - features/step_definitions/hook/prompt-and-stop.steps.ts
key-decisions:
  - Retained the existing agent_settled continuation and generation guards.
  - Reused registration's Stop reset; task 3 needed evidence rather than a production router change.
patterns-established:
  - One native tool-call reset occurs before empty-bucket and proxy exits.
requirements-completed: [PG-HOOK-13]
coverage:
  - id: D1
    description: Eight blocking Stop outcomes continue and the ninth produces one override notice.
    requirement: PG-HOOK-13
    verification:
      - kind: unit
        ref: test/bridges/hooks/runtime.test.ts#keeps-terminal-Stop-callbacks-bounded
        status: pass
      - kind: e2e
        ref: features/hook/prompt-and-stop.feature#Eight-consecutive-Stop-blocks-continue-before-the-ninth-is-overridden
        status: pass
    human_judgment: false
  - id: D2
    description: Native tool calls reset a Stop-only plugin's continuation count and notice latch.
    requirement: PG-HOOK-13
    verification:
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#a-native-tool-call-resets-a-Stop-only-runtime
        status: pass
      - kind: e2e
        ref: features/hook/prompt-and-stop.feature#Tool-calls-reset-a-Stop-only-plugin's-continuation-count
        status: pass
    human_judgment: false
  - id: D3
    description: Reload and separate runtimes start independent Stop budgets and reject stale completions.
    requirement: PG-HOOK-13
    verification:
      - kind: unit
        ref: test/bridges/hooks/settle.test.ts#a-pending-old-generation-Stop-completion-cannot-consume-a-reloaded-budget
        status: pass
      - kind: e2e
        ref: features/hook/prompt-and-stop.feature#Reload-starts-a-fresh-Stop-continuation-count
        status: pass
    human_judgment: false
duration: "at least 22 min from first task commit"
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 09: Stop Continuation Limit Summary

**Stop hooks now continue eight times, override the ninth blocking outcome, and regain a fresh budget after each native model tool call or reload.**

## Performance

- **Duration:** At least 22 minutes from the first task commit; the earlier start time was not captured.
- **First recorded task commit:** 2026-11-13T00:49:24Z
- **Completed:** 2026-11-13T01:11:21Z
- **Tasks:** 3
- **Files modified:** 10 production and test files
- **Execution:** Node v26.13.0 in the isolated worktree

## Accomplishments

- Stop blocks 1 through 8 each request one continuation. Block 9 settles with one cap notice; repeated terminal callbacks neither continue nor notify again.
- Every generation-current native `tool_call` clears the count and notice latch before empty-bucket and proxy exits. The reset leaves Stop-active and async-rewake flags alone.
- A real terminal `/reload` after three prior blocks allowed eight fresh continuations, then overrode the ninth. Pending old-generation work and separate runtimes did not consume the new budget.

## Task Commits

- **Task 1: 02-09-01 Eight-continuation boundary and real nine-run scenario**: `4cad302c4103625045b03f7e592b043a82fe685c`
- **Task 2: 02-09-02 Native tool reset and ten tool-separated blocks**: `4b0ac9fdc69e1335a01be08130e8f6a75c20ec5b`
- **Task 3: 02-09-03 Reload, stale-generation, and runtime-isolation evidence**: `60dc0e9beb8238abb7cfca1a9ed96f0ccd69b0ec`

## Verification

- The final five owner test modules passed together: runtime, settle, dispatch, event-router, and cap-notify architecture.
- Direct coverage passed for runtime, settle, dispatch, and event-router source-test pairs.
- The complete `features/hook/prompt-and-stop.feature` passed under the adapter profile: **6 scenarios, 84 steps**. The builtin profile selects zero scenarios from this feature.
- The named real command-hook scenarios observed **9 Stop runs / 9 model calls / 8 continuations / 1 notice**, **10 Stop runs / 10 tool calls / 21 model calls / 0 notices**, and **3 pre-reload Stop runs followed by 9 post-reload Stop runs / 8 fresh continuations / 1 post-reload notice**, respectively.
- `npm run typecheck`, `npm run check:features`, and `npx --no fallow audit --base HEAD` passed for the final task. Each task's normal `git commit` hook passed `npm run check:commit`.
- The parent owns the Wave 3 combined-tree `npm run check` after merging this worktree; it was not run as a worktree substitute.

## TDD Evidence

- **02-09-01 RED:** The new eight-transition runtime assertions failed on unchanged code: transition 8 returned `{reenter:false, notifyCap:true}` instead of `{reenter:true, notifyCap:false}`. **GREEN:** The runtime/settle owner tests, direct coverage, and real nine-run scenario passed after the bounded comparison changed.
- **02-09-02 RED:** The Stop-only empty-bucket dispatch test failed on unchanged behavior: the first post-tool Stop returned `{reenter:false, notifyCap:true}` instead of an allowed continuation. **GREEN:** Owner tests, direct coverage, and the ten-cycle real hook scenario passed after adding `recordToolCall()` at native entry.
- **02-09-03:** Registration and settle already had the required generation guards and reset. The new tests verified those existing paths without changing production routing. No artificial failing test or failing-test commit was introduced; normal hooks remained mandatory.

## Scope Adjustments

- Task 02-09-01 also changed `features/step_definitions/hook/prompt-and-stop.steps.ts`, originally listed under task 3, because the nine-run behavioral scenario needed an exact all-call assertion in its own atomic commit.
- Task 02-09-03 extended `test/bridges/hooks/settle.test.ts` to prove that a pending old-generation Stop completion cannot consume a fresh budget. `event-router.ts` itself required no edit because registration already calls the settle reset and stale callbacks are generation guarded.
- The repository's pinned optional test peers were installed only into ignored `node_modules/.cache/optional-peers`; no package manifest, lockfile, or tool wrapper changed.

## Decisions Made

The eight-continuation cap remains the fixed project decision D-PG2-11. No cap environment variable, new event timing, persistence schema, or Stop event migration was added.

## Deviations from Plan

None - the scoped changes above supplied the planned evidence without changing the accepted design.

## Issues Encountered

- The first task's initial normal commit hook rejected TypeScript narrowing and spacing errors in its new Cucumber step. Those errors were fixed and the same task committed with all hooks passing.
- The real Cucumber harness needed local socket permission and its pinned optional peer cache. Both were provided before the behavioral runs; neither changed tracked dependencies.

## User Setup Required

None - no external service configuration is required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

All three task SHAs are ancestors of `plan_head_after`; the ten changed files exist, no tracked file was deleted, and the focused owner, coverage, architecture, and real command-hook checks above passed.

## Next Phase Readiness

Plan 02-09 is ready for the parent's Wave 3 merge and combined-tree `npm run check`. PG-HOOK-01 remains separate and was not marked complete here. Shared `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` were left to the parent.
