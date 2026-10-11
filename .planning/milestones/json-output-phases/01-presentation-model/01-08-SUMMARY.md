---
phase: 01-presentation-model
plan: 08
subsystem: notify
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, import, marketplace-remove, marketplace-update, reconcile]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun, SubcommandHandler (args, ctx, run), and the run seeds; 01-07 ApplyReconcileOptions.run beside the transitional pi"
provides:
  - "ImportClaudeSettingsOptions.run: the import cascade renders from the command run; pi stays only as the inventory forwarded to the nested install and marketplace add"
  - "makeImportHandler returns SubcommandHandler and puts the router's run into the import options"
  - "resolveScopeOrNotifyNotAdded over { ctx, run, name, scope? }"
  - "RemoveMarketplaceOptions, UpdateMarketplaceOptions, UpdateAllMarketplacesOptions, and update.ts's RefreshOneArgs carry run in place of pi"
  - "makeRemoveHandler(deps) and makeMarketplaceUpdateHandler(deps) take no pi"
  - "reconcile hands its load-pass run to the nested removeMarketplace (the first D-07 nested hand-off)"
affects: [01-09 and 01-10 move install and marketplace add onto the run and delete ImportClaudeSettingsOptions.pi, 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 37462
  tasks: 2
  commits: 2
plan_head_before: cfed45e35adebf6bf66be1ce5fb15ddf5be5de1e
plan_head_after: de1b52038b2e6dcbfcf1e1a33e8fd8d25a1bd7a2

tech-stack:
  added: []
  patterns:
    - "A composer that still forwards the inventory to unmigrated callees keeps pi beside run, documented as the forward only"
    - "A handler factory that no longer forwards pi drops the parameter and returns SubcommandHandler"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/edge/handlers/plugin/import.test.ts
    - tests/architecture/workflows-marker-coverage.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/orchestrators/marketplace/remove.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/edge/handlers/marketplace/remove.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/edge/register.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/architecture/config-state-consistency.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "The marketplace remove/update orchestrator suites and shared.test.ts drop the strict pi mock entirely: their boundary returns a run seed and has no tool inventory to probe"
  - "cross-op-convergence's Invoker env carries both pi and run; remove and update read run, the other ops still read pi until they migrate"
  - "workflows-marker-coverage's import drive passes runWithSoftDeps with workflowEngineLoaded equal to the case's engine flag, matching what the decoy/engine tool inventory would probe"

patterns-established:
  - "Nested orchestrated install and add calls never probe, so an import case's strict pi states no getAllTools() expectation"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "The import cascade renders from the command run; every import owner case states zero tool probes, and the registered and handler paths forward the router's run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/import.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts#shares the supplied lifecycle routing owner with registered import execution"
        status: pass
      - kind: unit
        ref: "tests/architecture/workflows-marker-coverage.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "marketplace remove and marketplace update, including resolveScopeOrNotifyNotAdded's not-added emissions, render from the command run; their handlers take no pi and state zero tool probes"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/remove.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/remove.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/update.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-op-convergence.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reconcile hands its load-pass run to the nested removeMarketplace"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false
  - id: D4
    description: "Emitted bytes are unchanged: the wire corpus and the output catalog match, and npm run check passes"
    requirement: PMOD-01
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check"
        status: pass
      - kind: other
        ref: "git diff --exit-code 2f173031 -- docs/output-catalog.md"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 51min
completed: 2026-09-30
status: complete
---

# Phase 1 Plan 08: Import and Marketplace Remove/Update Notification Run Summary

**The import cascade, `marketplace remove`, and `marketplace update` render from the command's notification run, and reconcile shares its load-pass run with the nested remove.**

## Performance

- **Duration:** 51 min
- **Started:** 2026-09-29T23:09:43Z
- **Completed:** 2026-09-30T00:00:19Z
- **Tasks:** 2
- **Files modified:** 22

## Accomplishments

- `ImportClaudeSettingsOptions` carries `readonly run: NotificationRun`. Import's cascade emission is `notifyWithContext(opts.ctx, opts.run, IMPORT_CONTEXT, ...)`. `pi` stays, documented as the inventory forwarded to the nested install and marketplace-add orchestrators.
- `makeImportHandler(pi, deps, hooksRouting)` returns a `SubcommandHandler` and puts the router's `run` into the options.
- `resolveScopeOrNotifyNotAdded` takes `{ ctx, run, name, scope? }`. Both not-added emissions read `opts.run`.
- `RemoveMarketplaceOptions`, `UpdateMarketplaceOptions`, `UpdateAllMarketplacesOptions`, and `RefreshOneArgs` replace `pi` with `run`. Every emission and internal forward uses the run. The update.ts header and option doc say the markers come from the run's snapshot, composed in the resolve step.
- `makeRemoveHandler(deps)` and `makeMarketplaceUpdateHandler(deps)` drop `pi` and forward the router's run. `register.ts` calls them without `pi`.
- `applyReconcile` passes `run: opts.run` to `removeMarketplace`. The `ApplyReconcileOptions.pi` doc no longer lists remove among the nested callees.

## Task Commits

1. **Task 1: The import cascade renders from the command run** - `f28870a7` (refactor)
2. **Task 2: marketplace remove and update render from the run, and reconcile hands its run to remove** - `de1b5203` (refactor)

## Probe Pins Restated

- `execute.test.ts`: every case moves from 3 (or 6 for the two-import production case) to 0 tool probes. The cascade reads the run seed. The strict `pi` is still forwarded to the nested install and add, which run orchestrated and never probe. The file header says so.
- `import.test.ts` (handler): the real-workflow case moves from 3 to 0. The delegating mocks state `run` in the exact options object.
- `register.test.ts`: the import case already stated one run and no probing emission. The `marketplace remove` and `marketplace update` cache-invalidation cases move from `probingEmissions: 1` to `0`; the one run is their only probe.
- Marketplace `remove`/`update` handler tests: delegating cases move from 3 (or 9, 6) to 0. The `probes` row field in the update handler test is gone.
- `remove.test.ts`, `update.test.ts`, `shared.test.ts` (orchestrators): the boundary no longer builds a `pi` at all; it returns `runWithNothingLoaded()`.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Stale contract prose] `ApplyReconcileOptions.pi` listed remove among its nested callees**
- **Found during:** Task 2
- **Issue:** `orchestrators/reconcile/types.ts` said the inventory is forwarded to the nested remove. Remove now reads `run`. The file is not in the plan's list.
- **Fix:** The doc lists add, uninstall, install, enable, and backfill, and says reconcile's own emission and the nested remove read `run`.
- **Committed in:** `de1b5203`

**2. [Plan inventory] `apply.test.ts` and `update-flow.test.ts` needed no change**
- **Found during:** Task 2
- **Issue:** Neither suite calls `removeMarketplace` or `updateMarketplace` directly. `apply.test.ts` builds `ApplyReconcileOptions`, which already carries both `run` and `pi`. The nested remove runs orchestrated and never emitted, so no probe count moved.
- **Fix:** None. Both suites pass unchanged in the focused run.

**3. [Plan inventory] `register.test.ts`'s remove and update cases already stated a probing emission**
- **Found during:** Task 2
- **Issue:** The plan says those cases keep only the three root reads. They stated `{ runs: 1, probingEmissions: 1 }`, which is three reads more.
- **Fix:** Both now state `probingEmissions: 0`, with the comment "The one run is the only probe".
- **Committed in:** `de1b5203`

---

**Total deviations:** 3 (1 contract-prose update outside the file list, 2 plan-inventory corrections).
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The first `lint:type-members` run after Task 2 exited with `Invalid contract: .../marketplace/remove.ts:701:38`. The four `remove.ts` pins (`701:9`, `701:38`, `701:55`) moved to line 706. A difflib line map from `HEAD` moved them by line only, and the gate passed. The corpus check run before the fix failed only on the type-member negative-control test, which runs that gate; it passed after the fix.
- `fallow audit` against `origin/main` reported `warn` with a clone between `edge/handlers/plugin/import.ts` and `bootstrap.ts`, marked `introduced`. A detached worktree at `HEAD` shows the same clone family (`dup:c77b3abb6f87acd9`) before the change, so it is pre-existing: the new `run` parameter moved the clone start and changed the fingerprint suffix. `fallow audit --base HEAD` returned `pass` before the Task 2 commit.
- The first Task 1 pre-commit pass failed `import-x/order` on the new seed import in `execute.test.ts`. The import moved below `hermetic-environment.ts`, and the re-run passed.

## Verification

- Task 1 verify: the focused suite (`import/execute`, plugin `import` handler, `register`, `workflows-marker-coverage`) passes 226/226 before and after the commit. The corpus check passes.
- Task 2 verify: the focused suite (marketplace `shared`/`remove`/`update`, marketplace handler `remove`/`update`, `reconcile/apply`, `reconcile/types`, `plugin/update-flow`, `register`, `cross-op-convergence`, `config-state-consistency`) passes 580/580. `npm run test:integration` passes 36/36. The corpus check passes.
- Acceptance: `rg -n "notifyWithContext\(opts\.ctx, opts\.run, IMPORT_CONTEXT"` finds the import emission. `rg -n "readonly pi"` over marketplace `remove.ts`, `update.ts`, and `shared.ts` prints nothing. The `removeMarketplace({` call in `reconcile/apply.ts` shows `run: opts.run`.
- Pre-commit on each task's files passes every hook, including typecheck, lint, fallow, direct coverage on changed pairs, and both type-member gates.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 7 extra` (the same 7 extras as after plan 01-07).
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7356/7356, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Ready for 01-09. `ImportClaudeSettingsOptions.pi` and `ApplyReconcileOptions.pi` remain only as forwards to install, marketplace add, uninstall, enable, and backfill.

## Self-Check: PASSED

- Commits `f28870a7` and `de1b5203` exist on `features/json`.
- Every modified file listed above is in the combined diff from `cfed45e3`.
