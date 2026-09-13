---
phase: 01-live-evidence-revalidation
fixed_at: 2026-09-06T14:48:31Z
review_path: .planning/phases/01-live-evidence-revalidation/01-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-06T14:48:31Z
**Source review:** `.planning/phases/01-live-evidence-revalidation/01-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: Removing a live traceability row is accepted

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** `f32b7d2c` (diagnostic follow-up: `87892b36`)
**Applied fix:** Built the canonical requirement set from the ledger's `SCOPE-REQ-*` rows, required exactly 32 unique requirement rows, parsed the two evidence/history records, and compared definitions/history and traceability bidirectionally with deterministic missing and unexpected-row failures.

### CR-02: Requirement clause rewrites with the same ID and section are invisible

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`, `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`
**Commit:** `2a57a21f`
**Applied fix:** Parsed each complete multiline active or evidence/history clause, normalized it deterministically, recomputed its SHA-256 signature, and required it to match the signature carried by the corresponding canonical scope row. A same-ID, same-section clause rewrite now fails.

### CR-03: Scope-row IDs and requirementId fields can contradict each other

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** `bfba9c4c`
**Applied fix:** Required requirement row keys to equal `SCOPE-REQ-<requirementId>` and route row keys to equal `SCOPE-ROUTE-<requirementId>`, with route identities restricted to `PHASE-02` through `PHASE-09`. Both check mode and strict ledger validation use the invariant.

### CR-04: beforeAnchor path confinement is not enforced

**Status:** fixed: requires human verification
**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** `08d56d02`
**Applied fix:** Replaced divergent anchor checks with one strict locator parser shared by ledger and planning-contract validation. It validates both anchors, requires distinct nonblank three-part locators, fixes paths by row kind, and enforces exact requirement or phase identity.

### CR-05: The ordinary-output regression test uses production code as its oracle

**Status:** fixed
**Files modified:** `tests/architecture/revalidation.test.ts`
**Commit:** `30d49ab1`
**Applied fix:** Replaced the production-derived expected value with an independent complete JSON byte string over a case-owned two-row ledger, including sort order, projection fields, omitted anchors, indentation, and trailing newline.

## Verification

Verification ran in the main checkout because `workflow.use_worktrees=false`.

- `npm run typecheck` — passed.
- `npx eslint scripts/revalidation.mjs tests/architecture/revalidation.test.ts --max-warnings=0` — passed after the bounded complexity refactor in `b7f0a8fc`.
- Targeted Prettier checks for the two source/test files and canonical ledger — passed.
- `node --test tests/architecture/revalidation.test.ts` — passed; the final direct run covered 116/116 tests.
- `node scripts/revalidation.negative.mjs` — passed.
- `node scripts/revalidation.mjs validate` — passed.
- `node scripts/revalidation.mjs scope-impact --check` — passed with 40 records.
- `npm run test:coverage:direct -- scripts/revalidation.mjs` — passed at 699/699 branches, 187/187 functions, and 2276/2276 lines (100% each).
- Coverage-only guard commits: `1995a91c`, `cae8981a`.
- The full repository-scoped lint invocation was terminated after several silent minutes; the targeted lint over every file changed by this fix pass completed successfully.

---

_Fixed: 2026-09-06T14:48:31Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
