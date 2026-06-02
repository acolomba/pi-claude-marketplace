---
phase: 36-integration-gate-all-auth
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - tests/integration/auth-e2e.test.ts
  - .planning/REQUIREMENTS.md
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 36: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Two files reviewed: the Phase 36 integration test (`tests/integration/auth-e2e.test.ts`, 294 lines,
3 tests) and the updated `REQUIREMENTS.md`. Mock token strings are clearly fake
(`gho_test_token_e2e`, `stored_token_e2e`, `gho_fresh_token_e2e`, `stale_token`) -- no AUTH-09
concern there. The inline AUTH-09 guards in each test are correctly scoped to `notifyCalls` and
cover the realistic leak surface.

The main issues are in Test 3 (AUTH-07 reject-evict-reflow): `dfHttp1` and `onAuthRequired1` are
dead test infrastructure that is never invoked. The comment at line 239 compounds this with an
actively incorrect claim that "dfHttp1.pollQueue is drained," which is not true. The test still
correctly exercises the evict-and-reflow path via the second round (`dfHttp2`/`onAuth2`), so the
behavior under test is sound -- but the misleading dead code inflates cognitive load for future
maintainers. Three other minor assertion gaps are noted as warnings.

No security vulnerabilities. No data-loss risks. No bugs in the production stack under test.

## Warnings

### WR-01: Test 3 comment claims dfHttp1.pollQueue is drained -- dfHttp1 is never called

**File:** `tests/integration/auth-e2e.test.ts:239`
**Issue:** The comment at line 239 reads: "Second round: dfHttp1.pollQueue is drained; create a
fresh mock set so the second onAuth call can complete its own Device Flow independently." This is
factually incorrect. `dfHttp1` is created and its `pollQueue` is seeded (line 188-204), but it is
never invoked anywhere in Test 3. The `onAuthRequired1` closure that captures `dfHttp1` (line
209-210) is passed to the first `buildAuthCallbacks` call (line 212-216), but **only
`onAuthFailure1` is destructured** from that call -- `onAuth1` is discarded. Because
`onAuthFailure1` never invokes `onAuthRequired`, `dfHttp1.requestCode` and `dfHttp1.pollToken` are
never called. The pollQueue is not drained; it is untouched.

A future maintainer relying on this comment to understand test flow will be misled. They may
incorrectly believe the first Device Flow attempt fired before the eviction, which would change
their mental model of what AUTH-07 guarantees.

**Fix:** Replace lines 239-257 comment with an accurate description, and optionally remove the
now-unnecessary `dfHttp1` setup entirely, simplifying the test:

```typescript
// At this point the in-memory store is empty (stale token evicted above).
// Create a second Device Flow mock so the re-triggered Device Flow (round 2)
// completes without touching dfHttp1, which was never invoked.
const { http: dfHttp2 } = makeMockDeviceFlowHttp({
  pollQueue: [
    {
      kind: "success",
      accessToken: "gho_fresh_token_e2e",
      tokenType: "bearer",
      scope: "repo",
    },
  ],
  deviceCode: {
    device_code: "MOCK_DEVICE_CODE_2",
    user_code: "WXYZ-5678",            // distinct from ABCD-1234 (see WR-03)
    verification_uri: "https://github.com/login/device",
    expires_in: 900,
    interval: 0,
  },
});
```

Alternatively, if you want to preserve `dfHttp1` as a dead-but-harmless seam, delete the
misleading "drained" comment and add: `// dfHttp1 was never invoked (onAuthFailure does not call
onAuthRequired).`

---

### WR-02: Test 3 does not capture dfHttp2 state -- no assertion that the second Device Flow
actually used dfHttp2

**File:** `tests/integration/auth-e2e.test.ts:241`
**Issue:** `makeMockDeviceFlowHttp` returns `{ http, state }`, but only `http` is destructured at
line 241:
```typescript
const { http: dfHttp2 } = makeMockDeviceFlowHttp({ ... });
```
There is no assertion on `dfHttp2.state.requestCodeCalls.length` or
`dfHttp2.state.pollTokenCalls.length`. The test therefore proves that *a* Device Flow fired
(because `notifyCalls.length` grew to 1 at line 275) but does not prove that `dfHttp2`
specifically was the one invoked. If the routing logic were broken and somehow `dfHttp1` were used
instead, the test could still pass (both mocks return the same `accessToken` and `user_code`).
Combined with WR-01, the test has lower discriminating power than it appears.

**Fix:** Capture `state2` and assert at least one call:
```typescript
const { http: dfHttp2, state: dfState2 } = makeMockDeviceFlowHttp({ ... });
// ... (after second round completes)
assert.equal(dfState2.requestCodeCalls.length, 1, "dfHttp2.requestCode must fire in round 2");
```

---

### WR-03: dfHttp2 uses the same user_code as dfHttp1 -- notify-message assertion cannot
distinguish the two mocks

**File:** `tests/integration/auth-e2e.test.ts:253`
**Issue:** `dfHttp2.deviceCode.user_code` is `"ABCD-1234"` (line 253), identical to
`dfHttp1.deviceCode.user_code` (line 199). The assertion at line 278 checks the notify message
against `"Open https://github.com/login/device and enter: ABCD-1234"`. Because both mocks produce
the same message, this assertion cannot verify which mock fired. If the second round accidentally
used dfHttp1's parameters, the message check would still pass.

**Fix:** Give dfHttp2 a distinct `user_code` (and matching assertion):
```typescript
deviceCode: {
  device_code: "MOCK_DEVICE_CODE_2",
  user_code: "WXYZ-5678",           // distinct from dfHttp1's ABCD-1234
  verification_uri: "https://github.com/login/device",
  expires_in: 900,
  interval: 0,
},
// ...
assert.equal(
  notifyCalls[0]!.message,
  "Open https://github.com/login/device and enter: WXYZ-5678",
);
```

## Info

### IN-01: Test 3 does not assert result2.username

**File:** `tests/integration/auth-e2e.test.ts:272`
**Issue:** Test 1 asserts both `result.username === "x-access-token"` and
`result.password === "gho_test_token_e2e"` (lines 98-99). Test 3 only asserts
`result2.password` (line 272); `result2.username` is unchecked. The `username` field is part of
the credential contract (`{ username: "x-access-token", password: <token> }`) and a regression
there would not be caught.

**Fix:** Add:
```typescript
assert.equal(result2.username, "x-access-token");
assert.equal(result2.password, "gho_fresh_token_e2e");
```

---

### IN-02: REQUIREMENTS.md traceability table omits Phase 36 and maps all AUTH requirements to
Phase 32

**File:** `.planning/REQUIREMENTS.md:56-67`
**Issue:** The traceability table maps AUTH-01 through AUTH-07 to "Phase 32 | Satisfied". Phase 32
delivered the `initiateDeviceFlow` unit. The full auth stack (buildAuthCallbacks -- Phase 33,
GitOps threading -- Phase 34, orchestrator call sites -- Phase 35) was delivered and integration-gated
in Phases 33-36. The table does not record Phase 36 as the integration verification gate, making
the traceability incomplete for audit purposes.

**Fix:** Add Phase 36 to the traceability table:
```markdown
| AUTH-01..AUTH-07 | Phase 36 | Integration-verified |
```
Or expand each row to note the phase where each layer was verified end-to-end.

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
