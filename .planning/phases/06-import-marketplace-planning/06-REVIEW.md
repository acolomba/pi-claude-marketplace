---
phase: 06-import-marketplace-planning
reviewed: 2026-10-29T04:14:43Z
reviewed_commit: 59e5075b2edcdddde72cc7c21e69fa3e5e9db49f
depth: standard
review_scope_complete: true
scope_status: degraded
scope_reason: no-task-commit-rows
files_reviewed: 38
files_reviewed_list:
  - .agents/skills/cucumber/rules/features.md
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/import/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - features/lib/field-rows.ts
  - features/lib/published-marketplace.ts
  - features/lib/run-tokens.ts
  - features/plugin/apply.feature
  - features/plugin/import.feature
  - features/plugin/install-rollback.feature
  - features/step_definitions/plugin/publishing.steps.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/import/marketplaces.test.ts
  - test/orchestrators/import/types.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-flow-results.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/orchestrators/reconcile/plan.test.ts
  - test/shared/redact-absolute-paths.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-29T04:14:43Z

**Commit:** `59e5075b2edcdddde72cc7c21e69fa3e5e9db49f`

**Depth:** standard

**Files reviewed:** 38

**Status:** issues_found

## Summary

The final merged-tree review found one current information-disclosure blocker. The Phase 6 rollback and structured-error redaction fixes remain closed, but the import read/write diagnostic path bypasses that boundary and sends raw filesystem errors to the user. A malformed production `state.json` therefore exposes its absolute path.

The GSD evaluation-scope resolver returned `degraded` (`no-task-commit-rows`), so this review reused the phase's previously complete 38-file scope, checked the current contents and all later changes within that scope, and traced the diagnostic from `loadState` through the notification boundary. The fresh combined gate remains useful regression evidence, but it cannot establish that an untested disclosure path is safe.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Import diagnostics expose absolute scope paths

**Classification:** BLOCKER

**File:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1822-1828,1971-1980`

**Issue:** Both expected import diagnostic catches interpolate `errorMessage(err)` directly into a user-visible diagnostic. Production `loadState` errors include the full `state.json` path (for example, `state.json at /home/alice/project/.pi/pi-claude-marketplace/state.json is not valid JSON`). `surfaceImportDiagnostics` then emits that string unchanged. The post-pass write catch has the same defect for Node filesystem errors. This bypasses the redaction boundary used by Phase 6's failed import/apply rows and contradicts T-06-10's claim that import failure causes do not expose paths.

A read-only reproduction at the reviewed commit injected the exact production `loadState` error grammar and observed both of these public values:

```text
diagnostic.message = Cannot read project scope state: state.json at /tmp/private-user/.pi/pi-claude-marketplace/state.json is not valid JSON: bad input
notification = 1 import diagnostic surfaced. ... /tmp/private-user/.pi/pi-claude-marketplace/state.json ...
```

The owner test at `test/orchestrators/import/execute.test.ts:3829-3893` supplies the already-sanitized text `state.json is unreadable`, so it cannot fail when the production path leaks.

**Fix:** Sanitize every caught filesystem error before building the diagnostic. Reuse a single boundary helper that understands the unquoted `loadState` forms as well as Node's quoted errno forms; a bare call to the current generic matcher is insufficient for a scope path containing spaces. Add a production-shaped regression using a case-owned root whose name contains spaces, assert the complete returned diagnostic and emitted notification, and assert that neither contains the root. Apply the same projection to the post-pass write catch.

For example:

```ts
const cause = redactImportFilesystemError(err);
pushDiagnostic(
  result,
  scopePlan.scope,
  "settings-read-error",
  `Cannot read ${scopePlan.scope} scope state: ${cause}`,
);
```

`redactImportFilesystemError` should reduce `Failed to read <path>: ...`, `state.json at <path> ...`, and quoted Node errno fields to basename-only text. It should preserve the rest of the error.

## Verification Evidence

- Nyquist: COMPLIANT for MIM-01 through MIM-04; 8 owner modules and 15 public scenarios / 177 steps passed.
- Combined merged-tree gate: 1,142 scenarios, 11,734 steps, 309 direct-coverage records.
- Reproduction: a direct `importClaudeSettings` call with an exact production-shaped `loadState` failure exposed `/tmp/private-user/.pi/pi-claude-marketplace/state.json` in the returned diagnostic and the TUI notification.
- No source or test file was modified by this reviewer.

---

_Reviewed: 2026-10-29T04:14:43Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
