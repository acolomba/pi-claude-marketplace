---
phase: 01-live-evidence-revalidation
fixed_at: 2026-09-06T02:40:13Z
review_path: .planning/phases/01-live-evidence-revalidation/01-REVIEW.md
iteration: 2
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-06T02:40:13Z
**Source review:** `.planning/phases/01-live-evidence-revalidation/01-REVIEW.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: A crafted recovery journal can delete arbitrary repository files

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commits:** 9741d36d, f5fec924
**Applied fix:** Recovery now validates the exact journal and record fields, status, two canonical destinations, derived stage and backup paths, boolean destination state, and one shared closed-grammar transaction ID before any filesystem mutation. Regression cases preserve an unrelated victim file and reject invalid path derivation, transaction grammar, and mixed transaction IDs.

### CR-02: Shard enumeration follows member symlinks outside the repository

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 783a7227
**Applied fix:** Shards are enumerated as directory entries. Every JSON member must be a regular file and is resolved through the repository containment guard immediately before reading. A real outside-root shard symlink is rejected.

### CR-03: Shards can smuggle evidence owned by another plan

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commits:** 9720141a, 0abebad4, 951221b1
**Applied fix:** Shard claims must belong to assigned files, each file's claim IDs must exactly match shard-local claims, and shard findings must exactly match findings reached by those claims. Cross-shard duplicate targets remain references instead of copied evidence records. All 53 live shards satisfy the stricter contract.

### CR-04: Structurally empty records can satisfy completion validation

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commits:** c7dbf83d, 60210fbb, e33082df
**Applied fix:** Nested collection fields now receive explicit array validation. Method-specific evidence strings and scope rationale must be non-empty after trimming, and probe exit codes must be integers from 0 through 255. Invalid collections produce dedicated structural violations instead of empty-array normalization.

### CR-05: Resolved decisions allow blank and undisposed options

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 12d73eb7
**Applied fix:** Decision options and rejected options must be non-empty strings. The rejected set must exactly equal every option other than the selected option, so missing, extra, duplicate, blank, and non-string alternatives fail deterministically.

### CR-06: The standalone Markdown negative control is vacuous

**Status:** fixed
**Files modified:** `scripts/revalidation.negative.mjs`
**Commit:** cae98e98
**Applied fix:** The standalone gate now builds a complete temporary CLI fixture, writes canonical JSON and tampered Markdown, invokes the public CLI entry point, and asserts the exact nonzero Markdown-drift result. It also plants independent invalid journal, shard symlink, cross-plan claim, empty evidence, and invalid decision controls for CR-01 through CR-05.

### WR-01: The CLI test helper discards child-process launch errors

**Status:** fixed
**Files modified:** `tests/architecture/revalidation.test.ts`
**Commit:** a74f7d0b
**Applied fix:** The helper now throws child launch errors immediately and reports signal termination before returning status and streams, keeping infrastructure failures distinct from validator behavior.

## Verification

All verification ran against the main checkout because `workflow.use_worktrees` is `false`. Child-process checks ran outside the restricted filesystem sandbox so the public CLI could launch normally. Formatting-only follow-up commit: e252f38f.

- `npm run test:coverage:direct -- scripts/revalidation.mjs`: passed with 68 tests and 100% branch, function, and line coverage (542/542 branches, 148/148 functions, 1713/1713 lines).
- `npx tsc --noEmit`: passed.
- Exact-file ESLint and Prettier checks for all three reviewed files: passed with no warnings.
- `node scripts/revalidation.negative.mjs`: passed.
- Canonical live-ledger validation: passed.
- All 53 live shards passed the strict shard-ownership validator.
- JavaScript syntax checks and `git diff --check`: passed.

---

_Fixed: 2026-09-06T02:40:13Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
