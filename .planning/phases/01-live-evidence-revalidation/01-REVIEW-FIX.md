---
phase: 01-live-evidence-revalidation
fixed_at: 2026-09-06T03:10:26Z
review_path: .planning/phases/01-live-evidence-revalidation/01-REVIEW.md
iteration: 3
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-06T03:10:26Z
**Source review:** `.planning/phases/01-live-evidence-revalidation/01-REVIEW.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: A false destination-state flag can delete both canonical artifacts

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commits:** df4f2b60, bfb56a12, 88bc9867
**Applied fix:** Recovery now validates the complete observed destination, stage, and backup state for every record before changing any path. It rejects ambiguous or impossible states without mutation, preserves an existing destination when a false journal flag conflicts with an intact staged file, and only removes a newly published destination when the active transaction recorded that exact publish. Regression cases compare both complete canonical byte sequences and cover existing-destination, first-publish, impossible-state, and failed-live-publish recovery paths.

### CR-02: Non-object collection records crash both validators

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 3ca6b184
**Applied fix:** Ledger files, decisions, and scope changes are collected through structural guards before later validation reads their fields. Shard files use the same boundary and require a string path. Null, array, string, and number records now produce exact `invalid-file`, `invalid-decision`, `invalid-scope-change`, or `invalid-shard-file` violations without throwing.

### CR-03: Filesystem cleanup tests do not observe the promised cleanup

**Status:** fixed
**Files modified:** `tests/architecture/revalidation.test.ts`
**Commit:** 9e4f552d
**Applied fix:** Staging failure, atomic-journal rename failure, staged recovery, published recovery, and rollback failure now compare the complete phase-directory artifact set. Successful cleanup proves stage, backup, journal, lock, and atomic temporary files are absent; rollback failure proves the recovery journal and surviving backup remain. Staged rollback and published cleanup are separate cases.

### WR-01: The repository gate rejects `validateShard` complexity

**Status:** fixed
**Files modified:** `scripts/revalidation.mjs`
**Commit:** 57a18d1b
**Applied fix:** Assignment and owner checks, claim ownership, file-to-claim links, and claim-to-finding links now live in focused helpers. `validateShard` is a short coordinator, and the fallow health gate reports zero functions above the configured threshold.

## Verification

All verification ran against the main checkout because `workflow.use_worktrees` is `false`. Child-process checks ran outside the restricted filesystem sandbox so the public CLI and repository suites could launch normally. Formatting follow-up commit: 3aab1f93.

- `npm run test:coverage:direct -- scripts/revalidation.mjs`: passed with 89 tests and 100% branch, function, and line coverage (565/565 branches, 156/156 functions, 1799/1799 lines).
- Focused `tests/architecture/revalidation.test.ts`: passed all cases; the final direct-coverage run exercised the complete 89-case file.
- `npx tsc --noEmit`: passed.
- Repository ESLint: passed with no warnings.
- Fallow dead-code, health, and duplication gates: passed; health reported 0 functions above threshold.
- Exact-file Prettier checks for all three reviewed files: passed.
- Corresponding-test, corresponding-test negative, and direct-coverage negative gates: passed.
- Unit suite: passed 5303 tests.
- Integration suite: passed 31 tests.
- `node scripts/revalidation.negative.mjs`: passed.
- `git diff --check`: passed.
- The aggregate `npm run check` reached `format:check` and stopped only on the pre-existing untracked `.mcp.json` formatting warning. That user-owned file was preserved; all later test stages were run separately and passed as recorded above.

---

_Fixed: 2026-09-06T03:10:26Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
