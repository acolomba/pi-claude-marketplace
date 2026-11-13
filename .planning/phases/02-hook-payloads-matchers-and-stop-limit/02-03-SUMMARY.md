---
phase: 02-hook-payloads-matchers-and-stop-limit
plan: "03"
subsystem: hooks
tags: [edit, preflight, atomic-batch, cucumber]
requires:
  - phase: 02-hook-payloads-matchers-and-stop-limit
    provides: Native hook input codec, routing, and Stop reset from plans 02-02 and 02-09
provides:
  - Per-pair Claude-shaped preflight for one native Pi edit call
  - Whole-batch stop, denial, conflict, fallback, and accepted-rewrite decisions
  - Real command-hook evidence for later-pair decisions and target conflicts
affects: [hook-results, edit-routing, PG-HOOK-01]
actuals:
  tokens: 15255
  tasks: 3
  commits: 3
commits: 3
plan_head_before: 309a45559e9f086d76198acae906b038a4c9e1bc
plan_head_after: 8964fa708ba63a3172ace1b9c2e607d9713160d4
tech-stack:
  added: []
  patterns:
    - Collect indexed hook outcomes before one native edit input replacement.
    - Resolve every accepted target against the original batch before execution.
key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts
    - test/bridges/hooks/tool-batch.test.ts
    - .planning/phases/02-hook-payloads-matchers-and-stop-limit/02-03-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
    - extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts
    - test/bridges/hooks/dispatch.test.ts
    - features/hook/tool-use.feature
    - features/lib/hook-files.ts
    - features/lib/hook-recorder.ts
    - features/step_definitions/hook/tool-use.steps.ts
key-decisions:
  - Preserve one Pi edit execution and allow each pair's hook to have its own side effects.
  - Let explicit stop, denial, or rejected ask dominate; then block accepted target conflicts before considering unsupported fallback.
patterns-established:
  - Match against original native input and fold completed pair outcomes in native index order.
requirements: [PG-HOOK-01]
requirements-completed: []
requirements-covered: [PG-HOOK-01]
coverage:
  - id: D1
    description: Every native edit pair receives a separate pre-hook view before one batch execution; accepted rewrites change only their pair.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#native-edit-runs-a-hook-for-each-pair-before-replacing-one-batch
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#A-hook-sees-each-edit-pair-before-the-batch-runs
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#An-edit-hook-rewrites-its-corresponding-pair
        status: pass
    human_judgment: false
  - id: D2
    description: Later-pair stop or denial blocks every edit, while an unsupported rewrite restores the entire original batch.
    requirement: PG-HOOK-01
    verification:
      - kind: e2e
        ref: features/hook/tool-use.feature#A-denial-of-the-second-edit-pair-leaves-the-whole-file-unchanged
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#A-stop-from-a-later-edit-pair-prevents-the-whole-call
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#An-unsupported-later-edit-pair-keeps-every-original-replacement
        status: pass
    human_judgment: false
  - id: D3
    description: Conflicting accepted targets block the batch, including unchanged pairs and conflicts accompanying unsupported proposals.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#conflicting-edit-targets-block-even-when-an-unsupported-proposal-follows
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#Edit-preflight-handles-Conflicting-accepted-edit-targets-block-the-whole-batch
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#Edit-preflight-handles-An-unchanged-edit-pair-prevents-a-conflicting-redirect
        status: pass
      - kind: e2e
        ref: features/hook/tool-use.feature#Edit-preflight-handles-An-unsupported-option-does-not-hide-conflicting-edit-targets
        status: pass
    human_judgment: false
  - id: D4
    description: Empty and malformed batches remain on Pi's validation path; duplicate values, reverse completion, reload, and cancellation cannot corrupt the transaction.
    requirement: PG-HOOK-01
    verification:
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#zero-and-malformed-edit-pairs-leave-native-validation-and-input-intact
        status: pass
      - kind: unit
        ref: test/bridges/hooks/dispatch.test.ts#reversed-hook-completion-still-commits-pair-rewrites-in-native-order
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts
        status: pass
    human_judgment: false
duration: "at least 18 min from first task commit"
completed: 2026-11-13
status: complete
---

# Phase 02 Plan 03: Atomic Edit Hook Preflight Summary

**Each native Pi edit batch now runs Claude-shaped hooks for every pair before one execution, with whole-batch decision precedence and target checks.**

## Performance

- **Duration:** At least 18 minutes from the first task commit; the earlier start time was not captured.
- **First recorded task commit:** 2026-11-13T02:07:06Z
- **Completed:** 2026-11-13T02:25:00Z
- **Tasks:** 3
- **Files modified:** 10 production and test files

## Accomplishments

- The dispatcher takes immutable indexed views of valid native edit pairs, selects matchers and `if` predicates from the original call, collects all hook responses, and replaces native input once after authorization and generation checks. One pair means one invocation; duplicate values still mean separate invocations.
- A later stop, denial, or rejected ask blocks the whole call. Accepted target conflicts block even when another candidate is unsupported. An unsupported rewrite without a stronger block discards every proposed rewrite, executes the original batch, and emits one sanitized notice.
- Real conditional command hooks prove file bytes and complete stdin rows for pair rewrites, later-pair decisions, fallback, and three conflicting-target cases. Reload, cancellation, and awaited asks cannot commit stale input.

## Task Commits

- **Task 1: 02-03-01 Per-pair transaction, pure batch decision, fixture, and first two real hook scenarios**: `1e07d0645248cf08fcec54d5f7c697c6cb32358f`
- **Task 2: 02-03-02 Three actual-hook later-pair decision scenarios**: `e9cf74c5a520721c86c316cea144b536d0444ddb`
- **Task 3: 02-03-03 Null-input guard, ordering and original-predicate tests, and three target-conflict scenarios**: `8964fa708ba63a3172ace1b9c2e607d9713160d4`

- **Task 3: Parent correction: translate the matcher Edit input assertion**: `f382b6bf61158cf020970c5cebbe95fa0140cdcc`

## Verification

- All four affected owner test modules passed together: dispatch, event-adapters, tool-batch, and tool-input. Direct coverage passed for all four source-test pairs.
- The eight named real command-hook scenarios passed together under the adapter profile: **8 scenarios, 131 steps**. They compare full hook run records and final file bytes.
- `npm run typecheck`, `npm run check:features`, Prettier, ESLint, `fallow guard`, and `fallow audit --base HEAD` passed. Each task's normal commit hook passed `npm run check:commit`; the final task's first commit attempt had only a gitlint message-length error, corrected on retry.
- The parent owns the Wave 4 combined-tree `npm run check` after merging this worktree, as assigned by the plan.

## TDD Evidence

- **02-03-01 RED:** The new unit regression on unchanged dispatch saw only the original native batch, rather than two pair-shaped invocations. **GREEN:** Pair routing, one native commit, direct coverage, and two real hook scenarios passed after implementation.
- **02-03-02:** The pair-sensitive fixture was needed by Task 1's live rewrite scenario and moved into its first commit. The three later-pair scenarios then passed against that transaction; no artificial failing commit was created after implementation already existed.
- **02-03-03 RED:** A null native edit input threw a dispatcher `TypeError` before Pi validation. **GREEN:** The null guard and all edge tests, direct coverage, and three conflict scenarios passed. The pure batch helper had already moved into Task 1 to meet direct coverage at its first commit.

## Scope Adjustments

- Task 1 included `tool-batch.ts`, its owner test, and the narrow conditional recorder fixture listed under later tasks. Its required live rewrite scenario and the repository's direct-coverage commit gate needed those consumed pieces together. Task 2 supplied the remaining fixture scenarios; Task 3 closed the null-input gap and added conflict and ordering evidence.
- Full hook-run assertions use the repository's existing “in any order” comparison because pair command processes can finish in either order. The comparison still checks every original row; native pair folding remains index ordered.

## Decisions Made

Per-pair hooks can repeat plugin side effects by the recorded D-PG2-01 decision. No second Pi edit call, package upgrade, tool wrapper, or new result translation was introduced.

## Deviations from Plan

**[Rule 3 - Blocking] Moved consumed helper and fixture into the first atomic task.** Task 1's behavioral rewrite and direct coverage required the pure batch helper and conditional recorder before that task could commit. The files were implemented with their first consumer in `1e07d0645248cf08fcec54d5f7c697c6cb32358f`, then verified by the later scenarios. No design or acceptance criterion changed.

**Total deviations:** 1 blocking allocation adjustment. **Impact:** The plan's full behavior and checks remain covered.

## Issues Encountered

- Local-socket sandbox permission initially prevented Cucumber from starting its harness; the real scenarios passed with normal permission escalation. The pinned optional test-peer cache was copied into ignored `node_modules/.cache/optional-peers`; tracked dependencies were untouched.
- Task 1's first commit hook exposed TypeScript and lint findings, which were fixed before its green commit. Task 3's first commit attempt failed gitlint solely for an overlong body line; the retry passed normal hooks.

## User Setup Required

None - no external service configuration is required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

All three task SHAs are ancestors of `plan_head_after`; the ten changed files and new helper owner exist, no tracked file was deleted, and the focused owner, direct-coverage, feature, and real command-hook checks above passed.

## Next Phase Readiness

Plan 02-03 is ready for the parent's Wave 4 merge and combined-tree `npm run check`. This plan covers part of PG-HOOK-01 and does not mark that requirement complete. Shared `STATE.md`, `ROADMAP.md`, and `REQUIREMENTS.md` remain parent owned.
