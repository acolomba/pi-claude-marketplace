---
phase: 01-private-repos-on-any-git-host
reviewed: 2026-09-28T13:34:19Z
depth: standard
diff_base: 5958ee30
diff_head: a90650b6
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - tests/platform/git.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 1: Code Review Report (gap closure 01-04)

**Reviewed:** 2026-09-28T13:34:19Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

> This is an incremental review of gap-closure plan 01-04 (`git diff 5958ee30..a90650b6`).
> It supersedes the earlier phase-1 review for these four files. The earlier report
> (deep, `f4f98c66..3adb12c4`, 22 files) is still in git history at commit `370cca68`.

## Summary

Plan 01-04 replaces `isomorphic-git/http/node` with a module-private client in
`platform/git.ts`. The client sends each hop with `followRedirects: false` and follows
redirects itself. It drops `authorization` and `cookie` whenever the target's `URL.origin`
differs from the origin of the original request. The two docstring edits in
`auth-host.ts` and `git-auth-callbacks.ts` now name this client as the redirect guard.

The core guard is correct for what it claims:

- The origin compare uses `URL.origin`. Scheme, host and port all count, and a default port normalizes away.
- The header filter ignores case, which matters because isomorphic-git sets `Authorization` with a capital A.
- A relative `Location` resolves against the current hop.
- A dropped header stays dropped on later hops.
- The redirect body is closed with `body.return()`, which destroys the stream. `decompress-response`'s wrapper also destroys the socket.
- The redirect cap matches `simple-get`: 11 requests, then an error.
- A redirect to a non-HTTP scheme fails in Node's `http.request` with `ERR_INVALID_PROTOCOL`, so nothing is sent.
- A redirect from https to http on the same host no longer carries the credential. The redirect is still followed in cleartext, as the plan requires.

Verification run by this review:

- `node --test tests/platform/git.test.ts`: 51/51 pass.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/git.ts`: 100% (branches 67/67, functions 17/17, lines 503/503).
- A scratch probe against the real client (not committed) confirmed WR-01 and WR-04 below.

The main defects:

- **WR-01:** A 401 from a foreign origin still enters the bound host's auth loop. On GitHub and GitLab, this evicts a credential the bound host never rejected.
- **WR-02:** The UAT saw the credential leak on two requests: `info/refs` and the `git-upload-pack` POST. Only the `info/refs` request has a regression test.
- **WR-03:** The header scrub is a denylist. The credential type still allows arbitrary headers, and the scrub would pass them through.
- **WR-04:** An empty `Location` header is treated as a redirect to the same URL, which the docstring and `simple-get` do not do.

## Warnings

### WR-01: A 401 from another origin makes the bound host's credential be filled and then evicted, or starts a Device Flow

**File:** `extensions/pi-claude-marketplace/platform/git.ts:212-237` (the docstring states the behavior at `:255-258`). The eviction happens in `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:214-243`.

**Issue:** When a cross-origin hop answers 401, `sendHop` returns that 401 to isomorphic-git unchanged. `GitRemoteHTTP.discover` cannot tell which origin sent the 401. It calls `onAuth(<original url>)`, which runs `credentialOps.fill(host)` for the bound host. It retries the bound host with the credential. The bound host redirects again, the foreign origin answers 401 again, and discover calls `onAuthFailure`. On a provider host (`evictOnFailure: true`, meaning github.com and gitlab.com), `onAuthFailure` calls `credentialOps.reject(host, cred)` and deletes a stored credential that the bound host never rejected.

This review reproduced the sequence against the real client: bound host `h.invalid` 302 → `h.invalid:8443` 401, with `evictOnFailure: true`. The credential calls were `['fill', 'reject']`. The wire log showed the credential sent only to the bound origin, so no credential leaked.

On a provider host with nothing stored, the same foreign 401 starts an interactive Device Flow for the bound host. The token the user then approves is evicted on the next round. The server that asked for credentials can never receive them, so the whole auth loop is wasted work, and on provider hosts it destroys a credential. The new tests use `evictOnFailure: false` (`tests/platform/git.test.ts:623-632`), so they never exercise this path.

Before 01-04, the same thing happened on cross-hostname redirects. The gap closure extends it to redirects that change only the port or the scheme. Plan 01-04's truth 4 promises no eviction "on a host that cannot mint a replacement". The client could decline the challenge itself and keep the auth callbacks out of the loop entirely.

**Fix:** In the client, end the operation when a hop that left the original origin is challenged. Throw the same `UserCanceledError` that the cancel path already produces, so orchestrators still render `{authentication required}`, but `fill`, `onAuthRequired` and `reject` are never reached:

```ts
async function sendHop(hop: GitHttpRequest, origin: string, redirects: number): Promise<GitHttpResponse> {
  const response = await nodeHttpClient.request({ ...hop, fetchOptions: { followRedirects: false } });
  const location = redirectLocation(response);
  if (location === undefined) {
    if (new URL(hop.url).origin !== origin && (response.statusCode === 401 || response.statusCode === 203)) {
      await response.body?.return?.();
      // GAUTH-06: a foreign origin can never receive the bound credential, so its
      // challenge must not reach onAuth / onAuthFailure (no fill, no Device Flow, no eviction).
      throw new git.Errors.UserCanceledError();
    }
    return response;
  }
  // ...
}
```

Then update the cross-origin expectations: `credentials.calls.fill` becomes `[]`, and the wire log stops after the second request. Add one row with `evictOnFailure: true` that asserts `reject: []`.

### WR-02: No test covers a redirect of the credential-bearing `git-upload-pack` POST

**File:** `tests/platform/git.test.ts:794-810`, `:870-887`, `:1174-1227`

**Issue:** The UAT reproduction in 01-04-PLAN (objective) saw the credential cross origins twice: on `info/refs`, and "again on the POST->GET `git-upload-pack`". isomorphic-git's `connect` applies `updateHeaders(headers, auth)`, so the POST carries `Authorization`.

Every credential-carrying redirect test redirects only `info/refs`:

- The clone and fetch cases cancel inside `discover` and never reach the POST.
- The same-origin rows redirect only `info/refs`.
- The POST-redirect rows (`postRedirectServer`, `:596`) run with no `auth`, so their requests carry no `Authorization`.

A plausible wrong `nextHop` passes the whole suite. For example, one that strips credential headers only when `hop.method === "GET"`, or only on the POST→GET arm. This is the second leak path the UAT found. Must-have truth 1 ("receives no `authorization` header on any request… for `clone`, `fetch`") is therefore proven only for the GET leg.

**Fix:** Add rows to the POST-redirect table that use `boundAuth(storedCredentials())`, with a server that challenges `info/refs` once and then redirects `git-upload-pack`:

- 302 and 307 to `OTHER_PORT_UPLOAD_PACK_URL`. Assert that the cross-origin POST/GET arrives with `authorization: null`. Include the same-origin POST in the whole-log assertion.
- 307 to `RENAMED_UPLOAD_PACK_URL` as the same-origin control. It keeps `BASIC_CREDENTIAL`.

Compare the whole `wireCredentials(requests)` log, as the existing cross-origin rows do.

### WR-03: The cross-origin scrub is a denylist, but `GitCredentials.headers` lets a credential add any header

**File:** `extensions/pi-claude-marketplace/platform/git.ts:168`, `:497-503`; `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:156-157`

**Issue:** `CROSS_ORIGIN_HEADERS` names only `authorization` and `cookie`. `GitCredentials` (`git.ts:497-503`) still declares `headers?: Record<string, string>`. isomorphic-git's `updateHeaders` does `Object.assign(headers, auth.headers)` for whatever `onAuth` returns (`node_modules/isomorphic-git/index.cjs:9369-9378`). A provider whose `credentialFrom` returns a token header, such as GitLab's `Private-Token` or a Gitea-style `X-Gitea-OTP`, would pass through every cross-origin hop unchanged.

No producer sets `headers` today. `credentialFill` returns `{ username, password }`, and both registry descriptors return `{ username, password }`. So this is latent, but nothing enforces it. The docstrings now claim the client "never forwards the credential headers to another origin" (`auth-host.ts:156-157`), and that is only true while no credential carries a header.

**Fix:** Pick one:

- Narrow the type so the compiler enforces the assumption. Remove `headers` from `GitCredentials`. It is still assignable to isomorphic-git's `GitAuth`, because the field is optional there.
- Switch the scrub to an allowlist on cross-origin hops, keeping only the headers isomorphic-git itself sets: `accept`, `content-type`, `content-length`, `user-agent`, `git-protocol`, `accept-encoding`. Everything else is dropped.

### WR-04: An empty `Location` header is followed as a redirect to the same URL

**File:** `extensions/pi-claude-marketplace/platform/git.ts:186-189`, `:231`

**Issue:** `redirectLocation` returns `headers.location` whenever the status is 3xx, including `""`. Then `new URL("", hop.url)` resolves to the current URL, and the client loops back to the same URL until the cap. This review measured the result: 11 requests, then `Error: too many redirects`.

`simple-get` checks `res.headers.location` for truthiness (`node_modules/simple-get/index.js:50`), so it returns such a response to isomorphic-git, which raises `HttpError` 302. The docstring (`:260-262`) says "Every other redirect rule is the one `simple-get` applies" and "A 3xx without a `Location` is returned unchanged". Both statements are false for an empty header. The user sees a generic redirect-loop error instead of the server's status, and the server gets ten extra requests.

**Fix:**

```ts
function redirectLocation(response: GitHttpResponse): string | undefined {
  const { statusCode, headers = {} } = response;
  const location = headers.location;
  return statusCode >= 300 && statusCode < 400 && location !== undefined && location !== ""
    ? location
    : undefined;
}
```

Add a row to the existing "returns a redirect without a Location header" case with `headers: { location: "" }`.

## Info

### IN-01: The docstring's git-parity claim is broader than what git does

**File:** `extensions/pi-claude-marketplace/platform/git.ts:255-266`

**Issue:** "A cross-origin redirect is still followed, as git does over libcurl" holds only for git's initial request. Git's default `http.followRedirects=initial` follows a redirect only on the first `info/refs` request, and then rebases later requests onto the redirected URL. It does not follow a redirect on the `git-upload-pack` POST.

This client follows redirects on every request. On a 307 or 308, it re-sends the POST body to the target, including a cross-origin one. A POST answered with 303 also stays a POST with its body; RFC 9110 §15.4.4 says a 303 should become a GET. Both behaviors come from `simple-get` and are not new, but the comment presents them as git behavior.

**Fix:** Limit the parity sentence to the initial `info/refs` redirect. State explicitly that later requests follow redirects too, which git does not do by default.

### IN-02: A malformed `Location` escapes as an untyped `TypeError` that carries the server's string

**File:** `extensions/pi-claude-marketplace/platform/git.ts:231`

**Issue:** `new URL(location, hop.url)` throws `TypeError [ERR_INVALID_URL]` with `input` set to the raw `Location`. This review measured it with `https://exa mple:99999/`. `simple-get`'s legacy `url.parse` accepted such values. The throw now reaches the orchestrators as a bare `TypeError`, with no HTTP context such as the status code.

**Fix:** Catch the parse failure and throw a typed error that names the status and not the raw value. Or treat the response as having no `Location` and return it unchanged, which yields `HttpError`.

### IN-03: `too many redirects` is an untyped `Error`, and the test asserts it by message

**File:** `extensions/pi-claude-marketplace/platform/git.ts:228`; `tests/platform/git.test.ts:1265`

**Issue:** CONVENTIONS.md asks for one typed error class per failure mode, narrowed by `instanceof` and never by message. The client re-creates `simple-get`'s bare `Error`, and the test pins `{ name: "Error", message: "too many redirects" }`. This keeps the old observable error, so it is acceptable. But it is new production code that uses the pattern the conventions forbid.

**Fix:** None is required for parity. If callers ever need to branch on this failure, add a typed `TooManyRedirectsError` in `shared/errors.ts`.

### IN-04: Parts of the guard's documented contract have no discriminating case

**File:** `tests/platform/git.test.ts:1117-1141`; `extensions/pi-claude-marketplace/platform/git.ts:251-253`

**Issue:**

- `cookie` stripping has no test. isomorphic-git never sets a cookie today, so the risk is low.
- The "another host" row passes with the old `simple-get` client, which scrubs cross-hostname hops itself. It is useful regression coverage, but not proof of the new guard.
- The docstring promises that "a header dropped once stays dropped", as in A → B → A. No row covers a chain that returns to the original origin.

**Fix:** Optionally add an A → B (another port) → A chain row, and assert the whole wire log. The final same-origin hop carries no `authorization`.

### IN-05: `PostRedirectRow` is declared inside `describe`, while its sibling row type is at module scope

**File:** `tests/platform/git.test.ts:1174-1180` versus `:471-475`

**Issue:** `RedirectRow` sits with the other wire types at module scope. `PostRedirectRow` is declared inside `describe("resolveRemoteRef")`, with a `//` comment instead of the `/** */` form its siblings use. This is a small inconsistency in one file.

**Fix:** Move `PostRedirectRow` next to `RedirectRow`, with a `/** */` doc line.

---

_Reviewed: 2026-09-28T13:34:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
