# Pitfalls Research: v1.6 GitHub Private Marketplace Authentication

**Domain:** GitHub Device Flow + git credential helper integration in a Node.js TypeScript Pi extension
**Researched:** 2026-05-31
**Overall confidence:** HIGH (Device Flow protocol behavior from GitHub official docs; isomorphic-git onAuth from Context7 + official docs; credential subprocess behavior from git-scm.com official docs; test isolation patterns from codebase inspection)

---

## Summary

Adding Device Flow authentication to an existing codebase that already has a clean
GitOps mock interface and atomic state management introduces five distinct failure
surfaces that do not interact naturally with each other:

1. **Device Flow polling state machine** -- The GitHub protocol has strict interval
   semantics and multiple error codes that require careful cumulative bookkeeping.
   Getting the polling loop wrong ranges from silent rate-limit bans to a process
   that never exits.

2. **git credential subprocess** -- Spawning `git credential fill/approve/reject` is
   the only cross-platform OS keychain abstraction that works without a native
   Node module, but the subprocess protocol has stdin-closure, PATH, and output
   format edge cases that cause hangs or silent failures.

3. **isomorphic-git onAuth/onAuthFailure callbacks** -- These callbacks are called
   from inside the library's HTTP layer; any exception thrown from them propagates
   as an unhandled error from `clone`/`fetch`, not as a structured auth failure.
   The "keep retrying while you return credentials" contract means a naive
   implementation loops until expiry.

4. **Test isolation** -- The credential store is global OS state. Tests that touch
   the system git credential store leave persistent side effects and require a
   real `git` binary on PATH.

5. **Security surface** -- Tokens acquired via Device Flow must never appear in
   `ctx.ui.notify` output, in error messages surfaced to the user, or in
   `state.json`. isomorphic-git error messages include the repository URL; a token
   embedded in the URL would be exposed.

---

## Critical Pitfalls

### CP-1: `slow_down` adds 5 seconds CUMULATIVELY, not a one-time increase

**What goes wrong:** Every `slow_down` response from GitHub's token endpoint
(`https://github.com/login/oauth/access_token`) means the polling interval
must be permanently increased by 5 seconds FOR THAT POLL LOOP, not reset to
`initial_interval + 5`. An implementation that sets `interval = initial + 5`
on the first `slow_down` and ignores subsequent slow-downs will over-poll and
accumulate further `slow_down` responses, eventually hitting a rate-limit ban.

**Root cause:** Misreading the spec. RFC 8628 §3.5 and GitHub's docs both say
"adds 5 extra seconds to the minimum interval" -- this is cumulative. Each
slow-down adds another 5 on top of whatever the current interval already is.

**Consequences:** Silent throttling that looks like "Device Flow never completes"
in testing; potential temporary ban from GitHub's OAuth endpoints for the app.

**Prevention:** Maintain a mutable `currentInterval` variable, initialized from
the `interval` field in the device code response. On `slow_down`: `currentInterval
+= 5`. Use `currentInterval` (not the original `interval`) for every `setTimeout`
call in the polling loop.

```typescript
let currentInterval = deviceCodeResponse.interval; // seconds, typically 5
// ...
if (error === "slow_down") {
  currentInterval += 5; // cumulative
  await sleep(currentInterval * 1000);
  continue;
}
if (error === "authorization_pending") {
  await sleep(currentInterval * 1000);
  continue;
}
```

**Detection:** A test that simulates `slow_down` twice in a row should assert
the third poll fires after `initial + 10` seconds, not `initial + 5`.

**Phase:** Core Device Flow polling loop (polling module unit tests).

---

### CP-2: `authorization_pending` must NOT advance the interval; only `slow_down` does

**What goes wrong:** Some implementations increment the interval on
`authorization_pending` as a conservative backoff. This is incorrect -- only
`slow_down` modifies the interval. Incrementing on `authorization_pending` means
the user gets ~10-30 extra seconds of wait time before the token is picked up,
which degrades UX noticeably since Device Flow already has a 5-second minimum
poll gap.

**Root cause:** Conflating "keep waiting" with "slow down". They are distinct states.

**Prevention:** Treat `authorization_pending` as a pure retry signal -- wait
`currentInterval` seconds and poll again. Do not touch `currentInterval`.

**Phase:** Polling loop design.

---

### CP-3: `expired_token` during poll means the Device Code expired, NOT the access token

**What goes wrong:** The polling loop receives `expired_token` and the handler
either treats it as a generic auth error (causing a confusing `ctx.ui.notify`
about an invalid token) or silently swallows it. In either case the user sees
no actionable guidance.

**Root cause:** The error code name is misleading -- it means the *device code*
(valid 15 minutes from issuance) expired while waiting for the user, not that
an access token is invalid.

**Consequences:** User is left staring at a "please visit X and enter Y" prompt
that has already expired; the extension appears hung.

**Prevention:** Explicitly handle `expired_token` as a terminal polling state:
exit the loop, emit a `ctx.ui.notify` with severity `error` and a message like
`Device code expired. Run the command again to restart authorization.`

**Phase:** Polling loop error handling. Add a dedicated test case asserting the
user-visible message and that the loop terminates.

---

### CP-4: Polling timer keeps the process alive unless cleared or unreferenced

**What goes wrong:** The Device Flow polling loop uses `setTimeout` (or
`setInterval`) to schedule the next poll. If the Pi extension process exits
for any reason while a poll is in-flight, Node.js will not exit cleanly -- it
will wait for the timer to fire. In test suites run with `node --test`, an
unreferenced timer keeps the test process alive past the test's end, causing
`node:test` to report a hanging process or a timeout.

**Root cause:** Node.js event loop stays alive for any scheduled `setTimeout` that
has not been cleared or `.unref()`-ed.

**Prevention:**
- Keep a reference to every `setTimeout` call in the polling loop.
- Always call `clearTimeout(handle)` when exiting the loop (success, error,
  cancellation, or expiry).
- For the test harness: use `after()` hooks to abort any in-progress poll
  via an `AbortController` signal. The polling function should accept an
  `AbortSignal` and call `clearTimeout` + throw `AbortError` when the signal fires.

**Phase:** Polling module design + test isolation.

---

### CP-5: `git credential` subprocess hangs if stdin is not explicitly closed after writing

**What goes wrong:** `git credential fill` reads a key-value block from stdin
terminated by a blank line. If the Node.js code writes the key-value pairs but
never writes the terminating blank line, OR writes the blank line but never calls
`child.stdin.end()`, the `git credential` subprocess waits indefinitely for more
input and the parent `await` never resolves.

**Root cause:** `git credential` expects the stdin stream to signal EOF (or a blank
line) before it proceeds. Node's `child.stdin.write()` does not automatically close
the stream.

**Consequences:** The `marketplace add` / `marketplace update` command appears to
hang with no output. No timeout is applied by default. In tests that do not mock
the credential subprocess, the test runner hangs.

**Prevention:**
```typescript
// Correct pattern for git credential fill:
child.stdin.write(`protocol=https\nhost=github.com\n\n`); // blank line required
child.stdin.end(); // explicit EOF -- required even after blank line
```
The blank line (`\n\n` at the end) signals end of the attribute block per the
git-credential wire format. `child.stdin.end()` closes the pipe, preventing the
subprocess from blocking on further input.

**Detection:** A test that spawns a real `git credential fill` process without
the blank line + `.end()` and asserts the promise resolves within 2 seconds will
hang. Use this as an integration regression guard.

**Phase:** git credential subprocess wrapper implementation.

---

### CP-6: `git credential fill` exits non-zero and emits no output when no credential is stored

**What goes wrong:** When the OS keychain has no stored credential matching the
query, `git credential fill` exits with code 1 and produces no output on stdout.
An implementation that `await`s the subprocess and checks `stdout` will receive an
empty string and may either throw a parse error, interpret it as "username=\npassword=\n",
or silently proceed with empty credentials.

**Root cause:** The git credential protocol does not distinguish "not found" from
error via a structured response -- it uses the exit code and empty stdout.

**Prevention:** Treat exit code !== 0 AND empty stdout as the "no credential found"
signal. Return `null` or `undefined` (not an empty `GitAuth` object) so the caller
can trigger Device Flow. A nonempty stdout with exit code 0 is a valid credential.

```typescript
if (exitCode !== 0 || stdout.trim() === "") {
  return null; // No credential found -- trigger Device Flow
}
```

**Phase:** git credential subprocess wrapper.

---

### CP-7: `git credential approve` must receive the SAME `protocol=` and `host=` attributes as the `fill` query, or it stores to the wrong key

**What goes wrong:** The credential is stored under a key that combines `protocol`,
`host`, and optionally `path`. If `approve` is called with a different combination
(e.g., omitting `path`, or using `http` instead of `https`), the OS keychain stores
a new entry rather than overwriting the one that `fill` found. Subsequent `fill` calls
then return the old (rejected) credential instead of the newly approved one.

**Root cause:** git credential helpers match credentials by exact attribute set.
Adding or removing attributes changes the match key.

**Prevention:** Use a single constant attribute set for all three operations
(`fill`, `approve`, `reject`). For GitHub, the minimal correct set is:
```
protocol=https
host=github.com
```
Do not add `path=` unless you intend per-repo isolation.

**Phase:** git credential subprocess wrapper + integration test with a dummy keychain.

---

### CP-8: `git credential reject` called with stale credentials leaves a phantom entry on macOS Keychain

**What goes wrong:** macOS Keychain stores multiple entries for the same service+account
combination if `approve` is called more than once. When `reject` is called, it deletes
the FIRST matching entry, leaving duplicates. Subsequent `fill` calls then return a
stale (deleted) credential from the remaining entry.

**Root cause:** macOS Keychain and `git-credential-osxkeychain` do not deduplicate
on store; they append. The git credential protocol's `reject` action only removes
the first match.

**Prevention:**
- Always call `reject` before a new `approve` when rotating a token, not just `approve`.
- In tests, do not call `approve` against the real system keychain. Always mock the
  credential subprocess in unit and integration tests.

**Confidence:** MEDIUM -- observed in community bug reports; not documented in official
git-scm.com docs. Apply defensively.

**Phase:** git credential wrapper + test isolation (see TI-1 below).

---

### CP-9: isomorphic-git `onAuthFailure` loops indefinitely if it always returns credentials

**What goes wrong:** isomorphic-git's documentation explicitly states: "As long as
your `onAuthFailure` function returns credentials, it will keep trying." If the
callback unconditionally calls `git credential fill` and always gets a credential
back (even a stale one), the loop will run until the OS blocks the repo host or
the process is killed. There is no built-in retry cap.

**Root cause:** The loop-until-cancel design is intentional (it is a feature for
interactive UIs that prompt users repeatedly), but it requires the caller to return
`{ cancel: true }` -- or `void` -- to stop.

**Prevention:**
- Track whether Device Flow has already been attempted for this URL in the current
  operation. If `onAuthFailure` fires after a Device Flow was completed and the new
  credential was approved, return `{ cancel: true }` rather than re-entering Device
  Flow.
- Pattern: keep a `boolean` flag `authAttempted` in the closure. On first failure:
  run Device Flow, call `git credential approve`, return the new credential. On
  second failure (the new credential also failed): call `git credential reject`,
  return `{ cancel: true }`.

```typescript
let authAttempted = false;
const onAuthFailure = async (url: string) => {
  if (authAttempted) {
    await rejectStoredCredential(url);
    return { cancel: true }; // prevent infinite loop
  }
  authAttempted = true;
  const token = await runDeviceFlow(url);
  await approveCredential(url, token);
  return { username: token, password: "x-oauth-basic" };
};
```

**Phase:** isomorphic-git wrapper layer (the new `clone`/`fetch` wrappers that
accept `onAuth`/`onAuthFailure`).

---

### CP-10: isomorphic-git `onAuthFailure` does NOT receive a structured "401" signal -- it receives the failed GitAuth object; throwing from it propagates as a clone/fetch rejection

**What goes wrong:** If the `onAuthFailure` callback throws (e.g., Device Flow
throws because `ctx.ui` is unavailable, or `git credential` subprocess throws),
the exception propagates directly from `git.clone()` or `git.fetch()` as an
untyped error. The caller in the marketplace orchestrator receives an unexpected
error, bypassing the `MarketplaceAuthError` path and surfacing a raw error to
the user via the generic catch block.

**Root cause:** isomorphic-git does not wrap callback exceptions in a structured
error type. Any exception thrown in a callback is re-thrown as-is from the git
operation.

**Prevention:**
- Wrap the entire body of `onAuth` and `onAuthFailure` in `try/catch`.
- On catch: log the error for debugging (not via `ctx.ui.notify`), then return
  `{ cancel: true }` so isomorphic-git throws a predictable `UserCanceledError`.
- The marketplace orchestrator should explicitly handle `UserCanceledError` and
  surface a user-friendly message: `Authentication canceled.`

**Phase:** isomorphic-git wrapper + marketplace add/update orchestrators.

---

## Test Isolation Pitfalls

### TI-1: Tests that call real `git credential` interact with the developer's OS keychain

**What goes wrong:** Any test that does not mock the credential subprocess will
call the real `git credential fill/approve/reject` binary. On macOS this touches
the Keychain; on Linux it touches the Secret Service or plaintext store; on Windows
it touches the Credential Manager. This causes:
- Stored test credentials that persist after the test run.
- False positives: a developer with a real GitHub token stored for `github.com`
  will see tests pass that should test the "no credential found" path.
- Test pollution: `approve` in one test inserts an entry that `fill` returns in a
  different test.

**Prevention:**
- The credential subprocess must be injectable, the same way `GitOps` is injectable
  in the existing marketplace orchestrators.
- Define a `CredentialOps` interface (analogous to `GitOps`) with `fill`, `approve`,
  and `reject` methods. The default implementation spawns `git credential`. Tests
  pass an in-memory mock.
- `makeMockGitOps` in `tests/helpers/git-mock.ts` should be extended with a
  `makeMockCredentialOps` factory following the same pattern (call log + behavior
  overrides).

**Phase:** Interface design in the new auth module. Must be in place before the
first test that touches credential behavior.

---

### TI-2: Mocking `onAuth`/`onAuthFailure` at the GitOps layer, not the isomorphic-git layer

**What goes wrong:** If tests mock `git.clone` at the isomorphic-git import level
(e.g., via `node:test`'s `mock.module`), the `onAuth`/`onAuthFailure` callbacks
in the real `platform/git.ts` are never invoked. Tests then only exercise the
happy path and miss the auth-failure-triggers-Device-Flow contract.

**Prevention:** The existing `GitOps` mock (`tests/helpers/git-mock.ts`) is the
right interception point for happy-path tests. For auth-specific tests:
- Either extend `MockGitState` with `cloneThrows: new HttpError(401, ...)` and
  observe the orchestrator's response, OR
- Add a separate `cloneWithAuth` method to the `GitOps` interface that wraps
  the real `git.clone` with `onAuth`/`onAuthFailure` callbacks, injectable for
  testing.
- The second approach is preferred: it keeps auth logic in one testable place
  rather than scattered across every operation.

**Phase:** GitOps interface extension + test helper update.

---

### TI-3: Device Flow polling loop tests must mock the GitHub token endpoint, not the whole network

**What goes wrong:** Tests that mock `fetch` globally (e.g., via `mock.fn()` on
`globalThis.fetch`) can accidentally suppress error responses intended for
isomorphic-git's HTTP layer when both run in the same test context. The Device
Flow polling calls GitHub's REST API (`https://github.com/login/oauth/access_token`);
isomorphic-git calls GitHub's Git smart HTTP protocol (`https://github.com/<owner>/<repo>.git/info/refs`).
These are entirely different endpoints and must be mocked independently.

**Prevention:** Isolate Device Flow polling in its own module that accepts an
injectable `fetch`-like function. Do not mock `globalThis.fetch` in tests; mock
the injected function. The isomorphic-git HTTP layer uses its own `http` plugin
(`isomorphic-git/http/node`), which is already replaced by `MockGitOps` in existing
tests -- there is no conflict as long as the injected fetch is scoped.

**Phase:** Device Flow module design.

---

### TI-4: `node --test` worker isolation does not prevent timer leaks from polling loops

**What goes wrong:** `node:test` runs tests in the same process by default
(no worker isolation). A polling loop that escapes from a test (e.g., the test
threw before the loop cleanup ran) keeps the Node.js event loop alive past the
test file's last test, causing `node:test` to report `# pending` handles and
eventually time out the CI step.

**Prevention:**
- Every test that creates a polling loop must use `after()` or `afterEach()` to
  abort the loop via the `AbortController` pattern described in CP-4.
- Use `t.mock.timers` (available in `node:test` v21+) to fake `setTimeout` in
  polling tests rather than relying on real timers. This eliminates the timer-leak
  problem entirely for unit tests.
- For integration tests that need real timing, set a hard test timeout
  (`{ timeout: 30_000 }`) and rely on the AbortController cleanup in `after()`.

**Phase:** All Device Flow polling tests.

---

## Security Pitfalls

### SEC-1: GitHub token MUST NOT be stored in `state.json`

**What goes wrong:** `state.json` is the extension's primary persistence file,
written atomically via `write-file-atomic`. It lives at
`<scopeRoot>/pi-claude-marketplace/state.json` which is a user-readable file
with no special permissions. Storing a GitHub access token there exposes it to
any process that can read the user's home directory (log scrapers, backup tools,
accident `cat` invocations).

**Root cause:** It is tempting to cache the token in `state.json` alongside the
marketplace record to avoid re-running `git credential fill` on every operation.

**Prevention:** Tokens must never be written to `state.json` or any file under
`<scopeRoot>/pi-claude-marketplace/`. The ONLY accepted token storage is the OS
keychain via `git credential approve`. `git credential fill` is called at operation
time (on each `clone`/`fetch`) and its result is used in-memory only for the
duration of the single git operation.

**Phase:** Auth module design review. Add an architecture test (analogous to the
existing NFR-5 no-network test) that grep-asserts no call to state write functions
carries a credential field.

---

### SEC-2: isomorphic-git error messages include the repository URL; tokens embedded in URLs leak to `ctx.ui.notify`

**What goes wrong:** If a token is ever placed in the repository URL
(e.g., `https://token@github.com/owner/repo`), isomorphic-git's `HTTPError` and
`NotFoundError` messages include the full URL as their message text. The
marketplace orchestrators catch these errors and surface them via `ctx.ui.notify`,
which is the user-visible output channel. This leaks the token to:
- The Pi UI output that the user sees
- Any logging layer the host may apply to `ctx.ui.notify` calls

**Root cause:** The temptation to use URL-embedded credentials as a convenience
shortcut, combined with isomorphic-git's URL-preserving error messages.

**Prevention:**
- NEVER embed a token in the repository URL.
- ALWAYS pass credentials via `onAuth` returning `{ username: token, password: 'x-oauth-basic' }`.
- When catching errors from isomorphic-git operations and forwarding to
  `ctx.ui.notify`, strip the URL from the error message or replace it with the
  display name of the marketplace.

**Phase:** isomorphic-git wrapper layer + error handling in marketplace orchestrators.

---

### SEC-3: The Device Flow `user_code` is safe to display, but the `access_token` is not -- do not conflate them

**What goes wrong:** The Device Flow protocol produces two distinct strings:
`user_code` (the short code the user types, e.g., `ABCD-1234`) which is safe and
intended for display, and `access_token` (the OAuth token) which must be treated
as a secret. An implementation that logs both via `ctx.ui.notify` for debugging,
or that stores both in a progress object visible to tests, leaks the token.

**Prevention:**
- The `user_code` and `verification_uri` are the ONLY Device Flow values that
  go through `ctx.ui.notify`.
- The `access_token` must stay in a local variable and be written only to
  `git credential approve`. It must never be assigned to a field named `token`
  on any object that is passed to notification, logging, or state functions.
- In tests: mock the Device Flow HTTP call to return a deterministic but obviously
  fake token like `"MOCK_TOKEN"`. Do not use a real GitHub token in any test
  fixture committed to the repo.

**Phase:** Device Flow module + `ctx.ui` integration.

---

### SEC-4: `git credential reject` must be called when a stored token is known-invalid; skipping it leaves a broken credential in the OS keychain forever

**What goes wrong:** When isomorphic-git calls `onAuthFailure` with the credentials
that failed, those credentials came from `git credential fill`. If the code returns
`{ cancel: true }` without calling `git credential reject`, the invalid token stays
in the OS keychain. Every subsequent `git credential fill` for `github.com` returns
the same invalid token, and every `marketplace add` / `marketplace update` for any
private GitHub marketplace immediately fails with a 401 without triggering Device
Flow (because `onAuth` returned a credential).

**Root cause:** `git credential reject` is the required cleanup step when `onAuthFailure`
fires, analogous to `forgetSavedPassword` in isomorphic-git's own documentation example.

**Prevention:** The `onAuthFailure` callback MUST call `git credential reject` with
the failed credential before either returning new credentials or canceling. The
sequence is:
1. `git credential reject` (remove the bad token from keychain)
2. Run Device Flow (or return `{ cancel: true }` if Device Flow is not applicable)
3. `git credential approve` (store the new token)
4. Return the new `GitAuth`

**Phase:** isomorphic-git wrapper layer. Add a test asserting `reject` is called
before Device Flow on the second auth attempt.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Device Flow polling module | CP-1, CP-2, CP-3 (slow_down cumulative, pending vs slow, expiry) | Implement all error codes in a single `switch`; test each code path with fake fetch |
| Process lifecycle / cleanup | CP-4 (timer leak) + TI-4 | Accept `AbortSignal`; use `t.mock.timers` in unit tests |
| git credential subprocess | CP-5 (stdin hang), CP-6 (empty output), CP-7 (attribute set mismatch) | Use `CredentialOps` interface; test with mock before integrating real subprocess |
| isomorphic-git wrapper | CP-9 (infinite loop), CP-10 (callback throws) | `authAttempted` flag; `try/catch` wrapping entire callback body |
| Test suite isolation | TI-1, TI-2, TI-3 | `CredentialOps` injectable interface; never call real `git credential` in unit tests |
| Auth module design | SEC-1, SEC-3 | Architecture test: no token field in state; no token in notify call |
| Error message handling | SEC-2 | Scrub URL from isomorphic-git error messages before `ctx.ui.notify` |
| Token invalidation flow | SEC-4 + CP-8 | Always `reject` before `approve` on rotation; document and test the sequence |

---

## Sources

**HIGH confidence -- verified against official documentation:**
- GitHub Docs: [Authorizing OAuth Apps -- Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) -- `slow_down` adds 5 seconds cumulatively; `authorization_pending` requires waiting `interval` seconds; `expired_token` is a terminal polling state; device code expires after 900 seconds
- isomorphic-git official docs via Context7 `/isomorphic-git/isomorphic-git`: `onAuthFailure` "will keep trying as long as it returns credentials"; `{ cancel: true }` stops the loop and throws `UserCanceledError`; `onAuth` returns `{ username, password }`
- git-scm.com: [git-credential Documentation](https://git-scm.com/docs/git-credential) -- key-value wire format; blank-line terminator; `approve`/`reject` produce no output; `fill` returns stdout key-value or exits non-zero when not found

**MEDIUM confidence -- multiple sources agree, behavior observed in community:**
- Node.js child_process docs: stdin not closing causes subprocess hang; `.end()` required
- httptoolkit.com "Unblocking Node With Unref()": unreferenced `setTimeout` keeps process alive
- macOS Keychain duplicate-entry behavior on `git credential approve` (community reports, CP-8)
- panva/node-openid-client PR #357: `AbortController` pattern for Device Flow polling cancellation
