---
phase: 32-device-flow-state-machine-auth
verified: 2026-06-01T14:45:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 3/4
  gaps_closed:
    - "WR-01: pollToken throw now caught by safePollToken helper; returns { ok: false, reason: ..., authAttempted: true } -- authAttempted:true guaranteed on all paths including pollToken throws"
    - "WR-03: case 'unexpected' PollResult branch now covered by Test 13 (WR-03 label); asserts reason contains error code + description"
  gaps_remaining: []
  regressions: []
---

# Phase 32: Device Flow State Machine Verification Report

**Phase Goal:** Ship `domain/github-auth.ts` -- the GitHub Device Flow state machine
**Verified:** 2026-06-01T14:45:00Z
**Status:** passed
**Re-verification:** Yes -- after WR-01 and WR-03 gap closure

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Device Flow displays `user_code` + `verification_uri` via `notifyFn` only; token never appears in any notification | VERIFIED | `opts.notifyFn(...)` at line 385 interpolates only `deviceCode.verification_uri` and `deviceCode.user_code`; AUTH-09 gate (Test 3 of no-credential-leak.test.ts) scans the file and returns 0 matches; Test 12 (notify negative scan) passes |
| 2 | `slow_down` increments `currentIntervalSec` cumulatively +5 per occurrence; two consecutive = initial + 10 on third poll | VERIFIED | `currentIntervalSec += 5` at line 334 (in runPollLoop); Test 4 asserts `pollTokenCalls[0].intervalSec === 0`, `[1] === 5`, `[2] === 10`; all 15 tests pass |
| 3 | `access_denied` and `expired_token` exit immediately with a clear, actionable error message | VERIFIED | Switch cases at lines 336-347; Tests 6 and 7 assert human-readable `reason` strings; tests pass |
| 4 | `authAttempted` boolean guard prevents infinite retry loop (Phase 33's CP-9 protection) | VERIFIED | `authAttempted: true` on ALL result paths including pollToken throws (WR-01 fix: `safePollToken` wraps `http.pollToken` in try/catch at lines 286-299 returning `{ kind: "poll_error", reason }`, which the switch at line 348 handles with `authAttempted: true`); Test 14 (WR-01) explicitly exercises the pollToken-throws path and asserts `result.authAttempted === true` |

**Score:** 4/4 truths verified

### Must-Have Truths (from Plan 32-02 frontmatter)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| AUTH-01 happy path resolves to `{ ok: true, cred: { username: 'x-access-token', password: <token> }, authAttempted: true }` | VERIFIED | Test 1 passes; lines 323-326 in github-auth.ts |
| AUTH-01 invokes `credentialOps.approve` exactly once with matching host + cred | VERIFIED | Test 2 asserts `credState.approveCalls.length === 1`; `credentialOps.approve(opts.host, cred)` at line 325 |
| `notifyFn` invoked exactly once after requestCode with `user_code` AND `verification_uri` | VERIFIED | Test 3 asserts `calls.length === 1` and both fields present; line 385 |
| `notifyFn` NEVER contains access_token / device_code | VERIFIED | Test 12 passes; AUTH-09 gate active and GREEN (3/3 architecture tests pass) |
| Two consecutive `slow_down` produce `intervalSec === initial + 10` on third poll | VERIFIED | Test 4 passes; `currentIntervalSec += 5` at line 334 |
| Three consecutive `pending` produce no interval mutation | VERIFIED | Test 5 passes; CP-2: `case "pending": continue` at line 329-331 |
| `access_denied` produces `{ ok: false, reason: <human string>, authAttempted: true }` | VERIFIED | Test 6 passes; lines 336-341 |
| `expired_token` produces `{ ok: false, reason: <human string>, authAttempted: true }` | VERIFIED | Test 7 passes; lines 342-347 |
| `expires_in: 0` deadline exits without polling | VERIFIED | Test 8 asserts `pollTokenCalls.length === 0`; `while (Date.now() < deadlineMs)` at line 309 |
| `requestCode` throw produces `{ ok: false, reason: <init failure string>, authAttempted: true }` | VERIFIED | Test 9 passes; try/catch around `http.requestCode` at lines 373-381 |
| Every `DeviceFlowResult` carries `authAttempted: true` (AUTH-07; D-32-05) | VERIFIED | All paths covered: 6 explicit PollResult switch cases + init-failure path + `poll_error` case (WR-01 fix); Test 14 (WR-01) exercises pollToken throw → `authAttempted: true`; 15/15 tests pass |
| `domain/github-auth.ts` has NO `new Error(...)` or `notifyFn(...)` that interpolates a token field (AUTH-09) | VERIFIED | `grep -nE "(new Error\|notifyFn)..."` returns 0 non-comment matches; AUTH-09 gate active-pass confirmed (3/3 architecture tests, no vacuous-pass message) |
| `npm run check` exits 0 | VERIFIED | `npm run check` exits 0 with 1293/1293 tests |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/github-auth.ts` | DeviceFlowHttp interface + DEFAULT_DEVICE_FLOW_HTTP + initiateDeviceFlow state machine; min 150 lines | VERIFIED | 389 lines; 8 named exports + `safePollToken` and `runPollLoop` private helpers extracted for cognitive-complexity reduction |
| `tests/helpers/device-flow-mock.ts` | `makeMockDeviceFlowHttp` factory + `MockDeviceFlowState` + `MockDeviceFlowHttpHandle`; min 80 lines | VERIFIED | 114 lines; 3 exports; 1 type-only import from production module; `pollQueue.shift()` pattern present; `pollTokenThrows` conditional-spread present |
| `tests/domain/github-auth.test.ts` | Unit tests covering AUTH-01/03/04/05/07/09; min 200 lines | VERIFIED | 477 lines; exactly 15 `test(...)` blocks (original 13 + 2 new for WR-01 and WR-03) |
| `tests/architecture/no-credential-leak.test.ts` | Extended with Phase-32 AUTH-09 gate (3rd test block) | VERIFIED | 3 `test(...)` blocks; Phase-32 gate is active-pass (not vacuous -- `domain/github-auth.ts` is present and scanned) |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `domain/github-auth.ts` | `platform/git-credential.ts` | `import type { CredentialOps }` | VERIFIED | Line 48: `import type { CredentialOps } from "../platform/git-credential.ts"` |
| `domain/github-auth.ts` | `platform/git.ts` | `import type { GitCredentials }` | VERIFIED | Line 49: `import type { GitCredentials } from "../platform/git.ts"` |
| `domain/github-auth.ts` | `node:timers/promises` | `import { setTimeout as sleepMs }` | VERIFIED | Line 46: `import { setTimeout as sleepMs } from "node:timers/promises"` |
| `domain/github-auth.ts` | `safePollToken` wraps `http.pollToken` | try/catch in `safePollToken` helper | VERIFIED | Lines 286-299: `safePollToken` catches throws from `http.pollToken` and returns `{ kind: "poll_error", reason }` |
| `runPollLoop` | `case "poll_error"` | switch arm in runPollLoop | VERIFIED | Line 348-349: `case "poll_error": return { ok: false, reason: r.reason, authAttempted: true }` |
| `tests/domain/github-auth.test.ts` | `tests/helpers/device-flow-mock.ts` | `makeMockDeviceFlowHttp` import | VERIFIED | Line 34: `import { makeMockDeviceFlowHttp } from "../helpers/device-flow-mock.ts"` |
| `tests/domain/github-auth.test.ts` | `tests/helpers/credential-mock.ts` | `makeMockCredentialOps` import | VERIFIED | Line 33: `import { makeMockCredentialOps } from "../helpers/credential-mock.ts"` |
| `initiateDeviceFlow success branch` | `credentialOps.approve(host, cred)` | function call in `case "success"` arm | VERIFIED | Line 325: `await opts.credentialOps.approve(opts.host, cred)` |
| `notifyFn call` | `deviceCode.user_code AND deviceCode.verification_uri` | template-literal interpolation | VERIFIED | Line 385: `opts.notifyFn(\`Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}\`, "info")` |
| `tests/architecture/no-credential-leak.test.ts` | `domain/github-auth.ts` | static file read + regex scan | VERIFIED | `GITHUB_AUTH_FILE` constant; `access(absPath)` + `readFile` + regex scan; active-pass (no vacuous-pass message in output) |

---

## Data-Flow Trace (Level 4)

Not applicable. All artifacts are pure computation modules (state machine, test helpers) with no UI rendering or dynamic data display. The notifyFn callback is an injected sink -- data-flow verification is covered by Test 12 (negative content scan) and the AUTH-09 architecture gate.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 15 domain unit tests pass | `node --test tests/domain/github-auth.test.ts` | 15/15 pass, exit 0 | PASS |
| AUTH-09 gate active-pass (3 tests) | `node --test tests/architecture/no-credential-leak.test.ts` | 3/3 pass, exit 0; Phase-32 gate NOT vacuous | PASS |
| WR-01: pollToken throw returns `authAttempted: true` | Test 14 in domain suite | `result.ok === false`, `result.authAttempted === true`, `reason` matches `/poll failed/` and `/network error in poll/` | PASS |
| WR-03: `unexpected` PollResult covered | Test 13 in domain suite | `result.ok === false`, `reason` matches `/unsupported_grant_type/` and `/grant not supported/` | PASS |
| Full quality gate | `npm run check` | exit 0; 1293/1293 tests | PASS |

---

## Probe Execution

No `scripts/*/tests/probe-*.sh` files referenced in PLAN or SUMMARY. Step 7c: SKIPPED.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 32-02 | User can trigger Device Flow; obtains cred `{ username: "x-access-token", password: <token> }` | SATISFIED | Tests 1 + 2; state machine success branch at lines 323-326 |
| AUTH-02 | 32-02 | Silent token reuse via `git credential fill` (negative coverage only) | DEFERRED | Plan 32-02 explicitly notes "AUTH-02 negative coverage is Phase 33's responsibility"; Phase 32 delivers the state machine result shape consumed by Phase 33's `onAuth` fill-first logic |
| AUTH-03 | 32-02 | User shown `user_code` + `verification_uri` via notifyFn | SATISFIED | Line 385; Test 3 (positive) + Test 12 (negative) |
| AUTH-04 | 32-02 | Cumulative slow_down interval + pending no-change | SATISFIED | `currentIntervalSec += 5` (CP-1); Tests 4 + 5 |
| AUTH-05 | 32-02 | Clear actionable errors for timeout/access_denied/expired_token/init failure | SATISFIED | 5 error return paths (including poll_error from WR-01 fix); Tests 6, 7, 8, 9, 14 |
| AUTH-07 | 32-02 | `authAttempted: true` on both success and failure to prevent retry loop | SATISFIED | Present on ALL result paths including pollToken throws (WR-01 fix); Test 14 exercises that path |
| AUTH-09 | 32-01 (gate) + 32-02 (file) | Token never interpolated into Error or notifyFn messages | SATISFIED | Architecture gate active-pass; AUTH-09 grep self-check returns 0; Test 12 |

**Orphaned requirements check:** REQUIREMENTS.md maps AUTH-09 to Phase 31 (also covered by 32-01). Both Plan 32-01 (requirements: [AUTH-09]) and Plan 32-02 (success criteria includes AUTH-09) claim it -- no orphan.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extensions/pi-claude-marketplace/domain/github-auth.ts` | 147 | `const GITHUB_OAUTH_CLIENT_ID = "GITHUB_OAUTH_APP_CLIENT_ID_PLACEHOLDER"` | INFO | Intentional placeholder per Plan 32-01 Task 1 (operator chose "placeholder ok"); documented in file docblock (lines 29-34); unit tests do not depend on the value; production usage requires operator substitution before Phase 36 smoke test |
| `tests/domain/github-auth.test.ts` | 130 | Test 4 slow_down cumulative takes ~15s real wall clock | INFO | `interval: 0` defers sleeps for the initial interval only; after first `slow_down`, `currentIntervalSec` becomes 5 (real 5s sleep), then 10 (real 10s sleep); known behavior -- no fix needed, test is correct and passes |

**Debt marker gate:** No TBD / FIXME / XXX markers in any Phase-32-created file. The `PLACEHOLDER` in GITHUB_OAUTH_CLIENT_ID is in a string value with documented operator action instructions, not a debt marker.

---

## Human Verification Required

None. Both WR-01 and WR-03 are fully resolved by code and automated tests. All must-haves are VERIFIED.

---

## Deferred Items

Items intentionally addressed in later phases:

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | AUTH-02 full silent-reuse behavior (`credentialOps.fill` consulted first) | Phase 33 | Phase 33 SC1: "`buildAuthCallbacks` returns an `onAuth` that calls `credentialOps.fill` first; only on a miss does it invoke the Device Flow `onAuthRequired` handler" |
| 2 | SC4 full behavior: credential reject eviction before re-trigger (`onAuthFailure` path) | Phase 33 | Phase 33 SC2: "`onAuthFailure` calls `credentialOps.reject` then returns `{ cancel: true }` when `authAttempted` is already true" |
| 3 | Production call sites for `initiateDeviceFlow` (`add.ts`, `update.ts`) | Phases 33-35 | Phase 35 SC1-2: orchestrators construct and pass auth closure |
| 4 | Real GitHub OAuth App `client_id` substitution for `GITHUB_OAUTH_APP_CLIENT_ID_PLACEHOLDER` | Phase 36 (operator action before smoke test) | Phase 32 docblock lines 29-34 document the operator action |

---

## Gaps Summary

No gaps. Phase goal achieved.

All four must-have truths are VERIFIED. The two warnings from the initial verification (WR-01 and WR-03) are fully resolved:

- **WR-01 closed:** `safePollToken` helper (lines 286-299) wraps `http.pollToken` in a try/catch and returns `{ kind: "poll_error", reason }` on throw. The `runPollLoop` switch handles `poll_error` with `authAttempted: true` (line 348-349). Test 14 explicitly exercises this path and asserts `result.ok === false` and `result.authAttempted === true`. The `authAttempted: true` invariant is now unconditional across all execution paths.

- **WR-03 closed:** Test 13 exercises the `{ kind: "unexpected" }` PollResult branch with a description field, asserting both the error code (`unsupported_grant_type`) and description (`grant not supported`) appear in the reason string.

The test count grew from 13 (original) to 15 (13 + 2 WR fixes), and the full pipeline passes 1293/1293 tests.

---

_Verified: 2026-06-01T14:45:00Z_
_Verifier: Claude (gsd-verifier)_
