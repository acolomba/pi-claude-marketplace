---
phase: 03-stopfailure-hooks
plan: 02
subsystem: hooks
tags: [stopfailure, matcher, cucumber]
requirements-completed: [STOPF-01]
key-files:
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-events.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - test/domain/components/hook-events.test.ts
    - test/domain/components/hooks/partition.test.ts
    - test/bridges/hooks/settle.test.ts
    - features/hook/stop-failure.feature
    - docs/hooks-compatibility.md
completed: 2026-11-08
---

# Phase 3 Plan 02: StopFailure matchers read as Claude Code reads them

**A StopFailure matcher is now a `|` list of exact error types (D-BG-302). The vocabulary holds Claude Code 2.1.319's 13 error types (D-BG-301).**

## Accomplishments

- Task 1 (D-BG-302), commit `6011477c`:
  - `stopFailureMatcherTypes` in `hook-events.ts` returns the non-empty `|` alternatives of a matcher made only of `[\w|]`, and `[]` for any other matcher.
  - A new StopFailure case in `partition.ts` (`stopFailureMatcherCondition`) keeps a list that names one vocabulary type. No existing line was deleted.
  - `runStopFailure`'s filter in `settle.ts` fires on the shared `matcherFiresOnClosedSetValue` or on membership in the list (P3-DC-06).
  - Unit rows cover the helper (10), the partition kept and dropped lists (8 plus the changed closed-set case), and the settle list case.
  - Scenario S8 is added.
- Task 2 (D-BG-301):
  - `account_on_hold`, `verification_required`, and `cloud_credential_error` are appended to `STOP_FAILURE_ERROR_TYPES`, with their doc comment, and the closed-sets unit case gains them.
  - Two Outlines are added: S7a (13 types show the plugin `available`) and S7b (three matchers show it `partially-available`).
  - The `docs/hooks-compatibility.md` StopFailure matcher row is rewritten (1 line added, 1 deleted).

## Red proofs

| Scenario | Before the fix, or the temporary break | Result |
|---|---|---|
| S8 (list matcher) | before the D-BG-302 fix | failed at the install `Given`: info showed `partially-available` and `unsupported hooks` (`/tmp/claude-1000/bg-phase-3/red-s8.log`) |
| S7a: `account_on_hold`, `verification_required`, `cloud_credential_error` | before the D-BG-301 fix | 3 of 16 failed, exactly these three rows (`red-s7.log`) |
| S7a: the other 10 rows, and S7b (3 rows) | `stopFailureMatcherCondition` results swapped, temporary, reverted with `git checkout` | 16 of 16 failed (`red-s7swap.log`) |

## Verification

- Unit modules (hook-events, partition, settle): 103 of 103 passed after task 1. hook-events and partition passed after task 2.
- Direct coverage passed for the three pairs (task 1) and for hook-events (task 2).
- `npx cucumber-js --profile adapter --parallel 3` passed on `stop-failure.feature`, `configuration.feature`, and `session.feature` (39 of 39, task 1), and on `stop-failure.feature` and `configuration.feature` (43 of 43, task 2).
- `npm run check:static` passed after task 1, fallow included.

## Deviations from Plan

- Executed inline by the phase session, not by an executor subagent (coordinator instruction).
- The partition test's kept and dropped lists are one loop over typed rows, each carrying its expected partition, to avoid a clone group (the plan's fallback, used up front).
- The helper's regex is `/^[\w|]+$/`, which the plan allowed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

- One partition test loop with a conditional expected value, built outside `test()`: the body has no conditional, but the row's `kept` flag picks the expected value.
