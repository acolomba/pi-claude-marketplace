---
phase: 01-presentation-model
plan: 11
subsystem: notify
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, plugin-enable, plugin-disable, plugin-uninstall, reconcile]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun and SubcommandHandler (args, ctx, run); 01-08 reconcile run; 01-10 install on the run and reconcile's pi reduced to uninstall, enable, and backfill"
provides:
  - "EnableDisablePluginOptions.run: dispatchOutcome passes run.softDeps to composeOutcomeRow, so the enable severity stamp and the soft-dep markers read one snapshot (D-05)"
  - "emitMarketplaceNotAdded(args: { ctx; run: NotificationRun; marketplace; requestedScope; orchestrated })"
  - "UninstallPluginOptions.run: every uninstall emission renders from the run"
  - "makeEnableDisableHandler(enable, hooksRouting) and makeUninstallHandler(hooksRouting, completionCache) return SubcommandHandler and take no pi"
  - "Reconcile hands its run to the nested enable and uninstall (D-07); ApplyReconcileOptions.pi feeds only the backfill"
affects: [01-12 onward (remaining pi-taking orchestrators and the backfill forward), 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 32764
  tasks: 2
  commits: 2
plan_head_before: ff76245a747da5f591e2bf316daa4f295ea4fe24
plan_head_after: 0112c221e2f461d928b3569d8d07e8560f9e6946

tech-stack:
  added: []
  patterns:
    - "A test's makeCtx returns a run seed in place of a tool inventory once every orchestrator the file drives reads the run"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - scripts/check-unused-type-members.contracts.json
    - scripts/check-unused-type-members.exceptions.json
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/edge/handlers/plugin/enable-disable.test.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - tests/edge/register.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts

key-decisions:
  - "composeOutcomeRow keeps its `probe` field name; only its doc changes, to the command run's soft-dep snapshot that the markers are composed from (D-05)"
  - "The enable severity cases state the snapshot through runWithSoftDeps booleans that match each case's former tool list: subagent alone, mcp alone, or mcp and subagent"
  - "makeUninstallHandler keeps hooksRouting and completionCache required; dropping pi was the only signature change the plan's contract needs"

patterns-established:
  - "D-05 enable: the router's run stamps the enable row's severity and composes its markers"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "Enable and disable render from the command run: the option bags carry run, dispatchOutcome stamps severity from run.softDeps, and the handler's own failure row renders from the run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/enable-disable.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "emitMarketplaceNotAdded takes a run, and uninstall renders every emission from the run with no wrap left"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/uninstall.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Reconcile hands its run to the nested enable and uninstall (D-07)"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-op-convergence.test.ts"
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

duration: 81min
completed: 2026-09-30
status: complete
---

# Phase 1 Plan 11: Enable, Disable, and Uninstall on the Command Run Summary

**Enable, disable, and uninstall render from the command's one soft-dep snapshot, the enable severity stamp reads `run.softDeps`, and reconcile hands its run to both nested verbs.**

## Performance

- **Duration:** about 81 min
- **Started:** 2026-09-30T02:45Z
- **Completed:** 2026-09-30T04:07Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- `EnableDisablePluginOptions` carries `readonly run: NotificationRun` in place of `pi`. Every internal emitter (`emitUnresolvedTarget`, `emitResolutionFailure`, `emitEnableDisableFailedRow`, `dispatchOutcome`) reads `run`. `dispatchOutcome` passes `run.softDeps` to `composeOutcomeRow`, and the `softDepStatus` import is gone (D-05).
- `emitMarketplaceNotAdded` takes `run`. During Task 1, uninstall passed `openNotificationRun(pi)` for that one call. Task 2 removed the wrap.
- `makeEnableDisableHandler(enable, hooksRouting)` returns `SubcommandHandler`. It forwards the router's run, and its own failure row renders from the run.
- `UninstallPluginOptions` carries `run`. `makeUninstallHandler(hooksRouting, completionCache)` returns `SubcommandHandler`.
- Reconcile passes `run: opts.run` to the nested `setPluginEnabled` and `uninstallPlugin` (D-07). `ApplyReconcileOptions.pi` now feeds only the backfill.
- `openNotificationRun(` appears only in `edge/register.ts` and `index.ts` outside its defining module.

## Task Commits

1. **Task 1: enable and disable render from the run, and so does the shared not-added emitter** - `58e2284b` (refactor)
2. **Task 2: uninstall renders from the run, and reconcile hands its run to uninstall** - `0112c221` (refactor)

Task 1 is a tracer. Its automated verify ran green on the committed tree before Task 2 started.

## Probe Pins Restated

- `tests/edge/handlers/plugin/enable-disable.test.ts`: the delegating cases moved from 6 probes to 0, and the handler's failure-conversion cases moved from 3 to 0. The header now states that no path reads `pi.getAllTools()`.
- `tests/edge/handlers/plugin/uninstall.test.ts`: the delegating cases moved from 3 probes to 0. The header says the same.
- `tests/orchestrators/plugin/shared.test.ts`: the two standalone `emitMarketplaceNotAdded` cases no longer build a strict `pi` mock with three `getAllTools()` reads. They pass `runWithNothingLoaded()`, and the strict `ctx` and `ui` mocks still pin the exact row.
- `tests/edge/register.test.ts`: the registered uninstall case moved from `{ runs: 1, probingEmissions: 1 }` to `{ runs: 1, probingEmissions: 0 }`, which leaves three root reads.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `integration/transaction-lifecycle-cascade.test.ts` passed `pi` to `uninstallPlugin`**
- **Found during:** Task 2 (typecheck)
- **Issue:** The file is not in the plan's list.
- **Fix:** Its uninstall step passes the `run` that its `makeCtx` already returns.
- **Verification:** `npm run test:integration` passed 36/36.
- **Committed in:** `0112c221`

**2. [Rule 2 - Stale contract prose] `ApplyReconcileOptions.pi` listed enable and uninstall among its forwards**
- **Found during:** Tasks 1 and 2
- **Issue:** `orchestrators/reconcile/types.ts` is not in the plan's list.
- **Fix:** The doc now says the inventory feeds only the backfill, and it lists the nested verbs that read `run`.
- **Committed in:** `58e2284b`, `0112c221`

**3. [Rule 3 - Blocking] A type-member exception pin moved**
- **Found during:** Task 1 (`lint:type-members`)
- **Issue:** Adding the `NotificationRun` import to `orchestrators/plugin/shared.ts` moved the `enableRowDependencies.signals.partition` exception down one line. That exception lives in `scripts/check-unused-type-members.exceptions.json`, which the plan does not list.
- **Fix:** The pin shifted by line only (145 to 146). The contracts file shifted the same way.
- **Committed in:** `58e2284b`

**4. [Plan inventory] Four listed suites needed no change**
- `tests/orchestrators/reconcile/apply.test.ts` and `tests/architecture/config-state-consistency.test.ts` have no case that states the options handed to the nested enable or uninstall. Both pass unchanged.
- `tests/architecture/cross-op-convergence.test.ts` has no enable invoker, so only its uninstall invoker changed, in Task 2.
- `tests/edge/register.test.ts` enable and disable cases are usage-error cases that already stated `probingEmissions: 0`.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 prose), plus 1 inventory note.
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The first corpus check after the Task 1 edits failed in `tests/architecture/unused-type-member-gate.test.ts`. That test runs the real gate, and the gate refused the stale line pins. After the repin, the corpus check passed.
- The corpus check reports `2622 baseline entries present, 8 extra`. 01-10 recorded 7 extra. All extras come from `tests/edge/register.test.ts`, `tests/shared/notification-dispatch.test.ts`, and `tests/shared/notify-context.test.ts`. This plan changed none of those emissions, and no extra comes from a file this plan changed. One `notify-context.test.ts` entry is `x2`, so 7 extra lines count as 8 entries. This plan did not re-run the check at the 01-10 head, so it cannot confirm whether that explains the difference.
- The default `fallow audit` (no base) returns `warn` from clone groups this branch introduced earlier: the `*.messaging.ts` render maps, the handler clone family, and the script tails. `fallow audit --base HEAD` returned `pass` before both commits, so neither commit adds a finding.
- The acceptance grep `rg -n "readonly pi"` would match `readonly pinVersionOverride`-style fields. The word-bounded `rg -n "readonly pi\b"` prints nothing over `enable-disable.ts` and `uninstall.ts`.

## Verification

- Task 1 verify: the nine-suite focused run passed 489/489. The corpus check passed.
- Task 1 acceptance: `rg -n "softDepStatus"` and `rg -n "readonly pi\b"` over `enable-disable.ts` print nothing.
- Task 2 verify: the seven-suite focused run passed 322/322. `npm run test:integration` passed 36/36. The corpus check passed.
- Task 2 acceptance: `rg -n "openNotificationRun\(" extensions` lists `index.ts:123`, `edge/register.ts:135`, and the definition in `shared/notification-run.ts`. `rg -n "readonly pi\b"` over `uninstall.ts` prints nothing.
- Pre-commit on each task's files passed every hook, including typecheck, lint, fallow, direct coverage on changed pairs, and the type-member gate. `lint:type-members` passed with its 4 recorded exceptions.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 8 extra`.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7357/7357, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-21 is mitigated as planned. `composeOutcomeRow` reads `run.softDeps`, the snapshot that `notifyWithContext` composes the markers from. The WR-06 enable cases pin both outcomes: nothing loaded gives the warning row with `{requires pi-subagents}`, and subagent loaded gives the info row with no marker.

## Next Phase Readiness

- Ready for 01-12. All plugin mutators render from the command run. `ApplyReconcileOptions.pi` feeds only the backfill.

## Self-Check: PASSED

- Commits `58e2284b` and `0112c221` exist on `features/json`.
- Every modified file listed above is in the combined diff from `ff76245a`.
