---
phase: 111-non-hook-component-bridges
plan: 18
subsystem: testing
tags: [typescript, node-test, mcp-parse, source-precedence, direct-coverage]

requires:
  - phase: 109-shared-contracts
    provides: Lowercase runtime phases and independent complete expectations
provides:
  - Canonical direct owner for MCP source parsing and resolution
  - Fail-closed precedence evidence for malformed higher-priority declarations
affects: [mcp-bridges, plugin-resolution, phase-111-verification]

actuals:
  tokens: 6938
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns: [exported-entrypoint grouping, case-owned temporary roots, structured errors]

key-files:
  created:
    - .planning/phases/111-non-hook-component-bridges/111-18-SUMMARY.md
  modified:
    - tests/bridges/mcp/parse.test.ts

key-decisions:
  - "Kept mcp/parse.ts byte-identical because its two public exports expose all source-selection and validation branches."
  - "Limited shared setup to a fresh-root allocator; each case owns its declaration bytes and complete expected result."
  - "Proved malformed higher-priority declarations against valid lower sources so precedence cannot fall through."

patterns-established:
  - "Parser owners group cases by exported entrypoint and compare complete values or structured errors."
  - "Filesystem parser cases allocate and clean one temporary plugin root per case."

requirements-completed: [MOD-04]

coverage:
  - id: D1
    description: "MCP resolution preserves entry, manifest, standalone, and none outcomes with exact source precedence."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/parse.test.ts#resolvePluginMcpServers"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/parse.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Malformed matched declarations and standalone documents fail closed with structured errors."
    requirement: MOD-04
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/parse.test.ts#parseMcpServers and malformed resolution cases"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-30
status: complete
---

# Phase 111 Plan 18: MCP parse owner summary

**MCP source parsing now has complete precedence, wrapped-form, and fail-closed malformed-input evidence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-30T17:13:24Z
- **Completed:** 2026-08-30T17:18:40Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Normalized the canonical owner around the `parseMcpServers` and `resolvePluginMcpServers` exports.
- Proved complete marketplace-entry, plugin-manifest, wrapped standalone, unwrapped standalone, and none results.
- Added empty-map, missing-path, read-error, malformed JSON, invalid shape, invalid wrapper, and unsafe-name cases.
- Proved that malformed entry and manifest declarations shadow valid lower-priority sources.
- Reached 36/36 branches, 2/2 functions, and 133/133 lines without changing production code.

## Task commits

Each task was committed atomically:

1. **Task 1: Establish the canonical mcp/parse owner** - `b8f2fcec` (test)
2. **Task 2: Close edge and direct-coverage evidence** - `63baed4f` (test)

## Files created or modified

- `tests/bridges/mcp/parse.test.ts` owns the complete parser and source-resolution contract.
- `.planning/phases/111-non-hook-component-bridges/111-18-SUMMARY.md` records the plan evidence.

## Verification

- `node --test tests/bridges/mcp/parse.test.ts` passed with no skipped or todo cases.
- `npm run typecheck` passed.
- Direct coverage passed with 36/36 branches, 2/2 functions, and 133/133 lines.
- Prettier and `git diff --check` passed for the owner.
- Both implementation commits used repository hooks.
- The production SHA-256 remained `f801f9dd462e596a59333ff278617c0906e673f836baa4e3e6a3e5fb48dd7ef6`.

## Decisions made

- Preserved the production module byte-for-byte because public behavior reaches every branch.
- Used one helper only to allocate and clean fresh directories. Each case authors its meaningful input and expected outcome.
- Kept malformed wrapper behavior explicit: a non-object `mcpServers` wrapper is an invalid unwrapped server entry.

## Threat controls

- T-111-18-01 is mitigated. Hostile names and malformed matched sources reject before lower-priority declarations can take effect.
- Each precedence case uses case-owned local files and complete independent outcomes.
- The change adds no network access, authentication path, schema, production export, or test-only seam.

## Deviations from plan

None - plan executed exactly as written.

## Issues encountered

None.

## User setup required

None. This plan adds no package, external service, or local configuration requirement.

## Next phase readiness

- P111-18 is ready for phase-level verification.
- MOD-04 remains pending until the other non-hook bridge owners produce their summaries.
- No plan-local blocker, open high-severity threat, stub, skipped test, todo, or coverage exception remains.

## Self-check: PASSED

- The production source, canonical owner, and summary exist on disk.
- Both implementation commits exist in repository history.
- The production SHA-256 matches the checksum recorded in this summary.
- The coverage classifier accepts both deliverables as fully automated evidence.
- The owner has no stub, skipped test, todo, coverage exception, uppercase phase, or combined phase.

---

_Phase: 111-non-hook-component-bridges_
_Completed: 2026-08-30_
