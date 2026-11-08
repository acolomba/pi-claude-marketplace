---
phase: 05-postcompact-hooks
plan: 01
subsystem: hooks
tags: [postcompact, hooks, parity]
requires: []
provides:
  - PostCompact run field on HookExecResult (postCompactRun)
  - one notice listing each PostCompact hook's end after /compact
affects: [hook dispatch, hook notices]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
    - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
    - extensions/pi-claude-marketplace/bridges/hooks/hook-labels.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - features/hook/compaction.feature
    - test/bridges/hooks/exec-result.test.ts
    - test/bridges/hooks/payloads/post-compact.test.ts
    - test/bridges/hooks/hook-labels.test.ts
    - test/bridges/hooks/dispatch-exec.test.ts
    - test/bridges/hooks/dispatch.test.ts
key-decisions:
  - D-BG-501 to D-BG-504 implemented as planned
requirements-completed: [PCOMP-01]
duration: ~45 min
completed: 2026-11-08
---

# Phase 5 Plan 01: PostCompact output parity Summary

After `/compact`, one hook notice lists how each PostCompact hook ended in Claude Code 2.1.319's wording; after an automatic compaction nothing shows.

## Execution

Executed inline by the phase orchestrator (P5-DC-17). Commit `2c3c6b71` `fix(hooks): show how each PostCompact hook ended after /compact` holds both tasks: the `close`, child `error`, and outer-catch ends all settle through `endedResult` (four `endedResult(` occurrences), so Task 2 did not get a commit of its own (deviation, see Dubious Choices).

## Red proof (scenarios 4 and 5)

Command: `npm run test:cucumber:profile -- --profile adapter features/hook/compaction.feature`, on the product before the change (scenarios added first). Result: `3 scenarios (1 passed, 2 failed)`, `44 steps (42 passed, 2 failed)`.

- Scenario 4 ("After a manual compaction one notice lists how each PostCompact hook ended") failed at `the hooks show the user these messages:`; the product showed only `PostCompact:manual hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/refused.sh]: not now` and `PostCompact:manual hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/strict.sh]: failed; blocking because onFailure is "block"\nboom`.
- Scenario 5 ("An automatic compaction shows nothing for a PostCompact hook that exits 2") failed at `the hooks show the user no messages`; the product showed `PostCompact:auto hook error: [${CLAUDE_PLUGIN_ROOT}/hooks/refused.sh]: not now`.

## Green

`npm run test:cucumber:profile -- --profile adapter features/hook/compaction.feature features/hook/session.feature`: `15 scenarios (15 passed)`, `209 steps (209 passed)`. Scenario 4's derived notice text (05-01-PLAN.md) matched on the first green run, unchanged. `features/hook/session.feature` did not change. Unit files pass (dispatch.test.ts 150, dispatch-exec.test.ts 69, the three small pairs 44); `npm run test:coverage:direct` over the five sources exits 0; ESLint clean; the commit hook's `check:commit` passed.

## Shared lines touched (for the parent's merge with Phases 2, 4, 6)

- `dispatch.ts`: `postCompactLineText` import; `blockNotices` doc comment and the SessionStart/SessionEnd group (PostCompact moved to a case of its own); new `displayCommand` and `postCompactNotices`; one PostCompact branch in `compositeHandlerFor` after the PreToolUse branch.
- `dispatch-exec.ts`: imports (`postCompactRunOf`, type `HookExitFacts`), header step 8 sentence, new `endedResult`, and the three ends (outer catch, child `error`, child `close`) now build a `HookExitFacts` constant.
- `exec-result.ts`: `PostCompactRun` and the optional field on all four arms (header paragraph).
- Tests: `TranslatorCase.expectedOutcome` and its two readers, `dispatchDriven`'s optional `event` parameter, the deleted PostCompact row of the shared notice table, new `describe` blocks.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- **Two tasks, one commit (Low).** Task 2's edits (child `error` and outer-catch ends) were made together with Task 1 and land in the same commit; the behavior and tests are those the plan names.
- **Existing `translatePostCompact` tests not regrouped (Low).** The plan asked to wrap them in `describe("translatePostCompact")`; they stay top-level beside the new `describe("postCompactRunOf")`, to keep the diff small.
- **`POST_COMPACT_EVENT` constant instead of a `postCompactEvent()` function, and the translator row's event literal not hoisted (Low).** fallow's dupes gate passed in the commit hook, so no clone group resulted.
- **Spawn-error PostCompact run reads the error message, while `onFailureBlock` keeps `stderr.text()` (Low, P5-DC-11).**
