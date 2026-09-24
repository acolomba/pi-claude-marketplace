---
phase: 12-standalone-prune-with-dry-run
plan: "04"
subsystem: plugin-lifecycle
tags: [prune, dry-run, state-migration, notifications, flag-catalog]
requires:
  - phase: 12-standalone-prune-with-dry-run
    provides: Plans 01–03 standalone prune command, guarded sweep, and direct test pairs
provides:
  - Read-only standalone prune preview using the same ordered orphan selector as actual prune
  - Explicit nonpersisting state load for preview while retaining default migration saves
  - Pending prune rows with the dependency-pruned reason and no reload hint
  - Current, legacy, and missing-state command-level no-write regression tests
affects: [12-05, 12-06, 12-07, 12-08]
actuals:
  tokens: 7938
  tasks: 2
  commits: 2
plan_head_before: ae5e8bcec3e9d2ae23051069711c1155d7883418
tech-stack:
  added: []
  patterns:
    - Preview loads one selected scope outside the write transaction with migration persistence disabled
    - Preview and actual prune retain the selector's global order through singleton marketplace blocks
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/state-io.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
    - extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts
    - extensions/pi-claude-marketplace/edge/flag-catalog.ts
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - tests/integration/standalone-prune.test.ts
    - tests/persistence/state-io.test.ts
key-decisions:
  - The standalone handler consumes only the catalog-owned --dry-run flag and rejects other options before the operation.
  - The preview uses the central pending-row renderer, preserving the plain pending row when no reason is present.
requirements-completed: [PRUNE-07, FLAG-02]
coverage:
  - id: D1
    description: Current-snapshot preview selects the same dependent-first members as successful actual prune and leaves state, artifacts, and lock untouched.
    requirement: PRUNE-07
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#preview and actual prune select the same dependent-first fixpoint
        status: pass
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#prune --dry-run previews the orphan without writing current state
        status: pass
      - kind: unit
        ref: tests/orchestrators/plugin/prune.test.ts#removes the whole project-scope fixpoint in literal order and leaves held records staged
        status: pass
    human_judgment: false
  - id: D2
    description: Legacy and missing-state previews leave the selected scope unchanged while ordinary state loads still persist migrations.
    requirement: PRUNE-07
    verification:
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#repeated legacy previews normalize in memory without writing the scope
        status: pass
      - kind: integration
        ref: tests/integration/standalone-prune.test.ts#preview of a missing project state leaves both scope trees unchanged
        status: pass
      - kind: unit
        ref: tests/persistence/state-io.test.ts#a nonpersisting legacy load leaves bytes intact while the default persists
        status: pass
    human_judgment: false
  - id: D3
    description: The prune handler accepts the dry-run option without adding a confirmation or other per-verb flag.
    requirement: FLAG-02
    verification:
      - kind: unit
        ref: tests/edge/handlers/plugin/prune.test.ts#--dry-run reads the selected scope without creating its root
        status: pass
      - kind: unit
        ref: tests/architecture/flag-catalog-drift.test.ts#catalog parse flags for prune match the independent handler contract
        status: pass
    human_judgment: false
duration: 47min
completed: 2026-09-24
status: complete
---

# Phase 12 Plan 04: Read-only prune preview summary

`prune --dry-run` now shows the current orphan fixpoint as `(will uninstall) {dependency pruned}` rows without changing the selected scope, including when state needs migration or does not exist.

## Accomplishments

- Added `dryRun` to the standalone operation and the catalog-owned `--dry-run` option. Preview reads one scope without taking the state lock. Actual prune still selects afresh inside its lock.
- Kept the selector's dependent-first order, including alternating marketplace names. Pending rows carry the prune reason at information severity and request no reload.
- Verified unchanged state bytes and mtime, config and artifact bytes, complete scope trees, and lock absence on current and legacy state. A missing project extension root stays absent. Default `loadState` migration persistence still works.

## Task Commits

1. Task 1: `eb096bed` (`feat(prune): add read-only dry-run preview`).
2. Task 2: `d6511322` (`test(prune): prove legacy and missing previews never write`).

The measured commit count from `plan_head_before` through Task 2 is two. The realized committed diff is 31,753 characters, or 7,938 estimate tokens at the plan's characters-per-four scale.

## Verification

- The focused integration, state I/O, prune operation, handler, and catalog tests pass.
- Direct coverage passes at 100% lines, branches, and functions for state I/O, the prune operation, and the prune handler. The final state I/O direct run measured 533/533 lines, 59/59 branches, and 9/9 functions.
- `npm run typecheck`, the offline orchestrator architecture test, changed-file Prettier, and Fallow's base audit pass.
- The full changed-file pre-commit hook passed before each task commit with the operator-owned `SKIP=trufflehog,npm-format-check` exceptions. The Task 1 hook required process access for the type-member negative controls. Fallow's agent-marker form returned a JSON temporary rule-pack runtime error; project policy treats that as nonblocking.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking gate] Added direct prune operation and handler cases.**
The changed-pair pre-commit gate required direct preview coverage in both source owners. Their new cases cover preview success, unreadable declarations, empty scope, and alternating marketplace order. Both modules reached 100% direct coverage in `eb096bed`.

**2. [Rule 3 - Blocking gate] Updated frozen flag and type-member contracts.**
The new catalog verb required independent inventory rows in the flag tests. The notification edits shifted source coordinates in the type-member contract. The updated pins passed typecheck, drift checks, and type-member gates in `eb096bed`.

## TDD Gate Compliance

Task 1 began with a command-level test that failed on the planned behavior: `prune --dry-run` returned `Unknown option` instead of a pending orphan row. The implementation made it pass. Task 2 added regression cases for behavior Task 1 had already implemented; those cases passed without a new source change, so no separate RED result is claimed.

## Issues Encountered

The first Task 1 pre-commit run reached the type-member negative controls but the sandbox blocked a Node child process with `EPERM`. The full hook passed with process access. The first missing-state fixture tried to enumerate a scope root that did not exist; creating only that scope root made the test measure the intended absent extension root.

## Next Plan Readiness

Plan 05 can add the normal scoped empty result to the read-only path. Plans 06 and 07 can pin the pending row and final flag surface without changing the selector or state-load contract.

## Self-Check: PASSED

The summary file exists, both task commits are present, and `git rev-list` measures two commits from `plan_head_before` through Task 2. The working tree contains no uncommitted Plan 04 code or test change.
