---
phase: 05-injection-and-ownership-design
plan: 16
subsystem: extension-lifecycle-ownership
tags: [hooks-runtime, import, child-mutations, transaction-boundary, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and runtime-bound HooksRouting capabilities from Plans 05-12 through 05-15
  - phase: 05-injection-and-ownership-design
    provides: production owner-bound install mutations from Plan 05-13
provides:
  - required lifecycle routing ownership for registered import execution
  - real production install children bound to the import operation's routing owner
  - repeated-import re-entry and peer-runtime isolation evidence
affects: [05-17-through-05-25, 05-27-through-05-32, plugin-import, plugin-install, hook-lifecycle]

actuals:
  tokens: 7545
  tasks: 2
  commits: 4
plan_head_before: be9f5c68571dc3910988aa722eecfef90ec191fb

tech-stack:
  added: []
  patterns:
    - exact consumer-owned HooksRouting capability passed from root registration
    - production import children created from the caller's required routing owner
    - fresh routing owners per isolated test and one shared owner only for a deliberate multi-call lifecycle

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
    - tests/edge/register.test.ts
    - tests/edge/handlers/plugin/import.test.ts
    - tests/orchestrators/import/execute.test.ts

key-decisions:
  - "Keep HooksRuntime out of EdgeDeps and pass import's exact required runtime-bound HooksRouting capability from root registration."
  - "Bind only the real production install child to lifecycle routing; marketplace add remains unchanged because it has no hook-route effect."
  - "Preserve the existing ImportDeps test seam without adding a child-operation bundle, fallback owner, or second lifecycle."

patterns-established:
  - "Import ownership: registration, handler, executor, and production install child share one required owner-bound HooksRouting value."
  - "Lifecycle test isolation: each independent invocation gets a fresh production runtime/routing pair; repeated calls share only when re-entry is the behavior under test."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered import forwards its exact lifecycle routing owner through unchanged parsing and public handler behavior."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/edge/register.test.ts#shares the supplied lifecycle routing owner with registered import execution"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/import.test.ts#forwards the supplied lifecycle routing owner into import execution"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for edge/register.ts and edge/handlers/plugin/import.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "A real production import install publishes routes only in the supplied owner and repeated import preserves exact re-entry behavior."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/import/execute.test.ts#resolves every collaborator from production when the caller supplies no dependency bundle"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for orchestrators/import/execute.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Import keeps real child order, durable state, configuration, results, notifications, and both composition exceptions unchanged."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/bootstrap.test.ts"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 16: Lifecycle-Owned Import Routing Summary

**Registered import now carries one root-bound routing owner into every route-relevant real production child, preserving import order, durable effects, aggregate outcomes, repeated-call re-entry, and peer-runtime isolation.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-08T03:39:08Z
- **Completed:** 2026-09-08T04:06:37Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Required edge registration and the import handler to forward the same root-bound lifecycle routing capability used by the other mutation handlers.
- Required import execution to carry that owner and create its real production install child with `createNodeInstallPlugin(hooksRouting)`.
- Preserved marketplace-before-plugin order, scope selection, validation, configuration and state changes, result aggregation, classifications, errors, warnings, rows, and notifications.
- Proved that a real imported hook route appears only in the owning runtime, an unrelated owner route remains exact, and a peer runtime remains byte-for-byte isolated.
- Proved repeated import re-entry with the same routing owner while retaining the complete production collaborator, configuration, and notification assertions.

## Task Commits

1. **Task 1 RED: Require import lifecycle routing owner** - `6448cf73` (test)
2. **Task 1 GREEN: Forward import routing owner** - `303b6edf` (feat)
3. **Task 2 RED: Require real import child routing** - `559f74b3` (test)
4. **Task 2 GREEN: Bind real import children to routing owner** - `87037425` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/register.ts` passes the registration's required routing owner to the import handler.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` requires `InstallHooksRouting`, forwards it in the real import options, and uses the shared error normalization boundary.
- `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` requires the routing owner and binds the default production install child to it.
- `tests/edge/register.test.ts` proves registered execution receives the exact owner supplied to registration.
- `tests/edge/handlers/plugin/import.test.ts` proves exact handler forwarding while retaining invalid, no-effect, partial, error, and notification coverage.
- `tests/orchestrators/import/execute.test.ts` proves real-child routing, repeated-call re-entry, unrelated-route preservation, peer isolation, and existing complete import outcomes.

The declared read/verify-only transaction lifecycle, reconcile apply, and bootstrap suites remained unchanged and passed. Marketplace add also remained unchanged because it does not consume or mutate hook routing. No completion-cache invalidation, reset removal, PID behavior, comment/message change, Phase 6 decomposition, optional/default overload, global owner, child-operation bundle, or Fallow suppression was added.

## Decisions Made

- `HooksRuntime` remains outside `EdgeDeps`, consistent with Plan 05-12 and D-11. Root registration supplies the already bound `HooksRouting` capability, and import narrows it to the real install consumer's required `InstallHooksRouting` contract.
- The production default install collaborator is resolved with `createNodeInstallPlugin(opts.hooksRouting)`. Existing explicitly injected test collaborators remain supported without becoming a new production composition exception.
- Independent import test cases construct fresh production runtime/routing pairs. Only the real two-import re-entry case shares one pair across calls, matching the lifecycle being proved.
- The shared `errorMessage` helper owns Error and non-Error normalization, eliminating a handler-local coverage seam without changing output bytes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Architecture boundary correction] Routed capabilities instead of HooksRuntime through the real consumer**

- **Found during:** Task 1 implementation against executed Plans 05-12 through 05-15
- **Issue:** The plan text says to pass `HooksRuntime` through import, but Plan 05-12 and D-11 deliberately keep bridge runtime types out of `EdgeDeps`; Plans 05-13 through 05-15 established the runtime-bound `HooksRouting` owner as the honest consumer boundary.
- **Fix:** Passed required `InstallHooksRouting` from root registration through the handler and executor to `createNodeInstallPlugin`. The root runtime remains required at its actual owner, with no fallback or duplicate lifetime.
- **Files modified:** `edge/register.ts`, `edge/handlers/plugin/import.ts`, `orchestrators/import/execute.ts`, and their paired owner tests
- **Commit:** `303b6edf`, `87037425`

**2. [Rule 3 - Coverage boundary] Removed a handler-local error-normalization branch**

- **Found during:** Task 1 direct coverage
- **Issue:** The handler-local Error/non-Error conditional retained a direct-coverage shortfall at a normalization concern already owned by the shared error helper.
- **Fix:** Reused `errorMessage` so normalization stays exact and the handler's own direct branch coverage is complete.
- **Files modified:** `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts`
- **Commit:** `303b6edf`

**3. [Rule 3 - Verification environment] Re-ran child-process gates outside the sandbox**

- **Found during:** Overall verification
- **Issue:** The sandbox denied deliberate nested process fixtures, causing the direct-coverage negative control and two unit file workers to fail without product assertions.
- **Fix:** Re-ran the identical negative control and complete unit suite with contained subprocess permission. The negative control passed, the two affected files passed 193/193, and the complete unit suite passed 5,437/5,437.
- **Files modified:** None
- **Commit:** None

## TDD Gate Compliance

- Task 1 RED proved both direct and registered handlers dropped the supplied lifecycle owner before production changes. `tdd-red-evidence` returned `RED_EVIDENCE_OK`; commit `6448cf73` contains only failing test changes.
- Task 1 GREEN required exact owner forwarding and preserved the handler's complete public outcomes. The exact tracer command, direct coverage gates, typecheck, and focused lint passed before commit `303b6edf`; the tracer feedback rerun passed end to end.
- Task 2 RED used the real production child path to prove the imported hook route was absent from the supplied owner while an unrelated owner route and peer runtime remained exact. `tdd-red-evidence` returned `RED_EVIDENCE_OK`; commit `559f74b3` contains only the failing executor test.
- Task 2 GREEN bound the real default install child to the supplied owner. The exact five-suite command, both direct coverage gates, typecheck, focused lint, and Fallow passed before commit `87037425`.

## Gate Results

- Task 1 exact suites passed: registration, direct import handler, and complete import executor.
- Task 2 exact suites passed: complete import executor, direct handler, transaction lifecycle cascade, reconcile apply, and bootstrap.
- Direct coverage passed for `edge/register.ts` at 15/15 branches, 9/9 functions, and 148/148 lines.
- Direct coverage passed for `edge/handlers/plugin/import.ts` at 11/11 branches, 2/2 functions, and 74/74 lines.
- Direct coverage passed for `orchestrators/import/execute.ts` at 149/149 branches, 34/34 functions, and 1,210/1,210 lines.
- TypeScript typecheck and focused/full ESLint passed.
- Fallow passed with `0 above threshold`; the required `scripts/revalidation.mjs:1124` comment remained byte-exact.
- Full unit suite passed: 5,437 tests, zero failures/skips/todos.
- Full integration suite passed: 13 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped at the known untracked `.mcp.json` Prettier exception. SHA-256 remained `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`. All later gates were run independently; corresponding and negative controls, full unit, and integration suites passed.

## Known Stubs

None. No placeholder values, TODO/FIXME markers, skipped tests, or unwired production paths were introduced.

## Next Phase Readiness

Plan 05-17 can apply the same exact lifecycle-owner capability pattern to plugin update. Completion-cache invalidation remains assigned to later Phase 5 plans, transition/reset cleanup remains deferred, and no Phase 6 ownership split was pulled forward.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All four measured RED/GREEN commits exist on the authorized feature branch.
- All six modified production/test files exist; no tracked deletion occurred.
