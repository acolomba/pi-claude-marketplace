---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-28T03:45:47Z
depth: standard
files_reviewed: 89
files_reviewed_list:
  - .agents/skills/cucumber/rules/layout.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - extensions/pi-claude-marketplace/bridges/agents/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - features/lib/git-clones.ts
  - features/lib/https-git-host/server.ts
  - features/lib/pi-tui-pty.py
  - features/lib/pi-tui.ts
  - features/lib/plugin-completions.ts
  - features/lib/run-tokens.ts
  - features/marketplace/add.feature
  - features/marketplace/background-update.feature
  - features/marketplace/failed-add.feature
  - features/marketplace/market-alias.feature
  - features/marketplace/update.feature
  - features/marketplace/usage-errors.feature
  - features/plugin/apply.feature
  - features/plugin/enable.feature
  - features/plugin/fetch.feature
  - features/plugin/git-source-update.feature
  - features/plugin/git-source.feature
  - features/plugin/import.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/install-rollback.feature
  - features/plugin/install.feature
  - features/plugin/list-filters.feature
  - features/plugin/list.feature
  - features/plugin/package-dependencies.feature
  - features/plugin/prune.feature
  - features/plugin/reinstall.feature
  - features/plugin/update-dependencies.feature
  - features/plugin/update.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/completion.steps.ts
  - features/step_definitions/config.steps.ts
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/marketplace/background-update.steps.ts
  - features/step_definitions/marketplace/checkout.steps.ts
  - features/step_definitions/mcp-configuration.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/plugin/update.steps.ts
  - features/support/world.ts
  - scripts/check-features.mjs
  - scripts/check-phase10-coverage.mjs
  - test/architecture/https-git-host-server.test.ts
  - test/bridges/agents/stage.test.ts
  - test/e2e/_rpc.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/orchestrators/import/execute.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/fetch.test.ts
  - test/orchestrators/plugin/install-cascade.messaging.test.ts
  - test/orchestrators/plugin/install-cascade.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/plugin/marketplace-seed.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/reinstall-flow.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/read-pass.test.ts
  - test/shared/git-failure-classifiers.test.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-28T03:45:47Z
**Depth:** standard
**Files Reviewed:** 89
**Status:** issues_found

## Structural Findings (fallow)

Fallow review and audit against `4ce415254e89c39c0257c78977f1c047838c0d8c` both completed successfully. Audit verdict: pass; dead-code issues: 0; complexity findings: 0; duplication clone groups: 0. These results orient the review and do not establish behavioral correctness. The audit reported its configured CRAP threshold as 0, so it is not evidence of a separate max-CRAP-30 check.

## Narrative Findings (AI reviewer)

### Summary

Reviewed the resolver's task-commit union, all six explicitly included outside-union files, and the source/test changes from security fixes `d6c98433` and `689b4499`. Planning records supplied context and are excluded from source findings. Review covered changed code and surrounding contracts, including lifecycle mutations, rollback diagnostics, containment, harness cleanup, and whether new scenarios reject incorrect behavior. CodeGraph was consulted before tracing call paths; stale indexed source was checked against the current files.

The reported full gate on `689b4499` remains useful regression evidence, but two targeted reproductions expose gaps it does not detect. No implementation or test files were modified during review.

### Critical Issues

#### CR-01: BLOCKER — The normal reconcile read pass schedules each source replacement twice

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p10-tests-79b511/extensions/pi-claude-marketplace/orchestrators/reconcile/read-pass.ts:190-215`

**Related locations:** `read-pass.ts:86-121`, `read-pass.ts:382-399`; `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p10-tests-79b511/extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:323-338`.

**Issue:** `readScopeLocked` already applies `withMarketplaceSourceRepairs` before passing the plan to its finishing callback. `readPassForScope` then applies the same transformation again in `planFrom`. The transformation copies existing additions and appends every source mismatch while retaining those mismatches, so it is not idempotent. The replan callback repeats the same double application. A single changed marketplace source consequently produces two identical replacement operations.

The apply consumer iterates both additions and supplies `replaceRecorded` for both. This repeats replacement work, including cloning/downloading a remote source, and allows a second replacement failure to turn a successfully repaired marketplace into a failed apply result. This is an observable lifecycle error, not only redundant computation.

**Evidence:** A direct temporary-directory reproduction seeded one recorded path marketplace with its old source and a configuration declaring its new source. `readPlainPlanForScope` returned one addition. `readPassForScope` returned two identical additions, each with the same scope, marketplace, new source, and config source. No repository files were changed.

**Fix:** Apply source-repair expansion exactly once on each planner path, or make the transformation idempotent by deduplicating additions by scope and marketplace. Cover the public `readPassForScope` path, including replanning, with an exact one-operation assertion. Add an apply regression asserting that a same-name remote source repair performs one replacement request and emits one outcome.

#### CR-02: BLOCKER — Both completion scenarios pass when the provider returns no completions

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p10-tests-79b511/features/step_definitions/completion.steps.ts:18-33`

**Related locations:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p10-tests-79b511/features/marketplace/market-alias.feature:62-65`; `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-p10-tests-79b511/features/plugin/list.feature:7`.

**Issue:** The alias scenario compares two captured result arrays without establishing an expected nonempty result. Two empty arrays therefore satisfy the entire scenario. The installed-git-version scenario asserts only that its result is empty. Together, these scenarios accept a provider that returns no suggestions for any input, so they cannot establish the completion behavior that this phase claims to cover. The comparison also drops insertion values and checks only labels/descriptions, leaving malformed completion insertion text undetected.

**Evidence:** An in-memory Node loader replaced only `features/lib/plugin-completions.ts` with `export async function pluginCompletions(){return [];}`. Running the two scenarios through the real Cucumber runner still exited 0: **2 scenarios passed, 18 steps passed** (seed 538874). This mutation did not edit repository files.

**Fix:** Assert an explicit, nonempty expected suggestion set for the marketplace alias and canonical command, including insertion values with the appropriate alias-prefix normalization. In the installed-version fixture, include an eligible control plugin and assert the exact result includes that plugin while excluding the mismatched git plugin. Retain an empty-provider mutation check while developing the assertions; both scenarios must reject it.

---

_Reviewed: 2026-10-28T03:45:47Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
