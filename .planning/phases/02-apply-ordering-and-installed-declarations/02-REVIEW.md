---
phase: 02-apply-ordering-and-installed-declarations
reviewed: 2026-10-28T15:09:44Z
depth: standard
files_reviewed: 36
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/types.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - features/marketplace/add.feature
  - features/plugin/apply.feature
  - features/plugin/bootstrap.feature
  - features/plugin/enable.feature
  - features/plugin/update-dependencies.feature
  - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/README.md
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - test/orchestrators/reconcile/pending.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - features/plugin/import.feature
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/reconcile/load.test.ts
  - test/orchestrators/reconcile/notify.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-28T15:09:44Z
**Depth:** standard
**Files Reviewed:** 36
**Status:** clean

## Narrative Findings (AI reviewer)

## Summary

Re-reviewed the integrated tree at `69e804cf9c2b3875da64e604f75fc48cd01f1478` after fixes `d0b7e21e`, `7938b740`, and `69e804cf`. Both previous BLOCKER findings are resolved. No new Critical or Warning defect was found in the fix diffs and their affected callers.

This review retains the previous 32-file scope and adds the four regression-test files newly inspected for the fixes. It reuses the earlier review of unchanged source, inspects every source/test/Cucumber change since `ce020fa5`, and traces the affected planning, notification, load, placement, save, and rollback paths. Test-file review focuses on the relevant cases and their fixtures. Recorded project decisions remain authoritative; this review does not reopen the documented installed-copy/path-source distinction, refusal rows, separate move/enable rows, or other accepted Phase 2 choices.

## Previous finding dispositions

| Finding | Disposition | Current evidence |
|---|---|---|
| CR-01: Pending and load reject source changes apply repairs | **Resolved** | `pending.ts:481-501` uses `withMarketplaceSourceRepairs` for the initial plan, the post-toggle plan, and both dependency-release replans. The shared helper retains apply's replacement marker and removes the official fallback mismatch. `notify.ts:689-699` suppresses only a `source-mismatch` paired with an add for the same scope and marketplace; unknown-stored, dangling-reference, and malformed-key failures still render. `load.ts:142` uses the corrected composer. The revised tests assert an actionable replacement, official fallback's empty report, preservation of genuine diagnostic failures, and a load that does not mutate scope files. Behavioral scenarios compare pending, load without autoapply, and apply. |
| CR-02: Hosted URL replacement fails with stale clone | **Resolved** | `add.ts:934-948` now includes hosted sources in the existing managed-directory swap. The swap occurs after the new catalog has been staged and its name validated. `replaceMarketplaceInState` restores the original directory on placement failure; `unwindUnsavedAdd` removes the new directory before restoring the old one on save failure; successful save discards the set-aside directory. Local path directories remain outside that flow. New tests cover hosted-to-hosted and hosted-to-github replacement while retaining installed records, and a failed save that checks original state, catalog bytes, ownership marker, and empty staging. Apply/import scenarios exercise a changed hosted URL, including a second no-op apply. |

The stale load assertion corrected by `69e804cf` now expects the replacement preview and apply trailer. It still checks that the load leaves the scope files unchanged.

## Regression assessment

- The shared source-policy helper adds no I/O to pending. It receives an already loaded config/state/plan; its import introduces no call to a mutating read pass.
- Each pending replan starts with a new raw `planReconcile` result before normalization, so repeated dependency settlement does not accumulate duplicate replacement actions.
- The pending projection leaves the marker available to `applyMarketplaceAdds`, which still selects `replaceRecorded`. Suppression is scoped to the pending display and requires a matching action.
- Hosted replacement now follows the same containment-checked staging, restoration, and cleanup paths as git replacement. The failure test uses different replacement catalog bytes and checks the original hosted marker, so leaving the replacement tree behind cannot satisfy its assertions.
- No new Critical, Warning, or Info findings remain from this re-review. Historical observations and earlier dispositions remain in `02-REVIEW-FIX.md` and repository history.

## Validation evidence

- The parent supplied the final combined-tree `npm run check` result at `69e804cf`, Node `v26.12.1`: exit 0; static, integration, and unpaired checks passed; Cucumber passed **1122 scenarios / 11447 steps**; direct coverage merged **309 LCOV records**.
- Independently verified that the working-tree changes after that commit are limited to planning Markdown. The full-check result therefore applies to the reviewed source inputs under the local-verification rules.
- Independently ran the targeted regression names in `pending.test.ts`, `notify.test.ts`, `load.test.ts`, and marketplace `add.test.ts` with `node --test --test-reporter=spec --test-name-pattern=...`: exit 0, all four reported file results passed.
- Inspected the fixer's mutation evidence in `02-REVIEW-FIX.md`: the new regression cases and behavioral scenarios failed before their production fixes and passed afterward. This evidence was supplied by the fixer; the targeted passing run above was independently repeated.
- Attempted `fallow review --base ce020fa5 --brief --format json --quiet --explain`. It exited 2 because it could not create a temporary base worktree. This is unavailable orientation evidence, not a clean structural result. The passing full-check static evidence remains applicable.
- `git diff --check` passed. This reviewer changed only this report, made no implementation/test edits, and created no commit.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
