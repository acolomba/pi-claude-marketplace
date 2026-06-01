---
phase: 35-orchestrator-call-sites-output-catalog-auth
plan: "02"
subsystem: orchestrators/marketplace
tags:
  - auth
  - device-flow
  - marketplace-update
  - silent-reuse
  - orchestrator-wiring
dependency_graph:
  requires:
    - "35-00: git-mock fetchCalls.auth field widening"
    - "35-01: add.ts Device Flow wiring (pattern mirror)"
    - "34-01: refreshGitHubClone 5th optional auth param"
    - "33-01: buildAuthCallbacks + OnAuthRequiredFn types"
    - "31-xx: CredentialOps + DEFAULT_CREDENTIAL_OPS"
    - "32-xx: initiateDeviceFlow + DeviceFlowHttp"
  provides:
    - "AUTH-02 silent-reuse contract on marketplace update"
    - "Device Flow onAuthRequired closure in refreshRecord github branch"
    - "GitAuthBundle forwarded as 5th arg of refreshGitHubClone"
  affects:
    - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
    - "tests/orchestrators/marketplace/update.test.ts"
tech_stack:
  added: []
  patterns:
    - "Device Flow onAuthRequired closure pre-bound with host + credentialOps + notifyFn"
    - "GitAuthBundle forwarded as 5th positional arg of refreshGitHubClone"
    - "makeRawNotifyFn(ctx) for notifyFn construction (mirrors add.ts pattern)"
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/orchestrators/marketplace/update.test.ts
decisions:
  - "Closure construction in refreshRecord is byte-equivalent to add.ts per plan spec"
  - "credentialOps is OPTIONAL on UpdateMarketplaceOptions/UpdateAllMarketplacesOptions (defaults to DEFAULT_CREDENTIAL_OPS), REQUIRED on RefreshOneArgs (caller defaults it)"
  - "deviceFlowHttp is OPTIONAL on all three interfaces (test seam)"
  - "notifyFn constructed via makeRawNotifyFn(ctx) matching add.ts pattern"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-01T17:05:44Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 35 Plan 02: Wire Device Flow Auth into marketplace update.ts Summary

Device Flow `onAuthRequired` closure + `GitAuthBundle` wired into `refreshRecord`'s
github branch in `update.ts`, mirroring the `add.ts` pattern from Plan 35-01;
two AUTH-02 contract tests added to `update.test.ts`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire Device Flow into refreshRecord | 9fe7672 | update.ts |
| 2 | Add AUTH-02 tests to update.test.ts | 06459ca | update.test.ts |

## What Was Built

### Task 1: update.ts Device Flow wiring

Added imports: `initiateDeviceFlow`, `DEFAULT_CREDENTIAL_OPS`, `makeRawNotifyFn`,
`GitAuthBundle`, `CredentialOps`, `DeviceFlowHttp`, `AuthAttemptResult`, `OnAuthRequiredFn`.

Extended interfaces:
- `UpdateMarketplaceOptions`: +`credentialOps?: CredentialOps`, +`deviceFlowHttp?: DeviceFlowHttp`
- `UpdateAllMarketplacesOptions`: same two fields
- `RefreshOneArgs`: +`credentialOps: CredentialOps` (required), +`deviceFlowHttp?: DeviceFlowHttp`

In `updateMarketplace` and `updateAllMarketplaces`:
- Default `credentialOps = opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS`
- Forward `credentialOps` and conditional `deviceFlowHttp` into every `refreshOneMarketplace` call

In `refreshRecord` github branch:
```typescript
const host = "github.com";
const { ctx, credentialOps, deviceFlowHttp } = args;
const notifyFn = makeRawNotifyFn(ctx);
const onAuthRequired: OnAuthRequiredFn = async (): Promise<AuthAttemptResult> =>
  initiateDeviceFlow({
    host, credentialOps, notifyFn,
    ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
  });
const auth: GitAuthBundle = { credentialOps, host, onAuthRequired };
await refreshGitHubClone(cloneDir, source.ref, gitOps, () => { cloneAdvanced = true; }, auth);
```

### Task 2: update.test.ts new AUTH-02 tests

Test A ("AUTH-02 update: credentialOps.fill HIT yields silent reuse"):
- Pre-seeds `credentialOps` store with `github.com -> { username: "x-access-token", password: "stored-token" }`
- Asserts NO "Open ..." notification fired (Device Flow does not trigger)
- Asserts `state.fetchCalls[0]?.auth?.host === "github.com"` and reference equality on `credentialOps`
- Exercises closure end-to-end via `buildAuthCallbacks`, confirms stored credential returned

Test B ("AUTH-02 update: the GitAuthBundle is forwarded by reference"):
- Empty `credentialOps` store
- Asserts auth bundle present on fetch call, correct host, same `credentialOps` reference, `onAuthRequired` is function

## Verification Results

- `npx tsc --noEmit`: PASSED (0 errors)
- `npx eslint update.ts`: PASSED
- `npx prettier --check update.ts`: PASSED
- `node --test tests/orchestrators/marketplace/update.test.ts`: 35 tests, 0 failures (33 pre-existing + 2 new)
- `npm run check`: 1312 tests, 0 failures

## Deviations from Plan

None - plan executed exactly as written. The `initialStore` field referenced in the plan
description does not exist on `MockCredentialState`; the actual API uses `store: Map<string,
GitCredentials>`. Adjusted accordingly (Rule 1 - same intent, corrected API usage).

## Known Stubs

None. All auth wiring is functional end-to-end.

## Threat Flags

No new network endpoints, auth paths, or schema changes beyond those already described in
the plan's threat model (T-35-02-01 through T-35-02-05). No new threat surface to flag.

## Self-Check

- [x] update.ts exists and contains Device Flow wiring
- [x] update.test.ts has 2 new AUTH-02 tests
- [x] Task 1 commit 9fe7672 exists
- [x] Task 2 commit 06459ca exists
