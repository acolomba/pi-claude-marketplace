---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "04"
subsystem: hooks
tags: [edit, result-hooks, async, cucumber]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Native edit pair views and atomic preflight from plan 02-03
provides:
  - Per-pair successful and failed result hook delivery with one actual native outcome
  - Real command-hook evidence for shared success, immutable failure, and background lanes
affects: [hook-results, PG-HOOK-01]
actuals:
  tokens: 9853
  tasks: 3
  commits: 4
commits: 4
plan_head_before: b678a4cc114844af01661907e7c526b6640483e5
plan_head_after: db6c7af1b2d9b100d5379f9a89de864249405f8b
tech-stack:
  added: []
  patterns:
    - Result hooks receive indexed pair input with shared native result carriers.
    - Pair outcomes fold once in pair order, then routing order.
key-files:
  created:
    - .planning/phases/02-hook-payloads-matchers-and-stop-limit/02-04-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - test/bridges/hooks/dispatch.test.ts
    - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
    - features/hook/tool-use.feature
    - features/hook/tool-failure.feature
    - features/hook/async.feature
    - features/step_definitions/hook/async.steps.ts
    - features/step_definitions/hook/runs.steps.ts
key-decisions:
  - Use the executed native result input to build pair views, including accepted preflight rewrites.
  - Keep the existing sync and background translators; both already serialize the selected pair event.
requirements: [PG-HOOK-01]
requirements-completed: []
requirements-covered: [PG-HOOK-01]
coverage:
  - id: D1
    description: Each successful edit result hook receives its pair input and the same actual batch result; one ordered replacement reaches the model.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#delivers-one-actual-edit-result-to-each-pair-before-folding-replacements
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#Every-edit-result-hook-receives-the-same-actual-batch-result
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#An-earlier-edit-result-rewrite-does-not-change-later-hook-stdin
        status: pass
    human_judgment: false
  - id: D2
    description: Each failed edit pair receives the actual error, while a hook replacement cannot turn the failure into success.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#gives-duplicate-edit-pairs-the-same-failure-without-accepting-output-changes
        status: pass
      - kind: e2e
        ref: features/hook/tool-failure.feature#Failed-edit-hooks-receive-each-pair-and-the-same-actual-error
        status: pass
      - kind: e2e
        ref: features/hook/tool-failure.feature#A-failed-edit-hook-cannot-replace-the-failed-result
        status: pass
    human_judgment: false
  - id: D3
    description: Plain async and async rewake hooks record every pair through their shared translators without changing the completed edit.
    requirement: PG-HOOK-01
    verification:
      - kind: e2e
        ref: features/hook/async.feature#Background-edit-hooks-receive-every-translated-pair
        status: pass
      - kind: unit
        ref: test/bridges/hooks/async-rewake/registry.test.ts#settles-rewake-with-stale-generation-and-persists-terminal-cleanup
        status: pass
    human_judgment: false
  - id: D4
    description: A generation change during result dispatch prevents later stale pair hooks from starting.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#drops-every-edit-pair-result-when-the-hook-generation-changes
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
        status: pass
    human_judgment: false
duration: "at least 17 min from first task commit"
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 04: Shared Edit Results and Background Delivery Summary

**Every edit pair hook now receives its own executed input with the one actual native result or error, while the model receives one final outcome.**

## Performance

- **Duration:** At least 17 minutes from the first task commit; the earlier start time was not captured.
- **First task commit:** 2026-11-13T03:15:30Z
- **Completed:** 2026-11-13T03:32:54Z
- **Tasks:** 3
- **Production and test files changed:** 8

## Accomplishments

- Successful edit result hooks receive one Claude-shaped input per executed pair and share the same native content, details, and structured content. Their outcomes fold once in pair and routing order, so an earlier replacement does not alter later hook stdin.
- Failed edit hooks receive the same actual error for every pair. The failure remains classified and model-visible as failed when a hook proposes success; a real missing second pair leaves the file unchanged.
- Real plain async and async rewake command hooks record all pair payloads and lifecycle events. Their completion does not rewrite the already executed native edit or produce a rewake for an ordinary exit.
- A generation change while one pair dispatches prevents later stale pair hooks from starting.

## Task Commits

- **Task 1: 02-04-01 Shared successful result dispatch, owner regression, two real hook scenarios**: `4c2eff3ab29c8332239dcdbe66f2ffa53826e24b`
- **Task 2: 02-04-02 Failure immutability, duplicate and image cases, two real failure scenarios**: `68fe3a252e95732f25ae256caf4aca58d56a8667`
- **Task 3: 02-04-03 Plain async and rewake recording with full lifecycle comparison**: `51c5675dd3b511a66997bc785fe0467acb24e3a4`
- **Task 1: 02-04-01 correction Stop stale later-pair launches after synchronous generation change**: `db6c7af1b2d9b100d5379f9a89de864249405f8b`

## Verification

- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch.test.ts test/bridges/hooks/tool-batch.test.ts` — PASSED.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch.test.ts test/bridges/hooks/payloads/post-tool-use-failure.test.ts` — PASSED.
- `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/hooks/dispatch-exec.test.ts test/bridges/hooks/async-rewake/registry.test.ts` — PASSED.
- Direct coverage for `dispatch.ts`, `post-tool-use-failure.ts`, `dispatch-exec.ts`, and `async-rewake/registry.ts` — PASSED. The normal task commit hooks also passed the staged coverage gates.
- Five named success, failure, and background real command-hook scenarios after the final generation correction — **5 scenarios, 82 steps PASSED**. The full failure feature passed **12 scenarios, 175 steps**; the full async feature passed **19 scenarios, 294 steps**. `npm run check:features` passed.
- `fallow audit --base HEAD` passed after each task and after the generation correction. Every production and test commit passed its normal `check:commit` hook. The parent owns Wave 5's combined-tree `npm run check` after merging this worktree.

## TDD Evidence

- **02-04-01 RED:** The new dispatcher test saw two native batch events where four pair events were expected. **GREEN:** The dispatcher fan-out, direct coverage, and real success scenarios passed.
- **02-04-02:** The generalized result fan-out from Task 1 already served the failed branch. New unit and real failed-edit regressions passed without another production change; no artificial failing commit was made.
- **02-04-03:** Both existing execution lanes already serialize the selected event through the shared translators. New real background evidence passed without altering their source or lifecycle policy.
- **02-04-01 correction RED:** A generation-changing executor still started two pair hooks; the regression required one. **GREEN:** The shared generation guard stopped the second launch, and all five real edit-result scenarios passed.

## Decisions Made

The dispatcher builds pair views from the result event's executed input, so an accepted preflight rewrite is what result hooks see. It passes the same actual result carriers to every pair. The existing translator tables and background registry required no production changes. Result codecs remain assigned to later plans.

## Deviations from Plan

**[Rule 1 - Bug] Prevent a stale pair hook launch after a generation change.** Found during final review of Task 3. The initial fan-out discarded stale outcomes but could start a later pair after the first executor synchronously changed generation. Capturing one generation and checking it before each pair launch fixed the side effect in `dispatch.ts`; the owner regression and five real scenarios passed. Committed in `db6c7af1b2d9b100d5379f9a89de864249405f8b`.

**[Rule 3 - Blocking] Add event-driven completion and unordered lifecycle comparison to the behavioral fixture.** Task 3 needed a complete, race-free record of six background processes. The new wait reads actual run and lifecycle logs until all six complete; the comparison checks every lifecycle row without assuming process completion order. The full async feature passed. Committed in `51c5675dd3b511a66997bc785fe0467acb24e3a4`.

**Total deviations:** 2 auto-fixed (one bug, one fixture requirement). **Impact:** Both are directly required for truthful result delivery and deterministic evidence.

## Issues Encountered

- The first success and background commit attempts exposed type or lint findings; they were corrected and their normal hooks passed on retry. No hook was bypassed.
- The sandbox denied the Cucumber harness's loopback socket; the real scenarios passed with ordinary permission escalation. The parent's ignored optional-peer cache was copied into this worktree, with no dependency-file change.
- The known ASYNCLIFECYCLE-01 intermittent cleanup and rewake failures did not reproduce in the planned owner and full async feature runs. Existing assertions and timeouts were preserved; this plan does not claim that backlog item is resolved.

## User Setup Required

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Plan 02-04 is ready for the parent's Wave 5 merge and combined-tree gate. PG-HOOK-01 remains partial; later plans own the result codecs and remaining translation work.

## Self-Check: PASSED

- All eight changed production and test files exist, all four task/correction commits are ancestors of this worktree's HEAD, and the focused result and background checks passed.

---
*Phase: 02-hook-payloads-matchers-and-stop-limit*
*Completed: 2026-11-13*
