---
phase: 09-plugin-package-dependencies
reviewed: 2026-10-29T13:50:27Z
depth: standard
reviewed_commit: 7cad91d06d10aa4b2ebe4c6e91bc20db0142c87f
source_commit: 7cad91d06d10aa4b2ebe4c6e91bc20db0142c87f
review_scope_complete: true
re_review: true
files_reviewed: 60
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
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - extensions/pi-claude-marketplace/shared/path-safety.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - features/lib/npm-registry.ts
  - features/lib/published-marketplace.ts
  - features/plugin/package-dependencies.feature
  - features/plugin/update.feature
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
  - test/orchestrators/marketplace/update.messaging.test.ts
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
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
gate:
  command: npm run check
  exit_code: 0
  source_commit: 7cad91d06d10aa4b2ebe4c6e91bc20db0142c87f
  node: v26.12.1
  reused: true
  scenarios: 1145
  steps: 11777
  coverage_records: 309
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-29T13:50:27Z
**Depth:** standard, with cross-module traces of the package lifecycle
**Files Reviewed:** 60
**Status:** clean

## Summary

The complete retained 60-file Phase 9 scope was reviewed against the final integrated tree. Forty-nine files are byte-identical to the previous complete clean review; the 11 changed files were read again in full, and the later behavioral fixtures and step definitions on their current call paths were checked as supporting evidence. The final trace covered the dependency closure, first-run and planned settlement, nested and failed moves, materialization, package-runner timeout settlement, direct update, marketplace update/autoupdate, path-safe diagnostics, and both notification surfaces. All reviewed files meet the phase's correctness, security, and maintainability requirements. No issue was found.

CR-01 is closed. `saveInstallDependencyPlanClosure` projects each materialized member's warnings into an ordered `{plugin, scope, verb, warnings}` diagnostic. `settleDependencies` and `runDependencySteps` retain that identity across first-run, planned materialization, nested moves, and a move that returns a failure. `materializeLatestVersion` carries dependency diagnostics separately from the requester's own `stagingWarnings`; a refused or failed requester therefore cannot absorb a dependency's warning. Direct update and marketplace update/autoupdate prepend the dependency diagnostics to the requester's diagnostic in row order, with empty entries suppressed by the shared renderer. The public regressions now name `zcore` or `lib`, never `widget` or `app`, while retaining successful requester and dependency lifecycle rows.

The seven earlier findings remain closed: process-tree escalation after timeout, disabled-revision package invalidation, locked uninstall cleanup, combined move/enable diagnostics, moved-dependency warning ownership, exact package-runner lint-seam binding, and incremental UTF-8 decoding. The final timeout runner keeps its escalation timers referenced after a timed-out parent closes, kills surviving descendants before resolving, and leaves the package work directory alive until the run settles. Phase 6's state-path redaction now fails closed for ambiguous quoted paths while preserving structured package causes, and Phase 8's stop/abort/opt-out guard still prevents settlement after cancellation without suppressing the live settlement path.

The exact combined gate is green at reviewed commit `7cad91d0`: 1,145 Cucumber scenarios, 11,777 steps, and 309 LCOV records. The Phase 9 Nyquist audit is COMPLIANT on that same commit. The current package timeout, dependency-warning ownership, update-diagnostic ordering, and redaction regressions all participate in the combined gate.

## Narrative Findings (AI reviewer)

No BLOCKER or WARNING findings.

No structural pre-pass payload was supplied.

## Prior finding closure

All previous Phase 9 findings and the merged Phase 6/8 integration concerns are closed on the reviewed tree. The structured ownership carrier is consumed by every update path that can produce it, package notes remain exact-once, requester warnings remain separate, failed moves keep their dependency owner, and lifecycle success remains non-blocking.

No source or test file was modified by this review, and no commit was made.

---

_Reviewed: 2026-10-29T13:50:27Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
