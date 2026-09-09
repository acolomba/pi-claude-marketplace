---
phase: 06-assertion-and-module-refinement
plan: 43
subsystem: plugin-orchestration
tags: [typescript, update, ownership-migration, hub-retirement, architecture-gates]
requires:
  - phase: 06-assertion-and-module-refinement
    provides: Direct update preflight, swap, cascade, and flow owners plus migrated lifecycle consumers from Plans 39-42
provides:
  - Complete update behavior ownership in the four named direct-tested owner pairs
  - READY pre-edit ledger covering every update symbol, responsibility, caller, test, gate, document reference, and dependency edge
  - Atomic retirement of update.ts and update.test.ts with no facade, re-export, duplicate case, or stale qualified path
  - Generic Phase 6 hub-ledger fixtures rotated to the genuine reinstall.ts and reinstall.test.ts legacy pair
affects: [plugin-update, update-flow, phase-06-reinstall-retirement, hub-ledger]
plan_head_before: 1e7d01fc87b5903ccfa1ab34b5e97ed6de0160b9
actuals:
  tokens: 212226
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - behavior-bearing legacy hubs are absorbed into their named direct owner before atomic deletion
    - generic retirement-gate fixtures rotate to the next genuine legacy hub pair before the current pair disappears
key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-update-PREEDIT.md
    - .planning/phases/06-assertion-and-module-refinement/06-43-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - scripts/check-phase-06-hub-ledger.mjs
    - tests/scripts/check-phase-06-hub-ledger.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
key-decisions:
  - "Move all behavior-bearing update orchestration into update-flow.ts as private implementation details while preserving only the established public flow exports."
  - "Consolidate all 133 legacy behavior cases plus the three existing flow cases exactly once, retaining one end-to-end proof and the exact zero/one/many and Plan 01 notification arrays."
  - "Rotate the generic hub-ledger fixture to reinstall.ts/reinstall.test.ts before deleting update.ts/update.test.ts."
patterns-established:
  - "READY-gated hub retirement: fresh graph evidence, exhaustive ownership ledger, fixture rotation, atomic deletion, then full-tree stale-path proof."
requirements-completed: [TREF-07, TREF-09]
coverage:
  - id: D1
    description: Every update behavior case has one direct owner, including exact zero/one/many notifications, Plan 01 full arrays, and one end-to-end update proof.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: node --test tests/orchestrators/plugin/update-preflight.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/plugin/update-flow.test.ts
        status: pass
      - kind: unit
        ref: direct coverage for update-preflight.ts, update-swap.ts, update-cascade.ts, and update-flow.ts
        status: pass
      - kind: integration
        ref: 14 architecture, e2e, edge, integration, marketplace, enable-disable, and hub-ledger consumer suites
        status: pass
    human_judgment: false
  - id: D2
    description: The update hub and legacy test are absent, every qualified stale path is gone, and all symbols, callers, gates, tests, docs, and dependencies map to named acyclic owners.
    requirement: TREF-09
    verification:
      - kind: other
        ref: PRE-EDIT checker reports READY from fresh CodeGraph evidence and full-tree stale-path scans are empty
        status: pass
      - kind: unit
        ref: node --test tests/scripts/check-phase-06-hub-ledger.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck && npm run test:corresponding && npm run fallow && npm run lint
        status: pass
    human_judgment: false
duration: 16min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 43: Update Hub Retirement Summary

**Update orchestration and all 136 behavior cases now live in four named direct-tested owners, with the legacy hub pair deleted after an exhaustive READY ledger and reinstall fixture rotation.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-09-09T17:57:37Z
- **Completed:** 2026-09-09T18:13:26Z
- **Tasks:** 3
- **Files changed by task commits:** 15
- **Realized diff scale:** 212,226 estimate tokens (848,906 diff characters / 4)

## Accomplishments

- Consolidated all 133 legacy update behavior cases and all three existing flow cases into `update-flow.test.ts` exactly once. The resulting 136-case owner retains the sole end-to-end proof, exact zero/one/many notifications, and Plan 01 full-array assertions.
- Built `06-update-PREEDIT.md` from fresh CodeGraph evidence. Its `Status: READY` maps every hub export or responsibility, production caller, owner test, scanner, gate, documentation reference, completeness invariant, destination, and dependency edge with no unresolved cycle.
- Moved the behavior-bearing runner and cascade composition into `update-flow.ts`, kept them private, and deleted `update.ts` and `update.test.ts` atomically without a facade or forwarding export.
- Rotated the generic hub-ledger fixture to the tracked `reinstall.ts` / `reinstall.test.ts` pair before deletion, preserving the checker mechanics and all positive and negative assertions.
- Repointed every remaining in-phase source, test, architecture gate, and documentation ownership reference; the full-tree qualified stale-path scan is empty.

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate the update flow proof** - `3c444d63` (test)
2. **Task 2: PRE-EDIT update export/caller/dependency graph checkpoint** - `82589e3a` (test)
3. **Task 3: Delete update hub/test and prove ledger** - `bcb7678f` (refactor)

## Files Created/Modified

- `.planning/phases/06-assertion-and-module-refinement/06-update-PREEDIT.md` - READY ownership, caller, test, gate, documentation, completeness, dependency, and cycle ledger backed by fresh CodeGraph traces.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts` - Direct owner of public update operations plus the private runner and cascade-composition implementation formerly in the hub.
- `tests/orchestrators/plugin/update-flow.test.ts` - Single direct flow owner containing all 136 unique update behavior cases and the sole end-to-end proof.
- `scripts/check-phase-06-hub-ledger.mjs` - Removes the retired update hub from the active legacy set and retains reinstall/list as genuine legacy hubs.
- `tests/scripts/check-phase-06-hub-ledger.test.ts` - Uses the exact reinstall hub/test as its generic PRE-EDIT fixture and preserves the checker's negative controls.
- `extensions/pi-claude-marketplace/shared/errors.ts` - Attributes update cause-chain ownership to the named flow owner.
- `tests/architecture/no-lifecycle-default-enabled-read.test.ts` - Removes the deleted update hub from the lifecycle scanner inventory.
- `tests/architecture/no-orchestrator-network.test.ts` - Moves the documented enumeration/Git seam exemption to the merged flow owner.
- `tests/architecture/cross-op-convergence.test.ts`, `tests/edge/handlers/plugin/update.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/orchestrators/plugin/update-swap.test.ts`, and `docs/output-catalog.md` - Point ownership notes and catalog references to current direct owners.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - Deleted after READY authorization; behavior now resides in `update-flow.ts`.
- `tests/orchestrators/plugin/update.test.ts` - Deleted after its behavior cases moved exactly once into `update-flow.test.ts`.

## Decisions Made

- Kept `UpdatePluginRunner`, `UpdateCascadeComposer`, `updatePluginsWith`, and `updateSinglePluginWith` private inside `update-flow.ts`; they are implementation seams, not compatibility exports.
- Preserved the established public flow API (`UpdatePluginsFn`, `PluginUpdateOperations`, and `createPluginUpdateOperations`) and every existing caller contract.
- Kept synthetic placeholder terminology used by real failure-model tests and documentation. The scan found no unwired UI value, mock-only production path, TODO, FIXME, skipped test, or shipping stub.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical gate fixture] Rotated the generic hub-ledger fixture before deletion**

- **Found during:** Task 2
- **Issue:** The generic checker and its owner test still used the update hub/test as their retirement fixture, so deleting that pair would make the gate test a stale historical simulation instead of a genuine legacy-hub proof.
- **Fix:** Rotated the live set and generic fixture to the exact tracked `reinstall.ts` / `reinstall.test.ts` pair while preserving source scanning, ledger assertions, duplicate detection, and negative controls.
- **Files modified:** `scripts/check-phase-06-hub-ledger.mjs`, `tests/scripts/check-phase-06-hub-ledger.test.ts`
- **Verification:** Exact fixture paths exist; hub-ledger owner suite passes.
- **Committed in:** `82589e3a`

**2. [Rule 2 - Missing complete ownership migration] Repointed remaining stale gate and documentation owners**

- **Found during:** Task 3
- **Issue:** Atomic deletion exposed remaining qualified hub/test references and scanner inventories outside the four primary plan files.
- **Fix:** Repointed each reference to its actual flow, preflight, swap, or consolidated-test owner; removed the deleted hub from lifecycle scanning; and transferred the legitimate enumeration/Git exemption to `update-flow.ts`.
- **Files modified:** `shared/errors.ts`, three architecture tests, edge and marketplace owner tests, `update-swap.test.ts`, and `docs/output-catalog.md`
- **Verification:** Full-tree qualified stale-path scans are empty; all 14 lifecycle/consumer suites pass.
- **Committed in:** `bcb7678f`

**3. [Rule 1 - Lint defect] Corrected merged-owner import ordering**

- **Found during:** Task 3 verification
- **Issue:** The first mechanical merge ordered the new sibling imports differently from the repository's enforced Google-style import ordering.
- **Fix:** Reordered only the affected local imports.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`
- **Verification:** Repository ESLint and targeted Prettier pass.
- **Committed in:** `bcb7678f`

---

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 1)
**Impact on plan:** All changes were required to make the authorized deletion complete, keep the generic retirement gate genuine, and satisfy existing style enforcement. No compatibility surface or unrelated feature was added.

## Verification

- Four named update owner suites: **4/4 pass**, with no skips or todos.
- Direct coverage: `update-preflight.ts` **94/94 branches, 20/20 functions, 525/525 lines**; `update-swap.ts` **130/130, 37/37, 1197/1197**; `update-cascade.ts` **47/47, 11/11, 214/214**; `update-flow.ts` **134/134, 24/24, 994/994**.
- Lifecycle and consumer suites: **14/14 pass**, covering architecture scanners, import e2e, edge handler/register, transaction cascade, marketplace update, enable/disable, and the hub ledger.
- PRE-EDIT checker: **READY**, backed by `/tmp/phase06-update-preedit-codegraph.txt` and a second focused symbol trace.
- Hub-ledger owner suite: **pass** after reinstall fixture rotation.
- Full-tree qualified `update.ts` and `update.test.ts` stale-path scans: **empty**.
- `npm run typecheck`: pass.
- `npm run test:corresponding`: pass.
- `npm run fallow`: pass with no enforced issue.
- `npm run lint`: pass with zero warnings.
- Targeted Prettier across every changed Phase 06-43 file: pass.
- Direct-coverage negative controls: pass outside the sandbox after the sandbox reproduced its known child-process stderr suppression.
- Repository `npm run format:check`: reports only the preserved untracked `.mcp.json`, the known pre-existing formatting debt.

## Issues Encountered

- The repository-wide format gate remains red only for the pre-existing untracked `.mcp.json`. It was preserved byte-for-byte; every Phase 06-43 file passes targeted formatting.
- Existing unrelated Phase 1 review artifacts and local configuration changes were preserved unchanged and excluded from every task commit.

## Known Stubs

None. Existing uses of “placeholder” describe intentional synthetic failure records or test fixtures and are fully exercised.

## Threat Flags

None - the plan preserved the existing update state/path validation, notification order, and error redaction boundaries without adding a network endpoint, authentication path, file-access boundary, or schema change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 44 can begin reinstall-family refinement with the generic retirement checker already pointing at the genuine reinstall legacy pair.
- Update behavior now has four complete direct owner pairs and no legacy compatibility path.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The summary and READY ledger exist; both retired files are absent; all three task commits are present and match the persisted plan ledger; coverage metadata classifies both deliverables without error; and exact full-tree qualified stale-path scans are empty.
