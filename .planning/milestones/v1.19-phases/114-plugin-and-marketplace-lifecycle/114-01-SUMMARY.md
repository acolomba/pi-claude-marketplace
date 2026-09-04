---
phase: 114-plugin-and-marketplace-lifecycle
plan: 01
subsystem: marketplace-lifecycle
tags: [typescript, node-test, marketplace-add, git-auth, integration, direct-coverage]
requires:
  - phase: 113-orchestrator-support-and-presenters
    provides: Marketplace add messaging, clone-cache, Git-source, auth, and seed contracts
provides:
  - Complete addMarketplace source, auth, persistence, cleanup, and retry proof
  - Six retained cross-owner marketplace seed and mirror integration cases
affects:
  - phase-115-composition-orchestrators
  - phase-116-edge-surfaces
actuals:
  tokens: 23280
  tasks: 1
  commits: 1
tech-stack:
  added: []
  patterns:
    - Exact injected Git/auth schedules with real case-owned filesystem state
    - Unsandboxed capability rerun for the unchanged Unix-socket filesystem-kind case
key-files:
  created:
    - tests/integration/marketplace-add-seed-mirrors.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - tests/orchestrators/marketplace/add.test.ts
  deleted:
    - tests/orchestrators/marketplace/add-seed-mirrors.test.ts
key-decisions:
  - Kept marketplace-level git-subdir and npm sources unsupported while plugin-level git-subdir remains installable.
  - Removed only the CodeGraph-proven private recordedName fallback under D-UTR-12.
requirements-completed: [MOD-07]
coverage:
  - id: D1
    description: Marketplace add preserves exact accepted and rejected source, auth, persistence, cleanup, and retry behavior.
    requirement: MOD-07
    verification:
      - kind: unit
        ref: tests/orchestrators/marketplace/add.test.ts
        status: pass
      - kind: other
        ref: npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Six seed, clone-GC, and Git-source-probe identities remain as integration evidence.
    requirement: MOD-07
    verification:
      - kind: integration
        ref: tests/integration/marketplace-add-seed-mirrors.test.ts
        status: pass
    human_judgment: false
duration: 14 min
completed: 2026-09-01
status: complete
---

# Phase 114 Plan 01: Marketplace Add Summary

**Marketplace add now has 53 exhaustive owner cases at complete direct coverage, while exactly six seed/mirror flows remain in integration.**

## Accomplishments

- Completed accepted path, GitHub, and URL sources plus exact unsupported marketplace git-subdir/npm behavior.
- Proved auth, Device Flow, clone, config/state persistence, cleanup residue, partial failure, and retry through exported workflows.
- Relocated six genuine add/clone-GC/git-probe compositions to `tests/integration/` and removed the old supplemental path.
- Reached 129/129 branches, 13/13 functions, and 854/854 lines directly from the owner.

## Task Commit

1. **Task 1: Exhaust marketplace add and retain six seed/mirror integrations** - `c277157c`

## Files Created, Modified, or Deleted

- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - Removed the private unreachable guard-success fallback.
- `tests/orchestrators/marketplace/add.test.ts` - Sole exhaustive direct owner.
- `tests/integration/marketplace-add-seed-mirrors.test.ts` - Six retained integration cases.
- `tests/orchestrators/marketplace/add-seed-mirrors.test.ts` - Deleted after relocation.

## Decisions and Deviations

CodeGraph proved the locked transaction callback always returns a recorded marketplace name on a clean result. D-UTR-12 therefore authorized returning the callback result directly and removing the private impossible undefined fallback. No public behavior, export, persistence format, seam, or coverage exception changed.

## Verification

- Focused owner: 53/53 passed on the approved unsandboxed runner.
- Direct coverage: 129/129 branches, 13/13 functions, 854/854 lines.
- Integration carrier: TAP reported exactly 6/6 cases; old path absent.
- Typecheck, two architecture carriers, ESLint, Prettier, prohibited-pattern scans, and diff checks: passed.

## Issues Encountered

The restricted sandbox rejects the case-owned Unix-domain socket with `EPERM`. The unchanged focused and direct commands passed outside the sandbox; production was not widened for the runner.

## User Setup Required

None.

## Security Review

Fresh fail-fast Git/auth collaborators, contained roots, exact state/tree evidence, basename-safe diagnostics, cleanup/retry proof, and no developer credentials mitigate T-114-01-A/B.

## Self-Check: PASSED

- The old supplemental is absent and the integration carrier has exactly six cases.
- All owner runtime cases use the locked lowercase structure.
- Direct functions, lines, and branches are complete without a seam or coverage exception.
