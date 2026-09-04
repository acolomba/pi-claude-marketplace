---
phase: 113-orchestrator-support-and-presenters
reviewed: 2026-09-01T06:31:53Z
depth: standard
files_reviewed: 72
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/orchestrators/discover.ts
  - extensions/pi-claude-marketplace/orchestrators/import/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/disabled-state-classification.test.ts
  - tests/architecture/notify-producer-wire-coverage.test.ts
  - tests/architecture/notify-stamp-coverage.test.ts
  - tests/bridges/agents/stage.test.ts
  - tests/integration/fold-adoption.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/discover.test.ts
  - tests/orchestrators/import/execute.messaging.test.ts
  - tests/orchestrators/import/marketplaces.test.ts
  - tests/orchestrators/import/refs.test.ts
  - tests/orchestrators/import/settings.test.ts
  - tests/orchestrators/import/types.test.ts
  - tests/orchestrators/marketplace/add.messaging.test.ts
  - tests/orchestrators/marketplace/autoupdate.messaging.test.ts
  - tests/orchestrators/marketplace/cascade.test.ts
  - tests/orchestrators/marketplace/list.messaging.test.ts
  - tests/orchestrators/marketplace/remove.messaging.test.ts
  - tests/orchestrators/marketplace/remove.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin-path.test.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
  - tests/orchestrators/plugin/clone-gc.test.ts
  - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
  - tests/orchestrators/plugin/discover-names.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.messaging.test.ts
  - tests/orchestrators/plugin/git-source-probe.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list.messaging.test.ts
  - tests/orchestrators/plugin/plugin-state-classifier.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.messaging.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-row.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/reconcile/apply-outcomes.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/notify-projection-edge.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/orchestrators/reconcile/plan-convergence.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/orchestrators/reconcile/types.test.ts
  - tests/orchestrators/scope-fanout.test.ts
  - tests/orchestrators/types.test.ts
  - tests/orchestrators/plugin/clone-cache-defaults.test.ts
  - tests/orchestrators/plugin/clone-cache-seed.test.ts
  - tests/orchestrators/plugin/clone-gc-errors.test.ts
  - tests/orchestrators/plugin/git-source-probe-upgrade.test.ts
  - tests/orchestrators/plugin/mirror-head-read-errors.test.ts
  - tests/orchestrators/plugin/mirror-head-read.test.ts
  - tests/shared/plugin-path.test.ts
findings:
  critical: 0
  warning: 2
  info: 0
  total: 2
status: issues_found
---

# Phase 113: Code Review Report

**Reviewed:** 2026-09-01T06:31:53Z
**Depth:** standard
**Files Reviewed:** 72
**Status:** issues_found

## Summary

The 35 owner migrations retain their direct source ownership, and the production behavior changes in discovery, clone promotion, message projection, and state classification are internally consistent. The closed-union defaults were removed without impossible casts or coverage-ignore directives; `noImplicitReturns` still makes a future unhandled union member fail typecheck. The discovery change continues to reject stable directory and file symlinks, non-directory skill entries, non-file prompts, and missing `SKILL.md` entries. The clone-cache simplification preserves `Error` normalization because `appendLeakToError` always returns `Error`. The update-fixture and staged-rollback aggregate repairs preserve the asserted product behavior and remove the observed nondeterminism.

Two review warnings remain. One aggregate dead-code repair silently removes module exports that were present at the review base. Separately, several changed tests use unverified `strong-mock` objects as broad stubs, including one mock shared by more than thirty cases. Those patterns conflict with the phase's public-surface, strict-interaction, and case-isolation contracts even though the current focused tests pass.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The aggregate dead-code repair silently narrows two shipped module contracts

**Classification:** WARNING

**Files:** `extensions/pi-claude-marketplace/orchestrators/import/index.ts:1`; `extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts:121-127`

**Issue:** At base `cf8dd78c`, `orchestrators/import/index.ts` exported `buildClaudeImportPlan`, `planMarketplaceSourcesForRefs`, `extractEnabledPluginRefs`, `parseEnabledPluginRef`, `loadMergedClaudeSettingsForScope`, `mergeClaudeSettings`, `resolveClaudeSettingsPaths`, and the `EnabledPluginRef` type. The current barrel exports only `importClaudeSettings`. The same aggregate commit changed exported `AsyncRewakeEntry` to a private interface. These are observable contract changes: the package publishes the complete `extensions/pi-claude-marketplace/**` tree, has no `exports` map that hides these modules, and importing a formerly exported barrel binding now fails during ESM instantiation. The import barrel also has a dedicated later owner row, so removing its surface as an aggregate fallow repair bypasses the required pair-local contract decision and compatibility proof. No production caller currently uses these exports, which lowers the severity, but caller absence does not by itself preserve consumers of the published module paths.

**Fix:** Restore the prior exports until their owning pairs make an explicit compatibility decision. If the symbols are intentionally internal, land that narrowing with the relevant mirrored barrel/registry owner evidence and an explicit breaking-surface decision; migrate or reject the prior bindings there instead of treating a green dead-code gate as authorization. A barrel owner can import through the barrel and pin each retained binding to its concrete source, as required by the project guideline.

### WR-02: Broad unverified mocks weaken interaction and case-isolation evidence

**Classification:** WARNING

**Files:** `tests/integration/fold-adoption.test.ts:73-90`; `tests/orchestrators/plugin/enable-disable.test.ts:38-78`; `tests/orchestrators/plugin/install.test.ts:73-102`; `tests/orchestrators/plugin/reinstall.test.ts:46-94`; `tests/orchestrators/marketplace/update.test.ts:144-158`; `tests/orchestrators/reconcile/apply.test.ts:61-77`

**Issue:** These changed harnesses construct `strong-mock` objects, mark their accessors or `ui.notify` functions with `anyTimes()`, and never call `verify()` for the mocks. `strong-mock` does not fail when an expected call is omitted until verification; a direct probe confirmed that an uncalled expectation exits successfully without `verify()`. Consequently, the harnesses accept zero or arbitrary collaborator calls and cannot prove promised notification/probe cardinality. `reconcile/apply.test.ts` compounds this by keeping `STUB_PI` as a module-scope mock and reusing it in more than thirty cases, so its mutable invocation bookkeeping is not case-local. This contradicts the locked rules that prohibit `anyTimes()`, require explicit verification for interaction mocks, and require fresh collaborators per case.

**Fix:** Use fresh plain typed stubs for canned properties such as `cwd` and `getAllTools`. Use case-local strict mocks only when notification or command interaction is the public promise; state exact arguments and counts and call `verify()` at the end of that case. Replace module-scope `STUB_PI` with a factory that returns a fresh collaborator for each test.

## Pre-existing and Out-of-Phase Observations

- The only `as unknown as` occurrences in the reviewed current files are at `tests/orchestrators/plugin/update.test.ts:191,194`; blame places both in commit `751836d6`, before review base `cf8dd78c`. Phase 113 introduced no impossible-union cast, coverage-ignore pragma, skipped case, or fabricated closed-union member.
- `discover.ts` still has the general check/use race inherent in checking a path and opening it later. The base implementation had the same parent-path race; the Phase 113 refactor neither introduced nor expanded it, so it is not counted as a Phase 113 finding. Stable symlink shapes remain rejected.
- The repository-wide correspondence gate currently reports 25 open-milestone violations, including later-phase missing owners and pre-existing supplement names. Phase 113's frozen acceptance instead ran the explicit 35-source direct loop; this review does not attribute the milestone-wide inventory backlog to the Phase 113 diff.

## Verification Evidence

- `npm run typecheck` passed.
- `npm run lint` passed.
- `git diff --check cf8dd78c..HEAD -- extensions/pi-claude-marketplace tests` passed.
- Focused execution of `discover.test.ts`, `marketplace/update.messaging.test.ts`, `reconcile/apply.test.ts`, and `bridges/agents/stage.test.ts` passed 4/4 files.
- Static review found no introduced `as any`, double assertion, coverage-ignore directive, `test.only`, `test.skip`, or `test.todo` in the reviewed Phase 113 changes.
- The phase execution record reports 35/35 direct records and an exact clean-worktree `npm run check` pass after aggregate commits `57e3bf70`, `253d5c5e`, and `a7c061af`.

---

_Reviewed: 2026-09-01T06:31:53Z_
_Reviewer: the agent (gsd-code-reviewer inline fallback)_
_Depth: standard_
