---
phase: 01-presentation-model
plan: 07
subsystem: notify
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, reconcile, pending]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun: openNotificationRun(pi), SubcommandHandler (args, ctx, run), the notify family's NotificationRun | ToolInventory source, and the run seeds"
provides:
  - "index.ts: one openNotificationRun(pi) per resources_discover pass, inside the reconcile try (NFR-2), handed to applyReconcile"
  - "ApplyReconcileOptions.run: the reconcile-applied cascade renders from the load pass's run; pi stays as the transitional inventory for the nested orchestrators"
  - "PendingReconcileOptions.run in place of pi; both pending notifications render from the command run"
  - "withParsedArgs(parse, usage, operation) returns SubcommandHandler and forwards the router's run to operation"
  - "makePendingHandler() takes no pi"
affects: [01-08..01-12 move the nested reconcile callees onto the run and delete ApplyReconcileOptions.pi, 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 25200
  tasks: 2
  commits: 2
plan_head_before: 7033a5605a1d3ba4b4ab5d763db63e9561c68b84
plan_head_after: fb285f55385a0830b2f0fe63a7d1abdb50d01f13

tech-stack:
  added: []
  patterns:
    - "The load pass opens its run inside the reconcile try, so the tool-inventory probe shares the NFR-2 boundary"
    - "An orchestrator option bag that still forwards the inventory to unmigrated callees keeps pi beside run, documented as transitional"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/index.test.ts
    - tests/edge/notification-boundary.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/types.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/reconcile/pending.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/edge/handlers/plugin/shared.test.ts
    - tests/edge/handlers/plugin/pending.test.ts
    - tests/edge/handlers/plugin/list.test.ts
    - tests/edge/handlers/plugin/info.test.ts
    - tests/integration/hooks-cross-scope-reconcile.test.ts
    - tests/integration/load-reconcile-race-child.ts
    - tests/integration/workflow-kind-inversion.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "index.test.ts states discover-pass tool reads through one named constant, TOOL_READS_PER_DISCOVER = 3, with a doc comment giving the reason; two-pass cases state 2 * TOOL_READS_PER_DISCOVER"
  - "The run is opened before the reconcile reads event.cwd, so the NFR-2 case that refuses the reconcile's cwd read still observes the three run reads"
  - "withParsedArgs returns SubcommandHandler, so the plugin list and info factories now return SubcommandHandler too; they still close over their factory pi and ignore the run until their own migration"

patterns-established:
  - "A test for a surface that reads a run passes a seed run and states zero tool probes; the strict pi mock with no getAllTools() expectation fails on any probe"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "A resources_discover pass opens one run inside the reconcile try and reads getAllTools() exactly three times, whether the reconcile emits, stays silent, or is refused"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/index.test.ts"
        status: pass
      - kind: other
        ref: "rg -n \"openNotificationRun\\(\" extensions (edge/register.ts and index.ts only)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The reconcile-applied cascade renders from the load pass's run; reconcile cases state zero tool probes, which also proves the nested orchestrated calls never probe"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/types.test.ts#apply options always carry the load pass's notification run"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false
  - id: D3
    description: "pending renders from the command run: the orchestrator takes run in place of pi, the handler forwards the router's run, and every pending case states zero tool probes"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/pending.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/shared.test.ts#calls the operation once with the parsed command, the context, and the notification run (D-05)"
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

duration: 71min
completed: 2026-09-29
status: complete
---

# Phase 1 Plan 07: Load-Pass Notification Run Summary

**Each `resources_discover` pass now opens one `NotificationRun` inside the reconcile try and hands it to `applyReconcile`, whose cascade renders from that snapshot. `pending` renders from the command run, and `withParsedArgs` forwards the router's run to its operation. `openNotificationRun(` is called only in `edge/register.ts` and `index.ts`. All 2622 corpus entries and the output catalog are byte-identical.**

## Performance

- **Duration:** 71 min
- **Started:** 2026-09-29T21:54:49Z
- **Completed:** 2026-09-29T23:06:10Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments

- `index.ts`: the reconcile call is `applyReconcile({ ctx, run: openNotificationRun(pi), pi, cwd: event.cwd, hooksRouting, completionCache })`, inside the existing try. A probe failure cannot escape `resources_discover` (NFR-2, T-01-14).
- `ApplyReconcileOptions.run: NotificationRun` carries the load pass's run. `apply.ts` emits its reconcile-applied cascade with `opts.run`. The A1 header comment now says that the soft-dependency snapshot is the run opened at the start of the pass.
- `PendingReconcileOptions.run` replaces `pi`. Both pending notifications (`notify` and `notifyWithContext`) pass `opts.run`.
- `withParsedArgs(parse, usage, operation)` returns a `SubcommandHandler`. The handler takes `(args, ctx, run)` and calls `operation(parsed, ctx, run)`. Operations with two parameters (list, info) still fit.
- `makePendingHandler()` takes no `pi`. `register.ts` calls it without arguments.
- Hooks get no run. Nothing under `bridges/` imports `notification-run.ts`.

## Task Commits

1. **Task 1: One run per load pass reaches the reconcile cascade** - `01529821` (feat)
2. **Task 2: `pending` reads the command run** - `fb285f55` (refactor)

The tracer gate ran in the interactive `end-of-phase` mode with an automated-only `<verify>`. The focused suite, `npm run test:integration`, and the corpus check all passed before Task 2 started.

## Files Created/Modified

- `extensions/pi-claude-marketplace/index.ts` - opens the load pass's run inside the reconcile try
- `extensions/pi-claude-marketplace/orchestrators/reconcile/{types,apply}.ts` - `ApplyReconcileOptions.run`, the cascade reads it, A1 comment restated
- `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts` - `run` replaces `pi`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` - `operation` rename, run forwarding
- `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` - no factory `pi`; header and factory doc restated
- `extensions/pi-claude-marketplace/edge/handlers/plugin/{list,info}.ts` - return type `SubcommandHandler` (deviation 2)
- `extensions/pi-claude-marketplace/edge/register.ts` - `makePendingHandler()`
- `tests/index.test.ts` - `TOOL_READS_PER_DISCOVER` and the restated discover counts
- `tests/orchestrators/reconcile/{apply,types,backfill,pending}.test.ts` - seed runs; zero probes
- `tests/orchestrators/plugin/{install-flow,enable-disable}.test.ts`, three integration files - seed runs at every `applyReconcile` call
- `tests/edge/handlers/plugin/{shared,pending,list,info}.test.ts` - handlers take a run; shared proves forwarding
- `tests/edge/notification-boundary.ts` - caller-supplied `ui` bullet restated
- `scripts/check-unused-type-members.contracts.json` - index.ts pins moved by line only

## Decisions Made

- Discover-pass tool reads are stated through `TOOL_READS_PER_DISCOVER = 3` in `index.test.ts`, next to the existing `CWD_READS_PER_DISCOVER`. Its doc comment gives the reason. The pass opens one run, and that run probes each of the three companion targets once. The cascade renders from the run, and the last-ditch and PATH lines are raw text. Two-pass cases state `2 * TOOL_READS_PER_DISCOVER`.
- The run is opened before the reconcile reads `event.cwd`. The NFR-2 case that refuses the reconcile's `cwd` read therefore still observes three reads. Before this plan it observed zero.
- The forwarding proof in `shared.test.ts` hands the handler `runWithAllLoaded()`. A handler that built its own nothing-loaded run would fail the strict `exactParams` expectation.

## Transitional Items Later Plans Remove

- `ApplyReconcileOptions.pi`: the inventory `apply.ts` forwards to remove, add, uninstall, install, and enable, and `backfill.ts` forwards to reinstall. Plans 01-08 through 01-12 move those callees onto the run, and plan 01-12 deletes the field.
- The plugin `list` and `info` handler factories still close over `pi` and ignore the run they now receive.
- The notify family's `ToolInventory` arm and `snapshotOf` (plan 01-16).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/orchestrators/reconcile/backfill.test.ts` builds an `ApplyReconcileOptions`**
- **Found during:** Task 1 (typecheck)
- **Issue:** `backfillOptionsWithRouting` returns an `ApplyReconcileOptions`, which now requires `run`. The file is not in the plan's list.
- **Fix:** The returned bag carries `run: runWithNothingLoaded()`.
- **Committed in:** `01529821`

**2. [Rule 3 - Blocking] The plugin `list` and `info` factories declared a two-parameter return type**
- **Found during:** Task 2 (typecheck)
- **Issue:** `withParsedArgs` returns a `SubcommandHandler`, which needs the run, so it no longer fits a declared `(args, ctx) => Promise<void>`. `list.ts` and `info.ts` are the other two `withParsedArgs` users, and neither is in the plan's list.
- **Fix:** Both factories return `SubcommandHandler`. Their tests (`list.test.ts`, `info.test.ts`) pass `runWithNothingLoaded()` as the third argument. The handlers ignore the run, so their probe counts do not move.
- **Committed in:** `fb285f55`

**3. [Rule 2 - Stale contract prose] `tests/edge/notification-boundary.ts` said caller-supplied-`ui` cases probe through `pi` at emission**
- **Found during:** Task 1
- **Issue:** The `index.test.ts` cases that route emissions through `contextNotifyingThrough` state non-zero tool reads because the pass opens its run. They no longer probe at emission.
- **Fix:** The bullet now says that the `resources_discover` pass opens its run through `pi`.
- **Committed in:** `01529821`

**4. [Plan wording] `types.test.ts` gained one negative proof**
- **Found during:** Task 1
- **Issue:** Every existing `@ts-expect-error` apply-options proof would also have failed for the missing `run`, so each proof no longer showed its own reason.
- **Fix:** Each existing proof carries `run`. One new proof omits only `run` ("apply options always carry the load pass's notification run").
- **Committed in:** `01529821`

---

**Total deviations:** 4 (2 blocking ripples outside the file list, 1 contract-prose update, 1 added compile-time proof).
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The first `lint:type-members` run after Task 1 exited 2. Four `index.ts` contract pins had moved: 91 -> 92 (three locations) and 169..171 -> 180..182. A difflib line map from `HEAD` moved them by line only, and the gate passed.
- `fallow audit --base HEAD` returned `pass` before each commit.

## Verification

- Task 1 verify: the focused suite (`index`, `apply`, `types`, `backfill`, `install-flow`, `enable-disable`) passes 354/354. `npm run test:integration` passes 36/36. The corpus check passes.
- Task 2 verify: the focused suite (`reconcile/pending`, plugin `shared`/`pending`/`list`/`info`, `router`, `register`, `index`) passes 348/348. The corpus check passes.
- Acceptance: `rg -n "openNotificationRun\(" extensions` lists `index.ts:123` and `edge/register.ts:135` outside `notification-run.ts`. `rg -n "notification-run" extensions/pi-claude-marketplace/bridges` prints nothing. `rg -n "readonly pi" .../reconcile/pending.ts` prints nothing.
- Pre-commit on each task's files passes every hook, including typecheck, lint, fallow, direct coverage on changed pairs, and both type-member gates.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 7 extra` (the same 7 extras as after plan 01-06).
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7356/7356, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Both D-07 roots now open one run each. Plans 01-08 through 01-12 move the nested reconcile callees and the remaining handlers from their factory `pi` onto the run they already receive. Plan 01-12 then deletes `ApplyReconcileOptions.pi`.

## Self-Check: PASSED

- Every modified file listed above exists.
- Commits `01529821` and `fb285f55` exist on `features/json`.
