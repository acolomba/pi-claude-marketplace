---
phase: 09-plugin-package-dependencies
reviewed: 2026-10-29T05:51:18Z
depth: standard
reviewed_commit: 1ef2b0ad63b81c679f258da82f349f3225264178
source_commit: 1ef2b0ad63b81c679f258da82f349f3225264178
review_scope_complete: true
re_review: true
files_reviewed: 56
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/package-lockfile.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - extensions/pi-claude-marketplace/shared/path-safety.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - features/lib/npm-registry.ts
  - features/lib/published-marketplace.ts
  - features/plugin/package-dependencies.feature
  - features/step_definitions/npm-registry.steps.ts
  - features/step_definitions/plugin/packages.steps.ts
  - features/support/npm-registry.ts
  - features/support/world.ts
  - rule-packs/architecture.json
  - test/architecture/gate-targets.ts
  - test/architecture/no-shell-out.test.ts
  - test/domain/package-lockfile.test.ts
  - test/edge/register.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/uninstall.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/platform/package-manager.test.ts
  - test/shared/redact-absolute-paths.test.ts
  - test/shared/redact-credentials.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
gate:
  command: npm run check
  exit_code: 0
  source_commit: f81d377488a5358f2d77c09b4c2de1014650d848
  node: v26.12.1
  reused: true
  scenarios: 1143
  steps: 11742
  coverage_records: 309
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-29T05:51:18Z
**Depth:** standard, with cross-module traces of the package lifecycle
**Files Reviewed:** 56
**Status:** issues_found

## Summary

The complete prior Phase 9 scope was reviewed against the merged tree, together with the Phase 8 background-settlement guard and the Phase 10 dependency-ledger integration that now drives update settlement. The seven findings from the preceding review remain closed. The Phase 8 wrapper still calls package settlement exactly once on the live path and zero times after stop, abort, or autoupdate opt-out. The Phase 6 state-path grammar remains narrow and does not hide or leak package diagnostics.

One current blocker remains: package warnings raised while an update installs or re-enables a newly required dependency are discarded before the update outcome reaches any renderer. The fresh gate is therefore green while an untested user-visible failure path is wrong.

The evaluation-scope resolver reported `degraded` because this integrated branch has no reachable task-commit manifest. This review used the prior explicit 52-file Phase 9 scope and added the four current Phase 8/10 integration inputs named in `files_reviewed_list`.

## Narrative Findings (AI reviewer)

- **BLOCKER CR-01:** Update dependency settlement drops fresh dependency package diagnostics.

No structural pre-pass payload was supplied.

## Critical Issues

### CR-01: Update dependency settlement drops fresh dependency package diagnostics

**Files:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts:583-589`
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts:159-162`
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts:289-295`

**Issue:** `recordMaterializedMember` retains every installed dependency's discovery warnings, including `Plugin dependency install failed (...)`, but `saveInstallDependencyPlanClosure` projects only rows and MCP notices from those members. Even if a ledger seam supplies the declared `SettleCascadeRun.stagingWarnings`, both consumers discard them: `runStep` hard-codes `warnings: []` for a planned materialize step, and the first-run success arm omits `first.stagingWarnings`.

This affects the ordinary no-move path and the planned-closure path. When an update, marketplace update, or background autoupdate installs or re-enables a newly required dependency and that dependency's package install fails softly, the dependency remains installed without its packages and the user receives no warning. That violates PKD-02 and the Phase 9 exact-once warning contract.

The loss is directly reproducible without a test double outside the public contract:

```text
settleDependencies({
  firstRun: async () => ({
    kind: "installed",
    rows: [],
    stagingWarnings: [{ kind: "discovery", message: "Plugin dependency install failed (npm): E404" }]
  }),
  ...
})
// actual: { kind: "settled", rows: [] }
// expected: the same settlement with stagingWarnings preserved
```

**Fix:** Project each materialized member's `discoveryWarnings` into the closure's `stagingWarnings`, then preserve `run.stagingWarnings` in `runStep` and `first.stagingWarnings` in `settleDependencies`. Add a focused RED/GREEN case for both first-run and planned materialization, plus a user-visible update or marketplace/autoupdate regression where a newly required dependency's package install fails and its diagnostic appears exactly once on that dependency.

## Prior finding closure

All seven prior findings remain closed: timed-out process-tree escalation, disabled-revision package invalidation, locked uninstall cleanup, combined move/enable diagnostics, moved-dependency warning ownership, the exact package-runner lint seam, and incremental UTF-8 decoding.

The current focused evidence otherwise remains green: 1,042 owner/integration tests, 20 package-dependency scenarios with 281 steps, and five direct-coverage pairs at 100%. The exact merged-tree gate at `f81d3774` passed 1,143 Cucumber scenarios, 11,742 steps, and 309 LCOV records. These checks do not cover CR-01's fresh-dependency warning projection.

No source or test file was modified by this review, and no commit was made.

---

_Reviewed: 2026-10-29T05:51:18Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
