---
phase: 111-non-hook-component-bridges
plan: 24
subsystem: testing
tags: [typescript, node-test, skills, filesystem, direct-coverage]

requires:
  - phase: 110-core-platform-and-persistence
    provides: Lowercase test structure, direct coverage rules, and exact filesystem evidence patterns.
provides:
  - Canonical direct owner for plugin skill discovery.
  - Exact proof for relative, absolute, self-directory, symlink, entry-filter, and collision behavior.
affects: [phase-111-verification, security-review, skills-bridge]

actuals:
  tokens: 8617
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - Case-local temporary plugin roots with cleanup registered through the test context.
    - Complete discovered-skill arrays and exact collision warnings authored inside each case.

key-files:
  created: []
  modified:
    - tests/bridges/skills/discover.test.ts

key-decisions:
  - "Kept skills/discover.ts byte-identical because its public function exposes every required branch."
  - "Used a directory link in every platform instead of skipping the symlink-refusal case on Windows."
  - "Compared complete ordered results and exact warnings to prove first-wins collision behavior."

patterns-established:
  - "Skill discovery cases allocate, populate, and clean one private filesystem tree per test."
  - "Hostile-entry tests distinguish metadata-only discovery from document content reads."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "Skill discovery resolves relative, absolute, and self-directory declarations with stable ordering."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/skills/discover.test.ts#parent and self-directory discovery cases"
        status: pass
      - kind: other
        ref: "node --test tests/bridges/skills/discover.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Skill discovery rejects hostile entries and applies exact first-wins collision rules."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/skills/discover.test.ts#filter and collision cases"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/discover.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 24: Skill discovery owner summary

**The direct owner now proves stable plugin skill traversal, self-directory handling, hostile-entry refusal, and exact first-wins collisions.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-30T18:00:18Z
- **Completed:** 2026-08-30T18:20:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced shared filesystem scenarios with a private plugin root and complete expected result in every case.
- Proved relative, absolute, parent-directory, and self-directory discovery with stable ordering.
- Proved hidden, missing, non-regular, nested-only, linked, and undeclared entries are excluded.
- Proved exact first-wins behavior within one parent, across parents, and between self and parent forms.
- Reached 33/33 branches, 9/9 functions, and 208/208 lines for the direct owner.

## Task commits

Each task has one atomic commit:

1. **Task 1: Establish the canonical skills/discover owner** - `0e89f82e` (`test`)
2. **Task 2: Close edge and direct-coverage evidence** - `39d1bc7c` (`test`)

## Files created or modified

- `tests/bridges/skills/discover.test.ts` - Owns the complete public plugin skill discovery contract.

## Decisions made

- Kept `extensions/pi-claude-marketplace/bridges/skills/discover.ts` byte-identical.
- Used `lstat`-distinguishable hostile entries, including a directory link and a `SKILL.md` directory.
- Used exact full output arrays and warning messages instead of partial membership checks.
- Kept every meaningful tree, input, expected value, mutation, and cleanup inside its test case.

## Deviations from plan

None. The plan changed only the assigned owner test.

## Issues encountered

The full pre-commit bundle reached the repository-wide lint step and found six errors in `tests/bridges/commands/stage.test.ts`, which belongs to another plan. The hook also rewrote that unrelated file. The rewrite was removed before either Plan 24 commit. The Plan 24 file passes targeted lint, formatting, type checking, focused tests, and direct coverage.

## User setup required

None. The tests use private temporary directories and no external service.

## Next phase readiness

Plan 24 is ready for phase verification. It has no open threat, stub, skip, coverage exception, or production delta.

## Self-check: PASSED

The owner test, summary, and both task commits exist. The production source retains its recorded SHA-256 hash.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_
