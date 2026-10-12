---
phase: 01-presentation-model
plan: 06
subsystem: notify
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, edge-router]

requires:
  - phase: 01-presentation-model
    provides: "01-05 probe-free text strategy: notify() takes one softDepStatus snapshot per emission and feeds it to resolveRows only"
provides:
  - "shared/notification-run.ts: NotificationRun { softDeps } and openNotificationRun(pi), the one soft-dep probe per run"
  - "edge/register.ts: the /claude:plugin closure opens one run per invocation and passes it to routeClaudePlugin"
  - "edge/router.ts: SubcommandHandler = (args, ctx, run) => Promise<void>; every SubcommandHandlers member and both routers forward run"
  - "edge/handlers/plugin/browse.ts: BrowseActionHandlers members are SubcommandHandler; browse forwards its run"
  - "notify family (notify, emitContextCascade, emitUpdateNoOpCascade, emitReconcileAppliedContextCascade, notifyWithContext, notifyUpdateWithContext, notifyUpdateNoOpWithContext, notifyReconcileAppliedWithContext) takes source: NotificationRun | ToolInventory"
  - "ListMarketplacesOptions.run and GetMarketplaceInfoOptions.run replace pi"
  - "tests/shared/notification-run-seeds.ts: runWithSoftDeps, runWithNothingLoaded, runWithAllLoaded"
affects: [01-07 load-pass root in index.ts, 01-08..01-15 verb migrations onto the run, 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 31700
  tasks: 2
  commits: 2
plan_head_before: 1aa94d7658d7dfe88c6a359a05092a8e8cbe6c1d
plan_head_after: b400edd93589260b0fbee2d994d41e85b0bd45ee

tech-stack:
  added: []
  patterns:
    - "Per-invocation NotificationRun built at the command root and threaded through the router as the handlers' third argument"
    - "Transitional source union: a run supplies its own snapshot; a tool inventory is probed once per emission (snapshotOf, removed by 01-16)"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/notification-run.ts
    - tests/shared/notification-run.test.ts
    - tests/shared/notification-run-seeds.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/edge/router.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/edge/router.test.ts
    - tests/edge/register.test.ts
    - tests/edge/notification-boundary.ts
    - tests/edge/handlers/plugin/browse.test.ts
    - tests/edge/handlers/marketplace/list.test.ts
    - tests/edge/handlers/marketplace/shared.test.ts
    - tests/edge/handlers/marketplace/info.test.ts
    - tests/orchestrators/marketplace/list.test.ts
    - tests/orchestrators/marketplace/info.test.ts
    - tests/index.test.ts
    - scripts/check-unused-type-members.contracts.json

key-decisions:
  - "The handler signature is one exported alias, SubcommandHandler, in edge/router.ts; SubcommandHandlers, BrowseActionHandlers, and the migrated handler factories all use it instead of restating (args, ctx, run) => Promise<void>"
  - "register.test.ts states tool reads as CommandProbes { runs, probingEmissions }: each handler invocation opens one run (three reads), and each notification from a not-yet-migrated surface still probes three more"
  - "The notify family keeps a NotificationRun | ToolInventory union until 01-16; snapshotOf is module-private and discriminates on the softDeps member"

patterns-established:
  - "A migrated handler factory takes no pi and returns SubcommandHandler; its option bag carries readonly run: NotificationRun; its tests pass a seed run and state zero tool probes"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "openNotificationRun reads getAllTools() exactly three times and returns a snapshot that does not follow later inventory changes"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-run.test.ts#D-05: opening a run reads the tool inventory exactly three times"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-run.test.ts#D-05: a run keeps its snapshot when the inventory later answers differently"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/notification-run.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "notify reads a run's snapshot: an agents row gets {requires pi-subagents} under runWithNothingLoaded and no marker under runWithAllLoaded"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#D-05: notify reads a run's snapshot and marks an agents row when no companion is loaded"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#D-05: notify reads a run's snapshot and leaves an agents row unmarked when every companion is loaded"
        status: pass
    human_judgment: false
  - id: D3
    description: "The registered /claude:plugin handler opens one run per invocation (usage errors included) and the router hands (rest, ctx, run) to every handler; browse forwards the run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/edge/router.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/browse.test.ts"
        status: pass
      - kind: other
        ref: "rg -n \"openNotificationRun\\(\" extensions (one call site: edge/register.ts)"
        status: pass
    human_judgment: false
  - id: D4
    description: "marketplace list and marketplace info render from the command run with zero emission-time tool probes; every info block of one command reads one run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/edge/handlers/marketplace/list.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/list.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/shared.test.ts#hands each invocation's own notification run to the operation (D-05)"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/info.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/info.test.ts"
        status: pass
    human_judgment: false
  - id: D5
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

duration: 74min
completed: 2026-09-29
status: complete
---

# Phase 1 Plan 06: Command-Root Notification Run Summary

**The `/claude:plugin` closure now opens one `NotificationRun` per invocation, the only soft-dependency probe that command makes. The router hands the run to every subcommand handler as its third argument. `marketplace list` and `marketplace info` render from the run's snapshot and never probe the tool inventory when they emit. All 2622 corpus entries and the output catalog are byte-identical.**

## Performance

- **Duration:** 74 min
- **Started:** 2026-09-29T20:36:53Z
- **Completed:** 2026-09-29T21:50:49Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments

- `shared/notification-run.ts` (new): `NotificationRun` has one member, `softDeps`. `openNotificationRun(pi)` returns `{ softDeps: softDepStatus(pi) }`. That is the one probe per run (D-05), and the JSDoc states the D-06 rule that later members land with their first reader.
- `notification-dispatch.ts`: `notify`, `emitContextCascade`, `emitUpdateNoOpCascade`, and `emitReconcileAppliedContextCascade` take `source: NotificationRun | ToolInventory`. A module-private `snapshotOf(source)` returns `source.softDeps` for a run and probes an inventory. The snapshot feeds `resolveRows` exactly where the entry probe did. The four `notify-context.ts` entry points take and forward the same union.
- `edge/router.ts`: new exported `SubcommandHandler = (args, ctx, run) => Promise<void>`. Every `SubcommandHandlers` member uses it. `routeClaudePlugin(args, handlers, ctx, run)` and `routeMarketplace` pass `run` to every handler call.
- `edge/register.ts`: `handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx, openNotificationRun(pi))`. That is Option A: one construction per command, usage errors included (D-05, D-07).
- `browse.ts`: `BrowseActionHandlers` members are `SubcommandHandler`. The returned handler takes `(args, ctx, run)` and forwards `run` to `list` and to the dispatched action. Browse's own notifications and plugin loader still use its factory `pi` until plan 01-14.
- `marketplace list`: `makeMarketplaceListHandler()` takes no `pi`. `ListMarketplacesOptions.run: NotificationRun` replaces `pi`.
- `marketplace info`: `makeSingleNameMarketplaceHandler(usage, operation)` takes no `pi`. Its callback and type are renamed to `operation` / `SingleNameMarketplaceOperation`, so `run` means the notification run everywhere. `GetMarketplaceInfoOptions.run` replaces `pi`, and all four notify calls pass `opts.run`.

## Task Commits

1. **Task 1: One run per command reaches `marketplace list` end to end** - `cdb529c0` (feat)
2. **Task 2: `marketplace info` reads the run** - `b400edd9` (refactor)

The tracer gate ran in the interactive `end-of-phase` mode with an automated-only `<verify>`. All three verify commands passed before Task 2 started.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-run.ts` - `NotificationRun`, `openNotificationRun`
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` - source union and `snapshotOf`; header restated
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - the four entry points forward the union
- `extensions/pi-claude-marketplace/edge/router.ts` - `SubcommandHandler`; both routers forward `run`; header restated
- `extensions/pi-claude-marketplace/edge/register.ts` - opens the run; list and info factories take no `pi`
- `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts` - forwards the run
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/{list,shared,info}.ts` - read the run
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{list,info}.ts` - `readonly run: NotificationRun`
- `tests/shared/notification-run.test.ts`, `tests/shared/notification-run-seeds.ts` - owner test and seeds
- `tests/shared/notification-dispatch.test.ts` - two run-literal cases
- `tests/edge/router.test.ts` - every handler expectation states `(rest, ctx, run)`
- `tests/edge/register.test.ts` - `CommandProbes { runs, probingEmissions }` and a reason comment for each count
- `tests/edge/handlers/**`, `tests/orchestrators/marketplace/{list,info}.test.ts` - seed runs, zero tool probes
- `tests/edge/notification-boundary.ts`, `tests/index.test.ts` - see deviations
- `scripts/check-unused-type-members.contracts.json` - 4 pins (8 locations) moved by line only

## Decisions Made

- One exported `SubcommandHandler` alias replaces 21 restated `(args, ctx, run) => Promise<void>` member types. Browse and the migrated factories return or use the same alias, so a later signature change edits one line.
- `register.test.ts` states tool reads as two counts. `runs` is the number of handler invocations, each opening one run that reads the inventory three times. `probingEmissions` is the number of notifications from surfaces that still probe per emission. Each owner case has a comment saying which notifications those are: add, remove, update, reinstall, and uninstall have one each; bootstrap has two (add and autoupdate); install has two (the severity probe and the notification probe).
- The multi-emission `marketplace info` case keeps its byte assertions for both blocks and now states zero tool probes. That shows both blocks rendered from one run without a per-emission probe.

## Transitional Items Plan 01-16 Removes

- `snapshotOf` in `notification-dispatch.ts` and the `ToolInventory` arm of the `source` union on the eight notify-family functions.
- Browse's factory `pi` for its own notifications and plugin loader (plan 01-14 moves those onto the run).
- Every handler factory other than list and info still closes over `pi` and ignores the run argument. Later plans move them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `tests/index.test.ts` pinned the old probe count**
- **Found during:** Task 1 (corpus check)
- **Issue:** "keeps hook routing and command completion state inside each extension-load owner graph" drives the real `command.handler` for `marketplace add`. It sized the boundary at 3 tool reads, and the new root run adds 3 more.
- **Fix:** The case states 6 and says why: 3 for the command's run, 3 for the add notification's per-emission probe.
- **Files modified:** `tests/index.test.ts`
- **Committed in:** `cdb529c0`

**2. [Rule 1 - Vocabulary gate] A new test title used a retired token**
- **Found during:** Task 1 (corpus check)
- **Issue:** `tests/architecture/partial-vocabulary-guard.test.ts` (D-75-01) forbids the phrase "pi-subagents is not loaded" anywhere in code, docs, and unit tests. One new dispatch case title used it.
- **Fix:** The title now says "when no companion is loaded".
- **Committed in:** `cdb529c0`

**3. [Rule 2 - Stale contract prose] `tests/edge/notification-boundary.ts` described only the per-emission probe model**
- **Found during:** Task 1
- **Issue:** The shared boundary's header states the probe contract, and it had no word for a surface that reads a run. RESEARCH "Test pins that move" asked for this update. The file is not in the plan's list.
- **Fix:** One sentence: a surface that reads a notification run probes nothing, so its cases state zero probes (D-05).
- **Committed in:** `cdb529c0`

**4. [Plan wording] A shared `SubcommandHandler` alias**
- **Found during:** Task 1
- **Issue:** Adding `run: NotificationRun` inline to 21 members made Prettier wrap the long ones across five lines each.
- **Fix:** One exported `SubcommandHandler` alias in `router.ts`. `BrowseActionHandlers`, `makeBrowseHandler`, `makeMarketplaceListHandler`, `makeMarketplaceInfoHandler`, and `makeSingleNameMarketplaceHandler` use it. The type is structurally what the plan specified.
- **Committed in:** `cdb529c0`, `b400edd9`

**5. [Plan wording] The shared-handler "closes over the API" case was replaced**
- **Found during:** Task 2
- **Issue:** `shared.test.ts` proved that each factory call closed over its own `pi`. The factory no longer takes `pi`, so the property no longer exists.
- **Fix:** The replacement case proves a D-05 property instead. One handler is invoked twice with two different runs (`runWithNothingLoaded`, `runWithAllLoaded`). A strict operation mock expects each call with its own run.
- **Committed in:** `b400edd9`

---

**Total deviations:** 5 (1 blocking test pin, 1 vocabulary-gate fix, 1 contract-prose update, 2 plan-wording adjustments).
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The first corpus run failed on three things. The `index.test.ts` pin and the vocabulary title are deviations 1 and 2. The third was `unused-type-member-gate.test.ts` failing with "Unexpected end of JSON input": the type-member gate exited 2 because four contract pins in `notification-dispatch.ts` and `notify-context.ts` had shifted. A difflib line map from `HEAD` moved them by line only, and the gate passed.
- `fallow audit` against the branch merge-base returns `warn`, which is the known advisory clones in the `*.messaging.ts` render maps. With `--base HEAD` it returns `pass` after each task: no dead code, no boundary violation, and no complexity finding in the 18 changed files.

## Verification

- Task 1 verify: the seven-file focused suite passes 454/454. Direct coverage passes for `notification-run.ts` (2/2 branches), `notification-dispatch.ts` (47/47), and `router.ts` (42/42). `node scripts/notify-corpus.mjs check` passes.
- Task 2 verify: the four-file focused suite passes 211/211, and the corpus check passes.
- `npm run test:coverage:direct -- --base HEAD`: "Direct coverage passed" for all 9 changed or paired production files, including `browse.ts` (37/37), `register.ts` (15/15), and `notify-context.ts` (19/19).
- Acceptance: `rg -n "openNotificationRun\(" extensions` finds one call site outside `notification-run.ts`, in `edge/register.ts`. `orchestrators/marketplace/list.ts` has no `readonly pi` and exactly one `readonly run: NotificationRun`. `rg -n "notification-run" extensions/pi-claude-marketplace/bridges` finds nothing. The only `\bpi\b` hits in the three info files are the `pi-api.ts` import paths; there is no `pi` parameter, field, or argument.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 7 extra`. Two of the extras are the new run-literal dispatch cases.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run lint:type-members`: pass.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7356/7356, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

The command root works end to end for the tracer slice. Plan 01-07 adds the second root, the `resources_discover` load pass in `index.ts`. After that, `openNotificationRun(` should appear only in `register.ts` and `index.ts`. Later plans move the remaining handlers from their factory `pi` to the run they already receive.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/notification-run.ts`, `tests/shared/notification-run.test.ts`, and `tests/shared/notification-run-seeds.ts` exist.
- Commits `cdb529c0` and `b400edd9` exist on `features/json`.

---
*Phase: 01-presentation-model*
*Completed: 2026-09-29*
