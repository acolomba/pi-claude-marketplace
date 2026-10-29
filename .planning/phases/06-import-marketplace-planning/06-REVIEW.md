---
phase: 06-import-marketplace-planning
reviewed: 2026-10-29T04:32:49Z
reviewed_commit: f5f89da1ce874804434cf904d1354fadf06ac498
depth: standard
review_scope_complete: true
scope_status: explicit
files_reviewed: 39
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
  - features/step_definitions/plugin/import.steps.ts
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

**Reviewed:** 2026-10-29T04:32:49Z

**Commit:** `f5f89da1ce874804434cf904d1354fadf06ac498`

**Depth:** standard

**Files reviewed:** 39

**Status:** issues_found

## Summary

The post-fix review found that CR-01 is closed for the three newly recognized
unquoted state-error grammars and for quoted Node errno diagnostics, but remains
open for a production write-back failure. A state-lock error embeds its path in
parentheses. When the scope root contains a space, the generic fallback redacts
only the prefix and leaves the rest of the path visible in the returned
diagnostic and every notification transport.

The explicit scope is the preceding complete 38-file Phase 6 scope plus the new
import step module. Files outside commit `2d258ae7` are byte-identical to the
complete preceding review; all six changed files and the downstream diagnostic
transport were rechecked against their current contents. The fresh combined
gate passed 1,143 scenarios, 11,742 steps, and 309 direct-coverage records, but
the new write regression exercises a quoted, no-space `EEXIST` message and
cannot detect this production grammar.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: A spaced state-lock path still leaks from the config-write diagnostic

**Classification:** BLOCKER

**Files:**

- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:1971-1980`
- `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:23-64`
- `test/orchestrators/import/execute.test.ts:4462-4530`
- `test/shared/redact-absolute-paths.test.ts:92-102`

**Issue:** The fixed write catch correctly calls `redactAbsolutePaths`, but the
catch explicitly includes lock contention and wraps the whole
`withLockedStateTransaction`. That transaction can throw `StateLockHeldError`
or `StateLockCompromisedError`; both production messages put `lockPath` inside
parentheses rather than quotes or a `Failed to read/write` prefix. The new
special cases do not match that grammar, and the fallback character class
excludes spaces.

A direct reproduction with the production message shape gives:

```text
input:  Another pi-claude-marketplace operation is in progress for project scope (/tmp/private user/.pi/pi-claude-marketplace/.state-lock). Retry after it completes.
output: Another pi-claude-marketplace operation is in progress for project scope (private user/.pi/pi-claude-marketplace/.state-lock). Retry after it completes.
```

The leading `/tmp/` is gone, but the unique parent directory and the rest of the
scope path remain. `pushDiagnostic` retains that output in the returned
`ClaudeImportExecutionResult`; `surfaceImportDiagnostics` forwards the same
line to `notifyDiagnostic`, so TUI/print and JSON/RPC expose it too.

The new write regression does not gate this case. It creates a no-space root
and induces a quoted `EEXIST ... mkdir '<path>'` error, which the pre-existing
quoted-path matcher already understands. Its two negative assertions search
for the complete original `project.scopeRoot`; they still pass when only the
first segment is removed and the sensitive suffix remains. The shared helper
cases cover spaced `state.json at ...` and `Failed to read ...`, but not the
parenthesized state-lock grammar or an exact `Failed to write ...` case.

**Fix:** Redact the structured `lockPath` before the error becomes a diagnostic,
or extend the shared redactor with a bounded state-lock-message grammar that
collapses the complete parenthesized path to `.state-lock`. Add a post-pass
write regression that forces a real held or compromised lock under a
case-owned scope root containing spaces. Assert the complete returned
diagnostic and every emitted transport payload, and assert that unique parent
segments such as `private user` are absent rather than checking only for the
original full root. Add the exact production message to the shared redactor
table as well.

## Verification Evidence

- Commit `2d258ae7` changed six files; all six and the full current Phase 6
  scope were included in this review.
- Fresh combined gate: 1,143/1,143 scenarios, 11,742/11,742 steps, 309 merged
  direct-coverage records.
- Direct read-only reproduction of `redactAbsolutePaths` with the production
  `StateLockHeldError` message preserved `private user/.pi/.../.state-lock`.
- No source, test, state, security, or configuration file was modified by this
  reviewer.

---

_Reviewed: 2026-10-29T04:32:49Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
