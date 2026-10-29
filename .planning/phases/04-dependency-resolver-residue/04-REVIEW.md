---
phase: 04-dependency-resolver-residue
reviewed: 2026-10-29T03:34:12Z
depth: standard
files_reviewed: 52
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/index.ts
  - extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts
  - extensions/pi-claude-marketplace/bridges/agents/marker.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/target-check.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - features/lib/published-marketplace.ts
  - features/plugin/install-dependencies.feature
  - features/plugin/update-dependencies.feature
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/support/pi-process.ts
  - features/support/world.ts
  - test/bridges/agents/index.test.ts
  - test/bridges/agents/stage.test.ts
  - test/bridges/agents/target-check.test.ts
  - test/domain/release-tag.test.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/clone-gc.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/dependency-tag-probe.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/marketplace-tag-probe.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
reviewed_commit: 9882f1eb
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-29
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

The final merged implementation still satisfies the substantive Phase 4 contract. Fresh
git members and the install root carry the commit returned by their preview into the
ledger pin; the move planner completes every judge and preview before it runs a step;
agent file and foreign-index ownership refusals remain write-free; and the range-free
`no-matching-tag` and `rollbackPartials` contracts remain intact.

The integrated clone-cleanup changes also preserve those guarantees. A planning attempt
collects only clone keys it created or may supersede, the sweep takes a fresh scope lock
and re-reads live records, warm and exact-key race winners are not claimed, and unrelated
cache entries are outside the candidate set. The focused refusal scenarios still compare
record/config bytes and staged artifacts, so a premature move cannot hide behind row-only
assertions.

One merged documentation contract is now stale. It contradicts the code that forwards
dependency-move notices and warnings, which risks a later cleanup removing behavior the
tests and result types now require.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The settle module says move notices and warnings are discarded after it began forwarding them

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts:27-30`

**Issue:** The module contract says that MCP notices and staging warnings from a dependency
move “are not reported.” `runStep` now copies `moved.mcpConfigNotices` and
`moved.stagingWarnings` into `StepRun` at lines 143-155, and `runDependencySteps` folds
them into both success and failure results. The comment therefore documents the opposite
of the current API contract. A maintainer following it could remove the forwarding as
supposed dead behavior or add a second reporting path and duplicate user-visible output.

**Fix:** Rewrite the paragraph to say that closure slices and dependency moves contribute
their MCP notices and staging warnings in step order, with the move row retaining ownership
of any package note filtered by `runDependencyMove`.

## Previous finding disposition

| Finding | Disposition | Evidence |
| --- | --- | --- |
| CR-01: foreign agent-index ownership refused only after an earlier move committed | Closed | Preview and staging call the same foreign-index ownership rule before target-file checks; install and update scenarios preserve all state and artifact bytes. |
| WR-01: rollback-partial contract said apply did not render it | Closed | `InstallMissingDependencyOutcome.rollbackPartials` describes the failed undo steps only, and the catch projects the captured partials. |

## Scope and verification evidence

- Reviewed commit: `9882f1eb` on `agent-reverify-a`.
- The evaluation-scope resolver returned `degraded` / `phase-range` /
  `no-task-commit-rows`. The review retained the prior explicit 44-file Phase 4 scope and
  added the eight integrated clone-ownership/settlement owners and tests that can change
  preview, refusal, cleanup, or concurrency behavior.
- CodeGraph was consulted first, but marked the integrated planning owners stale; their
  current source was therefore read directly.
- The final Nyquist audit passed all 11 focused owner modules and four Phase 4 scenarios
  (57 steps). The unchanged-tree full gate supplied by the owner passed 1,142 scenarios,
  11,734 steps, and 309 LCOV records.
- The clone-cleanup oracles distinguish a cold clone owned by the attempt, a warm entry,
  an exact-key race winner, an unrelated concurrent entry, a superseded live record, and
  a ruled-out backtracking candidate.
- `fallow guard` confirmed the applicable orchestrator boundaries. `fallow review` could
  not create its temporary comparison worktree in the restricted sandbox, so no Fallow
  review verdict is claimed.
- `git diff --check` passed. No source or test file was modified by this reviewer.

---

_Reviewed: 2026-10-29T03:34:12Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
