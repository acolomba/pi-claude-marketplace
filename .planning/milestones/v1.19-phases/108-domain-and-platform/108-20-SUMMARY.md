---
phase: 108-domain-and-platform
plan: 20
subsystem: testing
tags: [node-test, direct-coverage, filesystem, sha256]

requires:
  - phase: 108-01
    provides: Canonical lowercase AAA owner structure and Phase 108 execution foundation
provides:
  - Canonical mirrored owner for content-derived and commit-SHA versions
  - Literal hash contracts for text normalization, ignored paths, and symlink targets
  - Stable empty-tree, traversal-order, equal-content path, and one-byte mutation boundaries
affects: [108-domain-and-platform, version-hashing, unit-test-refactor]

actuals:
  tokens: 1157
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [lowercase AAA phases, case-owned temporary trees, literal complete hash observations]

key-files:
  created:
    - .planning/phases/108-domain-and-platform/108-20-SUMMARY.md
  modified:
    - tests/domain/version.test.ts

key-decisions:
  - "Pin complete version strings as literals instead of computing expected hashes in test code."
  - "Give each case one cleanup-owned sandbox; comparison cases use isolated subtrees inside that sandbox."

patterns-established:
  - "Hash boundary observation: compare complete hash- and sha-prefixed outputs, including all 12 hexadecimal characters."
  - "Filesystem order control: create equivalent trees in opposite insertion orders and compare both with one literal version."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: "Content-derived versions preserve exact normalization, ignored-entry, symlink-target, and SHA truncation contracts."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/version.test.ts#normalizes a UTF-8 BOM and CRLF line endings"
        status: pass
      - kind: unit
        ref: "tests/domain/version.test.ts#ignores Git, dependency, and Finder entry contents"
        status: pass
      - kind: unit
        ref: "tests/domain/version.test.ts#does not hash symlink target bytes"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/version.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Empty trees, opposite insertion orders, sorted equal-content paths, and one-byte mutations have fixed complete hashes."
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "tests/domain/version.test.ts#returns the fixed empty-tree hash"
        status: pass
      - kind: unit
        ref: "tests/domain/version.test.ts#returns one hash for opposite filesystem insertion orders"
        status: pass
      - kind: unit
        ref: "tests/domain/version.test.ts#hashes equal content by sorted path and changed bytes"
        status: pass
      - kind: other
        ref: "npm run check"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 20: Version hashing owner summary

**Literal complete hashes now protect content normalization, ignored inputs, SHA truncation, and deterministic filesystem traversal at 100 percent direct coverage.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-29T06:18:23Z
- **Completed:** 2026-08-29T06:30:41Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Content cases pin ordinary bytes, BOM and CRLF normalization, bare carriage returns, ignored entries, and symlink target exclusion.
- SHA versions pin the exact `sha-` prefix and first 12 commit characters.
- Empty, opposite-order, equal-content path, and one-byte mutation cases pin deterministic complete content hashes.

## Task commits

Each task was committed atomically:

1. **Task 1: Normalize content, normalization, ignore, and SHA cases** - `7711a973` (test)
2. **Task 2: Lock empty-tree and equal-element traversal ordering** - `0ee91d6b` (test)

**Plan metadata:** committed after this summary was written.

## Files created or modified

- `tests/domain/version.test.ts` - Owns exact content, normalization, ignore, symlink, traversal, and truncation boundaries.
- `.planning/phases/108-domain-and-platform/108-20-SUMMARY.md` - Records plan results and automated coverage evidence.

## Decisions made

- Expected hashes remain independent literals. The test never calls production code to build an expected version.
- Every runtime case owns one temporary sandbox and removes it through `t.after()`.

## Deviations from plan

None. The plan ran within the single owner-test pair.

## Issues encountered

The restricted `npm run check` could not open three local loopback Git fixtures. The approved elevated rerun passed the full unit and integration gates.

## User setup required

None. The tests use synthetic files and no external services, credentials, or repository data.

## Verification

- `node --test tests/domain/version.test.ts` passed.
- Direct coverage passed with 25 of 25 branches, 6 of 6 functions, and 107 of 107 lines.
- The AAA structure scan found nine runtime cases with exact lowercase comments and required blank lines.
- `npm run check` passed with 3,715 unit tests, one platform-specific skip, and 21 integration tests.

## Next phase readiness

The version owner is green and ready for the remaining Phase 108 pair plans.

## Self-Check: PASSED

The owner test, summary, and both task commits exist in the isolated worktree.

---

*Phase: 108-domain-and-platform*
*Completed: 2026-08-29*
