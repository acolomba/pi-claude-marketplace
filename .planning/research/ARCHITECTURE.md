# Architecture Research: v1.6 GitHub Device Flow Integration

**Researched:** 2026-05-31
**Milestone context:** SUBSEQUENT MILESTONE -- adding Device Flow auth to existing
marketplace add/update flows.

---

## Summary

The existing clone/fetch call sites in `orchestrators/marketplace/add.ts` and
`update.ts` reach git operations exclusively through the `GitOps` interface
injected via `opts.gitOps ?? DEFAULT_GIT_OPS`. `platform/git.ts` wraps
isomorphic-git and is the only file that imports it (D-13 boundary). Neither
orchestrator nor `shared.ts` carries any auth logic today; the comment block in
`platform/git.ts` explicitly marks "No onAuth (public)" as the V1 limitation.

Device Flow must produce a `{ username: string; password: string }` credential
(the isomorphic-git `onAuth` callback shape) before the clone/fetch attempt and
cache it via `git credential approve` (OS keychain) so subsequent operations skip
the interactive prompt. The 401 trigger comes from isomorphic-git's `onAuthFailure`
callback, which fires after the server returns HTTP 401.

The clean integration point is a new `domain/github-auth.ts` module that owns the
Device Flow state machine, plus a new `platform/git-credential.ts` module that
wraps the `git credential fill/approve/reject` subprocess calls. The `GitOps`
interface gains an `onAuthRequired` callback slot that orchestrators inject; the
default implementation (bound in `shared.ts` as `DEFAULT_GIT_OPS`) uses the real
auth modules. Tests keep injecting a custom `GitOps` stub with no auth behavior
and add a separate `onAuthRequired` mock.

The duplicate `GitCredentials` type declaration in `platform/git.ts` is a
standalone fix that lands before the auth work.

---

## Integration Points

### 1. `platform/git.ts` -- isomorphic-git `onAuth` / `onAuthFailure` callback slots

**Current state:** `clone()` and `fetch()` pass neither `onAuth` nor
`onAuthFailure` to isomorphic-git. The comment block explicitly states "No onAuth
(public)."

**Required change:** Both `git.clone({...})` and `git.fetch({...})` must accept
optional `onAuth` and `onAuthFailure` callbacks forwarded from the caller. The
isomorphic-git type for `onAuth` is:

```ts
onAuth?: (url: string, auth: GitAuth) => GitAuth | void | Promise<GitAuth | void>
onAuthFailure?: (url: string, auth: GitAuth) => GitAuth | void | Promise<GitAuth | void>
onAuthSuccess?: (url: string, auth: GitAuth) => void | Promise<void>
```

where `GitAuth = { username?: string; password?: string; headers?: Record<string, string> }`.

`platform/git.ts` must expose `CloneOptions` and `FetchOptions` with optional
`onAuth`, `onAuthFailure`, and `onAuthSuccess` fields. The real implementation
pipes them into the isomorphic-git call. Tests can omit them (public repos) or
inject stubs.

**Duplicate fix (prerequisite):** `GitCredentials` is currently declared twice in
`platform/git.ts`. One declaration must be deleted before the auth fields are
added so TypeScript does not see conflicting definitions.

### 2. `orchestrators/marketplace/shared.ts` -- `GitOps` interface and `DEFAULT_GIT_OPS`

**Current state:** The `GitOps` interface has six methods (clone / fetch /
forceUpdateRef / checkout / resolveRef / currentBranch). `DEFAULT_GIT_OPS` binds
them to `platform/git.ts` implementations. No auth.

**Required change:** Add an optional `onAuthRequired` callback to both `clone` and
`fetch` option shapes inside `GitOps`:

```ts
export interface GitOps {
  clone(opts: {
    dir: string; url: string; ref?: string; singleBranch?: boolean;
    onAuthRequired?: OnAuthRequiredCallback;
  }): Promise<void>;
  fetch(opts: {
    dir: string; remote?: string; ref?: string;
    onAuthRequired?: OnAuthRequiredCallback;
  }): Promise<void>;
  // ... forceUpdateRef / checkout / resolveRef / currentBranch unchanged
}
```

Where `OnAuthRequiredCallback` is a type defined in `platform/git.ts` (or
re-exported from `domain/github-auth.ts`) with the signature the platform module
uses to wire `onAuth` / `onAuthFailure` on behalf of the caller.

`DEFAULT_GIT_OPS.clone` and `DEFAULT_GIT_OPS.fetch` thread `onAuthRequired`
through to the `platform/git.ts` wrappers. The `platform/git.ts` wrappers build
the isomorphic-git `onAuth` / `onAuthFailure` closures from it.

Tests that inject a custom `GitOps` stub continue to ignore the new field without
any changes to `MockGitState` or `makeMockGitOps`. The field is optional.

### 3. `orchestrators/marketplace/add.ts` -- call site at `addGithubInGuard`

**Current state:** `gitOps.clone({ dir, url, ref, singleBranch })` at line 180.

**Required change:** Pass `onAuthRequired` when the URL is a GitHub source. The
orchestrator receives `ctx` (which carries `ctx.ui.input` and `ctx.ui.notify`)
from its options. Build an `onAuthRequired` callback that delegates to
`domain/github-auth.ts::initiateDeviceFlow(ctx, pi)` and stores the resulting
token via `platform/git-credential.ts::credentialApprove`. The orchestrator does
NOT need to know the Device Flow internals; it passes a closure.

The `AddMarketplaceOptions` interface gains no new fields for auth -- the auth
callback is constructed internally from the already-present `ctx` and `pi`.

### 4. `orchestrators/marketplace/update.ts` -- call site in `refreshRecord`

**Current state:** `refreshGitHubClone(cloneDir, source.ref, gitOps, callback)` at
line 315, which internally calls `gitOps.fetch(...)`.

**Required change:** `refreshGitHubClone` in `shared.ts` gains an optional
`onAuthRequired` parameter (or it is threaded through the `GitOps` `fetch` opts
that `refreshGitHubClone` already constructs). The `refreshRecord` function in
`update.ts` builds and passes the same auth callback closure from its `args.ctx`
and `args.pi`. `UpdateMarketplaceOptions` gains no new fields.

### 5. `orchestrators/marketplace/shared.ts::refreshGitHubClone`

**Current state:** calls `gitOps.fetch({ dir, remote, ref })` directly.

**Required change:** threads `onAuthRequired` from a new optional parameter into
the `gitOps.fetch` call:

```ts
export async function refreshGitHubClone(
  cloneDir: string,
  storedRef: string | undefined,
  gitOps: GitOps,
  onFetchSucceeded?: () => void,
  onAuthRequired?: OnAuthRequiredCallback,  // NEW
): Promise<void>
```

---

## New Components

### A. `platform/git-credential.ts`

**Purpose:** Cross-platform OS keychain access via the `git credential` subprocess.
Three entry points:

- `credentialFill(host: string, pi: ExtensionAPI): Promise<GitAuth | undefined>`
  Calls `git credential fill` over stdin with `protocol=https\nhost=<host>\n\n`.
  Parses stdout `username=...\npassword=...` lines into `{ username, password }`.
  Returns `undefined` on subprocess failure (missing git binary, empty output).
  Uses `pi.exec("git", ["credential", "fill"], { stdin })`.

- `credentialApprove(host: string, auth: GitAuth, pi: ExtensionAPI): Promise<void>`
  Calls `git credential approve` with the same protocol/host/username/password input.
  Swallows subprocess errors (credential store unavailable is non-fatal).

- `credentialReject(host: string, auth: GitAuth, pi: ExtensionAPI): Promise<void>`
  Calls `git credential reject` to evict a bad credential from the cache.
  Swallows subprocess errors.

**Why `pi.exec` not `node:child_process`:** `pi.exec` is available on `ExtensionAPI`
(confirmed in `@earendil-works/pi-coding-agent@0.75.x`
`ExtensionAPI.exec(command, args, options?): Promise<ExecResult>`). Using it
respects the extension sandbox model and avoids a direct `child_process` import
inside extension code, keeping the dependency surface auditable. The `pi` reference
is already required by every orchestrator call site.

**Containment:** writes only to the OS credential store via git's own credential
helper chain; does not touch any path under `<scopeRoot>/pi-claude-marketplace/`.
NFR-10 is unaffected.

**No-network requirement (NFR-5):** path-source `marketplace add` and install/
uninstall/list never call `platform/git-credential.ts`; only the github-source
clone/fetch paths invoke it.

### B. `domain/github-auth.ts`

**Purpose:** GitHub Device Flow state machine. Single entry point:

```ts
export async function initiateDeviceFlow(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
): Promise<GitAuth>
```

Sequence:
1. POST `https://github.com/login/device/code` with `client_id` and
   `scope=repo` (read-only; clone/fetch need `repo` for private repos).
   Accept `application/json`.
2. Show `user_code` and `verification_uri` to user via
   `ctx.ui.notify(\`Open ${verification_uri} and enter code: ${user_code}\`)`.
3. Poll POST `https://github.com/login/oauth/access_token` with
   `grant_type=urn:ietf:params:oauth:grant-type:device_code` at the
   server-specified `interval`. Handle:
   - `authorization_pending`: continue polling.
   - `slow_down`: increase interval by 5 s and continue.
   - `access_denied`: throw `DeviceFlowCancelledError`.
   - `expired_token`: throw `DeviceFlowExpiredError`.
   - Success: return `{ username: "x-access-token", password: access_token }`.
4. Uses `node:https` or `node:http` for the HTTP calls (built-in; no new dep).
   Alternatively uses `isomorphic-git/http/node`'s underlying fetch if it is
   exported, but `node:https` is simpler and avoids coupling.

**Client ID:** a GitHub OAuth app client ID for pi-claude-marketplace. This is a
V1 PUBLIC client (no secret needed for Device Flow; the flow is secret-free by
design). The constant is hard-coded in `domain/github-auth.ts` or read from a
`GITHUB_CLIENT_ID` constant in `shared/constants/`.

**Error types:** `DeviceFlowCancelledError` (user pressed Cancel) and
`DeviceFlowExpiredError` (15-minute window elapsed). Both extend `Error` and are
exported so orchestrator catch blocks can classify them for user-visible messages
via the existing `Reason` closed set (`"access denied"` for cancelled, `"network
unreachable"` for expired or network errors).

**Why domain not platform:** Device Flow is application-level logic (OAuth state
machine, user interaction, error types) rather than an OS/runtime primitive. It
belongs in `domain/` alongside `source.ts`, `manifest.ts`, and `version.ts` per
the existing zone model. `platform/` is reserved for runtime wrappers (isomorphic-
git, Pi extension API).

**Why not platform/git.ts:** `platform/git.ts` wraps isomorphic-git; embedding the
Device Flow there would mix the git transport concern with an OAuth protocol
concern and would also pull `ctx`/`pi` dependencies into a file that today has no
knowledge of the extension API.

**Why not orchestrator concern:** the `onAuth`/`onAuthFailure` callbacks fire
inside isomorphic-git's HTTP stack, which is deep inside the `gitOps.clone` /
`gitOps.fetch` await. The orchestrator's async call to `clone/fetch` is already
awaited; it cannot observe the mid-call auth callbacks from outside. The auth
module must be invokable from within the callback. Keeping it in `domain/` means
both orchestrators can import it without creating a cross-zone dependency violation
(orchestrators already import from `domain/`).

### C. Type: `OnAuthRequiredCallback`

Defined in `platform/git.ts` (exported) or `domain/github-auth.ts`:

```ts
export type OnAuthRequiredCallback = (
  url: string,
) => Promise<GitAuth | undefined>
```

The callback receives the URL being cloned/fetched; the real implementation calls
`credentialFill(host, pi)` first (silent reuse of existing token), then
`initiateDeviceFlow(ctx, pi)` if `credentialFill` returns undefined (first-time
auth). Returns `undefined` to fall back to anonymous access (public repo).

The `platform/git.ts` wrappers construct the isomorphic-git `onAuth` and
`onAuthFailure` callbacks from a single `OnAuthRequiredCallback`:

- `onAuth(url)`: invoke `onAuthRequired(url)`.
- `onAuthFailure(url)`: call `credentialReject` to evict the stale token, then
  invoke `onAuthRequired(url)` again (re-auth after rejection).
- `onAuthSuccess(url, auth)`: call `credentialApprove` to persist the token.

This keeps all keychain side effects inside `platform/git.ts`; `domain/github-
auth.ts` only knows about the OAuth flow.

---

## Modified Components

| File | Change |
|------|--------|
| `platform/git.ts` | Delete duplicate `GitCredentials` declaration. Add optional `onAuth`, `onAuthFailure`, `onAuthSuccess` fields to `CloneOptions` and `FetchOptions`. Thread them into `git.clone` and `git.fetch` calls. Export `OnAuthRequiredCallback` type. Add `buildAuthCallbacks(onAuthRequired, pi)` private helper that builds the three isomorphic-git callbacks. |
| `orchestrators/marketplace/shared.ts` | Add optional `onAuthRequired?: OnAuthRequiredCallback` to `GitOps.clone` and `GitOps.fetch` option shapes. Thread it through `DEFAULT_GIT_OPS.clone` and `DEFAULT_GIT_OPS.fetch`. Add optional `onAuthRequired` parameter to `refreshGitHubClone`. |
| `orchestrators/marketplace/add.ts` | In `addGithubInGuard`, construct and pass an `onAuthRequired` closure (using `ctx` and `pi` from the outer function) into `gitOps.clone`. |
| `orchestrators/marketplace/update.ts` | In `refreshRecord`, pass an `onAuthRequired` closure into `refreshGitHubClone`. |

No changes required to: `domain/source.ts`, `persistence/`, `shared/notify.ts`,
`transaction/`, `bridges/`, `edge/`. The auth concern is entirely contained within
the platform → domain → orchestrator/marketplace chain.

---

## Build Order

Dependencies drive the order. Each component only builds once its dependencies are
built and tested.

**Phase A (prerequisites, no new files):**
1. Fix the duplicate `GitCredentials` declaration in `platform/git.ts`.
   Prerequisite for all type-checked work that follows.

**Phase B (new platform module -- no orchestrator dependency):**
2. `platform/git-credential.ts` with unit tests
   (`tests/platform/git-credential.test.ts`).
   Depends only on `pi.exec` (mocked in tests). No domain or orchestrator imports.

**Phase C (new domain module -- depends on B):**
3. `domain/github-auth.ts` with unit tests
   (`tests/domain/github-auth.test.ts`).
   Imports `OnAuthRequiredCallback` type from `platform/git.ts` (already exists
   after Phase A). Depends on `ctx.ui.notify` (mocked). HTTP calls are mockable
   via a fetch-override seam.

**Phase D (platform/git.ts auth wiring -- depends on A, B, C):**
4. Extend `CloneOptions` / `FetchOptions` in `platform/git.ts` with the optional
   auth callback fields. Add `buildAuthCallbacks` helper that constructs
   `onAuth`/`onAuthFailure`/`onAuthSuccess` from an `OnAuthRequiredCallback`.
   Tests: `tests/platform/git.test.ts` if it exists; otherwise covered by mock
   test at the orchestrator tier.

**Phase E (GitOps interface and refreshGitHubClone -- depends on D):**
5. Extend `GitOps.clone` / `GitOps.fetch` option shapes in `shared.ts`. Update
   `DEFAULT_GIT_OPS` to thread `onAuthRequired` through. Add `onAuthRequired`
   parameter to `refreshGitHubClone`. Existing mock `makeMockGitOps` in
   `tests/helpers/git-mock.ts` requires a one-line audit to confirm `clone` and
   `fetch` option spreads remain compatible with the new optional field.

**Phase F (orchestrator call sites -- depends on E):**
6. Wire auth closures in `add.ts::addGithubInGuard` and
   `update.ts::refreshRecord`. Tests for the auth-triggered path: inject a `GitOps`
   stub that fires `onAuthRequired`, verify `domain/github-auth.ts` is called and
   `ctx.ui.notify` emits the user code.

**Phase G (integration + green gate):**
7. `npm run check` green. Add/update output catalog entries if new notification
   messages are introduced for the auth prompt. Verify existing add/update tests
   still pass unmodified (the new `onAuthRequired` field is optional; all existing
   mock call sites spread opts verbatim and will simply never see the field).

---

## Test Seams

### Existing seam: `GitOps` mock (`tests/helpers/git-mock.ts`)

The `makeMockGitOps` factory already implements the full `GitOps` interface and
supports `cloneThrows` / `fetchThrows` override hooks for failure injection. The
new optional `onAuthRequired` field in the `clone` / `fetch` option shapes does
NOT break the existing mock because:

- `MockGitState` does not need to store `onAuthRequired`; it is a callback the
  caller passes in, not state the mock tracks.
- The mock's `clone` and `fetch` implementations spread their incoming `opts` into
  the call log. The new optional field passes through transparently.
- No existing test passes `onAuthRequired`, so all existing tests remain unmodified.

**New `MockGitState` field:** add `onAuthRequiredCalls: string[]` to record URLs
for which the mock was invoked with a non-undefined `onAuthRequired`. Tests that
exercise the auth-triggered path use a `gitOps` stub where `clone` calls
`opts.onAuthRequired?.(url)` so the domain module fires in test.

### New seam: `domain/github-auth.ts` HTTP fetch override

`initiateDeviceFlow` makes two types of HTTP calls (device code request and
polling). Tests must not hit the real GitHub API. Inject via a constructor
parameter or module-level override:

```ts
export interface DeviceFlowHttp {
  postDeviceCode(clientId: string, scope: string): Promise<DeviceCodeResponse>;
  pollAccessToken(clientId: string, deviceCode: string): Promise<PollResponse>;
}

export async function initiateDeviceFlow(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  http?: DeviceFlowHttp,  // defaults to real HTTPS implementation
): Promise<GitAuth>
```

Tests inject a `DeviceFlowHttp` stub that returns deterministic responses for each
poll state (`authorization_pending` x N, then success / `access_denied` /
`expired_token`).

### New seam: `platform/git-credential.ts` subprocess override

`pi.exec` is already injectable in tests via the `ExtensionAPI` mock (same pattern
as existing tests: `{ exec: async (cmd, args, opts) => mockResult }`). Tests
verify the exact command line built (`["credential", "fill"]`, `["credential",
"approve"]`, `["credential", "reject"]`) and the stdin payload format.

### Existing seam: `ctx.ui.notify` / `ctx.ui.input`

The `ExtensionContext` mock pattern already in use:
```ts
const ctx = {
  ui: { notify: (msg, sev?) => notifications.push({msg, sev}) }
} as unknown as ExtensionContext;
```

The Device Flow prompt uses `ctx.ui.notify` (not `ctx.ui.input`) to display the
user code, consistent with IL-2 (all user-visible messages through `ctx.ui.notify`)
and the fact that the user acts externally (opens the verification URI in a
browser); the extension does not need to capture a typed response.

### Output catalog impact

One new user-visible message pattern for the Device Flow prompt must be added to
`docs/output-catalog.md` and the byte-equality catalog UAT fixture in
`tests/architecture/catalog-uat.test.ts`. The message shape is:
```
Open https://github.com/login/device and enter: XXXX-XXXX
```
routed via `notify(ctx, pi, ...)` -- it does not fit the existing
`NotificationMessage` discriminated union (which is plugin/marketplace lifecycle
output). This is a new direct `ctx.ui.notify` call inside `domain/github-auth.ts`,
not via the `shared/notify.ts` chokepoint. BLOCK A in `eslint.config.js` forbids
direct `ctx.ui.notify` calls outside the chokepoint zone. The Block A exemption
list or the zone boundary must be extended to permit the direct call in
`domain/github-auth.ts`, or `github-auth.ts` must receive a pre-bound `notifyFn`
callback so the direct call does not cross the BLOCK A boundary.

---

## Sources

- `extensions/pi-claude-marketplace/platform/git.ts` (read 2026-05-31): confirmed
  no `onAuth`/`onAuthFailure` callbacks in existing `clone`/`fetch`; "No onAuth
  (public)" comment block.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
  (read 2026-05-31): confirmed `GitOps` interface (6 methods), `DEFAULT_GIT_OPS`
  shape, `refreshGitHubClone` signature.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`
  (read 2026-05-31): confirmed `gitOps.clone` call site in `addGithubInGuard`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
  (read 2026-05-31): confirmed `refreshGitHubClone` call site in `refreshRecord`.
- `tests/helpers/git-mock.ts` (read 2026-05-31): confirmed `MockGitState` shape,
  `makeMockGitOps` API, and call-log pattern.
- `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`
  (read 2026-05-31): confirmed `ExtensionAPI.exec`, `ctx.ui.notify`,
  `ctx.ui.input`, `ctx.ui.confirm` signatures.
- GitHub Device Flow docs (fetched 2026-05-31):
  https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps
  Confirmed: `POST https://github.com/login/device/code`,
  `POST https://github.com/login/oauth/access_token`, error codes
  `authorization_pending` / `slow_down` / `expired_token` / `access_denied`,
  `grant_type=urn:ietf:params:oauth:grant-type:device_code`.
