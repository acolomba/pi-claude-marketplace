---
phase: 06-import-marketplace-planning
fixed_at: 2026-10-29T00:09:33Z
review_path: .planning/phases/06-import-marketplace-planning/06-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-10-29T00:09:33Z
**Source review:** .planning/phases/06-import-marketplace-planning/06-REVIEW.md
**Iteration:** 2

## Summary

All three critical findings in the current review are fixed in separate commits. This report supersedes iteration 1, whose finding IDs referred to the earlier review.

- Findings in scope: 3
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: An unchanged marketplace add can make an import failure disappear

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`, `test/orchestrators/import/execute.test.ts`, `features/plugin/import.feature`

**Commit:** 6680b940

**Applied fix:** Import checks the canonical name returned by an unchanged add. A different name enters the existing source-reuse disposition: the absent settings name is blocked, and its plugins report `marketplace-not-added`. An unchanged add with the requested name retains a skipped marketplace header when it has planned plugins. An unchanged add without plugins retains its empty output. Existing reuse semantics, including the failed marketplace and plugin each contributing to the tally, remain unchanged.

**RED evidence:** The empty-state real-add/install regression returned `unexpected-failure` for the second name. Its Cucumber scenario reported severity `info` and zero failures. A second unit case lost the header after a same-name unchanged add.

**GREEN evidence:** Both new unit cases and the existing no-plugin unchanged case pass. The real scenario asserts every plugin row, error severity, two failures, two successes, and complete config and install declarations. Only the canonical marketplace and successful plugin are declared. The execute source/test pair passes 100% direct coverage.

**Status:** fixed: requires human verification (marketplace disposition and header logic)

### CR-02: Apply hides rollback phases and leaked artifacts after a failed enable

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`, their three paired tests, and `features/plugin/apply.feature`

**Commit:** a769f58f

**Applied fix:** A failed enable with rollback partials carries its redacted error chain and redacted phase causes through the apply outcome. The shared failed-row projection preserves the cause, leaked-resource names, and phase rows. A failed enable after a catalog move uses that same projection, retaining the move's version fields and the failure's MCP notices. Failure rows without rollback partials keep their existing behavior. The toggle failure builder's type now names its two actual variants. The replaced reason filter and its unused constant/import were removed.

**RED evidence:** The real read-only skill undo plus blocked MCP config produced only `{rollback partial}`. The apply unit case, notification projection case, and Cucumber scenario failed on the missing cause, phase, and leaked skill.

**GREEN evidence:** The real apply case and Cucumber scenario show the complete recovery detail and retain the disabled installation record. The unit case also confirms the leaked file remains. A second real unit case covers an enable after a catalog move, including retained version and disabled state. The apply, apply-outcomes, and notify source/test pairs pass 100% direct coverage.

**Status:** fixed: requires human verification (failure propagation and move-row projection)

### CR-03: Path redaction misses whitespace-containing paths and standard UNC paths

**Files modified:** `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts`, `test/shared/redact-absolute-paths.test.ts`, `test/orchestrators/import/execute.test.ts`, `test/orchestrators/reconcile/apply.test.ts`

**Commit:** a04c4756

**Applied fix:** Redaction recognizes complete quoted filesystem paths before applying the existing bare-path matcher. Quoted paths can contain spaces and Unicode. The bare-path matcher recognizes ordinary UNC prefixes as well as extended UNC prefixes. A quote starts a path only when followed by an absolute-path prefix, so an apostrophe earlier in prose does not hide the path. Structured manual-recovery leaks use their known absolute-path boundaries to select the basename. URLs, single-segment JSON pointers, relative paths, and non-path prose retain their exclusions.

**RED evidence:** Eight helper cases failed on the reviewed source. The composed import case exposed absolute paths at every cause link and in both leaked-resource entries. A real apply rollback under a temporary root containing spaces and Unicode exposed the root in the main cause, phase cause, and leak. An additional apostrophe-boundary regression failed before that boundary was tightened.

**GREEN evidence:** All 31 redactor tests pass. The complete import notification contains only basenames for the POSIX and UNC paths throughout the root chain, rollback chain, and leaked entries. The real apply case retains its exact basename-only notification under the spaced Unicode root. The redactor, import execute, and apply source/test pairs pass 100% direct coverage.

**Status:** fixed: requires human verification (redaction matching logic). A fresh security recheck is required for CR-03 and the T-06-10/T-06-11 mitigation. The historical security report was not changed.

## Verification

All checks ran in the existing isolated worktree `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369`, branch `agent-reverify-c`, with Node `v26.12.1`. No nested worktree was created.

- Re-read each changed source section and inspected its diff.
- Ran focused unit regressions before and after each fix.
- Ran direct coverage for every changed source/test pair: import execute; reconcile apply, apply-outcomes, and notify; shared redact-absolute-paths. All reached 100% line, function, and branch coverage, or the gate's type-only classification where applicable.
- Ran the exact new Cucumber scenarios together after the final source changes: `npx cucumber-js --name '^Importing two names for one new source|^Apply reports the rollback phases and leaks' --parallel 1`. Exit 0: 2 scenarios, 25 steps.
- Ran `npx fallow audit --base HEAD` before each fix commit. All three audits found no issues in changed files.
- Ran pre-commit fixers and normal commit hooks for all three commits. Final hooks passed `npm run check:commit`, including typecheck, lint, Fallow, formatting, source/test pairing, `check:features`, unpaired tests, and staged-pair direct coverage. The first CR-02 commit attempt failed typecheck; its builder type was corrected and the next normal hook passed. No hook was bypassed.
- The combined-tree `npm run check` gate, fresh review, and security recheck remain the orchestrator's next steps. Per-fix checks do not replace that gate.

UNC checks exercise platform-independent diagnostic strings and structured leak fields, not a Windows filesystem. Quoted diagnostics and structured leaked paths supply boundaries for paths containing spaces; arbitrary unquoted prose remains inherently ambiguous.

The report remains uncommitted for the orchestrator. No source changes remain uncommitted.

---

_Fixed: 2026-10-29T00:09:33Z_
_Fixer: gsd-code-fixer_
_Iteration: 2_
