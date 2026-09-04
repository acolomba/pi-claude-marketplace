---
phase: 112-hook-runtime
plan: 28
subsystem: hook-runtime
tags: [typescript, node-test, filesystem, symlink-containment, atomic-write, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Locked filesystem ownership, containment, lifecycle, and direct owner contracts
provides:
  - Complete real-filesystem proof for missing, non-directory, nested, contained-link, and escaping-link hook trees
  - Exact stage and remove lifecycle evidence for safe names, atomic bytes, confinement, idempotence, and absent artifacts
  - Deterministic TOCTOU and unexpected-I/O coverage through restored Node filesystem boundaries
affects:
  - 112-14 hook barrel ownership
  - MOD-05 hook-runtime verification
actuals:
  tokens: 10586
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns:
    - Case-owned real temporary trees with portable directory links and finally cleanup
    - Independently normalized realpath and readlink expectations for typed containment errors
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
    - tests/bridges/hooks/stage.test.ts
    - tests/bridges/hooks/symlink-escape.test.ts
key-decisions:
  - Removed only the private stack-pop undefined guard after live CodeGraph proof established that the guarded state is unreachable.
  - Retained readSymlinkTargetSafe as a reachable TOCTOU defense and exercised it through restored Node filesystem bindings without a production seam.
  - Absorbed the supplemental suite's unique containment evidence into the mirrored owner before deleting the duplicate carrier.
patterns-established:
  - Filesystem cases derive expected normalized paths independently from case-owned real roots and link targets.
  - Hard-to-stage filesystem races use narrow case-local Node boundary mocks with registered restoration and syncBuiltinESMExports.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: The stage owner distinguishes missing and non-directory hook trees, ordinary nesting, contained directory links, direct and buried escapes, unreadable diagnostics, concurrent replacement, and unexpected I/O.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/stage.test.ts#rejects a direct directory link that escapes the plugin root
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/stage.test.ts#uses the unreadable target marker when escape diagnostics cannot read the link
        status: pass
      - kind: unit
        ref: npm run test:coverage:direct -- tests/bridges/hooks/stage.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Staging and removal preserve safe-name enforcement, exact atomic bytes, hooks-root confinement, idempotent restaging, and existing or absent artifact semantics.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/stage.test.ts#writes hooks.json and returns its absolute path
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/stage.test.ts#writes the same bytes when the hook config is staged twice
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/stage.test.ts#removes an existing staged plugin directory
        status: pass
    human_judgment: false
  - id: D3
    description: Live source proof permits only the unreachable private guard removal, while the duplicated symlink supplemental is absent and no production symbol or test seam is added.
    requirement: MOD-05
    verification:
      - kind: other
        ref: codegraph explore assertNoSymlinkEscapeInHooksSubtree and callers
        status: pass
      - kind: other
        ref: test ! -e tests/bridges/hooks/symlink-escape.test.ts
        status: pass
      - kind: other
        ref: git diff afd62706^..50c59c78 -- extensions/pi-claude-marketplace/bridges/hooks/stage.ts
        status: pass
    human_judgment: false
duration: 28 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 28: Stage lifecycle summary

**The direct owner now proves every real-filesystem containment and stage/remove lifecycle branch at 100% coverage while production changes remove only one live-proven unreachable guard.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-08-31T06:54:20Z
- **Completed:** 2026-08-31T07:22:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Proved missing, non-directory, nested, contained-link, direct-escape, and buried-escape trees with portable case-owned filesystem fixtures and exact normalized errors.
- Covered deterministic unreadable-link diagnostics, concurrent link replacement, and unexpected filesystem failures through restored Node builtin boundaries.
- Proved exact staged bytes and confinement, idempotent restaging, safe-name rejection, and existing or absent removal behavior.
- Retired the duplicate symlink supplemental after its unique evidence moved into the mirrored owner.

## Task Commits

1. **Task 1: Prove real filesystem containment and remove unreachable guard** - `afd62706`
2. **Task 2: Complete stage/remove lifecycle contracts** - `ae1462ed`
3. **Task 2 follow-up: Retire duplicate symlink supplemental** - `50c59c78`

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` - Removes only the CodeGraph-proven unreachable undefined result after the guarded stack pop.
- `tests/bridges/hooks/stage.test.ts` - Owns complete real-filesystem containment, atomic staging, safe-name, idempotence, and removal evidence.
- `tests/bridges/hooks/symlink-escape.test.ts` - Deleted after all distinct symlink-safety assertions moved into the owner.

## Decisions Made

- Removed the private undefined guard only after live CodeGraph source and call-path proof confirmed that the stack starts nonempty, is popped once only while nonempty, and receives directory paths only.
- Kept `readSymlinkTargetSafe` because concurrent replacement can still make diagnostic `readlink` fail after successful resolution and containment failure.
- Used portable Windows junction or POSIX directory-link fixtures and derived expected normalized values through independent `realpath` and `readlink` calls.
- Used case-local `node:fs` method mocks plus `syncBuiltinESMExports()` only for deterministic unreadable-link, replacement-race, and otherwise unstable I/O branches; every binding is restored before cleanup.
- Kept the phase-wide `MOD-05` requirement pending until all 31 Phase 112 owners complete.

## Validation

- `node --test tests/bridges/hooks/stage.test.ts` passed.
- `npm run test:coverage:direct -- tests/bridges/hooks/stage.test.ts` passed with 31/31 branches, 7/7 functions, and 233/233 lines.
- `test ! -e tests/bridges/hooks/symlink-escape.test.ts` passed.
- `npm run typecheck` passed.
- Targeted ESLint and Prettier checks passed for the production and owner files.
- All 17 runtime cases use lowercase phases: 15 use separate arrange, act, and assert sections, while two rejection cases each use one `act & assert` expression.
- Commits `afd62706`, `ae1462ed`, and `50c59c78` form a contiguous ordered sequence and collectively modify only the planned production file, owner test, and deleted supplemental.

## Deviations from Plan

None - plan execution stayed within the declared production, owner, and supplemental scope.

## Issues Encountered

The supplemental deletion was omitted from the first Task 2 commit. The orchestrator immediately captured that already-verified deletion in scoped follow-up commit `50c59c78`; no source or owner-test content changed in the follow-up.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Missing trees, absent staged artifacts, empty hook objects, and unreadable-link markers are explicit contract inputs or outcomes.

## Security Review

Real direct and buried escape cases preserve the configured hook-path trust boundary, while exact safe-name and staging-confinement assertions prevent traversal outside the hooks root. This plan adds no runtime API, filesystem seam, export, or trust boundary.

## Next Phase Readiness

Plan 112-14 can consume the unchanged public stage surface for barrel proof. The stage pair is ready for phase-wide MOD-05 verification, and no duplicate symlink carrier remains.

## Self-Check: PASSED

- The production source, direct owner, and canonical summary exist; the duplicate supplemental is absent.
- Task commits `afd62706`, `ae1462ed`, and `50c59c78` exist in a contiguous parent-child sequence.
- The three task-scope commits collectively modify only the planned production file, owner test, and deleted supplemental.
- Focused tests, 100% direct coverage, supplemental absence, typecheck, targeted lint, targeted format, diff, and coverage-metadata checks pass.
