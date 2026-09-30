---
phase: 01-presentation-model
plan: 09
subsystem: notify
tags: [notify, presentation-model, notification-run, soft-dep-snapshot, marketplace-add, marketplace-autoupdate, bootstrap]

requires:
  - phase: 01-presentation-model
    provides: "01-06 command-root NotificationRun, SubcommandHandler (args, ctx, run), and the run seeds; 01-08 import and reconcile options carrying run beside the transitional pi"
provides:
  - "AddMarketplaceOptions.run: both add emissions render from the run"
  - "AutoupdateOptions.run: all four autoupdate emissions render from the run"
  - "BootstrapOptions.run with no pi: bootstrap hands its run to addMarketplace and setMarketplaceAutoupdate"
  - "makeAddHandler(deps), makeAutoupdateHandler(enable), and makeBootstrapHandler(deps) return SubcommandHandler and take no pi"
  - "import and reconcile hand their own run to the nested addMarketplace (D-07)"
affects: [01-10 install onto the run and deletion of ImportClaudeSettingsOptions.pi, 01-16 removal of the ToolInventory branch]

actuals:
  tokens: 35943
  tasks: 2
  commits: 2
plan_head_before: 46cd8c68377039068dec24509a094240bd670a96
plan_head_after: 9539c751219ef238fe2b72f81750d49b338f2463

tech-stack:
  added: []
  patterns:
    - "A composer that drives several nested orchestrators passes the same run to each, so one command renders from one soft-dependency snapshot"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
    - extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - scripts/check-unused-type-members.contracts.json
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/orchestrators/plugin/bootstrap.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/autoupdate.test.ts
    - tests/edge/handlers/plugin/bootstrap.test.ts
    - tests/orchestrators/import/execute.test.ts
    - tests/edge/register.test.ts
    - tests/index.test.ts
    - tests/architecture/config-state-consistency.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/integration/marketplace-add-seed-mirrors.test.ts
    - tests/integration/fold-adoption.test.ts

key-decisions:
  - "The add and autoupdate orchestrator suites and marketplace-add-seed-mirrors drop the strict pi mock: their boundaries return a run seed and have no tool inventory to probe"
  - "fold-adoption's shared context helper carries both pi and run; add reads run, while install and list still read pi until they migrate"
  - "Between the two tasks, the bootstrap suites stated three probes per autoupdate emission and none for the add; after the autoupdate move every bootstrap case states zero"

patterns-established:
  - "D-05 bootstrap: the router's run renders the add, the autoupdate flip, and the handler's own failed row"

requirements-completed: [PMOD-01]

coverage:
  - id: D1
    description: "marketplace add renders from the command run; the add handler takes no pi and its boundaries state zero tool probes; import, reconcile, and bootstrap hand their own run to the nested add"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/add.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#passes the marketplace add an options object that carries the git port only when the caller supplied one"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts#rebuilds completion rows through the cache that owns a successful registered add"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts#keeps hook routing and command completion state inside each extension-load owner graph"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
    human_judgment: false
  - id: D2
    description: "marketplace autoupdate/noautoupdate and bootstrap render from the command run; bootstrap shares one run with its two children and its own failed row; the handlers take no pi and state zero tool probes"
    requirement: PMOD-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/bootstrap.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/autoupdate.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/bootstrap.test.ts"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts#runs registered bootstrap through the supplied lifecycle cache and both real children"
        status: pass
      - kind: unit
        ref: "tests/architecture/cross-op-convergence.test.ts"
        status: pass
      - kind: unit
        ref: "tests/architecture/config-state-consistency.test.ts"
        status: pass
    human_judgment: false
  - id: D3
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

duration: 70min
completed: 2026-09-30
status: complete
---

# Phase 1 Plan 09: Marketplace Add, Autoupdate, and Bootstrap Notification Run Summary

**`marketplace add`, `marketplace autoupdate` / `noautoupdate`, and `bootstrap` render from the command's notification run, and every composer that drives add or autoupdate hands it its own run.**

## Performance

- **Duration:** 70 min
- **Started:** 2026-09-30T00:24:33Z
- **Completed:** 2026-09-30T01:34:46Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments

- `AddMarketplaceOptions` carries `readonly run: NotificationRun` in place of `pi`. Both add emissions call `notifyWithContext(opts.ctx, opts.run, ADD_CONTEXT, ...)`.
- `AutoupdateOptions` carries `run` in place of `pi`. All four autoupdate emissions, including the not-added row, read `opts.run`.
- `BootstrapOptions` has `run` and no `pi`. It passes `run: opts.run` to `addMarketplace` and `setMarketplaceAutoupdate`.
- `makeAddHandler(deps)`, `makeAutoupdateHandler(enable)`, and `makeBootstrapHandler(deps)` return `SubcommandHandler` and forward the router's run. The bootstrap handler's own failed row calls `notify(ctx, run, ...)`. So one run renders the add, the flip, and the failure (D-05). `register.ts` calls all three without `pi`.
- `importClaudeSettings` and `applyReconcile` pass `run: opts.run` to the nested `addMarketplace` (D-07). The `ImportClaudeSettingsOptions.pi` and `ApplyReconcileOptions.pi` docs no longer list add among the forwards.

## Task Commits

1. **Task 1: `marketplace add` renders from the run, and every composer hands add its run** - `ebc8230c` (refactor)
2. **Task 2: autoupdate and bootstrap render from the run** - `9539c751` (refactor)

## Probe Pins Restated

- `add.test.ts` (orchestrator): `makeCtx` no longer builds a `pi`. It returns `runWithNothingLoaded()`.
- `add.test.ts` (handler): the delegating cases move from 3 to 0 probes.
- `autoupdate.test.ts` (orchestrator): the boundary drops the strict `pi`. The 24 cases pass `boundary.run`.
- `autoupdate.test.ts` (handler): the delegating cases move from 3 to 0 probes.
- `bootstrap.test.ts` (orchestrator): the counts were (2, 6), (3, 9), and (1, 3). After Task 1 they were (2, 3), (3, 6), and (1, 3). After Task 2 every count is 0.
- `bootstrap.test.ts` (handler): the delegating case moves from 6 to 3 to 0 probes, and the failure case moves from 3 to 0.
- `register.test.ts`: the registered add case moves from `probingEmissions: 1` to `0`. The registered bootstrap case moves from 2 to 1 to 0. The one run is the only probe in both.
- `index.test.ts`: the owner-graph case, which drives a registered `marketplace add`, moves from 6 tool reads to 3.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale probe pin] `tests/index.test.ts` pinned the add emission's probe**
- **Found during:** Task 1 (the corpus check runs the whole suite)
- **Issue:** The owner-graph case stated 6 tool reads: three for the run and three for the add emission. The add now renders from the run. The file is not in the plan's list.
- **Fix:** The case states 3 reads, and its comment says the run is the only probe.
- **Committed in:** `ebc8230c`

**2. [Rule 2 - Stale contract prose] `ApplyReconcileOptions.pi` listed add among its forwards**
- **Found during:** Task 1
- **Issue:** `orchestrators/reconcile/types.ts` said the inventory is forwarded to the nested add. The file is not in the plan's list.
- **Fix:** The doc lists uninstall, install, enable, and backfill. It says reconcile's own emission and the nested add and remove read `run`.
- **Committed in:** `ebc8230c`

**3. [Plan inventory] `apply.test.ts` needed no change**
- **Found during:** Task 1
- **Issue:** The suite has no case that asserts the options handed to an injected `addMarketplace`.
- **Fix:** None. The suite passes unchanged in the focused run.

---

**Total deviations:** 3 (1 stale probe pin and 1 contract-prose update outside the file list, 1 plan-inventory correction).
**Impact on plan:** No scope change. The corpus, the catalog, and `npm run check` show no byte change.

## Issues Encountered

- The `add.ts` type-member pins (`539:9`, `539:35`, `539:52`) moved to line 542 after the new `run` doc. The pins moved by line only, and the gate passed.
- The first corpus check after Task 1 failed on `tests/index.test.ts` (deviation 1). The re-run passed.
- `fallow audit --base HEAD` before the Task 1 commit returned `warn`. It reported one clone between `edge/handlers/plugin/bootstrap.ts` and `edge/handlers/plugin/import.ts`, marked `introduced`. This is the same clone family (`dup:...6f87acd9`) that the plan 01-08 summary records as pre-existing. The handler signature change moved the clone start. The audit before the Task 2 commit returned `pass` and marked the clone inherited.

## Verification

- Task 1 verify: the focused suite (marketplace `add` orchestrator and handler, `import/execute`, `reconcile/apply`, plugin `bootstrap` orchestrator and handler, `register`, `config-state-consistency`) passed 364/364. `npm run test:integration` passed 36/36. The corpus check passed.
- Task 2 verify: the focused suite (marketplace `autoupdate` orchestrator and handler, plugin `bootstrap` orchestrator and handler, `register`, `cross-op-convergence`, `config-state-consistency`) passed 227/227. The corpus check passed.
- Acceptance: `rg -n "readonly pi"` over `add.ts` and `autoupdate.ts` prints nothing. No `addMarketplace({` call site in `extensions/` passes a `pi:` key. The only `\bpi\b` hit in the two bootstrap files is the `pi-api.ts` module path. It is not a parameter, a field, or an argument.
- Pre-commit on each task's files passed every hook, including typecheck, lint, fallow, direct coverage on changed pairs, and the type-member gates.
- `node scripts/notify-corpus.mjs check`: `2622 baseline entries present, 7 extra` (the same 7 extras as after plan 01-08).
- `git diff --exit-code 2f173031 -- docs/output-catalog.md`: empty.
- `npm run check`, unpiped and logged: `CHECK_EXIT=0`. Unit 7356/7356, integration 36/36.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

- Ready for 01-10. `ImportClaudeSettingsOptions.pi` is now only the forward to install. `ApplyReconcileOptions.pi` is only the forward to uninstall, install, enable, and backfill.

## Self-Check: PASSED

- Commits `ebc8230c` and `9539c751` exist on `features/json`.
- Every modified file listed above is in the combined diff from `46cd8c68`.
