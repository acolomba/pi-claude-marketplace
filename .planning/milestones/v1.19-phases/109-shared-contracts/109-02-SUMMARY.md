---
phase: 109-shared-contracts
plan: 02
subsystem: testing
tags: [node-test, completion-cache, typebox, filesystem, direct-coverage]

requires:
  - phase: 109-01
    provides: Exact atomic JSON persistence behavior used by completion cache rebuilds
provides:
  - Canonical mirrored owner for the completion cache public surface
  - Exact memory, disk, schema, poison, TTL, and invalidation evidence
affects: [shared-contracts, completions, marketplace-lifecycle, plugin-lifecycle]

actuals:
  tokens: 14019
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Case-owned temporary cache paths with public narrow invalidation
    - Named sibling rows for schema, cardinality, corruption, and TTL boundaries

key-files:
  created:
    - .planning/phases/109-shared-contracts/109-02-SUMMARY.md
  modified:
    - tests/shared/completion-cache.test.ts

key-decisions: []

patterns-established:
  - "Each cache case owns a temporary directory and clears memory through an existing public invalidation seam."
  - "TTL evidence uses injected integer-millisecond clocks at one-before, exact, and one-beyond boundaries."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The owner pins both public schemas and ManifestSoftFailError as complete structured values."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/completion-cache.test.ts#cache schemas and ManifestSoftFailError"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cold, warm, disk, poison, and reset paths preserve their exact public values and persistence effects."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "node --test tests/shared/completion-cache.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Adjacent schemas, corrupt inputs, collection cardinality, equal-row ordering, TTL edges, and invalidation failures are explicit."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/completion-cache.ts"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 02: Completion Cache Owner Summary

**A canonical mirrored owner now locks completion-cache schemas, two-tier reads, poison persistence, millisecond TTL boundaries, and all public invalidation effects.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-29T18:08:32Z
- **Completed:** 2026-08-29T18:18:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced shared reset-at-case-start behavior with case-owned temporary paths and existing public narrow invalidation.
- Pinned schema versions 2 and 6, exact marketplace bytes, plugin row persistence, structured soft-fail poison, and unexpected-error propagation.
- Resolved adjacent schemas, malformed and JSON-invalid files, empty and single-row caches, equal-row ordering, and TTL ages 599,999, 600,000, and 600,001 milliseconds.
- Reached 100 percent direct function, line, and branch coverage without changing production bytes or exports.

## Caller-Facing Contract

The production trace found these live consumers:

- edge/completions/data.ts calls getPluginIndex from its install, aggregate, and info completion-map paths. edge/completions/provider.ts reaches those accessors.
- orchestrators/edge-deps.ts and edge/completions/data.ts use ManifestSoftFailError to distinguish manifest soft failure from unexpected state failure.
- Marketplace add and remove call invalidateMarketplaceNames.
- Marketplace add, update, and remove plus plugin install, update, uninstall, and reinstall call or inject dropMarketplaceCache.

getMarketplaceNames, invalidateMarketplaceCache, and resetCompletionCache currently have no production call site. They remain public seams with the same values and effects; the owner proves them directly rather than adding test-only state. The live callers continue to observe schema-version rejection, inclusive ten-minute freshness, poison persistence until invalidation, memory-only narrow invalidation, and file-removing destructive invalidation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical owner** - 95c8a2f8 (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - e1817022 (test)

## Files Created or Modified

- tests/shared/completion-cache.test.ts - Direct owner for every completion-cache export and public edge.
- .planning/phases/109-shared-contracts/109-02-SUMMARY.md - Execution evidence, caller trace, and verification record.

## Decisions Made

None. The plan and locked lowercase test contract were sufficient.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

An initial multiline satisfies expression and unnecessary async callback declarations failed parser and lint checks. Both were corrected before the Task 1 commit; no shipped commit contains either issue.

## Verification

- node --test tests/shared/completion-cache.test.ts passed.
- Direct coverage passed at 100 percent functions, lines, and branches: 13/13 functions, 439/439 lines, and 55/55 branches.
- Pair-local ESLint and Prettier checks passed.
- npm run typecheck passed, covering the production callers and public types.
- git diff --check passed.
- The production source hash remained 650fafb2679c19ba7dc16b6aa2377cc4fd038a72b69b0be5ac226e0ef046c219.

## Known Stubs

None.

## Threat Review

The high-severity cache tampering and denial-of-service threat is mitigated by exact schema, corruption, poison, TTL, and invalidation evidence. The test-only change adds no endpoint, authentication path, schema mutation, or new filesystem trust boundary.

## User Setup Required

None. Every case uses a local temporary directory and no external service.

## Next Phase Readiness

P109-02 is ready for phase verification. The remaining Phase 109 source-owner pairs can proceed independently.

## Self-Check: PASSED

- The owner and summary files exist.
- Task commits 95c8a2f8 and e1817022 exist.
- Focused owner, direct coverage, lint, format, type, and diff checks passed.
- The paired production source remained byte-identical.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_
