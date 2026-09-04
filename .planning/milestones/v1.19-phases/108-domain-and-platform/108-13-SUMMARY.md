---
phase: 108-domain-and-platform
plan: 13
subsystem: testing
tags: [node-test, direct-coverage, manifest-cache, filesystem-races]

requires:
  - phase: 108-01
    provides: Lowercase AAA owner structure and direct coverage baseline
provides:
  - Canonical mirrored owner for the manifest cache
  - Whole-value and identity coverage for positive and negative cache hits
  - Deterministic invalidation, stat-miss, and vanished-file race coverage
affects: [108-domain-and-platform, manifest-loading, unit-test-refactor]

actuals:
  tokens: 3687
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [fresh cache per case, temporary filesystem boundary, whole-value plus identity assertions]

key-files:
  created:
    - .planning/phases/108-domain-and-platform/108-13-SUMMARY.md
  modified:
    - tests/domain/manifest-cache.test.ts

key-decisions:
  - "Set both path fixtures to one fixed timestamp so equal metadata cannot mask path-key behavior."
  - "Assert complete manifests and errors before reference identity and loader interaction assertions."

patterns-established:
  - "Cache observation: compare the complete outcome, then prove reference identity and exact loader calls."
  - "Filesystem race: return distinct outcomes before and after disappearance to prove that the cache retries."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: "The owner proves path-scoped cache identity and reloads after either metadata field changes."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest-cache.test.ts#returns an unchanged entry by reference without reloading"
        status: pass
      - kind: unit
        ref: "tests/domain/manifest-cache.test.ts#caches equal-metadata entries independently by manifest path"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/manifest-cache.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner proves negative-cache identity, stat misses, and retry behavior after a file disappears."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest-cache.test.ts#rethrows an unchanged negative entry by identity"
        status: pass
      - kind: unit
        ref: "tests/domain/manifest-cache.test.ts#treats each stat failure as a miss instead of a cached success"
        status: pass
      - kind: unit
        ref: "tests/domain/manifest-cache.test.ts#retries a failure when the file disappears during loading"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 13: Manifest cache owner summary

**Whole-value outcomes, object identity, metadata invalidation, and filesystem races now protect the manifest cache at 100 percent direct coverage.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-29T05:32:12Z
- **Completed:** 2026-08-29T05:46:11Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Cache-hit cases compare complete manifests and prove that unchanged entries retain object identity.
- Equal metadata cannot merge entries for different paths, and mtime or size changes each force a reload.
- Negative entries preserve the complete error object, while stat failures and vanished files retry the loader.

## Task commits

Each task was committed atomically:

1. **Task 1: Normalize cache hit, invalidation, and identity cases** - `cfcfc26a` (test)
2. **Task 2: Lock negative caching and filesystem-race paths** - `36b5568e` (test)

**Plan metadata:** committed after this summary was written.

## Files created or modified

- `tests/domain/manifest-cache.test.ts` - Owns cache hits, invalidation, negative entries, stat misses, and file races.
- `.planning/phases/108-domain-and-platform/108-13-SUMMARY.md` - Records plan results and coverage evidence.

## Decisions made

- Both path fixtures use one fixed timestamp. Their equal size and mtime isolate path identity as the tested variable.
- Each outcome receives a complete structural assertion before its identity and loader call assertions.

## Deviations from plan

None. The plan ran within the single owner-test pair.

## Issues encountered

The first sandboxed `npm run check` could not run socket and Git transport cases. The approved unrestricted rerun passed all unit and integration gates.

## User setup required

None. Every case uses a temporary directory and injected loader behavior.

## Next phase readiness

The manifest-cache pair is complete. Later Phase 108 plans can rely on its path-scoped cache and race contracts.

## Self-Check: PASSED

The owner test, summary, and both task commits exist in the isolated worktree.

---

*Phase: 108-domain-and-platform*
*Completed: 2026-08-29*
