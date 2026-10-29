---
phase: 02-apply-ordering-and-installed-declarations
reviewed: 2026-10-29T03:00:51Z
depth: standard
files_reviewed: 44
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
  - features/plugin/state-lock.feature
  - test/orchestrators/plugin/operations.test.ts
  - test/orchestrators/plugin/update-constraint-gate.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/transaction/with-state-guard.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-29T03:00:51Z
**Depth:** standard
**Files Reviewed:** 44
**Status:** clean

## Narrative Findings (AI reviewer)

## Summary

Final merged-tree review of branch HEAD
`decf5452204d25c664e7e9a251647c8bc498edab`. No Critical, Warning, or Info
findings remain. All reviewed files meet the Phase 2 quality and correctness
requirements.

The complete 44-file Phase 2 scope was reassessed against RCN-01 through
RCN-08. The last clean Phase 2 review (`fdf127dc`) is an ancestor of the merged
HEAD. Nine files in this scope changed afterward; their complete diffs and
affected call paths were reviewed again. The remaining 35 files are
content-identical to that clean review and retain its disposition.

## Integrated regression assessment

- `pending` and `apply` derive their scope plan through the same toggle verdict,
  move settlement, missing-dependency split, and dependency-first cascade
  helpers. `movesAfterInstalls` and `stepsAfterInstalls` place moves that depend
  on a missing install after that install in both the preview and execution.
  The fresh post-move read makes a dependency required only by the moved version
  install in the same apply, and the following read enables only the records
  that were waiting for that install.
- Declaration walks use each installed record's copy when its resolved source
  is a pinned clone. `readInstalledCopyDeclaration` admits that copy only under
  its owning clone root, rejects symlink and boundary escapes, and converts an
  unreadable or malformed own manifest into the explicit unusable arm. The
  convergence planner, pending preview, and final apply judgement all preserve
  that failure rather than treating it as an empty declaration.
- Project and user state stay isolated by `locationsFor(scope, cwd)`, per-scope
  locks, and `(scope, marketplace)` keys in pending's recorded-marketplace map.
  A failure in one scope becomes its own structured row and does not redirect
  reads, installs, or writes into the other scope.
- Config-driven disable is applied before the dependency consequence-disable
  step. The verdict is recomputed after planned toggles, so dependents are held
  down in the same run and the consequence marker is not stamped onto a record
  the user already disabled.
- Marketplace add and bootstrap commit the marketplace before invoking the
  shared missing-dependency step. Autoupdate uses the same step and selects
  only declarations rooted in the updated marketplace while suppressing rows
  already reported by the update cascade. Failed installs retain the same
  narrowed reason and recovery rows as direct apply.
- Later Phase 6 changes preserve enable failure cause and rollback details on
  ordinary reconcile rows and on the single failed-move row used by a deferred
  move plus enable. Successful deferred moves carry the enable's staging
  warnings and MCP rewrite notices without duplicating the transition.
- Later Phase 7/9 update-preflight changes thread exact clone candidates into
  every git and marketplace-tag materialization path. They do not bypass the
  Phase 2 installed-copy lock or constraint fold, and cleanup remains scoped to
  the owning `ScopedLocations` bundle.
- The new behavioral scenarios assert full structured output, tally, recovery
  details, installation record, and absence/presence of the intended
  declaration. The matching unit cases assert exact text/JSON projections,
  state rollback, leaked-resource evidence, deferred pin restoration, and
  post-transition diagnostics. They are discriminating rather than
  success-only checks.

## Validation evidence

- The orchestrator supplied a fresh merged-tree `npm run check` at this HEAD:
  exit 0; Cucumber passed 1142 scenarios and 11734 steps; direct coverage
  merged 309 LCOV records.
- The Phase 2 Nyquist audit is COMPLIANT on the merged tree.
- Independently ran focused current-tree apply and notification cases for
  failed-enable recovery, deferred move/enable diagnostics, and rollback-phase
  projection with Node's test runner: both owner modules passed.
- CodeGraph call-path inspection found no alternate catalog-only declaration
  read, scope-crossing path, or reordered pending/apply cascade in the reviewed
  composition.
- Fallow's repository security advisory pass completed without an enforced
  gate failure. Its broad path-sink candidates did not establish a Phase 2
  containment bypass; the reviewed boundaries validate ownership and realpath
  containment before use.
- `git diff --check` passed. The only pre-existing dirty file during review was
  the orchestrator-owned `.planning/STATE.md`; this review changed only
  `02-REVIEW.md` and made no commit.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
