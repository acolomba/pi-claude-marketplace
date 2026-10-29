---
phase: 04-dependency-resolver-residue
plan: 01
subsystem: plugin-lifecycle
tags: [agents-bridge, dependency-plan, update-swap, install-preview]
status: complete

requires: []
provides:
  - "bridges/agents/target-check.ts: assertAgentTargetsFree(locations, owner, generatedNames), write-free"
  - "update-swap.ts: module-private assertNamesFree (names only, used by the swap) and exported assertUpdateNamesFree (names, then agent targets)"
  - "previewInstall refuses an occupied agent target"
affects: [dependency-move judge, settleUpdateDependencies WR-C check, install plan previews]

actuals:
  tokens: 5087
  tasks: 2
  commits: 2
plan_head_before: 2829db687ce758b26a4a645d9fea7ad0af129c9f
plan_head_after: 26c91edf9acadf6c011b99bd2845d57e9b90c301

tech-stack:
  added: []
  patterns:
    - "A write-free precheck mirrors a commit's refusal rule and throws its exact message"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/agents/target-check.ts
    - test/bridges/agents/target-check.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/index.ts
    - test/bridges/agents/index.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - test/orchestrators/plugin/update-swap.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - test/orchestrators/plugin/install-outcome.test.ts

key-decisions:
  - "The swap keeps the names-only check (assertNamesFree), so reinstall's forced overwrite of a user-edited own agent (RINST-01, D-18-15) still works; assertAgentCommitTargets stays the commit-time backstop"

patterns-established: []

requirements-completed: [RSV-04]

metrics:
  completed: 2026-10-26
---

# Phase 4 Plan 01: Occupied agent target refusal Summary

A new write-free agents-bridge check, `assertAgentTargetsFree`, applies the agents commit's non-forced refusal rule (the agents index plus the AG-5 marker check). `assertUpdateNamesFree` and `previewInstall` now run it, so the move judge, the update's WR-C check, and install plan previews refuse a user's file at an agent target before any move lands (D-PL4-04).

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 (tracer) | 92eb099a | fix(plugin): refuse an occupied agent target before a dependency moves |
| 2 | 26c91edf | fix(plugin): refuse an occupied agent target before an install plan runs |

TASK_SHA for Task 1: `92eb099a`. `git diff --stat 92eb099a^..92eb099a -- dependency-move.ts install-flow.ts stage.ts` prints nothing.

## Verification

- RED first: the two `assertUpdateNamesFree` cases and the `previewInstall` case failed before their production edits.
- `node --test` on target-check, the agents barrel, update-swap, and dependency-move tests: 305/305 pass. The unchanged D-18-15 overwrite case is green.
- `node --test` on install-outcome and install-flow tests: 369/369 pass.
- `npm run test:coverage:direct` exits 0 for target-check.ts, update-swap.ts, and install-outcome.ts. bridges/agents/index.ts has no runtime code that coverage reads; its binding case passes.
- Both commit hooks passed (`check:commit`).
- Tracer gate: auto mode. The task 1 `<verify>` passed end to end before Task 2 started.

## Deviations from Plan

**1. [Rule 1 - Lint] Void-result assertions use `assert.doesNotReject`**
- **Found during:** Task 1, first commit attempt
- **Issue:** `const checked = await <void fn>(); assert.strictEqual(checked, undefined)` failed `@typescript-eslint/no-confusing-void-expression`.
- **Fix:** the admit cases assert `await assert.doesNotReject(...)`, the form `stage.test.ts` already uses.
- **Files:** test/bridges/agents/target-check.test.ts, test/orchestrators/plugin/update-swap.test.ts
- **Commit:** 92eb099a

**2. Commit title wording.** The plan's example title for Task 2 was 73 characters, and gitlint allows 72. The title ends in "runs" instead of "moves".

No fallow clone group came up, so no test helper extraction was needed.

## Files Edited Outside the ROADMAP Files Line

- `extensions/pi-claude-marketplace/bridges/agents/target-check.ts` (new)
- `test/bridges/agents/target-check.test.ts` (new)
- `extensions/pi-claude-marketplace/bridges/agents/index.ts` (one export line)
- `test/bridges/agents/index.test.ts` (one barrel binding case)

No file outside the plan's `files_modified` list was touched.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/bridges/agents/target-check.ts
- FOUND: test/bridges/agents/target-check.test.ts
- FOUND: 92eb099a (ancestor of HEAD)
- FOUND: 26c91edf (ancestor of HEAD)
