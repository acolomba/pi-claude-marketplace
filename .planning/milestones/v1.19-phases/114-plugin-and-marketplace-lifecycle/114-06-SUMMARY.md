---
phase: 114-plugin-and-marketplace-lifecycle
plan: 06
subsystem: marketplace-lifecycle
tags: [typescript, node-test, marketplace-update, authentication, cascade, direct-coverage]
requires:
  - phase: 114-plugin-and-marketplace-lifecycle
    plan: 14
    provides: Settled plugin-update outcome contract
provides:
  - Exact marketplace-update direct, batch, cascade, transport, cleanup, and retry proof
  - Five transport and authentication cases absorbed into the direct owner
affects:
  - phase-115-composition-orchestrators
  - phase-116-edge-surfaces
actuals:
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Keep path marketplaces offline while allowing exact refresh schedules for warm remote marketplaces
    - Preserve plugin-cascade outcome order and expose real partial batch state
key-files:
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/orchestrators/marketplace/update.test.ts
  deleted:
    - tests/orchestrators/marketplace/update-transport.test.ts
key-decisions:
  - Absorbed all five transport/authentication cases into the direct owner.
  - Removed only the private non-Error refresh cause arm after CodeGraph proved every producer normalizes or wraps to Error.
requirements-completed: [MOD-07]
coverage:
  - id: D1
    description: Marketplace update preserves exact source, transport, authentication, cascade, partial-result, cleanup, and retry behavior.
    requirement: MOD-07
    verification:
      - kind: unit
        ref: tests/orchestrators/marketplace/update.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
        status: pass
    human_judgment: false
completed: 2026-09-01
status: complete
---

# Phase 114 Plan 06: Marketplace Update Summary

**Marketplace update now has one exhaustive owner covering remote refresh, plugin cascades, partial batches, cleanup, and retry.**

## Accomplishments

- Moved exactly five transport and authentication cases into the direct owner and deleted the supplemental.
- Covered path, GitHub, URL, unsupported marketplace git-subdir, plugin git-subdir, changed, unchanged, unavailable, authentication, network, classification, batch, warning, phase-failure, cleanup, and retry partitions.
- Proved path and warm path-cascade arms perform no unexpected external work, while remote refresh arms follow exact injected schedules.
- Reached 120/120 branches, 17/17 functions, and 866/866 lines directly from 57 runtime cases.

## Task Commit

1. **Task 1: Complete marketplace-update proof and absorb transport cases** - `e96d3795`

## Files Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` - Evidence-gated private non-Error fallback simplification.
- `tests/orchestrators/marketplace/update.test.ts` - Sole direct owner with five absorbed transport/authentication cases.
- `tests/orchestrators/marketplace/update-transport.test.ts` - Deleted after complete transfer.

## Verification

- Focused owner: 57/57 cases passed.
- Transfer prefix: exactly five cases passed under `--test-isolation=none`.
- Direct coverage: 120/120 branches, 17/17 functions, 866/866 lines.
- Global typecheck, five architecture carriers, ESLint, Prettier, supplemental absence, prohibited-pattern scans, lowercase-AAA count, added-line scans, and diff checks: passed.

## Deviations from Plan

- Applied D-UTR-12 to remove the private non-Error cause fallback in `refreshOneMarketplace`. CodeGraph proved the config loader does not throw, `refreshRecord` wraps failures in `MarketplaceUpdateError`, and `withScopeLock` normalizes acquisition, body, and release failures through `toError`. Public outcomes and rendered causes are unchanged.

## Issues Encountered

- Node 26 default file isolation reports the owner file as one wrapper subtest for name-filtered TAP runs. The exact five-case transfer gate passes with `--test-isolation=none`; the normal owner command also passes.

## User Setup Required

None.

## Security Review

Fresh allowlisted Git, credential, Device Flow, Pi, and cascade collaborators; empty offline schedules; exact state/config/tree assertions; and no-network/no-credential-leak gates mitigate the plan threats.

## Self-Check: PASSED

- The direct owner imports the concrete marketplace-update module and covers every live branch without a new test seam or coverage exception.
- Runtime tests use lowercase arrange, act, and assert comments.
- Public transport, cascade, batch, persistence, ordering, and retry behavior remains intact.
