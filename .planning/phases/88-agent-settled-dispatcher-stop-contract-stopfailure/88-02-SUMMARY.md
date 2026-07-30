---
phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
plan: 02
subsystem: api
tags: [hooks, stop-hook, dispatch, settle, decision-control, typescript]

requires:
  - phase: 88-agent-settled-dispatcher-stop-contract-stopfailure
    plan: 01
    provides: "settle.ts tracer (agent_end cache + agent_settled stopReason gate + Stop block re-entry); reduceBucket/ReducedBucket exported; Stop payload draft"
provides:
  - "collectBucketOutcomes in dispatch.ts: no-short-circuit bucket walk reusing the executor seam, asyncRewake degraded to noop"
  - "Full bespoke Stop result adapter in settle.ts: block (STOP-03) / exit-2 (STOP-04) / additionalContext (STOP-05) / aggregate continue:false (STOP-06, D-88-05)"
  - "Stop stdin envelope shape pinned by a byte-stable fixture (STOP-02)"
affects: [88-03, 88-04]

tech-stack:
  added: []
  patterns:
    - "Aggregate-precedence collection: collectBucketOutcomes runs every entry (no first-block/stop short-circuit) so any continue:false among the group can suppress a block, order-independent"
    - "asyncRewake-on-settle gate: an entry declaring asyncRewake:true is degraded to noop with a hookDebugLog rather than a fire-and-forget spawn, so no synchronous decision is silently lost"

key-files:
  created:
    - tests/bridges/hooks/payloads/stop.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
    - tests/bridges/hooks/settle.test.ts

key-decisions:
  - "Aggregate STOP-06 precedence realized via a new collectBucketOutcomes (option a: walk the bucket collecting outcomes) rather than a two-pass reduce -- executors run exactly once; the same activeExecutor seam drives it so _setExecutorForTest works unchanged"
  - "asyncRewake-on-Stop gated at collection (degrade to noop + hookDebugLog) rather than routed through a bespoke sync exec path -- the sync-bypass option was heavier than the hazard warrants; the degrade is pinned by a test"
  - "stop.ts required no code change -- the wave-1 draft already carried the final six-field shape; Task 2 delivered the shape-pinning fixture only"

patterns-established:
  - "Settle terminal-event adapter: collect all outcomes -> scan for any stop -> first block -> first additionalContext-mutate -> noop"

requirements-completed: [STOP-02, STOP-03, STOP-04, STOP-05, STOP-06]

coverage:
  - id: D1
    description: "Full Stop result adapter: block re-enters with reason (STOP-03); exit-2 rides the parseHookStdout block arm with no Stop-specific path (STOP-04); additionalContext-without-block re-enters via the same lane (STOP-05); any continue:false suppresses re-entry order-independently (STOP-06/D-88-05); empty bucket + asyncRewake degrade dispatch nothing"
    requirement: "STOP-03, STOP-04, STOP-05, STOP-06"
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/settle.test.ts (13 cases incl. exit-2 fixture, both aggregate orders, asyncRewake gate)"
        status: pass
      - kind: other
        ref: "npm run typecheck (tsc --noEmit)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stop stdin envelope carries exactly {session_id, transcript_path, cwd, hook_event_name:Stop, last_assistant_message, stop_hook_active}; background_tasks/session_crons asserted absent (not falsy); stop_hook_active:false round-trips verbatim; transcript_path empty on lazy session file"
    requirement: "STOP-02"
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/payloads/stop.test.ts (4 cases)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-07-30
status: complete
---

# Phase 88 Plan 02: Stop decision-control contract Summary

**The bespoke settle Stop adapter grows from the tracer's single block arm to the full four-arm contract -- block re-entry, exit-2 riding the same wire-protocol block arm, additionalContext-without-block re-entry, and D-88-05 aggregate `continue:false` precedence that suppresses re-entry whenever any hook signals stop regardless of another hook's block -- and the Stop stdin envelope is shape-pinned by a byte-stable fixture.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-30
- **Tasks:** 2 (both auto/tdd)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Added `collectBucketOutcomes` to `dispatch.ts`: runs EVERY matching entry with no first-block/stop short-circuit (unlike `reduceBucket`), reusing the same private `activeExecutor` seam so the `_setExecutorForTest` spy drives it. This is what makes the aggregate STOP-06 precedence expressible -- a short-circuited reduce would return the first block and never observe a later stop.
- Gated the `asyncRewake`-on-settle hazard (research A5) inside `collectBucketOutcomes`: an entry declaring `asyncRewake:true` cannot yield a synchronous decision, so it is degraded to `noop` with a `hookDebugLog` rather than a pointless detached spawn -- no silent block loss.
- Grew the settle Stop adapter to the full union: any `stop` suppresses re-entry (STOP-06); else first `block` re-enters with its reason (STOP-03; exit-2 rides this arm with no Stop-specific exit path, STOP-04); else first `mutate` carrying `additionalContext` re-enters via the same followUp+triggerTurn lane (STOP-05); else nothing. The `sendMessage` re-entry was extracted into a `reenter` helper.
- Extended `settle.test.ts` from 6 to 13 cases: exit-2 via a real `parseHookStdout(2,"","boom")` fixture, additionalContext re-entry, single continue:false, aggregate precedence in BOTH declaration orders, empty bucket, and the asyncRewake degrade.
- Pinned the Stop stdin envelope (STOP-02) with `tests/bridges/hooks/payloads/stop.test.ts` (4 cases): exact six-field JSON, `stop_hook_active:false` verbatim, `background_tasks`/`session_crons` asserted absent (not merely falsy), and lazy-session empty `transcript_path`.

## Task Commits

1. **Task 1: Complete the bespoke Stop result adapter** - `a2711ed7` (feat)
2. **Task 2: Pin the Stop stdin envelope shape (STOP-02)** - `50a4ae3f` (test)

## Files Created/Modified

- `bridges/hooks/dispatch.ts` - new `collectBucketOutcomes` + `BucketOutcome`; `hookDebugLog` import added
- `bridges/hooks/settle.ts` - `runStopBucket` rewritten over the full union via `collectBucketOutcomes`; `reenter` helper extracted; `reduceBucket` import swapped for `collectBucketOutcomes`
- `tests/bridges/hooks/settle.test.ts` - 7 new behavior cases + `makeStopEntry` async-rewake option + `parseHookStdout` import
- `tests/bridges/hooks/payloads/stop.test.ts` (new) - 4 envelope shape cases

## Decisions Made

- **Aggregate precedence via collection, not two-pass (D-88-05).** The plan offered (a) walk-and-collect or (b) two-pass reduce. Chose (a): `collectBucketOutcomes` runs each executor exactly once and returns every `{entry, result}`, then `settle.ts` scans for any stop before honoring a block. Two-pass would have run executors twice (unsafe against side effects). The new function reuses the existing `activeExecutor` seam, so no test wiring changed.
- **asyncRewake gated at collection (degrade, not sync-bypass).** The plan's recommended stance was a synchronous exec path for Stop; the fallback was a logged no-block degrade. Chose the degrade: an `asyncRewake:true` entry never reaches the executor -- it is logged and treated as `noop`. A bespoke sync-exec bypass of `dispatchHookExec`'s async branch was heavier than the hazard (a Stop hook rarely declares asyncRewake, A5) warrants. Pinned by a test asserting the executor is never invoked and no re-entry occurs.
- **`stop.ts` needed no code change.** The wave-1 draft already carried the final `StopStdin` six-field shape, the `StopEvent` synthetic, and the `background_tasks`/`session_crons` omission. Task 2's "finalize" reduced to writing the shape-pinning fixture.

## Deviations from Plan

### Auto-fixed Issues

**1. [Lint - not a deviation] optional-chain preference**
- ESLint `@typescript-eslint/prefer-optional-chain` flagged the `block !== undefined && block.result.kind === "block"` guards; rewritten to `block?.result.kind === "block"` (TS narrowing preserved). Fixed inline before commit.

### Notes (no scope change)

- `stop.ts` was not modified (see Decisions). The plan listed it under `files_modified`; its final shape predates this plan, so only the test is new. No behavior gap.

**Total deviations:** 0 substantive. One inline lint fix; one no-op file (stop.ts already final).

## Known Stubs

Carried over from wave 1, scoped to later plans (unchanged by this plan):

- `bridges/hooks/settle.ts` `runStopBucket` -- `stop_hook_active` is still hardcoded `false` in the synthetic Stop event; the loop-protection flag + 8-block cap land in **plan 03 (STOP-07)**.
- `bridges/hooks/settle.ts` settle gate `error`/`length` arms -- return without dispatch; the StopFailure observation arm lands in **plan 04 (SFAIL-01..03)**.

## Flagged Assumptions Resolved

The plan surfaced four unclassified edge rows; resolved as implemented:

- **STOP-02:** envelope is exactly `{common + last_assistant_message + stop_hook_active}`; no Pi-only field smuggled in (fixture-asserted).
- **STOP-03:** re-entry lane is `followUp`+`triggerTurn` in the settle (idle) state; the async-rewake `nextTurn` lane is not copied.
- **STOP-04:** exit-2 uses the event-agnostic `parseHookStdout` block arm; no Stop-specific exit handling (proven by a real `parseHookStdout(2,...)` fixture, not a hand-built result).
- **STOP-05:** `additionalContext`-without-block re-enters via the SAME `reenter` lane as a block (feedback content).

## Verification

- `npm run typecheck` -- green.
- `node --test tests/bridges/hooks/settle.test.ts tests/bridges/hooks/payloads/stop.test.ts` -- 17 pass, 0 fail.
- Spot-check `node --test tests/architecture/hooks-dispatch.test.ts` -- 10 pass (no subscription-count change, as expected).
- Spot-check `node --test tests/bridges/hooks/dispatch-exec.test.ts` -- 15 pass (dispatch.ts change is additive).
- All pre-commit hooks (prettier, eslint, typecheck, trufflehog) pass on the changed files.

## Next Phase Readiness

- Stop decision control is complete at hook-observable fidelity. Plan 03 (STOP-07) wires the real `stop_hook_active` flag + consecutive-block counter (D-88-06 semantics: block increments, any non-block including additionalContext resets) + the 8-block cap and cap-trip notify. Plan 04 fills the StopFailure `error`/`length` arm.
- No blockers.

## Self-Check: PASSED

- `tests/bridges/hooks/payloads/stop.test.ts` present on disk.
- Commits `a2711ed7` and `50a4ae3f` present in git history.

---
*Phase: 88-agent-settled-dispatcher-stop-contract-stopfailure*
*Completed: 2026-07-30*
