---
phase: 111-non-hook-component-bridges
plan: 06
subsystem: testing
tags: [typescript, node-test, agents-marker, filesystem-ownership, direct-coverage]

requires:
  - phase: 111-non-hook-component-bridges
    provides: P111-07 removal of the duplicate foreign-content integration suite
provides:
  - Canonical direct owner for agent ownership markers and filename gates
  - Exact current, legacy, foreign, missing, malformed, near-marker, and I/O evidence
  - Removal of the three obsolete foreign-agent fixture files
affects: [agent-bridges, ownership-safety, fixture-cleanup]

actuals:
  tokens: 3976
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [case-owned temporary files, independent marker literals, complete safety results]

key-files:
  created:
    - .planning/phases/111-non-hook-component-bridges/111-06-SUMMARY.md
  modified:
    - tests/bridges/agents/marker.test.ts
    - tests/bridges/_fixtures/foreign-agents/legit-with-marker.md
    - tests/bridges/_fixtures/foreign-agents/no-marker.md
    - tests/bridges/_fixtures/foreign-agents/wrong-basename.md

key-decisions:
  - "Kept agents/marker.ts byte-identical because its constants and public ownership predicate expose the complete contract."
  - "Used fresh case-owned paths and independently written bytes for current, legacy, foreign, malformed, and near-marker evidence."
  - "Removed the three foreign-agent fixtures only after repository-wide exact-path searches returned no matches."

patterns-established:
  - "Ownership tests prove the filename gate without creating a target and prove content gates with exact case-owned bytes."
  - "Non-ENOENT filesystem errors are compared as structured errors while the temporary tree remains case-owned."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "The agent marker owner pins the prefix and both marker constants, then classifies current, legacy, foreign, and missing targets."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/agents/marker.test.ts#constants and primary ownership outcomes"
        status: pass
      - kind: other
        ref: "node --test tests/bridges/agents/marker.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Near-marker, malformed-byte, and non-ENOENT cases close direct coverage after the final shared fixtures are removed."
    requirement: MOD-04
    verification:
      - kind: other
        ref: "npm run typecheck"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/marker.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 06: Agents marker owner summary

**Case-owned marker evidence proves the complete agent ownership decision at 100 percent direct coverage without a production change**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-30T19:40:11Z
- **Completed:** 2026-08-30T19:49:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Rebuilt the canonical owner around a direct import of all four runtime exports from `agents/marker.ts`.
- Proved exact prefix, current marker, legacy marker, missing target, foreign basename, and foreign-content outcomes.
- Added malformed-byte, near-marker, and non-`ENOENT` I/O cases with complete case-owned state.
- Removed the three foreign-agent fixtures after their final consumers were localized.
- Reached 11/11 branches, 1/1 functions, and 87/87 lines without changing production bytes or exports.

## Task commits

Each task was committed atomically:

1. **Task 1: Establish the canonical agents/marker owner** - `a59a425b` (test)
2. **Task 2: Close edge and direct-coverage evidence** - `db17aed4` (test)

## Files created or modified

- `tests/bridges/agents/marker.test.ts` - Canonical direct owner for agent ownership constants, filename checks, marker checks, missing targets, and I/O errors.
- `tests/bridges/_fixtures/foreign-agents/legit-with-marker.md` - Removed after the marker bytes moved into case-owned input.
- `tests/bridges/_fixtures/foreign-agents/no-marker.md` - Removed after the marker-free bytes moved into case-owned input.
- `tests/bridges/_fixtures/foreign-agents/wrong-basename.md` - Removed after the foreign-basename case stopped reading a shared file.
- `.planning/phases/111-non-hook-component-bridges/111-06-SUMMARY.md` - Plan evidence, direct coverage, decisions, and commit record.

## Verification

- `node --test tests/bridges/agents/marker.test.ts` passed.
- `npm run typecheck` passed.
- `npm run lint` passed.
- Prettier accepted `tests/bridges/agents/marker.test.ts` after formatting.
- Direct coverage passed with 11/11 branches, 1/1 functions, and 87/87 lines.
- Exact-path searches returned status 1 for all three removed fixtures.
- The owner fixture-root scan returned status 1.
- Production source retained SHA-256 `2da71044d229755949a717623b0f179d48e1e5ffac2bef206ca19f376bf3b84d`.

## Decisions made

- Kept the production marker module unchanged. Its public constants and predicate expose every required outcome.
- Used a fresh temporary directory in each filesystem case and registered cleanup before writing content.
- Authored every marker string, complete file body, expected ownership value, and expected error structure independently.
- Used a missing foreign-basename target to prove that the filename gate returns before filesystem access.
- Deleted only the three files assigned to P111-06 after exact repository-wide consumer searches found no matches.

## Threat controls

- T-111-06-01 is mitigated with case-owned foreign names, missing targets, marker-free bytes, near-marker bytes, malformed bytes, and unreadable content paths.
- Tests prove that the filename gate does not read an unowned target and that content checks do not rewrite foreign bytes.
- No network, authentication, schema, production API, or test-only surface was introduced.

## Deviations from plan

None. The plan executed as written.

## Issues encountered

- Node reports `EISDIR` read errors without a `path` field. The case pins the complete stable structure, including `path: undefined`.

## User setup required

None. This plan adds no package, external service, or local configuration requirement.

## Next phase readiness

- P111-06 is ready for phase-level verification.
- MOD-04 remains pending until the other non-hook bridge owners produce their summaries.
- No plan-local blocker, production change, open high-severity threat, stub, skipped test, todo, or coverage exception remains.

## Self-check: PASSED

- The canonical owner and summary exist on disk.
- Both task commits exist in repository history.
- All three assigned fixture files are absent, with no remaining exact-path consumer.
- The production source is byte-identical to the plan-start revision.
- The focused owner, typecheck, lint, formatting, and direct-coverage gates pass.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_
