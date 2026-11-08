---
phase: 04-posttoolusefailure-hooks
plan: 02
subsystem: hooks
tags: [cucumber, hooks, PostToolUseFailure, outputs]
requires:
  - phase: 04-posttoolusefailure-hooks
    provides: "04-01: the feature file, the verb module, the cancelled-call guard, and is_interrupt"
provides:
  - "A PostToolUseFailure hook's updatedToolOutput no longer replaces the failed result (D-BG-405)"
  - "Scenarios for a failed read's payload and matchers, the success split, and the four output channels"
key-files:
  modified:
    - features/hook/tool-failure.feature
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - test/bridges/hooks/event-adapters.test.ts
    - docs/hooks-compatibility.md
requirements: [TFAIL-01]
completed: 2026-11-08
---

# Plan 04-02 Summary: failed-read payload, matchers, outputs, and D-BG-405

## Accomplishments

- `adaptToolResultResult` (`bridges/hooks/event-adapters.ts`): the `mutate` arm on a failed result goes through the private `failedResultPatch`, which returns `undefined` and writes `adaptToolResult: updatedToolOutput ignored on a failed tool result` when the hook set one (D-BG-405). A PostToolUse mutation still returns `toolResultPatch(...)`. Two table-driven unit cases cover the replacement and the context-only mutation.
- `docs/hooks-compatibility.md`, the `updatedToolOutput` row: a PostToolUseFailure hook's is ignored, as upstream (D-BG-405).
- `features/hook/tool-failure.feature` gained seven scenarios, none tagged (no MCP surface):
  - R1 "A PostToolUseFailure hook's updated tool output leaves the error the model reads (D-BG-405)"
  - R2 "A failed read runs the PostToolUseFailure hooks its matchers select and no PostToolUse hook" (`Read`, `Read\|Edit` select; `Write` and the PostToolUse `Read` hook do not run; payload with `Offset 9 is beyond end of file (3 lines total)` and `is interrupt` false)
  - R3 "A successful call runs its PostToolUse hook and no PostToolUseFailure hook"
  - R4 additional context: `PostToolUseFailure:Read hook additional context: checked the error` after the failed result
  - R5 system message: `info | PostToolUseFailure:Read says: checked the failed read` to the user, nothing extra to the model
  - R6 exit 2: `read failed: ...\nPostToolUseFailure:Read hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/exit.sh": [${CLAUDE_PLUGIN_ROOT}/hooks/exit.sh]: check the error`
  - R7 block decision: `...PostToolUseFailure:Read hook blocking error from command: "${CLAUDE_PLUGIN_ROOT}/hooks/block.sh": look at the offset`
  Every rendered text matched the research table; no mismatch with Claude Code's form was found in the failure arm.

## Task Commits

| Commit | Title | Files |
| --- | --- | --- |
| be0bcc62 | fix(hooks): ignore updatedToolOutput of a PostToolUseFailure hook | event-adapters.ts, event-adapters.test.ts, tool-failure.feature (R1), hooks-compatibility.md |
| 80558dad | test(features): cover PostToolUseFailure payloads, matchers, and outputs | tool-failure.feature (R2 to R7) |

## Red proofs

All under the adapter profile; every break was reverted from a backup, and `git status --porcelain -- extensions/` printed nothing afterwards.

- R1, before D-BG-405: the model's tool result read `read returned: replaced` (1 scenario failed, 14 of 15 steps passed). Green after the fix.
- Break (a), the split line swapped: R2 failed (the `after` PostToolUse hook ran) and R3 failed (assertion on the runs table). A first run of this break failed both scenarios on Pi startup timeouts under load (`function timed out ... 90000 milliseconds`), so it was rerun; the rerun failed both on assertions.
- Break (b), the matcher callback always true: R2 failed with the `other` (`Write`) hook in the runs.
- R4, `sendToolContext` removed from the tool-result closure: R4 failed (the context row missing).
- R5, `PostToolUseFailure` moved to the silent group of `showsSystemMessages`: R5 failed (no notice).
- R6 and R7, the block arm returning `undefined` on a failed event: both failed (no feedback line).

## Checks

- `node --import <worktree>/test/platform/isolated-pi-home.ts --test test/bridges/hooks/event-adapters.test.ts`: exit 0.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`: exit 0.
- eslint and prettier on the changed files, `tsc --noEmit`: exit 0 (after the helper's return type changed from `undefined` to `ToolResultEventResult | undefined` for `no-confusing-void-expression`).
- `npm run test:cucumber:profile -- --profile adapter --parallel 3 features/hook/tool-failure.feature features/hook/tool-use.feature`: 23 of 23 after Task 1; `features/hook/tool-failure.feature`: 8 of 8 after Tasks 2 and 3.
- `npx fallow dupes --fail-on-issues`, `npx fallow health --fail-on-issues`, `npm run check:features`: exit 0.

## Deviations from Plan

- Tasks 2 and 3 landed in one commit (R2 to R7 together) instead of two; the scenarios were written and proven together.
- The `failedResultPatch` helper is typed `ToolResultEventResult | undefined`, not `undefined`, for the lint rule.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- R2 to R7 share one commit (see Deviations).
- The D-BG-405 unit cases are one table-driven test over two mutations, to add no clone group.
