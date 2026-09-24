---
phase: 12-standalone-prune-with-dry-run
reviewed: 2026-09-24T13:09:51Z
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
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-09-24T13:09:51Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The chosen directory recovery behavior is implemented: missing directory targets stay absent, their mapped backups survive repeated partial rollback, file targets are published from separate inodes, and state restoration runs last. One post-commit notification defect remains. A cleanup failure can be reported on a different plugin from the one whose data was left behind.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: BLOCKER — cleanup failure is attributed to the wrong pruned plugin

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:141-153,167-193`

**Issue:** `finalizeCommittedMembers()` discards the member identity when it catches a cleanup error. `notifyCommitted()` then attaches every collected error to `members.find((member) => member.removed)`, the first removed member, regardless of which member's cleanup failed. With two independent orphans `a` and `b`, if cleanup of `b` fails before its data directory is removed, `a` gets the warning and cause while `b` is rendered as an ordinary successful removal. The user is directed to the wrong plugin and receives no indication that `b`'s data remains. State has already committed, so a retry of `prune` will not select `b` again.

**Reproduction:** The existing cleanup test at `tests/orchestrators/plugin/prune.test.ts:1077-1123` fails only `a`, which happens to be the first removed member. Change its injected failure condition at line 1092 to `args.plugin === "b"`: cleanup visits `a` then `b`, `a`'s data is deleted, `b`'s data remains, but the warning and `cause: first cleanup failed` still appear under `a`. The mapping follows directly from the unlabelled `failures.push(error)` and `warningMember = members.find(...)` code paths.

**Fix:** Keep cleanup errors with their member keys, attach each error to that member's row, and report transaction-wide errors such as lock-release failure separately. Add a second-member cleanup failure test that checks both data directories and the exact row receiving the cause. Pin that output in the catalog fixture.

## Verification

- Focused rollback, prune, standalone integration, catalog contract, and catalog parser tests passed.
- Direct-pair coverage passed at 100% branches, functions, and lines for both `prune-rollback.ts` and `prune.ts`.
- `npx tsc --noEmit` and scoped ESLint passed. No full project suite was run.
- Operator-owned dirty files were left untouched. No source or test files were modified.

---

_Reviewed: 2026-09-24T13:09:51Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: deep_
