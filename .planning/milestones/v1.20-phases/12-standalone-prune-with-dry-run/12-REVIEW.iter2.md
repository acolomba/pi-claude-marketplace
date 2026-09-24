---
phase: 12-standalone-prune-with-dry-run
reviewed: 2026-09-24T05:06:37Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-prune.ts
  - tests/integration/standalone-prune.test.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/prune.test.ts
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-09-24T05:06:37Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

The two original findings were addressed for the tested paths: malformed state and a held lock now produce scoped error notifications, and a state-save rejection normally restores the selected artifacts and original state bytes. The re-review found three remaining failure paths. Focused prune, rollback, integration, and catalog tests passed. Both source-test pairs reached 100% direct line, branch, and function coverage; TypeScript, scoped ESLint, and diff whitespace checks passed. These gates do not establish the post-commit and collision behavior below.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: BLOCKER — a failed lock release is reported as an uncommitted prune

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:202-224,232-240`

**Issue:** The callback calls `tx.save()` and discards the rollback backup before `withLockedStateTransaction` releases the scope lock. The guard rejects if that release fails (`transaction/with-state-guard.ts:133-153`). Prune's outer catch then reports `(failed) {unreadable}` with `needsReload: false` and returns. At that point the state and artifact removal are durable, but `finalizePrunedMembers` has not run: cached hook routes remain, post-commit data/cache cleanup is skipped, and the user gets no reload hint. A post-commit `finalizePrunedMembers` rejection also escapes without any command notification; `runPostUninstallCleanup` can throw from its `pluginDataDir` containment check (`uninstall.ts:836-843`). The reported outcome therefore disagrees with what was committed.

**Fix:** Record successful persistence and the committed members outside the transaction callback. If the transaction then rejects, classify it as a post-commit failure, run the remaining finalization where safe, and emit a truthful committed-with-warning row with a reload hint and redacted cause. Wrap post-commit finalization so its failures also produce a notification. Test an injected failure after `tx.save()` has succeeded and assert the durable state, retained runtime behavior, and notification.

### CR-02: BLOCKER — rollback overwrites new edits to the shared MCP document

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:125-136,250-255`

**Issue:** On a failed sweep or state save, `restoreMetadata` unconditionally writes the pre-prune backup of `mcp.json` over the current file. The scope state lock does not lock independent writers of this shared Pi document. If a user or another MCP tool adds or changes a server after the snapshot, rollback discards that edit. The artifact path restore detects occupied replacements and retains a backup, but metadata restore has no equivalent collision check. The existing metadata test covers a symlink refusal, not an ordinary changed file. This is a data-loss risk on a recoverable failure path.

**Fix:** Retain the post-unstage bytes or another write identity for each metadata file. Before restoring, verify that the current file is the version prune wrote. If it differs, preserve the current file, retain the original in the backup, and report a partial rollback with a usable recovery map. A focused test should change an unrelated MCP entry between the snapshot and injected save rejection and verify that neither version is silently lost.

### CR-03: BLOCKER — retained partial-rollback backups have no target map

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:63-70,202-233,239-266`

**Issue:** A partial rollback retains a `prune-backup-*` directory under the scope extension root, but its contents are only numbered entries. The code writes no manifest mapping entry numbers to target paths, and `PruneRollbackError` and its notification expose neither the backup directory name nor the mapping (`prune.ts:34-42,80-112`). An operator can discover a directory by its prefix, but cannot reliably identify which numbered item belongs to which missing skill, command, hook, or agent when several members were selected or multiple backups exist. The notification's claim that the backup was retained for recovery is therefore not an actionable recovery path.

**Fix:** Write an atomic manifest into the backup before unstaging, with each entry's target expressed relative to its permitted root and its phase. Carry the backup directory's relative name into the partial-rollback notification, along with a recovery instruction. Keep the manifest and unresolved entries on every partial failure. Test two same-phase artifacts with one failed restore and assert that the retained backup identifies the exact target.

## Warnings

### WR-01: WARNING — grouped rollback cases stop checking later replacements

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/tests/orchestrators/plugin/prune-rollback.test.ts:338-385,473-503`

**Issue:** The replacement and cleanup variants are looped inside individual `test()` cases. A failure in the first variant prevents the remaining variants from running, so the suite does not report which later behaviors regress. The project's unit-test review rule requires one sibling case per data row for this reason.

**Fix:** Move each loop outside `test()` and create a named `test()` for every replacement and cleanup action, with a fresh hermetic environment per case.

---

_Reviewed: 2026-09-24T05:06:37Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
