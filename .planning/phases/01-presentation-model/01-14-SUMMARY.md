---
phase: 01-presentation-model
plan: 14
subsystem: notify
status: complete
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, plugin-list, plugin-info, browse, llm-tools]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun and SubcommandHandler (args, ctx, run); 01-07 withParsedArgs forwards the run; 01-13 every other /claude:plugin verb renders from the run"
provides:
  - "PluginListPayloadOptions (ctx, cwd, narrowing and filter fields, no run) for loadPluginListPayload and its payload-side helpers"
  - "ListPluginsOptions extends PluginListPayloadOptions with readonly run: NotificationRun; listPlugins emits both arms from it"
  - "GetPluginInfoOptions.run: the single block, the multi-block fan-out, the fetch-skip rows, and the failure loop render from one snapshot per command"
  - "Signatures without pi: loadToolPluginPayload(params, ctx, buckets), makePluginLoader(ctx, cwd), makeBrowseHandler(handlers), makeListHandler(), makePluginInfoHandler()"
  - "No edge handler factory takes pi; only the tool registrars and skill-alias-state.ts still declare one"
affects: [01-15, 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 54157
  tasks: 2
  commits: 2
plan_head_before: ff3aee35a0b3f1e94d578ab87ee7f95341e9dc2a
plan_head_after: 4bca096c64cbec8c195a2197b07190f0ce263be0

tech-stack:
  added: []
  patterns:
    - "A read-only payload builder takes an options type without a run; the notifying entrypoint extends it with the run, so callers that never notify cannot construct one"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/plugin/list-flow.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/operations.test.ts
    - tests/edge/handlers/plugin/list.test.ts
    - tests/edge/handlers/plugin/info.test.ts
    - tests/edge/handlers/plugin/browse.test.ts
    - tests/integration/fold-adoption.test.ts
    - tests/architecture/workflows-marker-coverage.test.ts
    - tests/architecture/cross-op-convergence.test.ts

key-decisions:
  - "list-flow.ts splits its options: PluginListPayloadOptions carries no run, and ListPluginsOptions extends it with run, so the LLM list tool and the browser's plugin loader build payloads without constructing a run (D-05, IL-2)"
  - "Browse's own failure and empty rows render from the router's run; its plugin loader only reads and takes neither pi nor a run"
  - "GetPluginInfoOptions.run replaces pi; info surfaces carry no markers, and the run keeps the fan-out and the failure loop on one snapshot per command (D-05 multi-emission)"
  - "The list-flow WDEP-02 decoy case now seeds an engine-absent snapshot; the `workflow` decoy discriminator stays proven in tests/platform/pi-api.test.ts and at the notify surfaces in workflows-marker-coverage"

patterns-established:
  - "D-05 at the edge is complete for /claude:plugin: every handler factory forwards the router's run, and none takes pi"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "Plugin list renders both emission arms from the command run; the list handler takes no pi and forwards the router's run"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list-flow.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/list.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/workflows-marker-coverage.test.ts"
        status: pass
      - kind: integration
        ref: "tests/integration/fold-adoption.test.ts (npm run test:integration 36/36)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The LLM list tool and the browser's plugin loader build list payloads with no pi and no run; the tool path reads no tool inventory (T-01-24)"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/browse.test.ts"
        status: pass
      - kind: other
        ref: "rg -n 'loadPluginListPayload\\(\\{' -A2 extensions/pi-claude-marketplace/edge (no pi key)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plugin info renders every block, the fan-out, the fetch-skip rows, and the failure loop from the command run; no edge handler or orchestrator outside the tool registrar and skill-alias-state.ts declares or forwards pi"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/info.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-op-convergence.test.ts"
        status: pass
      - kind: other
        ref: "plan pi-forwarding rg gate (empty output)"
        status: pass
      - kind: other
        ref: "node scripts/notify-corpus.mjs check (2622 baseline entries present, 10 extra); git diff --exit-code 2f173031 -- docs/output-catalog.md (empty); npm run check (CHECK_EXIT=0)"
        status: pass
    human_judgment: false

duration: 77 min
completed: 2026-09-30
---

# Phase 01 Plan 14: List and Info on the Command Run Summary

**Plugin list, plugin info, and browse's own rows render from the command run, and the LLM list tool and the browser's plugin loader build payloads through a run-free `PluginListPayloadOptions`, so no edge handler factory takes `pi` any more (D-05).**

## Performance

- **Duration:** 77 min
- **Started:** 2026-09-30T14:30:37Z
- **Completed:** 2026-09-30T15:47:46Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- `list-flow.ts` splits its options. `PluginListPayloadOptions` holds `ctx`, `cwd`, and the narrowing and filter fields. `ListPluginsOptions` extends it with `run`. `loadPluginListPayload`, `filtersPassive`, `shouldShow`, `enumerateMarketplacePlugins`, `computeOrphanFold`, and `buildMarketplaceMessage` take the payload options. `listPlugins` emits both arms with `run`.
- `loadToolPluginPayload(params, ctx, buckets)` calls `loadPluginListPayload` with no `pi` and no run. `registerListPluginsTool(pi)` keeps `pi` only for `registerTool`.
- `makePluginLoader(ctx, cwd)` and `makeBrowseHandler(handlers)` take no `pi`. Browse's two own emissions render from the run its handler receives.
- `makeListHandler()` and `makePluginInfoHandler()` take no `pi` and forward the router's run through `withParsedArgs`.
- `GetPluginInfoOptions.run` replaces `pi`. All six emissions pass `opts.run`: the marketplace-not-added row, the single block, the fetch-skip rows, the fan-out single survivor and cascade, and the failure loop.

## Task Commits

1. **Task 1: plugin list renders from the run, and the payload builder needs no run** - `e5024f95` (refactor)
2. **Task 2: plugin info renders every block from the run** - `4bca096c` (refactor)

## Files Created/Modified

- `orchestrators/plugin/list-flow.ts` - `PluginListPayloadOptions`, `ListPluginsOptions.run`, header and entrypoint prose restated
- `orchestrators/plugin/info.ts` - `GetPluginInfoOptions.run`, field doc restated
- `edge/handlers/plugin/list.ts`, `edge/handlers/plugin/info.ts` - no `pi`; the `withParsedArgs` callback takes `(parsed, ctx, run)`
- `edge/handlers/plugin/browse.ts` - loader and factory take no `pi`; own rows render from the run
- `edge/handlers/tools.ts` - the list payload loader takes no `pi`
- `edge/register.ts` - the list, info, and browse factories are built without `pi`
- `scripts/check-unused-type-members.contracts.json` - line-only repins
- Tests: list-flow, info, the list, info, and browse handlers, operations, cross-op-convergence, fold-adoption, and workflows-marker-coverage pass a run seed or, for the payload path, no run. Every strict boundary states 0 tool probes.

## Decisions Made

- The payload options carry no run. The type forbids a run on the tool and loader paths, which never notify, so T-01-24 holds by construction.
- `list-flow.test.ts`'s `makeCtx` takes `softDeps?: Partial<SoftDepStatus>` over an all-unloaded seed, as update-flow and reinstall-flow do. The `workflow_control` case became `workflowEngineLoaded: true`. Its helper comment states that the orchestrator reads the run and never probes, so no `pi` double exists.
- The two WDEP-02 list cases used the decoy tool `workflow`. They now seed an engine-absent snapshot. The decoy discriminator is still proven in `tests/platform/pi-api.test.ts`, and through `notify` in `workflows-marker-coverage.test.ts`, whose header now says which surfaces probe and which read the run.
- `cross-op-convergence.test.ts`'s `Invoker` env has no `pi`. Every op there now renders from the run, so its doc says so, and its context literal no longer carries a stray `pi` member.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two suites outside Task 2's list passed `pi` to `getPluginInfo`**

- **Found during:** Task 2 (typecheck)
- **Issue:** `tests/orchestrators/plugin/operations.test.ts` (the bound-reader info case) and `tests/architecture/cross-op-convergence.test.ts` (the `info` invoker) built `pi` and passed it.
- **Fix:** Both pass the run their harness already held. The operations `makeCtx` and the convergence `makeCtx` no longer return a tool inventory, and the orphaned `ToolInventory` imports are gone.
- **Files modified:** the two test files
- **Verification:** both suites pass in the Task 2 focused run (345/345), and `npm run check` exits 0.
- **Committed in:** `4bca096c`

**2. [Rule 3 - Blocking] Type-member contract pins moved**

- **Found during:** Task 1 and Task 2 (`lint:type-members`)
- **Issue:** The new `NotificationRun` imports and the shorter `tools.ts` doc shifted pins: list-flow.ts 87 to 88 and 626 to 634, tools.ts 385 to 379, 386 to 380, and 472 to 466, and info.ts 1351 to 1352.
- **Fix:** Line-only repins, mapped from HEAD with a line diff after Prettier ran.
- **Verification:** `npm run lint:type-members` passes with the 4 recorded exceptions. It confirms `ListPluginsOptions.run` and `GetPluginInfoOptions.run` are read.
- **Committed in:** `e5024f95`, `4bca096c`

**3. [Plan inventory] Two listed suites needed no change**

- `tests/edge/register.test.ts` has no successful list, info, or browse case. Its list, info, and browse cases are argument rejections, which already state `{ runs: 1, probingEmissions: 0 }`. It passes unchanged.
- `tests/edge/handlers/tools.test.ts` already states no `getAllTools()` expectation, which proves the tools neither notify nor probe. It passes unchanged.

---

**Total deviations:** 2 auto-fixed (both blocking), plus 1 inventory note.
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- `fallow audit` returned `warn` before Task 1. The findings are the accepted clone family `dup:c77b3abb6f87acd9` and the messaging render maps, over the whole branch against `origin/main`. None is in this plan's files. There were no dead-code or complexity findings.
- A `grep "missing in\|refused:"` over the corpus log matched 4 lines. All 4 are test titles ("non-missing index", "missing installed", "missing intermediate"). No line starts with `missing in `, and none says `refused:`.

## Verification

- Task 1 verify: the six-suite focused run passed 333/333, before and after the commit (tracer gate). `npm run test:integration` passed 36/36. The corpus check passed.
- Task 1 acceptance: `rg -n "loadPluginListPayload\(\{" -A2 extensions/pi-claude-marketplace/edge` shows no `pi` key in tools.ts or browse.ts. `rg -n "readonly pi" list-flow.ts` prints nothing.
- Task 2 verify: the info, handler, register, cross-op-convergence, and operations suites passed 345/345. The plan's `pi`-forwarding `rg` gate printed nothing. `rg -n "readonly pi" info.ts` prints nothing.
- Direct coverage at 100% for `list-flow.ts`, `edge/handlers/plugin/list.ts`, `browse.ts`, and `tools.ts`. Pre-commit's changed-pairs coverage hook passed for Task 2's pairs.
- Pre-commit on each task's files passed every hook (`SKIP=trufflehog`), with no file rewritten.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 10 extra`. The extras are the same 10 as after 01-13.
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7359/7359, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-24 is mitigated as planned. `loadPluginListPayload` takes `PluginListPayloadOptions`, which has no run, so the tool path cannot emit. `tools.test.ts` pins the tool results with no `getAllTools()` expectation, and `registerListPluginsTool` keeps its read-only contract. T-01-SC: no package was installed.

## Next Phase Readiness

- Ready for 01-15. Every `/claude:plugin` surface renders from the command run, and no edge handler factory takes `pi`.
- The notify family still accepts `NotificationRun | ToolInventory`. `workflows-marker-coverage.test.ts`'s `renderThroughNotify` is a remaining inventory caller. 01-16 removes that branch.

## Self-Check: PASSED

- Commits `e5024f95` and `4bca096c` exist on `features/json`.
- All 17 modified files listed above are in `git diff --name-only ff3aee35..4bca096c`.
