---
phase: 05-injection-and-ownership-design
plan: 13
subsystem: extension-lifecycle-ownership
tags: [hooks-runtime, install-transaction, reconcile, lifecycle-isolation, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and honest consumer boundary from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: classified install transaction and full-observation reconcile composition from Plans 05-04 and 05-05
provides:
  - runtime-bound hook-routing operations for direct and reconciled plugin installs
  - post-save route publication and removal against the owning HooksRuntime only
  - required reconcile routing ownership with peer-runtime isolation
affects: [05-14-through-05-25, 05-27-through-05-32, plugin-install, reconcile, hook-lifecycle]

actuals:
  tokens: 11014
  tasks: 2
  commits: 5
plan_head_before: 15eb4dc82f11f238a0e3eea451ca91bbb1db446c

tech-stack:
  added: []
  patterns:
    - runtime-bound routing capability created beside the root-owned HooksRuntime
    - required narrow install port shared by direct edge and real reconcile children
    - route mutation follows durable state publication rather than pre-save intent

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/bridges/hooks/index.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
    - tests/bridges/hooks/event-router.test.ts
    - tests/e2e/import-command.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/register.test.ts
    - tests/index.test.ts
    - tests/integration/hooks-cross-scope-reconcile.test.ts
    - tests/integration/load-reconcile-race-child.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/orchestrators/reconcile/types.test.ts

key-decisions:
  - "Keep HooksRuntime out of EdgeDeps and expose only runtime-bound routing operations from the hooks bridge."
  - "Create one hooks-routing capability from the root runtime, then require that same capability at direct registration and reconcile apply boundaries."
  - "Publish disabled-route removal only after the state transaction saves, matching the durable-state boundary used for newly installed routes."

patterns-established:
  - "Lifecycle routing ownership: createHooksRouting(runtime) closes every cache/read/rebuild operation over one HooksRuntime identity."
  - "Reconcile ownership: ApplyReconcileOptions requires InstallHooksRouting, and each real install child is created from that exact port."

requirements-completed: []

coverage:
  - id: D1
    description: "A registered direct install receives required runtime-bound routing operations and publishes routes only after durable success."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/install.test.ts; tests/orchestrators/plugin/install.test.ts; tests/edge/register.test.ts"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The root creates routing operations from its one HooksRuntime and peer runtime route tables remain isolated."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/event-router.test.ts; tests/index.test.ts"
        status: pass
      - kind: other
        ref: "100% direct branch, function, and line coverage for event-router.ts and index.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real reconcile installs share the registered routing owner while full apply outcomes and sibling scope behavior remain unchanged."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts; tests/orchestrators/plugin/install.test.ts"
        status: pass
      - kind: integration
        ref: "tests/integration/hooks-cross-scope-reconcile.test.ts; npm run test:integration"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 13: Runtime-Bound Install and Reconcile Routing Summary

**Direct and reconciled installs now publish hook routes through one root-owned runtime capability at the durable commit boundary, preserving rollback behavior and isolating peer runtimes.**

## Performance

- **Duration:** 31 min
- **Started:** 2026-09-08T02:04:45Z
- **Completed:** 2026-09-08T02:35:39Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Added `createHooksRouting(runtime)`, a production capability whose read/cache/remove/rebuild operations close over exactly one `HooksRuntime`.
- Bound that capability once in the extension root and passed it as a required value through edge registration, direct install, resources-discover reconciliation, and every real reconcile install child.
- Kept `HooksRuntime` out of `EdgeDeps`; no optional field, default factory, global fallback, test-only seam, or second runtime was introduced on the migrated path.
- Made successful hook installs visible only in their owner runtime and proved a peer runtime remains cold.
- Preserved transaction prepare, replace, compensation, abort, save, rollback, finalization, cleanup, error identity, public results, state trees, ordering, silence, and notification behavior.
- Moved disabled-route removal after `tx.save()` so a pre-save failure cannot make runtime routes diverge from durable state.
- Preserved the legacy transition install export for later unmigrated callers without using it on registered or reconcile paths.

## Task Commits

1. **Task 1 RED: Require runtime-bound direct install routing** - `5ec880fc` (test)
2. **Task 1 GREEN: Bind direct install routing to the lifecycle runtime** - `ccdff26b` (feat)
3. **Task 2 RED: Require reconcile install runtime ownership** - `b6fb2fb5` (test)
4. **Task 2 GREEN: Share lifecycle routing with reconcile installs** - `a133a0ae` (feat)
5. **Plan cleanup: Normalize lifecycle routing formatting** - `b1582cf2` (style)

## Files Created/Modified

- `bridges/hooks/event-router.ts` and its barrel export provide the runtime-bound routing capability while retaining the existing transition functions for later migration plans.
- `edge/register.ts` and `edge/handlers/plugin/install.ts` require and forward the narrow install routing port into the real install factory.
- `orchestrators/plugin/install.ts` requires routing operations in its transaction factory, publishes added routes after save, and removes disabled routes only after save.
- `index.ts` constructs routing operations from the same runtime used for hydration and passes them to registration and post-hydration reconcile.
- `orchestrators/reconcile/types.ts` and `apply.ts` require the routing port and create each real install child from it without replacing sibling children or the narrow state reader.
- Direct, owner, integration, E2E, race-child, backfill, and type fixtures use production runtime/routing factories with fresh ownership per isolated case and shared ownership only for intentional multi-call lifecycles.

No completion-cache invalidation, reset removal, PID change, hook message change, Phase 6 work, new Fallow suppression, optional compatibility overload, or child-operation bundle was added.

## Decisions Made

- Runtime ownership stays at the real bridge consumer boundary. `HooksRuntime` remains absent from `EdgeDeps`; callers receive only the exact hook-routing operations they consume.
- Direct and reconcile installation use the same required `InstallHooksRouting` contract, created once from the root runtime. This makes identity explicit without widening the semantic transaction port.
- Runtime removal follows durable publication. Disabled hook routes are removed only after `tx.save()` succeeds, while failed/rolled-back work leaves the pre-existing owner routes exact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Architecture boundary correction] Added the runtime-bound routing owner at the real hooks consumer**

- **Found during:** Task 1 design against the executed Plan 05-12 boundary
- **Issue:** The plan described forwarding `HooksRuntime` through edge/install options, but Plan 05-12 and D-11 intentionally keep bridge-owned runtime types out of `EdgeDeps`. Following the literal route would reintroduce a dead, forbidden edge dependency.
- **Fix:** Added the smallest production `createHooksRouting(runtime)` capability in the hooks bridge, exported it through the bridge barrel, bound it beside root hydration, and required the resulting operations in registration and install. The root and event-router owner tests prove identity and peer isolation.
- **Files modified beyond frontmatter:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `extensions/pi-claude-marketplace/bridges/hooks/index.ts`, `extensions/pi-claude-marketplace/index.ts`, `tests/bridges/hooks/event-router.test.ts`, `tests/index.test.ts`, `tests/edge/register.test.ts`, `tests/e2e/import-command.test.ts`
- **Committed in:** `5ec880fc`, `ccdff26b`

**2. [Rule 1 - Durable-state route agreement] Delayed disabled-route removal until save succeeds**

- **Found during:** Task 1 GREEN rollback review
- **Issue:** Removing disabled routes before `tx.save()` could leave the owner runtime inconsistent with persisted state when save failed.
- **Fix:** Recorded whether the partial hook cascade dropped routes, then removed/rebuilt them only after successful save. Added direct failure evidence without changing compensation, cleanup, or error projection.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`, `tests/orchestrators/plugin/install.test.ts`
- **Committed in:** `ccdff26b`

**3. [Rule 3 - Required caller propagation] Migrated direct reconcile callers omitted from plan frontmatter**

- **Found during:** Task 2 required `ApplyReconcileOptions` propagation
- **Issue:** Making hook routing required exposed direct test/integration callers that could not compile without an owner. An optional/default field would have hidden the lifecycle identity the plan requires.
- **Fix:** Supplied production routing owners in each direct caller: fresh per isolated case, shared only across intentional multi-call lifecycles. Assertions and behavior stayed unchanged.
- **Files modified beyond frontmatter:** `extensions/pi-claude-marketplace/index.ts`, `tests/integration/hooks-cross-scope-reconcile.test.ts`, `tests/integration/load-reconcile-race-child.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/reconcile/backfill.test.ts`, `tests/orchestrators/reconcile/types.test.ts`
- **Committed in:** `b6fb2fb5`, `a133a0ae`

**4. [Rule 3 - Verification formatting] Normalized four owned files reported by the repository formatter**

- **Found during:** Overall `npm run check`
- **Issue:** Prettier reported four Plan 05-13 files in addition to the known `.mcp.json` exception.
- **Fix:** Ran Prettier only on the four owned files and committed the mechanical output separately. `.mcp.json` remained byte-identical.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts`, `extensions/pi-claude-marketplace/index.ts`, `tests/edge/handlers/plugin/install.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`
- **Committed in:** `b1582cf2`

---

**Total deviations:** 4 auto-fixed issues (one Rule 1, three Rule 3).
**Impact on plan:** The architecture correction enforces the Plan 05-12/D-11 boundary while keeping one required production owner. Caller propagation and formatting are mechanical. No lifecycle contract was weakened or later cleanup work pulled forward.

## Issues Encountered

- `npm run check` passed typecheck, full ESLint, and Fallow, then stopped at `format:check`. After owned-file formatting, only the known untracked `.mcp.json` remains unformatted. It stayed byte-identical at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`; all later gates ran independently.
- Sandbox policy initially denied child-process spawn and Unix-domain-socket operations in the direct-coverage negative control and two unit files. Their approved process-capable reruns passed, including the complete unit suite.

## Validation Results

- Both exact task suite groups passed, including direct install transaction lifecycle, registered ownership, reconcile apply, cross-scope reconcile, and bootstrap behavior.
- Direct coverage passed at 100% for all plan-changed source pairs: event router, root composition, edge registration/install handler, install orchestrator, reconcile apply, and reconcile option types.
- Typecheck, repository ESLint, Fallow (`0 above threshold`), corresponding-test checks, and both negative-control gates passed.
- The full unit suite passed all 5,429 tests; the full integration suite passed all 32 tests; the changed import-command E2E helper passed all 3 tests.
- Plan-owned files pass Prettier. Only `.mcp.json` retains the documented pre-existing formatting exception and its original bytes.
- No exact Fallow suppression was added, removed, or altered; the plan-named comment was absent at both the plan base and final HEAD.

## TDD Gate Compliance

- Task 1 RED asserted required owner routing and two-runtime isolation before the production factory existed. `tdd-red-evidence` returned `RED_EVIDENCE_OK`; commit `5ec880fc` contains only the failing evidence.
- Task 1 GREEN passed its exact owner suites, transaction cascade, direct coverage, typecheck, and ESLint before the tracer feedback gate completed.
- Task 2 RED used the real reconcile install path and failed because the owner runtime had no installed route while its peer remained empty. `tdd-red-evidence` returned `RED_EVIDENCE_OK`; commit `b6fb2fb5` contains the failing evidence.
- Task 2 GREEN passed the exact apply/cross-scope/bootstrap/install suites, direct coverage, typecheck, ESLint, and Fallow.

## Known Stubs

None. No TODO, FIXME, placeholder production path, skipped test, or unwired component was added. The existing `placeholderCtx` test fixture remains a fully wired context double and is not a production stub.

## Deferred Issues

None.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

Plans 05-14 through 05-25 can inject the same root-owned lifecycle capabilities into the remaining mutation owners. Plan 05-22 still owns completion invalidation; Plans 05-28 through 05-32 retain transition/reset removal, and Phase 6 retains structural decomposition.

## Self-Check: PASSED

- All 20 changed implementation, test, integration, E2E, and helper artifacts exist.
- All five measured plan commits exist from ledger base `15eb4dc82f11f238a0e3eea451ca91bbb1db446c`.
- Full verification, diff whitespace checks, `.mcp.json` byte identity, runtime ownership, and required direct/reconcile routing claims match the final tree; no tracked file was deleted.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-08_
