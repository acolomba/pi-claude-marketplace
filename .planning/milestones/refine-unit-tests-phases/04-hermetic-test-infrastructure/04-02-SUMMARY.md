---
phase: 04-hermetic-test-infrastructure
plan: "02"
subsystem: test-environment
tags: [typescript, hermeticity, mcp, environment, node-test]

requires:
  - phase: 04-hermetic-test-infrastructure
    plan: "01"
    provides: Case-owned Pi environment boundary
provides:
  - Case-lifecycle environment setup for TestContext owners
  - Project MCP isolation from ambient user configuration
  - Shared two-variable boundary across terminal user-scope suites
affects: [phase-04, mcp-tests, plugin-tests, marketplace-tests]

actuals:
  tokens: 8200
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - TestContext setup registers restoration before production work
    - Suite-specific cache and interaction cleanup wraps shared environment ownership

key-files:
  created:
    - .planning/phases/04-hermetic-test-infrastructure/04-02-SUMMARY.md
  modified:
    - tests/platform/hermetic-environment.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "Expose a TestContext setup form beside the callback form so long-lived per-case paths retain the same restoration contract."
  - "Preserve completion-cache resets and deferred strong-mock verification inside narrow local wrappers."

requirements-completed: [TREF-01]

coverage:
  - id: H3
    description: "Project MCP staging ignores a conflicting server in an ambient user agent directory and leaves its bytes unchanged."
    requirement: TREF-01
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#ignores an ambient user MCP server during project staging"
        status: pass
    human_judgment: false
  - id: H4
    description: "All seven remaining terminal user-scope suites pass through the shared environment boundary."
    requirement: TREF-01
    verification:
      - kind: unit
        ref: "focused eight-suite Phase 04-02 command"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-09-07
status: complete
---

# Phase 04 Plan 02: User and MCP Isolation Summary

**Effective MCP discovery and every terminally implicated user-scope helper now run with both location inputs pinned beneath case-owned state.**

## Accomplishments

- Added a TestContext lifecycle form of the hermetic environment primitive.
- Reworked project and user MCP setup and added an ambient-user-server collision regression.
- Migrated cross-operation, marketplace update, and five plugin owner helpers while retaining their local lifecycle behavior.

## Task Commit

1. **Tasks 1-2: Isolate MCP and remaining user-scope owners** — `ecaeb937`

## Deviations from Plan

None.

## Verification

- MCP staging passed with the new ambient-user regression.
- All eight migrated owner suites passed together.
- `npm run typecheck` passed.
- Focused ESLint passed with zero warnings.
- Prettier reported all changed TypeScript files clean.

## User Setup Required

None.

## Next Phase Readiness

The environment inventory is closed; Plan 04-03 can correct function-bearing Git call snapshots without host-state ambiguity.

## Self-Check: PASSED

---

_Phase: 04-hermetic-test-infrastructure_
_Completed: 2026-09-07_
