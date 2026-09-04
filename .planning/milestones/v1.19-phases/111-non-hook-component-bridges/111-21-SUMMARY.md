---
phase: 111-non-hook-component-bridges
plan: 21
subsystem: testing
tags: [typescript, node-test, mcp-substitution, environment-injection, direct-coverage]

requires:
  - phase: 109-shared-contracts
    provides: Lowercase runtime phases and independent complete expectations
provides:
  - Canonical direct owner for recursive MCP substitution
  - Complete project-scope and user-scope environment injection evidence
affects: [mcp-bridges, environment-variables, phase-111-verification]

actuals:
  tokens: 5635
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns: [case-owned complete values, single-pass token matrix, full environment outcomes]

key-files:
  created:
    - .planning/phases/111-non-hook-component-bridges/111-21-SUMMARY.md
  modified:
    - tests/bridges/mcp/substitute.test.ts

key-decisions:
  - "Kept mcp/substitute.ts byte-identical because its two public exports expose every substitution and injection branch."
  - "Authored complete source and expected values inside each case, including fresh nested identity and source immutability checks."
  - "Separated project, user, URL, and no-re-expansion cases so each environment and token rule has one explicit outcome."

patterns-established:
  - "Recursive transform owners compare the complete transformed graph and the unchanged source graph."
  - "Environment substitution owners compare complete injected records for project and user contexts."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "deepSubstitute preserves keys and non-string leaves while returning fresh nested values with exact single-pass token substitution."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/substitute.test.ts#deepSubstitute"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/substitute.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "substituteAndInject preserves complete server structure and applies declared environment precedence for project and user contexts."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/substitute.test.ts#substituteAndInject"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 21: MCP substitute owner summary

**MCP substitution now has direct recursive, token, and environment-precedence evidence with complete fresh values**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-30T17:27:10Z
- **Completed:** 2026-08-30T17:38:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rebuilt the canonical owner around `deepSubstitute` and `substituteAndInject`.
- Proved deep arrays and records, literal keys, primitive leaves, source immutability, and fresh nested values.
- Pinned repeated, adjacent, unknown, omitted, literal-replacement, and no-re-expansion token semantics.
- Proved complete project, user, and URL server outcomes with declared environment precedence.
- Reached 26/26 branches, 7/7 functions, and 122/122 lines without changing production code.

## Task commits

Each task was committed atomically:

1. **Task 1: Establish the canonical mcp/substitute owner** - `7c3f7d8f` (test)
2. **Task 2: Close edge and direct-coverage evidence** - `898190ca` (test)
3. **Task 2 correction: Satisfy the owner lint contract** - `f5b5bd6d` (test)

## Files created or modified

- `tests/bridges/mcp/substitute.test.ts` owns the complete recursive substitution and environment injection contract.
- `.planning/phases/111-non-hook-component-bridges/111-21-SUMMARY.md` records the plan evidence.

## Verification

- `node --test tests/bridges/mcp/substitute.test.ts` passed with no skipped or todo cases.
- `npm run typecheck` passed.
- Direct coverage passed with 26/26 branches, 7/7 functions, and 122/122 lines.
- Focused ESLint, Prettier, and `git diff --check` passed for the owner.
- All three implementation commits used repository hooks.
- The production Git blob remained `cba5d1330fabfd1f0b5165925697db6117a7d032`.
- The production SHA-256 remained `dfc5c28d472f3fa66013d4ee18ea2da4ce16ab45d9c44bc4a199763455f4bbe9`.

## Decisions made

- Preserved production byte-for-byte because both public exports expose every real branch.
- Kept each complete input and expected outcome inside its case.
- Compared whole transformed graphs before checking fresh nested identities and unchanged source values.
- Used separate project, user, URL, and no-re-expansion cases to keep each public rule explicit.

## Threat controls

- T-111-21-01 is mitigated. Hostile keys, unknown tokens, repeated tokens, and declared environment overrides retain exact outcomes.
- The literal `__proto__` key remains an own key without changing `Object.prototype`.
- The change adds no network access, filesystem boundary, authentication path, schema, production export, or test-only seam.

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 - Bug] Removed unnecessary type assertions found by focused lint**

- **Found during:** Task 2 repository verification.
- **Issue:** ESLint rejected two type assertions after `assert.deepStrictEqual` had already narrowed the transformed value.
- **Fix:** Used the narrowed properties directly while preserving the fresh-reference assertions.
- **Files modified:** `tests/bridges/mcp/substitute.test.ts`.
- **Verification:** Focused ESLint, focused tests, type checking, and direct coverage passed.
- **Committed in:** `f5b5bd6d`.

**Total deviations:** 1 auto-fixed bug.
**Impact on plan:** The correction changed no behavior or evidence scope.

## Issues encountered

- The plan-local gates all passed. The broader `npm run check` reached ESLint and reported 13 errors in previously committed Phase 111 owners.
- The affected sibling files are `agents/index.test.ts`, `agents/stage.test.ts`, and `commands/stage.test.ts`. They are outside P111-21 ownership.

## User setup required

None. This plan adds no package, external service, or local configuration requirement.

## Next phase readiness

- P111-21 is ready for phase-level verification.
- MOD-04 remains pending until the other non-hook bridge owners produce their summaries.
- No plan-local blocker, open high-severity threat, stub, skipped test, todo, or coverage exception remains.

## Self-check: PASSED

- The production source, canonical owner, and summary exist on disk.
- All three implementation commits exist in repository history.
- The production Git blob and SHA-256 match the values recorded in this summary.
- The coverage classifier accepts both deliverables as fully automated evidence.
- The owner has no stub, skipped test, todo, coverage exception, uppercase phase, or combined phase.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_
