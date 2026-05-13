---
phase: 07-integration-pi-wiring
plan: 02
subsystem: domain
tags: [nfr-8, manifest, architecture-test, marketplace]

requires:
  - phase: 06-edge-layer-tab-completion
    provides: completion resolver and orchestrator surfaces that read manifests
provides:
  - loadMarketplaceManifest domain seam for marketplace.json reads
  - migrated production callers for manifest-path reads
  - architecture gate enforcing the manifest read seam
affects: [phase-7, marketplace-orchestrators, plugin-orchestrators, completions]

tech-stack:
  added: []
  patterns: [domain seam, static architecture test, comment-stripped source scan]

key-files:
  created:
    - tests/architecture/manifest-read-seam.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/manifest.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - tests/domain/manifest.test.ts

key-decisions:
  - "NFR-8 ships the manifest read seam only; mtime caching remains deferred."
  - "orchestrators/edge-deps.ts was migrated with the planned callers because it also reads cached marketplace manifests for completions."

patterns-established:
  - "Manifest-path reads use domain/manifest.ts::loadMarketplaceManifest."
  - "Architecture tests strip comments before matching forbidden source patterns."

requirements-completed: [NFR-8]

duration: 4min
completed: 2026-05-11
---

# Phase 07 Plan 02: NFR-8 Manifest Read Seam Summary

**Marketplace manifest reads now route through a single domain seam enforced by an architecture test.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-11T19:42:50Z
- **Completed:** 2026-05-11T19:47:13Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments

- Added `loadMarketplaceManifest(manifestPath)` to `domain/manifest.ts` with JSON parsing and existing marketplace schema validation.
- Migrated marketplace add/update, plugin install/list/update, and completion resolver manifest loads to the domain seam.
- Added `tests/architecture/manifest-read-seam.test.ts` to fail if `marketplace.json` read contexts appear outside `domain/manifest.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing seam tests** - `bfa0aca` (test)
2. **Task 1 GREEN: Add loadMarketplaceManifest seam** - `3245237` (feat)
3. **Task 2: Migrate direct manifest readers** - `6ad96ce` (refactor)
4. **Task 3: Add architecture gate** - `533321c` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/manifest.ts` - owns the manifest read and validation seam.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - uses the seam for cloned and local path-source marketplace manifests.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - validates refreshed manifests through the seam.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` - loads cached marketplace manifests through the seam.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` - soft-fail manifest loading now delegates to the seam.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - update manifest loading now delegates to the seam.
- `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` - completion cache resolver now delegates manifest reads to the seam.
- `tests/domain/manifest.test.ts` - covers seam success and schema-invalid rejection.
- `tests/architecture/manifest-read-seam.test.ts` - enforces NFR-8 single-reader architecture.

## Decisions Made

- Kept NFR-8 to the seam only; no cache object, mtime tracking, or invalidation layer was added.
- Migrated `orchestrators/edge-deps.ts` as a Rule 2 correctness addition because it performs production manifest-path reads for completions even though it was omitted from Task 2's file list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Migrated completion resolver manifest reads**
- **Found during:** Task 2 (Migrate all direct marketplace.json readers to the seam)
- **Issue:** `orchestrators/edge-deps.ts` still read and parsed `mp.manifestPath` directly, which would leave a production manifest-path reader outside the NFR-8 seam.
- **Fix:** Replaced the direct `readFile` / `JSON.parse` / validator block with `loadMarketplaceManifest(mp.manifestPath)`.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts`
- **Verification:** `npm test -- tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/update.test.ts tests/edge/completions/data.test.ts`; `node --test tests/architecture/manifest-read-seam.test.ts`
- **Committed in:** `6ad96ce`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required to satisfy NFR-8 across the production completion path; no scope creep beyond the seam.

## Issues Encountered

- Task 3's architecture test passed immediately because Tasks 1 and 2 had already established the seam before the gate was added. The RED/GREEN shape is therefore partial for Task 3, but the gate verifies the intended behavior.
- Pre-commit formatting adjusted the new architecture test before its successful commit.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None.

## TDD Gate Compliance

- Task 1 has RED (`bfa0aca`) and GREEN (`3245237`) commits.
- Task 3 is test-only and landed as a passing architecture gate after the seam was already implemented.

## Verification

- `node --test tests/domain/manifest.test.ts` - passed (27 tests)
- `npm run typecheck` - passed
- `npm test -- tests/orchestrators/marketplace/add.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/install.test.ts tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/update.test.ts tests/edge/completions/data.test.ts` - passed (804 tests during task verification; 805 including the architecture gate in final verification)
- `node --test tests/architecture/manifest-read-seam.test.ts` - passed

## Next Phase Readiness

Ready for Plan 07-03. Future manifest mtime caching can wrap `loadMarketplaceManifest` without changing orchestrator or completion code.

## Self-Check: PASSED

- Found `extensions/pi-claude-marketplace/domain/manifest.ts`
- Found `tests/architecture/manifest-read-seam.test.ts`
- Found commit `bfa0aca`
- Found commit `3245237`
- Found commit `6ad96ce`
- Found commit `533321c`

---

*Phase: 07-integration-pi-wiring*
*Completed: 2026-05-11*
