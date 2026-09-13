---
phase: 06-assertion-and-module-refinement
plan: 39
subsystem: plugin-orchestration
tags: [typescript, update, preflight, atomic-swap, rollback, direct-coverage]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Install hub retirement and generic lifecycle ledger rotation from Plan 38
provides:
  - Direct update-preflight owner for target membership, candidate classification, clone probing, and disabled pin refresh
  - Direct update-swap owner for bridge staging, rollback, intent marking, transaction finalization, and cleanup
  - Migrated handler, register, caller, and architecture-scanner ownership with exact update behavior preserved
affects: [plugin-update, marketplace-autoupdate, edge-register, architecture-gates, phase-06-hub-closure]
plan_head_before: 49a2e035d8865674bb4d4d62bfc0a0d578dda114
actuals:
  tokens: 55113
  tasks: 2
  commits: 7
tech-stack:
  added: []
  patterns:
    - named update responsibility owners composed by a retained command-flow hub
    - prepared update value passed from classification into atomic replacement without a compatibility facade
    - owner-paired direct coverage supplemented by exact end-to-end lifecycle proofs
key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
    - tests/orchestrators/plugin/update-preflight.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - tests/orchestrators/plugin/update-swap.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/architecture/disabled-state-classification.test.ts
    - tests/architecture/manifest-lookup-drift.test.ts
    - tests/architecture/no-lifecycle-default-enabled-read.test.ts
key-decisions:
  - "preparePluginUpdate owns the complete pre-swap decision surface, including disabled-record pin refresh, while update.ts retains only target enumeration and command-flow composition."
  - "swapPluginUpdate receives a fully prepared candidate and owns real bridge staging, rollback, intent marking, per-bridge commits, state finalization, clone cleanup, and completion-cache mutation."
  - "UpdatePluginsFn lives beside UpdatePluginsOptions in update-preflight.ts, so handlers and register import the command contract from its named owner without a hub re-export."
patterns-established:
  - "Update extraction boundary: classification returns PreparedPluginUpdate; the swap owner consumes it directly; the hub renders and sequences public command outcomes."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Update preflight preserves targeted and bulk membership, missing, partial, disabled, authenticated clone, URL, and git-subdir outcomes.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
        status: pass
      - kind: integration
        ref: node --test tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update.test.ts tests/edge/handlers/plugin/update.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Atomic update replacement preserves success trees, rollback trees, intent-ledger state, per-bridge failures, and exact command outcomes.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
        status: pass
      - kind: integration
        ref: node --test tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/update.test.ts tests/edge/register.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Handler, register, architecture scanners, correspondence, type, and dead-code gates point to the named owners while update.ts/update.test.ts remain the valid generic hub-ledger pair.
    requirement: TREF-09
    verification:
      - kind: unit
        ref: node --test tests/architecture/disabled-state-classification.test.ts tests/architecture/manifest-lookup-drift.test.ts tests/architecture/no-lifecycle-default-enabled-read.test.ts tests/scripts/check-phase-06-hub-ledger.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck && npm run test:corresponding && npm run fallow
        status: pass
    human_judgment: false
duration: 36min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 39: Update Responsibility Owners Summary

**Plugin update now classifies candidates through `preparePluginUpdate` and performs real staged filesystem and ledger replacement through `swapPluginUpdate`, with exact public behavior preserved and both owners at 100% direct coverage.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-09-09T16:26:43Z
- **Completed:** 2026-09-09T17:02:52Z
- **Tasks:** 2
- **Files changed:** 11 production/test files before this summary and normal planning-state updates

## Accomplishments

- Extracted the full update preflight surface into `update-preflight.ts`: target types, command options, membership triage, strict/partial classification, authenticated pinned/unpinned clone probing, git-subdir resolution, version selection, and disabled pin refresh now have one direct-tested owner.
- Extracted the physical update transaction into `update-swap.ts`: sequential bridge preparation, cleanup-aware abort, durable intent mark, per-bridge replacement and rollback, hook replacement, partial-failure resource projection, final state mutation, clone cleanup, and completion-cache invalidation now have one direct-tested owner.
- Preserved exact targeted/bulk, missing, partial, disabled, clone, success, failure, rollback, state, tree, notification-order, severity, redaction, and recovery-hint behavior across the retained command-flow hub and all affected callers.
- Migrated the edge handler, edge register, type consumers, disabled-state scanner, manifest-lookup scanner, and default-enabled lifecycle gate directly to the new owners without a re-export, facade, overload, or compatibility path.
- Kept the generic Phase 6 hub-ledger fixture on `update.ts` / `update.test.ts`; its executable fixture remains green for the future final hub retirement.

## Task Commits

1. **Task 1 RED: Require the update preflight owner** - `9d936eda` (test)
2. **Task 1 GREEN: Extract update preflight** - `ed4ae118` (feat)
3. **Task 2 RED: Require the update swap owner** - `46174f6a` (test)
4. **Task 2 GREEN: Extract atomic update swap** - `aeb2e7f4` (feat)
5. **Task 2 gate fix: Close extracted type contracts** - `bd9f0291` (fix)
6. **Task 2 caller expansion: Migrate ownership scanners** - `7845eae7` (test)
7. **Task 2 gate expansion: Preserve lifecycle scanning** - `768fcb51` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` - Owns update target/options types, membership, candidate, clone-probe, version, and disabled-refresh decisions.
- `tests/orchestrators/plugin/update-preflight.test.ts` - Directly proves every preflight line, function, and branch, including concurrent disabled-state refresh cases.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` - Owns real bridge staging, rollback, intent/final state mutation, hooks, cleanup, and success/failure outcome composition.
- `tests/orchestrators/plugin/update-swap.test.ts` - Direct success and failure state/tree proofs plus the complete legacy lifecycle matrix through the extracted owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Retains target enumeration, marketplace synchronization, cascade composition, rendering, and public operation construction.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` and `extensions/pi-claude-marketplace/edge/register.ts` - Import update command contracts directly from `update-preflight.ts`.
- `tests/orchestrators/plugin/update.test.ts` - Remains the generic hub-ledger owner and supplies the complete exact update-flow proof.
- `tests/architecture/disabled-state-classification.test.ts`, `tests/architecture/manifest-lookup-drift.test.ts`, and `tests/architecture/no-lifecycle-default-enabled-read.test.ts` - Follow the moved responsibilities and keep the split owner surface fail-closed.

## Decisions Made

- Kept `update.ts` as the command-flow and notification composition hub because Plan 40 owns the later cascade/flow split; Plan 39 moved only the specified preflight and physical swap responsibilities.
- Passed `PreparedPluginUpdate` directly into `swapPluginUpdate`, avoiding repeated state/manifest reads and preserving the original preflight-to-intent stale-version boundary.
- Kept phase-3 direct failure dispatch supplied by the flow composition as a typed callback, so the swap owner constructs the same aggregate error while the command hub remains the sole owner of public notification grammar.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Closed extracted cleanup and outcome type contracts**

- **Found during:** Task 2 repository typecheck
- **Issue:** The moved cleanup seam was initially typed as `Promise<void>` although the production clone collector returns deleted paths, and the hub needed the swap owner's exact aggregate outcome type.
- **Fix:** Accepted an ignored `Promise<unknown>` cleanup result, exported the complete swap outcome type surface, and retained an explicit preflight boundary narrowing.
- **Files modified:** `update-preflight.ts`, `update-swap.ts`, `update.ts`, and owner tests
- **Verification:** `npm run typecheck`, focused suites, direct coverage, lint, and fallow pass.
- **Committed in:** `bd9f0291`

**2. [Rule 3 - Blocking] Migrated Phase 6 ownership scanners discovered by the affected-caller run**

- **Found during:** Task 2 affected-caller verification
- **Issue:** The disabled-state and manifest-lookup scanners still required the moved imports in `update.ts`, making both tests fail despite the responsibilities correctly living in `update-preflight.ts`.
- **Fix:** Pointed both exact ownership inventories to `update-preflight.ts`.
- **Files modified:** `tests/architecture/disabled-state-classification.test.ts`, `tests/architecture/manifest-lookup-drift.test.ts`
- **Verification:** Both architecture suites pass and the complete affected-caller run reaches the new owners.
- **Committed in:** `7845eae7`

**3. [Rule 2 - Missing critical gate coverage] Extended the lifecycle declaration guard across the split update surface**

- **Found during:** Task 2 scanner audit
- **Issue:** The default-enabled lifecycle gate still scanned only the retained flow hub, leaving the new preflight and swap owners outside its security boundary.
- **Fix:** Added both new owners while retaining the hub target.
- **Files modified:** `tests/architecture/no-lifecycle-default-enabled-read.test.ts`
- **Verification:** The lifecycle gate passes against all update owners.
- **Committed in:** `768fcb51`

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking migration, 1 missing critical gate expansion).

**Impact on plan:** All changes are direct consequences of moving the named update responsibilities; no unrelated feature or architectural scope was added.

## Verification

- Direct preflight coverage: **94/94 branches, 20/20 functions, 528/528 lines**.
- Direct swap coverage: **130/130 branches, 37/37 functions, 1,203/1,203 lines**.
- Focused and affected callers: **16 suites**, including owner, hub, handler, register, marketplace update, autoupdate cascade, cross-operation, transaction lifecycle, index, and e2e import coverage.
- `npm run typecheck`, `npm run test:corresponding`, `npm run fallow`, full ESLint, targeted Prettier, and the generic Phase 6 hub-ledger test pass.
- Required stale-owner scans are empty; `update.ts` contains none of the moved preflight/swap definitions and handler/register contain no stale command-type import from the hub.

## Issues Encountered

- `npm run test:coverage:direct:negative` has a pre-existing Node 26 subprocess-capture incompatibility: its child exits non-zero as expected, but `spawnSync` reports an empty `stderr`, while running the child command directly prints the expected refusal. Neither negative-control file changed in this plan; the positive direct-coverage gates for both new owners pass completely. Recorded in `deferred-items.md`.
- The repository-wide Prettier check continues to report only the pre-existing untracked `.mcp.json` formatting debt. Every Plan 39 source, test, gate, and caller file passes targeted Prettier. The file was preserved unchanged as requested.
- Existing unrelated Phase 1 revalidation artifacts and local configuration changes were preserved unchanged and excluded from all commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 40 can split update cascade and flow composition from the retained `update.ts` hub using the stable `preparePluginUpdate` and `swapPluginUpdate` boundaries.
- The generic hub-ledger fixture intentionally remains on `update.ts` / `update.test.ts` until that later retirement.

---

*Phase: 06-assertion-and-module-refinement*
*Completed: 2026-09-09*

## Self-Check: PASSED

All four named owner source/test artifacts, the summary, and all seven task/deviation commits were verified on disk and in git history.
