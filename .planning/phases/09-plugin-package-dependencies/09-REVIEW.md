---
phase: 09-plugin-package-dependencies
reviewed: 2026-10-29T06:12:03Z
depth: standard
reviewed_commit: 9b63fb96c21a32a785bb28b2a08b155246f1c4d9
source_commit: 9b63fb96c21a32a785bb28b2a08b155246f1c4d9
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
  source_commit: 9b63fb96c21a32a785bb28b2a08b155246f1c4d9
  node: v26.12.1
  reused: false
  scenarios: 1144
  steps: 11758
  coverage_records: 309
---

# Phase 9: Code Review Report

**Reviewed:** 2026-10-29T06:12:03Z
**Depth:** standard, with cross-module traces of the package lifecycle
**Files Reviewed:** 56
**Status:** issues_found

## Summary

The complete 56-file Phase 9 scope was reviewed against the merged tree, including the Phase 6 redaction integration, the Phase 8 background-settlement guard, and the Phase 10 dependency-ledger integration. Fifty-one files are byte-identical to the prior complete review; all five files changed by `16e4c849` were read in full and their call paths were traced through settlement, materialization, update composition, and rendering. The seven findings from the preceding review remain closed. The Phase 8 wrapper still calls package settlement exactly once on the live path and zero times after stop, abort, or autoupdate opt-out. The Phase 6 state-path grammar remains narrow and does not hide or leak package diagnostics.

The transport half of the latest CR-01 fix works: first-run and planned materialization warnings survive settlement, preserve order, render once, and do not fail the requester or dependency lifecycle. One user-visible ownership blocker remains. The implementation flattens every newly materialized member's warning into the requesting plugin's warning array, so a package failure produced by dependency `zcore` is rendered under `Plugin "widget" ... updated`. That contradicts D-PL10-16's per-member diagnostic contract and the preceding review's explicit requirement that the note appear on the dependency that produced it.

The evaluation-scope resolver reported `degraded` because this integrated branch has no reachable task-commit manifest. This review used the prior explicit 52-file Phase 9 scope and added the four current Phase 8/10 integration inputs named in `files_reviewed_list`.

## Narrative Findings (AI reviewer)

- **BLOCKER CR-01:** Fresh dependency package diagnostics are attributed to the requester instead of the dependency.

No structural pre-pass payload was supplied.

## Critical Issues

### CR-01: Fresh dependency package diagnostics are attributed to the requester instead of the dependency

**Files:**

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts:583-589`
- `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts:170-175`
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:566-575`
- `features/plugin/package-dependencies.feature:471-483`

**Issue:** `saveInstallDependencyPlanClosure` uses `flatMap` to turn all member warnings into one unowned `stagingWarnings` array. `dependency-settle.ts` correctly preserves that array through both the first-run and planned-materialization paths, but `settleWarningsFirst` then prepends it to the requesting update's own warnings. `updateStagingDiagnostic` can name only `outcome.name`, so it renders every dependency warning under the requester.

The new behavioral scenario demonstrates the defect rather than preventing it. `zcore` owns the failing package install and has the dependency row at line 483, but line 479 expects `Plugin "widget" [project] updated`. This differs from the established D-PL10-16 behavior in `features/plugin/install.feature`, where a cascade member's package note is rendered under that member's own diagnostic. It also contradicts the preceding CR-01 remediation text, which required the diagnostic to appear exactly once on the dependency.

The warning is no longer lost and is not duplicated. The requester still updates successfully, `zcore` remains installed successfully without its packages, and the registry interaction is correct. The blocker is ownership: direct update, marketplace update/autoupdate, and any other consumer of this settlement cannot tell which newly installed dependency produced each warning after the flattening boundary.

**Fix:** Preserve member identity with each settlement diagnostic instead of flattening member warnings into the requester's `stagingWarnings`. Carry ordered per-member diagnostics (plugin, scope, verb, warnings) alongside the dependency rows through `SettleCascadeRun` and `UpdateDependencySettlement`; render those diagnostics after the corresponding cascade rows; keep the requester's own warnings in its existing outcome array. Change the behavioral regression to expect `Plugin "zcore" [project] installed; ...` exactly once, while retaining the complete `widget` and `zcore` success rows, registry request, records, and no-package assertion.

## Prior finding closure

All seven prior findings remain closed: timed-out process-tree escalation, disabled-revision package invalidation, locked uninstall cleanup, combined move/enable diagnostics, moved-dependency warning ownership, the exact package-runner lint seam, and incremental UTF-8 decoding.

The current focused evidence is green: 27 dependency-settlement tests, 14 install-ledger tests, both changed direct-coverage pairs at 100%, and the exact new Cucumber scenario at 1 scenario / 16 steps. The exact merged-tree gate at `9b63fb96` passed 1,144 Cucumber scenarios, 11,758 steps, and 309 LCOV records. These checks prove warning transport and lifecycle success, but the behavioral scenario currently encodes the incorrect owner.

No source or test file was modified by this review, and no commit was made.

---

_Reviewed: 2026-10-29T06:12:03Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
