---
phase: 33-git-ts-auth-wiring-auth
verified: 2026-06-01T15:08:44Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 33: platform/git.ts Auth Callback Wiring Verification Report

**Phase Goal:** Wire isomorphic-git `onAuth`/`onAuthFailure` callbacks in `platform/git.ts` using `CredentialOps` (fill-first, then Device Flow on miss).
**Verified:** 2026-06-01T15:08:44Z
**Status:** passed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `buildAuthCallbacks` calls `credentialOps.fill` first; invokes `onAuthRequired` only on null result (SC-1) | VERIFIED | Lines 337-345: `fill(opts.host)` called unconditionally; `onAuthRequired()` is inside the `if (filled !== null) { return filled }` else-fall-through. Test 1 confirms fill-hit never calls `onAuthRequired`; Test 2 confirms fill-miss does. |
| 2 | `onAuthFailure` calls `credentialOps.reject` then returns `{ cancel: true }` unconditionally (SC-2 / CP-9) | VERIFIED | Lines 367-378: `reject(opts.host, cred)` inside try, `return { cancel: true }` unconditionally after the try/catch. Tests 5 + 6 both assert `result === { cancel: true }` and one `rejectCall` recorded. |
| 3 | All exceptions inside `onAuth` and `onAuthFailure` are caught and converted to `{ cancel: true }` (SC-3 / CP-10) | VERIFIED | `onAuth` wraps its entire body in a single try/catch (lines 336-359); `onAuthFailure` wraps `reject` in a nested try/catch (lines 367-373) and returns cancel unconditionally. Tests 4, 7, 8 each throw from fill, reject, and onAuthRequired respectively and assert `{ cancel: true }`. |
| 4 | `npm run check` exits 0; no new packages introduced; `orchestrators/marketplace/shared.ts` byte-for-byte unchanged (SC-4) | VERIFIED | `npm run check`: 1301/1301 tests pass, exit 0. `git diff HEAD~1 -- ...shared.ts` produces empty output. SUMMARY lists `added: []` in tech_stack. |
| 5 | Zero imports from `domain/` (or any non-platform tier) in `platform/git.ts` (SC-5) | VERIFIED | `grep -n "from.*domain/" platform/git.ts` produces no output. Only imports are `node:fs`, `isomorphic-git`, `isomorphic-git/http/node`, and `./git-credential.ts` (sibling platform file). |

**Score: 5/5 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts` | `buildAuthCallbacks()` function; `AuthAttemptResult` type; `OnAuthRequiredFn` type; `CloneOptions.auth?`; `FetchOptions.auth?` | VERIFIED | All exports present and substantive. Function is 64 lines with full logic (not a stub). `CloneOptions.auth?` at line 59, `FetchOptions.auth?` at line 68. |
| `tests/platform/git-auth-callbacks.test.ts` | 8 unit tests covering fill-hit, fill-miss+DF-ok, fill-miss+DF-!ok, fill-throws, onAuthFailure post-DF, onAuthFailure pre-DF, reject-throws, onAuthRequired-throws | VERIFIED | 188 lines (above 120 minimum). 8 tests, 8 pass, 0 fail. Each test creates its own independent closure scope. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `platform/git.ts::buildAuthCallbacks.onAuth` | `CredentialOps.fill` | `opts.credentialOps.fill(opts.host)` called first inside try/catch | WIRED | Line 337: `const filled = await opts.credentialOps.fill(opts.host)` |
| `platform/git.ts::buildAuthCallbacks.onAuth` | `opts.onAuthRequired` | Called only after fill returns null | WIRED | Lines 344-345: fill-hit returns immediately; `onAuthRequired()` reached only in the fall-through path |
| `platform/git.ts::buildAuthCallbacks.onAuthFailure` | `CredentialOps.reject` | `opts.credentialOps.reject(opts.host, cred)` inside try/catch | WIRED | Line 368: `await opts.credentialOps.reject(opts.host, cred)` |
| `tests/platform/git-auth-callbacks.test.ts` | `platform/git.ts::buildAuthCallbacks` | `import { buildAuthCallbacks }` + `makeMockCredentialOps` | WIRED | Line 26: direct import; line 50: first usage in test 1 |

---

### Data-Flow Trace (Level 4)

Not applicable. Both artifacts are pure logic (factory function + unit tests) -- no dynamic data rendering, no database queries, no state management. The "data" is injected via mock `CredentialOps` in tests and flows deterministically through the closure. The unit tests confirm actual return values match expected shapes.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 8 unit tests pass | `node --test tests/platform/git-auth-callbacks.test.ts` | 8 pass / 0 fail / exit 0 | PASS |
| Full check suite passes | `npm run check` | 1301/1301 pass / exit 0 | PASS |
| No domain/ imports | `grep -n "from.*domain/" platform/git.ts` | No output | PASS |
| shared.ts unchanged | `git diff HEAD~1 -- .../shared.ts` | Empty diff | PASS |

---

### Probe Execution

No probes declared or discoverable for this phase. Step 7c: SKIPPED (no probe-*.sh files for this phase).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-01 | 33-01-PLAN.md | Private repo auth via Device Flow on fill miss | SATISFIED | Tests 2+3: fill-miss path invokes `onAuthRequired`; ok path returns DF cred; !ok path returns `{ cancel: true }` |
| AUTH-02 | 33-01-PLAN.md | Silent keychain reuse on subsequent operations | SATISFIED | Test 1: fill-hit returns stored cred; `onAuthRequired` call count is 0 |
| CP-9 | 33-01-PLAN.md | No infinite retry loop in isomorphic-git | SATISFIED | `onAuthFailure` returns `{ cancel: true }` unconditionally (Tests 5+6) |
| CP-10 | 33-01-PLAN.md | No raw exception escape from auth callbacks | SATISFIED | try/catch in both `onAuth` (entire body) and `onAuthFailure` (reject call); Tests 4+7+8 |

---

### Anti-Patterns Found

No debt markers (TBD, FIXME, XXX, TODO, HACK, PLACEHOLDER) found in either modified file. No stub patterns (empty returns, placeholder text, hardcoded empty data) found. The `return { cancel: true }` lines are correct protocol responses documented by CP-9/CP-10, not stubs.

---

### Human Verification Required

None. All success criteria are verifiable programmatically and confirmed by automated test execution.

---

### Gaps Summary

No gaps. All five success criteria verified against the actual codebase:

- SC-1: fill-first logic structurally confirmed at lines 337-345; unit tests confirm behavioral contract.
- SC-2/CP-9: unconditional `{ cancel: true }` from `onAuthFailure` confirmed at lines 367-378.
- SC-3/CP-10: both try/catch boundaries confirmed structurally; three tests exercise throw paths.
- SC-4: `npm run check` exits 0 with 1301/1301 passing; `shared.ts` diff is empty; no new packages.
- SC-5: grep for domain/ imports returns nothing.

---

_Verified: 2026-06-01T15:08:44Z_
_Verifier: Claude (gsd-verifier)_
