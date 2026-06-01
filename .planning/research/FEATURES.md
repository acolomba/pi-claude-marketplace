# Features Research: v1.6 GitHub Device Flow Authentication

**Domain:** On-demand OAuth Device Flow for CLI/extension authentication against private GitHub repos
**Researched:** 2026-05-31
**Milestone:** v1.6 GitHub Private Marketplace Authentication

---

## Summary

GitHub Device Flow is the canonical OAuth mechanism for CLI tools and headless apps that cannot
host a redirect endpoint. The flow is: request a `user_code` + `verification_uri` from GitHub,
display them to the user, then poll silently until the user completes the browser step. The
resulting access token is stored for reuse.

The dominant UX reference is `gh auth login`, which shows:

```
! First copy your one-time code: XXXX-XXXX
Press Enter to open https://github.com/login/device in your browser...
```

For pi-claude-marketplace, the situation differs from `gh` in one critical way: the command is a
Pi extension slash-command, not a standalone TTY process. `ctx.ui` is the only sanctioned output
channel (IL-2), and `ctx.ui.notify()` is fire-and-forget (non-blocking). The extension cannot
block a command handler waiting for interactive input in the way a TTY CLI can. The device flow
polling loop must run asynchronously while the user navigates to the browser, and the final
result (token obtained or auth failed) must be surfaced as a subsequent `ctx.ui.notify` call.

**Credential lifecycle:** Once obtained, the token is stored via `git credential approve` (OS
keychain on macOS/Windows, libsecret on Linux). Subsequent `marketplace add` / `marketplace
update` calls run `git credential fill` before attempting the clone/fetch; if a stored token
exists, no Device Flow is triggered. If the stored token is rejected (401 from GitHub), `git
credential reject` is called and Device Flow re-triggers. The `isomorphic-git` `onAuth` /
`onAuthFailure` callbacks are the natural hook points for this chain.

---

## Table Stakes

Must-have behaviors. Missing any of these makes the feature incomplete or broken.

| Feature | Why Expected | Complexity | Testable Criterion |
|---------|--------------|------------|-------------------|
| **Trigger on 401 only** | Device Flow must not run on public repos or when a valid stored token exists; triggering unnecessarily degrades UX | Low | `onAuth` called only after isomorphic-git receives a 401/404 from GitHub |
| **Display `user_code` and `verification_uri`** | User cannot authenticate without these two pieces of information | Low | `ctx.ui.notify` emits a message containing the exact `user_code` string (format `XXXX-XXXX`) and the URL `https://github.com/login/device` |
| **Display `expires_in` context** | GitHub codes expire in 15 minutes (900 s); user needs to know how long they have | Low | Notification includes a time-bound hint (e.g. "expires in 15 minutes") |
| **Non-blocking poll loop** | Extension slash-commands run asynchronously; blocking the command handler is not possible with `ctx.ui.notify` as the only output channel | High | The command handler awaits a Promise that resolves when the poll resolves; the poll does not block the Pi process or hold a lock |
| **Notify on success** | User needs confirmation that auth was accepted and the operation is proceeding | Low | Success notification emitted before continuing the original git operation |
| **Notify on failure with actionable guidance** | User needs to know what went wrong and what to do | Low | Distinct `ctx.ui.notify` calls for `expired_token`, `access_denied`, and poll timeout; each includes what to do next |
| **`git credential approve` on success** | Token must be persisted to OS keychain so subsequent operations reuse it silently | Medium | After successful device flow, spawning `git credential fill` for `github.com` returns the stored token without triggering Device Flow again |
| **`git credential fill` check before triggering** | Avoid unnecessary Device Flow when a cached token already exists | Medium | `onAuth` first calls `git credential fill`; Device Flow triggered only when fill returns no password or empty password |
| **`git credential reject` on isomorphic-git `onAuthFailure`** | If the stored token has been revoked, it must be evicted from the keychain before re-triggering Device Flow | Medium | `onAuthFailure` calls `git credential reject`, then either retriggers Device Flow or surfaces an error |
| **Respect GitHub polling interval** | GitHub's `interval` field (default 5 s) must be honored; violating it yields `slow_down` error codes | Low | Poll loop uses the server-returned interval, not a hardcoded 5 s; `slow_down` increases interval by 5 s |
| **Stop polling on terminal error codes** | `expired_token` and `access_denied` are terminal; infinite poll loop is a resource leak | Low | Poll loop exits immediately on `expired_token` and `access_denied`; surfaces appropriate error notification |
| **Containment: `github.com` only** | The project only supports GitHub-source marketplaces (SP-3); do not generalize credential subsystem to other hosts | Low | `git credential fill/approve/reject` calls use `protocol=https host=github.com`; no other host wired |
| **`marketplace add` and `marketplace update` both covered** | Both commands can encounter a 401 on a private repo (clone vs. fetch) | Medium | Both `gitOps.clone` and `gitOps.fetch` pass `onAuth` / `onAuthFailure` callbacks |
| **No env-var dependency** | v1.6's stated goal is "no env vars required"; the token source must be keychain, not `PI_CLAUDE_MARKETPLACE_GITHUB_TOKEN` | Low | Removing `PI_CLAUDE_MARKETPLACE_GITHUB_TOKEN` from the environment does not prevent successful auth against a private repo |
| **Fix duplicate `GitCredentials` type in `platform/git.ts`** | Explicitly called out in v1.6 milestone scope; duplicate type declarations cause TypeScript errors | Low | `npm run check` passes with zero type errors in `platform/git.ts` |

---

## Differentiators

Nice-to-have behaviors that make the experience notably better, but the feature works without them.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **`marketplace auth logout`** (or `marketplace auth clear`) subcommand | Lets user explicitly evict the stored GitHub token; useful when switching accounts or revoking access | Medium | Would call `git credential reject` for `github.com`; surfaced via `ctx.ui.notify` confirming removal. `gh auth logout` has a known macOS keychain erase gap (issue #13111) -- this implementation should verify erase completed |
| **Clipboard-copy hint for `user_code`** | `gh auth login` auto-copies the code to clipboard; reduces friction since github.com/login/device does not accept paste | Medium | `child_process.exec("pbcopy")` on macOS, `xclip`/`xsel` on Linux, `clip` on Windows; mention in notification if copy succeeded ("Code copied to clipboard") |
| **Automatic browser open** | `gh auth login` attempts `open`/`xdg-open`/`start`; eliminates manual URL navigation | Medium | Attempt `open(verification_uri)` after displaying the code; on failure (SSH, no DISPLAY), silently omit -- the URL is already visible. This is a differentiator not a table stake because the Pi UX already surfaces the URL |
| **Re-authentication hint on known-expired token** | When `git credential fill` returns a token that is clearly expired (e.g. 8-hour GitHub App token per refresh docs), proactively notify before the 401 round-trip | High | Requires storing token metadata; significant complexity for marginal gain given GitHub OAuth App tokens do not expire. Defer unless GitHub App auth is added |
| **`marketplace auth status`** | Show whether a stored token exists and for which user/scope | Low | `git credential fill` + a GitHub API probe (`/user`); surfaces username and token age. Low complexity but adds surface area |

---

## Anti-Features

Behaviors to explicitly avoid, with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Block the command handler synchronously** | `ctx.ui.notify` is fire-and-forget; there is no way to receive user input during a blocking wait in the current Pi extension API (IL-2). A synchronous poll loop in the command handler would hang the Pi process | Run the Device Flow poll as an async Promise that the command `await`s; the command handler is already async |
| **Prompt the user for a PAT as a fallback** | `ctx.ui.input` could collect a token string, but (a) it requires interactive TUI mode, (b) it collects a secret in a text field with no masking guarantee, and (c) it breaks the "no env vars required" UX goal by substituting a manual token entry flow | Device Flow is the only interactive auth path; if Device Flow fails, surface an error with guidance to retry |
| **Store the token in a project file (`.pi/`, state.json, mcp.json)** | NFR-10 (containment) forbids writes outside the scoped directories, and those files are not secret storage. A token written to `state.json` would leak into version control if `.pi/` is committed | Use `git credential approve` which delegates to the OS keychain (macOS Keychain, Windows Credential Manager, libsecret) |
| **Store the token in a custom file in `<scopeRoot>/pi-claude-marketplace/`** | Same reason as above -- this directory may be readable by other processes and its contents are not secrets storage; also duplicates the OS keychain mechanism that `git credential` already provides | `git credential approve/fill/reject` |
| **Expose the raw access token in `ctx.ui.notify` messages** | Tokens in notification output could end up in logs, screenshots, or CI output | Never include token values in any notification message |
| **Polling with a sleep-loop shorter than the server-specified interval** | GitHub will return `slow_down` and increase the required interval; continued violations may result in the device code being invalidated | Use the server-returned `interval`; respect `slow_down` by adding 5 s |
| **Generalizing to non-GitHub HTTPS hosts** | The project scope is GitHub-only (SP-3); a generalized credential helper would add complexity with no current user need and would need to handle per-host OAuth App registration | Hard-code `host=github.com` in `git credential` calls; reject non-github.com URLs at the source-validation layer |
| **OAuth web flow (redirect to localhost)** | Requires running a local HTTP server, opening a specific port, and handling browser redirect -- significant complexity; Device Flow is the correct approach for a CLI/extension context | Device Flow only |
| **Refresh token management** | GitHub OAuth App tokens do not expire (unlike GitHub App user tokens which expire after 8 hours with a 6-month refresh token). Adding refresh token handling now adds significant complexity for a case that doesn't apply to OAuth Apps | If the project later adopts GitHub App auth, add refresh token support then; for now, `access_denied` / `expired` triggers re-auth via full Device Flow |
| **Silent re-auth on every command** | Re-triggering Device Flow mid-operation with no user warning is disorienting | Only trigger Device Flow when `git credential fill` returns nothing or `onAuthFailure` fires; always notify before triggering |
| **env-var pass-through as a permanent fallback** | The milestone goal is "no env vars required"; leaving `PI_CLAUDE_MARKETPLACE_GITHUB_TOKEN` as a silent fallback creates two credential paths to maintain | Remove the env-var credential path; the keychain is the sole credential store. (If migration is needed, document the `git credential approve` command for users who have tokens) |

---

## UX Flow (Expected Sequence)

This is the expected user-visible sequence for a first-time auth against a private marketplace,
based on `gh auth login` patterns, GitHub Device Flow spec, and the Pi `ctx.ui` API constraints.

```
1. User runs: /claude:plugin marketplace add https://github.com/acme/private-plugins
2. Extension attempts clone (no credentials) → GitHub returns 401
3. isomorphic-git fires onAuth callback
4. Extension calls `git credential fill` → returns empty (no stored token)
5. Extension calls GitHub Device Flow endpoint → receives user_code + verification_uri
6. ctx.ui.notify:
     "GitHub authentication required.
      Open https://github.com/login/device and enter code: XXXX-XXXX
      Code expires in 15 minutes."
7. [Background] Extension polls GitHub token endpoint every N seconds
8. User opens browser, navigates to URL, enters code, approves
9. [Background] Poll receives access_token
10. Extension calls `git credential approve` (protocol=https host=github.com
    username=token password=<access_token>)
11. ctx.ui.notify: "GitHub authentication successful. Continuing..."
12. Extension retries the clone with the new token (via onAuth returning the token)
13. Clone succeeds → normal marketplace add success notification
```

**Cancellation / timeout path:**
```
If user does nothing for 15 minutes:
  Poll receives expired_token
  ctx.ui.notify (error): "GitHub authentication timed out. Run the command again to retry."

If user clicks "Cancel" on GitHub's consent page:
  Poll receives access_denied
  ctx.ui.notify (error): "GitHub authentication was denied. Run the command again if this was a mistake."
```

---

## Feature Dependencies

```
git credential fill → [keychain lookup] → token exists? → skip Device Flow
                                        → no token?     → Device Flow
Device Flow success → git credential approve → token stored
onAuthFailure fired → git credential reject → Device Flow (or error if user declines again)
```

The `onAuth` and `onAuthFailure` callbacks from isomorphic-git are the integration seam.
`platform/git.ts` must accept them as parameters on `clone()` and `fetch()` (currently hardcoded
without auth, per the `// No onAuth (public)` comment at line 106).

---

## MVP Recommendation

**Must ship for v1.6 (table stakes only):**

1. `git credential fill` check before any Device Flow attempt
2. Device Flow trigger on 401 with `ctx.ui.notify` showing `user_code` + URL + expiry hint
3. Background poll loop respecting `interval`; terminal on `expired_token` / `access_denied`
4. `git credential approve` on success; `git credential reject` on `onAuthFailure`
5. Success notification + retry of original git operation
6. Timeout / denial error notifications with retry guidance
7. Fix duplicate `GitCredentials` type in `platform/git.ts`
8. Both `clone` and `fetch` paths in `platform/git.ts` wired with `onAuth` / `onAuthFailure`

**Defer (not v1.6):**
- `marketplace auth logout` subcommand: useful, low complexity, but adds surface area; defer to a
  follow-on patch once the core flow is proven
- Clipboard copy: OS-detection complexity; non-blocking to ship without it
- Automatic browser open: nice-to-have; omit in v1 of the feature
- `marketplace auth status`: diagnostic helper; defer

---

## Sources

- [Authorizing OAuth apps -- GitHub Docs (Device Flow section)](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) -- HIGH confidence. Authoritative spec for user_code format (8-char alphanumeric, hyphen-separated), verification_uri, polling interval, 900-second expiry, error codes (expired_token, access_denied, slow_down).
- [isomorphic-git onAuth docs](https://isomorphic-git.org/docs/en/onAuth) -- HIGH confidence. Authoritative for callback shape: receives `(url, auth)`, returns `GitAuth { username, password, headers, cancel }`.
- [isomorphic-git onAuthFailure docs](https://isomorphic-git.org/docs/en/onAuthFailure) -- HIGH confidence. Authoritative for failure-retry pattern and infinite-loop prevention rationale.
- [git-credential documentation](https://git-scm.com/docs/git-credential) -- HIGH confidence. Authoritative for fill/approve/reject stdin/stdout key-value format; `protocol=https host=github.com` wire format.
- [gh CLI issue #5886: one-time code display string](https://github.com/cli/cli/issues/5886) -- HIGH confidence. Documents the exact `gh auth login` device flow terminal message format and UX iteration.
- [gh CLI issue #8598: show browser login URL](https://github.com/cli/cli/issues/8598) -- HIGH confidence. Documents why the URL must always be shown even when browser auto-open fails.
- [gh CLI issue #12925: polling requires Enter press](https://github.com/cli/cli/issues/12925) -- MEDIUM confidence. Background context on gh's polling model; pi-claude-marketplace's async model avoids this issue.
- [gh CLI oauth library](https://github.com/cli/oauth) -- MEDIUM confidence. Implementation reference for Device Flow in a Go CLI; pattern applies to the JS/TS domain.
- [git-credential-manager issue #2059: OAuth token expiration](https://github.com/git-ecosystem/git-credential-manager/issues/2059) -- MEDIUM confidence. Confirms Git 2.40/2.41 protocol now carries expiry metadata; relevant for future refresh token work, not v1.6.
- [Refreshing user access tokens -- GitHub Docs](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens) -- HIGH confidence. Confirms OAuth App tokens do not expire (only GitHub App user tokens expire after 8 hours); justifies deferring refresh token handling.
- [Scopes for OAuth apps -- GitHub Docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) -- HIGH confidence. Confirms `repo` scope is required for private repository access via OAuth App Device Flow.
- [gh CLI issue #13111: auth logout macOS keychain gap](https://github.com/cli/cli/issues/13111) -- MEDIUM confidence. Known limitation of `git credential reject` on macOS in the gh context; implementation should verify erase on the `marketplace auth logout` differentiator.
- [@earendil-works/pi-coding-agent dist/core/extensions/types.d.ts](node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts) -- HIGH confidence. Authoritative for `ctx.ui.notify(message: string, type?: "info" | "warning" | "error"): void` signature; confirms fire-and-forget, no blocking input capability in notify.
