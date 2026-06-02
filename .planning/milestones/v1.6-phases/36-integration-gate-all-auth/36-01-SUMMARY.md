---
phase: 36-integration-gate-all-auth
plan: "01"
subsystem: auth
tags: [device-flow, github-auth, integration-test, credentials, isomorphic-git]

# Dependency graph
requires:
  - phase: 35-orchestrator-call-sites-output-catalog-auth
    provides: >
      buildAuthCallbacks wired into add/update orchestrators;
      initiateDeviceFlow integrated; makeRawNotifyFn; AUTH-09 gate extended
  - phase: 34-git-ops-interface-auth
    provides: OnAuthRequiredFn threaded through GitOps interface
  - phase: 33-git-ts-auth-wiring-auth
    provides: buildAuthCallbacks factory in platform/git.ts
  - phase: 32-device-flow-auth
    provides: initiateDeviceFlow state machine in domain/github-auth.ts
  - phase: 31-credential-ops-auth
    provides: CredentialOps interface + credential-mock.ts helper
provides:
  - "Cross-phase auth E2E integration test (3 tests): wires the full
     v1.6 auth closure chain without going through the full orchestrators"
  - "REQUIREMENTS.md: all 10 AUTH-01..AUTH-10 requirements marked [x]
     satisfied with Traceability table updated to Satisfied"
affects:
  - PR review / CI: auth-e2e.test.ts included by npm run test:integration
  - Future auth changes must keep these 3 integration tests green

# Tech tracking
tech-stack:
  added: []
  patterns:
    - >
      Integration test pattern: wire buildAuthCallbacks + initiateDeviceFlow +
      CredentialOps + makeRawNotifyFn with independent mock instances per test;
      use makeMockCredentialOps initial.store Map for pre-seeded scenarios;
      use interval:0 in makeMockDeviceFlowHttp to avoid sleeps; rebuild all
      mocks fresh for second-round calls (Test 3 reject-evict-reflow pattern)
    - >
      makeNotifyCapture helper factory: packages notifyCalls array + mock
      ExtensionContext + notifyFn in one call; avoids boilerplate per test

key-files:
  created:
    - tests/integration/auth-e2e.test.ts
  modified:
    - .planning/REQUIREMENTS.md

key-decisions:
  - >
    Independent mock instances per test round: Test 3 (reject-evict-reflow)
    builds a fresh makeMockDeviceFlowHttp + onAuthRequired closure for the
    second onAuth call because the first mock's pollQueue is drained after
    onAuthFailure drains it. This ensures the second Device Flow round
    completes cleanly without sharing state with the first.
  - >
    makeNotifyCapture helper factory extracted as a shared function within
    the test file rather than inlining per test, to reduce boilerplate while
    keeping each test's notifyCalls array independent (closure capture).
  - >
    Import order: domain/github-auth.ts before platform/git.ts per
    import-x/order rules (alphabetical within the third-party group); combined
    import for buildAuthCallbacks + OnAuthRequiredFn type from the same module.

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-07
  - AUTH-08
  - AUTH-09
  - AUTH-10

# Metrics
duration: 8min
completed: 2026-06-01
---

# Phase 36 Plan 01: Cross-phase auth E2E integration test + REQUIREMENTS.md closure Summary

**Three integration tests wire the full v1.6 auth closure chain
(buildAuthCallbacks + initiateDeviceFlow + CredentialOps + makeRawNotifyFn)
end-to-end; all 10 AUTH requirements marked satisfied in REQUIREMENTS.md.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-01T13:35:00Z
- **Completed:** 2026-06-01T13:43:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Wrote `tests/integration/auth-e2e.test.ts` with 3 integration tests
  exercising AUTH-01 (fill-miss Device Flow), AUTH-02/AUTH-08 (silent reuse),
  and AUTH-07 (reject-evict-reflow) without going through the full orchestrators
- Inline AUTH-09 guard in each test: asserts no notifyCall message contains
  "access_token" or "gho_" token material
- `npm run test:integration` now reports 7 passing tests (3 new + 4 existing)
- Updated `.planning/REQUIREMENTS.md`: all 10 AUTH requirements `[x]`
  satisfied; Traceability table rows changed from Pending to Satisfied
- `npm run check` remains green at exactly 1312 tests (main suite unchanged;
  auth-e2e.test.ts is integration-only, not in the main test glob)

## Task Commits

1. **Task 1: Write auth-e2e.test.ts** - `e940007` (feat)
2. **Task 2: Mark AUTH-01..AUTH-10 satisfied** - `3acba39` (docs)

## Files Created/Modified

- `tests/integration/auth-e2e.test.ts` -- Phase 36 integration gate; 3 tests
  wiring the full v1.6 auth stack end-to-end
- `.planning/REQUIREMENTS.md` -- all 10 AUTH requirements marked `[x]`;
  Traceability table updated from Pending to Satisfied

## Decisions Made

- Independent mock instances per test round: Test 3 builds a fresh
  `makeMockDeviceFlowHttp` for the second `onAuth` call because the
  first mock's `pollQueue` is drained after `onAuthFailure`. Each
  `buildAuthCallbacks` invocation also gets its own closure-scoped
  `deviceFlowAttempted` flag reset.
- `makeNotifyCapture` factory extracted as a shared inner function to
  DRY notifyCalls boilerplate while keeping each test's capture array
  independent (fresh closure per call).
- Import ordering fix: `domain/github-auth.ts` placed before
  `platform/git.ts` to satisfy `import-x/order` alphabetical rule;
  `buildAuthCallbacks` and `type OnAuthRequiredFn` combined into one
  import statement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint import-x/order violation in initial file**

- **Found during:** Task 1 (test file writing)
- **Issue:** Initial import order placed `platform/git.ts` imports before
  `domain/github-auth.ts`; `import-x/order` requires alphabetical ordering
  within each group, and `domain/` sorts before `platform/`
- **Fix:** Reordered imports (domain first, then platform, then shared,
  then test helpers); combined `buildAuthCallbacks` value import and
  `OnAuthRequiredFn` type import into a single statement
- **Files modified:** `tests/integration/auth-e2e.test.ts`
- **Verification:** `npx eslint tests/integration/auth-e2e.test.ts` exits 0
- **Committed in:** e940007 (Task 1 commit, after Prettier auto-fix)

**2. [Rule 1 - Bug] Prettier formatting violation**

- **Found during:** Task 1 verification (`npm run check`)
- **Issue:** Long `assert.ok(!call.message.includes("gho_"), ...)` lines
  were formatted differently than Prettier expected
- **Fix:** `npx prettier --write tests/integration/auth-e2e.test.ts`
- **Files modified:** `tests/integration/auth-e2e.test.ts`
- **Verification:** `npm run check` format:check step passes
- **Committed in:** e940007 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs: import order + formatting)
**Impact on plan:** Both are mechanical style fixes with no logic change.
No scope creep.

## Issues Encountered

- Worktree was created from an older commit (pre-Phase 31 work). Resolved by
  resetting the per-agent branch to the feature branch HEAD (`f649a06`) per
  the worktree branch check protocol before starting work.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes
introduced. Test file uses inline mock tokens ("gho_test_token_e2e",
"gho_fresh_token_e2e", "stale_token") that are clearly non-production mock
values. AUTH-09 inline guards in each test confirm no token material leaks
into notifyFn calls. No threat flags.

## Next Phase Readiness

- Phase 36 integration gate is complete: all 10 AUTH-01..AUTH-10 requirements
  are marked satisfied in REQUIREMENTS.md
- The v1.6 milestone (Phases 30-36) is fully delivered
- `npm run test:integration` provides ongoing regression protection for the
  full v1.6 auth closure chain

---
*Phase: 36-integration-gate-all-auth*
*Completed: 2026-06-01*
