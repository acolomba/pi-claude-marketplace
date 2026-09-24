---
phase: 12-standalone-prune-with-dry-run
reviewed: 2026-09-24T06:33:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-prune.ts
  - tests/integration/standalone-prune.test.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/prune.test.ts
findings:
  critical: 3
  warning: 0
  info: 0
  total: 3
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-09-24T06:33:00Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The four iteration 3 findings are addressed in the current code. Changed shared metadata is left in place with its recovery backup; files and symlinks use exclusive publication; replacement tests inspect both sides of a collision; and rollback details survive lock-release wrapping. Three new defects remain in directory and regular-file restoration. All three were reproduced against the current source in disposable temporary directories.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: BLOCKER — a failed directory publication leaves a partial artifact that cannot be retried

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:154-176`

**Issue:** `publishBackupEntry()` creates the destination directory before publishing its children. If any later child publication fails, `restoreArtifact()` leaves the new directory and its earlier children in place. The next rollback sees that incomplete directory as an occupied artifact and refuses to finish. This violates the project's atomic mutation and fail-clean retry requirements. It can occur on an ordinary filesystem error or a child collision; the recovery manifest remains, but the target now contains a new, incomplete artifact created by rollback itself.

**Evidence:** A temporary skill directory contained `a.md` and `z.md`. A fault at the existing `link` seam rejected only publication of `z.md`. The first rollback reported `[skills]` failure, but the destination contained `a.md` alone. The numbered backup still contained both files. A second `rollback()` reported `Prune rollback found an occupied artifact` for the partially published directory, even after the injected fault was gone.

**Fix:** Build the complete restored directory in a private sibling path, then publish it with a no-replace operation. If no safe exclusive directory publication is available on a supported platform, retain the backup and report a partial restore before creating the visible destination. Add a test that fails on a later child and verifies that the destination is absent and a retry can recover once the fault clears.

### CR-02: BLOCKER — hard-link publication lets a restored file corrupt its recovery backup

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:139-142,365-371`

**Issue:** `link(backup, target)` makes the restored regular file and recovery backup the same inode until the entire rollback completes. An independent writer that changes the restored target in place also changes the numbered backup. If another restore step fails, the retained manifest points to the independent writer's bytes instead of the original bytes. If no later step fails, rollback can report success and discard the only original copy while the target contains the independent edit. The scope state lock does not coordinate these writers.

**Evidence:** A temporary command file originally contained `original command`. The injected `link` operation performed the real link and then wrote `independent command` to the target, modeling a writer immediately after publication. A changed `mcp.json` forced partial rollback and backup retention. Rollback reported only `[mcp]` failure; both the command target and its numbered recovery backup contained `independent command`. The original command bytes were gone.

**Fix:** Copy each regular-file backup to a separate private inode, preserving its mode, and exclusively link that staged inode into the destination. Remove the staged path only after publication; never expose the recovery backup inode at the target. Add a deterministic post-publication write test that forces a later partial rollback and verifies the target's independent bytes and the backup's original bytes separately.

### CR-03: BLOCKER — restored directory permissions change under the process umask

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:154-158`

**Issue:** `mkdir(target, { mode: entry.mode & 0o777 })` applies the process umask. It does not reproduce the saved directory's mode. Rollback reports success and deletes the backup even though group or other permissions were lost. This can prevent another process or user from reading or updating a restored skill or hook directory.

**Evidence:** With process umask `0o022`, a skill directory set to mode `0o775` was snapshotted and removed. `rollback()` returned no failures, but the restored directory mode was `0o755`; the backup was discarded.

**Fix:** Populate the private directory with a writable temporary mode, then `chmod` it to the saved mode before publication. Assert the exact mode of the restored root and nested directories in the rollback test, including a saved mode with bits masked by the process umask.

## Verification

- The focused rollback, prune, standalone integration, catalog-contract, and catalog-parser test files passed.
- `npx tsc --noEmit` and scoped ESLint passed.
- The three reproductions used disposable temporary directories, cleaned up their fixtures, and changed no source or test files.
- The real state guard saves under the scope lock; a failed save invokes rollback before lock release. The current cause-chain lookup preserves partial-rollback details if release also fails. Changed shared metadata is never overwritten by `restoreMetadata()` and retains the manifest when reported as a collision.
- No full project suite was run. Operator-owned dirty files were left untouched.

---

_Reviewed: 2026-09-24T06:33:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
