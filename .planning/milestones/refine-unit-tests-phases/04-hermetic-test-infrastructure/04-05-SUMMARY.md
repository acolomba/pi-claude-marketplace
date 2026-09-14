---
phase: 04-hermetic-test-infrastructure
plan: "05"
subsystem: pi-type-boundary
tags: [typescript, pi-sdk, structural-typing, notifications, test-doubles]

requires:
  - phase: 04-hermetic-test-infrastructure
    plan: "03"
    provides: Faithful function-bearing test collaborators
provides:
  - Consumer-owned notification and tool-inventory ports
  - End-to-end narrow type flow across notify, auth, marketplace, plugin, and reconcile paths
  - Cast-free marketplace-update and enable-disable fixtures
affects: [phase-04, pi-api, notifications, orchestrator-options, tests]

actuals:
  tokens: 11800
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - Name the minimal capability at the consumer boundary
    - Preserve real SDK compatibility through structural assignability checks

key-files:
  created:
    - .planning/phases/04-hermetic-test-infrastructure/04-05-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - tests/platform/pi-api.test.ts
    - tests/shared/notify.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts

key-decisions:
  - "NotificationContext owns only ui.notify; ToolInventory owns only getAllTools and the inspected tool metadata."
  - "Propagate the ports through the complete shared call path when typecheck proved that the same values cross operation boundaries."

requirements-completed: [TREF-03]

coverage:
  - id: H9
    description: "Real Pi SDK interfaces remain assignable to the minimal production ports, while incomplete values fail typechecking."
    requirement: TREF-03
    verification:
      - kind: unit
        ref: "tests/platform/pi-api.test.ts type-level port cases"
        status: pass
    human_judgment: false
  - id: H10
    description: "Marketplace update and enable-disable use cast-free typed recorders with unchanged output and state behavior."
    requirement: TREF-03
    verification:
      - kind: unit
        ref: "focused four-suite Phase 04-05 command"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-09-07
status: complete
---

# Phase 04 Plan 05: Narrow Pi Ports Summary

**Notification and tool discovery now depend on named minimal capabilities, and the first two terminal owners construct those types without SDK assertions.**

## Accomplishments

- Added `NotificationContext`, `NotificationUi`, `ToolInventory`, and `ToolInventoryItem` to the Pi boundary.
- Narrowed shared notification functions without changing their runtime expressions or rendered bytes.
- Removed broad SDK assertions from marketplace update and enable-disable fixtures.
- Removed obsolete `as never` notification-test call escapes made redundant by the honest signatures.

## Task Commit

1. **Tasks 1-2: Define and propagate narrow Pi collaborator ports** — `4b38ebbc`

## Deviations from Plan

- Typecheck showed that enable-disable's minimal collaborators flow into install, reconcile, update, reinstall, marketplace add/remove, and uninstall. Their type annotations and the shared forwarding seams were narrowed in the same commit so the contract stays honest end to end. No runtime expression changed. This completes the production-typing portion planned for 04-06 early; its remaining work is the terminal test-fixture conversion.

## Verification

- Pi API, shared notify, marketplace update, and enable-disable suites passed together.
- Direct coverage for `shared/notify.ts` passed at 100% branches, functions, and lines.
- `npm run typecheck` passed.
- Focused ESLint passed after mechanical removal of newly redundant test assertions.
- The two target owner suites contain no broad SDK assertions.

## User Setup Required

None.

## Next Phase Readiness

The narrow ports now reach every selected operation; Plan 04-06 only needs to convert the remaining plugin and cross-operation fixtures and verify their owners.

## Self-Check: PASSED

---

_Phase: 04-hermetic-test-infrastructure_
_Completed: 2026-09-07_
