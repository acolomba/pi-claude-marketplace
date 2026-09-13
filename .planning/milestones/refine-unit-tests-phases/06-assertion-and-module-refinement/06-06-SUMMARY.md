---
phase: 06-assertion-and-module-refinement
plan: "06"
subsystem: domain
tags: [typescript, resolver, filesystem, mcp, path-containment, direct-coverage, tdd]

requires:
  - phase: 06-assertion-and-module-refinement
    plan: "05"
    provides: direct-owned resolver vocabulary and component support policy
provides:
  - direct-owned component path validation and collection in component-paths.ts
  - direct-owned strict and loose MCP resolution in mcp-resolution.ts
  - shared containment enforcement for component and MCP reference paths
affects: [06-assertion-and-module-refinement, resolver-decomposition, plugin-resolution, mcp-bridge]

actuals:
  tokens: 15910
  tasks: 2
  commits: 4
plan_head_before: 7d3992bb5817226e092bd801805a4311270a4ccb

tech-stack:
  added: []
  patterns:
    - domain leaves receive narrow stat and read collaborators instead of the full resolver context
    - one contained-path primitive protects component and MCP reference resolution before filesystem reads
    - strict and loose MCP policies share validation while retaining distinct classification notes

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/component-paths.ts
    - extensions/pi-claude-marketplace/domain/mcp-resolution.ts
    - tests/domain/component-paths.test.ts
    - tests/domain/mcp-resolution.test.ts
    - .planning/phases/06-assertion-and-module-refinement/06-06-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/bridges/mcp/parse.ts

key-decisions:
  - "component-paths.ts owns relative-path validation and symlink-aware root containment; resolver.ts only supplies filesystem collaborators and composes the result."
  - "mcp-resolution.ts consumes the component-path containment owner and the existing MCP validator directly, preserving the domain-to-bridge dependency direction."
  - "The strict MCP owner keeps referenced file reads outside the JSON parse catch so real I/O failures retain their outer probe classification."

patterns-established:
  - "Direct trust-boundary pair: filesystem-facing domain owners have mirrored tests that cover every branch without a resolver facade."
  - "Contain before read: absolute, traversal, and symlink escape checks complete before referenced MCP content is read."

requirements-completed: [TREF-09]

coverage:
  - id: D1
    description: "Component declarations retain strict and loose ordering, deduplication, null handling, kind checks, traversal rejection, and symlink containment in one direct owner."
    requirement: TREF-09
    verification:
      - kind: unit
        ref: "tests/domain/component-paths.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/component-paths.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Strict and loose MCP declarations retain inline, manifest, standalone, referenced, missing, malformed, unsupported, and I/O outcomes in one direct owner."
    requirement: TREF-09
    verification:
      - kind: unit
        ref: "tests/domain/mcp-resolution.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-resolution.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Resolver composition and the MCP bridge retain their prior public outcomes without duplicate path or MCP ownership."
    requirement: TREF-09
    verification:
      - kind: unit
        ref: "node --test tests/domain/component-paths.test.ts tests/domain/mcp-resolution.test.ts tests/domain/resolver.test.ts tests/bridges/mcp/parse.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:corresponding && npm run typecheck && focused eslint --max-warnings=0"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-09-09
status: complete
---

# Phase 06 Plan 06: Resolver Path and MCP Ownership Summary

**Component path containment and MCP declaration resolution now live in two direct-tested domain owners, with exact strict/loose behavior and symlink-safe pre-read containment preserved.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-09T05:15:53Z
- **Completed:** 2026-09-09T05:32:12Z
- **Tasks:** 2
- **Files created or modified:** 8

## Accomplishments

- Extracted component path parsing, validation, ordering, deduplication, kind checks, and conventional-path discovery into `component-paths.ts`.
- Centralized relative, traversal, and symlink-aware containment in a component-path primitive reused by MCP references before any content read.
- Extracted strict inline/manifest/standalone/reference MCP resolution and loose conflict policy into `mcp-resolution.ts`.
- Preserved detailed strict malformed notes, generic loose malformed notes, unsupported loose string references, and propagation of existing referenced-file I/O failures.
- Achieved 100 percent direct line, branch, and function coverage for both new production modules.

## Task Commits

Each task followed an atomic RED then GREEN cycle:

1. **Task 1 RED: Add component path owner contract** - `5493eab7` (test)
2. **Task 1 GREEN: Extract component path resolution** - `88b93d04` (feat)
3. **Task 2 RED: Add MCP resolution owner contract** - `1be3afbb` (test)
4. **Task 2 GREEN: Extract MCP resolution** - `89c675a7` (feat)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/component-paths.ts` - Owns strict and loose component declaration collection plus contained relative-path resolution.
- `tests/domain/component-paths.test.ts` - Directly proves ordering, deduplication, implicit conventions, null and wrong-kind behavior, traversal, symlink escape, and filesystem error propagation.
- `extensions/pi-claude-marketplace/domain/mcp-resolution.ts` - Owns strict and loose MCP precedence, standalone/reference reads, validation, and error classification.
- `tests/domain/mcp-resolution.test.ts` - Directly proves inline/reference parity, precedence, wrapped and unwrapped standalone files, malformed inputs, containment, read failures, and loose conflicts.
- `extensions/pi-claude-marketplace/domain/resolver.ts` - Composes both new owners and retains source-root, manifest, hook, and overall resolution flow responsibilities.
- `extensions/pi-claude-marketplace/bridges/mcp/parse.ts` - Points its resolved-string contract explanation at the new MCP owner.
- `.planning/tdd-evidence/06-06-01.json` and `06-06-02.json` - Record intentional RED evidence for both extracted owner pairs.

## Decisions Made

- Kept the new production surfaces narrow: the resolver passes stat/read collaborators and mutable result fields, with no forwarding exports or compatibility facade.
- Reused `resolveContainedComponentPath` for MCP references. This gives both declaration families one symlink-aware containment policy without making the MCP owner depend on the full resolver.
- Kept MCP map validation in the domain layer through the existing `MCP_SERVERS_VALIDATOR`. Importing the bridge parser back into the domain would invert the established dependency direction.
- Left `orchestrators/plugin/shared.ts` unchanged after confirming it has no component-path reading or validation responsibility to migrate.

## TDD Gate Compliance

- Task 1 RED commit `5493eab7` intentionally failed because `component-paths.ts` did not exist; `.planning/tdd-evidence/06-06-01.json` passed `gsd_run check tdd-red-evidence` before implementation.
- Task 1 GREEN commit `88b93d04` passed its direct owner suite, composed resolver/shared suites, 100 percent direct coverage, type checking, and focused lint.
- Task 2 RED commit `1be3afbb` intentionally failed because `mcp-resolution.ts` did not exist; `.planning/tdd-evidence/06-06-02.json` passed `gsd_run check tdd-red-evidence` before implementation.
- Task 2 GREEN commit `89c675a7` passed its direct owner suite, resolver and MCP bridge regressions, 100 percent direct coverage, correspondence, type checking, and focused lint.

## Verification

- `node --test tests/domain/component-paths.test.ts tests/domain/mcp-resolution.test.ts tests/domain/resolver.test.ts` passed.
- `node --test tests/bridges/mcp/parse.test.ts` passed.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/component-paths.ts` passed at 100 percent: 59/59 branches, 9/9 functions, and 242/242 lines.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-resolution.ts` passed at 100 percent: 57/57 branches, 7/7 functions, and 180/180 lines.
- `npm run test:corresponding` passed.
- `npm run typecheck` passed.
- Focused ESLint passed with zero warnings for both direct owner pairs.
- A source scan confirmed the resolver no longer contains the moved component-path or MCP owner functions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The full TypeScript gate exposed widened string inference in the new MCP test fixture. The fixture now carries the production `StatKindReader` contract explicitly; runtime behavior did not change.
- The known Phase 1 revalidation debt remained out of scope and untouched.

## Known Stubs

None. Empty arrays and maps in the extracted modules are real accumulators or valid empty resolution values, not placeholders or deferred behavior.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The resolver trust boundary now delegates component paths and MCP declarations to dependency-light, directly covered owners. No blocker prevents the next Phase 6 decomposition plan.

---

_Phase: 06-assertion-and-module-refinement_
_Completed: 2026-09-09_

## Self-Check: PASSED

The summary, both production/test owner pairs, the persisted plan-head ledger, and all four RED/GREEN task commits exist. The measured pre-metadata commit count is four, and the final plan gate passes with direct 100 percent coverage for both extracted leaves.
