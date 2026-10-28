---
phase: 10-lifecycle-test-and-harness-gaps
reviewed: 2026-10-28T08:05:02Z
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
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 10: Code Review Report

**Reviewed:** 2026-10-28T08:05:02Z
**Depth:** standard
**Files Reviewed:** 100 (the retained 89-file Phase 10 scope plus 11 new post-split files)
**Status:** clean
**Observed HEAD:** `67804335`
**Runtime:** Node `v26.12.1`

## Structural Findings (fallow)

`fallow review --base 09f7f113 --brief` passed with no dead-code, complexity, or duplication findings. `fallow guard` accepted the root, planning, ledger, and owner-test files. `fallow trace` found one planning-to-ledger type-only hop and no reverse path, so the split has no runtime cycle. `fallow security` surfaced four reachability-based path candidates in unchanged containment-aware callees; direct review found that the path-source read calls `assertPathInside`, manifest candidates are fixed literals and read through a bounded manifest boundary, and hook paths come from resolver-produced installable metadata. No new vulnerability was established.

CodeGraph was attempted first as required, but its local database could not be opened. Current sources, import paths, and consumers were therefore traced with Fallow, Git diffs, repository search, and direct source review.

## Narrative Findings (AI reviewer)

### Summary

The final WR-02 refactor closes the remaining ownership defect. Planning privately owns a five-operation contract: prepare the plan, preview the root, run a cascade, project a caught failure, and project failed moves. The public root explicitly adapts five ledger operations into that contract. The ledger operations now contain the prior catalog, transaction, save, hook/config, marketplace-settlement, cascade-unwrapping, and failure-projection helpers instead of forwarding those helpers across the leaf boundary.

`InstallPlanningComposition` is private. Its test infers the factory return type; the factory itself is a real production composition seam used by the public root, so there is no test-only production export. The owner tests cover initial settlement, planned materialization, refusal, missing-marketplace propagation, failure projection, move-failure projection, preview pins, and public-root persistence. No behavior regression was found.

Previously closed findings remain closed. WR-01 still routes the fixture and the behavioral proof through public composition-root factories. WR-03 still uses exact, end-anchored large-file exceptions. The prune change still removes only redundant assertions while preserving the `Error`-typed values.

All reviewed files meet quality standards. No issues found.

### Verification record

- CodeGraph was attempted first; its local database could not be opened.
- `fallow review --base 09f7f113 --brief --format json`: passed; zero dead-code issues, complexity findings, and duplication clone groups.
- `fallow guard` on the root, planning, ledger, and owner tests: passed.
- `fallow security --changed-since 09f7f113`: reviewed all four candidates; no proven vulnerability.
- Bidirectional `fallow trace --path`: planning reaches ledger through one type-only hop; ledger has no path back to planning.
- Focused Node suites for the root, planning, ledger, and prune modules: passed.
- `test/architecture/no-test-only-production-surface.test.ts`: passed.
- Exact build inputs passed the full fix-branch `npm run check`: 1120 scenarios, 11411 steps, and 306 direct-LCOV pairs. The merged build inputs are unchanged.

Only this report was changed. No implementation or test source was modified, and no commit was created.

---

_Reviewed: 2026-10-28T08:05:02Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
