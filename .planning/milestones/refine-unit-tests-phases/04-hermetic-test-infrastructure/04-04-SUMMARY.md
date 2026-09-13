---
phase: 04-hermetic-test-infrastructure
plan: "04"
subsystem: authentication-tests
tags: [typescript, authentication, hostile-hosts, callbacks, direct-coverage]

requires:
  - phase: 04-hermetic-test-infrastructure
    plan: "03"
    provides: Function-safe shared Git call snapshots
provides:
  - Hostile-neighbor regressions for both supported authentication providers
  - Offline proof that omitted optional collaborators stay unused on credential hits
  - Production-shaped Device Flow failure evidence through the shared Git ledger
affects: [phase-04, auth-registry, auth-host, git-tests]

actuals:
  tokens: 4800
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - One sibling test per adversarial hostname
    - Exercise optional behavior through the platform auth callback used by Git

key-files:
  created:
    - .planning/phases/04-hermetic-test-infrastructure/04-04-SUMMARY.md
  modified:
    - tests/domain/auth-registry.test.ts
    - tests/orchestrators/auth-host.test.ts

key-decisions:
  - "Use the platform onAuth callback for the omitted-collaborator case because it is the public path that checks stored credentials before Device Flow."
  - "Pass an injected Device Flow initialization failure through buildCloneAuth and the shared Git fake, then invoke the recorded callback."

requirements-completed: [AUTH-01, TREF-02]

coverage:
  - id: H7
    description: "Prefixes, suffixes, subdomains, ports, case changes, and typos cannot select either provider."
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts#findProviderForHost"
        status: pass
    human_judgment: false
  - id: H8
    description: "Optional and failing auth collaborators are observed through callable production-shaped boundaries."
    requirement: TREF-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts#buildCloneAuth"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-09-07
status: complete
---

# Phase 04 Plan 04: Authentication Boundary Summary

**Exact supported hosts alone select authentication providers, and both optional and failing collaborators are now proven through invoked callbacks.**

## Accomplishments

- Added adversarial hostname rows for GitHub and GitLab plus explicit provider-disjointness evidence.
- Replaced the self-referential optional fixture assertion with an offline stored-credential callback result and exact credential ledger.
- Passed an injected provider failure through `buildCloneAuth` and the shared Git fake, preserving bundle and callback identity.

## Task Commit

1. **Tasks 1-2: Harden authentication boundaries** — `5ab5a3ed`

## Deviations from Plan

- The optional-collaborator case invokes `buildAuthCallbacks(...).onAuth`, the public Git authentication callback, rather than calling `onAuthRequired` directly. A direct `onAuthRequired` call necessarily starts Device Flow and therefore cannot prove that an omitted HTTP collaborator remains unused on a stored-credential hit.

## Verification

- Auth registry, auth host, and shared Git fake suites passed together.
- Direct owner coverage passed at 100% for both `auth-registry.ts` and `auth-host.ts`.
- `npm run typecheck` passed.
- Focused ESLint passed with zero warnings.
- Prettier reported both changed tests clean.

## User Setup Required

None.

## Next Phase Readiness

The authentication evidence is closed; Plan 04-05 can replace broad SDK casts with consumer-owned narrow ports.

## Self-Check: PASSED

---

_Phase: 04-hermetic-test-infrastructure_
_Completed: 2026-09-07_
