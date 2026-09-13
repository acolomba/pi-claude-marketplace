---
phase: 01-live-evidence-revalidation
fixed_at: 2026-09-06T15:21:43Z
review_path: .planning/phases/01-live-evidence-revalidation/01-REVIEW.md
iteration: 2
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-06T15:21:43Z
**Source review:** `.planning/phases/01-live-evidence-revalidation/01-REVIEW.md`
**Iteration:** 2

**Summary:**

- Findings in scope: 6
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Commented-out Markdown still counts as a live contract

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** ff847946
**Applied fix:** Added one Markdown state machine that removes HTML comments and fenced blocks before contract parsing. Added four public CLI controls.

### CR-02: A blank requirement clause bypasses its signature

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** c1744592
**Applied fix:** Kept active and history clauses separate. The checker rejects missing or blank clauses before it compares clause signatures.

### CR-03: Evidence-only IDs can simultaneously become active definitions

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** b0c9401a
**Applied fix:** Required each requirement ID to exist in one location. Added controls for active and evidence overlap in both directions.

### CR-04: Check mode accepts structurally invalid ledger actions

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 546c0afd
**Applied fix:** Shared one row structure validator between ledger validation and contract checks. Added controls for invalid actions, row kinds, and missing signatures.

### CR-05: Traceability routes outside the phase grammar are ignored

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 708aedf1
**Applied fix:** Closed the active and evidence route grammar. Added Phase 1 membership checks and public controls for arbitrary route labels.

### CR-06: Duplicate roadmap requirement declarations are accepted

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 7fb41651
**Applied fix:** Required one declaration per phase. The parser rejects conflicting declarations and duplicate members before it compares phase membership.

## Supporting commits

- `aeaea114` applied the formatter output.
- `bf16b092` split validation helpers to satisfy the complexity rule.
- `41fef780` updated exact compound-violation outputs.
- `c0f79fbe` added the duplicate-member branch control.

## Gate results

All gates ran in the main checkout because `workflow.use_worktrees` is `false`.

- Architecture suite: 131 tests passed.
- Negative controls: passed.
- Live ledger: valid.
- Live planning scope: 40 records valid.
- TypeScript: passed.
- Changed-file ESLint: passed with zero warnings.
- Changed-file Prettier: passed.
- Direct coverage: 100% branches, functions, and lines for `scripts/revalidation.mjs`.

---

_Fixed: 2026-09-06T15:21:43Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
