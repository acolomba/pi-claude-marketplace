---
phase: 03-dependency-cascade-rows-and-status
reviewed: 2026-10-28
depth: standard
review_scope_complete: false
files_reviewed: 23
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
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-28
**Depth:** standard requested; incomplete
**Files Examined:** 23
**Status:** issues_found

## Summary

The current-source review reproduced one incorrect status on a dependency's own installation row. The previously fixed truncation and invalid-root escaping findings remain closed and are not carried as open findings.

The review traced dependency closure failures, accumulated member rows, range-declarer collection, refusal truncation, move hints, current install-flow boundaries, and installed-state projection. The recorded file list includes targeted sections of large modules; it does not claim a complete whole-file pass. The standard-depth gate must run again after CR-01 is fixed.

CodeGraph was attempted first but could not open its database. Source inspection supplied the call-path evidence.

## Structural Findings (Fallow)

- Verdict: warn.
- Dead-code issues: 0.
- Duplication groups: 0.
- Repository-wide complexity findings: 115.
- Maximum cyclomatic complexity: 18.

No actionable Phase 3 defect was established from the structural measurements alone.

## Narrative Findings

### CR-01: A partially installed cascade dependency reports a fully installed row

**Classification:** BLOCKER — incorrect user-visible behavior.

**Primary file:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts:222`

**Related files:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:1243`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts:164`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:826`
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:1237`

**Issue:** `--partial` applies to cascade members, so a dependency can install successfully after unsupported component kinds are omitted. Its ledger summary contains that partial resolution. `recordMaterializedMember` drops the member's resolution state and unsupported kinds when it creates `CascadeMemberOutcome`. `composeCascadeMemberRow` then returns `PluginInstalledMessage` and hardcodes `status: "installed"`.

The dependency therefore reports a clean install even though its persisted compatibility record says the installation is partial. A later `list` derives `partially-installed` from that record, so the same dependency changes status without an intervening operation. D-PL3-06 permits the parent to remain installed; it does not permit the dependency's own row to conceal its partial installation.

**Verified reproduction:** The real `installPlugin` orchestrator ran through the hermetic fixtures with `app@mp -> lib@mp`, where `lib@mp` contains a supported skill and `experimental.themes`, and the root install used `partial: true`. The result printed both `app` and `lib@mp` as installed. The saved `lib` compatibility record was `installable: false`, `supported: ["skills"]`, `unsupported: ["themes"]`.

**Required fix:** Preserve each materialized member's own partial-resolution and unsupported-kind facts in `CascadeMemberOutcome` and `CascadeInstalledRow`. Let `composeCascadeMemberRow` return the installed/partially-installed union and render `partially-installed` with the existing narrowed unsupported reasons. Preserve the independent parent status and the existing dependency-current-copy/re-enable reasons.

Add a whole-result regression case for a fresh cascade dependency admitted with `--partial`: the parent stays installed and the dependency is partially-installed with `unsupported component`. Add the corresponding Cucumber scenario using existing publication and output steps. The prior CAS-03 scenario pre-installs its dependency and therefore cannot catch this fresh-member projection defect.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard requested; incomplete pending CR-01 fix and full re-review_
