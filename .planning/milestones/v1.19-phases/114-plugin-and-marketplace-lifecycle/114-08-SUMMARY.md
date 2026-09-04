---
phase: 114-plugin-and-marketplace-lifecycle
plan: 08
subsystem: plugin-lifecycle
tags: [typescript, node-test, plugin-fetch, cache, authentication, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: Fetch notification and reason contracts
provides:
  - Exact fetch target, cache, authentication, cleanup, and retry proof
  - Hermetic direct coverage for every live plugin-fetch branch
affects:
  - phase-115-composition-orchestrators
  - phase-116-edge-surfaces
actuals:
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Stage filesystem races deterministically with case-local filesystem collaborators
    - Prove offline paths with empty external schedules and network paths with explicit allowlists
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
    - tests/orchestrators/plugin/fetch.test.ts
key-decisions:
  - Preserved marketplace case-insensitive and project-before-user ordering while retaining manifest plugin order.
  - Removed only the private non-git reasoned-row arm after CodeGraph proved every non-git source returns earlier.
requirements-completed: [MOD-07]
coverage:
  - id: D1
    description: Plugin fetch preserves exact target, source, cache, authentication, failure-isolation, cleanup, and retry behavior.
    requirement: MOD-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/fetch.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
        status: pass
    human_judgment: false
completed: 2026-09-01
status: complete
---

# Phase 114 Plan 08: Plugin Fetch Summary

**Plugin fetch now has one exhaustive hermetic owner covering cache promotion, authentication, failure isolation, cleanup, and safe retry.**

## Accomplishments

- Covered path, pinned-warm, unpinned-refresh, cold SHA/ref, GitHub, URL, and git-subdir behavior.
- Proved target/scope/manifest ordering, malformed inputs, unsupported and remote rows, per-target continuation, staging and promotion failures, cleanup leaks, and retry convergence.
- Added deterministic exported-flow evidence for the classifier-to-resolver cache race without timers.
- Reached 77/77 branches, 14/14 functions, and 553/553 lines directly from 24 explicit owner cases.

## Task Commit

1. **Task 1: Exhaust fetch target, cache, authentication, cleanup, and retry behavior** - `fdf86c0e`

## Files Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts` - Evidence-gated private unreachable-arm simplification.
- `tests/orchestrators/plugin/fetch.test.ts` - Sole direct plugin-fetch owner.

## Verification

- Focused owner: all 24 explicit cases passed.
- Direct coverage: 77/77 branches, 14/14 functions, 553/553 lines.
- Global typecheck, three architecture gates, ESLint, Prettier, prohibited-pattern scans, added-line scans, and diff checks: passed.

## Deviations from Plan

- Applied D-UTR-12 to remove the private non-git resolver policy from `reasonedRow`. CodeGraph proved its sole caller reaches it only after `fetchOne` has accepted and materialized a Git-backed source; all non-Git sources return before that call. No public behavior, export, seam, pragma, or coverage exception changed.

## Issues Encountered

- The first cache-race fixture hid warm-cache presence too early and correctly took the remote short-circuit. A case-local first-stat override instead staged the intended post-materialization classification race deterministically.

## User Setup Required

None.

## Security Review

Fresh allowlisted Git, credential, and Device Flow collaborators; empty offline schedules; exact cache trees; immutable installed state; and no-network/no-credential-leak gates mitigate the plan threats.

## Self-Check: PASSED

- The owner imports the concrete fetch module and covers every live branch without a new test seam or coverage exception.
- Runtime tests use lowercase arrange, act, and assert comments.
- Behavior-bearing marketplace, scope, and manifest order remains intact.
