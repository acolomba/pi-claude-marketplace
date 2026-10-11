---
phase: 01-presentation-model
plan: 12
subsystem: notify
status: complete
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, plugin-reinstall, reconcile, backfill]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun and SubcommandHandler (args, ctx, run); 01-08 reconcile run; 01-11 enable, disable, and uninstall on the run, with ApplyReconcileOptions.pi feeding only the backfill"
provides:
  - "ReinstallPluginOptions.run and ReinstallPluginsOptions.run: every reinstall emission, single and bulk, renders from the run"
  - "renderReinstallPartitionAndNotify(ctx, run, outcomes, cardinality)"
  - "emitMarketplaceNotAddedSignal(args: { ctx; run: NotificationRun; cwd; context; cardinality; err })"
  - "makeReinstallHandler(reinstallPlugins) returns SubcommandHandler and takes no pi"
  - "ApplyReconcileOptions has no pi; the backfill hands reconcile's run to reinstallPlugin (D-07)"
  - "index.ts calls applyReconcile({ ctx, run: openNotificationRun(pi), cwd, hooksRouting, completionCache })"
affects: [01-13 (update takes the run and deletes its openNotificationRun(pi) call), 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 49100
  tasks: 2
  commits: 2
plan_head_before: ff0164552a7f39e8b14017530c568bfdbb848cf8
plan_head_after: 449dbf27177099ef3c03a8d1a276c21d4ccdbfa9

tech-stack:
  added: []
  patterns:
    - "A composer that has not taken the run yet opens one at its single call into a run-taking emitter, which keeps its probe count unchanged until it migrates"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/index.ts
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/plugin/reinstall.messaging.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/edge/register.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/reconcile/types.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts
    - tests/integration/hooks-cross-scope-reconcile.test.ts
    - tests/integration/load-reconcile-race-child.ts
    - tests/integration/workflow-kind-inversion.test.ts
    - tests/integration/ipc-child.ts

key-decisions:
  - "update-flow.ts's one emitMarketplaceNotAddedSignal call passes run: openNotificationRun(pi), so update still probes once for that emission until it takes the router's run"
  - "reinstall-flow.test.ts's makeCtx takes a Partial<SoftDepStatus> and builds the run through runWithSoftDeps; each case keeps the snapshot its former tool list produced"
  - "The makeStubPi helper in tests/integration/ipc-child.ts is deleted: the load-reconcile race child was its only caller"

patterns-established:
  - "D-07 load pass: resources_discover opens one run and hands it to reconcile, and reconcile hands the same run to every nested call, the backfill's reinstall included"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "Reinstall, single and bulk, renders from the command run; the handler takes no pi and forwards the router's run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.messaging.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/reinstall.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "emitMarketplaceNotAddedSignal takes a run; update keeps its probe count by opening one at its call"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-op-convergence.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reconcile holds no tool inventory; the backfill hands the load pass's run to reinstall and index.ts passes only the run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false

duration: 62 min
completed: 2026-09-30
---

# Phase 01 Plan 12: Reinstall and Reconcile on the Command Run Summary

**Reinstall renders every emission from the command run, and the load-time backfill hands reconcile's run to it, so reconcile and the load root no longer carry the tool inventory (D-05, D-07).**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-30T04:09:54Z
- **Completed:** 2026-09-30T05:12:00Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments

- `ReinstallPluginOptions.run` and `ReinstallPluginsOptions.run` replace `pi`. Every single-plugin row, the bulk cascade, the empty-target sentinel, the enumeration failure, and the invalid-config warning render from the run.
- `emitMarketplaceNotAddedSignal` takes a run. Update does not take the run until the next plan, so its one call opens a run at that emission. Its probe count stays at one.
- `makeReinstallHandler(reinstallPlugins)` drops `pi` and returns a `SubcommandHandler` that forwards the router's run.
- The backfill passes `run: opts.run` to `reinstallPlugin`. `ApplyReconcileOptions` no longer has a `pi` field, and `index.ts` hands `applyReconcile` only the run it opens.

## Task Commits

1. **Task 1: reinstall renders from the command run** - `764bf789` (refactor)
2. **Task 2: reconcile and the load root stop carrying `pi`** - `449dbf27` (refactor)

## Files Created/Modified

- `orchestrators/plugin/reinstall-flow.ts` - the option bags carry `run`, and every forward and emission reads it
- `orchestrators/plugin/reinstall.messaging.ts` - the bulk emitter takes and passes `run`
- `orchestrators/plugin/shared.ts` - `emitMarketplaceNotAddedSignal` takes `run`
- `orchestrators/plugin/update-flow.ts` - its signal call opens a run from `pi`
- `edge/handlers/plugin/reinstall.ts`, `edge/register.ts` - the handler takes no `pi`
- `orchestrators/reconcile/backfill.ts`, `orchestrators/reconcile/types.ts`, `index.ts` - the backfill forwards the run; `pi` leaves the reconcile options and the load root call
- `scripts/check-unused-type-members.contracts.json` - line-only repins
- Tests: the reinstall, messaging, handler, signal, backfill, reconcile, and integration callers pass a run seed and no `pi`

## Decisions Made

- The update signal call opens its own run for now. That keeps update's probe count the same until the next plan hands it the router's run and deletes the call.
- `reinstall-flow.test.ts`'s `makeCtx` takes a `Partial<SoftDepStatus>`. Each call site states the booleans its former tool list produced: subagent alone, or MCP and subagent.
- The three `createNotificationBoundary` cases in `reinstall-flow.test.ts` state 0 tool probes and pass `runWithNothingLoaded()`. That seed matches the empty inventory the boundary served before.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three suites outside the plan's list passed `pi` to reinstall**
- **Found during:** Task 1 (typecheck)
- **Issue:** `tests/orchestrators/plugin/operations.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, and `tests/integration/transaction-lifecycle-cascade.test.ts` called `reinstallPlugin` with `pi`.
- **Fix:** They pass the run their `makeCtx` already returns, or `runWithNothingLoaded()` where the case has no run.
- **Committed in:** `764bf789`

**2. [Rule 3 - Blocking] Type-member contract pins moved**
- **Found during:** Tasks 1 and 2 (`lint:type-members`)
- **Issue:** The new imports in `reinstall.messaging.ts` and `update-flow.ts`, and the deleted `pi,` line in `index.ts`, moved pinned lines. The gate refused the stale pins, so the corpus test run exited 1.
- **Fix:** Line-only shifts: `reinstall.messaging.ts` 217 to 218 and 73 to 74, `update-flow.ts` 834 to 835 and 915 to 916, and `index.ts` 180-182 each down one.
- **Committed in:** `764bf789`, `449dbf27`

**3. [Rule 1 - Orphan] `makeStubPi` lost its only caller**
- **Found during:** Task 2 (typecheck)
- **Issue:** `tests/integration/load-reconcile-race-child.ts` was the only caller of `makeStubPi` in `tests/integration/ipc-child.ts`. That file is not in the plan's list.
- **Fix:** Deleted the helper and its `ExtensionAPI` import, and restated the file header.
- **Committed in:** `449dbf27`

**4. [Plan inventory] `tests/orchestrators/reconcile/backfill.test.ts` already passed a run**
- Its options already carried `run: runWithNothingLoaded()`, so Task 1 needed no change there. Task 2 dropped the `pi` parameter from its option builders and its silent boundary.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 orphan), plus 1 inventory note.
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The scratchpad directory is shared across plan executors, and `check.log` there already held an earlier plan's `CHECK_EXIT=0`. The first read of it, and of a 96-line `corpus2.log`, happened while the combined background job was still running. That job finished later: the corpus check passed with `2622 baseline entries present, 8 extra`, the same count as 01-11, and `npm run check` exited 0 on the Task 2 tree. A standalone corpus rerun gave the same result.
- The default `fallow audit` (no base) returns `warn` from clone groups this branch introduced earlier. `fallow audit --base HEAD` returned `pass` before both commits.

## Verification

- Task 1 verify: the eight-suite focused run passed 654/654 after the commit. The corpus check passed.
- Task 1 acceptance: `rg -n "readonly pi\b"` over `reinstall-flow.ts` prints nothing, and the backfill's `reinstallPlugin({` call shows `run: opts.run`.
- Task 2 verify: the six-suite focused run passed 354/354. `rg -n "opts\.pi|readonly pi\b"` over `orchestrators/reconcile` prints nothing. The `applyReconcile({` call in `index.ts` shows `run: openNotificationRun(pi)` and no `pi,` entry.
- Pre-commit on each task's files passed every hook.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 8 extra`.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7357/7357, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-22 is mitigated as planned. The run still opens inside the reconcile `try` in `index.ts`, and dropping `pi` removed no error handling. `tests/index.test.ts` passes unchanged.

## Next Phase Readiness

- Ready for 01-13. Update is the one composer that still opens a run from `pi` at an emission, in `handleEnumerateFailure`.

## Self-Check: PASSED

- Commits `764bf789` and `449dbf27` exist on `features/json`.
- Every modified file listed above is in the combined diff from `ff016455`.
