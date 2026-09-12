---
phase: 01-live-evidence-revalidation
fixed_at: 2026-09-06T02:06:56Z
review_path: /home/acolomba/pi-claude-marketplace-refine-unit-tests/.planning/phases/01-live-evidence-revalidation/01-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-09-06T02:06:56Z
**Source review:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/.planning/phases/01-live-evidence-revalidation/01-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 12
- Fixed: 12
- Skipped: 0

## Fixed Issues

### CR-01: Unknown schema modes bypass every live-ledger invariant

**Files modified:** `scripts/revalidation.mjs`
**Commit:** a7fee12a
**Applied fix:** Fixed; requires human verification. Validation now accepts only schema version 1 and the `live` or `fixture` inventory modes. The canonical ledger must use `live` mode.

### CR-02: The decision gate accepts missing and contradictory dossiers

**Files modified:** `scripts/revalidation.mjs`
**Commit:** c5b667df
**Applied fix:** Fixed; requires human verification. Live ledgers now require the exact nine decision IDs. Resolved decisions require unique options, a selected option from that set, and unique rejected options that are not selected.

### CR-03: Claim-to-finding links do not have to agree in both directions

**Files modified:** `scripts/revalidation.mjs`
**Commit:** ff34093c
**Applied fix:** Fixed; requires human verification. Each finding now declares exactly the claims whose source records point back to that finding.

### CR-04: A duplicate premise is treated as terminal when its target is inconclusive

**Files modified:** `scripts/revalidation.mjs`
**Commit:** e709f274
**Applied fix:** Fixed; requires human verification. Duplicate chains now resolve transitively, reject cycles and broken links, and require a terminal non-inconclusive target.

### CR-05: Per-file category and plan provenance are not validated

**Files modified:** `scripts/revalidation.mjs`
**Commit:** 7d1e9042
**Applied fix:** Fixed; requires human verification. Live file rows now match the assignment plan and the category derived from the canonical path.

### CR-06: Valid Phase 10 through Phase 19 routes are rejected

**Files modified:** `scripts/revalidation.mjs`
**Commit:** cd45ca6d
**Applied fix:** Fixed; requires human verification. Phase routes now parse their full numeric suffix and accept every phase number from 2 upward.

### CR-07: The redaction check misses JSON-shaped credentials

**Files modified:** `scripts/revalidation.mjs`
**Commit:** 612c7f85
**Applied fix:** Validation now checks the permitted evidence fields recursively and rejects JSON credentials, sensitive shell flags, authorization headers, and Unix, macOS, or Windows home paths.

### CR-08: Output symlinks can redirect writes outside the repository

**Files modified:** `scripts/revalidation.mjs`
**Commit:** 3335c312
**Applied fix:** Read and write paths now stay under the real project root. Existing output symlinks and non-file targets are rejected, and staged files use no-follow creation.

### CR-09: Publishing can replace JSON and then fail before replacing Markdown

**Files modified:** `scripts/revalidation.mjs`
**Commit:** a03ede42
**Applied fix:** Fixed; requires human verification. Publication now uses a lock, durable staged files, backups, and a recovery journal so the JSON and Markdown outputs commit or roll back together.

### CR-10: Validated ledger fields can inject raw Markdown and HTML

**Files modified:** `scripts/revalidation.mjs`
**Commit:** d0ea1ec1
**Applied fix:** Ledger identifiers and paths now use closed grammars. The renderer also escapes Markdown control characters and HTML delimiters for each output context.

### CR-11: Required negative paths are not covered by reliable tests

**Files modified:** `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json`, `scripts/revalidation.mjs`, `scripts/test-coverage-direct.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 5a9becd8
**Applied fix:** The direct-coverage gate now owns the revalidation source and test pair. Sixty focused tests cover literal output bytes, real read and write symlinks, actual CLI drift, failure after either publish step, lock and journal recovery, malformed records, and all validator branches. The canonical ledger was reconciled with the new bidirectional link and decision-option invariants.

### WR-01: Whole-file complexity suppression hides two monolithic control functions

**Files modified:** `scripts/revalidation.mjs`, `tests/architecture/revalidation.test.ts`
**Commit:** 8ee50067
**Applied fix:** Validation is split into schema, inventory, claim, finding, decision, scope, and cross-link passes. CLI verbs use small handlers. The whole-file complexity suppression and the two narrow complexity suppressions were removed.

## Verification

All verification ran in the main checkout because `workflow.use_worktrees` is `false`.

- `npm run test:coverage:direct -- scripts/revalidation.mjs`: passed with 60 tests and 100% lines, branches, and functions.
- `npm run typecheck`: passed.
- Targeted ESLint for the modified script and test: passed with no warnings.
- `npx fallow health --fail-on-issues --format human`: passed with zero findings above the configured threshold.
- `node scripts/revalidation.mjs validate`: passed against the canonical live ledger.
- JavaScript syntax checks and `git diff --check`: passed.

---

_Fixed: 2026-09-06T02:06:56Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
