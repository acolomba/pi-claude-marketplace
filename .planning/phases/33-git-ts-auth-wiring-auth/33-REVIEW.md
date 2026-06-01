---
phase: 33-git-ts-auth-wiring-auth
reviewed: 2026-06-01T00:00:00Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - extensions/pi-claude-marketplace/platform/git.ts
  - tests/platform/git-auth-callbacks.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 33: Code Review Report

**Reviewed:** 2026-06-01
**Depth:** deep
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 33 wires isomorphic-git auth callbacks in `platform/git.ts` via
`buildAuthCallbacks()`. The implementation correctly honours CP-9 (unconditional
cancel in `onAuthFailure`), CP-10 (try/catch in both callbacks), AUTH-02
(fill-first silent reuse), and AUTH-09 (no credential interpolation in error
messages). `npm run check` is GREEN: typecheck, ESLint, Prettier, and all 1301
tests pass.

No critical defects found. Two warnings surface: a self-contradictory JSDoc
block that will mislead the Phase 35 implementer, and a gap in the AUTH-09
architecture gate that leaves the new credential-handling code in `git.ts`
unscanned. Three informational items note a misleading test comment, a
deliberately-dead write, and a test fidelity gap with isomorphic-git's actual
call signature.

## Warnings

### WR-01: Contradictory JSDoc -- `initiateDeviceFlow` cannot be passed directly as `onAuthRequired`

**File:** `extensions/pi-claude-marketplace/platform/git.ts:255-258`

**Issue:** The `AuthAttemptResult` JSDoc block contains this claim:

```
Phase 35 orchestrators pass `initiateDeviceFlow` directly as `onAuthRequired`
and TypeScript's structural typing accepts the assignment with no adapter --
no shared type declaration is needed across tiers.
```

This is false. `initiateDeviceFlow` has signature
`(opts: InitiateDeviceFlowOpts) => Promise<DeviceFlowResult>`, which is
incompatible with `OnAuthRequiredFn = () => Promise<AuthAttemptResult>` -- the
parameter count mismatch means TypeScript rejects a direct assignment.

The correct statement appears three lines later in the `OnAuthRequiredFn`
JSDoc (lines 265-268):

```
Phase 35 binds `host`, `credentialOps`, and `notifyFn` at the orchestrator
call site so this seam takes no parameters.
```

A Phase 35 implementer reading the first paragraph first will write
`onAuthRequired: initiateDeviceFlow` and hit an immediate type error. The
contradictory description impedes the planned downstream wiring.

**Fix:** Replace lines 255-258 with the accurate description. Example:

```typescript
/**
 * Structurally identical to `domain/github-auth.ts::DeviceFlowResult`.
 * Declared LOCALLY in platform/git.ts so this module honours the
 * platform → domain import prohibition. Phase 35 orchestrators bind
 * `host`, `credentialOps`, and `notifyFn` at the call site and pass
 * a zero-argument closure as `onAuthRequired`; TypeScript's structural
 * typing accepts the assignment with no adapter because both arms carry
 * `authAttempted: true`.
 */
```

---

### WR-02: AUTH-09 architecture gate does not scan `platform/git.ts`

**File:** `tests/architecture/no-credential-leak.test.ts:37-97`

**Issue:** `no-credential-leak.test.ts` scans two files for credential
interpolation in `new Error(...)` or `notifyFn(...)` calls:

- `platform/git-credential.ts` (added Phase 31)
- `domain/github-auth.ts` (added Phase 32)

Phase 33 added `buildAuthCallbacks` to `platform/git.ts`, which now processes
`GitCredentials` objects inline. The architecture gate does not scan `git.ts`.
Currently `git.ts` has no `new Error()` calls at all, so there is no active
leak -- but the gate provides no enforcement that this stays true. A future
modification to `buildAuthCallbacks` (e.g. adding a diagnostic error for a
timeout) could introduce a credential interpolation that the gate would silently
miss.

The `STATE_WRITE_FILES` list (line 37-41) and the two targeted `access()`
checks (lines 70-97) are the full scope of the gate; `git.ts` is absent from
both.

**Fix:** Extend the gate to include `platform/git.ts`. Add a third targeted
check mirroring the `git-credential.ts` pattern:

```typescript
const GIT_TS_FILE = "extensions/pi-claude-marketplace/platform/git.ts";

test("AUTH-09 (Phase 33): platform/git.ts never interpolates a credential in an Error message", async () => {
  const src = await readFile(path.join(REPO_ROOT, GIT_TS_FILE), "utf8");
  const stripped = stripComments(src);
  const errorWithCred =
    /new\s+Error\s*\((?:[^)]*\$\{[^}]*(password|access_token|cred\.[a-z]+)|[^)]*\+\s*(password|access_token|cred\.[a-z]+))/i;
  assert.equal(
    errorWithCred.test(stripped),
    false,
    "Error constructor in platform/git.ts interpolates a credential field (AUTH-09 violation)",
  );
});
```

---

## Info

### IN-01: Test 4 comment misattributes `fillThrows` to DEFAULT_CREDENTIAL_OPS ENOENT behaviour

**File:** `tests/platform/git-auth-callbacks.test.ts:96-99`

**Issue:** The test comment states:

```
The mock fillThrows simulates the underlying subprocess error a real
CredentialOps would see (e.g. ENOENT for missing git on PATH).
```

`DEFAULT_CREDENTIAL_OPS.fill()` (`credentialFill`) wraps `gitCredentialIO` in
a `try/catch` that returns `null` on **any** subprocess error, including ENOENT
(documented at `git-credential.ts:178-195`). The real production implementation
never throws from `fill()`. The `fillThrows` scenario exercises a custom
`CredentialOps` implementation that surfaces errors through the fill seam --
a valid test path -- but the stated rationale is wrong.

**Fix:** Revise the comment to describe what the test actually covers:

```typescript
// fillThrows exercises the CP-10 try/catch inside onAuth for a CredentialOps
// implementation that propagates errors rather than returning null on miss.
// (DEFAULT_CREDENTIAL_OPS catches all subprocess errors internally and returns
// null; this path is exercised by custom CredentialOps that choose to surface
// errors to callers.)
```

---

### IN-02: `deviceFlowAttempted` is a dead write -- set but never used for branching

**File:** `extensions/pi-claude-marketplace/platform/git.ts:330,347,366`

**Issue:** `deviceFlowAttempted` is declared (`let deviceFlowAttempted = false`,
line 330), set to `true` on DF success (line 347), and "read" only via
`void deviceFlowAttempted` (line 366) -- a no-op discard that exists solely to
suppress `noUnusedLocals`. The flag has zero effect on any code path: both
`onAuth` and `onAuthFailure` behave identically regardless of its value.

The inline comment (lines 322-328) documents this as intentional
future-proofing. The pattern is coherent, but the `void` read is non-idiomatic
and the write at line 347 is effectively dead code by the project's own
`noUnusedLocals` semantics (the compiler does not distinguish a `void` read
from a real use, but human readers will).

**Fix (optional):** If the flag is not expected to drive logic in Phase 34 or
35, remove it entirely and rely on the `onAuthFailure` unconditional-cancel
(CP-9) without the bookkeeping. If Phase 35 will actually branch on it,
document the concrete future use case in the comment so the intent is
unambiguous:

```typescript
// Phase 35 will branch here: after deviceFlowAttempted, a second 401 means
// the freshly-obtained token was rejected immediately -- surface a distinct
// error message rather than silently cancelling.
```

---

### IN-03: `onAuthFailure` tests use bare credentials; isomorphic-git passes headers-enriched objects

**File:** `tests/platform/git-auth-callbacks.test.ts:119,144,167`

**Issue:** All three `onAuthFailure` test invocations pass
`{ username: "...", password: "..." }` as the `cred` argument. In production,
isomorphic-git calls `onAuthFailure(url, { ...auth, headers: { Authorization: "Basic ..." } })` --
the headers field from the HTTP layer is spread into the credential object before
it reaches the callback (source: `index.cjs:9032-9034`).

`buildAttributeBlock` in `git-credential.ts` only emits `username=` and
`password=` lines, so the extra `headers` field is harmlessly ignored. But no
test verifies that `reject()` behaves correctly when the cred object carries
extra properties. If `buildAttributeBlock` were inadvertently changed to forward
all fields to the wire format, the tests would not catch the regression.

**Fix:** Add a test variant for `onAuthFailure` that passes a headers-enriched
cred matching the isomorphic-git shape:

```typescript
const enrichedCred: GitCredentials & { headers: Record<string, string> } = {
  username: "x-access-token",
  password: "<DF_TOKEN>",
  headers: { Authorization: "Basic eC1hY2Nlc3MtdG9rZW46PERGXlRPS0VOPg==" },
};
const result = await cbs.onAuthFailure(REMOTE_URL, enrichedCred);
assert.deepEqual(result, { cancel: true });
assert.equal(state.rejectCalls.length, 1);
assert.deepEqual(state.rejectCalls[0], { host: HOST, cred: enrichedCred });
```

---

## Finding Summary

| ID    | Severity | File                                       | Line(s)   | Description                                                                     |
|-------|----------|--------------------------------------------|-----------|---------------------------------------------------------------------------------|
| WR-01 | Warning  | `platform/git.ts`                          | 255-258   | JSDoc falsely claims `initiateDeviceFlow` can be passed directly to `onAuthRequired` |
| WR-02 | Warning  | `tests/architecture/no-credential-leak.test.ts` | 37-97 | AUTH-09 gate does not scan `platform/git.ts` (Phase 33 adds credential handling there) |
| IN-01 | Info     | `tests/platform/git-auth-callbacks.test.ts` | 96-99   | Test comment misattributes `fillThrows` to DEFAULT_CREDENTIAL_OPS ENOENT       |
| IN-02 | Info     | `platform/git.ts`                          | 330,347,366 | `deviceFlowAttempted` is a dead write; `void` read is non-idiomatic           |
| IN-03 | Info     | `tests/platform/git-auth-callbacks.test.ts` | 119,144,167 | `onAuthFailure` tests use bare creds; isomorphic-git passes headers-enriched objects |

---

_Reviewed: 2026-06-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
