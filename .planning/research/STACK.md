# Stack Research: v1.6 GitHub Device Flow Authentication

**Researched:** 2026-06-01
**Confidence:** HIGH

## Summary

No new npm runtime dependencies needed. isomorphic-git's async callbacks support the
full Device Flow polling loop. `git credential` subprocess integration is ~50 lines
of built-in Node.js code. One prerequisite type-fix before auth work begins.

## Findings

### isomorphic-git async callback support

`AuthFailureCallback` returns `Promise<GitAuth | void>` -- isomorphic-git awaits it
before retrying. A full Device Flow polling loop is valid inside `onAuthFailure`.
No internal auth-callback timeout. The `onAuth` pre-fill path (try keychain first,
trigger flow only on miss) is cleaner than relying solely on `onAuthFailure`.

### GitHub Device Flow API

**Step 1 -- Request device code:**
```
POST https://github.com/login/device/code
Content-Type: application/x-www-form-urlencoded
client_id=<CLIENT_ID>&scope=repo
```
Response: `{ device_code, user_code, verification_uri, expires_in: 900, interval: 5 }`

**Step 2 -- Poll for token:**
```
POST https://github.com/login/oauth/access_token
client_id=<CLIENT_ID>&device_code=<device_code>&grant_type=urn:ietf:params:oauth:grant-type:device_code
```

| Error code | Required action |
|---|---|
| `authorization_pending` | Sleep `interval` seconds and retry |
| `slow_down` | Add 5 to current interval (cumulative), sleep, retry |
| `expired_token` | Abort -- 900s window elapsed |
| `access_denied` | Abort -- user cancelled |

Success: `{ access_token: "ghu_...", token_type: "bearer", scope }`

Pass to isomorphic-git as `{ username: "x-access-token", password: access_token }`.

### git credential wire format

Subprocess: `spawn("git", ["credential", "fill|approve|reject"])`. Always set
`GIT_TERMINAL_PROMPT=0` to prevent interactive fallback.

Stdin format (blank line terminates):
```
protocol=https
host=github.com
username=x-access-token   (for approve/reject only)
password=ghu_xxx           (for approve/reject only)
                           (blank line)
```

`fill` stdout: same `key=value` format. Parse with
`stdout.split("\n").filter(l => l.includes("=")).map(l => l.split("=", 2))`.

### npm packages

`git-credential-node` (2022, execa 0.6.x, no types, no ESM) -- **DO NOT USE**.
Hand-roll ~50 lines in `platform/git-credential.ts`. Zero external deps.

### git binary PATH requirement

Reintroduces the `git not on PATH` failure mode that D-21 eliminated. Mitigation:
catch ENOENT on spawn and degrade gracefully (in-memory token, no keychain storage,
no user-visible warning unless the failure affects the operation).

### OAuth App token lifetime

OAuth App tokens do not expire by default. No refresh token handling needed for v1.6.

## Recommendations

### New: `platform/git-credential.ts`
Three async functions: `gitCredentialFill(host)`, `gitCredentialApprove(host, creds)`,
`gitCredentialReject(host, creds)`. `node:child_process` spawn, no external deps.
Graceful ENOENT degradation.

### New: `platform/github-device-flow.ts`
Self-contained async polling loop. Takes `clientId`, `onUserCode` callback
(routes to `ctx.ui.notify`), optional `AbortSignal`. Returns token string or null.
Uses global `fetch` (Node >= 18) or `node:https`. No external deps.

### Prerequisite: fix duplicate GitCredentials type
Fix before any auth work begins to avoid type-check failures.

### No new npm runtime dependencies

All implementation uses Node.js built-ins: `node:child_process`, global `fetch`,
`node:timers/promises`.

## Sources

- isomorphic-git `index.d.ts` in repo `node_modules`
- [GitHub Device Flow -- OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [git credential wire format](https://git-scm.com/docs/git-credential)
- [isomorphic-git authentication](https://isomorphic-git.org/docs/en/authentication)
