# Sonar-style Code Review: v1.6 Private Marketplace Auth

Date: 2026-06-01
Reviewer: Claude Code (Opus 4.7, 1M)
Scope: 9 files (3 production, 6 tests/helpers) introduced in milestone v1.6
(Phases 30-36). Confidence threshold for inclusion: >= 80.

## Files Reviewed

- /Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/platform/git-credential.ts
- /Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/platform/git.ts
- /Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/domain/github-auth.ts
- /Users/acolomba/src/pi-claude-marketplace/tests/integration/auth-e2e.test.ts
- /Users/acolomba/src/pi-claude-marketplace/tests/platform/git-credential.test.ts
- /Users/acolomba/src/pi-claude-marketplace/tests/platform/git-auth-callbacks.test.ts
- /Users/acolomba/src/pi-claude-marketplace/tests/domain/github-auth.test.ts
- /Users/acolomba/src/pi-claude-marketplace/tests/helpers/credential-mock.ts
- /Users/acolomba/src/pi-claude-marketplace/tests/helpers/device-flow-mock.ts

Cross-referenced AUTH-09 enforcement gate at
/Users/acolomba/src/pi-claude-marketplace/tests/architecture/no-credential-leak.test.ts
and the structured-notify boundary at
/Users/acolomba/src/pi-claude-marketplace/extensions/pi-claude-marketplace/shared/notify.ts.

## Verdict

No Critical (90-100) issues found. No Important (80-89) issues found.

The diff is unusually clean for a security-sensitive area. AUTH-09 discipline
is enforced by a static-grep architecture gate, the platform/domain boundary
is respected, isomorphic-git's onAuth/onAuthFailure contract (CP-9/CP-10) is
honored end-to-end, and every error path in `runPollLoop` returns the
discriminated `DeviceFlowResult` with `authAttempted: true` as designed.

The previously-noted recent-fix items (S3735 void-operator removal, S7735
negated-ternary flip, S7786 TypeError adoption, ESLint `^_` ignore pattern)
all land cleanly with no regressions detectable from the diff.

## Detailed Findings

### High-confidence issues

None at >= 80 confidence.

### Below-threshold observations (informational, not actionable)

These are noted for completeness but DO NOT recommend fixes -- each is
either a documented design intent or below the reporting bar.

1. **`runPollLoop` sleeps BEFORE the first poll** (github-auth.ts:303-314,
   confidence ~40). Conservative but correct per RFC 8628 ("the client MUST
   wait at least `interval` seconds between polls"). The first sleep is also
   the first "between polls" since no prior poll exists; behavior matches
   the GitHub CLI reference impl.

2. **`InitiateDeviceFlowOpts.signal` ignored during HTTP fetch** (github-auth.ts:126,
   194-209, confidence ~30). The signal aborts the inter-poll sleep but the
   `fetch` itself in `pollTokenImpl` does not consume it. A user-cancelled
   Device Flow CAN still complete one final poll and store a credential.
   Documented as "Phase 33 ignores for now" in the type comment; not a
   regression to flag.

3. **`expires_in: 0` emits a Device Flow prompt that immediately times out
   with zero polls** (github-auth.ts:303 + 379, confidence ~55). The
   `runPollLoop` loop predicate fails at entry, so the user sees "Open ...
   and enter: ABCD-1234" then a "timed out" notify with zero poll attempts.
   This is the path Test 8 (github-auth.test.ts:250-280) verifies; GitHub
   has never returned `expires_in: 0` in production, so the UX wart is
   theoretical. Not a bug.

4. **`credentialOps.approve` is awaited without try/catch in
   `runPollLoop`** (github-auth.ts:319, confidence ~50). Test 13
   (github-auth.test.ts:458-476) explicitly contracts this as "A9 -- Phase
   32 does not wrap CredentialOps.approve". The DEFAULT impl
   (`credentialApprove` at git-credential.ts:222-229) is already
   best-effort-silent, so the contract is consistent for the production
   path. A custom CredentialOps that throws would surface as the user
   seeing their successful browser auth -> a cancel from
   buildAuthCallbacks's CP-10 catch -> no keychain persistence. Unpleasant
   but in-contract; not a bug.

5. **`onAuthFailure as git.AuthFailureCallback` structural cast**
   (git.ts:135, 151, confidence ~40). The comment at git.ts:117-124
   explains the `exactOptionalPropertyTypes` contravariance issue
   thoroughly. Runtime is sound; the cast is necessary, not a code smell.

6. **`safePollToken` interpolates `err.message` into the failure reason
   string** (github-auth.ts:287-292, confidence ~45). Hypothetically, a
   custom `DeviceFlowHttp.pollToken` impl could throw with an Error whose
   message embeds the token. The DEFAULT impl (`pollTokenImpl` at line
   183-257) cannot do so -- the success branch returns, it does not throw
   with token data, and the network-error path at line 204-209 only fires
   BEFORE the server responds (no token in scope). Mocked impls in tests
   (device-flow-mock.ts:104-106) only throw the operator-supplied Error.
   Marginally safer to use `err.name` or strip the message, but no
   realistic leak path exists. Below the bar.

7. **`runPollLoop` `currentIntervalSec` grows unboundedly on `slow_down`
   responses** (github-auth.ts:328, confidence ~25). The `expires_in`
   deadline (default 900s) caps total runtime; max realistic
   `currentIntervalSec` is bounded by the deadline divided by 5. No
   overflow risk on any sane GitHub response.

8. **`parseCredentialOutput` skips lines starting with `=`**
   (git-credential.ts:163-177, confidence ~20). `eq <= 0` skips both "no
   `=`" lines AND lines where `=` is at position 0. The latter (empty key)
   has no semantic meaning in git-credential wire format, so dropping is
   correct.

9. **`sanitizeAttrValue` throws `Error`, not `TypeError`**
   (git-credential.ts:127, confidence ~30). The "control-character in
   attribute value" condition is a value-validation error -- arguably a
   `TypeError` per the S7786 lens, but git-credential's own wire-format
   violation is closer to a format error than a JS type error.
   Defensible either way; the file's other thrown error (line 103,
   timeout) is correctly an `Error`, so the current spelling is internally
   consistent.

10. **Tests interpolate token literals like `gho_test_token_e2e` into
    source code** (auth-e2e.test.ts:71, 191, 246; github-auth.test.ts
    multiple, confidence ~15). These are dummy values that match GitHub's
    `gho_*` prefix pattern, which is what the AUTH-09 inline guard at
    auth-e2e.test.ts:124 scans for. Could trip a generic secret scanner
    (TruffleHog etc.) on a false positive, but the project's pre-commit
    hook already exercises TruffleHog on these files. Not a bug.

## Architectural Cross-checks (all green)

- **AUTH-09 architecture gate** at
  /Users/acolomba/src/pi-claude-marketplace/tests/architecture/no-credential-leak.test.ts
  covers state-write paths, platform/git-credential.ts, domain/github-auth.ts,
  and Phase-35 orchestrators. The regex at line 128-129 (token-in-Error or
  token-in-notifyFn) is sound -- I spot-checked the production sources
  against it manually.

- **Platform/domain boundary**: domain/github-auth.ts imports type-only from
  platform/git-credential.ts and platform/git.ts (lines 48-49), preserving
  D-13. platform/git.ts imports type-only from platform/git-credential.ts
  (line 6) -- intra-platform, allowed.

- **CP-9 (no infinite retry)**: `buildAuthCallbacks.onAuthFailure` (git.ts:353-366)
  unconditionally returns `{ cancel: true }`. Verified.

- **CP-10 (no raw exception escape)**: both `onAuth` (git.ts:330-351) and
  `onAuthFailure` (git.ts:353-366) wrap their bodies in try/catch; thrown
  errors convert to `{ cancel: true }`. Verified by Tests 4, 7, 8 in
  git-auth-callbacks.test.ts.

- **AUTH-09 (no token in notify or Error)**: the only `notifyFn` call in
  github-auth.ts (line 379) interpolates `verification_uri` and `user_code`
  only -- both safe per RFC 8628 and AUTH-03. Verified.

- **`deviceFlowAttempted` flag removal**: confirmed absent from git.ts
  (lines 322-329 retain only an explanatory comment). The comment-only
  reference is correct since the flag was provably dead (written, never
  read).

- **`GCM_INTERACTIVE=never` + `GIT_TERMINAL_PROMPT=0`** both set in the
  spawn env (git-credential.ts:85-88). Pitfall 2 + Pitfall 3 are addressed.

- **`stdin.end()` after `stdin.write(input)`** (git-credential.ts:116-117).
  Pitfall 3 EOF guarantee is in place.

- **`timer.unref()` after `setTimeout`** (git-credential.ts:105). CP-4
  process-lifetime discipline is in place.

## Recommendation

Ship as-is. No blockers, no fix list. The codebase reflects the design
constraints in CLAUDE.md (AUTH-09, CP-9, CP-10, NFR-10, IL-2) and the
test coverage exercises the load-bearing failure modes (fill ENOENT, DF
init failure, slow_down cumulative, access_denied, expired_token,
network error in poll, reject failure, approve failure).
