---
phase: 32
slug: device-flow-state-machine-auth
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-01
---

# Phase 32 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in, Node 20+) |
| **Config file** | none |
| **Quick run command** | `node --test "tests/domain/github-auth.test.ts" "tests/architecture/no-credential-leak.test.ts"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command above
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | (gate) | `tests/domain/` glob in npm test picks up github-auth.test.ts | integration | `npm test 2>&1 \| grep "tests/domain"` | (package.json already includes `domain`) | pending |
| 32-01-02 | 01 | 1 | AUTH-09 | no-credential-leak test scans domain/github-auth.ts | architecture | `node --test "tests/architecture/no-credential-leak.test.ts"` | (amended in Wave 1) | pending |
| 32-02-01 | 02 | 2 | AUTH-01 | happy path returns `{ ok: true, cred }` with username/password | unit | `node --test "tests/domain/github-auth.test.ts" -t "happy path"` | Wave 0 (NEW) | pending |
| 32-02-02 | 02 | 2 | AUTH-01 | approve called with host + cred on success | unit | `node --test "tests/domain/github-auth.test.ts" -t "approve on success"` | Wave 0 | pending |
| 32-02-03 | 02 | 2 | AUTH-03 | notifyFn called exactly once with user_code + verification_uri | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-03"` | Wave 0 | pending |
| 32-02-04 | 02 | 2 | AUTH-04 | slow_down increments currentInterval cumulatively (+5 per occurrence) | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-04 cumulative"` | Wave 0 | pending |
| 32-02-05 | 02 | 2 | AUTH-04 | authorization_pending does NOT change currentInterval | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-04 pending"` | Wave 0 | pending |
| 32-02-06 | 02 | 2 | AUTH-05 | access_denied returns `{ ok: false, reason: string }` (not raw HTTP error) | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 access_denied"` | Wave 0 | pending |
| 32-02-07 | 02 | 2 | AUTH-05 | expired_token returns `{ ok: false, reason: string }` | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 expired_token"` | Wave 0 | pending |
| 32-02-08 | 02 | 2 | AUTH-05 | deadline exceeded returns `{ ok: false, reason: <timeout string> }` | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 timeout"` | Wave 0 | pending |
| 32-02-09 | 02 | 2 | AUTH-05 | requestCode HTTP failure returns `{ ok: false, reason: string }` | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 init failure"` | Wave 0 | pending |
| 32-02-10 | 02 | 2 | AUTH-07 | result has authAttempted: true on success | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-07 authAttempted"` | Wave 0 | pending |
| 32-02-11 | 02 | 2 | AUTH-07 | result has authAttempted: true on failure | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-07 authAttempted on failure"` | Wave 0 | pending |
| 32-02-12 | 02 | 2 | AUTH-09 | no token in notifyFn calls -- only user_code + verification_uri | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-09 notify content"` | Wave 0 | pending |
| 32-02-13 | 02 | 2 | AUTH-09 | no token interpolated in Error constructors in github-auth.ts | architecture | `node --test "tests/architecture/no-credential-leak.test.ts"` | Wave 0 (amended) | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `extensions/pi-claude-marketplace/domain/github-auth.ts` -- DeviceFlowHttp interface + DEFAULT_DEVICE_FLOW_HTTP + initiateDeviceFlow state machine + DeviceFlowResult type
- [ ] `tests/helpers/device-flow-mock.ts` -- `makeMockDeviceFlowHttp` factory with programmable response queue + call logs
- [ ] `tests/domain/github-auth.test.ts` -- unit tests against mock (all AUTH-01/03/04/05/07/09 scenarios, minimum 13 tests)
- [ ] Amendment to `tests/architecture/no-credential-leak.test.ts` -- add `domain/github-auth.ts` to AUTH-09 leak scan scope
- [ ] Operator checkpoint task: register GitHub OAuth App (or confirm existing client_id before production use)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Device Flow against github.com | AUTH-01, AUTH-03, AUTH-07 | Requires a registered GitHub OAuth App with Device Flow enabled; interactive user authorization in browser | Set `PI_CM_REAL_DEVICE_FLOW=1`, run `node --test "tests/domain/github-auth.test.ts" -t "real GitHub"`, authorize in browser at displayed URL with displayed code |
| OAuth App registration validity | AUTH-01 | Requires operator action on github.com | Visit github.com Settings -> Developer settings -> OAuth Apps -> confirm app registered with Device Flow enabled and client_id matches constant in domain/github-auth.ts |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
