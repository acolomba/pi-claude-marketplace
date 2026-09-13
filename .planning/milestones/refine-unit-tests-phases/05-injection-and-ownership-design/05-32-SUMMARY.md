---
phase: 05-injection-and-ownership-design
plan: 32
subsystem: flag-catalog-boundary
tags: [flag-catalog, plugin-list, private-state, contract-tests, tdd]

requires:
  - phase: 05-injection-and-ownership-design
    provides: catalog-derived list parsing and independent public flag contracts from Plan 05-30
provides:
  - private catalog-derived list-handler flag state with no test-facing export
  - order-sensitive independent literal pin for every handler-accepted flag set
  - full public evidence for all accepted list filters and representative rejection classes
affects: [05-33, plugin-list, flag-catalog, fallow]

actuals:
  tokens: 1120
  tasks: 2
  commits: 2
plan_head_before: fb127240e998573679c6a6576933a47b2b014e7a

tech-stack:
  added: []
  patterns:
    - production parsing may derive private state from the catalog while tests pin independent public literals
    - sort the production-derived side only when literal row order is itself part of the drift contract

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
    - tests/architecture/flag-catalog-drift.test.ts

key-decisions:
  - "Keep BOOLEAN_FLAGS private and derived from parseFlagNames(\"list\"); do not replace the removed export with another test seam."
  - "Compare sorted catalog values directly to canonical literal rows so additions, removals, renames, and literal reordering all fail the architecture contract."
  - "Leave the public list-handler owner test unchanged because it already proves every accepted filter and every required rejection class with exact observable results."

patterns-established:
  - "Private derivation, public proof: catalog-derived handler state stays internal while architecture literals and command outcomes provide independent evidence."

requirements-completed: []

coverage:
  - id: D1
    description: "The list handler keeps its catalog-derived filter set private, with no BOOLEAN_FLAGS export, test import, or derived self-equality assertion."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/architecture/flag-catalog-drift.test.ts and tests/edge/handlers/plugin/list.test.ts passed"
        status: pass
      - kind: other
        ref: "static export/import absence scan and 100% direct coverage for edge/handlers/plugin/list.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The independent five-flag literal pin is order-sensitive, and public list commands retain exact accepted and rejected behavior."
    requirement: TREF-06
    verification:
      - kind: unit
        ref: "tests/architecture/flag-catalog-drift.test.ts#ordered handler-accepted pin"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/plugin/list.test.ts#all five filters and rejection classes"
        status: pass
      - kind: integration
        ref: "TEST_CONCURRENCY=1 npm run test:integration passed 32 tests"
        status: pass
    human_judgment: false

duration: "22min"
completed: 2026-09-08
status: complete
---

# Phase 5 Plan 32: Private List Flag Contract Summary

**Plugin list parsing now keeps its catalog-derived flag set private while an ordered literal pin and exact public command tests independently guard every accepted and rejected behavior.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-08T20:27:13Z
- **Completed:** 2026-09-08T20:49:14Z
- **Tasks:** 2
- **Files modified:** 2
- **Realized diff:** 8 insertions, 26 deletions

## Accomplishments

- Removed the test-facing `BOOLEAN_FLAGS` export, test import, and catalog-derived self-equality assertion after CodeGraph and text censuses proved there was no production consumer.
- Retained the private `const BOOLEAN_FLAGS = parseFlagNames("list");` derivation and preserved 100% direct coverage of the list handler.
- Made every independent handler-accepted literal row order-sensitive by sorting only the catalog-derived side of the equality.
- Preserved the byte-exact list row `list: ["--available", "--installed", "--partial", "--remote", "--unavailable"]`.
- Verified the existing public owner suite already covers all five accepted switches, unknown and wrong-command flags, malformed scope values, combined/conflicting selections, exact rows and ordering, exact errors, notification counts, and rejecting-path silence.

## Consumer Census

The pre-edit CodeGraph blast-radius query found `BOOLEAN_FLAGS` referenced only by its defining list-handler module and `tests/architecture/flag-catalog-drift.test.ts`. The follow-up repository text census confirmed there was no production import or consumer of the export. The value remains private and is still used by the handler's public parsing path.

The final static gate finds no `export.*BOOLEAN_FLAGS` or `import.*BOOLEAN_FLAGS` match under `extensions/pi-claude-marketplace` or `tests`.

## Task Commits

1. **Task 1: Privatize list-handler flags after a consumer census** - `5e0faf8d` (refactor)
2. **Task 2: Prove independent catalog drift and public rejection contracts** - `3688619e` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` removes only the terminal export while keeping the existing private catalog-derived set and handler structure.
- `tests/architecture/flag-catalog-drift.test.ts` removes the handler-owned import/self-equality case and makes the independent literal table's canonical row order enforceable.

`tests/edge/handlers/plugin/list.test.ts` was reviewed and verified without modification because its public cases already satisfy every Plan 05-32 acceptance and rejection requirement.

## Decisions Made

- The handler's private `parseFlagNames("list")` result remains the production source for recognized list filters; no production literal or alternative accessor was introduced.
- The architecture pin sorts only `parseFlagNames(verb)`. Its literal expected rows remain independent, direct, and order-sensitive.
- The list-handler owner test remains entirely public-boundary based. No private-state access, raw-state escape, or test-only dependency seam was added.
- TREF-06 remains pending in root-owned tracking until the final Phase 05 closure audit. This executor did not edit `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`, `state.json`, or configuration files.

## Deviations from Plan

### Contained Execution Corrections

**1. [TDD prerequisite overlap] The public behavior and private derivation already existed**

- **Found during:** Tasks 1 and 2
- **Issue:** This plan removes test coupling and strengthens a meta-contract over already-correct production behavior. Manufacturing a production regression would not provide meaningful RED evidence.
- **Resolution:** Used the existing exhaustive public list suite as preservation evidence, committed the visibility cleanup and order-sensitive architecture assertion atomically, and required focused, direct-coverage, full-suite, and static gates.
- **Commits:** `5e0faf8d`, `3688619e`

**2. [Rule 3 - Verification environment] One child-process negative control required approved permissions**

- **Found during:** Full downstream verification
- **Issue:** The sandbox suppressed the child process diagnostic expected by `test:coverage:direct:negative`, yielding an empty stderr assertion.
- **Resolution:** Re-ran the identical command with approved permissions. The negative controls passed; no production or test file changed.
- **Files modified:** none

**Total deviations:** 2 contained execution corrections; neither changed product scope or public behavior.

## TDD Gate Compliance

- Both tasks operate on existing behavior: Task 1 deletes terminal test coupling, and Task 2 strengthens an architecture assertion against future literal-row reordering.
- No artificial regression was introduced to manufacture RED.
- Both commits were made only after the public handler suite, architecture contract, direct coverage, type, lint, and applicable Fallow gates passed.

## Verification

- Focused architecture and handler gate: both test files passed; 0 failed, cancelled, skipped, or todo.
- `TEST_CONCURRENCY=1 npm test`: 5,464 tests across 295 suites passed; 0 failed, cancelled, skipped, or todo; 391703.819048 ms.
- `TEST_CONCURRENCY=1 npm run test:integration`: 32 tests passed; 0 failed, cancelled, skipped, or todo; 43298.836421 ms.
- Direct coverage for `edge/handlers/plugin/list.ts`: 19/19 branches, 2/2 functions, and 79/79 lines (100%).
- `npm run typecheck`, full `npm run lint`, scoped ESLint, and the aggregate-scope Prettier check excluding only `.mcp.json` passed.
- `npm run fallow` passed dead-code, health (`0 above threshold`; 12,057 analyzed; maintainability 92.1), and duplicate gates.
- `npm run test:corresponding`, `npm run test:corresponding:negative`, and the approved-permission `npm run test:coverage:direct:negative` passed.
- `npm run check` passed typecheck, full lint, and Fallow, then stopped only at the known pre-existing untracked `.mcp.json` formatting warning. Every downstream gate ran independently.
- The exact literal row remains `list: ["--available", "--installed", "--partial", "--remote", "--unavailable"]`.
- The private `const BOOLEAN_FLAGS = parseFlagNames("list");` derivation remains, and no export or import of it remains.
- The exact sole suppression remains unchanged: `// fallow-ignore-next-line complexity -- temporary; remove after Phase 01-71 refactor`.
- `.mcp.json` remains unmodified with SHA-256 `09237a8c19625daeb677211c6ca9b38e01aa12eede0f4b5f2c26ed6ec7b449e6`.
- `git diff --check` passed, and the realized commit range changes only the two owned files named above.

## Known Stubs

None introduced.

## Issues Encountered

The known pre-existing untracked `.mcp.json` remains outside Plan 05-32 and prevents the aggregate Prettier/check chain from reaching later commands. Its bytes and required hash remained unchanged, and every remaining gate was completed independently. No Plan 05-32 behavior, type, lint, Fallow, direct-coverage, correspondence, unit, or integration failure remains.

## User Setup Required

None.

## Next Phase Readiness

- Plan 05-33 can perform the final closure audits against the private list flag derivation and the order-sensitive independent pin.
- Phase 6 retains ownership of any plugin-list/catalog file split; Plan 05-32 introduced no structural refactor.
- Root-owned TREF-06 tracking remains ready for the orchestrator to close after the final Phase 05 audit.

## Self-Check: PASSED

---

_Phase: 05-injection-and-ownership-design_
_Completed: 2026-09-08_
