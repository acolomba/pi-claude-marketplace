---
phase: 29-load-converges-on-the-catalog
plan: 12
subsystem: reconcile
tags: [apply, convergence, update-runner, constraint-gate, git-source, clone-cache, output-catalog, cucumber]

requires:
  - phase: 29-load-converges-on-the-catalog
    provides: "29-11: planConvergence previews git-source and growth moves offline"
  - phase: 29-load-converges-on-the-catalog
    provides: "29-10: ConvergencePlan { moves, holds, declines }, constraint-fold.ts, the pending hold and decline rows"
provides:
  - "MaterializationPolicy.searchReleaseTags; update and reinstall keep the tag search, the converge policy lists no tag (D-23)"
  - "evaluateCatalogConstraint in constraint-fold.ts: the declaration walk plus the fold, no tag search; preparePluginUpdate selects it when searchReleaseTags is false"
  - "PluginConvergeTarget / PluginConvergeFn and PluginUpdateOperations.convergePlugin: the update runner under CONVERGE_MATERIALIZATION, cascade mode, explicit cwd (D-26)"
  - "createConvergeOperation in operations.ts"
  - "apply's convergeScope after applyPlan: runs each revision move, reports (updated), (failed), and the hold and decline rows pending lists (APL-02, D-08, D-12, D-13)"
  - "PerEntryOutcome kind plugin-converged; ReconcileAppliedStatus gains updated, skipped, partially-upgradable"
  - "four reconcile-applied catalog states: apply-updated, apply-update-held, apply-update-partial-consent, apply-update-failed"
affects: [29-13, 29-14, apply, update, reinstall, marketplace-autoupdate]

actuals:
  tokens: 37290
  tasks: 3
  commits: 3
plan_head_before: e60e2aff39221fe3ba11ce0142ba09bf6d08ec09
plan_head_after: c35ab4ca8723cdf792c268ed1fbc786c08278a15

tech-stack:
  added: []
  patterns:
    - "A fourth policy knob selects the constraint gate, so the shared runner serves update, reinstall and apply with one code path"
    - "The convergence rows are composed in notify.ts by private builders that pending's projection and apply's outcomes both call, so the blocked rows have one source of bytes"
    - "The applied-outcome router is a total-map lookup instead of a switch, keeping exhaustiveness through the plugin applier's Extract parameter"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/constraint-fold.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
    - features/plugin/apply.feature
    - features/plugin/git-source-update.feature
    - docs/output-catalog.md
    - test/architecture/catalog-uat/fixtures/reconcile-applied.ts

key-decisions:
  - "apply reads the scope's state for convergence through the same selected-state reader as the read pass, and a read that throws moves nothing and adds no row: the apply steps already report a corrupt state, and the next apply's read pass stops on it"
  - "A move's (failed) row names the planner's attempted move (revisionVersionSlot(move)) and the runner's closed-set reason, never the error text"
  - "The cascade failure classifier reads the errno a BridgeStagingError carries on its cause, so an unreadable source is permission denied instead of the permissive not-in-manifest fallback; this also corrects the autoupdate cascade's row"
  - "evaluateUpdateConstraint reuses evaluateCatalogConstraint for its walk and fold, so the two gates share one implementation and fallow sees no clone"
  - "A runner skip the planner did not foresee renders the planner's blocked rows: a decline when partialUpgradable, otherwise update's skipped row with its reasons and constraint cause"

patterns-established:
  - "Catalog moves run through PluginUpdateOperations.convergePlugin, never reinstall (D-26)"

requirements-completed: [APL-02, APL-01]

coverage:
  - id: D1
    description: "The tag-free gate and the searchReleaseTags knob: update keeps the tag search, the converge policy judges the catalog version"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-preflight.test.ts#D-23: a policy that lists no tag judges the range against the catalog version"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/constraint-fold.test.ts#evaluateCatalogConstraint"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/reinstall-flow.test.ts#D-23: reinstall lets a dependent's range search release tags and names the current-copy fallback"
        status: pass
    human_judgment: false
  - id: D2
    description: "convergePlugin: the update runner with the converge policy, explicit cwd, partial, kept user-edited agents, failed outcomes, GHB-03 rethrow"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-26: convergePlugin moves a path-source plugin to the catalog version in the target's cwd"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#D-26 / T-29-29: convergePlugin keeps an agent file a user edited and fails the move"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/operations.test.ts#D-26: convergePlugin moves the plugin to the catalog version in place and re-routes it"
        status: pass
    human_judgment: false
  - id: D3
    description: "apply converges on the catalog: (updated) with the reload trailer, held and declined moves kept with warning rows and no write, a failed move beside a moved one"
    requirement: APL-02
    verification:
      - kind: unit
        ref: "test/orchestrators/reconcile/apply.test.ts#applyReconcile catalog convergence"
        status: pass
      - kind: unit
        ref: "test/orchestrators/reconcile/notify.test.ts#convergedMoveOutcomes"
        status: pass
    human_judgment: false
  - id: D4
    description: "The roadmap scenarios: path and git moves after marketplace update, blocked moves kept and still pending, a cold pinned clone with its request log"
    requirement: APL-02
    verification:
      - kind: e2e
        ref: "features/plugin/apply.feature#Apply moves a path-source and a git-source plugin to the versions a marketplace update brought"
        status: pass
      - kind: e2e
        ref: "features/plugin/apply.feature#Apply keeps a range-blocked and a consent-needing move in place with warning rows, and pending still lists them"
        status: pass
      - kind: e2e
        ref: "features/plugin/git-source-update.feature#Apply clones the new pinned commit of a git-source plugin it has not cached"
        status: pass
    human_judgment: false
  - id: D5
    description: "The catalog documents apply's move, hold, decline and failure rows byte for byte"
    requirement: APL-01
    verification:
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
      - kind: unit
        ref: "test/architecture/catalog-uat/catalog-wire.test.ts"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-10-24
status: complete
---

# Phase 29 Plan 12: Apply Converges on the Catalog Summary

**`apply` now moves installed plugins to the catalog version through the shared update runner (never reinstall), with a tag-free constraint gate, and reports `(updated)`, `(failed)` and the same hold and decline rows `pending` lists.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-10-24T20:53:33Z
- **Completed:** 2026-10-24T22:04:23Z
- **Tasks:** 3
- **Files modified:** 34

## Accomplishments

- `MaterializationPolicy.searchReleaseTags`: update and reinstall search tags as before; the converge policy (`refreshSource: false, skipSameRevision: true, overwrite: false, searchReleaseTags: false`) judges a dependent's range against the catalog version through the new `evaluateCatalogConstraint` (D-23).
- `PluginUpdateOperations.convergePlugin` runs the update runner in cascade mode (stored credentials, no Device Flow) with the target's own `cwd` and `partial`; `createConvergeOperation` binds it for `apply` (D-26). Both cascade entries share one catch.
- `apply` plans each scope's moves after its plan, runs every revision move in order, and reports the results; planner holds and declines get the pending rows and no runner call (D-08, D-12, D-13). A cold git target is cloned on the cache miss (D-11).
- Four new catalog states and three scenarios for APL-02, plus the Task 1 path-source scenario.

## Task Commits

1. **Task 1: End-to-end -- apply moves one path-source plugin to the catalog version** - `a004c239` (feat)
2. **Task 2: The roadmap scenarios -- path and git moves, blocked moves, a cold clone** - `8b7c8ef7` (test)
3. **Task 3: The catalog's apply move, hold and decline states** - `c35ab4ca` (docs)

## Files Created/Modified

- `orchestrators/plugin/update-preflight.ts` - the fourth knob; `selectConstraintGate`
- `orchestrators/plugin/constraint-fold.ts` - `evaluateCatalogConstraint`
- `orchestrators/plugin/update-constraint-gate.ts` - reuses the catalog gate for its walk and fold
- `orchestrators/plugin/update-flow.ts` - `CONVERGE_MATERIALIZATION`, `convergePlugin`, `runCascadeTarget`, `cascadeErrno`
- `orchestrators/plugin/reinstall-flow.ts` - reinstall keeps the tag search
- `orchestrators/plugin/operations.ts` - `createConvergeOperation`
- `orchestrators/types.ts` - `PluginConvergeTarget`, `PluginConvergeFn`
- `orchestrators/reconcile/apply.ts` - `convergeScope` after `applyPlan`
- `orchestrators/reconcile/apply-outcomes.ts` - `PluginConvergedOutcome`
- `orchestrators/reconcile/notify.ts` - shared hold/decline builders, `blockedMoveOutcomes`, `convergedMoveOutcomes`, the lookup router
- `orchestrators/reconcile/reconcile.messaging.ts` - three applied statuses and their row policies
- `features/plugin/apply.feature`, `features/plugin/git-source-update.feature` - four scenarios
- `docs/output-catalog.md`, `test/architecture/catalog-uat/fixtures/reconcile-applied.ts` - four states

## Decisions Made

See `key-decisions` in the frontmatter. In short: the convergence read uses the selected-state reader and skips silently on a throw; a failed move shows the planner's move and the closed-set reason; a staging failure's errno is read from its cause; the update gate reuses the catalog gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test policy literals outside the plan's file list needed the new knob**
- **Found during:** Task 1
- **Issue:** `searchReleaseTags` is required, so `MaterializationPolicy` literals in update-swap, materialize-latest, update-cascade and marketplace/update.messaging tests no longer compiled.
- **Fix:** Added `searchReleaseTags: true` to each (update and reinstall keep the tag search).
- **Files modified:** test/orchestrators/plugin/{update-swap,materialize-latest,update-cascade}.test.ts, test/orchestrators/marketplace/update.messaging.test.ts
- **Committed in:** a004c239

**2. [Rule 3 - Blocking] update-constraint-gate.ts reuses the catalog gate**
- **Found during:** Task 1
- **Issue:** `evaluateCatalogConstraint` repeats the update gate's walk and fold, a clone group for fallow.
- **Fix:** `evaluateUpdateConstraint` calls `evaluateCatalogConstraint({ ...options, seam })`, then searches tags; behavior unchanged (its owner suite passes).
- **Committed in:** a004c239

**3. [Rule 1 - Bug] An unreadable source read `not in manifest`**
- **Found during:** Task 1 (apply's failed-move test)
- **Issue:** The commands bridge wraps EACCES in `BridgeStagingError`, and the cascade classifier read only the top-level errno, falling back to `{not in manifest}`.
- **Fix:** `cascadeErrno` reads a `BridgeStagingError`'s cause. This also corrects the autoupdate cascade's row for the same failure.
- **Committed in:** a004c239

**4. [Rule 3 - Blocking] fallow cyclomatic limit on applyOutcomeToBlock**
- **Found during:** Task 1
- **Issue:** The 20th outcome kind made the router switch cyclomatic 21.
- **Fix:** A type-guarded lookup over a total `MARKETPLACE_SUBJECT` record; the plugin applier's `Extract` parameter keeps a new kind a compile error.
- **Committed in:** a004c239

**5. [Rule 1 - Bug] The cold-cache AMIG-01 integration test reached the real network**
- **Found during:** Task 1 (integration run)
- **Issue:** Its fixture pinned the catalog to a commit other than the recorded one, which is now a catalog move that `apply` clones, from `example.test`.
- **Fix:** The fixture pins the catalog to the recorded commit; the reconcile owner suite still proves the MCP move reads the recorded clone, never the manifest pin.
- **Files modified:** test/integration/mcp-migration.test.ts
- **Committed in:** a004c239

**6. [Rule 3 - Blocking] Pins outside the plan's file list**
- **Found during:** Tasks 1 and 3
- **Issue:** `test/architecture/soft-dep-marker-policy.test.ts` pins RECONCILE_APPLIED_CONTEXT; catalog-parser and catalog-wire pin the state counts; apply.test's RECON-02 case pins the reader calls, which doubled because convergence reads each scope again.
- **Fix:** Updated each pin.
- **Committed in:** a004c239, c35ab4ca

---

**Total deviations:** 6 auto-fixed (2 bugs, 4 blocking). **Impact:** all needed for correctness or the gates; no scope added beyond the plan's behavior.

## Issues Encountered

None beyond the deviations above.

## Verification

- Task verifies: owner suites, direct coverage (100%) for every touched source pair, `npm run lint`, `npm run fallow`, `npm run check:features`, `npm run test:cucumber` (789 scenarios), catalog contract/wire/parser tests.
- `npm run check` at c35ab4ca: **exit 0**. Tail:

```text
16 hooks (16 passed)
789 scenarios (789 passed)
7614 steps (7614 passed)
Merged LCOV: coverage/direct.lcov (286 records)
```

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. (T-29-28: cascade mode builds stored credentials only; T-29-29: overwrite off, the user-edited agent test; T-29-32: failed rows carry only the closed-set reason.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 29-13: growth-only moves are skipped by `convergeScope` (`!move.revisionChanged`) and still promoted by the backfill; 29-13 runs them through `convergePlugin` with `rematerialize` and adds `{components now supported}` to a grown revision move's `(updated)` row.

## Self-Check: PASSED

---
*Phase: 29-load-converges-on-the-catalog*
*Completed: 2026-10-24*
