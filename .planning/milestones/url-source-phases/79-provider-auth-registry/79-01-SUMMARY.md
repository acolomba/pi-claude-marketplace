---
phase: 79-provider-auth-registry
plan: 01
subsystem: auth
tags: [device-flow, oauth, rfc-8628, provider-registry, github-auth]

# Dependency graph
requires:
  - phase: 32-github-auth
    provides: RFC-8628 Device Flow engine (initiateDeviceFlow), DeviceFlowHttp seam
provides:
  - GitAuthProvider descriptor interface and GITHUB_PROVIDER constant (domain/auth-registry.ts)
  - findProviderForHost(host) host->provider lookup (PROV-01)
  - initiateDeviceFlow parameterized by an optional provider descriptor (defaults to GITHUB_PROVIDER)
  - no-credential-leak architecture gate extended to scan every provider file (PROV-05)
affects: [79-02 host lookup wiring, 79-03 clone auth bundle binding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Provider descriptor registry: const-table (PROVIDERS) + pure hostMatch lookup, mirroring domain/source.ts"
    - "Byte-identity via optional parameter defaulting to the incumbent constant (provider ?? GITHUB_PROVIDER)"
    - "URL bound via closure inside DeviceFlowHttp factory so the public seam signature is unchanged"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/auth-registry.ts
    - tests/domain/auth-registry.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - tests/architecture/no-credential-leak.test.ts

key-decisions:
  - "provider is OPTIONAL on InitiateDeviceFlowOpts, defaulting to GITHUB_PROVIDER (D-79-04) so the 23 existing github.com call sites compile and behave byte-identically."
  - "Device-flow URLs are captured in closures inside a makeDeviceFlowHttp factory; the public requestCode/pollToken signatures (clientId, scope) / (clientId, deviceCode, intervalSec) stay unchanged so the mock seam needs no edit."
  - "The x-access-token credential mapping and the GitHub client_id/scope/endpoints moved onto GITHUB_PROVIDER; github-auth.ts no longer hardcodes them."

patterns-established:
  - "Provider registry: readonly const table + PROVIDERS.find(p => p.hostMatch(host)) pure lookup."
  - "Architecture gate coverage arrays (PROVIDER_FILES) with a vacuous-pass guard for not-yet-authored files."

requirements-completed: [PROV-01, PROV-05]

coverage:
  - id: D1
    description: "GitAuthProvider registry with GITHUB_PROVIDER descriptor and findProviderForHost host lookup (PROV-01)."
    requirement: "PROV-01"
    verification:
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts#PROV-01 findProviderForHost('github.com') returns the GitHub descriptor"
        status: pass
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts#GITHUB_PROVIDER carries today's exact github.com endpoints, client_id, and scope"
        status: pass
    human_judgment: false
  - id: D2
    description: "Device Flow engine parameterized by an optional provider descriptor; github.com output byte-identical (three existing auth tests pass unchanged)."
    verification:
      - kind: unit
        ref: "tests/domain/github-auth.test.ts (all 23 tests pass unchanged)"
        status: pass
      - kind: integration
        ref: "tests/integration/auth-e2e.test.ts (passes unchanged)"
        status: pass
      - kind: unit
        ref: "tests/domain/auth-registry.test.ts#initiateDeviceFlow drives clientId/scope and credentialFrom from a synthetic provider"
        status: pass
    human_judgment: false
  - id: D3
    description: "no-credential-leak architecture gate scans every provider file for token interpolation (PROV-05)."
    requirement: "PROV-05"
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#PROV-05: every provider file is scanned for token interpolation in an Error or notifyFn message"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-11
status: complete
---

# Phase 79 Plan 01: Provider Auth Registry Summary

**GitAuthProvider registry (host->descriptor lookup) with the RFC-8628 Device Flow engine parameterized by an optional provider descriptor that defaults to GITHUB_PROVIDER, keeping github.com behavior byte-identical.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-11T18:11:54Z
- **Completed:** 2026-07-11T18:24:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created `domain/auth-registry.ts` with the `GitAuthProvider` interface, the `GITHUB_PROVIDER` descriptor carrying today's exact device-code/token URLs, public client_id, `repo` scope, and `x-access-token` credential mapping, and the `findProviderForHost` lookup (PROV-01, D-79-04).
- Parameterized `initiateDeviceFlow` by an OPTIONAL `provider` descriptor defaulting to `GITHUB_PROVIDER`; endpoints, clientId, scope, and the credential mapping now flow from the descriptor while the DeviceFlowHttp public seam signatures stay unchanged (mock helper untouched).
- Proved byte-identity: the three existing auth test files pass unchanged, verified byte-for-byte unmodified against the base commit.
- Extended the no-credential-leak architecture gate to scan every provider file for token interpolation (PROV-05), and confirmed the gate catches an injected `notifyFn(\`token=${accessToken}\`)` leak.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the GitAuthProvider registry (TDD)** - `5c83dfac` (feat)
2. **Task 2: Parameterize the engine by an optional provider descriptor (TDD)** - `341a7fad` (refactor)
3. **Task 3: Extend the no-credential-leak gate to cover provider files** - `7df97835` (test)

_Note: Tasks 1 and 2 were TDD (RED test written and confirmed failing before the implementation). Task 2 combined its RED/GREEN into a single refactor commit because the implementation is a byte-identity-preserving refactor of an existing engine._

## Files Created/Modified
- `extensions/pi-claude-marketplace/domain/auth-registry.ts` - GitAuthProvider interface, GITHUB_PROVIDER descriptor, findProviderForHost lookup.
- `extensions/pi-claude-marketplace/domain/github-auth.ts` - initiateDeviceFlow gains optional provider (defaults to GITHUB_PROVIDER); URLs bound via makeDeviceFlowHttp closure; success arm uses provider.credentialFrom.
- `tests/domain/auth-registry.test.ts` - PROV-01 lookup/descriptor-shape tests plus parity and synthetic-descriptor drive tests for the parameterized engine.
- `tests/architecture/no-credential-leak.test.ts` - PROVIDER_FILES set + PROV-05 loop test scanning auth-registry.ts for token interpolation.

## Decisions Made
- Kept `provider` optional (not required) — this is the byte-identity mechanism; existing call sites pass no `provider` key and hit the GITHUB_PROVIDER default.
- Bound the two fetch URLs via a `makeDeviceFlowHttp(deviceCodeUrl, tokenUrl)` factory closure rather than widening the DeviceFlowHttp method signatures, so `tests/helpers/device-flow-mock.ts` needed no change and the three byte-identity test files stayed unmodified.
- Removed the module-level GitHub URL/client_id/scope constants from github-auth.ts; the descriptor is now the single source of those literals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import-order lint error in github-auth.ts**
- **Found during:** Task 2 (engine parameterization)
- **Issue:** The new `./auth-registry.ts` import created a distinct import-x/order group; eslint required a blank line between it and the `../platform/*` type imports. The `feat`/`refactor` commit initially landed with the error (the pre-commit `npm lint` hook did not flag it on this file).
- **Fix:** Ran `eslint --fix` (inserted the required blank line between import groups) and amended the Task 2 commit before finalizing.
- **Files modified:** extensions/pi-claude-marketplace/domain/github-auth.ts
- **Verification:** `eslint` on the committed HEAD version exits 0; all 44 plan-scope tests pass.
- **Committed in:** `341a7fad` (Task 2 commit, amended)

**2. [Rule 3 - Blocking] Stale docstring references to moved constants**
- **Found during:** Task 2 (engine parameterization)
- **Issue:** The github-auth.ts file header referenced `GITHUB_OAUTH_CLIENT_ID below` and hardcoded `repo` scope; those literals moved onto the GITHUB_PROVIDER descriptor, so the docstring was factually wrong.
- **Fix:** Updated the D-32-03 note and the P32-7 operator-action note to point at `GITHUB_PROVIDER.clientId` in domain/auth-registry.ts; added a D-79-04 note. Surgical, limited to lines my change invalidated.
- **Files modified:** extensions/pi-claude-marketplace/domain/github-auth.ts
- **Verification:** typecheck + tests green.
- **Committed in:** `341a7fad` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary for a clean, accurate commit. No scope creep; the four plan-scoped files are the only files changed.

## Issues Encountered
- The `trufflehog` pre-commit hook fails to run inside the worktree sandbox (`failed to read index file: .git/index: not a directory`) — a known worktree-sandbox limitation documented in CLAUDE.md. Commits were made with `SKIP=trufflehog` per that guidance; the underlying scan is not a real secret finding (the committed client_id is a documented PUBLIC OAuth App client_id per D-32-03).

## Known Stubs
None.

## User Setup Required
None - no external service configuration required. (The GITHUB_PROVIDER.clientId placeholder operator-action, P32-7, is pre-existing and unchanged by this plan.)

## Next Phase Readiness
- `findProviderForHost` and the parameterized `initiateDeviceFlow` are ready for Plan 02 (host lookup) and Plan 03 (clone auth bundle binding).
- No blockers.

## Self-Check: PASSED

---
*Phase: 79-provider-auth-registry*
*Completed: 2026-07-11*
