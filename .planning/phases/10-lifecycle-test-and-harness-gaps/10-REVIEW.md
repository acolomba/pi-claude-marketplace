---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-28T06:58:36Z
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
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-28T06:58:36Z
**Depth:** standard
**Files Reviewed:** 100 (the retained 89-file Phase 10 scope plus 11 new post-split files)
**Status:** issues_found
**Observed HEAD:** `41ad4a3c`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

The prior exact fix-branch `fallow audit` passed. A repeat audit on the merged worktree could not create its temporary worktree because of the review sandbox, so that result was not treated as fresh structural evidence. `fallow guard` accepted the root, planning, ledger, test-support, and architecture-inventory files. `fallow security` returned broad inherited path-sink candidates but did not establish a new containment, redaction, child-process, or network-boundary defect. `fallow trace` confirmed that the planning-to-ledger dependency is type-only and therefore does not create a runtime cycle.

CodeGraph was attempted first as required, but its local database could not be opened. Current sources, import paths, and consumers were therefore traced with Fallow, Git diffs, repository search, and direct source review.

## Narrative Findings (AI reviewer)

### Summary

The review-fix commits close WR-01 and WR-03. The ordinary install-owner fixture now calls the public composition-root factories, and a public-root behavioral case proves planning reaches ledger persistence. The large-file exclusions are exact, end-anchored paths. The two-line prune cleanup removes only redundant assertions and preserves the `Error` type. No CAS-08/XPH-02 runtime semantic regression was found.

One ownership defect remains. The replacement ledger port is still a catch-all wrapper around the same 15 ledger-private helpers, so WR-02 is only partially fixed. The merged tree's build inputs are byte-identical to the fix branch that passed `npm run check`: 1120 scenarios, 11411 steps, and 306 direct-LCOV pairs.

## Warnings

### WR-02: The replacement ledger port is still a 15-method catch-all

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts:3305-3320`
**Issue:** `InstallPlanningLedgerPorts` exposes all 15 former cross-leaf helpers in one provider-owned object. `createInstallPlanningLedgerPorts()` then returns those helpers one-for-one (`install-flow-ledger.ts:3324-3341`), and planning imports that ledger-owned contract (`install-flow-planning.ts:59-69`). The root now performs the value composition and the runtime graph is acyclic, but the contract is not narrow: planning still depends on ledger construction, failure projection, hook hydration, config mutation, marketplace settlement, and outcome-shaping internals as a single catch-all dependency. A ledger refactor therefore continues to ripple into planning instead of being absorbed by a cohesive boundary. The split also exports `InstallPlanningComposition` only so its test can type a public resolver (`install-flow-planning.ts:668-680`; `test/orchestrators/plugin/install-flow-planning.test.ts:44-49`), contrary to the repository test rule against test-only production exports.
**Fix:** Declare consumer-owned, purpose-specific planning ports and have the root adapt ledger behavior to them. Prefer a few cohesive higher-level operations over forwarding the 15 private helpers unchanged. Keep `InstallPlanningComposition` private (or infer the factory return type) and exercise the public resolver without adding a production export solely for the test.

### Verification record

- CodeGraph query attempted first; local database open failed.
- `fallow review` and fix-commit diffs: reviewed the split and all four fix commits.
- `fallow guard` on split sources/tests: no policy violation.
- `fallow security --format json --quiet`: no proven new security defect.
- `fallow trace --path install-flow-planning.ts install-flow-ledger.ts`: one type-only hop; no runtime cycle.
- `fallow dead-code --type-aware --symbol-impact`: `InstallPlanningLedgerPorts` has one direct type consumer (planning), its factory has one direct value consumer (the root), and `InstallPlanningComposition` has only a test consumer.
- Focused Node tests for the root, planning, and prune modules: passed.
- Fix-branch `npm run check`: green, 1120 scenarios, 11411 steps, 306 direct-LCOV pairs. `git diff` confirmed that merged build inputs are unchanged.
- WR-01: closed by public-root fixture routing and behavioral root proof.
- WR-03: closed by exact end anchors on both large-file exceptions.
- Prune cleanup: correct; only redundant double assertions were removed.

Only this report was changed. No implementation or test source was modified, and no commit was created.

---

_Reviewed: 2026-10-28T06:58:36Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
