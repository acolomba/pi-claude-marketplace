---
phase: 01-staging-warning-channels
reviewed: 2026-10-29T11:52:03Z
depth: standard
source_commit: cddca7efab799348ebaa101885da3890435d7845
review_head: cddca7efab799348ebaa101885da3890435d7845
files_reviewed: 41
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/compare-name-scope.ts
  - extensions/pi-claude-marketplace/shared/staging-warnings.ts
  - features/step_definitions/plugin/publishing.steps.ts
  - features/plugin/staging-warnings.feature
  - test/bridges/agents/stage.test.ts
  - test/orchestrators/marketplace/update.messaging.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/shared/staging-warnings.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-29T11:52:03Z
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

The final integrated tree retains the Phase 1 warning carriers, member identity,
and normal discovery-warning output, but the direct `update` presentation path
does not honor the later D-PL10-12 amendment for dependency-move warnings. One
blocking defect remains: dependency hygiene warnings are filtered on normal
completion, and all dependency diagnostics are omitted on the phase-3a abort
path.

The final full gate (1,144 scenarios, 11,758 steps, 309 direct-coverage LCOV
records) and Phase 1 Nyquist audit (7/7 requirements; 20 scenarios and 248
steps) are green because the current dependency-warning scenario supplies only
a discovery warning and does not exercise the abort-after-settle case.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Direct update drops required dependency diagnostics

**Classification:** BLOCKER

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:508-515`

**Also:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:548-559`

**Issue:** D-PL10-12 requires a dependency move during direct `update` to retain
both warning halves in the D-PL1-25 per-plugin diagnostic. The normal completion
path appends `outcome.dependencyStagingDiagnostics` in
`updateStagingDiagnostic`, but line 559 sends the combined list through
`surfaceStagingDiagnostics`. That renderer deliberately partitions each entry
and forwards only `discovery`; every dependency `hygiene` warning is therefore
silently dropped. The root update's hygiene half is correctly standalone-only,
but the later D-PL10-12 decision explicitly makes dependency-move diagnostics
the both-halves exception.

The phase-3a aggregate-failure arm loses more. `swapAfterSettle` attaches the
settlement's `dependencyStagingDiagnostics` to the returned failed outcome, but
lines 508-515 build `failedDiagnostics` from only
`updateFailedDiagnostic(...)`. If the dependency move committed and the root's
swap then returns a rollback-partial failure, neither the dependency discovery
nor hygiene diagnostic reaches the user. The MCP notices from that same
settlement do survive through the separately passed `outcome`, demonstrating
that this is a presentation projection loss rather than a rolled-back change.

The public scenario `Update preserves dependency move warnings and MCP notices`
uses a colliding skill, which creates only a discovery warning. It passes even
when the hygiene half is discarded, and there is no case where a settled
dependency warning precedes a phase-3a root failure. Thus the current green
gate does not discriminate either wrong implementation.

**Fix:** Keep the root and dependency diagnostic policies separate. In row
order, render each outcome's `dependencyStagingDiagnostics` through
`surfaceCascadeStagingDiagnostics` (both halves), then render only the root
diagnostic through `surfaceStagingDiagnostics`. On the phase-3a arm, pass and
render `outcome.dependencyStagingDiagnostics` before the root failed diagnostic
instead of replacing the complete list with the root entry. Add:

1. a direct-update regression whose dependency move produces one discovery
   warning and one hygiene warning and assert the single two-clause dependency
   header plus both lines; and
2. a direct-update regression where dependency settlement commits a diagnostic
   before the root returns a phase-3a rollback-partial failure, asserting the
   dependency diagnostic appears once before MCP notices.

## Contract Audit

| Contract | Verdict | Evidence |
| --- | --- | --- |
| WRN-01 | Closed | Standalone enable retains only the root's discovery half and places it between its row and MCP notices. |
| WRN-02 / D-PL1-25 | Blocked on direct update integration | Marketplace update and apply use the both-halves cascade renderer, but direct update routes dependency diagnostics through the discovery-only renderer. |
| WRN-03 | Closed | Producers retain the tagged union and consumers partition through the shared classifier. |
| WRN-04 | Closed | Failed install, update, and reinstall retain warnings collected before the failure, apart from the distinct dependency-after-settle abort gap in CR-01. |
| WRN-05 / NFR-10 | Closed | D-PL10-13 formally supersedes Plan 01-03's older literal. Exact staged-target ownership is required; foreign rows aimed at another target are preserved and reported. The older behavior must not be restored. |
| WRN-06 / D-PL10-12 | Blocked | Dependency rows and MCP notices survive, but direct update does not retain both warning halves and drops every dependency diagnostic on a phase-3a abort. |
| WRN-07 | Closed | Resource-change derivation and the single reinstall cache drop remain intact. |

## Verification Evidence

- Reconstructed the final scope from the retained Phase 1 review list and all
  executable moved files reported by final `verification status`.
- Used CodeGraph before direct source reads to trace warning production through
  dependency move, settlement, materialization, direct update, marketplace
  update, and reconcile output. Current changed files were read from disk where
  the index reported drift.
- Reviewed the final integrated deltas from the prior clean Phase 1 source
  commit through `cddca7ef`, including the fail-closed diagnostic expectation
  changes. Those redaction changes are intentional and are not findings.
- Reused the coordinating owner's unchanged-input full-gate evidence at the
  reviewed executable tree: `npm run check` passed all static checks, 1,144
  scenarios, 11,758 steps, and 309 merged direct-coverage LCOV records.
- Reused the fresh Phase 1 Nyquist evidence: COMPLIANT 7/7, with 20/20 public
  scenarios, 248/248 public steps, and 104 focused owner tests. CR-01 explains
  the missing discriminating variants despite that green result.
- No structural-findings or external-reviewer-evidence payload was supplied.
  Only this report was changed; no source, test, STATE, configuration, or
  security artifact was modified, and no commit was created.

---

_Reviewed: 2026-10-29T11:52:03Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
