---
phase: 03-dependency-cascade-rows-and-status
reviewed: 2026-10-28T23:11:45Z
reviewed_commit: 4e3e7d1fb97804723a128f8cc142ccb8fdd44321
depth: standard
review_scope_complete: true
files_reviewed: 25
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/dependency-range.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - features/plugin/install-dependencies.feature
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - docs/dependency-resolution.md
  - test/orchestrators/plugin/install-cascade.test.ts
  - features/step_definitions/plugin/publishing.steps.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-28T23:11:45Z
**Commit:** `4e3e7d1fb97804723a128f8cc142ccb8fdd44321`
**Depth:** standard
**Files Reviewed:** 25
**Scope Complete:** yes
**Status:** clean

## Summary

The complete current Phase 3 scope was reviewed afresh at standard depth after CR-02 fix commit `43124fa7fb552c9c1942ab43596ce22563e3d539`. This is a full review, not only a recheck of the previous findings. All 25 listed files were read, including the complete ledger and cascade test modules, behavioral feature and publishing step, and dependency-resolution documentation. Imports, consumers, and relevant helpers were traced where needed.

The scope is the union of the prior report's canonical 24 files and all seven files changed by CR-02. The publishing step is the one additional file. No actionable correctness, security, or test-reliability defect was established. CR-01 and CR-02 are closed.

## Narrative Findings (AI reviewer)

None. Critical/BLOCKER: 0; WARNING: 0; informational findings: 0.

## Closed findings

### CR-01: Partial dependency status and unsupported reasons — closed

`install-cascade.ts:1249` projects each materialized member's own resolved compatibility and unsupported kinds. `install-cascade.messaging.ts:234` composes the member independently and retains `partially-installed` with narrowed unsupported reasons. Root row composition remains separate.

The full-row assertions in `install-cascade.messaging.test.ts:154`, the cascade projection test, real-ledger cases, and `install-dependencies.feature` cover an installed requester beside a partial dependency. Unsupported kinds coalesce through the existing reason mapper. Partial status survives the current-copy and re-enable paths, including an unavailable companion.

### CR-02: Malformed-frontmatter dependency degradation — closed

`install-cascade.ts:1266` now carries `ledgerDegradationSignals(summary)` through the member interfaces. The helper at `install-outcome.ts:1732` derives these facts from the member ledger. `install-cascade.messaging.ts:246` preserves orphan rewake, appends ordered and deduplicated malformed-kind reasons, and raises malformed content to warning independently of companion availability.

Composer regressions at `install-cascade.messaging.test.ts:535` cover malformed skills, malformed commands, repeated/reversed kinds, orphan-only behavior, and combinations with partial status and origin reasons. Real-install cases at `install-flow-ledger.test.ts:15445` compare the complete notification for a malformed skill dependency and a partial dependency with a malformed command. Both keep the requester installed and verify enabled persisted records for requester and dependency.

The Cucumber scenario at `install-dependencies.feature:29` asserts the complete warning payload and both plugin rows. Its publishing step at `publishing.steps.ts:189` writes malformed frontmatter through the existing publication helper and verifies the bytes. The projection assertion at `install-cascade.test.ts:468` confirms degradation signals reach the dependency outcome without contaminating the root summary.

## Combination and integration checks

| Area | Result of source and test review |
| --- | --- |
| Partial status and root independence | Each member uses its own compatibility; a partial or degraded dependency does not change the requester's installed status. |
| Malformed skill/command reasons | Shared mapping orders skill before command and removes duplicates; origin reasons precede orphan and malformed reasons. |
| Degraded plus partial | Warning severity and malformed reasons remain alongside partial status and narrowed unsupported reasons. |
| Current-copy and re-enable | Current-copy retains its reason; re-enable retains already-installed and dependency-enabled reasons, including partial/degraded combinations. |
| Orphan-only severity | Orphan rewake adds its reason without independently raising severity. |
| Companion severity | Missing companions still raise warnings for otherwise informational and partial members; malformed content also warns when companions are available. |
| Persisted records | Ledger persistence retains actual compatibility, supported/unsupported resources, enabled state, and provenance; row composition does not rewrite those records. |
| Wider Phase 3 paths | Closure traversal, cycle and policy guards, range attribution, dependency moves, rollback/failure rows, ordering, escaping, installed-state classification, candidate versions, and MCP notices were reviewed in context. |

The behavioral assertions and documentation agree with the reviewed result model. No additional actionable defect was established in the surrounding source or test paths.

## Verification and limits

- The orchestrator supplied a fresh passing combined-tree `npm run check` at the exact reviewed commit, using Node v26.12.1: all static checks passed; 1123/1123 Cucumber scenarios and 11442/11442 steps passed; direct coverage merged 309 records; exit 0. This report reuses that supplied gate evidence. The reviewer did not rerun the gate or run additional tests.
- CodeGraph was used first. Its response identified changed files whose indexed source was not current; direct file reads and `rg` call-site inspection supplied current-source evidence. No fresh structural pre-pass was supplied, and no historical Fallow findings are attributed to this review.
- The worktree was clean at the reviewed commit before this report was written. The review changes only this report; no source, test, or gate input was modified, and no commit was made.
- This standard-depth review and the supplied automated gate do not prove absence of defects. No live Pi session, external-network exercise, or additional end-to-end runtime test was performed by the reviewer. No specific unresolved release risk was identified within this scope.

---

_Reviewer: gsd-code-reviewer_
_Reviewed: 2026-10-28T23:11:45Z_
_Depth: standard; complete 25-file scope_
