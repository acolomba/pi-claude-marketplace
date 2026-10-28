---
phase: 04-dependency-resolver-residue
reviewed: 2026-10-28T17:45:14Z
depth: standard
files_reviewed: 44
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/index.ts
  - extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts
  - extensions/pi-claude-marketplace/bridges/agents/marker.ts
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/bridges/agents/target-check.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
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
  - test/orchestrators/plugin/dependency-plan.test.ts
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
  warning: 0
  info: 0
  total: 0
status: clean
reviewed_commit: e56948b1b9cf8fdf148656646ee5b140381303e3
---

# Phase 04: Code Review Report

**Reviewed:** 2026-10-28
**Depth:** standard
**Files Reviewed:** 44
**Status:** clean

## Summary

Fresh post-fix review of the integrated implementation of RSV-01 through RSV-05 and
D-PL4-01 through D-PL4-07. The review followed all six plans through the current split
owners and their unit and behavioral tests. The previewed-commit pins, fresh-dependency
previews, recorded greedy-search limit, early agent-target refusal, no-match tag cleanup,
rollback-partial type, and move-refusal redaction remain consistent with their callers.

The previous critical ownership mismatch is closed. Preview and staging now call the same
`assertAgentNamesUnclaimed` rule over the foreign partition of the agents index, before
either path tests target files. A foreign claim therefore refuses even when its target is
missing. The two public regressions prove that a refusal on the second dependency leaves
every installed version, config and installation-record byte, staged skill byte, agent
file set, and index row unchanged. The previous rollback-partial comment is also accurate
after its obsolete apply claim was removed.

All reviewed files meet the applicable correctness, security, TypeScript, unit-test, and
Cucumber rules. No issues found.

## Narrative Findings (AI reviewer)

None.

## Previous finding disposition

| Finding                                                                           | Disposition | Evidence                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CR-01: foreign agent-index ownership refused only after an earlier move committed | Closed      | `assertAgentTargetsFree` retains both index partitions and calls the shared `assertAgentNamesUnclaimed` rule before disk checks. `prepareStagePluginAgents` calls the same rule. Unit coverage compares both typed refusals and proves neither writes. Install and update scenarios prove no dependency moves. |
| WR-01: rollback-partial contract said apply did not render it                     | Closed      | `InstallMissingDependencyOutcome.rollbackPartials` now documents only the failed undo steps and its omission rule. The stale apply statement is gone.                                                                                                                                                          |

## Scope and verification evidence

- Reviewed commit: `e56948b1b9cf8fdf148656646ee5b140381303e3` on branch
  `agent-reverify-a`, Node `v26.12.1`.
- The evaluation-scope resolver returned `degraded` / `phase-range` /
  `no-task-commit-rows` because later milestone history reuses the phase range. The review
  therefore retained the explicit 44-file Phase 4 contract scope derived from the six
  plans and followed current split owners and callers rather than accepting the resolver's
  unrelated milestone-wide union.
- CodeGraph traced the preview check through `previewInstall` and
  `assertUpdateNamesFree`, and traced staging through `prepareStagePluginAgents`.
  `discoverGeneratedNames` and staging both consume `discoverPluginAgents`, so both paths
  compare the same canonical generated names.
- The focused `index-mutation`, `target-check`, and `stage` bridge suites passed 49 of 49
  cases.
- Direct coverage for `index-mutation.ts`, `target-check.ts`, and `stage.ts` exited 0;
  every changed source-test pair retained 100% direct coverage.
- The focused public regressions passed 2 scenarios and 41 steps against local stand-ins.
- `fallow review --base 92501edf --brief` reported 0 dead-code, 0 complexity, and 0
  duplication findings. Its contract prompts were checked against the unchanged callers;
  the shared assertion changes behavior only for the previously missed foreign-claim arm.
- `git diff --check` passed. No source or test file was modified by this reviewer. The
  combined-tree `npm run check` remains the owning workflow's phase gate.

---

_Reviewed: 2026-10-28T17:45:14Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
