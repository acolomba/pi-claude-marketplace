---
phase: 114-plugin-and-marketplace-lifecycle
plan: 14
subsystem: plugin-lifecycle
tags: [typescript, node-test, plugin-update, authentication, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: Typed update notification and reason contracts
provides:
  - Exact direct and cascade plugin-update lifecycle proof
  - Generated-skill preload propagation for update agent staging
  - Two authentication cases absorbed into the direct owner with three true reinstall integrations retained
affects:
  - phase-115-composition-orchestrators
  - phase-116-edge-surfaces
actuals:
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Preserve public unknown causes while refining proven non-injectable update-local failures to Error
    - Encode private invariants in local discriminated unions instead of unreachable fallback branches
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - tests/orchestrators/plugin/update.test.ts
    - tests/orchestrators/plugin/update-reinstall-auth.test.ts
key-decisions:
  - Passed generated skill names to agent staging through the existing knownSkills argument.
  - Preserved the reachable injected GitOps non-Error rejection behavior and its public normalization test.
  - Kept exactly three reinstall scenarios in the shared supplemental because they cross update and reinstall ownership.
requirements-completed: [MOD-07]
coverage:
  - id: D1
    description: Plugin update preserves exact direct, cascade, transaction, warning, authentication, partial-outcome, and retry behavior.
    requirement: MOD-07
    verification:
      - kind: unit
        ref: tests/orchestrators/plugin/update.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
        status: pass
    human_judgment: false
completed: 2026-09-01
status: complete
---

# Phase 114 Plan 14: Plugin Update Summary

**Plugin update now has exhaustive exported-flow coverage, correct generated-skill preload behavior, and an explicit two-owner-versus-integration split.**

## Accomplishments

- Corrected OR-12 by forwarding generated skill names to update agent staging through the existing production argument.
- Covered direct and cascade updates across source, cache, authentication, membership, disabled, unchanged, degradation, transaction, rollback, warning, failure, and retry partitions.
- Moved exactly two update authentication cases into the direct owner and retained exactly three genuine update/reinstall integrations in the supplemental.
- Replaced private legacy fallbacks only where CodeGraph proved their producing invariants, without changing public signatures, persistence, outcomes, or cause identity.
- Reached 383/383 branches, 81/81 functions, and 3,134/3,134 lines directly from the owner.

## Task Commit

1. **Task 1: Complete update lifecycle proof and split authentication ownership** - `e92348d3`

## Files Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` - OR-12 correction and evidence-gated private invariant refinements.
- `extensions/pi-claude-marketplace/orchestrators/types.ts` - Corrected stale skipped-outcome documentation.
- `tests/orchestrators/plugin/update.test.ts` - Sole direct update owner with two absorbed authentication cases.
- `tests/orchestrators/plugin/update-reinstall-auth.test.ts` - Three retained cross-boundary reinstall integrations.

## Verification

- Focused update owner: 143/143 cases passed under direct test isolation; the normal owner command also passed.
- Authentication transfer prefix: exactly two cases; retained supplemental: exactly three cases.
- Direct coverage: 383/383 branches, 81/81 functions, 3,134/3,134 lines.
- Types owner and type-only direct gate, global typecheck, eight architecture gates, ESLint, Prettier, prohibited-pattern scans, and diff checks: passed.

## Deviations from Plan

- Applied additional D-UTR-12 private refinements after exported tests left only CodeGraph-proven invariant arms: redundant post-lookup validation, unreachable partial MCP abort, closed phase-failure projections, nonempty phase-failure composition, skipped-only resolver typing, and non-injectable Error cause refinement. Public contracts and the reachable injected non-Error rejection behavior remain unchanged.

## Issues Encountered

- The exact TAP prefix count requires Node's `--test-isolation=none` mode in this environment because default file isolation reports the file as one wrapper subtest. The underlying two cases and the normal owner command both pass.

## User Setup Required

None.

## Security Review

Hermetic Git, credential, Device Flow, filesystem, transaction, and rollback schedules; exact cause rendering; immutable persistence assertions; and no-network/no-credential-leak gates mitigate the plan threats.

## Self-Check: PASSED

- The direct owner imports the concrete update module and covers every live branch without a test seam or coverage exception.
- Runtime tests use lowercase arrange, act, and assert comments.
- Public behavior, ordering, types, persistence, and cause identity remain intact.
