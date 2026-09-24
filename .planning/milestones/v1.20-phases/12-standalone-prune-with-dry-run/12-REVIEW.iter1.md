---
phase: 12-standalone-prune-with-dry-run
reviewed: 2026-09-24T04:01:41Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - README.md
  - docs/dependency-resolution.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-prune.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/flag-catalog.test.ts
  - tests/edge/handlers/plugin/prune.test.ts
  - tests/edge/register.test.ts
  - tests/edge/router.test.ts
  - tests/integration/standalone-prune.test.ts
  - tests/orchestrators/plugin/dependency-index.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/persistence/state-io.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-09-24T04:01:41Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

The standalone prune route, declaration selection, output contract, tests, and user-facing docs were reviewed against the Phase 12 context and summaries. Two failure paths remain: operational errors escape the command without a notification, and a failed state save can leave removed artifacts recorded as installed. The focused prune tests, TypeScript check, ESLint check, and diff whitespace check passed; these checks do not cover the failure paths below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: BLOCKER — prune lets state and lock failures escape without a result

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:72-74,107-125`

**Issue:** Both preview's `loadState` and actual prune's locked transaction can reject on invalid or unreadable `state.json`, a held lock, or an I/O error. The new operation has no catch for either path. Its handler awaits the operation at `edge/handlers/plugin/prune.ts:45-51`; `withParsedArgs` catches only argument parsing, and `routeClaudePlugin` forwards the rejection. The command therefore emits no `ctx.ui.notify` result for these ordinary failure conditions. This breaks the command's notification contract and gives the user no actionable failure row. The tests exercise declaration-read failures, which return a typed `snapshot.ok === false`, but do not cover state-load or lock failures.

**Fix:** Catch failures at the prune operation boundary for both preview and actual execution. Emit a typed, command-scoped error notification with a redacted cause and no reload hint. Keep the declaration-read failure row as its separate, more specific case. Add tests for malformed state and a held lock through the registered command.

### CR-02: BLOCKER — a failed state save strands removed artifacts behind installed records

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:113-123`

**Issue:** `sweepOrphans` calls `removeDependencyMember`, which un-stages files and removes the member from the in-memory state before `tx.save()` runs (`orchestrators/plugin/uninstall.ts:573-589`). If `tx.save()` rejects, `withLockedStateTransaction` propagates the error and does not restore those files. The on-disk state still contains the dependency record while its Pi skill, command, agent, hook, or MCP artifact may already be gone. A later `/reload` reads that installed record and need not restage its missing artifacts, so the failed prune can leave a plugin broken. The new prune tests cover member unstage failures but do not inject a save failure after a successful unstage.

**Fix:** Use a reversible removal transaction for actual prune: retain or stage every artifact until the state save succeeds, and restore the original artifact tree if persistence fails. Exercise the save-rejection seam with at least one member already unstaged; assert the original state bytes and staged artifacts are both preserved and that the command reports failure.

---

_Reviewed: 2026-09-24T04:01:41Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
