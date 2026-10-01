---
phase: 12-standalone-prune-with-dry-run
plan: "02"
subsystem: plugin-lifecycle
tags: [prune, dependency, uninstall, regression-tests]
requires:
  - phase: 12-standalone-prune-with-dry-run
    provides: Plan 01 standalone prune operation and shared guarded sweep
  - phase: 06-load-time-dependency-check-and-allowed-uninstall
    provides: Allowed named uninstall with surviving-dependent reporting
provides:
  - Direct standalone prune coverage for whole-scope fixpoint order and held records
  - Direct failed-member containment, scope isolation, and retry assertions
  - Full-scope declaration-index and allowed named-uninstall regression pins
affects: [12-03, 12-04, 12-07]
actuals:
  tokens: 3183
  tasks: 2
  commits: 2
plan_head_before: d137a0326f5c8f0425bc4c1d7a5b8f89e30d8636
tech-stack:
  added: []
  patterns:
    - Assert the actual selector order through rendered rows and persisted state
    - Exercise an injected member failure through the production transaction
key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/prune.test.ts
    - tests/orchestrators/plugin/dependency-index.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
key-decisions:
  - The existing Plan 01 sweep needed no source change; direct regression tests pin its behavior.
requirements-completed: [PRUNE-06]
coverage:
  - id: D1
    description: Standalone prune removes the complete same-scope fixpoint in literal order while retaining explicit, held, and disabled-declarer-held records.
    requirement: PRUNE-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/prune.test.ts#removes the whole project-scope fixpoint in literal order and leaves held records staged
        status: pass
    human_judgment: false
  - id: D2
    description: A failed member holds its descendants while independent orphans commit and report their outcomes.
    requirement: PRUNE-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/prune.test.ts#a failed member keeps its dependent chain while an independent orphan commits
        status: pass
    human_judgment: false
  - id: D3
    description: Full-scope indexing includes all declarers, and named uninstall sweeps only after a successful primary removal.
    requirement: PRUNE-06
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/dependency-index.test.ts#standalone indexing includes every installed declarer without an exclusion
        status: pass
      - kind: unit
        ref: tests/orchestrators/plugin/uninstall.test.ts#allowed named uninstall prunes only after the depended-on primary leaves
        status: pass
      - kind: unit
        ref: tests/orchestrators/plugin/uninstall.test.ts#a failed named uninstall does not sweep a pre-existing orphan
        status: pass
    human_judgment: false
duration: 51min
completed: 2026-09-23
status: complete
---

# Phase 12 Plan 02: Actual prune regression summary

Direct tests now pin the standalone whole-scope fixpoint, failed-member holds, and the allowed named-uninstall boundary against the existing shared sweep.

## Accomplishments

- Verified alternating-marketplace fixpoint rows in literal selector order, full persisted state, staged skills and data cleanup, opposite-scope byte stability, and a byte-stable repeat run.
- Verified that a failed member remains installed and holds its dependency while an independent orphan is removed and reported.
- Verified full-scope indexing without an exclusion, then pinned allowed named removal followed by pruning and a failed primary that triggers no sweep.

## Task Commits

1. **Task 1:** `8e39b31d` — standalone fixpoint and failed-member direct tests.
2. **Task 2:** `04ab1ec2` — full-scope index and named-uninstall regressions.

The measured commit count from `plan_head_before` through Task 2 is two.

## Verification

- Focused direct suite: 119/119 pass, with FIFO access enabled for an existing uninstall fixture.
- Direct coverage: `prune.ts` 111/111 lines, 14/14 branches, 4/4 functions; `uninstall.ts` 1304/1304 lines, 125/125 branches, 28/28 functions; `dependency-index.ts` 276/276 lines, 30/30 branches, 6/6 functions.
- `npm run typecheck`, `node --test tests/architecture/no-orchestrator-network.test.ts`, targeted ESLint, and changed-file Prettier all pass.
- Changed-file pre-commit passed for each task with the approved `SKIP=trufflehog,npm-format-check` environment. Task 2's pre-commit needed FIFO access for its direct coverage hook. Fallow base audit passed; the agent-marker audit returned a JSON temporary-worktree error, classified nonblocking by `AGENTS.md`.

## Deviations from Plan

- The planned cases passed the existing Plan 01 implementation after exact output expectations were corrected, so no production module changed. The initial failed assertions expected grouped rows and the wrong failure banner; they were invalid RED evidence. There was no RED/GREEN source cycle or behavioral source change in this plan.
- The plan's three-source direct coverage command does not match the repository CLI's one-source interface. Each source/test pair was run separately and passed.
- The executor's generic per-agent worktree branch guard did not match this orchestrator-owned `features/manifest` checkout. The orchestrator performed both scoped task commits after the executor ran the required gates; the branch stayed on `features/manifest`.

## TDD Gate Compliance

Both tasks were marked `tdd="true"`, but their requested behavior already existed in Plan 01. The first new assertions failed only because their literal output expectations were wrong. Those failures were corrected rather than counted as RED; no false RED-evidence claim or unnecessary source change was made. The two task commits are test-only regression commits.

## Issues Encountered

The sandbox refused the existing uninstall test's `mkfifo` fixture with `EPERM`. Focused tests, direct coverage, and Task 2 pre-commit passed when rerun with FIFO access. No test was skipped.

## Next Plan Readiness

Preview work can use the full-scope declaration and guarded-sweep seams with direct coverage at 100% for all three production modules.

## Self-Check: PASSED

The summary and all three changed direct test files exist. Both task commits exist, and `git rev-list` measures two commits from `plan_head_before` through Task 2.
