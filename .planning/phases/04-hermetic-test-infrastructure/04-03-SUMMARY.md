---
phase: 04-hermetic-test-infrastructure
plan: "03"
subsystem: git-test-boundary
tags: [typescript, git, authentication, test-fakes, callbacks]

requires:
  - phase: 04-hermetic-test-infrastructure
    plan: "02"
    provides: Hermetic environment boundary for dependent suites
provides:
  - Function-safe snapshots for every auth-bearing Git operation
  - Exact auth-bundle and callback identity in the shared call ledger
  - Direct auth forwarding from all traced consumer adapters
affects: [phase-04, auth-tests, marketplace-tests, plugin-tests]

actuals:
  tokens: 5200
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - Structured-clone data fields while retaining readonly function-bearing collaborator references
    - Shared fake owns call recording; consumers forward production-shaped options unchanged

key-files:
  created:
    - .planning/phases/04-hermetic-test-infrastructure/04-03-SUMMARY.md
  modified:
    - tests/platform/git-ops-fake.ts
    - tests/platform/git-ops-fake.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/orchestrators/marketplace/update.test.ts
    - tests/orchestrators/plugin/clone-cache.test.ts
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/reinstall.test.ts
    - tests/orchestrators/plugin/update.test.ts

key-decisions:
  - "Snapshot only the cloneable data portion of remote-operation options and preserve the original auth bundle by reference."
  - "Remove local strip-and-reattach ledger repairs now that the shared fake accepts production-shaped options."

requirements-completed: [AUTH-01, TREF-02]

coverage:
  - id: H5
    description: "Clone, fetch, and remote-ref calls record the exact callable auth bundle and expose its original failure identity."
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "tests/platform/git-ops-fake.test.ts#records callable authentication on every remote operation"
        status: pass
    human_judgment: false
  - id: H6
    description: "All traced consumers pass auth directly through the shared Git fake without repairing its ledger."
    requirement: TREF-02
    verification:
      - kind: unit
        ref: "focused nine-suite Phase 04-03 command"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-09-07
status: complete
---

# Phase 04 Plan 03: Function-Bearing Git Auth Summary

**The shared Git fake now records production-shaped auth collaborators without cloning functions, and every traced consumer forwards those options directly.**

## Accomplishments

- Added explicit typed snapshots for clone, fetch, and remote-ref inputs.
- Added a direct regression that checks complete ledgers, bundle identity, callback identity, and callback error identity.
- Removed eight consumer-level auth stripping and ledger-repair layers while preserving their fixture-specific behavior.

## Task Commit

1. **Tasks 1-2: Preserve function-bearing Git authentication** — `61f55b76`

## Deviations from Plan

- The repository-wide direct-pair audit stopped on the existing `extensions/pi-claude-marketplace/edge/args.ts` coverage gap (28/29 branches and 86/89 lines). This is outside the changed shared fake and remains assigned to the later coverage-gate closure work.
- The marketplace-add suite's Unix-domain-socket case cannot listen in this sandbox (`EPERM`); its other 56 cases pass, and the same file was green before this environment-restricted case when run in a socket-capable environment.

## Verification

- The shared Git fake test passed.
- The remaining eight selected consumer suites passed together; marketplace add passed 56/57 with only the sandbox socket restriction.
- `npm run typecheck` passed.
- Focused ESLint passed with zero warnings.
- Prettier reported all changed TypeScript files clean.
- The auth-stripping workaround census returned zero remaining traced patterns.

## User Setup Required

None.

## Next Phase Readiness

Plan 04-04 can invoke real auth collaborators through the faithful Git boundary and add adversarial host evidence.

## Self-Check: PASSED

---

_Phase: 04-hermetic-test-infrastructure_
_Completed: 2026-09-07_
