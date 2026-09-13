---
phase: 05-injection-and-ownership-design
plan: 15
subsystem: extension-lifecycle-ownership
tags: [hooks-runtime, uninstall, reconcile, transaction-boundary, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and runtime-bound HooksRouting capability from Plans 05-12 through 05-14
  - phase: 05-injection-and-ownership-design
    provides: cohesive uninstall transaction port from Plan 05-05
provides:
  - required lifecycle routing ownership for direct and reconciled uninstall
  - post-save full and partial hook-route removal with rollback isolation
  - real-child apply composition using the same routing owner
affects: [05-16-through-05-25, 05-27-through-05-32, plugin-uninstall, reconcile, hook-lifecycle]

actuals:
  tokens: 8623
  tasks: 2
  commits: 5
plan_head_before: 7ef8bb9e947b70bc0d8a7d0d9bc593eba5aeb2a9

tech-stack:
  added: []
  patterns:
    - exact consumer-owned HooksRouting capability passed from root registration
    - uninstall route effects scheduled only after durable state save
    - reconcile composes the real owner-bound child without an operation bundle

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - tests/edge/handlers/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "Keep HooksRuntime out of EdgeDeps and pass only uninstall's exact required runtime-bound HooksRouting operations."
  - "Remove full uninstall routes and hook-dropping partial routes only after the corresponding state save succeeds."
  - "Keep the cohesive UninstallTransaction separate from lifecycle routing and retain the transition export for unchanged legacy test surfaces until later reset cleanup."

patterns-established:
  - "Uninstall ownership: createNodeUninstallPlugin requires an exact HooksRouting subset with no optional, default, or global fallback on registered and reconcile paths."
  - "Durable route schedule: validation, config, cascade, and save failures retain routes; post-save routing failures cannot roll back committed state."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered uninstall removes target routes from the owning runtime while peer and unrelated routes remain exact."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/uninstall.test.ts#removes the project-scope record when the reference alone selects the plugin"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for edge/register.ts and edge/handlers/plugin/uninstall.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Full and hook-dropping partial uninstall route removal follows durable save, while AG-5 and rollback paths retain routes."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts#WR-03 and TR-03 lifecycle-owner cases"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "applyReconcile passes its routing owner to the real uninstall child and preserves complete apply behavior."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts#WR-06 declared-plugin removal and silent second pass"
        status: pass
      - kind: integration
        ref: "tests/integration/hooks-cross-scope-reconcile.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for orchestrators/plugin/uninstall.ts and orchestrators/reconcile/apply.ts"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 15: Lifecycle-Owned Uninstall Routing Summary

**Direct and reconciled uninstall now remove hook routes through the root lifecycle owner only after durable state commits, while preserving the cohesive transaction, rollback, cleanup, and exact public behavior.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-08T03:14:02Z
- **Completed:** 2026-09-08T03:34:20Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Required edge registration and the uninstall handler to pass the same runtime-bound routing capability already used by install and enable/disable.
- Removed routing mutation from the cohesive transaction port and scheduled it after durable save for successful removal and hook-dropping partial cascade.
- Preserved target validation, configuration-before-state order, partial-state folding, AG-5 abort, containment, retry, data cleanup, clone cleanup, results, rows, and notification bytes.
- Passed applyReconcile's required routing owner to the real uninstall child without adding a child-operation bundle or substitute.
- Proved target, unrelated, and peer-runtime isolation for direct and reconciled uninstall and contained post-save routing failures without changing committed state.

## Task Commits

1. **Task 1 RED: Require lifecycle-owned uninstall routes** - `c5ed5872` (test)
2. **Task 1 GREEN: Bind uninstall routes to lifecycle owner** - `5dbe4b57` (feat)
3. **Task 2 RED: Require reconcile uninstall owner routing** - `48f94521` (test)
4. **Task 2 GREEN: Share reconcile uninstall routing owner** - `fb2b8dda` (feat)
5. **REFACTOR: Format uninstall owner assertion** - `91b03a40` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/register.ts` passes the registration's required routing owner to uninstall.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts` requires the narrow routing port and creates the real owner-bound uninstall operation.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` separates lifecycle routes from the cohesive transaction port and removes eligible routes only after save.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` composes its real uninstall child with the apply routing owner.
- `tests/edge/handlers/plugin/uninstall.test.ts` proves registered handler target removal with unrelated and peer runtime isolation.
- `tests/orchestrators/plugin/uninstall.test.ts` proves full, partial, AG-5, and post-save routing-failure behavior alongside the existing exact transaction evidence.
- `tests/orchestrators/reconcile/apply.test.ts` proves real-child uninstall uses the apply owner and remains silent on the converged second pass.

The declared `tests/edge/register.test.ts` owner required no source change: its existing production registration helper already supplies one `createHooksRouting(createHooksRuntime())` owner, and direct coverage remained complete.

No completion-cache invalidation, reset removal, PID behavior, hook comment/message change, Phase 6 decomposition, optional/default overload, test-only seam, or Fallow suppression was added.

## Decisions Made

- `HooksRuntime` remains outside `EdgeDeps`, consistent with Plan 05-12/D-11. Direct and reconcile uninstall consume only `removePluginConfigFromCache` and `rebuildRoutingTables` through `UninstallHooksRouting`.
- `UninstallTransaction` remains cohesive and owns cascade, config, state, and post-commit cleanup semantics. Lifecycle routing is a separate required owner effect beside the transaction boundary.
- Full uninstall removes its target route after save. A partial cascade removes routes only when `dropped.hooks` proves hook material was removed and the shrunken record was saved.
- The transition `uninstallPlugin` export remains solely for unchanged legacy owner/integration tests pending the planned reset/public-surface cleanup. Registered and reconcile paths bypass it through `createNodeUninstallPlugin`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Architecture boundary correction] Routed capabilities instead of HooksRuntime through the real consumer**

- **Found during:** Task 1 implementation against executed Plans 05-12 through 05-14
- **Issue:** The plan text says to pass `HooksRuntime` through direct uninstall, but D-11 and Plan 05-12 keep bridge runtime types out of `EdgeDeps`; Plan 05-13 established the runtime-bound `HooksRouting` owner as the actual consumer boundary.
- **Fix:** Passed the exact required `Pick<HooksRouting, "removePluginConfigFromCache" | "rebuildRoutingTables">` from root registration and apply to uninstall. The runtime remains required at its real root owner, with no fallback or duplicate runtime.
- **Files modified:** `edge/register.ts`, `edge/handlers/plugin/uninstall.ts`, `orchestrators/plugin/uninstall.ts`, `orchestrators/reconcile/apply.ts`
- **Commit:** `5dbe4b57`, `fb2b8dda`

**2. [Rule 3 - Verification environment] Re-ran the negative coverage control with child-process permission**

- **Found during:** Overall verification
- **Issue:** The sandbox denied the gate's deliberate nested `spawnSync` probes with `EPERM`, leaving empty stderr and causing the harness assertion to fail.
- **Fix:** Re-ran the identical `npm run test:coverage:direct:negative` command with permission for its contained Node subprocesses; all negative controls passed.
- **Files modified:** None
- **Commit:** None

## TDD Gate Compliance

- Task 1 RED proved that a committed direct uninstall left the target route in the supplied owner runtime while unrelated and peer routes were isolated. `tdd-red-evidence` returned `RED_EVIDENCE_OK`; commit `c5ed5872` contains only the failing test.
- Task 1 GREEN required the exact routing owner and moved eligible route removal after save. The four exact tracer suites and all three direct coverage gates passed before commit `5dbe4b57`.
- Task 2 RED proved that applyReconcile's real uninstall child left the target route in apply's supplied owner. `tdd-red-evidence` returned `RED_EVIDENCE_OK`; commit `48f94521` contains only the failing test.
- Task 2 GREEN composed the real uninstall operation once from `opts.hooksRouting`. The Task 2 suites, both direct coverage gates, typecheck, focused lint, and Fallow passed before commit `fb2b8dda`.
- The refactor commit `91b03a40` contains formatting only; all final gates remained green afterward.

## Gate Results

- Task 1 exact suites passed: registration, direct handler, cohesive uninstall, and transaction lifecycle cascade.
- Task 2 exact suites passed: cohesive uninstall, complete apply owner, read-only cross-scope reconcile, and read-only bootstrap.
- Direct coverage passed at 100% branch/function/line coverage for all four changed production modules named by the plan.
- TypeScript typecheck and focused/full ESLint passed.
- Fallow passed with `0 above threshold`; the required `scripts/revalidation.mjs:1124` comment remained byte-exact.
- Full unit suite passed: 5,435 tests, zero failures/skips/todos.
- Full integration suite passed: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped at the known untracked `.mcp.json` Prettier exception. A standalone format check confirmed `.mcp.json` was the only flagged file; SHA-256 remained `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. All later gates were run independently; corresponding and negative controls, full unit, and integration suites passed.

## Known Stubs

None. No placeholder values, TODO/FIXME markers, skipped tests, or unwired production paths were introduced.

## Next Phase Readiness

Plan 05-16 can continue the same exact lifecycle-owner capability pattern. Completion-cache invalidation remains assigned to Plan 05-25, transition/reset cleanup to Plans 05-28 through 05-32, and uninstall decomposition remains Phase 6 work.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All five measured task/refactor commits exist on the authorized feature branch.
- All seven modified production/test files exist; no tracked deletion occurred.
