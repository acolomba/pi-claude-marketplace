---
phase: 05-injection-and-ownership-design
plan: 18
subsystem: extension-lifecycle-ownership
tags: [hooks-runtime, plugin-reinstall, reconcile-backfill, transaction-boundary, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: root-owned HooksRuntime, exact HooksRouting capabilities, and owner-bound update operations from Plans 05-12 through 05-17
provides:
  - direct and bulk reinstall operations bound to one required lifecycle HooksRouting owner
  - real reconcile backfill composition through the apply-owned routing capability
  - durable-boundary route replacement and peer-runtime isolation evidence
affects: [05-19-through-05-25, plugin-reinstall, reconcile-backfill, hook-lifecycle]

actuals:
  tokens: 11833
  tasks: 2
  commits: 3
plan_head_before: 35c14284821291bc4c0a81e841425145a27e3c79

tech-stack:
  added: []
  patterns:
    - operation factories bind exact consumer capabilities to the root lifecycle owner
    - hook routes publish only after reinstall state is durably saved
    - isolated tests create fresh routing owners and share one only for intentional lifecycle spans

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/register.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "Use an exact ReinstallHooksRouting capability beside ReinstallTransaction; HooksRuntime remains at the root owner and outside EdgeDeps."
  - "Remove runtime-free reinstall entrypoints and expose only factories that require the lifecycle routing owner."
  - "Keep reconcile apply unchanged because its existing required HooksRouting option already reaches backfill; bind real reinstall inside backfill."

patterns-established:
  - "Reinstall owner: createNodeReinstallPlugin and createNodeReinstallPlugins require one explicit HooksRouting owner with no fallback."
  - "Reconcile propagation: apply passes its existing routing capability and backfill binds the exact real child operation locally."

requirements-completed: []

coverage:
  - id: D1
    description: "Registered direct and bulk reinstall commands forward exact requests into one required owner-bound operation."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/edge/handlers/plugin/reinstall.test.ts#re-materialises only the named plugin when a plugin reference is supplied (RINST-01)"
        status: pass
      - kind: unit
        ref: "tests/edge/register.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for edge/register.ts and edge/handlers/plugin/reinstall.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Successful reinstall replaces the supplied runtime's hook route after durable save without mutating a peer runtime."
    requirement: TREF-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall.test.ts#WR-03: reinstallPlugin round-trips the plugin's routing-table entries without /reload"
        status: pass
      - kind: integration
        ref: "tests/integration/transaction-lifecycle-cascade.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/plugin/reinstall.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Real reconcile backfill re-materializes hook routes through apply's lifecycle owner while preserving outcomes, state, trees, silence, and peer isolation."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#SURF-05: records an orphan rewake on a promotion whose re-resolve reports one"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/apply.test.ts"
        status: pass
      - kind: other
        ref: "100% direct coverage for orchestrators/reconcile/backfill.ts and orchestrators/reconcile/apply.ts"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 18: Lifecycle-Owned Reinstall and Backfill Summary

**Direct, bulk, and reconcile-backfill reinstall now share explicit lifecycle hook routing, with route changes visible only after durable replacement state succeeds.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-08T04:45:09Z
- **Completed:** 2026-09-08T05:09:30Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added required `ReinstallHooksRouting`, `ReinstallPluginFn`, and `ReinstallPluginsFn` contracts and production factories that bind direct and bulk reinstall to one lifecycle owner.
- Passed the root-bound direct/bulk operation into the edge handler and removed runtime-free reinstall entrypoints; no handler, orchestrator, or test path can silently construct a fallback production owner.
- Bound reconcile backfill's real reinstall child to the `HooksRouting` capability already carried by apply, without adding an apply child bundle or changing apply's production behavior.
- Preserved prepare-all, replacement order, durable save, failing-step compensation, reverse rollback, abort, finalize, cleanup, classifications, target order, rows, warnings, and notifications.
- Replaced the obsolete global reset/read proof with an old-to-new route transition on a case-owned runtime, peer isolation, and real backfill route promotion evidence.

## Task Commits

1. **Task 1 RED: Require exact reinstall operation forwarding** - `1304aefa` (test)
2. **Task 1 GREEN: Bind reinstall and required callers to lifecycle routing** - `d61e955b` (feat)
3. **Task 2 evidence: Prove direct and backfill owner-bound route effects** - `c7c83732` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/register.ts` binds one direct/bulk reinstall operation from the root-supplied routing owner and passes it to the handler.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` requires the exact `ReinstallPluginsFn` and forwards the complete parsed request.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` accepts exact routing capabilities beside the semantic transaction port, removes runtime-free entrypoints, and refreshes only the supplied owner after durable save.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` binds one real single-plugin reinstall operation from apply's existing routing capability for the scan.
- `tests/edge/handlers/plugin/reinstall.test.ts` proves exact request/reference forwarding through the required handler operation.
- `tests/orchestrators/plugin/reinstall.test.ts` uses production factories, proves old-to-new route replacement, and verifies peer isolation without global reset access.
- `tests/orchestrators/reconcile/backfill.test.ts` proves the real hook promotion leaves exact state/tree/outcome evidence and populates only the supplied routing owner.
- `tests/architecture/cross-op-convergence.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, and `tests/orchestrators/plugin/enable-disable.test.ts` create production reinstall owners at their direct composition boundaries.

`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` required no edit: its existing required `hooksRouting` option already flows into `scanForceInstalledBackfills` at the correct cascade position. No child bundle, CompletionCache work, PID behavior, comment/message change, Phase 6 split, optional/default port, or global fallback was introduced.

## Decisions Made

- The plan's literal HooksRuntime-through-EdgeDeps route conflicts with the D-11 architecture established in Plan 05-12. The corrected boundary keeps `HooksRuntime` at the root/hydration owner and gives reinstall only the exact required `ReinstallHooksRouting` capability.
- The semantic `ReinstallTransaction` remains separate and required. `createReinstallPlugin(transaction, hooksRouting)` binds both owners explicitly, while production factories select only the real transaction.
- Backfill binds the real child once per scan from apply's existing routing owner. This preserves real composition and avoids a broad child-operation bundle.
- Route cache removal, re-read, and rebuild remain after `tx.save()`, so failed replacement or state persistence cannot expose uncommitted hook routes.

## Deviations from Plan

### Authorized Architecture and Scope Corrections

**1. [Rule 4 - Architecture boundary] Passed exact routing capabilities instead of HooksRuntime through EdgeDeps**

- **Found during:** Task 1 implementation
- **Issue:** Plans 05-12 through 05-17 established that `HooksRuntime` belongs only to the root/hydration owner and must not enter `EdgeDeps`; the plan's literal runtime-forwarding wording contradicted that decision.
- **Fix:** Added exact `ReinstallHooksRouting`, bound it through production factories, and passed only `ReinstallPluginsFn` to the handler. No optional/default/global owner exists.
- **Authorization:** Root explicitly authorized the architecture-safe correction.
- **Commits:** `1304aefa`, `d61e955b`

**2. [Rule 3 - Direct-caller propagation] Migrated required callers outside the frontmatter file list**

- **Found during:** Task 1 typecheck and owner verification
- **Issue:** Removing runtime-free reinstall exports exposed direct test composition roots that had to construct a production owner.
- **Fix:** Mechanically migrated `tests/architecture/cross-op-convergence.test.ts`, `tests/integration/transaction-lifecycle-cascade.test.ts`, and `tests/orchestrators/plugin/enable-disable.test.ts` to fresh production runtime/routing factories, sharing an owner only for the intentional update-to-reinstall lifecycle case. Assertions and behavior were unchanged.
- **Authorization:** Root explicitly authorized these direct callers.
- **Commit:** `d61e955b`

**3. [Rule 3 - Plan artifact correction] Kept reconcile apply production source byte-identical**

- **Found during:** Task 2 composition tracing
- **Issue:** The frontmatter listed `reconcile/apply.ts` as modified while the task action and fails-when clause called it read/verify-only. Its required options already carry `hooksRouting` into backfill.
- **Fix:** Changed only backfill's real child binding and verified apply through its complete owner suite and 100% direct coverage.

**4. [Rule 3 - TDD prerequisite overlap] Used tracer implementation as Task 2's prerequisite**

- **Found during:** Task 2 RED planning
- **Issue:** Removing runtime-free entrypoints in Task 1 necessarily required the real backfill caller to bind its operation for compilation and tracer verification, so Task 2's production threading already existed.
- **Fix:** Added atomic public-effect evidence for old-to-new reinstall routes, peer isolation, and real backfill promotion without reverting correct code or manufacturing an invalid RED.
- **Commit:** `c7c83732`

**5. [Rule 3 - Verification environment] Re-ran child-process gates outside sandbox restrictions**

- **Found during:** Overall verification
- **Issue:** The sandbox returned `EPERM` for deliberate child Node processes, causing the direct-coverage negative control and two unit workers to report empty process-level failures.
- **Fix:** Re-ran the identical negative control and full unit suite with contained subprocess permission. Both passed completely.

**6. [Known workspace exception] Preserved the pre-existing `.mcp.json` formatting failure**

- **Found during:** `npm run check`
- **Issue:** Full check stops at `format:check` because untracked `.mcp.json` is not Prettier-formatted and is outside this plan's ownership.
- **Fix:** Preserved the file byte-identically at SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6` and ran every later gate independently.

**Total deviations:** 6 contained corrections (1 authorized architecture correction, 3 scope/TDD/artifact corrections, and 2 verification-environment exceptions).
**Impact on plan:** The lifecycle ownership contract is stronger and fully verified. No required transaction, route, apply, or public behavior was weakened.

## TDD Gate Compliance

- Task 1 RED commit `1304aefa` failed on the intended exact-forwarding assertion because the handler still called its imported runtime-free operation. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK`.
- Task 1 GREEN commit `d61e955b` supplied the required factories, edge binding, real backfill propagation, and mechanical caller migrations. The tracer's handler, registration, reinstall, and transaction-lifecycle suites passed before Task 2 expansion.
- Task 2 used the prerequisite-overlap exception described above. Commit `c7c83732` replaces global test-state inspection with production runtime effects and adds real backfill owner evidence without manufacturing a regression.
- No separate refactor commit was necessary; formatting, typecheck, lint, and behavior stayed green after both task commits.

## Gate Results

- Task 1 tracer suites passed: reinstall handler, edge registration, reinstall orchestrator, and transaction lifecycle cascade.
- Task 2 suites passed: reinstall, reconcile backfill, reconcile apply, and transaction lifecycle cascade.
- Direct coverage passed at 100% for every required owner: edge registration (15/15 branches, 9/9 functions, 152/152 lines), reinstall handler (25/25, 3/3, 104/104), reinstall orchestrator (239/239, 50/50, 1,721/1,721), backfill (63/63, 13/13, 475/475), and apply (119/119, 23/23, 952/952).
- TypeScript typecheck, focused and repository-wide ESLint, and corresponding-test gates passed.
- Fallow passed with `0 above threshold`; `scripts/revalidation.mjs:1124` retained the exact required suppression comment.
- Corresponding negative-control and direct-coverage negative-control gates passed.
- Full unit suite passed under child-process permission: 5,438 tests, zero failures/skips/todos.
- Full integration suite passed: 32 tests, zero failures/skips/todos.
- `npm run check` passed typecheck, lint, and Fallow, then stopped only at the known `.mcp.json` Prettier exception. All subsequent gates ran independently and passed.

## Known Stubs

None. No production placeholder, TODO/FIXME marker, skipped test, or unwired operation path was introduced. Existing prose that describes a synthetic placeholder name is not executable placeholder behavior.

## User Setup Required

None.

## Next Phase Readiness

Plan 05-19 can continue the same exact lifecycle-owner pattern. CompletionCache binding remains assigned to its later plan, and Phase 6 still owns reinstall module splitting and terminal compatibility-surface removal.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All three measured task commits exist on the authorized feature branch.
- All 10 modified production/test files exist; no tracked deletion occurred.
- Reconcile apply, `.mcp.json`, the required Fallow suppression comment, and root-owned planning state/config files remain untouched by this plan.
