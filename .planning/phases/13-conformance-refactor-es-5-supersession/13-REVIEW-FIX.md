---
phase: 13-conformance-refactor-es-5-supersession
fixed_at: 2026-05-24T00:00:00Z
review_path: .planning/phases/13-conformance-refactor-es-5-supersession/13-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 5
skipped: 2
status: partial
---

# Phase 13: Code Review Fix Report

**Fixed at:** 2026-05-24
**Source review:** `.planning/phases/13-conformance-refactor-es-5-supersession/13-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (2 warnings + 5 info; 0 critical, 0 blocker)
- Fixed: 5 (WR-01, WR-02, IN-01, IN-04, IN-05)
- Skipped: 2 (IN-02 architectural decision, IN-03 doc-only on historical artefacts)

Final gate: `npm run check` green (typecheck + ESLint + Prettier + 1142 tests, all pass). The new WR-01 regression suite adds 6 tests; IN-05 removed 1 vestigial test; net delta vs the 1138-test baseline is +4 (pre-fix accounting also included one synthetic counter the new runner consolidates).

## Fixed Issues

### WR-01: ManualRecoveryError loses its class identity if state-lock release also fails

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`, `tests/orchestrators/plugin/reinstall.test.ts`
**Commit:** `6caa431`
**Applied fix:** Introduced `findManualRecoveryError(err)`, a depth-5 cause-chain walker that mirrors `causeChainTrailer`'s DoS-mitigation budget at `shared/errors.ts::causeChainTrailer` (bound 5 hops, terminate on self-referencing cycle). Both catch-site spreads in `reinstall.ts:201,276` now route through the walker instead of the bare `err instanceof ManualRecoveryError` predicate. The walker recovers the class identity that `withScopeLock`'s release-also-failed wrapping at `transaction/with-state-guard.ts:138-143` discards, so the structural CMC-16 `failureClass: "manual-recovery"` tag survives that path and the cascade row's Reason stays `{rollback partial}` instead of silently downgrading to `{not in manifest}`. Exposed the walker via `__test_findManualRecoveryError` and added 6 regression tests pinning both the positive walk and the negative bounds (depth-5 limit, self-cycle, opaque-only chain returns undefined, end-to-end binding through `__test_outcomeToCascadeRow`).

### WR-02: Orphaned JSDoc blocks above `__test_*` re-exports

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
**Commit:** `5ae15fe`
**Applied fix:** Moved `export { x as __test_x }` re-exports BELOW the function declarations they alias, at three sites: `outcomeToCascadeRow`, `errorWithManualRecovery`, and the newly-introduced `findManualRecoveryError`. Each re-export carries a "Placement note (WR-02)" sentence in its JSDoc so the rationale is load-bearing in the source and future refactors don't re-introduce the orphan. The primary contract JSDoc on each function is now adjacent to its declaration and binds correctly under TypeScript Language Server hover-doc, VS Code, and typedoc.

### IN-01: Phase-ledger header docstring is now factually incorrect

**Files modified:** `extensions/pi-claude-marketplace/transaction/phase-ledger.ts`, `tests/architecture/no-legacy-markers.test.ts`
**Commit:** `19680a8`
**Applied fix:** Rewrote the phase-ledger.ts file header to describe the closed-set CMC-11 token form `(failed) {rollback partial}` + 2-space-indented child rows `[<phase>] (rollback failed) {rollback partial}` that `transaction/rollback.ts` actually emits after commit `64d823f`. Tagged the supersession with the commit hash so future readers find the history. The legacy `(rollback partial: ...)` literal still appears INSIDE the header as a "retired in commit 64d823f" historical reference, so the file stays on the `no-legacy-markers.test.ts` ALLOW_LIST -- but the rationale on that allow-list entry is updated from "stays until a later refactor" (scope-deferred) to "documentation-of-supersession" (intentional).

### IN-04: Commit title for `da8a566` is 79 chars

**Files modified:** `.pre-commit-config.yaml`
**Commit:** `d104acc`
**Applied fix:** Added `default_install_hook_types: [pre-commit, commit-msg]` at the top of `.pre-commit-config.yaml`. A single `pre-commit install` now installs BOTH hook types, so the gitlint hook (which runs at `commit-msg` stage) actually executes on `git commit` and catches future 72-char title-length violations. The repo previously had gitlint configured but the `commit-msg` hook was never installed -- only `pre-commit install` had run, which installs only the `pre-commit` stage hook. The header comment documents the one-time migration step for contributors who installed hooks before this change. The already-merged 79-char `da8a566` title is left as-is per the reviewer's "not worth a rewrite" note.

### IN-05: `tests/helpers/prd-extract.ts` is now vestigial

**Files modified:** `tests/architecture/markers-snapshot.test.ts`, `tests/architecture/grammar-frontmatter.test.ts`
**Files deleted:** `tests/helpers/prd-extract.ts`
**Commit:** `3de0c0f`
**Applied fix:** Deleted `tests/helpers/prd-extract.ts` (28 lines, zero production consumers) and removed its lone test consumer (`extractEs5MarkerLiterals throws if PRD §6.12 ES-5 row is missing` at markers-snapshot.test.ts:31) which was a tautological self-check of a function that has no real consumers. The static-audit gate at `tests/architecture/no-legacy-markers.test.ts` is the actual defense against ES-5 marker re-introduction and is untouched. Updated a comment-only reference to the deleted helper at `tests/architecture/grammar-frontmatter.test.ts:29` to note that the referenced precedent was deleted in this cleanup. No coverage change.

## Skipped Issues

### IN-02: F-2 binding regression guard is unit-level only

**File:** `tests/orchestrators/plugin/reinstall.test.ts:1098-1149` + `tests/edge/handlers/plugin/reinstall.test.ts:217-263`
**Reason:** Architectural decision documented in the 13-02a-02 SUMMARY's Deviation #1: the integration fixture for a real-bridge `ManualRecoveryError` requires POSIX chmod manipulation to force a leak, which is fragile. The unit-level seam at `__test_outcomeToCascadeRow` binds the structural mapping; the reviewer flagged it as INFO not WARNING precisely because the trade-off was acknowledged. The fix would require plumbing a new `__deps: { replacePreparedAgents: () => Promise.reject(new ManualRecoveryError(...)) }` seam through `reinstallPlugin` -- a non-trivial dep-injection change that warrants its own plan rather than an ad-hoc review-fix. Additionally, WR-01's new `__test_findManualRecoveryError` regression suite now covers the specific structural-pivot regression risk that IN-02 was worried about (a future refactor breaking the predicate would fail the 6 new tests, not just the catalog UAT).
**Original issue:** The unit seam binds the structural mapping but does NOT exercise the end-to-end flow: bridge throws ManualRecoveryError -> orchestrator catches -> spread sets failureClass -> outcomeToCascadeRow maps to ["rollback partial"] -> cascade renderer emits `(failed) {rollback partial}`.

### IN-03: SUMMARY/commit body mis-states `extractEs5MarkerLiterals` post-edit return value

**Files:** `.planning/phases/13-conformance-refactor-es-5-supersession/13-03-02-PLAN.md:88` + `c4d87d4` commit body
**Reason:** Doc-only precision issue (the plan said the helper "returns 0 literals"; it actually returns 1). The downstream effect is identical (the snapshot assertion must be deleted regardless of whether the helper returns 0 or 1), so this is purely a quantitative documentation imprecision with no runtime impact. The affected artefacts are both historical: (a) the PLAN.md is execution context that the corresponding SUMMARY already references -- editing it now mutates the historical record the SUMMARY depends on; (b) the `c4d87d4` commit body is already merged and per IN-04's "not worth a rewrite" guidance, retroactive commit amends on merged commits are disruptive. Additionally, IN-05's deletion of `tests/helpers/prd-extract.ts` retires the helper entirely, making the documented behavior moot.
**Original issue:** The plan-text rationale ("returns 0 literals; the `literals.length === 5` assertion fails without deletion") is directionally correct but quantitatively wrong: the assertion fails because length is 1, not 5; the helper does not return 0.

---

_Fixed: 2026-05-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
