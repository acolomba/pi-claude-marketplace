---
phase: 32-device-flow-state-machine-auth
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/github-auth.ts
  - tests/domain/github-auth.test.ts
  - tests/helpers/device-flow-mock.ts
  - tests/architecture/no-credential-leak.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the Phase 32 GitHub Device Flow state machine implementation and its
test suite. Core correctness properties are sound: the `DeviceFlowResult`
discriminated union is correct, `authAttempted: true` appears on every return
path (success, all failure branches, timeout, init failure, and abort), the
`slow_down` interval is cumulative (`+= 5` per occurrence, not reset), and
AUTH-09 discipline (no token in `notifyFn` or `new Error` calls) holds both in
the production code and is gate-tested by the architecture test.

Three issues require attention before Phase 33 imports this module: an
asymmetric missing `try/catch` around `http.pollToken` that breaks the
`DeviceFlowResult` contract if `pollToken` throws; a real-timer leak in the
`slow_down` cumulative test (contradicts the "no real timers" invariant and
takes ~15 seconds to run); and a gap in the `unexpected` poll-result path (the
state machine handles it but no test covers it).

## Warnings

### WR-01: `http.pollToken` uncaught -- throws bypass `DeviceFlowResult` contract and CP-9 guard

**File:** `extensions/pi-claude-marketplace/domain/github-auth.ts:318`

**Issue:** `requestCode` is wrapped in a `try/catch` that routes any throw to
`{ ok: false, reason: ..., authAttempted: true }`. `pollToken` (line 318) has
no equivalent guard. If `http.pollToken` throws -- which the mock explicitly
supports via `pollTokenThrows`, and which a future `DeviceFlowHttp` impl could
do on a network-layer error that bypasses `pollTokenImpl`'s own catch -- the
exception escapes `initiateDeviceFlow` as an unhandled rejection. The caller
never sees `authAttempted: true`, defeating Phase 33's CP-9 retry-loop guard
(`onAuthFailure` inspects `authAttempted` to decide whether to return
`{ cancel: true }` instead of re-triggering Device Flow indefinitely). The
`DeviceFlowHttp.pollToken` JSDoc does not say "never throws", making the
omission a latent contract trap.

**Fix:**
```typescript
let r: PollResult;
try {
  r = await http.pollToken(
    GITHUB_OAUTH_CLIENT_ID,
    deviceCode.device_code,
    currentIntervalSec,
  );
} catch (err) {
  return {
    ok: false,
    reason: `Device Flow poll failed: ${err instanceof Error ? err.message : "unknown error"}`,
    authAttempted: true,
  };
}

switch (r.kind) {
  // ... existing cases unchanged
}
```

### WR-02: `slow_down` cumulative test incurs ~15 seconds of real sleep -- contradicts "no real timers" invariant

**File:** `tests/domain/github-auth.test.ts:130`

**Issue:** The test header and `device-flow-mock.ts` both state "no real
timers, no real network" and "tests use `interval: 0` to spin the poll loop
synchronously without mocking timers." This is only true for the initial
interval. The `slow_down` test queue is `[slow_down, slow_down, success]`
starting from `interval: 0`. After poll-1 returns `slow_down`,
`currentIntervalSec` becomes 5; the next `sleepMs(5 * 1000)` call is a REAL
5-second sleep on the wall clock. After poll-2 returns `slow_down`,
`currentIntervalSec` becomes 10; `sleepMs(10 * 1000)` is a real 10-second
sleep. Total: 15 real seconds for one test. This makes the suite misleadingly
slow and violates the documented test design contract. The 30-second `node:test`
default timeout is not exceeded, so the test will not fail -- but it silently
breaks the "no real timers" guarantee.

**Fix:** Use `node:test`'s built-in timer mock to avoid real sleeps:
```typescript
import { mock } from "node:test";

test("Phase 32 initiateDeviceFlow: AUTH-04 cumulative slow_down ...", async (t) => {
  t.mock.timers.enable(["setTimeout"]);   // intercept timers/promises.setTimeout
  const { http, state: httpState } = makeMockDeviceFlowHttp({ ... });
  // ...
  const resultPromise = initiateDeviceFlow({ ... });
  // Tick past each sleep without wall-clock delay:
  await t.mock.timers.tick(0);      // initial interval (0ms)
  await t.mock.timers.tick(5000);   // after first slow_down
  await t.mock.timers.tick(10000);  // after second slow_down
  const result = await resultPromise;
  // assertions ...
});
```

Alternatively, make the sleep function injectable (analogous to the `http`
seam) so tests can pass a no-op sleep.

### WR-03: `{ kind: "unexpected" }` poll result path is untested

**File:** `tests/domain/github-auth.test.ts`

**Issue:** The `switch` in `initiateDeviceFlow` (line 353) handles
`case "unexpected"` by returning `{ ok: false, reason: "Device Flow failed:
${r.error}...", authAttempted: true }`. No test in `github-auth.test.ts`
exercises this code path. The `pollQueue` API on the mock supports it directly
(pass `{ kind: "unexpected", error: "some_code", description: "desc" }`), so
the absence is an oversight. The untested path includes the conditional
`r.description` concatenation; a future refactor could break it silently.

**Fix:** Add a test:
```typescript
test("Phase 32 initiateDeviceFlow: AUTH-05 unexpected poll error returns ok:false with reason", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: { ..., interval: 0 },
    pollQueue: [{ kind: "unexpected", error: "unsupported_grant_type", description: "details" }],
  });
  const { credOps } = makeMockCredentialOps();
  const { notifyFn } = makeNotifyRecorder();

  const result = await initiateDeviceFlow({ host: "github.com", credentialOps: credOps, notifyFn, http });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.authAttempted, true);
    assert.ok(result.reason.includes("unsupported_grant_type"));
    assert.ok(result.reason.includes("details"));
  }
});
```

## Info

### IN-01: `pollTokenThrows` in `MockDeviceFlowState` is dead capability

**File:** `tests/helpers/device-flow-mock.ts:48`

**Issue:** `pollTokenThrows?: Error` is fully wired in the mock (state
initializer spread at line 84, checked at line 104) but no test in
`github-auth.test.ts` ever sets it. Once WR-01 is fixed (adding a
`try/catch` around `http.pollToken`), a test using `pollTokenThrows` should be
added to prove the new catch works. Without WR-01's fix, exercising
`pollTokenThrows` would expose the unhandled-rejection bug.

**Fix:** Once WR-01 is addressed, add:
```typescript
test("Phase 32 initiateDeviceFlow: pollToken throw returns ok:false (A10)", async () => {
  const { http } = makeMockDeviceFlowHttp({
    deviceCode: { ..., interval: 0 },
    pollTokenThrows: new Error("connection reset"),
  });
  // ...
  const result = await initiateDeviceFlow({ ... });
  assert.equal(result.ok, false);
  assert.equal(result.authAttempted, true);
});
```

### IN-02: Test 10 (`AUTH-07 authAttempted on success`) duplicates Test 1

**File:** `tests/domain/github-auth.test.ts:307`

**Issue:** Test 10 asserts `result.ok === true` and `result.authAttempted ===
true` on a success path. Test 1 already asserts the same properties on the
same path (lines 74-78). Test 10 adds no new coverage; it increases suite
maintenance surface without benefit.

**Fix:** Remove Test 10 or replace it with a distinct success-path assertion
(e.g., confirm `cred.username === "x-access-token"` and `cred.password` equals
the queue token -- currently only covered in Test 2).

### IN-03: `AUTH-09` state-write loop has no existence guard -- breaks on file rename

**File:** `tests/architecture/no-credential-leak.test.ts:53`

**Issue:** The first `AUTH-09` test iterates `STATE_WRITE_FILES` and calls
`readFile(path, "utf8")` directly with no `access()` guard or `try/catch` for
`ENOENT`. If any of the three state-write files is renamed or deleted in a
future phase, the test throws `ENOENT` and FAILS rather than passing vacuously.
Compare with the Phase 32 gate at line 99-115, which correctly uses an
existence check. The asymmetry means a future refactor that renames a
persistence file would silently break the AUTH-09 gate rather than giving a
clean skip.

**Fix:** Wrap each file read in an existence check (matching the pattern
already used at lines 101-104):
```typescript
for (const rel of STATE_WRITE_FILES) {
  const absPath = path.join(REPO_ROOT, rel);
  const exists = await access(absPath).then(() => true, () => false);
  if (!exists) continue;   // vacuously satisfied until the file is authored
  const src = await readFile(absPath, "utf8");
  // ... existing check
}
```

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
