---
phase: 05-injection-and-ownership-design
plan: 01
subsystem: testing
tags: [dependency-injection, filesystem, path-safety, tdd]

requires:
  - phase: 04-hermetic-test-infrastructure
    provides: direct production coverage gates and owner-suite conventions
provides:
  - required consumer-owned skills removal port with explicit Node composition
  - required path inspection port with explicit Node composition
  - owner tests for selected removal races, inspection order, and exact failure identity
affects: [05-injection-and-ownership-design, 06-global-patch-removal]

actuals:
  tokens: 5310
  tasks: 2
  commits: 7
plan_head_before: f835f9af1fee1af95de3a22d0702a4279d7995ef

tech-stack:
  added: []
  patterns:
    - required consumer-owned capability ports
    - private explicit Node adapters composed into existing public exports

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/skills/unstage.ts
    - tests/bridges/skills/unstage.test.ts
    - extensions/pi-claude-marketplace/shared/path-safety.ts
    - tests/shared/path-safety.test.ts

key-decisions:
  - "Keep skills removal and path inspection as separate consumer-owned capabilities because they have different authority and lifetimes."
  - "Delegate through the Node path inspector at call time so the existing Phase 6 global-patch compatibility tests continue to observe live builtin bindings."

patterns-established:
  - "Required port: factories require a narrow capability and never select an optional production default."
  - "Explicit composition: the unchanged public operation is bound once to a private Node-backed adapter."

requirements-completed: [TREF-04]

coverage:
  - id: D1
    description: "Skills unstage uses one required removal port while validation, ordering, ENOENT handling, frozen results, and real-tree behavior stay with the consumer."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/bridges/skills/unstage.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/skills/unstage.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Path safety uses one required lstat/readlink inspector while lexical containment, segment order, and symlink refusal stay inside the guard."
    requirement: TREF-04
    verification:
      - kind: unit
        ref: "tests/shared/path-safety.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/path-safety.ts"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-09-07
status: complete
---

# Phase 5 Plan 1: Required Filesystem Ownership Ports Summary

**Skills removal and path inspection now use narrow required ports with explicit Node adapters, without changing their public operations or real filesystem security behavior.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-09-07T19:16:33Z
- **Completed:** 2026-09-07T19:44:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Classified BSKL-019 as a skills-unstage-owned `removeTree` boundary and proved selected failure and remove-after-success behavior through case-local removers.
- Classified SHC-F003 as a path-safety-owned `lstat`/`readlink` boundary and proved inspection order, lexical short-circuiting, symlink reads, and exact error identity.
- Preserved real temporary-tree coverage, public result shapes, containment checks, symlink refusal, live builtin patch compatibility, and the exact existing Fallow suppression comment.

## Task Commits

Each TDD phase was committed separately:

1. **Task 1 RED: skills removal port owner cases** - `baf2e5d2` (test)
2. **Task 1 GREEN: required skills removal port** - `a3801f0d` (feat)
3. **Task 1 REFACTOR: public contract imports** - `db8d23e5` (refactor)
4. **Task 2 RED: path inspector owner cases** - `ef08d242` (test)
5. **Task 2 GREEN: required path safety inspector** - `1a93a87d` (feat)
6. **Task 2 REFACTOR: public contract imports** - `10ceccea` (refactor)
7. **Task 2 style gate: repository formatting** - `c82412c3` (style)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/skills/unstage.ts` - Adds the required one-operation remover factory and private Node adapter.
- `tests/bridges/skills/unstage.test.ts` - Adds case-local race and exact-failure owner cases while retaining real filesystem and global-patch cases.
- `extensions/pi-claude-marketplace/shared/path-safety.ts` - Adds the required two-operation inspector, guard factory, and private Node adapter.
- `tests/shared/path-safety.test.ts` - Adds inspector order, lexical short-circuit, readlink, and lstat failure cases while retaining real-tree security cases.

## Decisions Made

- The two roots do not share a port. Recursive skill removal and path inspection grant different authority and belong to different consumers.
- The private Node path adapter calls the imported builtins through closures. This preserves the existing live-binding global-patch tests until Phase 6 removes that machinery.
- TREF-04 remains pending in the project requirement ledger because the rest of Phase 5 must classify the remaining roots; this plan completed its assigned classifications.

## Deviations from Plan

None - plan scope and architecture were followed exactly.

## Issues Encountered

- The first Task 2 GREEN run showed that capturing `lstat` and `readlink` values at module initialization bypassed the existing Phase 6 compatibility tests. The explicit Node adapter was changed to delegate at call time, and both old and new owner cases passed.
- The first repository gate found the new path-safety helper signature needed Prettier formatting. Commit `c82412c3` applied the plan-owned correction.
- Exact `npm run check` cannot pass `format:check` because the pre-existing untracked `.mcp.json` is not formatted. The file was outside plan scope and was preserved unchanged. Every plan-owned formatting check passed, and the remaining check stages were run independently.
- Sandbox-only `EPERM` errors initially blocked child-process and Unix-socket negative controls. The same gates passed outside the sandbox: direct-coverage negative controls passed, all 5,403 unit tests passed, and all 13 integration files passed.

## Verification

- `node --test tests/shared/path-safety.test.ts tests/bridges/skills/unstage.test.ts` - passed.
- Direct coverage for `path-safety.ts` - 100% branches, functions, and lines.
- Direct coverage for `unstage.ts` - 100% branches, functions, and lines.
- `npm run typecheck` and focused ESLint for all four plan files - passed.
- Repository lint and Fallow gates - passed; no new suppression was added.
- `npm run test:corresponding` and its negative controls - passed.
- `npm run test:coverage:direct:negative` - passed outside the sandbox.
- `npm test` - 5,403 passed, 0 failed outside the sandbox.
- `npm run test:integration` - 13 files passed, 0 failed.
- `scripts/revalidation.mjs:1124` remains byte-exact: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.

## TDD Gate Compliance

- Task 1 RED failed on the missing `createUnstagePluginSkills` export; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 1 GREEN and REFACTOR passed the owner suite, direct coverage, typecheck, and focused lint.
- Task 2 RED failed on the missing `createPathSafetyGuard` export; `tdd-red-evidence` returned `RED_EVIDENCE_OK` before production work.
- Task 2 GREEN and REFACTOR passed both owner suites, both direct coverage gates, typecheck, and focused lint.

## Known Stubs

None. Empty arrays in the changed files are real accumulators or established result values, not UI placeholders or unwired data.

## User Setup Required

None - no external service configuration is required.

## Next Phase Readiness

The two required factory seams are ready for later Phase 5 ownership work and Phase 6 global-patch cleanup. No Phase 6 machinery was removed in this plan.

## Self-Check: PASSED

- All four plan-owned source and test files exist.
- All seven task commits exist in repository history.
- Both required factories are used by their unchanged public production exports.

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-07_
