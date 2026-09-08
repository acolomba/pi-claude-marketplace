---
phase: 05-injection-and-ownership-design
plan: 17
subsystem: extension-lifecycle-ownership
tags: [hooks-runtime, plugin-update, cascade, transaction-boundary, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and exact runtime-bound HooksRouting capabilities from Plans 05-12 through 05-16
provides:
  - one root-owned update-operations factory bound to the extension lifecycle's HooksRouting owner
  - exact full direct/bulk update operation and locked narrow PluginUpdateFn cascade operation sharing one implementation owner
  - durable-boundary route refresh with direct, cascade, re-entry, and peer-isolation evidence
affects: [05-18-through-05-25, plugin-update, marketplace-update, autoupdate, hook-lifecycle]

actuals:
  tokens: 9820
  tasks: 2
  commits: 4
plan_head_before: 091d858db541f4c3bb269ed3dbfe030b08ce4a44

tech-stack:
  added: []
  patterns:
    - root-owned factory returns exact consumer-specific operations bound to one HooksRouting owner
    - direct route visibility follows successful durable state save
    - fresh routing owners per isolated test and one shared owner only for deliberate multi-call lifecycle evidence

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts

key-decisions:
  - "Correct the plan's incompatible single-PluginUpdateFn assumption with one factory that returns the full direct/bulk operation and the unchanged narrow cascade callback from the same bound owner."
  - "Keep HooksRuntime out of EdgeDeps; bind HooksRouting once at the extension root and pass only each consumer's exact required operation."
  - "Publish refreshed hook routes only after withStateGuard completes its durable auto-save, so state/config write failures cannot expose uncommitted routes."

patterns-established:
  - "Dual-port lifecycle owner: one factory may expose multiple exact operation shapes when all operations close over the same owner and implementation."
  - "Update test isolation: direct and cascade calls share a runtime only when the test intentionally proves one lifecycle; peers remain independent."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered direct and all-target update commands forward their complete option object to the required root-owned direct update operation."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/update.test.ts#forwards the exact direct update request through the required update operation"
        status: pass
      - kind: unit
        ref: "tests/index.test.ts and tests/edge/register.test.ts"
        status: pass
      - kind: other
        ref: "direct coverage gates for index.ts, edge/register.ts, and edge/handlers/plugin/update.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Successful direct and cascade updates refresh routes in one lifecycle owner only after durable state succeeds, with repeated-call re-entry and peer isolation."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#WR-03: one update owner refreshes direct and cascade routes without leaking to a peer runtime"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/plugin/update.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Marketplace and autoupdate cascades retain the locked PluginUpdateFn shape, target order, classifications, cleanup, rows, warnings, and notifications."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts and tests/architecture/cross-op-convergence.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/marketplace/update.ts"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 17: Lifecycle-Owned Update Operations Summary

**One root-owned update-operations factory now binds complete direct/bulk updates and the locked cascade callback to the same hook-routing lifecycle, with route visibility following durable state.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-09-08T04:10:33Z
- **Completed:** 2026-09-08T04:43:06Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added `createPluginUpdateOperations(hooksRouting)`, which returns the full `UpdatePluginsFn` used by direct/all-target commands and the unchanged narrow `PluginUpdateFn` used by marketplace and autoupdate cascades.
- Constructed that operations owner once beside the root-owned hooks runtime/routing pair, passed only the direct operation through registration/handler, and retained only the cascade callback in `EdgeDeps`.
- Replaced plugin update's raw bridge routing calls with the exact supplied `UpdateHooksRouting` capability and moved successful route publication after the state guard's durable auto-save.
- Proved exact handler forwarding, direct-to-cascade owner identity, repeated-call route replacement, unrelated-route preservation, and complete peer-runtime isolation.
- Preserved update target ordering, scope precedence, transaction compensation, rollback, cleanup, outcomes, error classification, rows, warnings, and notifications across the complete unit and integration suites.

## Task Commits

1. **Task 1 RED: Require exact direct update operation forwarding** - `8ae83a08` (test)
2. **Task 1 GREEN: Bind update operations to lifecycle routing** - `3ba693fa` (feat)
3. **Task 2 evidence: Prove one owner across direct and cascade routes** - `912eb0dc` (test)
4. **Plan refactor: Apply project formatting to update owners** - `1637ab77` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/index.ts` constructs one update-operations owner from the existing root-bound `HooksRouting` and distributes its two exact operations.
- `extensions/pi-claude-marketplace/edge/register.ts` requires the direct `UpdatePluginsFn` separately from `EdgeDeps` and passes it to the update handler.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` no longer imports a global update entrypoint and forwards the complete parsed request to its required operation.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` defines the two-operation factory, threads exact routing capabilities through direct/cascade execution, and publishes routes after durable save.
- `tests/edge/handlers/plugin/update.test.ts` supplies the required direct operation and proves exact option/reference forwarding.
- `tests/orchestrators/plugin/update.test.ts` uses case-owned production routing and proves one owner's direct/cascade re-entry plus peer isolation.
- `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, and `tests/architecture/cross-op-convergence.test.ts` use production update-operation factories at direct caller boundaries.
- `tests/edge/register.test.ts` and `tests/e2e/import-command.test.ts` provide fresh production runtime/routing/update bundles to required registration calls.

`extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` required no production edit: it already consumes the exact locked `PluginUpdateFn` through its existing dependency boundary. No callback widening, mutable/global context, default owner, optional port, CompletionCache work, update split, reset removal, PID change, comment/message change, or Phase 6 work was introduced.

## Decisions Made

- The plan's stated single-callback assumption could not preserve both direct command options and the locked three-argument cascade contract. The authorized correction returns two exact operations from one owner rather than widening `PluginUpdateFn` or hiding direct context.
- `HooksRuntime` remains at the root/hydration owner and outside `EdgeDeps`. The factory accepts the already bound `HooksRouting` capability and narrows update finalization to `UpdateHooksRouting`.
- Successful route refresh runs after `withStateGuard` resolves because its auto-save is the durable commit boundary. Failed state/config writes therefore cannot mutate visible runtime routes.
- Existing marketplace/autoupdate production code remains unchanged because it already receives the narrow callback; only direct callers and test composition roots were migrated mechanically.

## Deviations from Plan

### Authorized Architecture and Scope Corrections

**1. [Rule 4 - Architecture boundary] Replaced the incompatible single-callback assumption with one dual-operation owner**

- **Found during:** Task 1 implementation
- **Issue:** `PluginUpdateFn(plugin, marketplace, scope)` cannot carry direct update's required `cwd`, target union, command context, model mapping, partial/local flags, and network/auth seams without widening the locked contract, hiding mutable context, or losing behavior.
- **Fix:** Added one root-owned factory returning exact `UpdatePluginsFn` and unchanged `PluginUpdateFn` operations that close over the same required `HooksRouting` owner and internal implementation.
- **Files modified:** root index, edge registration/handler, plugin update owner, and paired tests
- **Authorization:** Root selected this correction explicitly; no required contract was weakened.
- **Commits:** `8ae83a08`, `3ba693fa`

**2. [Rule 3 - Direct-caller propagation] Migrated required callers outside the original frontmatter list**

- **Found during:** Task 1 typecheck and owner verification
- **Issue:** Making the direct operation required at registration and removing global update entrypoints exposed direct test composition roots that must now create production-bound operations.
- **Fix:** Updated only their helper/call sites with fresh production runtime/routing/update bundles, shared within a case only for intentional lifecycle evidence. Assertions and public behavior remained unchanged.
- **Files modified:** `tests/edge/register.test.ts`, `tests/e2e/import-command.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, `tests/architecture/cross-op-convergence.test.ts`, and `tests/orchestrators/plugin/enable-disable.test.ts`
- **Authorization:** Root authorized each mechanical direct-caller migration.
- **Commit:** `3ba693fa`

**3. [Rule 3 - Plan artifact correction] Left marketplace update production source unchanged**

- **Found during:** Task 2 code-path tracing
- **Issue:** The plan listed `orchestrators/marketplace/update.ts` as modified, but it already consumed the exact narrow `PluginUpdateFn`; editing it would create churn without advancing lifecycle ownership.
- **Fix:** Retained the production file byte-identically and migrated only its owner test to the new production factory.
- **Verification:** Marketplace update owner suite and 100% direct coverage passed.

**4. [Rule 3 - TDD prerequisite overlap] Used Task 1 implementation as Task 2's prerequisite instead of manufacturing a regression**

- **Found during:** Task 2 RED planning
- **Issue:** The factory and owner threading required to expose honest direct/cascade identity were already necessarily implemented in Task 1; reverting or introducing a false failure would violate the architecture contract.
- **Fix:** Added atomic production-runtime evidence for direct then cascade re-entry, unrelated-route preservation, and peer isolation on top of the prerequisite implementation.
- **Authorization:** Root explicitly approved the prerequisite overlap/TDD exception.
- **Commit:** `912eb0dc`

**5. [Rule 3 - Verification environment] Re-ran child-process gates outside sandbox restrictions**

- **Found during:** Overall verification
- **Issue:** The sandbox denied deliberate child Node processes with `EPERM`, leaving the direct-coverage negative control and two unit workers with empty process-level failures rather than product assertions.
- **Fix:** Re-ran the identical negative control and full unit suite with contained subprocess permission. The negative control passed; the full unit suite passed 5,438/5,438.

**6. [Rule 3 - Formatting] Corrected two owned files exposed beside the known configuration exception**

- **Found during:** `npm run check`
- **Issue:** Prettier reported the known `.mcp.json` exception and two Plan 05-17 production files.
- **Fix:** Formatted only the two owned production files, verified their paired formatting/type/lint gates, and preserved `.mcp.json` byte-identically.
- **Commit:** `1637ab77`

**Total deviations:** 6 contained corrections (1 authorized architecture correction, 3 direct plan/scope/TDD corrections, and 2 verification/format corrections).
**Impact on plan:** One lifecycle still owns all update routing. Exact consumer contracts and public behavior are stronger and fully verified; no deferred feature or unrelated production change was pulled forward.

## TDD Gate Compliance

- Task 1 RED commit `8ae83a08` failed for the intended reason: the handler still invoked the global update entrypoint instead of the required injected operation. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- Task 1 GREEN commit `3ba693fa` supplied the factory, root wiring, required handler operation, and durable route boundary; the tracer verification passed end-to-end before Task 2 expansion.
- Task 2 used the explicitly authorized prerequisite-overlap exception. Commit `912eb0dc` adds production-runtime ownership evidence without manufacturing an invalid regression.
- Refactoring was isolated in formatting-only commit `1637ab77`; behavior and types remained green.

## Gate Results

- Task 1 tracer suites passed: update handler, root index, edge registration, and transaction lifecycle cascade.
- Task 2 suites passed: plugin update, marketplace update, handler, root index, registration, and transaction lifecycle cascade.
- Direct coverage passed for root index, edge registration, update handler, plugin update, and marketplace update; both update orchestrators reached 100% branch, function, and line coverage.
- TypeScript typecheck and focused/full ESLint passed.
- Fallow passed with `0 above threshold`; the required `scripts/revalidation.mjs:1124` comment remained byte-exact.
- Corresponding-test, corresponding negative-control, and direct-coverage negative-control gates passed.
- Full unit suite passed: 5,438 tests, zero failures/skips/todos.
- Full integration suite passed: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known untracked `.mcp.json` Prettier exception. After formatting the owned files, a standalone full format check reported only `.mcp.json`. Its SHA-256 remained `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`; all later gates were run independently and passed.

## Known Stubs

None. No production placeholder values, TODO/FIXME markers, skipped tests, or unwired operation paths were introduced. The added empty call array is an intentional test spy collector populated by the exercised handler.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-18 can apply the same exact lifecycle-owner pattern to reinstall. CompletionCache binding remains assigned to Plan 05-23, while reset/public-surface cleanup and the update split remain deferred to their planned phases.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All four measured task/refactor commits exist on the authorized feature branch.
- All 12 modified production/test files exist; no tracked deletion occurred.
- `.mcp.json`, the required Fallow suppression comment, and root-owned planning state/config files remain untouched by this plan.
