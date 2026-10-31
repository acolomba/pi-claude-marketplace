---
phase: 02-apply-ordering-and-installed-declarations
reviewed: 2026-10-29T12:30:32Z
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

**Reviewed:** 2026-10-29T12:30:32Z
**Depth:** standard
**Files Reviewed:** 44
**Status:** clean

## Narrative Findings (AI reviewer)

## Summary

Final integrated stale-verification review of branch HEAD
`91b3fdd8e9bad705e14495fa14481ab548f15491`. No Critical, Warning, or Info
findings remain. All reviewed files meet the Phase 2 quality and correctness
requirements.

The complete retained 44-file Phase 2 scope was reassessed against RCN-01
through RCN-08. The previous complete clean review at `decf5452` is an
ancestor of this HEAD. Forty files are byte-identical to that clean baseline.
The four later-changed files -- `orchestrators/types.ts`, `apply.feature`,
`import.feature`, and `apply.test.ts` -- were re-read with their complete diffs
and affected call paths. Their changes add dependency-warning ownership typing,
fail-closed redaction expectations, and an import redaction scenario; none
changes Phase 2 ordering, declaration-source, containment, or scope semantics.

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
- The behavioral scenarios assert full structured output, tally, recovery
  details, installation records, and the intended declaration presence or
  absence. The matching unit cases assert exact text/JSON projections, state
  rollback, leaked-resource evidence, deferred pin restoration, and
  post-transition diagnostics. The later fail-closed diagnostic expectations
  remain exact byte assertions rather than success-only checks.

## Validation evidence

- The fresh Phase 2 Nyquist audit is COMPLIANT 8/8. Its current-tree public
  selection passed 10 scenarios and 159 steps; its 14-module owner selection
  passed 1,387/1,387 tests.
- The exact integrated `npm run check` remains reusable at this HEAD because
  there is no executable-input diff from `be0de0c3`: exit 0; Cucumber passed
  1,145 scenarios and 11,777 steps; direct coverage merged 309 LCOV records.
- Current CodeGraph and direct-source inspection found no alternate
  catalog-only installed-declaration read, scope-crossing path, or reordered
  pending/apply cascade. The update constraint gate still uses the installed
  copy under the scope lock, while reconcile convergence intentionally keeps
  its catalog-first contract.
- Fallow's security advisory pass completed without an enforced gate failure.
  Its broad repository path-sink candidates do not establish a Phase 2
  containment bypass; the Phase 2 readers admit the owning root before opening
  a bounded manifest candidate.
- The evaluation-scope resolver reported `degraded` because the original Phase
  2 task commits are unreachable after branch convergence. This review therefore
  retained the explicit 44-file scope from the prior complete clean review and
  reconciled every later change to that scope; it did not substitute the
  resolver's milestone-wide fallback.
- `git diff --check` passed. The only pre-existing dirty file during review was
  the orchestrator-owned `.planning/STATE.md`; this review changed only
  `02-REVIEW.md` and made no commit.

---

_Reviewer: Codex (gsd-code-reviewer)_
_Depth: standard_
