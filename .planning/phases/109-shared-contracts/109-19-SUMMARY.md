---
phase: 109-shared-contracts
plan: 19
subsystem: testing
tags: [typescript, node-test, claude-vars, substitution, direct-coverage]

requires:
  - phase: 93-substitution-completion
    provides: Four-token single-pass Claude variable substitution contract
provides:
  - Canonical mirrored owner coverage for ClaudePluginVars and substituteClaudeVars
  - Exact evidence for optional pass-through, token boundaries, ordering, and non-re-expansion
affects: [shared-contracts, skills-bridge, commands-bridge, agents-bridge]

actuals:
  tokens: 2670
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [module-scope type evidence, named substitution rows, lowercase runtime phases]

key-files:
  created: [.planning/phases/109-shared-contracts/109-19-SUMMARY.md]
  modified: [tests/shared/vars.test.ts]

key-decisions:
  - "Kept vars.ts byte-identical and proved its current public contract through direct imports."
  - "Used one named-row matrix with independent complete expected strings and no conditional test logic."

patterns-established:
  - "Pure transform owners put positive satisfies and targeted @ts-expect-error evidence at module scope."
  - "Every generated runtime case follows separate lowercase arrange, act, and assert phases."

requirements-completed: [MOD-02]

coverage:
  - id: D1
    description: "The mirrored owner proves the complete Claude variable shape and exact single-pass substitution contract at 100 percent direct coverage."
    requirement: MOD-02
    verification:
      - kind: unit
        ref: "tests/shared/vars.test.ts"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/vars.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-08-29
status: complete
---

# Phase 109 Plan 19: Claude variable substitution Summary

**Canonical Claude variable owner with exact type shape, optional pass-through, token-boundary, ordering, and non-re-expansion contracts at 100 percent direct coverage**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-29T20:34:28Z
- **Completed:** 2026-08-29T20:41:09Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Replaced the brownfield cases with named sibling rows that use independent complete expected strings.
- Added module-scope positive and negative evidence for required fields, optional fields, and invalid field types.
- Proved empty content, one token, all four tokens, adjacency, repetition, omitted and explicit undefined values, unknown and near-match names, left-to-right order, and single-pass injected text.
- Retained 100 percent direct function, line, and branch coverage without changing production bytes.

## Caller-facing invariants

- Skills substitute plugin root, plugin data, their containment-checked installed skill directory, and project-scope cwd. Description substitution occurs before safe scalar escaping. Whole-file substitution uses the same values.
- Commands substitute plugin root and plugin data across command content. They substitute project cwd only for project scope and leave the skill token literal.
- Agents substitute plugin root and plugin data in the agent body. Their upstream stage supplies project cwd only for project scope, and the skill token stays literal.
- Every caller retains literal optional tokens when the corresponding value is absent. Unknown token names also stay unchanged.
- Inserted text is never scanned again. An inserted supported-token literal survives even when a later original token is replaced.

## Task Commits

Each task was committed atomically:

1. **Task 1: Trace callers and establish the canonical P109-19 owner** - `fa6e6d49` (test)
2. **Task 2: Complete exact edge coverage and pair-local quality gates** - `5f2c8df0` (test)

## Files Created/Modified

- `tests/shared/vars.test.ts` - Canonical direct runtime and compile-time owner for the public Claude variable contract.
- `.planning/phases/109-shared-contracts/109-19-SUMMARY.md` - Caller trace, verification, decisions, and commit evidence.

## Verification

- `node --test tests/shared/vars.test.ts` passed.
- Direct coverage passed with 5/5 branches, 3/3 functions, and 73/73 lines.
- `npm run typecheck` passed.
- Pair-local ESLint and Prettier checks passed.
- Targeted `git diff --check` passed.
- `git diff --exit-code -- extensions/pi-claude-marketplace/shared/vars.ts` passed.
- The production source retained SHA-256 `df7c1c4a44f745a6106ead084f201cf565a2874954101f3450a007815feb804e`.

## Decisions Made

- Kept production byte-identical because the existing public seam exposes every required behavior for direct proof.
- Retained both omitted and explicit `undefined` rows because `exactOptionalPropertyTypes` makes their type shapes distinct while the runtime pass-through promise is equal.
- Used an injected different-token row to prove that the scanner replaces later original input while it does not re-scan inserted text.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Plain `git status` invoked the inherited Git LFS clean filter, which could not write to the primary repository's read-only LFS temporary directory. Read-only status and diff checks disabled the filter for LFS assets. Commits staged only the declared test and summary files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- P109-19 is ready for phase-level verification and merge.
- No open threats, stubs, skipped tests, unrun checks, production changes, or environment mutations remain.

## Self-Check: PASSED

- The owner test and summary exist in the isolated worktree.
- Both task commits are present in the worktree history.
- The paired production source is byte-identical to the expected base.
- The owner has no skipped tests, placeholders, process-history commentary, or coverage exceptions.

---

_Phase: 109-shared-contracts_
_Completed: 2026-08-29_
