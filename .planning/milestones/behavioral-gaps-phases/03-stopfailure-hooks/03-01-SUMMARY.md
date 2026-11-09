---
phase: 03-stopfailure-hooks
plan: 01
subsystem: hooks
tags: [cucumber, stopfailure, hooks]
requirements-completed: [STOPF-01]
key-files:
  modified:
    - features/hook/stop-failure.feature
duration: ~2h (with the executor collision)
completed: 2026-11-08
---

# Phase 3 Plan 01: Pin today's StopFailure behavior

**`features/hook/stop-failure.feature` now pins five things against Claude Code 2.1.319: the StopFailure payload, error-type matchers for each type Pi can report, StopFailure in place of Stop, ignored hook output, and a normal next turn. No product code changes.**

## Accomplishments

- The seed scenario is kept unchanged. The feature description is rewritten (S0).
- A Scenario Outline covers the eight D-BG-304 messages. Each one makes one model call and runs only the hook whose matcher names the classified type, with Claude Code's whole payload row. The look-alike `other` hook never runs.
- S4a: an error turn runs StopFailure and not Stop. S4b: a normal turn runs Stop and not StopFailure.
- S5: three StopFailure hooks all run and change nothing. One exits 2 with stderr, one prints a block JSON with `systemMessage` and `additionalContext`, and one fails with `on failure: block`. The user sees no notice, and the model gets no further call.
- S6: the prompt after such an error turn gets a normal turn. Pi's call 2 carries the empty assistant row, and the Stop hook records `stop hook active: false`.
- All eight messages classified as written, so none needed rewording. No step module was added, and no scenario has an MCP tag.

## Red proofs

Every break was temporary. Each was applied to `extensions/pi-claude-marketplace/bridges/hooks/settle.ts`, reverted with `git checkout`, and confirmed gone with `git diff --quiet HEAD -- extensions` (exit 0). None was committed.

| Scenario | Temporary break | Result |
|---|---|---|
| Outline (8 rows) | `runStopFailure` filter replaced by `() => true` | 8 of 8 failed at `the hooks record these runs:`; the actual runs gained an extra `other` row (log `/tmp/claude-1000/bg-phase-3/red1.log`) |
| S4a, S4b | `settleHandlerFor` switch swaps `stop` and `error` | 2 of 2 failed: S4a recorded a `Stop` row in place of the StopFailure row, and S4b a StopFailure row of error `unknown` in place of the Stop row (`red2.log`) |
| S5, S6 | after the generation check in `runStopFailure`: if the error is `authentication_failed` and a hook blocked, `reenter(...)` | 2 of 2 failed: S5 with "the model was called past its script", S6 with a calls-table difference (`red3.log`) |

Note on S6: the cell `stop hook active: false` alone cannot show that the StopFailure block set no loop state. The user's prompt clears that flag on every `input` event (STOP-07). So S6's red proof is a re-entry break, not a loop-state break.

## Verification

- `npx cucumber-js --profile adapter --parallel 3 features/hook/stop-failure.feature features/hook/prompt-and-stop.feature`: 16 of 16 scenarios passed (exit 0).
- `npm run check:features`: exit 0.
- `git diff --quiet HEAD -- extensions`: exit 0.

## Deviations from Plan

- **One commit, not three.** The first executor subagent finished Task 1 and started its commit. Then the parent continued the plan inline in the same worktree (because the Agent tool has no foreground mode). The parent's edits landed during that commit's hook, so pre-commit reported "files were modified by this hook" and the commit failed. The parent then finished Tasks 2 and 3 inline and commits the whole feature file once. The executor's Task 1 green run and its Outline red proof match the parent's run above.
- During the collision, the hook's `check:static` read a tree that held the parent's temporary break 1. The commit failed for the reason above, so nothing from the break was committed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- One commit for the plan's three tasks, after the executor collision.
- The parent finished the plan inline, not through an executor subagent (coordinator instruction).
