---
phase: 01-presentation-model
plan: 13
subsystem: notify
status: complete
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, plugin-update, plugin-fetch]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun and SubcommandHandler (args, ctx, run); 01-12 emitMarketplaceNotAddedSignal takes a run, with update opening its own at that call"
provides:
  - "UpdatePluginsOptions.run: every update emission, single, bulk, and no-op, renders from the run"
  - "DirectThreePhaseArgs.run and CascadeThreePhaseArgs.run?: never, keeping the mode discriminant"
  - "composeUpdateCascade(ctx, run, outcomes, cardinality, abortedByFailure) stamps severity through groupCascadeOutcomes(outcomes, run.softDeps, cardinality)"
  - "FetchPluginsOptions.run: the fetch cascade renders from the run"
  - "makeUpdateHandler(updatePlugins) and makeFetchHandler() return SubcommandHandler and take no pi"
  - "openNotificationRun( appears only in edge/register.ts and index.ts outside its defining module"
affects: [01-14, 01-15, 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 36300
  tasks: 2
  commits: 2
plan_head_before: 268cc19a6a2244e3262213b7d53cae0d41f2c875
plan_head_after: b41e264b81ac662fb92d59357885aacb762c1d18

tech-stack:
  added: []
  patterns:
    - "A severity stamp reads run.softDeps, the same snapshot the emitter composes the markers from, so no orchestrator probes the tool inventory"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/update-cascade.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/edge/handlers/plugin/fetch.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts

key-decisions:
  - "composeUpdateCascade stamps row severity from run.softDeps, the snapshot its markers come from, so update-cascade no longer imports softDepStatus (D-05)"
  - "The local run binding in createPluginUpdateOperations keeps its name: no notification run is in that scope, so nothing shadows it"
  - "update-flow.test.ts's makeCtx takes a Partial<SoftDepStatus> and builds the run through runWithSoftDeps, as reinstall-flow.test.ts does; the subagent tool lists become piSubagentsLoaded: true and workflow_control becomes workflowEngineLoaded: true"
  - "Two new update-cascade cases pin D-05 from one seed each: subagents unloaded gives warning with {requires pi-subagents}, subagents loaded gives info with no marker"

patterns-established:
  - "D-05 at the edge: every /claude:plugin verb now receives the router's run; the only run constructions are the command closure and the load pass"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "Plugin update, single, bulk, and no-op, renders every emission from the command run; the update handler takes no pi and forwards the router's run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-flow.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/update.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-op-convergence.test.ts"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false
  - id: D2
    description: "The update cascade stamps row severity from run.softDeps, the snapshot its markers are composed from (D-05); no orchestrator line calls softDepStatus"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update-cascade.test.ts#D-05: stamps warning and composes the agents marker from one unloaded snapshot"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/update-cascade.test.ts#D-05: stamps info and composes no marker from one loaded snapshot"
        status: pass
      - kind: other
        ref: "rg -n 'softDepStatus\\(' extensions/pi-claude-marketplace/orchestrators (non-comment lines: none)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plugin fetch renders from the command run; the fetch handler takes no pi, leaving register.ts and index.ts as the only run constructions"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/fetch.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/operations.test.ts"
        status: pass
      - kind: other
        ref: "npm run check (CHECK_EXIT=0)"
        status: pass
    human_judgment: false

duration: 75 min
completed: 2026-09-30
---

# Phase 01 Plan 13: Update and Fetch on the Command Run Summary

**Plugin update and fetch render every emission from the command run, and the update cascade stamps row severity from the same `run.softDeps` snapshot its markers come from, so no orchestrator probes the tool inventory any more (D-05).**

## Performance

- **Duration:** 75 min
- **Started:** 2026-09-30T13:10:54Z
- **Completed:** 2026-09-30T14:26:35Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- `UpdatePluginsOptions.run` replaces `pi`. The direct-failure helpers, the bare-form enumeration failure, the no-op sentinel, and the phase-3a abort path all pass `run`. `handleEnumerateFailure` hands the router's run to `emitMarketplaceNotAddedSignal`, so update no longer opens a run of its own.
- `DirectThreePhaseArgs.run` replaces `pi`, and `CascadeThreePhaseArgs` declares `run?: never`, so the direct and cascade modes stay discriminated.
- `composeUpdateCascade(ctx, run, ...)` stamps severity through `groupCascadeOutcomes(outcomes, run.softDeps, cardinality)` and emits with the same run. update-cascade.ts no longer imports `softDepStatus`.
- `FetchPluginsOptions.run` replaces `pi`, and the fetch cascade renders from it.
- `makeUpdateHandler(updatePlugins)` and `makeFetchHandler()` return a `SubcommandHandler` that forwards the router's run. `openNotificationRun(` now appears only in `edge/register.ts` and `index.ts`, plus its defining module.

## Task Commits

1. **Task 1: The update family renders and stamps severity from the command run** - `58a55feb` (refactor)
2. **Task 2: fetch renders from the command run** - `b41e264b` (refactor)

## Files Created/Modified

- `orchestrators/plugin/update-flow.ts` - the options, the composer type, and the failure helpers carry `run`
- `orchestrators/plugin/update-swap.ts` - `DirectThreePhaseArgs.run`, `CascadeThreePhaseArgs.run?: never`, and the invalid-config warning reads `args.run`
- `orchestrators/plugin/update-preflight.ts` - `UpdatePluginsOptions.run`
- `orchestrators/plugin/update-cascade.ts` - the severity stamp and the emission read the run
- `orchestrators/plugin/fetch.ts` - `FetchPluginsOptions.run`, with its field doc restated
- `edge/handlers/plugin/update.ts`, `edge/handlers/plugin/fetch.ts`, `edge/register.ts` - the handlers take no `pi`
- `scripts/check-unused-type-members.contracts.json` - line-only repins
- Tests: the update, cascade, fetch, handler, enable-disable, operations, cross-op-convergence, and integration callers pass a run seed. Every strict boundary states 0 tool probes.

## Decisions Made

- The cascade stamp reads `run.softDeps` (D-05). The two new cascade cases each set one seed and check both the severity and the marker, so a stamp and a marker that read different snapshots fail one of them.
- `createPluginUpdateOperations` keeps its local `const run: typeof runPluginUpdate`. No notification run is in scope there, so the name neither shadows one nor reads as one.
- `update-flow.test.ts`'s `makeCtx` takes a `Partial<SoftDepStatus>`, as `reinstall-flow.test.ts` does. Each case keeps the snapshot its former tool list produced: `subagent` became `piSubagentsLoaded: true`, and `workflow_control` became `workflowEngineLoaded: true`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/orchestrators/plugin/operations.test.ts` passed `pi` to fetch**

- **Found during:** Task 2 (typecheck)
- **Issue:** This suite is not in the plan's list. Its `makeFetchBoundary` built a strict `pi` mock with three `getAllTools()` reads and passed it to `fetchPlugins`.
- **Fix:** The boundary returns `run: runWithNothingLoaded()` and holds no tool inventory. Its doc comment now states that the emission renders from the run's snapshot. The orphaned `ExtensionAPI` import is gone.
- **Verification:** The suite passes, and `npm run check` exits 0.
- **Committed in:** `b41e264b`

**2. [Rule 3 - Blocking] Type-member contract pins moved, and one new case read a pinned member**

- **Found during:** Task 1 (`lint:type-members`)
- **Issue:** The new `NotificationRun` imports shifted pins in `update-preflight.ts` (137, 138, 346 down one) and `update-swap.ts` (216, 218, 221 down one). The first draft of the new cascade cases also spread a union-typed outcome. The gate counted that spread as a read of `DirectRenderableFailedOutcome.cause` and refused the contract.
- **Fix:** Line-only repins mapped from HEAD with a line diff. The two cases now write their outcome as a plain literal.
- **Verification:** `npm run lint:type-members` passes with the 4 recorded exceptions.
- **Committed in:** `58a55feb`

**3. [Plan inventory] Three listed suites needed no change**

- `tests/orchestrators/plugin/update-swap.test.ts` and `tests/orchestrators/plugin/update-preflight.test.ts` never pass `pi`. `tests/edge/register.test.ts` already states `{ runs: 1, probingEmissions: 0 }`, the three root reads, for every update and fetch case, and it passes 164/164 unchanged.

---

**Total deviations:** 2 auto-fixed (both blocking), plus 1 inventory note.
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The first corpus check after Task 1 exited 1. It ran while the contract pins were being remapped, so the real-gate test inside it read a half-written contracts file. A rerun on the settled tree passed.
- `fallow audit --base HEAD` returned `warn` before Task 1 for the accepted edge-handler clone family (`...6f87acd9`, `install.ts` and `update.ts`), and `pass` before Task 2.

## Verification

- Task 1 verify: the eight-suite focused run passed 656/656, before and after the commit (tracer gate). `npm run test:integration` passed 36/36. No non-comment orchestrator line calls `softDepStatus(`.
- Task 1 acceptance: `groupCascadeOutcomes(outcomes, run.softDeps` is at update-cascade.ts:194. `rg -n "readonly pi|pi\?: never"` over update-flow, update-swap, and update-preflight prints nothing.
- Task 2 verify: the fetch, handler, register, and operations suites passed 217/217.
- Task 2 acceptance: `rg -n "openNotificationRun\(" extensions` lists `index.ts:123`, `edge/register.ts:135`, and the definition in `shared/notification-run.ts`.
- Direct coverage at 100% for `update-cascade.ts`, `edge/handlers/plugin/update.ts`, `orchestrators/plugin/fetch.ts`, and `edge/handlers/plugin/fetch.ts`.
- Pre-commit on each task's files passed every hook (`SKIP=trufflehog`).
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 10 extra`. The two new extras are the new update-cascade D-05 cases.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7359/7359, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-23 is mitigated as planned. `groupCascadeOutcomes` reads `run.softDeps`. The update-cascade cases pin warning with a marker and info without one, each from a single seed. The orchestrator-wide `softDepStatus(` grep finds no second probe.

## Next Phase Readiness

- Ready for 01-14. Every `/claude:plugin` verb now receives the router's run.
- `ToolInventory` is still accepted by the notify family. Plugin info and list still take `pi` (see `cross-op-convergence.test.ts`'s `info` invoker). 01-16 removes that branch.

## Self-Check: PASSED

- Commits `58a55feb` and `b41e264b` exist on `features/json`.
- All 18 modified files listed above are in `git diff --name-only 268cc19a..b41e264b`.
