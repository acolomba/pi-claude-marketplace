---
phase: 01-live-evidence-revalidation
fixed_at: 2026-09-06T15:53:45Z
review_path: .planning/phases/01-live-evidence-revalidation/01-REVIEW.md
iteration: 3
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-06T15:53:45Z
**Source review:** `.planning/phases/01-live-evidence-revalidation/01-REVIEW.md`
**Iteration:** 3

**Summary:**

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: The exact 32 stable requirement identities are derived from the untrusted ledger

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`, `tests/architecture/revalidation.test.ts`
**Commits:** 8fc68003, 725b3c8f, 1a184578, 6fbe1375
**Applied fix:** Added a closed 32-ID set and immutable per-ID clause signatures outside the mutable ledger. Check mode now rejects missing and unknown stable IDs, validates each ledger signature against its sealed ID-specific value, and validates planning prose against the same sealed value. Public CLI regressions cover a coordinated rename and a changed ledger signature.

### CR-02: Requirement-to-phase routing is compared only between two mutable documents

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 6738b932
**Applied fix:** Added immutable exact route/status contracts for all 32 requirements. Roadmap member sets now derive from those sealed routes, each traceability disposition is checked independently, and the existing cross-document consistency check remains active. Public CLI regressions cover a coordinated active-phase reassignment and evidence former-phase drift.

### CR-03: A four-space-indented fence marker is incorrectly treated as a closing fence

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `scripts/revalidation.negative.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 42424ae9
**Applied fix:** Closing fences now require zero to three leading spaces, the opener's marker, at least the opener's width, and only optional trailing whitespace. A public CLI regression proves that a four-space pseudo-closer cannot expose a hidden traceability row.

## Supporting Commits

- `3d97145c` mirrors all three adversarial witnesses in the standalone negative-control script.
- The expectation-only updates are included with the scoped regression commits above.

## Verification

All verification ran in the main checkout because `workflow.use_worktrees` is `false`.

- Architecture suite: 136/136 tests passed.
- Standalone negative controls: passed.
- Live ledger validation: passed.
- Live scope validation: 40 records passed.
- TypeScript typecheck: passed.
- Scoped ESLint: passed with zero warnings.
- Scoped Prettier: passed.
- Direct coverage for `scripts/revalidation.mjs`: 100% branches (789/789), functions (202/202), and lines (2657/2657).

## Remaining Risk

No known review finding remains. These are semantic contract changes, so the workflow's independent re-review remains the final confirmation rather than relying on fixer self-assessment.

---

_Fixed: 2026-09-06T15:53:45Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_
