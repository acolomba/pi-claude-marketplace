---
phase: 35-orchestrator-call-sites-output-catalog-auth
plan: "01"
subsystem: orchestrators/marketplace
tags:
  - auth
  - device-flow
  - marketplace-add
  - orchestrator-wiring
dependency_graph:
  requires:
    - 35-00 (git-mock GitAuthBundle type widening)
    - 34-01 (GitOps.clone auth? field in shared.ts)
    - 33-01 (buildAuthCallbacks + OnAuthRequiredFn in platform/git.ts)
    - 32-xx (initiateDeviceFlow in domain/github-auth.ts)
    - 31-xx (CredentialOps + DEFAULT_CREDENTIAL_OPS in platform/git-credential.ts)
  provides:
    - AUTH-01: addGithubInGuard wires Device Flow onAuthRequired into gitOps.clone
    - makeRawNotifyFn helper in shared/notify.ts for domain-tier callback creation
  affects:
    - tests/orchestrators/marketplace/add.test.ts (19 tests, 3 new)
tech_stack:
  added: []
  patterns:
    - Device Flow closure construction bound to ctx + credentialOps + host
    - GitAuthBundle forwarded by reference from orchestrator into GitOps.clone
    - makeRawNotifyFn as sanctioned adapter from ctx.ui.notify to NotifyFn type
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - tests/orchestrators/marketplace/add.test.ts
decisions:
  - title: makeRawNotifyFn added to shared/notify.ts as ESLint-compliant adapter
    rationale: >
      The ESLint no-restricted-syntax rule forbids direct ctx.ui.notify calls
      everywhere except shared/notify.ts. initiateDeviceFlow requires a simple
      NotifyFn callback. Adding makeRawNotifyFn to shared/notify.ts (where
      ctx.ui.notify is whitelisted) creates a clean, architecturally correct
      adapter. This is a deviation from the plan (which proposed the inline
      wrapper) but respects CLAUDE.md's ESLint-clean requirement.
  - title: initiateDeviceFlow import omitted from test file
    rationale: >
      The plan called for importing initiateDeviceFlow in add.test.ts but tests
      exercise Device Flow only through buildAuthCallbacks (the production path).
      Direct import would be unused and trigger no-unused-vars lint error.
metrics:
  duration: "~11 minutes"
  completed: "2026-06-01T16:36:36Z"
  tasks_completed: 2
  files_modified: 3

# Phase 35 Plan 01: marketplace add Device Flow auth wiring Summary

**One-liner:** JWT-free Device Flow auth wired into addGithubInGuard via
GitAuthBundle forwarded by reference into gitOps.clone, with injectable
credentialOps and deviceFlowHttp seams for test isolation.

## What Was Built

### Task 1: Wire Device Flow onAuthRequired closure into addGithubInGuard

Modified `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`:

- Added imports: `initiateDeviceFlow`, `DEFAULT_CREDENTIAL_OPS`, `CredentialOps`,
  `AuthAttemptResult`, `GitAuthBundle`, `DeviceFlowHttp`
- Extended `AddMarketplaceOptions` with two optional injection seams:
  - `credentialOps?: CredentialOps` (defaults to `DEFAULT_CREDENTIAL_OPS`)
  - `deviceFlowHttp?: DeviceFlowHttp` (test seam; production callers omit)
- Added `const credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS` in
  `addMarketplace`
- Threaded `ctx`, `credentialOps`, and `deviceFlowHttp` into `addGithubInGuard`
- Inside `addGithubInGuard`: constructs `host = "github.com"`, uses
  `makeRawNotifyFn(ctx)` to build the `notifyFn` callback, builds
  `onAuthRequired` closure calling `initiateDeviceFlow`, assembles
  `GitAuthBundle`, and forwards `auth` unconditionally to `gitOps.clone`
- `addPathInGuard` signature unchanged (NFR-5: path sources never clone)
- AUTH-09: no credential field interpolated into Error or notify in add.ts

Added `makeRawNotifyFn` to `extensions/pi-claude-marketplace/shared/notify.ts`:
- Sanctioned adapter that builds a `(message, severity?) => void` callback
  from a ctx without violating the ESLint no-restricted-syntax rule.

### Task 2: New auth-wiring tests

Added 3 tests to `tests/orchestrators/marketplace/add.test.ts` (16 -> 19 total):

- **Test A** (fill HIT): Pre-seeded credential; exercises recorded auth bundle
  via buildAuthCallbacks; asserts fill returns stored cred, no Device Flow
  prompt, auth.credentialOps reference-equal to injected credentialOps
- **Test B** (fill MISS): Empty store + Device Flow http mock with interval=0;
  exercises onAuth miss path; asserts byte-exact
  `"Open https://github.com/login/device and enter: ABCD-1234"` at info
  severity; token `gho_test_token_AUTH01` returned; approve called once
- **Test C** (bundle reference): Asserts host="github.com", credentialOps
  reference-equal, onAuthRequired is a function

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] makeRawNotifyFn added to shared/notify.ts**
- **Found during:** Task 1 ESLint verification
- **Issue:** ESLint `no-restricted-syntax` rule forbids direct `ctx.ui.notify`
  calls everywhere except `shared/notify.ts`. The plan's inline `notifyFn`
  wrapper would have produced 2 ESLint errors.
- **Fix:** Added `makeRawNotifyFn(ctx)` to `shared/notify.ts` (where the rule
  is disabled). `addGithubInGuard` now calls `makeRawNotifyFn(ctx)` to build
  the `NotifyFn` for `initiateDeviceFlow`. AUTH-09 remains intact: the callback
  only forwards to `ctx.ui.notify`; no credential interpolation.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`
- **Commits:** 61f6200

**2. [Rule 1 - Bug] initiateDeviceFlow import removed from test file**
- **Found during:** Task 2 ESLint verification
- **Issue:** Plan called for importing `initiateDeviceFlow` in the test file
  but tests exercise it only through `buildAuthCallbacks` (not directly).
  Direct import would trigger `no-unused-vars` ESLint error.
- **Fix:** Omitted the import entirely; tests import `buildAuthCallbacks` instead.
- **Files modified:** `tests/orchestrators/marketplace/add.test.ts`
- **Commits:** 30cd123

## Verification Results

- `npx tsc --noEmit`: PASS
- `npx eslint extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`: PASS
- `npx prettier --check extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`: PASS
- `node --test tests/orchestrators/marketplace/add.test.ts`: 19/19 PASS
- AUTH-09 credential-interpolation grep audit: 0 matches

## Commits

- `61f6200` feat(35-01): wire Device Flow onAuthRequired into addGithubInGuard
- `30cd123` test(35-01): add AUTH-01 auth-wiring tests for addMarketplace

## Self-Check

- [x] add.ts exists at expected path
- [x] notify.ts exists at expected path
- [x] add.test.ts exists at expected path
- [x] SUMMARY.md exists
- [x] Commit 61f6200 exists
- [x] Commit 30cd123 exists

## Self-Check: PASSED
