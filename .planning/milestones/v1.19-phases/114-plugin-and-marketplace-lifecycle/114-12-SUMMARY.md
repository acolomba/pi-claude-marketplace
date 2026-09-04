---
phase: 114-plugin-and-marketplace-lifecycle
plan: 12
subsystem: plugin-lifecycle
tags: [typescript, node-test, plugin-reinstall, authentication, rollback, direct-coverage]
requires:
  - phase: 114-plugin-and-marketplace-lifecycle
    plan: 14
    provides: Split update and reinstall authentication ownership
provides:
  - Exact reinstall replacement, persistence, cleanup, warning, retry, and offline proof
  - One direct owner containing the final three reinstall authentication cases
affects:
  - phase-114-plan-13
  - phase-115-composition-orchestrators
  - phase-116-edge-surfaces
actuals:
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Use a separate filesystem watcher process to prove a real concurrent state replacement
    - Treat each bulk reinstall target as its own mutation and failure unit
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - tests/orchestrators/plugin/reinstall.test.ts
  deleted:
    - tests/orchestrators/plugin/update-reinstall-auth.test.ts
key-decisions:
  - Absorbed the final three authentication cases into the direct reinstall owner.
  - Preserved the concurrent-removal guard and covered it with an observed atomic state replacement.
  - Reduced only private error and cleanup branches whose producer chains normalize their values.
requirements-completed: [MOD-07]
coverage:
  - id: D1
    description: Plugin reinstall preserves exact source, authentication, replacement, rollback, finalize, persistence, warning, cleanup, and retry behavior.
    requirement: MOD-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/reinstall.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
        status: pass
    human_judgment: false
completed: 2026-09-01
status: complete
---

# Phase 114 Plan 12: Plugin Reinstall Summary

**Plugin reinstall now has one exhaustive direct owner covering source resolution, offline authentication, resource replacement, persistence, rollback, cleanup, warnings, and safe retry.**

## Accomplishments

- Moved the final three reinstall authentication cases into the direct owner and deleted the shared supplemental.
- Proved warm recorded-SHA reinstall performs no remote resolution, Git, credential, Device Flow, or subprocess work, while cold materialization uses only fresh injected ports.
- Proved prepare-before-replace, reverse rollback, finalize cleanup, authoritative state and config bytes, structured partial outcomes, target-local bulk continuation, and retry convergence.
- Exercised the real concurrent-removal guard with a separate Node watcher that replaces `state.json` during the observed migration rename.
- Reached 227/227 branches, 46/46 functions, and 1609/1609 lines directly from 94 explicit owner cases.

## Task Commit

1. **Task 1: Exhaust reinstall and absorb the final three auth cases** - `823542be`

## Files Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` - Evidence-gated private invariant and cleanup reductions plus corrected reload detection for reinstalled resources.
- `tests/orchestrators/plugin/reinstall.test.ts` - Sole direct plugin-reinstall owner.
- `tests/orchestrators/plugin/update-reinstall-auth.test.ts` - Deleted after the final three cases moved.

## Verification

- Focused owner: 94/94 cases passed.
- Transferred authentication subset: exactly 3/3 passed.
- Direct coverage: 227/227 branches, 46/46 functions, 1609/1609 lines.
- Five architecture gates, global typecheck, ESLint, Prettier, prohibited-pattern scans, added-line scans, and diff checks passed.

## Deviations from Plan

- Applied the approved production-edit exception after CodeGraph proved the affected branches private and unreachable or redundant. Transaction and enumeration boundaries normalize thrown values to `Error`; bridge rollback and finalize adapters return leak arrays; manifest validation already precedes entry access; cache helpers absorb their own read failures; and locally created replacement handles use total adapters.
- Corrected `resourcesChanged` so reinstalling a non-empty resource set requests reload even when generated names stay the same; identical paths can contain replaced content.

## Issues Encountered

- The concurrent-removal branch required an actual inter-process timing boundary. A filesystem watcher waits for the migration rename and atomically installs an empty state file, making the race deterministic without adding a seam.
- A concurrent plan briefly introduced an unrelated type error while this gate ran. After that owner corrected its fixture, the full project typecheck passed.

## User Setup Required

None.

## Security Review

Fresh credential and Device Flow fakes, zero-call warm-cache assertions, contained state replacement, exact reverse rollback order, and authoritative artifact-tree checks mitigate the plan threats.

## Self-Check: PASSED

- The direct owner contains exactly three transferred authentication cases and the shared supplemental is absent.
- Runtime tests use separate lowercase arrange, act, and assert phases.
- Each bulk target remains an independent mutation unit with explicit failure and retry evidence.
