---
phase: 11-cleanup-split-and-docs
plan: "04"
subsystem: plugin-command-edge
tags: [typescript, handlers, parsing, cleanup]
requires: []
provides:
  - Plugin-owned unknown-flag rejection shared by plugin command handlers
  - Focused helper tests paired with the plugin handler shared module
affects: [plugin-bootstrap, plugin-browse, plugin-help, plugin-import]
actuals:
  tokens: 2321
  tasks: 2
  commits: 1
plan_head_before: f97bef65afeb3073a3a38bf60f5519b5c47d8e07
plan_head_after: d0dcc869b1c7e8d5eb13d37fb9bb3be106e3e44c
tech-stack:
  added: []
  patterns:
    - Plugin-only argument policies live beside plugin handler parsers.
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
    - extensions/pi-claude-marketplace/edge/handlers/shared.ts
    - test/edge/handlers/plugin/shared.test.ts
    - test/edge/handlers/shared.test.ts
key-decisions:
  - Keep rejectUnknownFlag byte-identical and move only its module ownership and imports.
  - Commit the helper move and consumer migrations together because every intermediate split failed mandatory static checks.
patterns-established:
  - Plugin handler parsing helpers and their focused tests share plugin module ownership.
requirements-completed: [CLN-01]
coverage:
  - id: D1
    description: The first surviving long flag is rejected with the caller's unchanged usage bytes.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: test/edge/handlers/plugin/shared.test.ts
        status: pass
      - kind: other
        ref: direct coverage for edge/handlers/plugin/shared.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Bootstrap, browse, help, and import use the plugin-owned helper without changing parse order.
    requirement: CLN-01
    verification:
      - kind: unit
        ref: plugin bootstrap, browse, help, and import owner tests
        status: pass
      - kind: other
        ref: direct coverage for all four migrated handlers
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-10-28
status: complete
---

# Phase 11 Plan 04: Plugin Unknown-Flag Ownership Summary

**Unknown-flag rejection now belongs to the plugin handler module, with every exact consumer and focused test migrated without changing diagnostics or parse order.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-27T23:58:55Z
- **Completed:** 2026-10-28T00:08:04Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Moved `rejectUnknownFlag` out of the generic handler helper and into the plugin handler shared module.
- Moved the helper's two discriminating tests to the plugin shared test owner.
- Migrated bootstrap, browse, help, and import to the plugin sibling import while preserving their usage strings and call order.
- Proved that no generic helper import remains and that all changed source-test pairs retain direct coverage.

## Task Commits

1. **Tasks 1-2: Move the helper, owner tests, and exact consumers atomically** - `d0dcc869` (`refactor`)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts` - Owns the plugin-only unknown-flag rule.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` - Imports the rule from the plugin sibling.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts` - Imports the rule from the plugin sibling.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts` - Imports the rule from the plugin sibling.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` - Imports the rule from the plugin sibling.
- `extensions/pi-claude-marketplace/edge/handlers/shared.ts` - No longer exports plugin-only policy.
- `test/edge/handlers/plugin/shared.test.ts` - Owns the helper's focused cases.
- `test/edge/handlers/shared.test.ts` - No longer tests plugin-only policy.

## Decisions Made

- Preserved the implementation and test assertions byte for byte apart from the owning module and the test usage constant.
- Kept the helper call in the same position in each handler, so argument parsing and usage-error precedence remain unchanged.
- Used one implementation commit for both tasks. Removing the old export before migrating consumers failed typecheck, while temporarily duplicating the export failed Fallow's unused and duplicate-export rules.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Combined the two implementation tasks into one hook-clean commit**

- **Found during:** Task 1 commit hook
- **Issue:** The planned task split could not produce a valid intermediate revision. Removing the generic export broke four imports, and retaining both exports made Fallow reject the unused duplicate.
- **Fix:** Completed the four exact import migrations before committing, then ran both task verification groups and direct coverage on the combined tree.
- **Files modified:** All eight plan-owned source and test files.
- **Verification:** The commit hook and explicit `npm run check:static` passed.
- **Committed in:** `d0dcc869`

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Only commit granularity changed. The final code, tests, and requested ownership are unchanged.

## Issues Encountered

- CodeGraph could not open its database in this worktree. Narrow `rg` searches established the complete consumer set before editing.
- The assigned worktree was outside this session's writable sandbox root. Worktree-scoped permission was required for fixers and commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The generic edge helper no longer exposes plugin-only flag policy. Later cleanup plans can reason about plugin argument helpers through `edge/handlers/plugin/shared.ts` alone.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- Implementation commit `d0dcc869` is an ancestor of the plan head.
- All eight modified files exist.
- Both owner-test groups, direct coverage for every changed source-test pair, the full commit hook, and explicit `npm run check:static` passed.
- No production or test stub, skipped test, or unrun verification remains.

---
*Phase: 11-cleanup-split-and-docs*
*Completed: 2026-10-28*
