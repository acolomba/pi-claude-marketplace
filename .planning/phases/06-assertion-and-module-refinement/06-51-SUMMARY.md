---
phase: 06-assertion-and-module-refinement
plan: "51"
subsystem: testing
tags: [typescript, node-test, direct-coverage, architecture-gates, module-retirement]

requires:
  - phase: 06-50
    provides: four direct plugin-list owners and the vacated legacy list pair
provides:
  - READY export, caller, owner, gate, documentation, completeness, and dependency ledger
  - final deletion of the legacy plugin list hub and its paired test shell
  - exact seven-retired-hub Phase 6 closure census with neutral PRE-EDIT unit fixtures
affects: [06-52, TREF-07, TREF-09, phase-06-closure]

plan_head_before: 094a3916066c0c08ebe38a80f96e08b238e93a90
actuals:
  tokens: 5270
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - fresh fail-closed PRE-EDIT evidence before destructive module retirement
    - neutral checker fixtures separated from the production retired-path census

key-files:
  created:
    - .planning/phases/06-assertion-and-module-refinement/06-list-PREEDIT.md
  modified:
    - scripts/check-phase-06-hub-ledger.mjs
    - tests/scripts/check-phase-06-hub-ledger.test.ts
    - tests/architecture/no-orchestrator-network.test.ts
    - tests/architecture/no-split-01-cast-reads.test.ts
    - tests/architecture/scope-fences-63.test.ts
    - docs/plans/2026-08-07-manifest-independent-installed-plugin-info-design.md
  deleted:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - tests/orchestrators/plugin/list.test.ts

key-decisions:
  - "Retain list behavior in four direct owners; the vacated legacy hub and test have no compatibility facade."
  - "Use a neutral example for PRE-EDIT checker mechanics while production closure enforces the exact seven retired hub paths."

patterns-established:
  - "Final hub retirement: capture fresh READY evidence, commit it, delete the pair atomically, then prove zero qualified stale paths."
  - "Historical path gates may compose path segments so their own source is not a stale qualified-path hit while exact deletion enforcement remains active."

requirements-completed: [TREF-07, TREF-09]

coverage:
  - id: D1
    description: Plugin list behavior remains owned once across installed-row, candidate-row, orphan-fold, and flow pairs with exact cardinality, ordering, folding, and output bytes.
    requirement: TREF-07
    verification:
      - kind: unit
        ref: node --test tests/orchestrators/plugin/list-installed-row.test.ts tests/orchestrators/plugin/list-candidate-row.test.ts tests/orchestrators/plugin/list-orphan-fold.test.ts tests/orchestrators/plugin/list-flow.test.ts
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct for each of the four list production owners
        status: pass
    human_judgment: false
  - id: D2
    description: The legacy list hub and owner test are absent with zero stale qualified paths and exact phase-wide closure inventories.
    requirement: TREF-09
    verification:
      - kind: other
        ref: node scripts/check-phase-06-hub-ledger.mjs closure --owner-count 30 --catalog-fixture-count 20
        status: pass
      - kind: other
        ref: npm run test:corresponding && npm run fallow
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 51: Final Plugin List Hub Retirement Summary

**Plugin list cardinality, stable ordering, orphan folding, and exact output now live only in four direct-tested owners, with the legacy hub pair deleted and the seven-hub closure census sealed.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-09T21:15:11Z
- **Completed:** 2026-09-09T21:25:06Z
- **Tasks:** 3
- **Files changed:** 12

## Accomplishments

- Repointed list design, architecture gates, and ownership comments to `list-flow.ts` and its direct test.
- Captured a fresh 606-line CodeGraph trace and a READY ledger covering moved exports, production callers, test owners, gates, docs, completeness checks, and directed dependency edges before deletion.
- Deleted the two-line legacy hub and four-line test shell with no facade, re-export, or stale qualified path.
- Preserved an independently tested PRE-EDIT checker using a neutral fixture and strengthened production closure to require all 30 owners, 20 catalog fixtures, seven retired hubs, and the exact residual patch census.

## Task Commits

1. **Task 06-51-01: Repoint list docs/gates and consolidate proof** — `9ac8ecc8`
2. **Task 06-51-02: PRE-EDIT list export/caller/dependency graph checkpoint** — `03a65005`
3. **Task 06-51-03: Delete list hub/test and prove ledger** — `83caed76`
4. **Task 06-51-02 follow-up: Format the PRE-EDIT ledger** — `84ad69fc`

## Files Created/Modified

- `.planning/phases/06-assertion-and-module-refinement/06-list-PREEDIT.md` — READY deletion authority backed by fresh CodeGraph evidence.
- `scripts/check-phase-06-hub-ledger.mjs` — exact 30-owner, 20-fixture, seven-retired-hub, and patch-residual closure gate.
- `tests/scripts/check-phase-06-hub-ledger.test.ts` — neutral PRE-EDIT mechanics and exact retired-hub census tests.
- `tests/architecture/no-orchestrator-network.test.ts` — network-free list gate now targets the flow owner.
- `tests/architecture/no-split-01-cast-reads.test.ts` — historical cast-read reference now names the flow owner.
- `tests/architecture/scope-fences-63.test.ts` — hook-column fence now scans the flow owner.
- `docs/plans/2026-08-07-manifest-independent-installed-plugin-info-design.md` — installed-inventory design now names the flow owner.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — intentionally deleted after READY proof.
- `tests/orchestrators/plugin/list.test.ts` — intentionally deleted after all cases were confirmed in direct owners.

## Verification

- `npm run typecheck` — passed.
- `npm run test:corresponding` — passed.
- `npm run fallow` — passed with zero enforced issues.
- Focused architecture, four list-owner, and hub-ledger suite — 8 files passed; zero failures, skips, or todos.
- Direct coverage — each of `list-installed-row.ts`, `list-candidate-row.ts`, `list-orphan-fold.ts`, and `list-flow.ts` passed at 100% lines, branches, and functions.
- Direct-coverage negative controls — passed outside the sandboxed subprocess boundary.
- Phase 6 closure — 30 owners, 20 fixtures, seven absent hubs, 2 files/18 `syncBuiltinESMExports` calls, and 2 files/2 `createRequire` calls passed.
- Qualified legacy production and test path scans — zero matches across `extensions`, `tests`, `scripts`, `docs`, and `eslint.config.js`.
- Scoped Prettier and ESLint checks — passed; repository-wide formatting was not used because unrelated `.mcp.json` is intentionally untracked.

## Decisions Made

- The four existing direct pairs remain the sole behavioral owners. The legacy pair was deleted rather than retained as a forwarding seam.
- With no genuine live legacy hub pair remaining, PRE-EDIT unit tests use a neutral example fixture. Production closure separately retains the exact seven retired paths and fails if any returns.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Sealed the phase-wide retired-hub census after removing the final live fixture**

- **Found during:** Task 06-51-03
- **Issue:** The generic closure checker still carried only the rotating list hub, while the phase-wide closure contract requires all seven retired hubs after the final deletion.
- **Fix:** Replaced the rotating live fixture with a neutral PRE-EDIT test fixture and made `LEGACY_HUBS` enforce the exact seven retired paths without introducing a stale qualified-path match in the checker itself.
- **Files modified:** `scripts/check-phase-06-hub-ledger.mjs`, `tests/scripts/check-phase-06-hub-ledger.test.ts`
- **Verification:** Checker unit tests and the full closure command pass; planting any retired hub still fails closure.
- **Committed in:** `9ac8ecc8`, `83caed76`

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The change strengthens the already-required production completeness gate and keeps PRE-EDIT mechanics independently tested without fabricating a live production pair.

## Issues Encountered

- The linked worktree's parent Git metadata is outside the normal workspace sandbox. Scoped commits succeeded with the required metadata permission; unrelated dirty files remained unstaged.
- The direct-coverage negative-control subprocess cannot observe its expected boundary inside the sandbox. The unchanged control passed when rerun outside the sandbox, as expected for this repository.
- Best-effort deviation registration in `.planning/WINDOWS.md` was skipped because its pre-existing rendered table disagrees with its fenced JSON source for rows 9 and 30. This plan did not alter that unrelated ledger.

## Known Stubs

None.

## Threat Flags

None. The plan removes a compatibility path and changes no network endpoint, authentication path, schema, persistence contract, or file-access boundary.

## User Setup Required

None.

## Next Phase Readiness

Plan 06-52 can run the full Phase 6 integration gate against an exact 30-owner, 20-fixture, seven-retired-hub census. There are no Plan 06-51 blockers.

## Self-Check: PASSED

- The PRE-EDIT ledger and summary exist.
- The legacy hub and paired test are absent.
- All four task commits exist in repository history.
- Both qualified stale-path scans are empty.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_
