---
phase: 04-dependency-resolver-residue
reviewed: 2026-10-29T12:58:00Z
depth: standard
files_reviewed: 62
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
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - features/lib/published-marketplace.ts
  - features/plugin/apply.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/staging-warnings.feature
  - features/plugin/update-dependencies.feature
  - features/plugin/update.feature
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
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/marketplace-tag-probe.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/reconcile/apply.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
reviewed_commit: 85e1cad2
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-29
**Depth:** standard
**Files Reviewed:** 62
**Status:** clean

## Summary

The final integrated implementation satisfies the Phase 4 contract. Fresh git members and
the install root still carry the commit returned by their preview into the ledger pin; the
move planner completes every judge and preview before it runs a step; occupied agent targets
still refuse before a move or dependency install mutates state; and the range-free
`no-matching-tag` and declared `rollbackPartials` contracts remain intact.

The later dependency-diagnostic integration does not weaken those guarantees.
`runDependencyMove` still materializes exactly the planned version and owns its row, while
the new diagnostic carrier remains separate from rows and causes. `runDependencySteps`
retains row, notice, and diagnostic order on success and failure; `materializeLatestVersion`
keeps the settlement rows on both refusal and post-settle swap failure; and direct,
marketplace, and apply renderers consume the carrier without rerunning planning or changing
the settled state. Clone cleanup still considers only attempt-owned or superseded keys and
rechecks live ownership under the scope lock.

No correctness, security, or maintainability defect was verified in the 62-file retained
plus final-head integration scope.

## Narrative Findings (AI reviewer)

All reviewed files meet the Phase 4 correctness, security, and quality requirements. No
BLOCKER or WARNING findings remain.

## Previous finding disposition

| Finding | Disposition | Evidence |
| --- | --- | --- |
| CR-01: foreign agent-index ownership refused only after an earlier move committed | Closed | Preview and staging call the same foreign-index ownership rule before target-file checks; install and update scenarios preserve all state and artifact bytes. |
| WR-01: rollback-partial contract said apply did not render it | Closed | `InstallMissingDependencyOutcome.rollbackPartials` describes the failed undo steps only, and the catch projects the captured partials. |
| WR-01: settle module said move notices and warnings were discarded | Closed | `782b1d70` documents the forwarding behavior already enforced by the settle and move owners and their tests. |

## Scope and verification evidence

- Reviewed commit: `85e1cad2` on `agent-reverify-a`.
- The evaluation-scope resolver returned `degraded` / `phase-range` /
  `no-task-commit-rows`. The review therefore retained the prior explicit 52-file Phase 4
  scope and added ten current diagnostic-carrier consumers and owners that can affect the
  dependency move/update/apply paths.
- Forty-three files from the prior complete baseline at `efe2bca7` remain byte-identical.
  The nine changed baseline files and ten added integration files were re-read against their
  current call paths and owner assertions.
- CodeGraph was consulted first and supplied the call graph, but marked the current planning
  and settlement owners stale; those files were read directly from disk.
- The final Nyquist audit passed 13 current owner modules and four Phase 4 scenarios:
  4/4 scenarios, 57/57 steps, and 16/16 hooks. RSV-01 through RSV-05 remain covered without
  an evidence gap.
- The unchanged-input full gate supplied by the owner passed 1,145 scenarios, 11,777 steps,
  and 309 LCOV records at executable head `be0de0c3`.
- The clone-cleanup oracles distinguish a cold clone owned by the attempt, a warm entry,
  an exact-key race winner, an unrelated concurrent entry, a superseded live record, and
  a ruled-out backtracking candidate.
- The final-head settlement tests distinguish dependency-row ownership from diagnostic
  ownership, keep discovery and hygiene warning tags, and assert normal and phase-3a abort
  ordering without replacing the Phase 4 state and artifact assertions.
- `fallow guard` confirmed the applicable orchestrator boundaries. `fallow security`
  produced no verified Phase 4 vulnerability; its untrusted-path candidates were outside
  the changed production scope or already constrained test-fixture paths.
- `git diff --check` passed. No source or test file was modified by this reviewer.

---

_Reviewed: 2026-10-29T12:58:00Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
