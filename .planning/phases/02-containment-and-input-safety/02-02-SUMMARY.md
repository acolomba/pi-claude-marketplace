---
phase: 02-containment-and-input-safety
plan: "02"
subsystem: filesystem-containment
tags: [typescript, path-safety, symlink-defense, node-test]

requires:
  - phase: 02-01
    provides: Fail-closed malformed-input handling and the Phase 2 typed-refusal pattern
provides:
  - Typed raw lexical-traversal refusal before normalization or filesystem inspection
  - One normalized containment and component-lstat policy for accepted path spellings
  - Exact hermetic evidence for lenient plugin info, command staging, and persisted locations
affects: [02-03, filesystem-safety, plugin-info, command-staging, persistence]

actuals:
  tokens: 5495
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - Raw lexical-segment rejection before normalization, followed by one normalized operand pair
    - Per-component lstat refusal for every existing component before downstream I/O

key-files:
  created:
    - .planning/phases/02-containment-and-input-safety/02-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/shared/path-safety.ts
    - tests/shared/path-safety.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/bridges/commands/stage.test.ts
    - tests/persistence/locations.test.ts

key-decisions:
  - "Reject a raw child component exactly equal to `..` before any path resolution or filesystem inspection; normalize only the refused error diagnostics."
  - "For accepted spellings, use one normalized parent/child pair for containment, error fields, relative segments, and the complete lstat walk."
  - "Keep all production consumers byte-identical because their existing pre-I/O calls already inherit the repaired shared policy; prove their public behavior in owner suites."

patterns-established:
  - "Typed containment family: traversal, ordinary escape, and symlink refusal remain distinguishable while sharing PathContainmentError compatibility."
  - "Filesystem safety evidence: compare complete outside and target trees plus file bytes after typed refusal."

requirements-completed: [PDEF-02]

coverage:
  - id: D1
    description: "Raw lexical traversal is rejected by LexicalTraversalError before normalization or filesystem inspection, while contained absolute and redundant-dot paths remain accepted."
    requirement: PDEF-02
    verification:
      - kind: unit
        ref: "tests/shared/path-safety.test.ts#lexical traversal and contained absolute cases"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/path-safety.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Accepted paths lstat every existing normalized component and reject the first symlink with exact typed fields before later I/O."
    requirement: PDEF-02
    verification:
      - kind: unit
        ref: "tests/shared/path-safety.test.ts#first, intermediate, and final symlink cases"
        status: pass
      - kind: unit
        ref: "tests/bridges/commands/stage.test.ts#normalized escape and intermediate symlink cases"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plugin info stays lenient without reading outside its root, command staging leaves targets unchanged, and every affected state-derived location refuses symlink routing."
    requirement: PDEF-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#outside path-source case"
        status: pass
      - kind: unit
        ref: "tests/persistence/locations.test.ts#state-derived location matrix"
        status: pass
      - kind: other
        ref: "direct coverage for plugin/info.ts, commands/stage.ts, and persistence/locations.ts"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-09-05
status: complete
---

# Phase 02 Plan 02: Path Containment Safety Summary

**A production-used lexical-traversal error now closes the normalization escape while the shared normalized containment and lstat walk protect every existing consumer before I/O.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-09-05T22:14:39Z
- **Completed:** 2026-09-05T22:31:50Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `LexicalTraversalError extends PathContainmentError` and a raw-component gate that rejects an exact `..` segment before normalization or filesystem inspection, with honest normalized diagnostics.
- Preserved equality, contained absolute paths, redundant `.` spellings, missing future leaves, ordinary outside-root errors, and the complete existing per-component symlink walk.
- Proved the lenient plugin-info projection, command-stage no-mutation contract, and all six affected state-derived location methods with case-owned real filesystems and exact typed outcomes.
- Recorded the complete live `assertPathInside` caller census through CodeGraph: 42 calls across 14 production files, all routed through the shared owner with no forked policy.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing lexical traversal contract** - `c62bc83e` (test)
2. **Task 1 GREEN: Reject lexical path traversal** - `86108ee2` (fix)
3. **Task 1 formatting: Format path safety regression** - `cbc4a15b` (style)
4. **Task 2: Prove containment consumers fail closed** - `eb262cad` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/path-safety.ts` - Adds the production-used typed traversal refusal and keeps normalized accepted-path checks consistent through the lstat walk.
- `tests/shared/path-safety.test.ts` - Pins the raw traversal error, unchanged outside tree/bytes, and contained absolute redundant-dot behavior.
- `tests/orchestrators/plugin/info.test.ts` - Proves an outside path source renders the exact existing unavailable row without consuming outside manifest data.
- `tests/bridges/commands/stage.test.ts` - Proves normalized escape and intermediate-symlink refusal leave complete target and outside state unchanged.
- `tests/persistence/locations.test.ts` - Exercises all six affected async location methods with real intermediate symlinks and exact normalized errors.

## Decisions Made

- Checked raw components with the platform path separator so the decision is lexical, exact, and independent of normalized path semantics.
- Normalized refused operands only to populate the typed diagnostic; accepted operands are normalized once and reused everywhere.
- Left plugin info, command staging, locations, and the other live consumers unchanged because caller review confirmed every affected read, write, or returned path follows the shared assertion.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Task 2 is consumer evidence for Task 1's shared repair, so its new cases passed immediately after the tracer implementation. No artificial failing assertion, redundant consumer branch, or test-only seam was introduced to manufacture a second RED state.
- The aggregate `npm run check` wrapper completed typecheck, repository lint, and `fallow`, then stopped because its formatting step scans the user-owned untracked `.mcp.json`. That file is explicitly outside this plan and was neither edited nor staged. A separate Prettier check passed for all five plan-owned files.
- An extra broad `npx eslint . --max-warnings=0` invocation reaches `.codex/gsd-core/bin/ensure-runtime-build.cjs`, which is outside the configured typed-project lint surface and causes `@typescript-eslint/await-thenable` to report missing parser type information. The project-authoritative `npm run lint` and a focused zero-warning ESLint run over every plan-owned TypeScript file both passed.
- Subprocess-heavy focused tests were opaque inside the restricted sandbox. They passed with the repository's existing subprocess authorization, followed by green full suites: 5,242/5,242 unit tests and 31/31 integration tests.

## Verification

- Shared owner and four-suite focused command: 187/187 passed.
- Direct coverage: 100% lines, branches, and functions for `path-safety.ts`, `plugin/info.ts`, `commands/stage.ts`, and `persistence/locations.ts`.
- TypeScript compiler, repository lint, focused zero-warning ESLint, `fallow`, corresponding-test positive/negative gates, and direct-coverage negative gate passed.
- TypeScript Google Style and unit-testing reviews found no project-style violation, global/builtin patch addition, network access, real-home access, or dishonest call-observation claim in the plan diff.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PDEF-02 is closed at its single production owner and the three explicit consumer surfaces.
- Plan 02-03 can complete the remaining containment/input-safety evidence without consumer policy changes or new dependencies.

## Self-Check: PASSED

- All five plan-owned source and test files plus this summary exist.
- All four task and formatting commits are present in git history.

---

_Phase: 02-containment-and-input-safety_
_Completed: 2026-09-05_
