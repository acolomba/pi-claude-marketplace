---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-28T05:54:32Z
depth: standard
files_reviewed: 100
files_reviewed_list:
  - .pre-commit-config.yaml
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
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
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
  - test/architecture/gate-targets.ts
  - test/architecture/hooks-lifecycle.test.ts
  - test/architecture/https-git-host-server.test.ts
  - test/architecture/no-test-only-production-surface.test.ts
  - test/architecture/partial-vocabulary-guard.test.ts
  - test/architecture/workflows-marker-coverage.test.ts
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
  - test/orchestrators/plugin/install-flow-fixture.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
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
  critical: 0
  warning: 3
  info: 0
  total: 3
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-28T05:54:32Z
**Depth:** standard
**Files Reviewed:** 100 (the retained 89-file Phase 10 scope plus 11 new post-split files)
**Status:** issues_found
**Observed HEAD:** `76c1dd77`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

`fallow audit --base b6959f52 --format json --quiet` passed for the integrated post-split tree: 18 changed files, no dead-code findings, no introduced complexity findings, no duplicate groups, no circular dependencies, and no architecture-policy violations. `fallow guard` accepted the root, planning, ledger, test-support, and architecture-inventory files. `fallow security` returned broad inherited path-sink candidates but did not establish a new containment, redaction, child-process, or network-boundary defect.

CodeGraph was attempted first as required, but its local database could not be opened. Current sources, import paths, and consumers were therefore traced with Fallow, Git diffs, repository search, and direct source review.

## Narrative Findings (AI reviewer)

### Summary

The post-11-06 stale-verification review found no proven CAS-08/XPH-02 runtime semantic regression. The moved code preserves rollback/outcome ordering, deferred-pin composition, ledger/package phase order, containment checks, path redaction, and the public factory/type names. The prior Phase 10 blockers remain resolved. However, the split introduces three quality defects that weaken the promised ownership boundary and its regression protection.

The parent supplied exact-tree evidence that `npm run check` is green at `76c1dd77`: 1120 scenarios, 11411 steps, 306 direct-LCOV pairs, and 328/328 install-owner tests. Those results establish current behavior, but they do not close the test-routing and hook-policy defects below.

## Warnings

### WR-01: Behavioral owner tests bypass the public composition root

**File:** `test/orchestrators/plugin/install-flow-fixture.ts:18-88`
**Issue:** The shared fixture imports the ledger and planning leaves directly, then reimplements the production root's `INSTALL_PLANNING` binding and both install factories. Nearly all install behavior cases run through this test-only copy. The actual public-root pair only verifies that each returned value has type `"function"` (`test/orchestrators/plugin/install-flow.test.ts:22-65`). A production wiring error in `install-flow.ts`—for example dropping the explicit environment, binding the wrong planning implementation, or changing a factory argument—can therefore leave the 328 owner cases green. This also violates the split plan's requirement to retain end-to-end owner cases in the public-root test.
**Fix:** Make the owner fixture import `createInstallPlugin` and `createInstallMissingDependency` from `install-flow.ts`. Keep only genuinely leaf-focused unit cases on the leaf factories. Add at least one public-root behavioral assertion that proves the explicit environment and planning-to-ledger handoff are observed, rather than only checking `typeof`.

### WR-02: The planning leaf is coupled to 15 exported ledger internals

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts:39-55`
**Issue:** The planning module imports 15 runtime helpers from the ledger module, which exposes them in a bulk export block at `install-flow-ledger.ts:3306-3322`. The root injects planning callbacks into the ledger, but planning simultaneously reaches back into the ledger's private implementation surface. The graph is technically acyclic, yet the leaves are not independent owners and the split expanded a large internal export surface. Changes to ledger construction, failure projection, hook hydration, or config-entry writing can now break planning through undocumented cross-leaf contracts that the public root does not type or compose.
**Fix:** Move genuinely shared operations into a cohesive sibling module with narrow named contracts, or expose a small typed ledger-ports factory that the public root passes to a planning factory. Remove the bulk helper export once the root owns the complete leaf composition.

### WR-03: The “exact-path” large-file exception also matches path prefixes

**File:** `.pre-commit-config.yaml:25`
**Issue:** The new `check-added-large-files` exclusion is start-anchored but not end-anchored. It excludes not only the two stated files, but any path beginning with either name, such as `install-flow-ledger.ts.bak` or `install-flow-ledger.test.ts.old`. That is broader than the summary's exact-file security claim and creates an avoidable bypass for oversized newly added files.
**Fix:** Keep the directory exception separate and end-anchor the exact-file alternatives, for example:

```yaml
exclude: ^\.planning/|^(package-lock\.json|test/e2e/pi-peer-floor/package-lock\.json|extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger\.ts|test/orchestrators/plugin/install-flow-ledger\.test\.ts)$
```

### Verification record

- CodeGraph query attempted first; local database open failed.
- `fallow review --base b6959f52 --brief`: completed for the split.
- `fallow guard` on split sources/tests: no policy violation.
- `fallow security --format json --quiet`: no proven new security defect.
- `fallow audit --base b6959f52 --format json --quiet`: pass, no structural findings.
- Original monolithic owner suite: 274 direct `test(` declarations and 1280 assertions. Split owner suites: 275 direct `test(` declarations and 1287 assertions. No coarse assertion-count loss was found.
- Parent-supplied exact-tree gate: `npm run check` green, 1120 scenarios, 11411 steps, 306 direct-LCOV pairs; install owner 328/328.

Only this report was changed. No implementation or test source was modified, and no commit was created.

---

_Reviewed: 2026-10-28T05:54:32Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
