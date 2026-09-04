---
phase: 112-hook-runtime
plan: 11
subsystem: hook-runtime
tags: [typescript, node-test, bash-parser, wrapper-stripping, direct-coverage]
requires:
  - phase: 112-hook-runtime
    provides: Plan 112-12 compiled Bash glob matching and the locked hook if-field contracts
provides:
  - Complete quote-aware Bash separator, escape, substitution, and fail-open evidence
  - Exact wrapper, xargs, recursion-cap, empty-input, and interpolation-fallback evidence
  - Stable first-seen Bash candidate deduplication with complete direct coverage
affects:
  - 112-13 if-field carrier and supplemental pruning
  - MOD-05 hook-runtime verification
actuals:
  tokens: 3559
  tasks: 2
  commits: 3
tech-stack:
  added: []
  patterns:
    - Complete literal Bash inputs with independently authored ordered candidate lists
    - Direct parser and matcher evidence that never invokes a shell
key-files:
  created:
    - tests/bridges/hooks/if-field/bash.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts
key-decisions:
  - Restored the documented stable first-seen deduplication contract with only subcommands spread from a Set after Task 1 exposed the missing behavior.
  - Added no export, symbol, test seam, or parser restructuring for the deduplication fix.
  - Left the shared hooks-if-field supplemental file unchanged so Plan 112-13 remains its only final carrier.
patterns-established:
  - Bash parser cases compare complete ordered candidate arrays and explicit interpolation flags from case-local literal commands.
  - Wrapper and recursion cases use sibling examples for each public partition without a shell, oracle parser, or shared scenario factory.
requirements-completed: [MOD-05]
coverage:
  - id: D1
    description: Quote-aware separators, escapes, substitutions, unmatched input, empty partitions, and stable first-seen deduplication produce exact ordered parse results.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/if-field/bash.test.ts#deduplicates repeated candidates without changing first-seen order
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/if-field/bash.test.ts#extracts nested dollar and backtick substitutions in discovery order
        status: pass
    human_judgment: false
  - id: D2
    description: The exact wrapper vocabulary, wrapper options, xargs rules, recursion boundary, direct glob behavior, and interpolation specificity fallback are exhaustively proved.
    requirement: MOD-05
    verification:
      - kind: unit
        ref: tests/bridges/hooks/if-field/bash.test.ts#strips the complete closed wrapper vocabulary through a nested chain
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/if-field/bash.test.ts#fails open at the exact eight-level recursion cap
        status: pass
      - kind: unit
        ref: tests/bridges/hooks/if-field/bash.test.ts#applies interpolation fallback only to the promised specific glob
        status: pass
    human_judgment: false
  - id: D3
    description: The Bash owner reaches complete direct branch, function, and line coverage without executing shell text or changing the public production surface.
    requirement: MOD-05
    verification:
      - kind: other
        ref: npm run test:coverage:direct -- tests/bridges/hooks/if-field/bash.test.ts
        status: pass
      - kind: other
        ref: npm run typecheck
        status: pass
    human_judgment: false
duration: 14 min
completed: 2026-08-31
status: complete
---

# Phase 112 Plan 11: Bash if-field summary

**The direct Bash owner now proves ordered quote-aware parsing, wrapper stripping, bounded substitution recursion, fail-open behavior, and specificity decisions at 100% coverage without ever executing shell text.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-31T08:18:00Z
- **Completed:** 2026-08-31T08:32:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added 25 independent cases for every unquoted separator, quote and escape boundary, nested substitution, unmatched input, empty partition, wrapper, xargs, recursion, direct-glob, and interpolation-specificity partition.
- Restored the documented stable first-seen candidate contract with duplicate removal that does not reorder the parsed commands.
- Reached 83/83 branches, 12/12 functions, and 458/458 lines for `bash.ts` while retaining all Bash supplemental evidence for Plan 112-13 to absorb.

## Task Commits

1. **Task 1: Prove quoted command extraction and stable deduplication** - `e1b942f2`
2. **Task 2: Complete substitution, wrapper, recursion, unmatched, xargs, and empty partitions** - `78feb49c`

## Files Created/Modified

- `tests/bridges/hooks/if-field/bash.test.ts` - Complete direct-owner evidence for parser ordering, syntax boundaries, wrapper stripping, recursion, fail-open behavior, and Bash glob decisions.
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts` - Restores stable first-seen deduplication in the existing public parse result.

## Decisions Made

- Used the existing `Set` insertion-order contract to remove repeated stripped candidates without sorting or adding a helper, export, symbol, or test seam.
- Kept every command and complete expected parse result independently authored; no case delegates expected behavior to a shell or another parser.
- Left `tests/architecture/hooks-if-field.test.ts` unchanged. Its Bash evidence remains green, and Plan 112-13 retains sole ownership of the final shared supplemental edit.
- Kept the phase-wide `MOD-05` requirement pending until every Phase 112 owner has a summary, even though this summary carries the plan's requirement metadata.

## Validation

- `node --test tests/bridges/hooks/if-field/bash.test.ts` passed with no failed, skipped, or todo tests.
- `npm run test:coverage:direct -- tests/bridges/hooks/if-field/bash.test.ts` passed with 83/83 branches, 12/12 functions, and 458/458 lines for `bash.ts`.
- `npm run typecheck` passed.
- Targeted ESLint and Prettier checks passed for `bash.ts` and its direct owner.
- `node --test tests/architecture/hooks-if-field.test.ts` passed, proving the unchanged supplemental carrier remains compatible with the direct owner and stable-deduplication correction.
- All 25 runtime cases use separate lowercase arrange, act, and assert phases. No combined phase, shell process API, skip, todo, snapshot, coverage exception, or shared oracle was introduced.
- Commits `e1b942f2` and `78feb49c` form a contiguous parent-child sequence. Their combined scope is only `bash.ts` and `bash.test.ts`, and neither commit edits the supplemental file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restored documented stable candidate deduplication**

- **Found during:** Task 1 (Prove quoted command extraction and stable deduplication)
- **Issue:** `parseBashSubcommands` documented and promised stable deduplication but returned the stripped array with repeated candidates intact. The plan artifact expected no production change, but leaving this behavior unchanged made its required stable-deduplication acceptance criterion impossible to satisfy.
- **Fix:** Changed only the result expression to `subcommands: [...new Set(stripped)]`, preserving first-seen order through JavaScript `Set` insertion order.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/bash.ts`
- **Verification:** Focused owner, 100% direct coverage, typecheck, targeted lint and format, and the unchanged architecture supplemental suite all pass.
- **Committed in:** `e1b942f2`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug).
**Impact on plan:** The correction was necessary to satisfy the documented public contract and deliberately deviates from the plan artifact's no-production-change expectation. It is limited to one result expression and adds no export, symbol, seam, parser branch, or unrelated behavior.

## Issues Encountered

None beyond the resolved Rule 1 deviation.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Empty input, empty partitions, unmatched substitutions, and fail-open results are explicit parser-contract inputs and outcomes rather than placeholders.

## Security Review

The direct owner implements the planned T-112-01 mitigation with literal command strings and direct parser/compiler calls only. No shell, subprocess API, network endpoint, filesystem access, authentication path, schema, or new trust boundary was introduced.

## Next Phase Readiness

The Bash leaf owner is ready for Plan 112-13 to absorb its shared truth-table evidence and prune the supplemental carrier. `MOD-05` remains pending until all 31 Phase 112 owners complete.

## Self-Check: PASSED

- The direct owner, paired production module, and canonical summary exist.
- Task commits `e1b942f2` and `78feb49c` exist in a contiguous parent-child sequence with the expected source/test scope.
- Focused tests, 100% direct coverage, typecheck, targeted lint, targeted format, unchanged supplemental, no-shell, stub, and coverage-metadata checks pass.
- `MOD-05` remains pending because the shared-requirement gate reports 0/1 IDs ready while sibling Phase 112 plans remain incomplete.
