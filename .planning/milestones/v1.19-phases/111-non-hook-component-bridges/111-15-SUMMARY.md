---
phase: 111-non-hook-component-bridges
plan: 15
subsystem: testing
tags: [typescript, node-test, mcp-collision-slots, filesystem-isolation, direct-coverage]

requires:
  - phase: 109-shared-contracts
    provides: Lowercase runtime phases and independently authored filesystem expectations
provides:
  - Canonical direct owner for the four ordered MCP collision slots
  - First-declarer, malformed-document, missing-path, and unreadable-document evidence
affects: [mcp-bridges, collision-policy, filesystem-security]

actuals:
  tokens: 6545
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [case-owned environment roots, complete collision maps, immediate mutable-state cleanup]

key-files:
  created:
    - .planning/phases/111-non-hook-component-bridges/111-15-SUMMARY.md
  modified:
    - tests/bridges/mcp/collision-slots.test.ts

key-decisions:
  - "Kept collision-slots.ts byte-identical because its two public functions expose the complete slot and ownership contract."
  - "Redirected HOME and PI_CODING_AGENT_DIR inside every case after registering exact restoration callbacks."
  - "Used real missing, non-directory, malformed, and unreadable local documents instead of a production seam or module mock."

patterns-established:
  - "Collision owners compare complete Maps whose values name the exact first-declaring slot."
  - "Environment-sensitive filesystem cases allocate one fresh root and restore every variable through their own test context."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "MCP collision slots use the exact frozen home, Pi agent, project, and project-Pi order with first-declarer ownership."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/collision-slots.test.ts#returns the exact frozen slot order from the case environment"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/collision-slots.test.ts#keeps the first declaration across all four ordered slots"
        status: pass
    human_judgment: false
  - id: D2
    description: "Missing, empty, malformed, array, primitive, duplicate, invalid wrapped, and unreadable documents preserve or reject the exact public contract."
    requirement: MOD-04
    verification:
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 15: MCP collision slots owner summary

**Case-owned home, Pi-agent, and project documents now prove exact four-slot precedence and malformed-input handling at 100 percent direct coverage without a production change**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-30T16:41:11Z
- **Completed:** 2026-08-30T16:49:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Rebuilt the canonical owner around fresh case-local HOME, Pi agent, and project paths.
- Proved the exact frozen four-slot order and first-declarer ownership across all four documents.
- Proved missing, `ENOTDIR`, empty, malformed, array, primitive, null, wrapped, and unwrapped inputs with complete Maps.
- Proved an unreadable collision document propagates its structured filesystem error.
- Reached 27/27 branches, 3/3 functions, and 108/108 lines while preserving production bytes and exports.

## Task commits

Each task was committed atomically:

1. **Task 1: Establish the canonical mcp/collision-slots owner** - `5385d2ce` (test)
2. **Task 2: Close edge and direct-coverage evidence** - `ab25d660` (test)

## Files created or modified

- `tests/bridges/mcp/collision-slots.test.ts` is the canonical direct owner for slot order, first-declarer ownership, malformed handling, and unexpected read failures.
- `.planning/phases/111-non-hook-component-bridges/111-15-SUMMARY.md` records the plan evidence, decisions, coverage metadata, and commits.

## Verification

- `node --test tests/bridges/mcp/collision-slots.test.ts` passed with no skipped or todo cases.
- `npm run typecheck` passed.
- Direct coverage passed with 27/27 branches, 3/3 functions, and 108/108 lines.
- Scoped ESLint and Prettier checks passed for the owner.
- Both task commits used repository hooks.
- The production source retained SHA-256 `e3a363c20084c5546ff7f96263a26b17c3a2b54b1952c0b32348b20a9986e9ce`.

## Decisions made

- Kept the production collision-slot module unchanged. Its existing exports expose every ordered-slot and document-normalization branch.
- Limited shared support to allocating fresh paths. Every case authors its documents and complete expected owner Map.
- Snapshotted each environment variable and registered restoration before mutation, matching the assigned platform-boundary analog.
- Used a directory at the first collision-document path to prove ordinary read errors propagate without weakening production error handling.

## Threat controls

- T-111-15-01 is mitigated by a four-slot duplicate that proves the first declaration remains authoritative.
- Hostile malformed shapes contribute no server names, while a later valid document retains its exact owner path.
- Every case redirects user-scope paths below a fresh temporary root and registers filesystem and environment cleanup immediately.
- No network, authentication, schema, production API, test-only surface, or developer-owned path was introduced.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

- The optional repository-wide `npm run check` reached lint and reported 13 findings in prior Plan 05, 07, and 12 files. The Plan 15 owner passed scoped ESLint and is absent from those findings; the failure is outside this plan's ownership.

## User setup required

None. This plan adds no package, external service, or local configuration requirement.

## Next phase readiness

- P111-15 is ready for phase-level verification.
- MOD-04 remains pending until the other non-hook bridge owners produce their summaries.
- No plan-local blocker, production change, open high-severity threat, stub, skipped test, todo, or coverage exception remains.

## Self-check: PASSED

- The canonical owner and summary exist on disk.
- Both task commits exist in repository history.
- The production source is byte-identical to the plan-start revision.
- The owner has no stub, skipped test, todo, coverage exception, uppercase phase, or combined phase.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_
