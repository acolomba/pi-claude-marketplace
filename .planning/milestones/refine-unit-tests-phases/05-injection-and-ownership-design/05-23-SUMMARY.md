---
phase: 05-injection-and-ownership-design
plan: 23
subsystem: extension-lifecycle-ownership
tags: [completion-cache, plugin-update, hooks-routing, transaction-order, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime and CompletionCache from Plan 05-12
  - phase: 05-injection-and-ownership-design
    provides: runtime-bound plugin update operations from Plan 05-17
  - phase: 05-injection-and-ownership-design
    provides: required completion-cache propagation through plugin install from Plan 05-22
provides:
  - one root update-operation bundle bound to the lifecycle HooksRouting and CompletionCache owners
  - exact post-finalization plugin-index invalidation for direct, bulk, marketplace-cascade, and autoupdate calls
  - durable-success, ineligible-target, cache-failure, same-owner rebuild, and peer-isolation evidence
affects: [05-24, 05-26, plugin-update, completion-lifecycle, marketplace-autoupdate]

actuals:
  tokens: 6981
  tasks: 2
  commits: 4
plan_head_before: be20a7301258d983efb5492fa072687dce2f42bb

tech-stack:
  added: []
  patterns:
    - extension composition binds HooksRouting and CompletionCache once into one update-operation bundle
    - direct and narrow cascade update closures share the same required owners while PluginUpdateFn stays unchanged
    - only successful durable update finalization drops the exact scoped marketplace plugin index

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - tests/index.test.ts
    - tests/edge/register.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts

key-decisions:
  - "Require CompletionCache at createPluginUpdateOperations beside HooksRouting; do not change PluginUpdateFn or select an optional, default, or global owner."
  - "Keep target invalidation at the existing post-finalization hygiene boundary and retain silent cache-failure behavior."
  - "Give isolated direct tests fresh production owners and share one owner only across intentional multi-call lifecycle cases."

patterns-established:
  - "Update owner bundle: the full direct/bulk operation and locked narrow PluginUpdateFn capture the same routing and completion owners."
  - "Update freshness boundary: committed state and route publication precede exact target invalidation; every non-success arm remains cache-inert."

requirements-completed: []

coverage:
  - id: D1
    description: "The extension root creates one update-operation bundle from its lifecycle HooksRouting and CompletionCache and forwards its two closures to direct and cascade consumers."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/index.test.ts#constructs one runtime and completion cache for edge registration, hook hydration, and plugin update"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts and tests/edge/handlers/plugin/update.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for index.ts, edge/register.ts, and edge/handlers/plugin/update.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "A successful update publishes routes and durable state before dropping only its exact scoped marketplace cache entry."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#successful update finalizes routes before dropping only its captured cache target"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/plugin/update.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Unchanged, skipped, failed, and rolled-back targets retain eligibility; refresh failure stays silent and same-owner reads rebuild without touching unrelated or peer rows."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts#PUP-3, PUP-4, PUP-6, and dropCache-fail owner assertions"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 23: Lifecycle-Owned Plugin Update Cache Summary

**Plugin update now carries the root completion-cache owner through one shared direct/cascade operation bundle and refreshes only successfully finalized targets.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-08T07:38:15Z
- **Completed:** 2026-09-08T08:03:19Z
- **Tasks:** 2
- **Files modified:** 11 production/test files

## Accomplishments

- Bound the root `HooksRouting` and `CompletionCache` into one `createPluginUpdateOperations` call. Its full direct/bulk operation and narrow `PluginUpdateFn` now share both owners.
- Preserved the exact three-argument `PluginUpdateFn` contract while existing edge, marketplace-cascade, and autoupdate paths continue to receive the same root closure.
- Replaced plugin update's transition-global cache drop with the captured cache at the existing post-finalization boundary.
- Proved durable state and route publication precede the exact target drop; unchanged, unsupported/skipped, phase-3 failure, and rollback paths make no drop.
- Proved same-owner completion rebuilding, unrelated and peer-cache isolation, and silent cache-hygiene failure without changing rows, results, warnings, or notifications.

## Task Commits

1. **Task 1 RED: Add failing root update-cache ownership proof** - `cca57258` (test)
2. **Task 1 GREEN: Bind update operations to lifecycle cache** - `38da2bdf` (feat)
3. **Task 2 evidence: Prove eligibility, ordering, rebuild, and isolation** - `5229a2a3` (test)
4. **Task 2 owner correction: Keep marketplace cascade owners case-scoped** - `1b5e3459` (test)

## Files Created/Modified

Production ownership:

- `extensions/pi-claude-marketplace/index.ts` constructs the lifecycle completion cache before the update factory and supplies it beside the existing routing owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` requires that cache, captures it in both update closures, threads it through the three-phase arguments, and performs exact target invalidation through the captured owner.

Owner and behavior evidence:

- `tests/index.test.ts` locks the root composition boundary to one runtime/cache-bound update bundle.
- `tests/edge/register.test.ts` gives registration and its update closure the same case-owned cache.
- `tests/edge/handlers/plugin/update.test.ts` supplies a fresh production owner without changing parser, result, warning, error, or notification assertions.
- `tests/orchestrators/plugin/update.test.ts` proves durable ordering, exact invalidation, ineligible-target inertness, cache-failure silence, completion rebuilding, and owner isolation.
- `tests/orchestrators/marketplace/update.test.ts` uses a fresh production update closure per isolated cascade case and shares it throughout that case.
- `tests/integration/transaction-lifecycle-cascade.test.ts` shares one completion owner across install and update in the intentional multi-operation lifecycle.
- `tests/e2e/import-command.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, and `tests/architecture/cross-op-convergence.test.ts` mechanically bind their direct update callers to fresh production owners with assertions unchanged.

## Decisions Made

- `CompletionCache` is required by `createPluginUpdateOperations`; it is not added to `PluginUpdateFn`, selected by a fallback, or constructed inside either returned operation.
- Direct/bulk `updatePlugins` and marketplace/autoupdate `pluginUpdate` remain distinct capability shapes backed by one bound implementation and owner pair.
- Cache maintenance remains post-commit hygiene. A cache-drop failure is swallowed and cannot rewrite durable state, roll back routes, or change the public update result.

## Deviations from Plan

### Authorized Scope and Execution Corrections

**1. [Rule 3 - Required caller propagation] Migrated direct test callers beyond the eight-file frontmatter list**

- **Found during:** Task 1 typecheck and caller census
- **Issue:** Requiring `CompletionCache` at the production update factory exposed direct test helpers in integration, end-to-end, marketplace, enable/disable, and convergence suites that still constructed the factory with only `HooksRouting`.
- **Fix:** Bound each isolated caller to a fresh production completion owner and shared the existing cache only in the intentional install-update lifecycle. Production behavior and test assertions were unchanged.
- **Authorization:** Root explicitly authorized the contained propagation and required that the pre-existing e2e behavior remain untouched.
- **Files:** `tests/integration/transaction-lifecycle-cascade.test.ts`, `tests/e2e/import-command.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, and `tests/architecture/cross-op-convergence.test.ts`.
- **Commits:** `38da2bdf`, `1b5e3459`

**2. [TDD prerequisite overlap] Task 1 necessarily implemented Task 2's captured-cache invalidation**

- **Found during:** Task 1 GREEN
- **Issue:** The root ownership tracer could not pass while `updatePlugins` still dropped the transition-global cache. Supplying the cache and using it at the existing invalidation site were one indivisible production change.
- **Fix:** Completed the captured-cache drop in Task 1 GREEN. With root approval, Task 2 added exact behavior evidence without manufacturing a false regression.
- **Commits:** `38da2bdf`, `5229a2a3`

**3. [Rule 3 - Verification environment] Re-ran subprocess and socket gates outside sandbox restrictions**

- **Found during:** Direct-coverage negative controls and full unit execution
- **Issue:** The workspace sandbox blocked deliberate child Node processes and Unix-domain-socket creation with `EPERM`, causing the negative-control gate and two unrelated unit workers to fail at their environment boundary.
- **Fix:** Re-ran the identical negative-control and full unit commands with contained subprocess/socket permission. Direct negative controls passed and the unit suite passed 5,455/5,455.

**4. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** The full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside plan ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6` and ran every later gate independently.

**Total deviations:** 4 contained caller-propagation, TDD-order, environment, or known-workspace corrections.
**Impact on plan:** The required single-owner update contract is complete without callback drift, a second cache lifetime, a fallback, production scope expansion, suppression change, or Phase 6 work.

## TDD Gate Compliance

- Task 1 RED commit `cca57258` failed on the intended root composition assertion because the extension called `createPluginUpdateOperations(hooksRouting)` without its lifecycle cache. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` with `target_test_failed`.
- Task 1 GREEN commit `38da2bdf` bound the root cache beside routing and migrated required callers. The tracer suites, direct coverage, typecheck, and focused ESLint passed.
- Task 2 production was already necessary to make Task 1's ownership proof truthful. Root authorized the prerequisite overlap; no artificial regression was introduced. Evidence commit `5229a2a3` proves finalization order, success eligibility, non-success inertness, silent failure, same-owner rebuild, and peer isolation.
- The case-scope correction in `1b5e3459` ensures a marketplace cascade owns one production closure for its whole invocation rather than constructing a new cache per callback call.
- No production refactor followed the evidence commits. Google TypeScript style and the project's unit-test pairing, public-outcome, hermeticity, and test-double rules remain satisfied.

## Gate Results

- Exact Task 1 suites passed: index, edge registration, update handler, plugin update, and marketplace update.
- Exact Task 2 suites passed: plugin update, marketplace update, edge registration, update handler, completion cache, and transaction-lifecycle integration.
- Direct coverage passed at 100% for `index.ts`, `edge/register.ts`, `edge/handlers/plugin/update.ts`, and `orchestrators/plugin/update.ts`.
- TypeScript typecheck, focused and repository-wide ESLint, corresponding-test gates, and Fallow passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retains the exact required suppression comment and no suppression was added.
- Corresponding negative controls and direct-coverage negative controls passed.
- Full unit suite passed with required child-process/socket permission: 5,455 tests across 300 suites, zero failures/skips/todos.
- Full integration suite passed with required permission: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. All changed files pass Prettier, and every subsequent gate ran independently and passed.

## Known Stubs

None. No TODO/FIXME marker, skipped test, hard-coded production placeholder, or unwired ownership path was introduced.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-24 can apply the same required lifecycle cache ownership to reinstall. Update remains cohesive for the planned Phase 6 split, and transition/reset cleanup remains deferred.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All four measured task commits exist on the authorized feature branch.
- All 11 modified production/test files exist and no tracked file was deleted.
- `PluginUpdateFn`, `.mcp.json`, and the required Fallow suppression remain byte-exact; root-owned tracking and configuration files were not changed by this plan.
