---
phase: 108-domain-and-platform
plan: 24
subsystem: testing/documentation
tags: [typescript, node-test, direct-coverage, test-layout, concern-local-fakes]

requires:
  - phase: 108-domain-and-platform
    provides: Plans 108-10, 108-16, 108-19, and 108-23 plus the Phase 108 verification report
provides:
  - Separate lowercase arrange, act, and assert phases for ten data-row definitions
  - Current concern-local fake paths in four production-source comments
  - Focused, direct-coverage, lexical, and full-repository verification evidence
affects: [108-domain-and-platform-reverification]

tech-stack:
  added: []
  patterns:
    - Bind throwing operations during act and retain exact error validation during assert
    - Assert void-returning accepted cases separately from their act phase
    - Name concern-local test fakes in source seam comments

key-files:
  created:
    - .planning/phases/108-domain-and-platform/108-24-SUMMARY.md
  modified:
    - tests/domain/components/mcp.test.ts
    - tests/domain/name.test.ts
    - tests/domain/source.test.ts
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts

key-decisions:
  - "Keep the existing tables and validators intact while binding each rejection operation in the act phase."
  - "Test accepted safe names by capturing the void result in act and comparing it with undefined in assert."
  - "Treat this as supplemental verification repair metadata; the 23 Phase 108 owner pairs remain unchanged."

requirements-completed: [MOD-01]

coverage:
  - id: D1
    description: Ten data-row definitions use separate lowercase runtime phases without weakening their assertions.
    requirement: MOD-01
    verification:
      - kind: unit
        ref: "node --test tests/domain/components/mcp.test.ts tests/domain/name.test.ts tests/domain/source.test.ts"
        status: pass
      - kind: unit
        ref: "Direct coverage: mcp.ts 1/1 branches, 0/0 functions, 16/16 lines; name.ts 33/33, 4/4, 151/151; source.ts 172/172, 27/27, 645/645"
        status: pass
      - kind: other
        ref: "Lowercase phase scan: no combined marker in MCP/source, one non-data-row assert.throws marker in name, and no uppercase markers"
        status: pass
    human_judgment: false
  - id: D2
    description: Four comments name the surviving concern-local fakes, with no other source byte changed.
    requirement: MOD-01
    verification:
      - kind: other
        ref: "Byte-exact expected-text comparison: four replacements and zero other changes across github-auth.ts, marketplace/add.ts, and marketplace/update.ts"
        status: pass
      - kind: other
        ref: "Deleted-helper file and reference scan for git-mock.ts, credential-mock.ts, and device-flow-mock.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: The bounded repair preserves repository quality and runtime behavior.
    requirement: MOD-01
    verification:
      - kind: other
        ref: "Prettier, typecheck, ESLint, Fallow, and git diff --check"
        status: pass
      - kind: unit
        ref: "npm test: 3,947 passed, 1 intentional skip"
        status: pass
      - kind: integration
        ref: "npm run test:integration: 21 passed"
        status: pass
    human_judgment: false

actuals:
  tokens: 2142
  tasks: 2
  commits: 3

duration: 16 min
completed: 2026-08-29
status: complete
---

# Phase 108 Plan 24: Verification gap repair summary

**Ten data-row callbacks now use distinct lowercase runtime phases, and four source comments point to the surviving concern-local fakes without changing runtime code.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-29T15:15:30Z
- **Completed:** 2026-08-29T15:31:54Z
- **Tasks:** 2
- **Files changed:** 7

## Accomplishments

- Repaired one MCP, seven name, and two source data-row definitions with separate lowercase arrange, act, and assert phases.
- Preserved all data tables, exact rejection validators, error messages, and accepted-name behavior.
- Kept the one permitted combined marker on its existing non-data-row `assert.throws()` expression.
- Replaced four stale helper-path comments with the current device-flow and credential fake paths.
- Confirmed that the repair adds no owner mapping; the Phase 108 inventory remains 23/23 pairs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Separate data-row runtime phases** - `c4ac4b32` (test)
2. **Task 2: Update concern-local fake guidance** - `f4c1dee4` (docs)

## Files Created/Modified

- `.planning/phases/108-domain-and-platform/108-24-SUMMARY.md` - Records the gap repair and verification handoff.
- `tests/domain/components/mcp.test.ts` - Separates the MCP rejection row's act and assert phases.
- `tests/domain/name.test.ts` - Separates seven data-row definitions, including two void-result assertions.
- `tests/domain/source.test.ts` - Separates two source rejection row definitions.
- `extensions/pi-claude-marketplace/domain/github-auth.ts` - Names the surviving device-flow fake.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - Names the surviving credential-operations fake.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - Names the surviving credential-operations fake in both option interfaces.

## Decisions Made

- Bind rejection operations as callables in act, then pass them to the existing `assert.throws()` validators in assert.
- Capture `assertSafeName()` results in act and compare them exactly with `undefined` in assert.
- Keep plan 24 outside the source-test pair ledger because it repairs verification gaps in existing owners.

## Deviations from Plan

None - the plan was executed within its declared six-file implementation boundary.

## Issues Encountered

- The isolated worktree did not have its own dependency directory. Verification used the repository's existing dependency tree through a temporary ignored symlink, which was removed after the gates completed.
- Prettier normalized the two changed test files. Their focused tests, direct coverage, and lexical gates were rerun before the Task 1 commit was finalized.

## Verification

- Focused MCP, name, and source tests pass.
- Direct coverage is complete for all three owners: MCP 1/1 branches, 0/0 functions, and 16/16 lines; name 33/33, 4/4, and 151/151; source 172/172, 27/27, and 645/645.
- The exact lexical gate reports no combined marker in the MCP or source tests, one permitted non-data-row combined throw in the name test, and no uppercase runtime markers.
- A byte-exact comparison confirms four comment replacements and no other changed source byte.
- The three deleted generic helper files remain absent, and the former helper paths have no references under `extensions`, `tests`, or `scripts`.
- Prettier, typecheck, ESLint, Fallow, and `git diff --check` pass.
- The full unit suite passes 3,947 tests with one intentional skip.
- All 21 integration tests pass.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 108 can be re-verified against the repaired data-row layout and helper-reference evidence.
- The verification report, STATE, ROADMAP, rules, guidelines, and 23/23 pair accounting remain unchanged by this plan.

## Self-Check: PASSED

- The summary and all six implementation paths exist in the expected final state.
- Task commits `c4ac4b32` and `f4c1dee4` exist on the plan branch.
- The implementation diff contains exactly the six declared files, no deletion, and no added stub marker.

---

_Phase: 108-domain-and-platform_
_Completed: 2026-08-29_
