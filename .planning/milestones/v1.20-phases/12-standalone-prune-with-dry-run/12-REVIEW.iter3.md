---
phase: 12-standalone-prune-with-dry-run
reviewed: 2026-09-24T06:02:00Z
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
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-09-24T06:02:00Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The iteration 2 metadata fix still permits independent edits to be lost in two timing windows. Artifact rollback also overwrites a replacement created after its existence check. Both paths report a successful rollback and delete the recovery backup. The replacement tests do not assert that the replacement survives. A combined rollback and lock-release failure additionally loses its structured recovery diagnostics.

The earlier committed-removal error path now retains its committed rows, runs finalization, and requests reload. The recovery manifest maps numbered entries to scoped relative targets before unstaging; the existing guards reject traversal and target symlinks, and nested symlinks are copied without following them. The previously grouped replacement and cleanup cases now run independently. Those changes resolve the specific earlier post-commit, missing-map, and test-grouping findings, but the earlier shared-metadata data-loss finding is not fully resolved.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: BLOCKER — metadata rollback still overwrites independent edits

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:175-197,311-312`

**Related:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:258-271`

**Issue:** `markUnstaged()` obtains its expected versions by reading the shared documents after the entire sweep. These are observations of whatever is on disk, not identities of writes performed by prune. An independent edit between the initial snapshot and this read is adopted as the expected prune version. A subsequent save failure restores the older snapshot over that edit, even when the selected plugin owns no MCP entries and the MCP bridge never wrote the file.

There is a second window in `restoreMetadata()`: it reads the current version, then asynchronously reads the original backup and performs an unconditional atomic replacement. An independent write after the current-version read is also overwritten. Atomic file replacement does not make the earlier comparison conditional on the destination still having that version. The scope state lock does not coordinate independent MCP writers.

**Evidence:** A temporary-directory command-level reproduction used the real cascade, a dependency orphan with no MCP resources, and an independent MCP write immediately after that cascade returned. The injected state-save rejection restored the plugin record but changed MCP from `{"mcpServers":{"original":1,"independent":2}}` back to `{"mcpServers":{"original":1}}`. The command reported only `{unreadable}` / `injected save failure`, and no recovery backup remained. A separate reproduction injected an independent write while rollback read its original MCP backup, after reading the current destination; rollback returned `[]`, erased the edit, and deleted its backup.

**Fix:** Track which metadata documents prune actually changed and the exact versions produced at each bridge write; do not infer ownership from a later disk read or restore documents prune did not change. Coordinate comparison and replacement with every writer covered by the concurrency guarantee. Where that cannot be guaranteed for an externally editable shared document, leave the current document intact, retain the original with its manifest, and report partial recovery instead of performing an unconditional full-document restore. Add deterministic tests for edits before `markUnstaged()` and between the rollback read and replacement, including a plugin that never writes MCP.

### CR-02: BLOCKER — artifact restore can overwrite a newly created replacement

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:140-150`

**Issue:** The destination-existence check and the rename are separate operations, with an awaited `mkdir()` between them. If another writer creates a prompt or agent file in this interval, Node's rename replaces that file. The collision branch is never reached because its observation was already stale. Rollback then deletes the backup and reports success. This contradicts the recovery contract that occupied replacements remain untouched.

**Evidence:** A temporary-directory reproduction snapshot a command file, removed it to model unstage, and used the existing `PruneRestoreOps.rename` seam to create an independent replacement with `flag: "wx"` immediately before the real rename. The create succeeded, proving the target was absent at the write boundary. Rollback returned `[]`; the destination contained the original command instead of the independent replacement, and no backup remained.

**Fix:** Publish restored artifacts with an operation that atomically refuses an occupied destination. For regular files, a same-filesystem hard-link publication can fail with `EEXIST` without replacing the current entry, followed by removal of the backup link only after success. Use an equivalent no-replacement strategy for other supported artifact kinds, or retain their backups when safe publication cannot be established. Treat a collision at the actual publication step as a partial rollback. Add a test creating a replacement at that boundary and assert both its exact contents and the retained original backup.

### CR-03: BLOCKER — replacement tests do not verify replacement preservation

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/tests/orchestrators/plugin/prune-rollback.test.ts:460-486`

**Issue:** All six named replacement cases assert only the failure count, phase, message, and existence of a backup directory. None reads the replacement after rollback or checks its kind, contents, directory entries, or mode. For example, a broken collision branch that deletes the replacement and then throws the same occupied-artifact error passes these cases. The mode and nested-directory variants have no separate assertion elsewhere that proves their claimed preservation. Moving the loop outside `test()` fixed independent execution, but these cases still do not discriminate the safety behavior in their titles.

**Fix:** Give each row an independent expected filesystem result or assertion callback. After rollback, assert the replacement's full relevant state (kind, complete bytes or directory inventory, and mode where changed), then verify the original backup's contents through the recovery manifest. Preserve the diagnostic assertions. A negative control that deletes or overwrites the replacement before reporting the collision must fail each relevant case.

## Warnings

### WR-01: WARNING — lock-release wrapping hides partial-rollback details

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:83-96`

**Related:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/transaction/with-state-guard.ts:137-148`

**Issue:** When rollback is partial and lock release also rejects, the state guard wraps the `PruneRollbackError` in a new ordinary `Error`, retaining it only as `cause`. The notification checks only the outer error's class. It therefore emits `{unreadable}` and omits every structured rollback failure, despite the retained backup needing recovery. The cause text still names the manifest, so recovery is possible, but the documented phase-specific diagnostics are lost.

**Evidence:** A temporary-directory command reproduction combined an MCP collision during a rejected state save with an injected lock-release rejection. The real guard returned the wrapper. The notification contained `(failed) {unreadable}`, repeated the backup instruction in its cause chain, and omitted the expected `[mcp] (rollback failed)` child. The backup was retained.

**Fix:** Find the structured rollback error through the cause chain, with cycle protection, while keeping the complete outer cause for the release failure. Alternatively, preserve typed failure information in the transaction guard's error contract. Test the combined failure through the real guard and assert the rollback-partial reason, affected phases, backup instruction, redaction, and release diagnostic.

## Verification

- TypeScript compilation passed.
- Scoped ESLint passed for all reviewed TypeScript files. The generic `npx eslint .` invocation encountered an unrelated parser configuration error in ignored `.codex/gsd-core/bin/check-latest-version.cjs`; the source scope was then checked explicitly.
- The focused prune, rollback, registered-command integration, catalog-contract, and catalog-parser suites passed.
- Direct pair coverage passed at 100%: prune has 67 branches, 17 functions, and 319 lines; rollback has 98 branches, 20 functions, and 362 lines.
- The catalog contract passed for 241 states and 34,772 UTF-8 bytes.
- The data-loss and combined-failure reproductions used temporary directories, removed their fixtures, and changed no source or test files.
- The full project suite was not run, as requested. No source files, test files, or operator-owned dirty paths were edited.

---

_Reviewed: 2026-09-24T06:02:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
