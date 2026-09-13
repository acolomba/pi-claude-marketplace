---
phase: 03-production-defect-corrections
plan: "05"
subsystem: hook-dispatch-safety
tags: [typescript, hooks, prototype-safety, dispatch, node-test]

requires:
  - phase: 01-live-evidence-revalidation
    provides: Terminal findings DC-029 and MFDEC01
provides:
  - Prototype-safe dynamic hook tool-name and matcher lookups
  - Synchronous dispatch control flow aligned with the complete admitted event union
  - Regression evidence for every supported and adversarial lookup key
affects: [phase-03, hooks, matcher, tool-name-mapping, synchronous-dispatch]

actuals:
  tokens: 4980
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - Build module-private readonly maps from exhaustive typed records
    - Delete branches whose input complement is proven empty by the producer union

key-files:
  created:
    - .planning/phases/03-production-defect-corrections/03-05-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts
    - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - tests/domain/components/hook-tool-names.test.ts
    - tests/domain/components/hooks/matcher.test.ts
    - tests/bridges/hooks/dispatch-exec.test.ts

key-decisions:
  - "Use `ReadonlyMap.get` for open-string lookup while retaining exhaustive typed record declarations as the source vocabulary."
  - "Treat `toString`, `constructor`, and `__proto__` exactly like ordinary unsupported names without mutating `Object.prototype`."
  - "Remove only synchronous dispatch's impossible non-dispatchable branch; retain all guards with real untrusted or runtime producers."

patterns-established:
  - "Open strings never index ordinary prototype-bearing discriminator objects directly."
  - "Producer-proven total tables are indexed by the honest event union without cast-created fallback fixtures."

requirements-completed: [PDEF-07]

coverage:
  - id: D1
    description: "All supported Pi tool names retain their Claude mapping while prototype-chain and custom names pass through unchanged."
    requirement: PDEF-07
    verification:
      - kind: unit
        ref: "tests/domain/components/hook-tool-names.test.ts#mapPiToClaudeToolName"
        status: pass
    human_judgment: false
  - id: D2
    description: "All supported Claude matcher names resolve and prototype-chain or ordinary unknown names return unmapped."
    requirement: PDEF-07
    verification:
      - kind: unit
        ref: "tests/domain/components/hooks/matcher.test.ts#parseMatcher"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every admitted synchronous event dispatches through the total translator table while real safety guards remain directly covered."
    requirement: PDEF-07
    verification:
      - kind: unit
        ref: "tests/bridges/hooks/dispatch-exec.test.ts#TRANSLATOR_CASES"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-09-07
status: complete
---

# Phase 03 Plan 05: Prototype-Safe Hook Dispatch Summary

**Dynamic hook lookups now reject inherited object keys, and synchronous dispatch indexes its total translator table without an impossible fallback branch.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-09-07T05:10:27-04:00
- **Completed:** 2026-09-07T05:12:17-04:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Replaced open-string object indexing with module-private readonly map lookup at both hook lookup owners.
- Added direct supported-key coverage plus `toString`, `constructor`, `__proto__`, and ordinary unsupported-name cases.
- Removed synchronous dispatch's no-producer non-dispatchable branch and its cast-fabricated test.
- Preserved malformed payload diagnostics, plugin/path safety, child-process, timeout, environment, and lifecycle guards.

## Task Commits

1. **Task 1 RED: Add failing prototype-key lookup tests** - `7ce28769` (test)
2. **Task 1 GREEN: Harden hook lookups against prototype keys** - `c7aa22df` (fix)
3. **Task 2: Remove unreachable synchronous dispatch fallback and cast fixture** - `0da495db` (refactor)

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` - Looks up Pi tool names through a readonly map derived from the exhaustive record.
- `extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts` - Resolves Claude matcher tokens through own entries only.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` - Directly indexes the total translator table for admitted events.
- `tests/domain/components/hook-tool-names.test.ts` - Covers all supported and prototype-chain Pi-side lookup keys.
- `tests/domain/components/hooks/matcher.test.ts` - Covers supported, ordinary unsupported, and inherited-property matcher tokens.
- `tests/bridges/hooks/dispatch-exec.test.ts` - Retains real event and safety-path coverage while deleting the impossible cast fixture.

## Decisions Made

- Kept the typed object records because they provide compile-time vocabulary checks and public contract stability. Runtime lookup uses maps built from their own enumerable entries.
- Did not add a key cast or type assertion. `ReadonlyMap.get` accepts the untrusted string and returns the existing optional typed value honestly.
- Removed only the synchronous fallback authorized by the terminal producer trace. The async-rewake owner and real runtime guards are outside this deletion.

## Deviations from Plan

### Task 2 used trace-driven deletion rather than a RED runtime test

- The removed behavior had no valid producer; its only test constructed `SubagentStop as BucketAEvent`.
- A new failing behavioral test would require another dishonest cast or a source-text architecture test, both contrary to the plan.
- The impossible fixture and production branch were therefore removed in one atomic refactor commit, followed by direct 100% coverage.

## Issues Encountered

None.

## Verification

- All three plan-owned test suites passed together.
- Direct coverage passed at 100% lines, branches, and functions for `hook-tool-names.ts`, `matcher.ts`, and `dispatch-exec.ts`.
- `npm run typecheck` passed.
- Focused ESLint and Prettier checks passed for all six plan-owned TypeScript files.
- `npm run fallow` passed dead-code, health, and duplicate gates.
- A structural scan confirmed the cast-created event and synchronous non-dispatchable branch are gone. The remaining record cast in `buildPayload` crosses the real unknown payload boundary and is intentionally preserved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DC-029 and the synchronous Phase 3 slice of MFDEC01 are corrected.
- Wave 1 can continue with Plan 03-08.
- PDEF-07 remains phase-shared until every mapped correction plan completes.

## Self-Check: PASSED

- All six plan-owned source/test files and this summary exist.
- All three task commits are present in git history.

---

_Phase: 03-production-defect-corrections_
_Completed: 2026-09-07_
