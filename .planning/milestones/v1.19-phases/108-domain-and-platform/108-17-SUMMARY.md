---
phase: 108-domain-and-platform
plan: 17
subsystem: testing
tags: [node-test, direct-coverage, path-validation, filesystem-containment]

requires:
  - phase: 108-01
    provides: Phase 108 lowercase AAA and atomic owner-test pattern
provides:
  - Canonical mirrored owner for the absolute plugin-root brand
  - Exact accepted-path, idempotency, and parent-segment contracts
  - Exact empty, NUL, relative, and PATH-delimiter rejection contracts
affects: [108-domain-and-platform, plugin-root, unit-test-refactor]

actuals:
  tokens: 2112
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [lowercase AAA phases, case-owned temporary roots, direct pair coverage]

key-files:
  created:
    - .planning/phases/108-domain-and-platform/108-17-SUMMARY.md
  modified:
    - tests/domain/plugin-root.test.ts

key-decisions:
  - "Resolve relative path segments under the case-owned root before branding; preserve the public rejection of unrooted relative text."
  - "Build delimiter cases from node:path so the same cases cover the active platform delimiter without hard-coded POSIX assumptions."

patterns-established:
  - "Path containment: compare each returned or source path relative to its case-owned temporary root."
  - "Rejected path purity: compare the temporary directory contents with an empty whole value after each exact failure."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: "The canonical owner preserves exact absolute, resolved-relative, idempotent, and parent-segment plugin roots."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/plugin-root.test.ts#returns an absolute root resolved from relative segments"
        status: pass
      - kind: unit
        ref: "tests/domain/plugin-root.test.ts#preserves parent segments that resolve within the temporary root"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/plugin-root.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty, NUL, relative, and all delimiter-position inputs fail exactly without path escape or filesystem residue."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/plugin-root.test.ts#rejects each invalid root without creating filesystem content"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 26min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 17: Plugin-root owner summary

**Exact path and guard contracts now protect plugin-root branding with case-owned temporary roots and 100 percent direct coverage.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-08-29T05:50:00Z
- **Completed:** 2026-08-29T06:16:09Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Accepted cases compare complete absolute outputs for resolved segments, absolute text, repeated branding, and preserved parent segments.
- Invalid cases compare exact errors for empty text, NUL, relative text, and every delimiter position.
- Each runtime case owns a temporary root, proves containment, and removes the root through the test context.

## Task commits

Each task was committed atomically:

1. **Task 1: Normalize valid absolute, relative, parent, and idempotent roots** - `29fccda6` (test)
2. **Task 2: Lock invalid inputs and temporary-path containment** - `012adc43` (test)

**Plan metadata:** committed after this summary was written.

## Files created or modified

- `tests/domain/plugin-root.test.ts` - Owns exact accepted paths, guard failures, containment, and cleanup.
- `.planning/phases/108-domain-and-platform/108-17-SUMMARY.md` - Records plan results and coverage evidence.

## Decisions made

- The resolved-relative case joins relative segments to its temporary root before it calls the production function.
- The independent relative-text case preserves the production function's exact `not absolute` failure.
- Delimiter cases use `path.delimiter` at the leading, middle, and trailing positions, plus the delimiter alone.

## Deviations from plan

None. The plan ran within the single owner-test pair.

## Issues encountered

The sandboxed full check blocked three unchanged Git-backed tests. The unrestricted rerun passed all unit and integration checks.

## User setup required

None. The tests use no network service, credentials, repository path, or fixed system path.

## Next phase readiness

The plugin-root pair is ready for the remaining Phase 108 domain and platform owners.

## Self-Check: PASSED

The owner test, summary, and both task commits exist in the assigned isolated worktree.

---

*Phase: 108-domain-and-platform*
*Completed: 2026-08-29*
