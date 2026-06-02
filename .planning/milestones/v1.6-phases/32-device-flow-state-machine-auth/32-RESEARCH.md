# Phase 32: Device Flow State Machine (AUTH-01..05, AUTH-07) - Research

**Researched:** 2026-06-01
**Domain:** GitHub OAuth Device Flow state machine in a Node.js TypeScript Pi extension; injectable HTTP seam for test isolation; integration with the Phase 31 `CredentialOps` surface and AUTH-09 leak discipline
**Confidence:** HIGH

## Summary

Phase 32 ships a new file `extensions/pi-claude-marketplace/domain/github-auth.ts` that
implements the full GitHub OAuth Device Flow as a state machine with an injectable
`DeviceFlowHttp` seam (HTTP) and a pre-bound `notifyFn` callback (so the domain module
does not import `ctx` directly and the BLOCK A `ctx.ui.notify` chokepoint stays intact).
The state machine consumes the Phase 31 `CredentialOps` surface to persist the resulting
token via `credentialOps.approve()` after success.

The phase is **domain-tier only**. No platform, persistence, orchestrator, edge, or
bridge file changes. The `OnAuthRequiredCallback` plumbing into `GitOps.clone` / `fetch`
and the orchestrator wiring land in Phases 33-35. Phase 32's deliverable is the
self-contained Device Flow loop plus an architecture-gate amendment that adds
`domain/github-auth.ts` to the AUTH-09 no-credential-leak scan scope and the BLOCK A
notify exemption surface.

**Critical alignment with Phase 31:** the Phase 31 plan defined `CredentialOps.approve(host, cred)`
as a best-effort no-throw primitive. Phase 32 does NOT need to handle approve failures
as a state-machine concern; it calls approve once on success and proceeds. This matches
the Phase 33 buildAuthCallbacks consumer's expectation.

**Critical alignment with the broader milestone:** Phase 32 alone does NOT call
isomorphic-git's `onAuth`/`onAuthFailure` callbacks. It exposes
`initiateDeviceFlow(host, opts) → Promise<DeviceFlowResult>` -- a free function that
Phase 33 will invoke from inside the `onAuth`/`onAuthFailure` closures built by
`buildAuthCallbacks`. The `authAttempted` guard (CP-9) is therefore NOT enforced
inside Phase 32's loop -- it is enforced by Phase 33's closure that calls
`initiateDeviceFlow`. Phase 32 returns a `DeviceFlowResult` whose discriminated
shape lets Phase 33 trivially set `authAttempted = true` after a success.

**Primary recommendation:** define `DeviceFlowHttp` interface + `DEFAULT_DEVICE_FLOW_HTTP`
in `domain/github-auth.ts`; implement `initiateDeviceFlow(host, opts)` as a state
machine returning a discriminated result (`{ ok: true, cred } | { ok: false, reason }`);
ship `makeMockDeviceFlowHttp` in `tests/helpers/device-flow-mock.ts` (sibling of
`tests/helpers/credential-mock.ts`); amend `tests/architecture/no-credential-leak.test.ts`
to add `domain/github-auth.ts` to the scan scope; amend BLOCK A in `eslint.config.js`
ONLY IF `domain/github-auth.ts` calls `ctx.ui.notify` directly -- but per D-32-04, it
calls a pre-bound `notifyFn` parameter, so no BLOCK A change is needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-32-01: File location.** NEW file: `extensions/pi-claude-marketplace/domain/github-auth.ts`.
Device Flow is a domain-layer concern (authentication policy), not a platform-layer concern.
Platform layer (`platform/git-credential.ts`) handles OS keychain primitives; domain layer
owns the auth flow logic.

**D-32-02: Injectable HTTP seam.** Export `DeviceFlowHttp` interface with two methods:
- `requestCode(clientId: string, scope: string): Promise<DeviceCodeResponse>`
- `pollToken(clientId: string, deviceCode: string, interval: number): Promise<PollResult>`

`DEFAULT_DEVICE_FLOW_HTTP` implements against `https://github.com/login/device/code`
and `https://github.com/login/oauth/access_token`. Test mock:
`makeMockDeviceFlowHttp()` in `tests/helpers/device-flow-mock.ts`.

**D-32-03: Client ID source.** The GitHub OAuth App `client_id` is a compile-time
constant in `github-auth.ts` (no env var, no runtime config for v1.6). The value is
the pi-claude-marketplace OAuth App client ID (public value; not a secret).

**D-32-04: `notifyFn` callback pattern.** `initiateDeviceFlow` receives a
`notifyFn: (msg: string, severity?: "info" | "warning" | "error") => void` parameter
rather than importing `ctx` directly. This keeps the domain module decoupled from the
Pi extension host and testable without a real `ctx`. The caller (Phase 35 orchestrator)
pre-binds `ctx.ui.notify`.

**D-32-05: `authAttempted` guard.** `initiateDeviceFlow` sets an `authAttempted` boolean
on the returned result so Phase 33's `onAuthFailure` callback can detect a second
consecutive auth failure and return `{ cancel: true }` instead of re-triggering Device
Flow infinitely (isomorphic-git retry loop protection per AUTH-07 / CP-9).

**D-32-06: AUTH-09 discipline in Device Flow.** `user_code` and `verification_uri` MAY
appear in `notifyFn` messages (per AUTH-03). The `access_token` / `password` field
MUST NEVER appear in any `notifyFn` message or error message. The
`no-credential-leak.test.ts` architecture gate (Phase 31) covers this;
`domain/github-auth.ts` is added to its scan scope.

### Claude's Discretion

- Exact poll loop implementation detail (synchronous sleep vs. async timeout)
- Whether `PollResult` is a discriminated union or throws on terminal errors
- Test helper file name and structure (mirror `tests/helpers/credential-mock.ts` pattern)
- Whether to export `DeviceCodeResponse` / `PollResult` types or keep them internal

### Deferred Ideas (OUT OF SCOPE)

- Real GitHub network integration test (opt-in with env var like Phase 31's
  `PI_CM_REAL_GIT_CREDENTIAL=1`)
- Refresh token support (not in GitHub Device Flow spec; OAuth App tokens don't expire
  by default -- see [GitHub Token Expiration docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation))
- Scope configuration beyond default `repo` (out of v1.6 scope)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can run `marketplace add <private-github-url>` with no pre-configuration; Device Flow triggers automatically on first access | Phase 32 ships the engine; Phase 33 invokes it from `onAuth` after a `credentialOps.fill` miss; Phase 35 wires it from `add.ts`. Phase 32's `initiateDeviceFlow` is the only blocking work. |
| AUTH-02 | User can run `marketplace update <name>` against a private GitHub marketplace without re-authenticating when a valid token is already stored | Phase 32 ships the engine; Phase 33 only invokes it on `credentialOps.fill` miss. AUTH-02 is the *negative* requirement (Device Flow NOT triggered on re-use) -- Phase 32 tests verify the engine does what's asked, and Phase 33+ tests verify it's NOT called on cache hit. |
| AUTH-03 | During Device Flow, user is shown a one-time code and a verification URL via ctx.ui.notify so they can authorize from any browser | `initiateDeviceFlow` calls `notifyFn(\`Open ${verification_uri} and enter: ${user_code}\`)` after step-1 success. AUTH-09 discipline: the `access_token` MUST NEVER appear in any `notifyFn` call. |
| AUTH-04 | Device Flow polling respects the server-specified interval; slow_down responses increase the poll interval cumulatively | The state machine maintains a mutable `currentIntervalSec` initialized from `deviceCodeResponse.interval`; on `slow_down`, `currentIntervalSec += 5` (CP-1). On `authorization_pending`, `currentIntervalSec` is NOT touched (CP-2). Verified against [GitHub Device Flow docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) which state "5 extra seconds are added to the minimum interval" cumulatively per occurrence. |
| AUTH-05 | Device Flow timeout or access_denied produces a clear, actionable error message (not a raw HTTP error) | Terminal poll errors (`expired_token`, `access_denied`) produce a `DeviceFlowResult` with `ok: false` and a `reason` field carrying a human-readable string. Phase 32 returns the result; Phase 33+ caller routes the message to `notifyFn` (Phase 32's own `notifyFn` call is only for the user-code prompt, not for the failure -- the caller decides the failure rendering since it has the full surrounding context). |
| AUTH-07 | A rejected stored token is evicted from the OS keychain via `git credential reject` and Device Flow is re-triggered automatically | Phase 32 contributes the `authAttempted` signal on the returned `DeviceFlowResult` so Phase 33's `onAuthFailure` closure can distinguish "first failure -- run Device Flow" from "second failure -- token we just got is also bad, give up to prevent the CP-9 infinite loop". The `git credential reject` call itself is in Phase 33's closure (calls `credentialOps.reject` before invoking `initiateDeviceFlow`). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Device Flow state machine (poll loop, error handling) | `domain/github-auth.ts` | -- | Domain tier owns auth policy. Mirrors `domain/source.ts` (URL parsing policy) and `domain/resolver.ts` (plugin shape policy). The state machine is pure logic with injected effects -- exactly the domain shape. |
| HTTP transport for `/device/code` and `/access_token` | `domain/github-auth.ts` (`DEFAULT_DEVICE_FLOW_HTTP`) | -- | Per D-32-02, the default impl uses `globalThis.fetch` (Node 20+ built-in) inside the same file so the boundary is the `DeviceFlowHttp` interface, not the module. This mirrors Phase 31's `DEFAULT_CREDENTIAL_OPS` colocated with `CredentialOps`. Note: `globalThis.fetch` is the only outbound network primitive permitted by D-11 inside domain/; the same NFR-5 architecture test that already exempts `platform/git.ts` (isomorphic-git network) extends to permit this. |
| Display `user_code` + `verification_uri` to user | `notifyFn` callback (caller-provided) | `domain/github-auth.ts` invokes the callback | Per D-32-04: domain module does not import `ctx`. The pre-bound `notifyFn` is the only output channel from inside the Device Flow state machine; the caller routes through shared/notify.ts's chokepoint or directly via `ctx.ui.notify` depending on where Phase 35 lands the binding. |
| OS keychain persistence on success | `credentialOps.approve` (Phase 31 seam) | `domain/github-auth.ts` calls it once on success | Per D-32-04 the caller could alternatively persist after `initiateDeviceFlow` returns. Discretion call: **inside the state machine**, immediately after the success poll. This keeps the "Device Flow → keychain persistence" pairing atomic from the caller's perspective and avoids a re-bind of `credentialOps` in Phase 33. The approve call is best-effort silent-failure per Phase 31 Pattern 3. |
| `makeMockDeviceFlowHttp` test helper | `tests/helpers/device-flow-mock.ts` | -- | New sibling of `tests/helpers/credential-mock.ts` and `tests/helpers/git-mock.ts`. Test scaffold, never imported by production code. Type-only import for `DeviceFlowHttp`. |
| AUTH-09 no-credential-leak gate | architecture test (`tests/architecture/no-credential-leak.test.ts`) | `domain/github-auth.ts` added to scan scope | Cross-cutting; verified at the architecture layer. Phase 31's test already exists; Phase 32 amends it to scan the new domain file with the same "no `password` / `access_token` / `cred.<field>` interpolated into `Error(...)` or `notifyFn(...)`" gates. |

## Standard Stack

### Core (all in current `package.json`; no additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `globalThis.fetch` | built-in (Node 20+) | HTTP POST to `/login/device/code` and `/login/oauth/access_token` | Node 20 ships a stable WHATWG fetch implementation; no `node-fetch` / `axios` dependency needed. `Accept: application/json` header is required to get JSON responses (GitHub defaults to form-urlencoded). [VERIFIED: Node.js 20+ release notes; package.json engines `>=20.19.0` per NFR-4] |
| `node:test` | built-in (Node >=20.19.0) | Unit tests + `t.mock.timers` for poll interval testing | `t.mock.timers` available in `node:test` from Node 21 -- but Phase 32 unit tests can avoid timer mocking entirely by injecting a `sleep` function via the same `DeviceFlowHttp` seam OR by using `AbortController` to abort the loop synchronously. [VERIFIED: node:test docs] |
| `node:timers/promises` (`setTimeout` promisified) | built-in (Node >=20.19.0) | Poll interval sleep | The promisified `setTimeout` from `node:timers/promises` accepts an `AbortSignal` and clears the underlying handle on abort -- avoids the CP-4 timer-leak problem without manual `clearTimeout` bookkeeping. [VERIFIED: nodejs.org/api/timers.html#timerspromisessettimeoutdelay-value-options] |

### Supporting (existing project deps; no additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `platform/git-credential.ts` (Phase 31 module) | n/a | `CredentialOps` interface for keychain `approve()` on success | `initiateDeviceFlow` accepts `credentialOps: CredentialOps` and calls `.approve(host, cred)` after the success poll. Type-only import; the default instance is plumbed by the caller (Phase 33). |
| `platform/git.ts` (existing, Phase 30) | n/a | `GitCredentials` type for the success return value | `initiateDeviceFlow` returns `GitCredentials` -- `{ username: "x-access-token", password: access_token }`. Type-only import. Note: domain/ → platform/ is a permitted import direction per the D-11 zone matrix (verified at `eslint.config.js` BLOCK C and `tests/architecture/import-boundaries.test.ts` -- `EXPECTED_FORBIDDEN[domain]` does NOT include `platform`). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `globalThis.fetch` | `node:https` direct request | `node:https` requires manually streaming the request body and reading the response. `fetch` is ~5 lines for the same POST. The only reason to use `node:https` would be to avoid the WHATWG fetch's experimental status flag -- which is OFF in Node 20.19+ (fetch is stable). [VERIFIED: Node 20.x release notes] |
| `globalThis.fetch` | `isomorphic-git/http/node` | Tempting because Phase 32 is auth for isomorphic-git operations. But `isomorphic-git/http/node` is a git-smart-HTTP wrapper, not a general HTTP client; using it for OAuth endpoints is a category error and would couple the OAuth flow to the git library. Rejected. |
| `globalThis.fetch` | `undici` (the engine behind `globalThis.fetch`) | Same engine, exposed as a separate import. No advantage over the built-in. Rejected. |
| Discriminated `DeviceFlowResult` return | Throwing terminal errors | Throwing means Phase 33 must catch and classify; a discriminated `{ ok: false, reason }` return is more testable AND matches the existing pattern in `orchestrators/marketplace/shared.ts::UnstageOutcome`. Recommended for consistency. |
| In-state-machine `credentialOps.approve` call | Caller-side approve after return | In-state-machine pairs persistence atomically with success and avoids requiring Phase 33 to re-thread `credentialOps`. Caller-side approve requires changing the return shape to carry the unpersisted credential. Recommended: in-state-machine. |
| `node:timers/promises.setTimeout` with AbortSignal | Hand-rolled `new Promise((resolve) => setTimeout(resolve, ms))` + manual `clearTimeout` | The promisified API handles abort cleanup automatically. Hand-rolled requires CP-4 bookkeeping per call. Recommended: `node:timers/promises`. |

**Installation:** None. No new packages.

**Version verification:**
```bash
node --version                       # confirm >=20.19.0 (NFR-4)
npm view @earendil-works/pi-coding-agent version   # already-pinned floor; no Phase 32 change
```

## Package Legitimacy Audit

> Phase 32 installs no new packages. The legitimacy gate is trivially satisfied.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | -- | -- | -- | -- | -- | n/a -- no new packages |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

All `node:*` and `globalThis.fetch` references are Node built-ins. `platform/git-credential.ts`
and `platform/git.ts` are existing Phase 30/31 modules. No new npm registry calls.

## Architecture Patterns

### System Architecture Diagram

```
                 ┌─────────────────────────────────────────┐
                 │  Phase 33+ caller (buildAuthCallbacks)  │
                 │                                          │
                 │  onAuthRequired = async url => {         │
                 │    host = parseHost(url)                 │
                 │    cred = await credOps.fill(host)       │
                 │    if (cred) return cred                 │
                 │                                          │
                 │    // Phase 32's entry point:            │
                 │    result = await initiateDeviceFlow({   │
                 │      host,                               │
                 │      credentialOps: credOps,             │
                 │      notifyFn: ctx.ui.notify.bind(ctx),  │
                 │      http: DEFAULT_DEVICE_FLOW_HTTP,     │
                 │    })                                    │
                 │                                          │
                 │    if (result.ok) {                      │
                 │      authAttempted = true                │
                 │      return result.cred                  │
                 │    }                                     │
                 │    notifyFn(result.reason, "error")      │
                 │    return { cancel: true }               │
                 │  }                                       │
                 └────────────┬────────────────────────────┘
                              │
                              │ initiateDeviceFlow(opts)
                              ▼
        ┌────────────────────────────────────────────────────┐
        │  domain/github-auth.ts                              │
        │  ────────────────────────────────────────────────  │
        │  STATE MACHINE:                                     │
        │                                                     │
        │  1. http.requestCode(CLIENT_ID, "repo")             │
        │     -> { device_code, user_code, verification_uri,  │
        │          interval, expires_in }                     │
        │                                                     │
        │  2. notifyFn(`Open ${verification_uri} and enter:   │
        │              ${user_code}`)                         │
        │     ┌───── AUTH-09: only user_code +                │
        │     │       verification_uri; NEVER token  ─────┐   │
        │     └─────────────────────────────────────────┘   │
        │                                                     │
        │  3. POLL LOOP:                                      │
        │     let currentInterval = interval                  │
        │     let deadline = now + expires_in * 1000          │
        │     while (now < deadline) {                        │
        │       await sleep(currentInterval, signal)          │
        │       r = await http.pollToken(CLIENT_ID,           │
        │                                device_code,         │
        │                                currentInterval)     │
        │       switch (r.kind) {                             │
        │         case "success":     return { ok: true, ...}│
        │         case "pending":     continue (no incr)     │
        │         case "slow_down":   currentInterval += 5   │
        │                              (CP-1 CUMULATIVE)     │
        │         case "access_denied":                      │
        │              return { ok: false, reason: "User    │
        │                       cancelled authorization." } │
        │         case "expired_token":                      │
        │              return { ok: false, reason: "Device  │
        │                       code expired. Run again." } │
        │         case "unexpected":                         │
        │              return { ok: false, reason: ... }    │
        │       }                                             │
        │     }                                               │
        │     return { ok: false, reason: "timeout" }         │
        │                                                     │
        │  4. ON SUCCESS:                                     │
        │     cred = { username: "x-access-token",            │
        │              password: access_token }               │
        │     await credentialOps.approve(host, cred)         │
        │     return { ok: true, cred, authAttempted: true }  │
        └─────────┬──────────────────────────┬───────────────┘
                  │                          │
                  ▼                          ▼
        ┌──────────────────┐      ┌────────────────────┐
        │ DEFAULT_DEVICE_  │      │ Phase 31:          │
        │ FLOW_HTTP        │      │ DEFAULT_CREDENTIAL │
        │ (globalThis.fetch│      │ _OPS               │
        │  → github.com)   │      │ (git credential    │
        └──────────────────┘      │  approve)          │
                                  └────────────────────┘
```

**Data flow (the happy path -- AUTH-01 / AUTH-03 / AUTH-04):**

1. Phase 33 caller invokes `initiateDeviceFlow({ host: "github.com", credentialOps, notifyFn, http })`.
2. Step 1: `http.requestCode(CLIENT_ID, "repo")` POSTs to `https://github.com/login/device/code` with `client_id=<...>&scope=repo` (form-urlencoded body, `Accept: application/json` header).
3. Response parsed to `DeviceCodeResponse` with `device_code`, `user_code`, `verification_uri`, `expires_in` (typically 900), `interval` (typically 5).
4. Step 2: `notifyFn(\`Open ${verification_uri} and enter: ${user_code}\`)` -- AUTH-03 satisfied; AUTH-09 honoured (only `user_code` + `verification_uri`; never `device_code` or `access_token`).
5. Step 3: poll loop. On each iteration, sleep `currentInterval` seconds (start = `response.interval`), then `http.pollToken(...)`. Branch on the parsed result.
6. On `success`: build `{ username: "x-access-token", password: access_token }`, call `credentialOps.approve(host, cred)`, return `{ ok: true, cred, authAttempted: true }`.
7. On terminal failure (`access_denied`, `expired_token`, deadline exceeded): return `{ ok: false, reason: <human string>, authAttempted: true }`.

### Recommended File Structure

```
extensions/pi-claude-marketplace/
└── domain/
    ├── github-auth.ts          (NEW -- DeviceFlowHttp interface,
    │                            DEFAULT_DEVICE_FLOW_HTTP, the
    │                            initiateDeviceFlow state machine)
    ├── source.ts               (existing, untouched)
    ├── resolver.ts             (existing, untouched)
    └── ...                     (other domain modules untouched)

tests/
├── architecture/
│   └── no-credential-leak.test.ts   (MODIFIED -- add
│                                     domain/github-auth.ts to
│                                     STATE_WRITE_FILES-equivalent
│                                     scan and amend the Error-
│                                     interpolation gate to cover it)
├── helpers/
│   └── device-flow-mock.ts          (NEW -- makeMockDeviceFlowHttp)
└── domain/
    └── github-auth.test.ts          (NEW -- unit tests for the state
                                      machine: happy path, slow_down
                                      cumulative, access_denied,
                                      expired_token, deadline, AUTH-09
                                      leak gate verification)
```

### Pattern 1: Discriminated `PollResult` union (state machine clarity)

**What:** The poll endpoint's response has six well-defined shapes -- four error codes and a success. Modeling them as a discriminated union turns the state machine's branch logic into a TypeScript `switch` with exhaustiveness checking.

**When to use:** The single `pollToken` return path.

**Example:**

```typescript
// Source: GitHub Device Flow docs (authoritative) + this RESEARCH §State Machine
// Confidence: HIGH

export type PollResult =
  | { kind: "success"; accessToken: string; tokenType: string; scope: string }
  | { kind: "pending" }                              // authorization_pending
  | { kind: "slow_down" }                            // 5s cumulative increment
  | { kind: "access_denied" }                        // user cancelled (terminal)
  | { kind: "expired_token" }                        // 15-min window elapsed (terminal)
  | { kind: "unexpected"; error: string; description?: string };
  // unexpected covers: device_flow_disabled, unsupported_grant_type,
  // incorrect_client_credentials, incorrect_device_code, network errors,
  // 5xx, and any future error code GitHub adds. All terminal.
```

The `unexpected` branch is the forward-compat tail: future GitHub error codes land here without a code change. AUTH-05 is satisfied: every terminal branch maps to a clear, actionable reason string returned in `DeviceFlowResult.reason`.

### Pattern 2: `currentInterval` is the ONLY source of truth for sleep duration

**What:** A mutable `currentInterval` variable, initialized from `deviceCodeResponse.interval`, is mutated only on `slow_down` (`currentInterval += 5`). On `authorization_pending` (CP-2), do not touch it. Use it for every `sleep` call.

**When to use:** Every iteration of the poll loop.

**Example:**

```typescript
// Source: GitHub Device Flow docs (authoritative); CP-1 + CP-2 pitfall analysis
// Confidence: HIGH

let currentIntervalSec = deviceCode.interval;
const deadlineMs = Date.now() + deviceCode.expires_in * 1000;

while (Date.now() < deadlineMs) {
  await sleepSec(currentIntervalSec, abortSignal);
  const r = await http.pollToken(CLIENT_ID, deviceCode.device_code, currentIntervalSec);
  switch (r.kind) {
    case "success":         return { ok: true, cred: makeCred(r.accessToken) };
    case "pending":         continue;                  // CP-2: do NOT touch interval
    case "slow_down":       currentIntervalSec += 5;   // CP-1: CUMULATIVE
                            continue;
    case "access_denied":   return { ok: false, reason: "User cancelled authorization. Run the command again to retry." };
    case "expired_token":   return { ok: false, reason: "Device code expired. Run the command again to restart authorization." };
    case "unexpected":      return { ok: false, reason: `Device Flow failed: ${r.error}${r.description ? " -- " + r.description : ""}` };
  }
}
return { ok: false, reason: "Device Flow timed out before authorization completed. Run the command again to restart." };
```

### Pattern 3: `node:timers/promises.setTimeout` for AbortSignal-aware sleep

**What:** The promisified `setTimeout` from `node:timers/promises` accepts an `AbortSignal` and clears the underlying handle on abort -- avoids CP-4 timer-leak bookkeeping entirely.

**When to use:** The sleep between poll iterations.

**Example:**

```typescript
// Source: nodejs.org/api/timers.html#timerspromisessettimeoutdelay-value-options
// Confidence: HIGH

import { setTimeout as sleep } from "node:timers/promises";

async function sleepSec(seconds: number, signal?: AbortSignal): Promise<void> {
  await sleep(seconds * 1000, undefined, { signal });
  // Throws AbortError if signal aborts; caller's catch returns { ok: false, ... }.
}
```

The default `initiateDeviceFlow` signature can take an optional `signal?: AbortSignal` so tests + future cancellation paths share the same abort surface. For Phase 32, tests do NOT need `signal` -- they inject a mock `DeviceFlowHttp` that synchronously resolves and a mock `sleep` (also injected via opts) so polling iterations complete without real waits.

### Pattern 4: Pre-bound `notifyFn` parameter (D-32-04)

**What:** `initiateDeviceFlow` does NOT import `ctx` from the Pi extension API. The caller passes a `notifyFn` closure that already has `ctx` bound. This keeps the domain module testable (the test passes a recording stub) and avoids the BLOCK A ESLint exemption.

**When to use:** Every `notifyFn` call inside the state machine.

**Example:**

```typescript
// Source: D-32-04 (locked decision); aligns with shared/notify.ts chokepoint pattern
// Confidence: HIGH

export type NotifyFn = (message: string, severity?: "info" | "warning" | "error") => void;

export interface InitiateDeviceFlowOpts {
  host: string;
  credentialOps: CredentialOps;
  notifyFn: NotifyFn;
  http?: DeviceFlowHttp;          // defaults to DEFAULT_DEVICE_FLOW_HTTP
  signal?: AbortSignal;            // optional cancellation
}

export async function initiateDeviceFlow(
  opts: InitiateDeviceFlowOpts,
): Promise<DeviceFlowResult>;
```

Phase 35 binds `notifyFn` at the orchestrator call site as `ctx.ui.notify.bind(ctx)` OR routes through `shared/notify.ts`'s sanctioned chokepoint -- both are correct. The domain module does not care which one the caller uses.

### Pattern 5: Strict `Accept: application/json` and form-urlencoded body

**What:** GitHub's `/login/device/code` and `/login/oauth/access_token` endpoints return form-urlencoded responses by DEFAULT. To get JSON, the client MUST send `Accept: application/json` on every request. The request bodies are form-urlencoded (`application/x-www-form-urlencoded`).

**When to use:** Every fetch call in `DEFAULT_DEVICE_FLOW_HTTP`.

**Example:**

```typescript
// Source: docs.github.com -- Device Flow (CITED: GitHub Device Flow docs)
// Confidence: HIGH

async function requestCode(clientId: string, scope: string): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({ client_id: clientId, scope }).toString();
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Device code request failed: HTTP ${res.status}`);
  }
  const data = await res.json() as DeviceCodeResponse;
  return data;
}
```

`fetch` is a built-in global in Node 20+. The cast `as DeviceCodeResponse` is acceptable because the caller (the state machine) validates field presence (`if (!data.device_code) throw ...`). A full TypeBox validator is overkill for two endpoint shapes with five fields each.

### Anti-Patterns to Avoid

- **Importing `ctx` directly into `domain/github-auth.ts`**: violates D-32-04 (pre-bound `notifyFn` design) AND would require a BLOCK A ESLint exemption. The domain module receives `notifyFn` as an opts parameter.

- **Embedding the `access_token` in any `notifyFn` call**: SEC-3 / AUTH-09. Even for debugging. The `user_code` and `verification_uri` are the ONLY two Device Flow values that go through `notifyFn`.

- **Resetting `currentInterval` to `initial + 5` on the first `slow_down`**: CP-1. Subsequent slow_downs ignored → over-poll → rate-limit. Cumulative `+= 5` is the contract.

- **Incrementing `currentInterval` on `authorization_pending`**: CP-2. Authorization_pending is "keep waiting"; only `slow_down` adjusts the interval.

- **Throwing on terminal poll errors**: changes the caller's catch shape. Use the discriminated `{ ok: false, reason }` return so Phase 33 can branch with a simple `if (!result.ok)` without try/catch acrobatics.

- **Hand-rolled `new Promise((resolve) => setTimeout(resolve, ms))` for sleep**: works but requires CP-4 bookkeeping. `node:timers/promises.setTimeout` handles abort cleanup transparently.

- **Polling with `fetch.signal` AbortController for cancellation BUT not propagating to `sleep`**: the sleep between polls is the dominant wall-time. Both fetch and sleep must observe the same AbortSignal.

- **Calling `credentialOps.approve` BEFORE building the `GitCredentials` object**: structurally impossible (no token to persist yet), but worth noting as a sequence: build cred FIRST, then approve, then return. If approve throws (it shouldn't per Phase 31's best-effort contract), the caller still gets the `ok: true` result and proceeds; the missing keychain entry just means the next operation re-runs Device Flow.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP POST with form-urlencoded body + JSON response | A `node:https`-based POST helper | `globalThis.fetch` (Node 20+) | Built-in; ~5 lines per call; standard WHATWG API. `node:https` requires manual stream handling. |
| AbortSignal-aware sleep | Hand-rolled `setTimeout` + `clearTimeout` bookkeeping | `node:timers/promises.setTimeout(ms, undefined, { signal })` | Built-in clean abort handling; eliminates CP-4 timer-leak surface. |
| Discriminated state machine | A series of `if (response.error === ...)` branches | TypeScript discriminated union on `PollResult.kind` | Exhaustiveness checking; future error codes lands in `unexpected` branch instead of falling through silently. |
| OS keychain persistence on success | Calling `git credential approve` directly inside the state machine | `credentialOps.approve(host, cred)` from Phase 31 | Phase 31 already ships the seam. Reusing it keeps the test surface stable (the same `makeMockCredentialOps` covers Phase 32 keychain assertions). |
| OAuth response validation | Full TypeBox schema | Inline `if (!data.device_code) throw ...` checks | The two endpoint shapes are five fields each. A full validator adds ~30 LOC and a dependency-graph link for negligible gain. Field-presence checks are sufficient. |
| GitHub OAuth client management | Personal Access Token / GitHub App / web flow | OAuth App with Device Flow (`client_id` is public) | OAuth App tokens don't expire by default (per [GitHub Token Expiration docs](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation)) -- exactly the lifetime semantics v1.6 needs. No refresh token complexity. |

**Key insight:** Phase 32 is a *small* state machine. Resisting the urge to over-engineer (TypeBox schemas for the two endpoints, custom HTTP client) keeps the file under ~200 LOC and the test surface tractable. The seam discipline (DeviceFlowHttp + CredentialOps injected; notifyFn pre-bound) is where complexity belongs -- not in the protocol shape.

## Runtime State Inventory

> Phase 32 is greenfield domain code -- this section is omitted (no rename / refactor / migration).

## Common Pitfalls

> Numbered to match the .planning/research/PITFALLS.md catalog. P32-1..P32-6 are
> Phase-32-specific pitfalls; cross-references to CP-1..CP-10 / SEC-1..SEC-4 are
> noted inline.

### P32-1: `currentInterval` mutation on the wrong branch (CP-1 + CP-2 hybrid)

**What goes wrong:** Either the implementation increments `currentInterval` on `authorization_pending` (CP-2 violation -- adds ~20-30s of unnecessary wait per user delay) OR it resets `currentInterval` to `initial + 5` on the first `slow_down` (CP-1 violation -- repeated slow_downs over-poll). Both are silent-degradation bugs.

**Why it happens:** The two error codes feel similar ("keep waiting"). The spec distinguishes them: only `slow_down` adjusts the interval, and the adjustment is CUMULATIVE.

**How to avoid:** Implement the `switch` on `PollResult.kind` with explicit branches per Pattern 2. Unit tests for both: a test that simulates `pending` x3 asserts `currentInterval` is unchanged after; a test that simulates `slow_down` x2 asserts `currentInterval === initial + 10`.

**Warning signs:** Tests that pass with `initial + 5` after two slow_downs would catch the CP-1 violation. A test asserting sleep duration after `pending` would catch CP-2.

### P32-2: AUTH-09 leak via Error message OR notifyFn (SEC-3 + CP-10)

**What goes wrong:** A debug-style error like `new Error(\`Device flow failed for token ${accessToken}\`)` or a notify-style call like `notifyFn(\`Got token ${accessToken}\`, "info")` leaks the credential to the user-visible surface. Even string interpolation into a JSON-serialized error object via `JSON.stringify({ deviceCode, accessToken })` can leak.

**Why it happens:** Debug-first idioms ("log the parameters"). The state machine's hot path has the token in a local variable; nothing structurally prevents accidentally placing it in a string.

**How to avoid:**
1. AUTH-09 architecture gate (extended): the Phase 31 `tests/architecture/no-credential-leak.test.ts` already scans `platform/git-credential.ts`. Phase 32 amends the same test to ALSO scan `extensions/pi-claude-marketplace/domain/github-auth.ts` with the same forbidden patterns (`access_token`, `cred.<field>`, `password` interpolated into `new Error(...)` constructors or function calls named `notify` / `notifyFn`).
2. Inline discipline: error messages reference operation names + error codes only (e.g. `Device Flow timed out`, `Device code expired`, `User cancelled authorization`). Never the response body, never the token.
3. NotifyFn calls reference `user_code` and `verification_uri` only -- both safe-to-display per SEC-3.

**Warning signs:** The architecture test fires on a template-literal that mentions `access_token` or `accessToken` or `r.accessToken` inside a `new Error(...)` or `notifyFn(...)` call.

### P32-3: `expires_in` deadline exceeded silently (CP-3-adjacent)

**What goes wrong:** The poll loop has no explicit deadline; it relies on receiving `expired_token` from the server. If the network is partitioned at the moment the server would have sent `expired_token`, OR if the server's clock differs from the client's clock, the loop runs longer than the user expects.

**Why it happens:** `expires_in` from the device code response is descriptive (the user-visible 15-minute window); without enforcement, it has no effect.

**How to avoid:** Compute `deadlineMs = Date.now() + deviceCode.expires_in * 1000` and check at the top of each loop iteration. On `Date.now() >= deadlineMs`, return `{ ok: false, reason: "Device Flow timed out before authorization completed. Run the command again." }`. This is the AUTH-05 "timeout" path.

**Warning signs:** A unit test that mocks `pollToken` to always return `{ kind: "pending" }` and verifies the state machine terminates after `expires_in` seconds (using injected `sleep`).

### P32-4: `globalThis.fetch` does NOT throw on HTTP 4xx/5xx (default fetch semantics)

**What goes wrong:** `fetch` returns a `Response` with `ok: false` for 4xx/5xx; it does NOT throw. Code that immediately calls `.json()` on the response WITHOUT checking `res.ok` will throw a JSON parse error if the server returned an HTML 502 page.

**Why it happens:** WHATWG fetch only throws on *network* errors (DNS failure, connection refused, TLS error). HTTP-level errors are response statuses.

**How to avoid:** Always check `res.ok` (or `res.status`) before parsing the body.

```typescript
if (!res.ok) {
  // GitHub error codes come back as 4xx with a JSON body that contains
  // an `error` field. Read the body to surface the right reason.
  const body = await res.text();
  // Try to parse as JSON; if it fails, use the raw text in unexpected.
  // Note: do NOT interpolate the response body if it could contain a token
  // (it shouldn't for these endpoints, but defense in depth).
  // For the poll endpoint, 400 + { error: "..." } is the normal path; for
  // the device-code endpoint, 4xx is a configuration error (bad client_id).
  // ...
}
const data = await res.json();
```

For the **poll** endpoint specifically, GitHub returns HTTP 200 even for error codes -- the response body has `{ error: "authorization_pending" }`. So the poll-token impl reads `res.json()` first and dispatches on the parsed `.error` field. The `res.ok` check matters mainly for the device-code endpoint (where 4xx is fatal).

**Warning signs:** A unit test that returns `Response(JSON.stringify({error: "slow_down"}), { status: 200 })` from the mock and asserts the state machine treats it as `slow_down`, not as success.

### P32-5: `notifyFn` is fire-and-forget; do NOT await it

**What goes wrong:** Code that writes `await notifyFn(\`Open ${url} and enter: ${code}\`)` hangs forever if `notifyFn` returns void (which it does -- `ctx.ui.notify(message, severity?): void` per the Pi API). `await void` is technically `await undefined` which resolves immediately, BUT TypeScript will not catch a callback that returns `Promise<void>` instead of `void` -- so if a test stub returns a Promise, the `await` could matter.

**Why it happens:** Mixing fire-and-forget notifications with the otherwise async state machine.

**How to avoid:** Type `NotifyFn` as `(msg: string, severity?: "info" | "warning" | "error") => void` (no Promise). Call without `await`. If a test stub wants to record the call, it can do so synchronously inside the void return.

**Warning signs:** Static-type check fails if a notifyFn implementation returns Promise without the signature allowing it. Tests should use the exact `NotifyFn` type.

### P32-6: Domain → platform import direction (D-11)

**What goes wrong:** `domain/github-auth.ts` imports `CredentialOps` from `platform/git-credential.ts` and `GitCredentials` from `platform/git.ts`. The first is potentially the more controversial -- type-only or value? If value, we have a runtime dependency on the platform tier.

**Why it happens:** Easy to accidentally `import { DEFAULT_CREDENTIAL_OPS } from "../platform/git-credential.ts"` and use it as the fallback inside Phase 32. This couples the domain module to the platform-tier default.

**How to avoid:** Import `CredentialOps` and `GitCredentials` as TYPE-ONLY. The state machine never instantiates `DEFAULT_CREDENTIAL_OPS`; it receives a `credentialOps` instance from its caller. Domain → platform value imports are permitted by D-11 (verified in `tests/architecture/import-boundaries.test.ts::EXPECTED_FORBIDDEN["domain"]`) but the discipline here is to keep the dependency surface minimal so future re-layering is easy. The Phase 31 `tests/helpers/credential-mock.ts` already follows this `import type` pattern.

**Warning signs:** Phase 32's plan-checker can grep for `import {.*CredentialOps.*} from .*platform/git-credential` and ensure it's `import type {...}`.

### P32-7: `client_id` discovery (D-32-03 unblocks Phase 32)

**What goes wrong:** Phase 32 cannot be authored until the GitHub OAuth App is REGISTERED and its `client_id` is known. The OAuth App registration is an operator task, not a code task. If the planner assumes a placeholder will work, the integration smoke test will fail with `incorrect_client_credentials` from GitHub.

**Why it happens:** OAuth App registration is a one-time operator action (visit github.com → Settings → Developer settings → OAuth Apps → New OAuth App). The `client_id` it produces is the binding to the GitHub account that authorized the app.

**How to avoid:** The Phase 32 plan MUST include a `checkpoint:human-verify` task that surfaces this as an OPERATOR ACTION before the implementation task: "Register the pi-claude-marketplace OAuth App on github.com and supply the resulting `client_id`. Enable Device Flow on the app." The implementation task then writes the constant to `domain/github-auth.ts`. Unit tests with the mock HTTP do NOT need the real client_id; they assert that whatever constant is passed flows through to the `requestCode` / `pollToken` calls.

**Warning signs:** Phase 32 plan that does NOT have a checkpoint for OAuth App registration; first integration smoke test fires `incorrect_client_credentials`.

### P32-8: `repo` scope is correct for private-repo clone over HTTPS (CITED)

**What goes wrong:** Choosing a narrower scope like `public_repo` works for public repos but fails on private ones; choosing a broader scope like `admin:repo_hook` over-asks for permissions and lowers user trust.

**Why it happens:** GitHub's scope list is long; the right scope for "clone any repo I have access to via https" is not always obvious to someone unfamiliar with the OAuth surface.

**How to avoid:** Use scope `repo` (full control of private repositories). [CITED: docs.github.com/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps] AUTH-01 covers "private GitHub marketplace" explicitly, so the `repo` scope is the canonical choice. Document in the file header that scope is hard-coded to `repo` for v1.6 (Deferred ideas in CONTEXT.md notes future scope configurability).

**Warning signs:** Smoke test against a private repo with scope `public_repo` returns 404 (GitHub deliberately returns 404 instead of 403 for unauthorized private resources to avoid resource-existence disclosure).

## Code Examples

Verified patterns from official sources:

### Example 1: `DeviceFlowHttp` interface

```typescript
// extensions/pi-claude-marketplace/domain/github-auth.ts
// Source: D-32-02 (locked decision); GitHub Device Flow docs (authoritative response shapes)
// Confidence: HIGH

import type { CredentialOps } from "../platform/git-credential.ts";
import type { GitCredentials } from "../platform/git.ts";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;        // typically 900 seconds
  interval: number;           // typically 5 seconds
}

export type PollResult =
  | { kind: "success"; accessToken: string; tokenType: string; scope: string }
  | { kind: "pending" }
  | { kind: "slow_down" }
  | { kind: "access_denied" }
  | { kind: "expired_token" }
  | { kind: "unexpected"; error: string; description?: string };

/**
 * Injectable HTTP seam for the GitHub Device Flow. Tests substitute
 * makeMockDeviceFlowHttp() from tests/helpers/device-flow-mock.ts so
 * the unit suite never hits github.com.
 */
export interface DeviceFlowHttp {
  /**
   * POST https://github.com/login/device/code with form-urlencoded body
   *   client_id=<clientId>&scope=<scope>
   * Accept: application/json header REQUIRED (GitHub defaults to form).
   * Throws on HTTP 4xx/5xx or network error -- caller surfaces as
   * a terminal "unexpected" result.
   */
  requestCode(clientId: string, scope: string): Promise<DeviceCodeResponse>;

  /**
   * POST https://github.com/login/oauth/access_token with form-urlencoded body
   *   client_id=<clientId>&device_code=<deviceCode>&grant_type=urn:ietf:params:oauth:grant-type:device_code
   * Accept: application/json header REQUIRED.
   * `intervalSec` is informational (the server tells the client the new
   * interval in the slow_down response body; the caller does the math).
   * On HTTP 200 + { error: ... }, return the discriminated PollResult.
   * On HTTP 200 + { access_token: ... }, return { kind: "success", ... }.
   * On HTTP 4xx/5xx, return { kind: "unexpected", error: "...", ... }.
   */
  pollToken(clientId: string, deviceCode: string, intervalSec: number): Promise<PollResult>;
}
```

### Example 2: `DEFAULT_DEVICE_FLOW_HTTP` implementation

```typescript
// Source: GitHub Device Flow docs + WHATWG fetch + Pattern 5
// Confidence: HIGH

const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

async function requestCodeImpl(clientId: string, scope: string): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({ client_id: clientId, scope }).toString();
  const res = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Device code request failed: HTTP ${res.status}`);
    // AUTH-09: do NOT interpolate response body (could contain client_id
    // mishandling diagnostics; safer to keep generic).
  }
  const data = (await res.json()) as DeviceCodeResponse;
  // Defensive field-presence check; do NOT throw with the data object.
  if (
    typeof data.device_code !== "string" ||
    typeof data.user_code !== "string" ||
    typeof data.verification_uri !== "string" ||
    typeof data.expires_in !== "number" ||
    typeof data.interval !== "number"
  ) {
    throw new Error("Device code response missing required fields");
  }
  return data;
}

async function pollTokenImpl(
  clientId: string,
  deviceCode: string,
  _intervalSec: number,
): Promise<PollResult> {
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
  }).toString();

  let res: Response;
  try {
    res = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch (err) {
    // Network error (DNS, connection refused, TLS). Treat as unexpected
    // (terminal). The error message reaches the user via reason; AUTH-09
    // discipline: no token in this path (we don't have one yet).
    return { kind: "unexpected", error: "network_error", description: String(err) };
  }

  // For the poll endpoint, GitHub returns HTTP 200 even for error codes;
  // the body is the source of truth.
  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { kind: "unexpected", error: "invalid_json", description: `HTTP ${res.status}` };
  }

  // Success path.
  if (typeof data.access_token === "string") {
    return {
      kind: "success",
      accessToken: data.access_token,
      tokenType: typeof data.token_type === "string" ? data.token_type : "bearer",
      scope: typeof data.scope === "string" ? data.scope : "",
    };
  }

  // Error path -- dispatch on the `error` field.
  const errorCode = typeof data.error === "string" ? data.error : "unexpected";
  const description = typeof data.error_description === "string" ? data.error_description : undefined;
  switch (errorCode) {
    case "authorization_pending":  return { kind: "pending" };
    case "slow_down":              return { kind: "slow_down" };
    case "access_denied":          return { kind: "access_denied" };
    case "expired_token":          return { kind: "expired_token" };
    default:
      return {
        kind: "unexpected",
        error: errorCode,
        ...(description !== undefined && { description }),
      };
  }
}

export const DEFAULT_DEVICE_FLOW_HTTP: DeviceFlowHttp = {
  requestCode: requestCodeImpl,
  pollToken: pollTokenImpl,
};
```

### Example 3: `initiateDeviceFlow` state machine

```typescript
// Source: D-32-04 (notifyFn callback) + D-32-05 (authAttempted) + Patterns 1-4
// Confidence: HIGH

import { setTimeout as sleepMs } from "node:timers/promises";

/**
 * D-32-03: The OAuth App client_id is a compile-time constant. PUBLIC value
 * (NOT a secret -- Device Flow is secret-free by design). Registered as the
 * pi-claude-marketplace OAuth App on github.com.
 *
 * OPERATOR ACTION REQUIRED at plan time: register the OAuth App on
 * github.com → Settings → Developer settings → OAuth Apps. Enable Device
 * Flow. Substitute the placeholder below with the resulting client_id
 * in the same commit that authors the rest of this file.
 */
const GITHUB_OAUTH_CLIENT_ID = "TODO_REGISTER_OAUTH_APP_FILL_CLIENT_ID";

/** Scope: `repo` covers full control of public + private repositories (CITED). */
const REQUESTED_SCOPE = "repo";

export type NotifyFn = (
  message: string,
  severity?: "info" | "warning" | "error",
) => void;

export interface InitiateDeviceFlowOpts {
  /** Bare hostname for credentialOps.approve key (e.g. "github.com"). */
  host: string;
  /** Phase 31 CredentialOps instance (default or mock). */
  credentialOps: CredentialOps;
  /** Pre-bound ctx.ui.notify callback per D-32-04. */
  notifyFn: NotifyFn;
  /** Defaults to DEFAULT_DEVICE_FLOW_HTTP; tests inject a mock. */
  http?: DeviceFlowHttp;
  /** Optional abort signal. Future-proofing; Phase 33 ignores. */
  signal?: AbortSignal;
}

export type DeviceFlowResult =
  | { ok: true; cred: GitCredentials; authAttempted: true }
  | { ok: false; reason: string; authAttempted: true };

export async function initiateDeviceFlow(
  opts: InitiateDeviceFlowOpts,
): Promise<DeviceFlowResult> {
  const http = opts.http ?? DEFAULT_DEVICE_FLOW_HTTP;

  // STEP 1: request device code.
  let deviceCode: DeviceCodeResponse;
  try {
    deviceCode = await http.requestCode(GITHUB_OAUTH_CLIENT_ID, REQUESTED_SCOPE);
  } catch (err) {
    // AUTH-09: never interpolate the err if it could carry sensitive bits.
    // The requestCode impl already constructs a generic Error message.
    return {
      ok: false,
      reason: `Device Flow initialization failed: ${err instanceof Error ? err.message : "unknown error"}`,
      authAttempted: true,
    };
  }

  // STEP 2: prompt user.
  // AUTH-03 satisfied: user_code + verification_uri are displayed.
  // AUTH-09 satisfied: no token mentioned (we don't have one yet).
  opts.notifyFn(
    `Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}`,
    "info",
  );

  // STEP 3: poll loop with cumulative slow_down + expires_in deadline.
  let currentIntervalSec = deviceCode.interval;
  const deadlineMs = Date.now() + deviceCode.expires_in * 1000;

  while (Date.now() < deadlineMs) {
    try {
      await sleepMs(
        currentIntervalSec * 1000,
        undefined,
        opts.signal !== undefined ? { signal: opts.signal } : undefined,
      );
    } catch {
      // AbortError: caller signalled cancel. Terminal.
      return { ok: false, reason: "Device Flow cancelled.", authAttempted: true };
    }

    const r = await http.pollToken(
      GITHUB_OAUTH_CLIENT_ID,
      deviceCode.device_code,
      currentIntervalSec,
    );

    switch (r.kind) {
      case "success": {
        // STEP 4: persist via Phase 31's CredentialOps.approve (best-effort).
        const cred: GitCredentials = {
          username: "x-access-token",
          password: r.accessToken,
        };
        await opts.credentialOps.approve(opts.host, cred);
        return { ok: true, cred, authAttempted: true };
      }
      case "pending":
        // CP-2: do NOT touch currentIntervalSec.
        continue;
      case "slow_down":
        // CP-1: CUMULATIVE +5.
        currentIntervalSec += 5;
        continue;
      case "access_denied":
        return {
          ok: false,
          reason: "User cancelled authorization. Run the command again to retry.",
          authAttempted: true,
        };
      case "expired_token":
        return {
          ok: false,
          reason: "Device code expired before authorization. Run the command again to restart.",
          authAttempted: true,
        };
      case "unexpected":
        return {
          ok: false,
          reason: `Device Flow failed: ${r.error}${r.description !== undefined ? " -- " + r.description : ""}`,
          authAttempted: true,
        };
    }
  }

  // Deadline exceeded without a terminal response from the server.
  return {
    ok: false,
    reason: "Device Flow timed out before authorization completed. Run the command again to restart.",
    authAttempted: true,
  };
}
```

### Example 4: `makeMockDeviceFlowHttp` test helper

```typescript
// tests/helpers/device-flow-mock.ts
// Source: D-32-02 + Phase 31's makeMockCredentialOps shape
// Confidence: HIGH

import type {
  DeviceCodeResponse,
  DeviceFlowHttp,
  PollResult,
} from "../../extensions/pi-claude-marketplace/domain/github-auth.ts";

export interface MockDeviceFlowState {
  /** Pre-canned device code response (default returned on requestCode). */
  deviceCode: DeviceCodeResponse;
  /**
   * Queue of PollResult values. Each call to pollToken consumes the head
   * of the queue. If the queue is empty, pollToken returns the configured
   * `defaultPoll` (default: { kind: "pending" }).
   */
  pollQueue: PollResult[];
  defaultPoll: PollResult;
  /** Per-method call logs. */
  requestCodeCalls: { clientId: string; scope: string }[];
  pollTokenCalls: { clientId: string; deviceCode: string; intervalSec: number }[];
  /** Optional throws overrides. */
  requestCodeThrows?: Error;
  pollTokenThrows?: Error;
}

export interface MockDeviceFlowHttpHandle {
  readonly http: DeviceFlowHttp;
  readonly state: MockDeviceFlowState;
}

export function makeMockDeviceFlowHttp(
  initial?: Partial<MockDeviceFlowState>,
): MockDeviceFlowHttpHandle {
  const state: MockDeviceFlowState = {
    deviceCode: initial?.deviceCode ?? {
      device_code: "MOCK_DEVICE_CODE",
      user_code: "ABCD-1234",
      verification_uri: "https://github.com/login/device",
      expires_in: 900,
      interval: 5,
    },
    pollQueue: [...(initial?.pollQueue ?? [])],
    defaultPoll: initial?.defaultPoll ?? { kind: "pending" },
    requestCodeCalls: [],
    pollTokenCalls: [],
    ...(initial?.requestCodeThrows !== undefined && { requestCodeThrows: initial.requestCodeThrows }),
    ...(initial?.pollTokenThrows !== undefined && { pollTokenThrows: initial.pollTokenThrows }),
  };

  const http: DeviceFlowHttp = {
    async requestCode(clientId, scope) {
      state.requestCodeCalls.push({ clientId, scope });
      if (state.requestCodeThrows !== undefined) throw state.requestCodeThrows;
      await Promise.resolve();
      return state.deviceCode;
    },
    async pollToken(clientId, deviceCode, intervalSec) {
      state.pollTokenCalls.push({ clientId, deviceCode, intervalSec });
      if (state.pollTokenThrows !== undefined) throw state.pollTokenThrows;
      await Promise.resolve();
      return state.pollQueue.shift() ?? state.defaultPoll;
    },
  };

  return { http, state };
}
```

### Example 5: AUTH-09 architecture test amendment

```typescript
// tests/architecture/no-credential-leak.test.ts (AFTER Phase 32 amendment)
//
// Phase 32 amendment: extend the Error-interpolation gate to scan
// domain/github-auth.ts AND add a notifyFn-interpolation gate.
//
// Source: D-32-06 (locked: github-auth.ts is in the scan scope)
// Confidence: HIGH

const GITHUB_AUTH_FILE = "extensions/pi-claude-marketplace/domain/github-auth.ts";

// Existing test "AUTH-09: no credential field name appears in any state-write
// code path" is UNCHANGED.
// Existing test "AUTH-09: platform/git-credential.ts never interpolates a
// password in an Error message" is UNCHANGED.

// NEW Phase 32 test:
test("AUTH-09 (Phase 32): domain/github-auth.ts never interpolates a token in an Error or notifyFn message", async () => {
  const absPath = path.join(REPO_ROOT, GITHUB_AUTH_FILE);
  const exists = await access(absPath).then(() => true, () => false);
  if (!exists) {
    // Phase 32 file not yet authored -- vacuous pass until then.
    assert.ok(true, "domain/github-auth.ts not yet authored; gate inactive");
    return;
  }
  const src = await readFile(absPath, "utf8");
  const stripped = stripComments(src);
  // Forbidden: template literal OR string concatenation that interpolates
  //   - access_token, accessToken
  //   - cred.password / cred.access_token
  //   - r.accessToken (from the PollResult success branch)
  // INSIDE a `new Error(...)` constructor OR a `notifyFn(...)` call.
  const errorOrNotifyWithToken =
    /(new\s+Error\s*\(|notifyFn\s*\()(?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;
  assert.equal(
    errorOrNotifyWithToken.test(stripped),
    false,
    "Error or notifyFn in domain/github-auth.ts interpolates a token field (AUTH-09 violation)",
  );
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-fetch` / `axios` for HTTP in Node | `globalThis.fetch` (built-in) | Node 20 stable (~2023) | One fewer dependency; no transitive ESM/CJS friction; native AbortSignal support. |
| OAuth web flow (redirect URI + local HTTP server) | OAuth Device Flow | RFC 8628 (Aug 2019); GitHub support 2020 | Eliminates the need for a local HTTP server inside a CLI extension; cleaner UX for headless / non-browser-host environments. |
| Personal Access Tokens (manual user setup) | OAuth Device Flow with `client_id` | OAuth App registration is one-time operator setup | Users no longer need to know how to create PATs; the flow is initiated by the extension itself. |
| Hand-rolled `setTimeout`/`clearTimeout` for AbortSignal-aware sleep | `node:timers/promises.setTimeout(ms, value, { signal })` | Node 15+ | Eliminates CP-4 timer-leak bookkeeping; the promisified API handles abort cleanup. |
| Throwing on terminal protocol errors | Discriminated `{ ok: false, reason }` return | Project convention (existing `UnstageOutcome` pattern in `orchestrators/marketplace/shared.ts`) | Simpler caller code; no try/catch acrobatics; exhaustive switch in caller. |

**Deprecated/outdated:**
- Personal Access Tokens for first-time auth on private repos: superseded by Device Flow for CLI extensions (PAT still works at the `git credential` layer if the user has one stored, but the *initial* setup now flows through Device Flow). This is exactly the AUTH-01 → AUTH-08 sequence.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | OAuth App tokens do not expire by default (no refresh token needed for v1.6) | Don't Hand-Roll; State of the Art | [VERIFIED via WebSearch + GitHub Token Expiration docs] LOW. If the OAuth App is configured WITH expiration enabled (it's an admin toggle), tokens expire in 8 hours and the user would re-trigger Device Flow on the next operation. The state machine handles this naturally (a 401 → onAuthFailure → Phase 33's `authAttempted` flag → re-Device-Flow). No code change needed. |
| A2 | `globalThis.fetch` is stable (no `--experimental-fetch` flag) in Node >=20.19.0 | Pattern 5 / Example 2 | [VERIFIED: Node 20.x release notes] LOW. fetch shipped stable in Node 21; Node 20 has it behind no flag since 20.5+. The package.json engines field requires `>=20.19.0` (well above 20.5). |
| A3 | `node:timers/promises.setTimeout` accepts `AbortSignal` in `options.signal` | Pattern 3 / Example 3 | [VERIFIED: nodejs.org/api/timers.html] LOW. Stable since Node 15. |
| A4 | GitHub's `/login/oauth/access_token` returns HTTP 200 for error codes (error in body) | P32-4 | [CITED: GitHub Device Flow docs -- "the response is..." for `authorization_pending` does not mention a non-200 status] MEDIUM. Worst case: an HTTP 200 check is too restrictive and a 400 returns slip through as `unexpected`. Mitigation: pollTokenImpl reads body BEFORE checking res.ok, so even a 400 with `{ error: "..." }` dispatches correctly. |
| A5 | The OAuth App `client_id` is a public value (safe to commit) | D-32-03 / P32-7 | [CITED: docs.github.com/apps/oauth-apps -- "client_id is a public identifier" + RFC 8628 §3.1 "the client_id is intended to be public information"] LOW. Device Flow is secret-free by design; the client_id is checked-in like a URL constant. The OAuth App's client_secret (NOT used in Device Flow) is the actual secret. |
| A6 | `repo` is the correct scope for private-repo HTTPS clone | P32-8 | [CITED: docs.github.com/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps -- "repo: Grants full access to public and private repositories"] LOW. If we later restrict to read-only, GitHub does not expose a "repo:read" scope -- `repo` is the minimal scope that works for private clone. |
| A7 | `notifyFn` is fire-and-forget (returns void, not Promise) | P32-5 / Pattern 4 | [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:75 `notify(message: string, type?: "info" \| "warning" \| "error"): void`] LOW. The Pi API contract is `void`. |
| A8 | Setting `credentialOps.approve` inside `initiateDeviceFlow` is the right place (vs. caller-side) | Architectural Responsibility Map; Anti-Patterns | [ASSUMED -- discretion call] LOW. Both placements satisfy AUTH-06. In-machine pairs persistence atomically with success. Caller-side approve would require returning the unpersisted credential and adding an extra Phase 33 line. The discretion call in CONTEXT.md is "Whether `PollResult` is a discriminated union or throws on terminal errors" -- placement of approve was not explicitly enumerated but falls within Claude's discretion. |
| A9 | Phase 32 does NOT need to handle a `credentialOps.approve` exception | Architectural Responsibility Map | [VERIFIED: Phase 31 RESEARCH Pattern 3 "approve/reject swallow subprocess errors"] LOW. The Phase 31 default impl is best-effort silent; even if approve throws (a mock might), the state machine treats it as a terminal best-effort failure -- the user is already authenticated, the token is in hand. The current operation succeeds; only keychain reuse is lost. Decision: do NOT wrap approve in try/catch in Phase 32 -- if the default impl silently no-ops on failure, no wrapping is needed; if a mock throws, that's a test artefact, not a production concern. Document this in Example 3. |

## Open Questions (RESOLVED)

> All numbered questions from CONTEXT.md `<specifics>` are resolved in the body above.
> The remaining unresolved item is the OAuth App registration operator action (P32-7),
> which is a CHECKPOINT in the plan rather than a research question.

1. **GitHub OAuth App client_id discovery (P32-7).**
   - What we know: The `client_id` is registered out-of-band on github.com. It is public; safe to commit.
   - What's unclear: Whether an OAuth App has already been registered for pi-claude-marketplace at this milestone, OR whether Phase 32 introduces the first registration.
   - RESOLVED: The Phase 32 plan inserts a `checkpoint:human-verify` task FIRST that prompts the operator to register the OAuth App (or supply the existing client_id). The implementation task then writes the value to the `GITHUB_OAUTH_CLIENT_ID` constant. Unit tests use the mock and assert the constant flows through.

2. **Caller responsibility for the `unexpected` reason rendering.**
   - What we know: Phase 32 returns `{ ok: false, reason: "..." }` strings. The caller (Phase 33/35) decides whether to route through `shared/notify.ts` chokepoint or call `notifyFn` directly.
   - What's unclear: Whether the catalog (`docs/output-catalog.md`) needs Device Flow-failure variants (one per terminal reason) at Phase 32 plan time.
   - RESOLVED: Phase 32 ships only the user-code PROMPT to `notifyFn` (matches the catalog entry the Phase 35 plan introduces). All `ok: false` reason strings are RETURNED to the caller; the caller routes them. The catalog entry for Device Flow failure rendering is a Phase 35 concern, not Phase 32. Phase 32's RESEARCH.md flags this to keep Phase 35 plan-time honest.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All code | ✓ | >=20.19.0 (engines field) | -- |
| `globalThis.fetch` | DEFAULT_DEVICE_FLOW_HTTP | ✓ (built-in stable) | bundled with Node 20.5+ | -- |
| `node:timers/promises` | sleep between polls | ✓ (built-in) | bundled with Node 15+ | hand-rolled `new Promise(r => setTimeout(r, ms))` (rejected; CP-4) |
| `node:test` | Unit tests | ✓ (built-in) | bundled with Node | -- |
| `platform/git-credential.ts` (Phase 31) | `CredentialOps` type | ✓ (already shipped in Phase 31) | -- | -- |
| `platform/git.ts` (Phase 30) | `GitCredentials` type | ✓ (already shipped in Phase 30) | -- | -- |
| GitHub OAuth App `client_id` | Production runtime | ✗ at code-author time / ⚠ requires OPERATOR ACTION at plan time | -- | **No fallback -- Phase 32 cannot ship without it.** The plan MUST include a `checkpoint:human-verify` task before the implementation task. |
| Network reachability to `github.com` | Production runtime ONLY | ⚠ runtime; tests use mock | -- | NFR-5 honored (network only for github-source add/update); offline operation falls through to the standard fetch network error → `{ ok: false, reason: "Device Flow initialization failed: ..." }` path. |

**Missing dependencies with no fallback:** GitHub OAuth App `client_id` -- the plan MUST surface this as an operator action.

**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node 20+) |
| Config file | none (no jest/vitest/mocha config in repo) |
| Quick run command | `node --test "tests/domain/github-auth.test.ts" -t "<test name pattern>"` |
| Full suite command | `npm test` (matches the root globs in `package.json::scripts.test`: `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `initiateDeviceFlow` returns `{ ok: true, cred }` on the happy path | unit (mock HTTP) | `node --test "tests/domain/github-auth.test.ts" -t "happy path"` | ❌ Wave 0 (NEW file) |
| AUTH-01 | `initiateDeviceFlow` calls `credentialOps.approve(host, cred)` on success | unit (mock HTTP + mock CredOps) | `node --test "tests/domain/github-auth.test.ts" -t "approve on success"` | ❌ Wave 0 |
| AUTH-02 | (NEGATIVE) `initiateDeviceFlow` is NOT invoked when stored token exists -- COVERED BY PHASE 33 | n/a in Phase 32 | n/a | -- (Phase 33's `buildAuthCallbacks` tests cover this; Phase 32 has no responsibility here) |
| AUTH-03 | `initiateDeviceFlow` calls `notifyFn` exactly once with `user_code` and `verification_uri` interpolated | unit (mock notifyFn) | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-03"` | ❌ Wave 0 |
| AUTH-04 | `slow_down` increments `currentInterval` cumulatively (`initial + 5` after one; `initial + 10` after two) | unit (queue: `slow_down`, `slow_down`, `success`; assert intervalSec passed to pollToken on 3rd call) | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-04 cumulative"` | ❌ Wave 0 |
| AUTH-04 | `authorization_pending` does NOT touch `currentInterval` (CP-2) | unit (queue: `pending` x3, `success`; assert intervalSec stays at initial for all 4 polls) | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-04 pending"` | ❌ Wave 0 |
| AUTH-05 | `access_denied` returns `{ ok: false, reason: <actionable string>, authAttempted: true }` (NOT a raw HTTP error) | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 access_denied"` | ❌ Wave 0 |
| AUTH-05 | `expired_token` returns `{ ok: false, reason: <actionable string>, authAttempted: true }` | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 expired_token"` | ❌ Wave 0 |
| AUTH-05 | Deadline exceeded (`Date.now() >= deadlineMs`) returns `{ ok: false, reason: <timeout string> }` | unit (mock with `expires_in: 1`, queue of `pending` only, injected sleep) | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 timeout"` | ❌ Wave 0 |
| AUTH-05 | `requestCode` HTTP failure returns `{ ok: false, reason: <init failure string> }` (NOT a raw error) | unit (mock `requestCodeThrows`) | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-05 init failure"` | ❌ Wave 0 |
| AUTH-07 | Successful result has `authAttempted: true` so Phase 33 can detect retries | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-07 authAttempted"` | ❌ Wave 0 |
| AUTH-07 | Failure result also has `authAttempted: true` (single Device Flow run consumed the attempt) | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-07 authAttempted on failure"` | ❌ Wave 0 |
| AUTH-09 | No credential field interpolated in any `new Error(...)` or `notifyFn(...)` in `domain/github-auth.ts` | architecture (extended Phase 31 test) | `node --test "tests/architecture/no-credential-leak.test.ts" -t "Phase 32"` | ❌ Wave 0 (amends existing file) |
| AUTH-09 | `notifyFn` mock records only `user_code` + `verification_uri`; never `device_code` or `access_token` | unit | `node --test "tests/domain/github-auth.test.ts" -t "AUTH-09 notify content"` | ❌ Wave 0 |
| (gate) | `npm run check` green | full pipeline | `npm run check` | ✓ |
| (smoke, manual) | Real Device Flow against github.com (`PI_CM_REAL_DEVICE_FLOW=1`) -- operator-gated | integration (opt-in) | `PI_CM_REAL_DEVICE_FLOW=1 node --test "tests/domain/github-auth.test.ts" -t "real GitHub"` | ❌ deferred per Deferred Ideas; SHOULD be authored as a skipped test slot for Phase 36 |

### Sampling Rate

- **Per task commit:** `node --test "tests/domain/github-auth.test.ts" "tests/architecture/no-credential-leak.test.ts"` (the two files Phase 32 touches)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `extensions/pi-claude-marketplace/domain/github-auth.ts` -- the production module (DeviceFlowHttp interface + DEFAULT_DEVICE_FLOW_HTTP + initiateDeviceFlow state machine + DeviceFlowResult type)
- [ ] `tests/helpers/device-flow-mock.ts` -- `makeMockDeviceFlowHttp` factory (sibling of `credential-mock.ts`)
- [ ] `tests/domain/github-auth.test.ts` -- unit tests against the mock (≥13 tests per the requirements map above)
- [ ] `tests/architecture/no-credential-leak.test.ts` AMENDMENT -- add `domain/github-auth.ts` to the AUTH-09 scan scope
- [ ] *(plan task, not a file)* OPERATOR CHECKPOINT: register the GitHub OAuth App OR confirm an existing `client_id`. Substitute `GITHUB_OAUTH_CLIENT_ID` placeholder in `domain/github-auth.ts`.

### Manual-only verifications

- **Real Device Flow against github.com**: documented in Deferred Ideas; SHOULD be authored as a `PI_CM_REAL_DEVICE_FLOW=1`-gated skipped test slot in Phase 32 so Phase 36's integration gate can opt into it without requiring file changes. The test reads `GITHUB_OAUTH_CLIENT_ID` from the source (so it tests the actual configured app), prints the `user_code` + `verification_uri`, and waits for the operator to authorize within `expires_in`. Asserts `result.ok === true` and `result.cred.password.startsWith("gho_")`.
- **OAuth App registration validity**: cannot be tested automatically -- the operator must visit github.com → OAuth Apps to confirm the app is registered with Device Flow enabled and the `client_id` matches the constant in `github-auth.ts`. This is the P32-7 checkpoint.

*Framework install: none -- `node --test` is built in.*

## Security Domain

Required per CLAUDE.md security discipline (CONTEXT.md, AUTH-09 lockdown, SEC-3 in PITFALLS.md).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | OAuth 2.0 Device Authorization Grant (RFC 8628) -- the entire purpose of Phase 32 |
| V3 Session Management | partial | OAuth App access tokens are persistent session credentials; stored only in OS keychain (Phase 31), never in extension files |
| V4 Access Control | yes | `repo` scope grants exactly the access needed; no over-scoping |
| V5 Input Validation | yes | DeviceFlowHttp response field-presence checks; defensive parse of JSON body; no eval / no template interpolation of untrusted strings into shell-like surfaces |
| V6 Cryptography | no | Phase 32 does NOT hash, encrypt, sign, or verify -- it relies on TLS (handled by `fetch`) and on `git credential` (delegated to Phase 31's OS keychain) |
| V7 Error Handling and Logging | yes | AUTH-09: tokens NEVER appear in error messages, notifyFn output, or thrown Error values. State machine returns discriminated `{ ok: false, reason: string }` with hand-crafted human-readable strings (not response bodies) |
| V10 Communications | yes | All requests to github.com over HTTPS (hard-coded URLs); fetch validates TLS by default |
| V14 Configuration | yes | OAuth App `client_id` is a compile-time constant (no env var, no runtime config) -- prevents user/operator from injecting a different OAuth App at runtime |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token leak via error message | Information Disclosure | AUTH-09 architecture test (Phase 31 amendment for Phase 32 file); inline discipline; code-review backstop |
| Token leak via notifyFn output | Information Disclosure | NotifyFn called only twice in the entire state machine, both with hand-crafted strings; AUTH-09 architecture test extended to scan `notifyFn(...)` calls |
| Confused-deputy (mock HTTP returns success with bogus token) | Spoofing | Production: TLS to `github.com` provides server identity; tests: mock controls full surface and tests assert structural properties (presence of `username`/`password`, NOT specific token bytes) |
| Slow-down DoS (server forces us to over-poll) | DoS | RFC 8628's `slow_down` semantic IS the mitigation: cumulative +5s. P32-1 prevents misimplementation |
| Polling loop runs forever | DoS / Availability | `expires_in` deadline enforced client-side (P32-3); optional AbortSignal for caller-driven cancel |
| `client_id` mishandled as a secret | Confused Threat Model | Documented in file header that `client_id` is a public OAuth identifier per RFC 8628 §3.1; safe to commit |
| Token written to extension state.json | Information Disclosure | SEC-1 (Phase 31): `tests/architecture/no-credential-leak.test.ts` already scans state-write files. Phase 32 file is NOT a state-write file; the gate's existing scope covers state writes, and the Phase 32 amendment covers the new domain file's own discipline |
| Token in process argv | Information Disclosure | N/A -- Phase 32 does not spawn processes. Phase 31 mitigates this for credential subprocesses |
| Token in browser URL (verification_uri_complete) | Information Disclosure | We do NOT use `verification_uri_complete` (the variant that embeds the code in the URL); we use plain `verification_uri` + separate `user_code` display. This matches the GitHub Device Flow primary surface |

## Project Constraints (from CLAUDE.md)

- **Output channel (IL-2):** All user-visible messages MUST go through `ctx.ui.notify`. **Applies indirectly via D-32-04:** `domain/github-auth.ts` receives a pre-bound `notifyFn` callback rather than importing `ctx`. The caller (Phase 35 orchestrator) routes through `ctx.ui.notify` either directly or via `shared/notify.ts`. **No BLOCK A ESLint exemption needed for Phase 32** -- the chokepoint discipline is preserved at the boundary.
- **Containment (NFR-10):** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`. **Applies indirectly:** Phase 32 writes nothing to disk under the extension scope; the OS keychain write goes through `credentialOps.approve` (Phase 31 seam) which writes to OS-managed storage. NFR-10 unaffected.
- **Network policy (NFR-5):** Network is required only for github-source `marketplace add` and `update`. **Applies DIRECTLY:** Phase 32 introduces HTTP calls to `github.com/login/device/code` and `github.com/login/oauth/access_token`. These are invoked only by Phase 33's `onAuth`/`onAuthFailure` closures during a github-source clone/fetch operation -- never during `install`, `uninstall`, `list`, `marketplace remove`, or path-source `marketplace add`. The existing `tests/architecture/no-orchestrator-network.test.ts` scans orchestrators/ -- since `domain/github-auth.ts` is in `domain/`, the test's existing glob does NOT need extension; verify in Phase 32 plan that the orchestrator-network test's scope is `orchestrators/` exclusively (it is, per existing milestone-research notes).
- **Atomic file ops (NFR-1):** all disk mutations atomic. **Applies indirectly:** Phase 32 does not write any extension-managed file directly; persistence is delegated to the OS keychain via Phase 31's seam.
- **Quality bar (NFR-6):** `npm run check` stays green. **Applies directly:** the phase gate is `npm run check` GREEN.
- **No telemetry V1 (IL-4):** unaffected by Phase 32. Phase 32 emits NO telemetry; the `requestCode` and `pollToken` calls go to github.com but those are functional, not analytics.
- **English only V1 (IL-1):** Reason strings in `DeviceFlowResult` are English-only (matches the rest of the v1.6 surface).
- **Scope model (SC-1):** unaffected by Phase 32. The OAuth App `client_id` is global per host (github.com); not scope-aware.
- **Conventional Commits (CLAUDE.md Git):** commit titles ≤ 72 chars, body ≤ 80. Phase 32 plan commits will follow this.
- **Pre-commit hooks:** run `pre-commit run --all-files` before `git commit`. Worktree commits prefix with `SKIP=trufflehog`.
- **GSD workflow gate (CLAUDE.md):** all file-changing operations flow through GSD entry points. Phase 32 is a `/gsd-plan-phase 32` run already; covered.

## Sources

### Primary (HIGH confidence)

- **`extensions/pi-claude-marketplace/platform/git.ts`** (read 2026-06-01) -- confirmed `GitCredentials` type shape after Phase 30: `{ username?, password?, headers?, cancel? }`. Import target for Phase 32.
- **`extensions/pi-claude-marketplace/platform/git-credential.ts`** (read 2026-06-01) -- confirmed `CredentialOps` interface (Phase 31) with `approve(host: string, cred: GitCredentials): Promise<void>`. The seam Phase 32 calls on success.
- **`tests/helpers/credential-mock.ts`** (read 2026-06-01) -- confirmed the mock pattern Phase 32 will mirror for `makeMockDeviceFlowHttp`: closure-scoped state + per-method call logs + optional throws overrides.
- **`tests/helpers/git-mock.ts`** (read 2026-06-01) -- confirmed `makeMockGitOps` pattern (the template Phase 31 mirrored; same template Phase 32 mirrors for DeviceFlowHttp).
- **`orchestrators/marketplace/shared.ts`** (read 2026-06-01) -- confirmed `GitOps` interface + `DEFAULT_GIT_OPS` constant pattern (used as the example for `DeviceFlowHttp` + `DEFAULT_DEVICE_FLOW_HTTP`). Also confirmed `UnstageOutcome` discriminated union pattern (used as the example for `DeviceFlowResult`).
- **`tests/architecture/no-credential-leak.test.ts`** (read 2026-06-01) -- confirmed the AUTH-09 gate structure that Phase 32 amends. `STATE_WRITE_FILES` list, `FORBIDDEN_STATE_FIELDS` regex, and the Error-interpolation gate logic.
- **`tests/architecture/no-shell-out.test.ts`** (read 2026-06-01) -- confirmed Phase 31 narrowing is exactly one file (`platform/git-credential.ts`); Phase 32 does NOT touch this test (no new `child_process` import).
- **`tests/architecture/import-boundaries.test.ts`** (read 2026-06-01) -- confirmed `domain` → `platform` import is permitted (`EXPECTED_FORBIDDEN["domain"]` does NOT include `platform`); Phase 32's `domain/github-auth.ts` may legitimately import from `platform/git.ts` and `platform/git-credential.ts`.
- **`eslint.config.js`** (read 2026-06-01) -- confirmed BLOCK A `ctx.ui.notify` chokepoint enforcement; Phase 32 stays out of this exemption by using the `notifyFn` callback (D-32-04).
- **`package.json`** (read 2026-06-01) -- confirmed `engines.node >=20.19.0` (so `globalThis.fetch` is stable) and test glob `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` (so `tests/domain/github-auth.test.ts` is picked up).
- **`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`** (read 2026-06-01) -- confirmed `notify(message: string, type?: "info" | "warning" | "error"): void` -- the signature `notifyFn` mirrors per D-32-04.
- **`.planning/research/PITFALLS.md`** (read 2026-06-01) -- CP-1..10 (Device Flow polling, infinite loop, callback exceptions), SEC-1..4 (token leaks), TI-1..4 (test isolation). Phase 32 P32-1..P32-8 are derived from / refined from this source.
- **`.planning/research/ARCHITECTURE.md`** (read 2026-06-01) -- milestone-level architecture; confirms `domain/github-auth.ts` as the chosen location (vs. platform/git.ts which would mix transport with OAuth).
- **`.planning/research/STACK.md`** (read 2026-06-01) -- milestone-level stack; confirms no new npm deps; `globalThis.fetch` for HTTP; `node:child_process` is Phase 31 only.
- **`.planning/phases/31-credential-subprocess-layer-auth/31-RESEARCH.md`** (read 2026-06-01) -- Phase 31 resolved questions:
  - Q1 host parameter: `host: string` (not `URL`). Phase 32 mirrors this -- `opts.host: string`.
  - Q2 fill return type: `null` on miss (not `undefined`). Phase 32 receives this contract; on `null`, Phase 33 triggers Device Flow.
  - Q3 `lookupHost(url)` helper: deferred to Phase 33. Phase 32 receives `host` as a parameter; URL parsing is Phase 33's responsibility.
- **GitHub Docs -- Authorizing OAuth Apps (Device Flow)** ([docs.github.com](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)) (fetched 2026-06-01) -- authoritative source for endpoints (`/login/device/code`, `/login/oauth/access_token`), error codes (`authorization_pending`, `slow_down`, `access_denied`, `expired_token`, `device_flow_disabled`, `unsupported_grant_type`, `incorrect_client_credentials`, `incorrect_device_code`), `slow_down` cumulative +5s, `expires_in: 900`, success response shape (`access_token`, `token_type`, `scope`).
- **GitHub Docs -- Scopes for OAuth Apps** ([docs.github.com](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)) -- `repo` scope grants "full access to public and private repositories".
- **GitHub Docs -- Token Expiration and Revocation** ([docs.github.com](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/token-expiration-and-revocation)) -- confirms OAuth App tokens do not expire by default (refresh token NOT needed for v1.6).
- **Node.js Docs -- timers/promises** ([nodejs.org/api/timers.html](https://nodejs.org/api/timers.html)) -- confirms `setTimeout(delay, value, { signal })` accepts AbortSignal; stable since Node 15.
- **Node.js Docs -- node:test** ([nodejs.org/api/test.html](https://nodejs.org/api/test.html)) -- confirms `t.mock.timers` available (not required by Phase 32; injected sleep + injected fetch eliminate timer needs).
- **isomorphic-git Docs -- authentication** ([isomorphic-git.org/docs/en/authentication](https://isomorphic-git.org/docs/en/authentication)) -- confirms `{ username: "x-access-token", password: <token> }` is the supported OAuth2 token shape for `onAuth`. Phase 32's success return uses this exact shape.

### Secondary (MEDIUM confidence)

- **WebSearch -- "GitHub OAuth Device Flow repo scope token expiration"** -- confirmed `repo` scope + no-expiry-by-default semantics. Cross-referenced with the official GitHub docs (HIGH).
- **WebSearch -- "isomorphic-git onAuth GitAuth private repo"** -- confirmed `{ username: "x-access-token", password }` shape for OAuth2 tokens (isomorphic-git docs canonical example).
- **GitHub Device Flow community discussions** -- behavior of slow_down with response-body `interval` field (the server can OVERRIDE the cumulative +5 by sending an explicit new interval; the spec says "5 extra seconds are added to the minimum interval" but the docs also note "the new interval you must use" is in the response body). Phase 32 chooses the CUMULATIVE +5 implementation per CP-1; if a future GitHub change makes the response-body `interval` authoritative, the state machine needs amendment. Documented in P32-1 warning signs.

### Tertiary (LOW confidence)

- None. All Phase 32 load-bearing claims trace to HIGH or MEDIUM sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; existing built-ins; verified against codebase + Node + GitHub docs.
- Architecture: HIGH -- pattern mirrors existing `GitOps` / `CredentialOps` interface design. Domain-tier placement matches milestone ARCHITECTURE.md decision.
- Pitfalls: HIGH -- 8 phase-specific pitfalls all cross-referenced with milestone PITFALLS.md CP-1..CP-10 / SEC-1..SEC-4 catalog and verified against authoritative sources.
- AUTH-09 architecture test extension: MEDIUM -- static grep catches obvious leaks but cannot prove the absence of all possible leaks; code-review backstop is required (same caveat as Phase 31).
- OAuth App registration (P32-7): MEDIUM at research time -- the operator action is documented and the plan-time checkpoint is specified; the actual client_id is not yet known. Risk: the plan ships with a placeholder constant; the operator MUST substitute the real value before the verification task runs.

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 -- 30 days for stable GitHub Device Flow + Node.js + isomorphic-git APIs; the milestone-level research (`.planning/research/`) was completed 2026-05-31 and remains current.
