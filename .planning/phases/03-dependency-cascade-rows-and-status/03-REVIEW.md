---
phase: 03-dependency-cascade-rows-and-status
reviewed: 2026-10-29T03:17:31Z
reviewed_commit: 5c42ac88f81989defc070a371c4c16847f4005e3
depth: standard
review_scope_complete: true
scope_resolution: degraded
files_reviewed: 37
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
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - features/plugin/install-dependencies.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - docs/dependency-resolution.md
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-29T03:17:31Z
**Commit:** `5c42ac88f81989defc070a371c4c16847f4005e3`
**Depth:** standard
**Files Reviewed:** 37
**Scope Complete:** yes
**Status:** clean

## Summary

The complete Phase 3 implementation and its final merged integration surface were reviewed at standard depth. The canonical 25-file Phase 3 scope was rechecked against CAS-01 through CAS-07, the six plans, recorded decisions, and the current merged source. The review also covered the 12 reconcile and owner-test files through which later phases changed dependency planning, move execution, ledger result projection, `apply`, and notification composition after the prior clean review.

The evaluation-scope resolver reported `degraded` because it could not recover reachable task commits for this phase. The explicit scope therefore uses the prior complete Phase 3 review list plus every final-merge source/test integration file that can change Phase 3 rows, causes, rollback details, notices, or state. No actionable correctness, security, or test-reliability defect was established.

## Narrative Findings (AI reviewer)

None. Critical/BLOCKER: 0; WARNING: 0; informational findings: 0.

## Requirement and decision checks

| Contract | Integrated review result |
| --- | --- |
| CAS-01: complete failed closure | Walk, constraint, scheduler, plan-step, and member-ledger failures retain every resolved but unmaterialized member. `composeUnmaterializedRows` removes duplicate root, subject, moved, and repeated keys while preserving one cause-less `{dependency failed}` row per remaining member. Later dependency-plan notice and clone-cleanup changes do not alter that projection. |
| CAS-02: invalid root identity | Root lookup still distinguishes an unlisted plugin from a listed invalid ID. The invalid ID is escaped through `printable`; apply/import's recorded classification limit remains explicit and does not change the install contract. |
| CAS-03: partial member status | `recordMaterializedMember` derives `unsupported` from that member's own ledger summary. `composeCascadeMemberRow` selects `partially-installed` independently of the requester and retains origin, orphan, malformed, unsupported, and companion signals in their documented channels. List/info use the persisted compatibility record rather than inheriting a dependent's status. |
| CAS-04: git-source list state | Candidate resolution and installed-row classification still preserve the recorded D-PL3-07 divergence. None of the merged dependency-move or clone-ownership changes bypasses that classifier. |
| CAS-05: declarers and truncation | Non-root directory-pin failures take range-bearing declarers from the in-closure declaration map and order them by reverse closure post-order. The root keeps its supplied declarers. Plugin, listed-version, declarer, range, and joined-range fields pass through their bounded renderers without exposing raw oversized input. |
| CAS-06: offline move remedy | The update command is appended only when the root directly declared the refused dependency and the same refusal would not block update. A moved dependency's package warning and other diagnostics retain their correct row ownership without changing this condition. |
| CAS-07: bounded versions | Hold, excluded-plan, and installed-unsatisfied causes continue to route catalog versions through `truncateForRefusal`; range rendering remains bounded and surrogate-safe. No merged call site reintroduced an unbounded version interpolation. |

## Integrated row and recovery checks

| Area | Result |
| --- | --- |
| Member/declarer/degradation signals | Fresh, re-enabled, current-copy, partial, orphan-rewake, malformed-frontmatter, and declared-companion signals remain independently derived. Ordered deduplication prevents repeated malformed tokens without losing coexisting origin or unsupported reasons. |
| Row status and severity | Each member's own compatibility selects installed versus partially installed. Malformed content and missing declared companions raise only that row. A partial or degraded dependency does not demote its requester. |
| Failure and rollback detail | Standalone install, orchestrated install, apply install, and failed enable/move paths retain the structured cause and rollback phases. Cause chains and rollback causes are redacted before reconcile projection; cause-less dependency rows remain cause-less. |
| MCP notices and discovery warnings | Notices produced by a dependency step survive a later root success or failure and remain after the cascade row. Discovery warnings are ordered by the same row names as the cascade while retaining each plugin's own diagnostic header. Package notes remain owned by the moved dependency row instead of being duplicated as requester diagnostics. |
| Atomicity and retry behavior | Planning still completes before moves; fresh-member and agent-claim refusals precede writes. Failed member materialization unwinds earlier members, while explicitly committed moves remain visible for the next apply. Exact clone candidates are collected without deleting warm or race-winner cache entries. |
| Test oracle quality | Phase 3 scenarios compare complete result fields and complete plugin tables. The merged regressions compare full notifications, typed outcomes, persisted records, files, indexes, rollback rows, JSON payloads, and notice order. The relevant new tests do not rely on production formatters for expected values or omit awaited asynchronous assertions. |

## Tool-assisted review

- CodeGraph was queried first for the cascade, move, outcome, apply, and notify call chains. It reported its index stale for `install-cascade.ts`, `install-cascade.messaging.ts`, and `install-outcome.ts`; those files were read directly from the current worktree instead of trusting stale line slices.
- Fallow security analysis on the merged changes reported three path candidates in the reviewed production scope. Direct inspection rejected them: skill recovery paths use generated names already validated and containment-checked by the skills bridge, and hook config paths originate from the resolver's manifest-containment boundary before the two reviewed joins.
- Fallow's diff-review command could not create its temporary comparison worktree under this isolated worktree. This did not substitute for or limit the direct source/diff review; no Fallow structural finding is asserted here.

## Verification evidence and limits

- The orchestrator supplied exact-head Phase 3 validation at `5c42ac88f81989defc070a371c4c16847f4005e3` on Node v26.12.1: nine owner modules passed; 15 CAS scenarios and 178 steps passed.
- The same unchanged merged source/test tree had a passing full `npm run check`: 1,142 Cucumber scenarios, 11,734 steps, and 309 merged direct-coverage records. The reviewer reused that current-head evidence and did not repeat the full gate.
- The review changed only this report. The pre-existing `.planning/STATE.md` modification belongs to the orchestrator and was not touched. No source or test file was modified, and no commit was made.
- Standard-depth review and passing automated checks do not prove absence of defects. No distinct unresolved Phase 3 release risk was identified in the reviewed scope.

---

_Reviewer: gsd-code-reviewer_
_Reviewed: 2026-10-29T03:17:31Z_
_Depth: standard; complete 37-file integrated scope_
