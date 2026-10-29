---
phase: 03-dependency-cascade-rows-and-status
reviewed: 2026-10-29T12:42:09Z
reviewed_commit: 98c2544091e03ada2e897156a9e73586932e030e
depth: standard
review_scope_complete: true
scope_resolution: degraded
files_reviewed: 48
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/dependency-range.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - features/plugin/install-dependencies.feature
  - features/plugin/staging-warnings.feature
  - features/plugin/update.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
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

**Reviewed:** 2026-10-29T12:42:09Z
**Commit:** `98c2544091e03ada2e897156a9e73586932e030e`
**Depth:** standard
**Files Reviewed:** 48
**Scope Complete:** yes
**Status:** clean

## Summary

The complete retained Phase 3 implementation and its current integrated call
paths were reviewed at standard depth. The review retained the prior complete
37-file scope and added the 11 final-head files that now carry dependency
settlement diagnostics through moves, planned closure slices, materialization,
direct update output, and their owner and behavioral tests.

The evaluation-scope resolver returned `degraded` because it could not recover
reachable task commits and its phase-range fallback covered unrelated later
phases. The explicit scope therefore uses the prior complete review scope plus
the current files on the dependency-settlement and update-output paths. No
actionable correctness, security, or test-reliability defect was established.

## Narrative Findings (AI reviewer)

None. Critical/BLOCKER: 0; WARNING: 0; informational findings: 0.

## Requirement and decision checks

| Contract | Final-head review result |
| --- | --- |
| CAS-01: complete failed closure | Walk, constraint, scheduler, plan-step, member-ledger, rollback, and never-reached routes retain each resolved but unmaterialized member once. The later settlement-diagnostic carrier does not change row projection or deduplication. |
| CAS-02: invalid root identity | Install still performs the root lookup before the invalid-ID refusal, preserves not-in-manifest for an absent root, and escapes the listed invalid ID through `printable`. |
| CAS-03: partial member status | Each member's ledger summary still owns its partial and malformed status. The requester remains independent across install, list, and info; the retained regression compares the complete warning payload and both records. |
| CAS-04: git-source list state | `resolveListCandidate` and `classifyInstalledRecord` retain the recorded D-PL3-07 divergence. No final-head settlement or diagnostic change bypasses that classifier. |
| CAS-05: declarers and truncation | Non-root directory-pin failures take range-bearing declarers from the closure map in reverse closure order. Names, versions, declarers, and joined ranges remain bounded by the current renderers. |
| CAS-06: offline move remedy | The update hint remains limited to a direct root declaration whose refusal would not also block update. Diagnostic ownership changes do not alter that predicate or cause line. |
| CAS-07: bounded versions | Hold, installed-unsatisfied, excluded-plan, and newest-version refusals still route marketplace-controlled versions through the required surrogate-safe bounds. |

## Final integration checks

| Area | Result |
| --- | --- |
| Dependency warning ownership | `runDependencyMove` removes only the package note already owned by the dependency row, then carries the remaining warning halves under the moved plugin. Nested dependency diagnostics retain their original owners. |
| Settlement ordering | `runDependencySteps` appends rows, MCP notices, and staging diagnostics in step order on success and refusal. A failing step's returned diagnostics are included before the function exits; a thrown step cannot return diagnostics and is reported through its failure row. |
| Planned closure slices | `saveInstallDependencyPlanClosure` projects each installed member's own discovery warnings after the state save and hook hydration. It neither attaches those warnings to the requester nor changes the member rows. |
| Update result projection | `materializeLatestVersion` keeps dependency diagnostics separate from the root's own `stagingWarnings` on updated and failed outcomes. Direct update renders dependency diagnostics before the root diagnostic on both normal and phase-3a abort paths. |
| MCP notices and rows | Dependency MCP notices remain ordered with the same steps and survive later root success or refusal. Cascade rows and cause chains remain unchanged by the new diagnostic carrier. |
| Test oracle quality | The added owner cases compare complete carrier objects and complete notification arrays. The direct-update regressions assert dependency-before-root ordering and both warning halves. Public Phase 3 scenarios compare complete result fields and row tables. |

## Tool-assisted review

- CodeGraph was queried first for the cascade, settlement, materialization,
  update, list, apply, and notification call paths. It reported the actively
  changed files as newer than its index, so those files and their diffs were
  read directly from the current worktree.
- Fallow security completed with its advisory gate passing. Its scoped
  candidates were generic path joins in pre-existing containment or test
  fixtures; direct inspection found no Phase 3 bypass or new uncontained write.
- `git diff --check` passed. The review changed no source, test, state, or
  configuration file.

## Verification evidence and limits

- Final-head Nyquist is COMPLIANT for CAS-01 through CAS-07. Fresh owner proof
  passed 15 modules; fresh public proof passed 153 scenarios, 1,947 steps, and
  2 hooks.
- The exact unchanged-input `npm run check` result remains reusable at
  executable head `be0de0c3`: 1,145 scenarios, 11,777 steps, and 309 direct
  LCOV records.
- Standard-depth review and passing automated checks do not prove absence of
  defects. No distinct unresolved Phase 3 release risk was identified in the
  complete retained-plus-current scope.

---

_Reviewer: gsd-code-reviewer_
_Reviewed: 2026-10-29T12:42:09Z_
_Depth: standard; complete 48-file integrated scope_
