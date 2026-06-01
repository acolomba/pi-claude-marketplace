# Phase 32: Device Flow State Machine -- Context

**Gathered:** 2026-06-01
**Status:** Ready for planning
**Source:** Auto-generated (skip_discuss=true) from ROADMAP.md phase goals

<domain>
## Phase Boundary

Phase 32 ships `domain/github-auth.ts` -- the GitHub Device Flow state machine. This is the
core authentication engine for v1.6. It consumes the `CredentialOps` seam from Phase 31 and
exposes an injectable `DeviceFlowHttp` seam for testing.

**In scope:**
- `DeviceFlowHttp` interface: injectable HTTP seam for `device/code` request + token poll loop
- `initiateDeviceFlow(host, opts)`: runs the full Device Flow loop, returns `GitCredentials`
- `slow_down` interval back-off: cumulative +5 s per occurrence
- `access_denied` / `expired_token` error paths: clean exit with actionable error messages
- `ctx.ui.notify` integration via a pre-bound `notifyFn` callback (not direct import)
- AUTH-09 discipline: token NEVER appears in any `ctx.ui.notify` call or error message
- Unit tests with mock HTTP seam; no real GitHub network calls in `npm test`

**Out of scope for Phase 32:**
- Wiring into `platform/git.ts` `onAuth`/`onAuthFailure` closures (Phase 33)
- Threading `onAuthRequired` through `GitOps` interface (Phase 34)
- Call-site wiring in `add.ts` / `update.ts` orchestrators (Phase 35)

</domain>

<decisions>
## Implementation Decisions

### D-32-01: File location
- NEW file: `extensions/pi-claude-marketplace/domain/github-auth.ts`
- Rationale: Device Flow is a domain-layer concern (authentication policy),
  not a platform-layer concern. Platform layer (`platform/git-credential.ts`)
  handles OS keychain primitives; domain layer owns the auth flow logic.

### D-32-02: Injectable HTTP seam
- Export `DeviceFlowHttp` interface with two methods:
  - `requestCode(clientId: string, scope: string): Promise<DeviceCodeResponse>`
  - `pollToken(clientId: string, deviceCode: string, interval: number): Promise<PollResult>`
- `DEFAULT_DEVICE_FLOW_HTTP` implements against `https://github.com/login/device/code`
  and `https://github.com/login/oauth/access_token`
- Test mock: `makeMockDeviceFlowHttp()` in `tests/helpers/device-flow-mock.ts`

### D-32-03: Client ID source
- The GitHub OAuth App `client_id` is a compile-time constant in `github-auth.ts`
  (no env var, no runtime config for v1.6). The value is the pi-claude-marketplace
  OAuth App client ID (public value; not a secret).

### D-32-04: `notifyFn` callback pattern
- `initiateDeviceFlow` receives a `notifyFn: (msg: string, severity: Severity) => void`
  parameter rather than importing `ctx` directly. This keeps the domain module
  decoupled from the Pi extension host and testable without a real `ctx`.
- The caller (Phase 35 orchestrator) pre-binds `ctx.ui.notify`.

### D-32-05: `authAttempted` guard
- `initiateDeviceFlow` sets an `authAttempted` boolean on the returned result
  so Phase 33's `onAuthFailure` callback can detect a second consecutive auth
  failure and return `{ cancel: true }` instead of re-triggering Device Flow
  infinitely (isomorphic-git retry loop protection per AUTH-07).

### D-32-06: AUTH-09 discipline in Device Flow
- `user_code` and `verification_uri` MAY appear in `notifyFn` messages (per AUTH-03).
- The `access_token` / `password` field MUST NEVER appear in any `notifyFn` message
  or error message. The `no-credential-leak.test.ts` architecture gate (Phase 31)
  covers this; domain/github-auth.ts is added to its scan scope.

### Claude's Discretion
- Exact poll loop implementation detail (synchronous sleep vs. async timeout)
- Whether `PollResult` is a discriminated union or throws on terminal errors
- Test helper file name and structure (mirror `tests/helpers/credential-mock.ts` pattern)
- Whether to export `DeviceCodeResponse`/`PollResult` types or keep them internal

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 31 seam (consumed by Phase 32)
- `extensions/pi-claude-marketplace/platform/git-credential.ts` -- CredentialOps
  interface and DEFAULT_CREDENTIAL_OPS; Phase 32 calls `credentialOps.approve()`
- `tests/helpers/credential-mock.ts` -- mock pattern to mirror for DeviceFlowHttp mock

### Prior architecture research
- `.planning/research/ARCHITECTURE.md` -- domain/ layer placement rules
- `.planning/research/PITFALLS.md` -- CP-9 isomorphic-git retry loop (relevant to
  `authAttempted` guard), CP-10 exception handling in onAuth callbacks
- `.planning/phases/31-credential-subprocess-layer-auth/31-RESEARCH.md` --
  open questions resolved: host=string, fill returns null on miss, lookupHost deferred

### Requirements
- `.planning/REQUIREMENTS.md` -- AUTH-01..AUTH-07 definitions
- `.planning/ROADMAP.md` -- Phase 32 success criteria (4 items)

### Architecture patterns
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` --
  GitOps/CredentialOps injection pattern to replicate for DeviceFlowHttp
- `tests/helpers/git-mock.ts` -- makeMockGitOps pattern to mirror

</canonical_refs>

<specifics>
## Specific Ideas

- GitHub Device Flow HTTP endpoints:
  - `POST https://github.com/login/device/code` -- returns `device_code`, `user_code`,
    `verification_uri`, `expires_in`, `interval`
  - `POST https://github.com/login/oauth/access_token` -- poll with `grant_type=urn:ietf:params:oauth:grant-type:device_code`
  - Poll response error codes: `authorization_pending` (continue), `slow_down` (+5s interval),
    `access_denied` (terminal), `expired_token` (terminal)
- AUTH-03: notify message should show `user_code` and `verification_uri`; token NEVER shown (AUTH-09)
- AUTH-04: `slow_down` is cumulative; two slow_downs -> interval = initial + 10s
- AUTH-05: `access_denied` and `expired_token` produce clear error messages, not raw JSON

</specifics>

<deferred>
## Deferred Ideas

- Real GitHub network integration test (opt-in with env var like Phase 31's PI_CM_REAL_GIT_CREDENTIAL=1)
- Refresh token support (not in GitHub Device Flow spec)
- Scope configuration beyond default `repo` (out of v1.6 scope)

</deferred>

---

*Phase: 32-device-flow-state-machine-auth*
*Context gathered: 2026-06-01 via auto-generate (skip_discuss=true)*
