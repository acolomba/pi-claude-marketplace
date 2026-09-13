---
phase: 06-assertion-and-module-refinement
plan: 40
subsystem: plugin-orchestration
tags: [typescript, update, cascade, composition-root, direct-coverage, tdd]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Update preflight and atomic swap owners from Plan 39
provides:
  - Direct update-cascade owner for hook routing, result folding, ordering, tallies, severity, and reload hints
  - Direct update-flow composition root for preflight, swap, cascade, direct command, and marketplace autoupdate operations
  - Migrated root, edge, integration, and architecture callers with exact update behavior preserved
affects: [plugin-update, marketplace-autoupdate, edge-register, phase-06-update-hub-retirement]
plan_head_before: b055c4ce613de63673bf4d2336b9e2e0c2416241
actuals:
  tokens: 24531
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - direct update cascade owner receives typed outcomes from the retained enumeration hub
    - update flow composes preflight, swap, cascade, and lifecycle operations without a facade or re-export
    - retained hub stays behavior-bearing until its scheduled retirement and remains paired with its generic ledger test
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
    - tests/orchestrators/plugin/update-cascade.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - tests/orchestrators/plugin/update-flow.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/index.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/integration/transaction-lifecycle-cascade.test.ts
    - tests/architecture/hooks-lifecycle.test.ts
key-decisions:
  - "composeUpdateCascade owns UpdateHooksRouting and the complete exact-result fold; update.ts supplies typed target outcomes but no longer renders a cascade."
  - "createPluginUpdateOperations, UpdatePluginsFn, and PluginUpdateOperations live in update-flow.ts, which binds preparePluginUpdate, swapPluginUpdate, and composeUpdateCascade directly."
  - "update.ts remains a genuine target-enumeration and direct-failure-projection owner until its scheduled retirement, preserving the update.ts/update.test.ts generic hub-ledger pair."
patterns-established:
  - "Update composition: flow owner -> retained enumeration hub -> injected preflight/swap runner -> injected cascade owner, with no compatibility surface."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Changed, no-op, partial, failed, targeted, and bulk update cascades preserve exact row order, tallies, severity, and reload hints.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
        status: pass
      - kind: integration
        ref: node --test tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/plugin/update.test.ts tests/index.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: The update flow composes preflight, atomic swap, rollback-safe state/tree mutation, cascade output, and both public update operations.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
        status: pass
      - kind: integration
        ref: node --test tests/orchestrators/plugin/update-flow.test.ts tests/orchestrators/plugin/update.test.ts tests/integration/transaction-lifecycle-cascade.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Root composition, edge handlers, marketplace callers, scanners, correspondence, and dead-code gates point to the named owners while the generic hub ledger remains valid.
    requirement: TREF-09
    verification:
      - kind: integration
        ref: affected index, edge, e2e, marketplace, convergence, lifecycle, and hub-ledger test run
        status: pass
      - kind: other
        ref: npm run typecheck && npm run test:corresponding && npm run fallow && npm run lint
        status: pass
    human_judgment: false
duration: 24min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 40: Update Cascade and Flow Owners Summary

**Plugin update now folds exact public results through `composeUpdateCascade` and binds preflight, atomic swap, cascade, and lifecycle operations in `update-flow.ts`, with both direct owners at 100% coverage.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-09T17:08:06Z
- **Completed:** 2026-09-09T17:31:46Z
- **Tasks:** 2
- **Files changed:** 27 production, test, documentation, gate, and TDD-evidence files before this summary

## Accomplishments

- Extracted `UpdateHooksRouting` and the complete cascade/result fold into `update-cascade.ts`, preserving changed/no-op/partial/failed rows, stable marketplace and caller ordering, exact tallies, severity, and reload hints.
- Added `update-flow.ts` as the sole owner of `UpdatePluginsFn`, `PluginUpdateOperations`, and `createPluginUpdateOperations`; it composes `preparePluginUpdate`, `swapPluginUpdate`, and `composeUpdateCascade` directly.
- Moved exactly one complete PUP-6 success proof from the legacy hub suite to the mirrored flow suite, retaining exact state version, compatibility finalization, generated skill/command/agent/MCP tree, notification text, warning severity, and reload hint.
- Migrated root composition, edge/register types, integration and e2e callers, marketplace update tests, and architecture gates without adding a facade, re-export, overload, or compatibility path.
- Preserved `update.ts` as a genuine target-enumeration and direct-failure owner and retained its direct `update.test.ts` pairing for the generic Phase 6 hub ledger.

## Task Commits

1. **Task 1 RED: Require the update cascade owner** - `f7069868` (test)
2. **Task 1 GREEN: Extract and directly cover update cascade composition** - `ac9e50d9` (refactor)
3. **Task 2 RED: Require the update flow owner** - `6609bc6d` (test)
4. **Task 2 GREEN: Extract update flow and migrate callers/gates** - `2f0126cb` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts` - Owns hook routing, outcome projection, grouping, ordering, tallying, severity, and final dispatch.
- `tests/orchestrators/plugin/update-cascade.test.ts` - Directly proves every cascade branch and exact result form.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` - Owns public update operation types and composes preflight, swap, retained enumeration, and cascade boundaries.
- `tests/orchestrators/plugin/update-flow.test.ts` - Proves both runner branches and the complete success path through state, resource tree, and exact notification output.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Retains target enumeration, marketplace refresh sequencing, direct failure projection, and cascade-safe single-target error capture.
- `extensions/pi-claude-marketplace/index.ts`, edge registration/handler files, integration tests, e2e tests, marketplace tests, and convergence tests - Construct or type the new flow owner directly.
- `tests/architecture/hooks-lifecycle.test.ts`, `tests/architecture/no-lifecycle-default-enabled-read.test.ts`, and `tests/architecture/no-orchestrator-network.test.ts` - Track the moved swap/flow responsibilities without weakening their original guarantees.
- `docs/plugin-enablement.md` - Documents the named update owner surface used by the declared-enablement guard.

## Decisions Made

- Kept target enumeration and direct failure projection in `update.ts` for this incremental plan; those are real behaviors, not a compatibility wrapper, and preserve the live generic hub ledger until the later retirement plan.
- Injected the per-target runner and cascade composer into the retained hub so `update-flow.ts` is the explicit composition root while `update.ts` has no runtime imports back to the new named owners.
- Kept flow output validation strict and observable: the moved end-to-end proof asserts exact persistent state, installed resource names and file contents, warning severity, row bytes, and reload hint.

## TDD Gate Compliance

- **Task 1 RED:** `update-cascade.test.ts` failed on the named missing-owner assertion; `.planning/tdd-evidence/06-40-01.json` returned `RED_EVIDENCE_OK`; commit `f7069868` precedes GREEN.
- **Task 1 GREEN:** `composeUpdateCascade` and its direct owner suite pass; commit `ac9e50d9`. No separate cleanup commit was needed.
- **Task 2 RED:** `update-flow.test.ts` failed on the named missing-owner assertion; `.planning/tdd-evidence/06-40-02.json` returned `RED_EVIDENCE_OK`; commit `6609bc6d` precedes GREEN.
- **Task 2 GREEN:** the direct flow composition and moved end-to-end proof pass; commit `2f0126cb`. No separate cleanup commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical gate coverage] Repointed update lifecycle and network guards across the named owners**

- **Found during:** Task 2 affected-caller audit
- **Issue:** The hooks lifecycle scanner still inspected the pre-extraction hub, and the default-enabled/network guards did not cover the new flow surface.
- **Fix:** Pointed hooks mutation ownership to `update-swap.ts`, added `update-flow.ts` to the correct guard inventories, and updated the owner documentation.
- **Files modified:** `tests/architecture/hooks-lifecycle.test.ts`, `tests/architecture/no-lifecycle-default-enabled-read.test.ts`, `tests/architecture/no-orchestrator-network.test.ts`, `docs/plugin-enablement.md`
- **Verification:** All three architecture suites, full ESLint, targeted Prettier, and affected callers pass.
- **Committed in:** `2f0126cb`

**2. [Rule 3 - Blocking verification] Preserved direct hub correspondence and closed exported injected contracts**

- **Found during:** Task 2 correspondence and fallow gates
- **Issue:** Migrating the factory made `update.test.ts` appear proxy-owned, while the retained hub's exported injected signatures referenced private types.
- **Fix:** Added a direct assertion for the hub's real enumeration entrypoint and exported its documented runner/composer contracts.
- **Files modified:** `tests/orchestrators/plugin/update.test.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
- **Verification:** `npm run test:corresponding` and `npm run fallow` pass with no issues.
- **Committed in:** `2f0126cb`

**Total deviations:** 2 auto-fixed (1 critical gate expansion, 1 blocking verification fix).

**Impact on plan:** Both fixes keep the ownership move observable and fail-closed. They add no product behavior or unrelated architecture.

## Verification

- Direct cascade coverage: **47/47 branches, 11/11 functions, 214/214 lines**.
- Direct flow coverage: **8/8 branches, 4/4 functions, 59/59 lines**.
- Required owner/hub/index and owner/hub/transaction test groups pass.
- Affected index, edge handler/register, e2e import, marketplace update, enable/disable, convergence, hooks lifecycle, declared-enablement, network-surface, and generic hub-ledger suites pass.
- `npm run typecheck`, `npm run test:corresponding`, `npm run fallow`, and full `npm run lint` pass.
- The direct-coverage negative controls pass outside the sandbox in this executor environment.
- Targeted Prettier passes for every Plan 40 source, test, gate, and documentation file.

## Issues Encountered

- The repository-wide `npm run format:check` continues to report only the pre-existing untracked `.mcp.json` formatting debt. The file was preserved unchanged; every Plan 40 file passes targeted Prettier.
- Existing unrelated Phase 1 revalidation artifacts and local configuration changes were preserved unchanged and excluded from every commit.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Named preflight, swap, cascade, and flow owners are ready for the remaining update-family caller migrations and final hub retirement.
- `update.ts` / `update.test.ts` intentionally remain the generic Phase 6 hub-ledger fixture; this plan did not delete or convert the hub into a facade.

---

*Phase: 06-assertion-and-module-refinement*
*Completed: 2026-09-09*

## Self-Check: PASSED

Both created owner pairs exist, all four task commits are present, and the measured plan commit count is four.
