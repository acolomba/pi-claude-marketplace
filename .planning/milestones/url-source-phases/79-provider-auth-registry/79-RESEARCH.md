# Phase 79: Provider-auth registry - Research

**Researched:** 2026-07-11
**Domain:** Generalizing the existing GitHub RFC-8628 Device Flow auth engine (`domain/github-auth.ts`) into a host-keyed `GitAuthProvider` registry, wiring provider lookup into two clone paths (marketplace `add`/`update` and the plugin `clone-cache.ts` seam), with a fail-clean no-provider arm and a no-credential-leak architecture gate covering every provider file. Entirely in-tree TypeScript against the already-pinned `isomorphic-git@1.38.5`; no new external deps.
**Confidence:** HIGH — the auth engine, `CredentialOps`, `buildAuthCallbacks`, `GitAuthBundle`, and the two clone seams all already exist and were read end-to-end this session.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Plugin-install auth UX (PROV-03)**
- **D-79-01:** A 401/403 on a provider-registered host during a git-source plugin clone AUTO-runs that provider's flow inline (parity with marketplace add on github.com), stores the credential host-keyed, and retries the clone ONCE.
- **D-79-02:** Within a single command invocation (including bulk installs), the provider flow runs AT MOST ONCE PER HOST. Subsequent clones in the same command reuse the fresh credential; if one still 401s, that item fails with the existing `authentication required` reason — no second prompt, no retry loop.

**No-provider failure (PROV-04)**
- **D-79-03:** The row reason stays the existing closed-set token `authentication required` — NO new REASONS token. The cause chain carries exactly one new line: `no auth provider is registered for <host>`. No supported-hosts list in the message. Fail-clean, no isomorphic-git retry loop.

**Registry shape (PROV-01 / PROV-06-readiness)**
- **D-79-04:** Providers are in-code data descriptors — plain constants carrying id, host match, device-flow endpoints, client_id, scope, and credential mapping — consumed by ONE generic device-flow engine. The GitHub descriptor parameterizes the existing RFC-8628 machine with byte-identical github.com behavior (success criterion 1). GitLab v2 = add one descriptor. NO user-editable provider config in v1 (no new persistence surface, no schema/migration burden).

**Expired-credential rotation (PROV-03)**
- **D-79-05:** Stored credential + still-401 ⇒ `reject(host, old)` → run provider flow → `approve(host, new)` → retry the clone once. Generalizes the existing CredentialOps rotation discipline host-keyed; parity with current github marketplace behavior. A second 401 after the fresh credential fails clean.

### Claude's Discretion
- Seam placement for the registry (likely domain tier beside github-auth.ts, with orchestrator-tier wiring) and how the plugin clone-cache path (clone-cache.ts) receives the auth hook — respect the no-orchestrator-network gate boundaries.
- Byte-identical github verification mechanics (existing device-flow tests must stay green unchanged; add an explicit parity test if cheap).
- The no-credential-leak gate extension pattern (`tests/architecture/no-credential-leak.test.ts` must cover every provider file — follow its existing coverage rules).
- Host extraction/matching mechanics (exact-host match for v1; github.com only).
- Public-host passthrough shape (PROV-02): no provider lookup unless the clone actually challenges with 401/403 — public repos on ANY host never touch auth.

### Deferred Ideas (OUT OF SCOPE)
- GitLab provider descriptor (PROV-06, v2) — registry shape must admit it as pure data addition.
- Per-source provider declaration for enterprise hosts (PROV-07, v2).
- User-editable provider config (rejected for v1 per D-79-04).
- Supported-hosts list in the no-provider message (rejected per D-79-03 — terse single cause line).
- SSH URLs (`git@host:`, `ssh://`) — https-only auth model.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | `GitAuthProvider` registry (id, host match, authenticate); the GitHub provider wraps the existing RFC-8628 Device Flow with byte-identical behavior for github.com | The engine (`initiateDeviceFlow` + `DeviceFlowHttp` + `runPollLoop`) already exists in `domain/github-auth.ts`. Only three values are github-specific: the two endpoint URLs (`GITHUB_DEVICE_CODE_URL`, `GITHUB_ACCESS_TOKEN_URL`), the `GITHUB_OAUTH_CLIENT_ID`, and the `REQUESTED_SCOPE`. Everything else — the poll loop, `slow_down`/`pending`/`access_denied`/`expired_token` handling, credential mapping `{ username: "x-access-token", password: accessToken }`, the `authAttempted` guard, the AUTH-09 notify discipline — is already generic. A descriptor carrying `{ id, hostMatch, deviceCodeUrl, tokenUrl, clientId, scope, credentialMapping }` + a lookup-by-host function IS the registry (D-79-04). Byte-identity: the GitHub descriptor supplies today's exact constants, so github.com output is unchanged. |
| PROV-02 | Public repos on any host clone unauthenticated — no provider required | Already true by construction: `platform/git.ts::clone`/`fetch` omit `onAuth`/`onAuthFailure` entirely when `opts.auth` is `undefined`. `materializePluginClone` currently passes NO auth (public-only, D-77-06). PROV-02 = keep the clone attempt authless FIRST; only on a 401/403 challenge do we look up a provider (D-79 discretion: "no provider lookup unless the clone actually challenges"). A public repo on any host never 401s → never touches auth. |
| PROV-03 | Auth-required on a host with a registered provider runs that provider's flow; the credential is stored host-keyed via `CredentialOps` | `CredentialOps.fill/approve/reject` are ALREADY host-keyed (every method takes a `host` string; `buildAttributeBlock` writes `protocol=https\nhost=<host>`). `buildAuthCallbacks({ credentialOps, host, onAuthRequired })` already does fill→onAuthRequired→approve host-keyed. PROV-03 = extract `host` from the clone URL, look up the provider for that host, bind its descriptor into `initiateDeviceFlow` (parameterized), and pass the `GitAuthBundle` into the clone. On the plugin path this means threading an optional `auth` bundle into `materializePluginClone` (today it drops it). |
| PROV-04 | Auth-required on a host with no registered provider fails clean with an actionable error (no isomorphic-git retry loop) | When host lookup returns no provider, do NOT construct a `GitAuthBundle` → the clone runs authless → the 401 surfaces as an isomorphic-git `HttpError` with `data.statusCode` 401/403. The existing duck-typed classifier (`add.ts:262`) maps it to `authentication required`. D-79-03: append ONE cause line `no auth provider is registered for <host>`. No `onAuth` callback means isomorphic-git cannot retry — the first 401 is terminal (fail-clean). |
| PROV-05 | The no-credential-leak architecture gate (`tests/architecture/no-credential-leak.test.ts`) covers every provider file | The gate today scans a hardcoded file list (`GITHUB_AUTH_FILE`, `GIT_CREDENTIAL_FILE`, the two orchestrators) for token interpolation inside `new Error(...)`/`notifyFn(...)`/`ctx.ui.notify(...)`. PROV-05 = add every NEW provider file (the registry module + any descriptor files + the parameterized engine if split out) to the gate's scanned list, applying the same `errorOrNotifyWithToken` regex. |
</phase_requirements>

## Summary

Phase 79 is a **parameterization + wiring** phase, not a new-subsystem phase. The load-bearing machinery already exists and was verified end-to-end this session:

- **The auth engine** (`domain/github-auth.ts::initiateDeviceFlow` + `runPollLoop` + `DeviceFlowHttp`) is already a generic RFC-8628 state machine. Only three values are github-specific — two endpoint URLs, one client_id, one scope. The credential mapping (`{ username: "x-access-token", password: accessToken }`) is currently hardcoded in `runPollLoop` but is itself just a descriptor field for GitLab-readiness (`oauth2` username per PROV-06).
- **`CredentialOps`** (`platform/git-credential.ts`) is already fully host-keyed — `fill`/`approve`/`reject` each take a `host` and build `protocol=https\nhost=<host>`. PROV-03's host-keyed storage requirement is satisfied the moment callers stop hardcoding `"github.com"`.
- **`buildAuthCallbacks`** (`platform/git.ts`) already does the fill→onAuthRequired→approve loop and the CP-9 no-retry-loop guard (`onAuthFailure` always returns `{ cancel: true }`). The 401→flow→retry-once mechanics are already correct; the registry just supplies the right `onAuthRequired` for the host.
- **Two clone paths** carry the `auth?` bundle already: the marketplace path (`add.ts`/`update.ts` → `addGitClonedInGuard`/`refreshGitHubClone`) threads `GitAuthBundle` today for github; the plugin path (`clone-cache.ts::materializePluginClone`) has NO auth parameter yet and is the single new seam per D-77-06.

**The central tension is the no-orchestrator-network gate.** `install.ts`, `reinstall.ts`, `list.ts`, `plugin/info.ts` MUST NOT name `gitOps`/`platform/git`/`DEFAULT_GIT_OPS`. The auth bundle and provider lookup must reach `materializePluginClone` through the existing `InstallCloneCacheSeam` bundle (imported BY NAME), never by importing the git surface. The once-per-host memo (D-79-02) lives at command scope (in `install.ts`/bulk-install caller), passed into the seam as part of the auth bundle. `clone-cache.ts` itself is NOT in the forbidden list (it legally imports `DEFAULT_GIT_OPS`), so the provider→GitAuthBundle construction can live there or in a domain sibling.

**Primary recommendation:** (1) Split `github-auth.ts` into a **generic device-flow engine** parameterized by a `GitAuthProvider` descriptor (endpoints, client_id, scope, credential mapping) + a **GitHub descriptor constant** carrying today's exact values (byte-identity preserved; existing tests stay green). (2) Add a tiny **registry module** (`domain/auth-registry.ts`): an array of descriptors + `findProviderForHost(host): GitAuthProvider | undefined` doing exact-host match (github.com only in v1). (3) Add an **orchestrator-tier helper** that: extracts host from a clone URL (`new URL(url).host`), looks up the provider, and — if found — builds the `GitAuthBundle` binding `initiateDeviceFlow(descriptor, ...)` as `onAuthRequired`; if not found, returns `undefined` (authless clone → clean 401). (4) Thread an optional `auth` param into `materializePluginClone` + the `InstallCloneCacheSeam` so the plugin path gains auth without naming `gitOps` in `install.ts`. (5) Add the once-per-host memo at command scope so bulk installs prompt at most once per host. (6) Extend the no-credential-leak gate's file list with every new provider file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Device-flow state machine (poll loop, slow_down/pending, deadline) | `domain/github-auth.ts` (renamed/refactored to a generic engine) | — | Auth policy is domain-tier (D-32-01). The engine is already host-agnostic except for 4 constants. |
| Provider descriptors (id, hostMatch, endpoints, client_id, scope, credential mapping) | `domain/` (registry module + descriptor constants) | — | Pure in-code data (D-79-04). No persistence, no schema, no I/O — belongs in domain beside the engine. |
| Host → provider lookup (`findProviderForHost`) | `domain/` (registry module) | — | Pure function over the descriptor array; exact-host match v1. |
| Host extraction from clone URL (`new URL(url).host`) | orchestrator-tier helper | `domain/source.ts` (github → `github.com`) | `UrlSource`/`GitSubdirSource` carry only `url` (no host field — VERIFIED); github sources canonicalize to `github.com`. Extraction is a boundary concern at the clone call site. |
| Build `GitAuthBundle` from provider + host (bind `initiateDeviceFlow(descriptor)`) | orchestrator-tier (marketplace/add,update + a shared helper) OR `clone-cache.ts` | `platform/git-credential.ts` (`CredentialOps`), `shared/notify.ts` (`makeRawNotifyFn`) | The bundle needs `ctx` (for `notifyFn`) + `credentialOps` + `deviceFlowHttp` test seam — all orchestrator-available. `clone-cache.ts` is git-legal, so the plugin-path bundle build can live there. |
| Thread auth into plugin clone (`materializePluginClone.auth?`) | `orchestrators/plugin/clone-cache.ts` | `platform/git.ts` (`CloneOptions.auth`) | clone-cache is NOT in the forbidden list; it already imports `DEFAULT_GIT_OPS`. Add an `auth?` param it forwards to `gitOps.clone`. |
| Once-per-host memo (bulk-install prompt suppression, D-79-02) | command-scope caller (`install.ts` bulk loop / the multi-install orchestrator) | — | Memo is command-lifetime state; lives where the per-item loop lives, passed into the seam. Not domain (domain is stateless). |
| No-provider clean failure (append `no auth provider is registered for <host>`) | orchestrator classifier (`classifyAddError` + plugin equivalent) | `shared/errors.ts` cause-chain | The 401 already maps to `authentication required`; the new cause line is added where the auth bundle would have been built (host known, provider absent). |
| No-credential-leak gate coverage | `tests/architecture/no-credential-leak.test.ts` | — | Add new provider files to the scanned-file arrays. |

## Standard Stack

No new libraries. Entirely in-tree TypeScript against the already-pinned stack.

### Core (already installed — carry forward unchanged)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `isomorphic-git` | `1.38.5` (pinned; `package.json` `^1.38.1`) | `clone`/`fetch` with `onAuth`/`onAuthFailure`; the auth-callback surface is already wired in `platform/git.ts`. | Only file allowed to import isomorphic-git (D-13). Phase 79 adds no new git primitive. [VERIFIED: read platform/git.ts — buildAuthCallbacks + CloneOptions.auth already exist] |
| `node:url` (`URL`) | bundled (Node ≥20.19) | Extract the bare host from a clone URL for provider lookup (`new URL(cloneUrl).host`). | Built-in. `UrlSource` carries only `url` (no host field) — VERIFIED at domain/source.ts:39-45; host must be parsed at the boundary. |
| `globalThis.fetch` | bundled | The default `DeviceFlowHttp` impl (`requestCodeImpl`/`pollTokenImpl`) POSTs to the descriptor's endpoint URLs. | Already the default (`DEFAULT_DEVICE_FLOW_HTTP`); parameterizing the URL is the only change. [VERIFIED: github-auth.ts:149-259] |
| `node:child_process` (via `CredentialOps`) | bundled | `git credential fill/approve/reject` host-keyed persistence — ALREADY host-parameterized. | D-21: `platform/git-credential.ts` is the ONLY file allowed to import child_process. Phase 79 changes nothing here — callers stop hardcoding `"github.com"`. [VERIFIED: git-credential.ts:60-67, 148-159] |
| `typebox` | `^1.1.38` (peer) | No schema change — provider descriptors are plain in-code constants (D-79-04: no new persistence surface). | Registry is NOT persisted → no validator needed. |

**Installation:** None. `npm install` unchanged.

**Version verification:**
```bash
npm view isomorphic-git version   # confirm 1.38.x line still current
```
Not required to run — no dependency is added or bumped by this phase. [VERIFIED: package.json declares isomorphic-git ^1.38.1; 78-RESEARCH pins the resolved 1.38.5]

## Package Legitimacy Audit

Not applicable — this phase installs **no external packages**. The sole dependency touched (`isomorphic-git`) is an already-committed, in-use direct dependency wrapped by `platform/git.ts`. No audit table required.

## Architecture Patterns

### System Data Flow (auth resolution across both clone paths)

```
CLONE URL (marketplace add/update OR plugin install/update/reinstall)
    │
    ▼  extract host:  github source → "github.com"
    │                 url/git-subdir → new URL(source.url).host
    ▼
findProviderForHost(host)            ← domain/auth-registry.ts (exact-host match, v1: github.com only)
    │
    ├── provider FOUND ──────────────────────────────────────────────┐
    │     build GitAuthBundle {                                       │
    │       credentialOps, host,                                      │
    │       onAuthRequired: () => initiateDeviceFlow(provider, ...)   │  ← provider descriptor
    │     }                                                           │    parameterizes endpoints/
    │     pass auth into clone/fetch                                  │    client_id/scope/cred-mapping
    │                                                                 │
    │     clone attempt (authless first):                            │
    │       onAuth → credentialOps.fill(host)                        │
    │         ├─ HIT  → return stored cred (AUTH-02 silent reuse)    │
    │         └─ MISS → onAuthRequired() = provider Device Flow      │
    │                    → notifyFn("Open <uri> enter <code>")       │  ← D-79-02: once-per-host memo
    │                    → poll → approve(host, newCred)             │    guards this (bulk installs)
    │       onAuthFailure (stale cred, still-401):                   │
    │         reject(host, oldCred) → { cancel:true }  (CP-9)        │  ← D-79-05 rotation: the NEXT
    │         next onAuth call: fill MISS → Device Flow → approve    │    onAuth re-runs flow, retry once
    │                                                                 │
    └── provider NOT FOUND ───────────────────────────────────────────┘
          NO GitAuthBundle → authless clone
          public repo → succeeds (PROV-02)
          private repo → HttpError statusCode 401/403
            → classifier maps to `authentication required`
            → append cause line: "no auth provider is registered for <host>"  (D-79-03)
            → FAIL CLEAN, no onAuth = no isomorphic-git retry loop (PROV-04)
```

### Pattern 1: Provider descriptor parameterizes the existing engine (D-79-04, PROV-01)

**What:** Today `initiateDeviceFlow` closes over four module-level constants: `GITHUB_DEVICE_CODE_URL`, `GITHUB_ACCESS_TOKEN_URL`, `GITHUB_OAUTH_CLIENT_ID`, `REQUESTED_SCOPE`, plus the hardcoded credential mapping in `runPollLoop` (`{ username: "x-access-token", password: r.accessToken }`). Promote these to a descriptor; the engine reads them from the descriptor instead of the constants.

**Descriptor fields needed (derived from what is github-specific in `github-auth.ts`):**

```typescript
// domain/auth-registry.ts (NEW) — plain in-code data (D-79-04, no persistence)
export interface GitAuthProvider {
  /** Stable id, e.g. "github". */
  readonly id: string;
  /** Exact-host match predicate (v1: host === "github.com"). GitLab v2 adds "gitlab.com". */
  hostMatch(host: string): boolean;
  /** POST target for the device-code request (github: https://github.com/login/device/code). */
  readonly deviceCodeUrl: string;
  /** POST target for the token poll (github: https://github.com/login/oauth/access_token). */
  readonly tokenUrl: string;
  /** PUBLIC OAuth App client_id (D-32-03 — safe to commit; Device Flow has no secret). */
  readonly clientId: string;
  /** Requested OAuth scope (github: "repo"; gitlab v2: "read_repository"). */
  readonly scope: string;
  /**
   * Map an access token to the git credential. github: username "x-access-token".
   * gitlab v2 (PROV-06): username "oauth2". This is the one field that was hardcoded
   * inside runPollLoop's success arm and must become a descriptor field.
   */
  credentialFrom(accessToken: string): GitCredentials;
}

export const GITHUB_PROVIDER: GitAuthProvider = {
  id: "github",
  hostMatch: (host) => host === "github.com",
  deviceCodeUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  clientId: "Ov23liNcyK08uGdU0mMl",   // today's exact constant → byte-identity
  scope: "repo",
  credentialFrom: (accessToken) => ({ username: "x-access-token", password: accessToken }),
};

const PROVIDERS: readonly GitAuthProvider[] = [GITHUB_PROVIDER];

/** PROV-01: registry lookup. Returns undefined when no provider matches (PROV-04). */
export function findProviderForHost(host: string): GitAuthProvider | undefined {
  return PROVIDERS.find((p) => p.hostMatch(host));
}
```

**Byte-identity (success criterion 1):** the GitHub descriptor supplies the CURRENT literal values. The engine's poll loop, deadline math, `slow_down` cumulative +5, `pending` no-mutate, `access_denied`/`expired_token` messages, and the `notifyFn("Open <uri> and enter: <code>", "info")` prompt string are UNCHANGED. Existing `tests/domain/github-auth.test.ts` + `tests/integration/auth-e2e.test.ts` + `tests/shared/device-flow-prompt.test.ts` stay green with no edits — that IS the byte-identity proof. Add one cheap parity assertion if desired (Claude's Discretion).

**What is github-specific vs already generic (audit of `github-auth.ts`):**
- **github-specific → descriptor fields:** `GITHUB_DEVICE_CODE_URL`, `GITHUB_ACCESS_TOKEN_URL`, `GITHUB_OAUTH_CLIENT_ID`, `REQUESTED_SCOPE`, the `{ username: "x-access-token" }` mapping.
- **already generic → engine keeps as-is:** the entire `PollResult` discriminated union, `runPollLoop`, `safePollToken`, `requestCodeImpl`/`pollTokenImpl` (parameterize their URL arg), the `DeviceCodeResponse` validation, `authAttempted` guard (D-32-05), the AUTH-09 notify discipline, the deadline/interval clock, the `slow_down`/`pending` handling. GitHub's "HTTP 200 for poll errors, body is source of truth" (P32-4) is an RFC-8628 conformance detail GitLab shares.

### Pattern 2: Provider lookup gates auth bundle construction (PROV-02 / PROV-04)

**What:** The clone attempt runs authless FIRST. Provider lookup only decides whether an `onAuth` callback is even attached. A public repo never 401s, so the callback (if attached) never fires — but per the discretion note "no provider lookup unless the clone actually challenges," the cleaner shape is: attach the bundle iff a provider exists for the host; a no-provider host gets an authless clone that fails clean on 401.

```typescript
// orchestrator-tier helper (shared by marketplace + plugin paths)
function buildAuthForHost(args: {
  host: string;
  credentialOps: CredentialOps;
  ctx: ExtensionContext;
  deviceFlowHttp?: DeviceFlowHttp;
}): GitAuthBundle | undefined {
  const provider = findProviderForHost(args.host);
  if (provider === undefined) {
    return undefined;   // PROV-04: no bundle → authless → clean 401
  }
  const notifyFn = makeRawNotifyFn(args.ctx);
  const onAuthRequired: OnAuthRequiredFn = async (): Promise<AuthAttemptResult> =>
    initiateDeviceFlow({
      provider,                                   // descriptor-parameterized (Pattern 1)
      host: args.host,
      credentialOps: args.credentialOps,
      notifyFn,
      ...(args.deviceFlowHttp !== undefined && { http: args.deviceFlowHttp }),
    });
  return { credentialOps: args.credentialOps, host: args.host, onAuthRequired };
}
```

Then at each clone call: `const auth = buildAuthForHost(...); await gitOps.clone({ ...opts, ...(auth !== undefined && { auth }) })`. This replaces the current inline `const host = "github.com"; ... initiateDeviceFlow({ host, ... })` blocks in `add.ts:726-737` and `update.ts:375-395`.

### Pattern 3: The 401→flow→retry-once mechanics are ALREADY correct (D-79-01, D-79-05)

**What:** The retry-once and rotation discipline live in `buildAuthCallbacks` (`platform/git.ts:385-436`) and are host-agnostic already. The mechanics, VERIFIED this session:

- **`onAuth(url)`:** `fill(host)` → HIT returns stored cred (silent reuse); MISS calls `onAuthRequired()` (Device Flow) → success returns new cred, which `initiateDeviceFlow` ALREADY `approve(host, cred)`'d internally (github-auth.ts:315-317). Failure returns `{ cancel: true }`.
- **`onAuthFailure(url, cred)`:** a stored-but-stale credential that still 401s → `reject(host, cred)` then `{ cancel: true }` (CP-9: NEVER retry inline — that would loop). isomorphic-git's NEXT `onAuth` invocation sees a fill MISS (the cred was just rejected) and runs Device Flow → `approve(host, new)`. **This IS D-79-05's `reject→flow→approve→retry-once`**, already implemented, just host-parameterized.

**"Retry the clone ONCE" (D-79-01):** isomorphic-git drives the retry internally via its onAuth/onAuthFailure loop — the orchestrator does NOT re-invoke `clone()`. The current marketplace flow does exactly this: a single `refreshGitHubClone`/`clone` call whose internal auth callbacks handle fill→flow→approve→retry. **The plugin path inherits this the moment `materializePluginClone` forwards an `auth` bundle to `gitOps.clone`.**

**"No isomorphic-git retry loop" for the no-provider path (D-79-03):** with NO `auth` bundle, `clone()` attaches NO `onAuth`/`onAuthFailure` (platform/git.ts:137,145-148 spread only when `authCbs !== undefined`). isomorphic-git has nothing to retry with → the first 401 throws `HttpError` terminally. VERIFIED: fail-clean is structural, not a guard.

### Pattern 4: Thread auth into the plugin clone-cache seam (PROV-03, D-77-06 → D-79)

**What:** `materializePluginClone` today has NO auth param and passes none to `gitOps.clone` (clone-cache.ts:75-79). Add an optional `auth?: GitAuthBundle` param it spreads into the clone call, exactly like `addGitClonedInGuard` does (add.ts:632-637).

```typescript
// clone-cache.ts::materializePluginClone — add auth param
export async function materializePluginClone(args: {
  locations: ScopedLocations;
  cloneUrl: string;
  pin: string;
  ref?: string;
  gitOps?: GitOps;
  auth?: GitAuthBundle;   // NEW — undefined = public-only (byte-identical to today)
}): Promise<string> {
  // ...
  await gitOps.clone({
    dir: stagingDir,
    url: args.cloneUrl,
    ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
    ...(args.auth !== undefined && { auth: args.auth }),   // NEW
  });
  // ...
}
```

**Gate compliance (critical):** `install.ts`/`reinstall.ts` MUST NOT name `gitOps`/`platform/git`/`DEFAULT_GIT_OPS` (no-orchestrator-network gate). They already reach the seam through `InstallCloneCacheSeam` (install.ts:378-380, a bundle of `resolvePluginPin`/`materializePluginClone` typeof-imported BY NAME). The auth bundle threads through the SAME seam: `makeInstallCloneProbe` (install.ts:456) gains an `auth?` param it forwards to `seam.materializePluginClone({ ..., auth })`. `install.ts` constructs the bundle via `buildAuthForHost` — which imports `findProviderForHost` (domain) + `initiateDeviceFlow` (domain) + `makeRawNotifyFn` (shared), NONE of which is the git surface. So install.ts stays gate-clean: it names the auth registry and the credential ops, never `gitOps`. VERIFIED: `buildAuthForHost` touches only domain/shared/platform-git-credential — none matches the forbidden patterns (`platform/git`, `DEFAULT_GIT_OPS`, `gitOps`, `refreshGitHubClone`).

**Which plugin call sites get auth:**
- **install** (`makeInstallCloneProbe`): YES — a private git-source plugin install triggers the flow (D-79-01).
- **update** (`update.ts` git-source arm, Phase 78's `updateCloneProbe`): YES — update owns gitOps; same bundle. (Phase 78 wires the probe; Phase 79 adds auth to it.)
- **reinstall** (`makeReinstallCloneProbe`, Phase 78): borderline — reinstall materializes from `oldRecord.resolvedSha` on a WARM cache (offline by construction, PURL-07). A warm reinstall never clones → never 401s. A COLD-cache reinstall re-clones and COULD 401 on a private repo; it should get the same bundle for parity. Confirm at planning whether reinstall's cold-cache path threads auth (recommend YES for consistency — costs nothing on the warm path).
- **resolveRemoteRef (unpinned HEAD resolution):** see Open Q1 — currently authless; a private unpinned repo's HEAD resolution 401s. This is the one gap that needs a planner decision.

### Pattern 5: Once-per-host memo at command scope (D-79-02)

**What:** A bulk install of N plugins all on the same private host must prompt Device Flow at most ONCE. After the first successful flow, `approve(host, cred)` persists the credential; every subsequent plugin's `onAuth` → `fill(host)` HITS and reuses it silently. So the memo is MOSTLY automatic via the keychain. BUT: `approve` is best-effort (git-credential.ts:227-234 swallows failures) — if the keychain write fails, `fill` misses and every plugin re-prompts (storm). The explicit memo guards this.

**Recommended memo shape:** an in-command `Map<host, AuthAttemptResult>` (or a `Set<host>` of "already attempted") captured in the bulk-install caller's closure and consulted inside `onAuthRequired` BEFORE running the flow: if the host already produced a credential this command, reuse it; if it already FAILED this command, return the cached failure (no re-prompt, item fails with `authentication required` per D-79-02 "if one still 401s, that item fails ... no second prompt"). The memo lives where the per-item loop lives (the bulk-install orchestrator), passed into `buildAuthForHost` as an optional cache.

**Simplest correct implementation:** wrap `onAuthRequired` so the first call per host runs `initiateDeviceFlow` and stores the `AuthAttemptResult` in the memo; subsequent calls return the memoized result. Combined with keychain `fill`, this is belt-and-braces against the approve-failure storm.

### Anti-Patterns to Avoid
- **Constructing a `GitAuthBundle` for a non-provider host.** That would send a github Device Flow (or any provider's flow) to an unrelated host, and worse, could leak a credential intended for one host to another. A no-provider host gets NO bundle → authless clone → clean 401 (PROV-04). The current `addUrlInGuard` already documents this exact hazard (add.ts:741-745: "Constructing github's Device Flow auth here would leak credentials to a non-github host").
- **Hardcoding `const host = "github.com"` at any clone call site.** That is precisely what Phase 79 removes (add.ts:726, update.ts:375). Extract the host from the URL and look it up.
- **Naming `gitOps`/`platform/git`/`DEFAULT_GIT_OPS` in install.ts or reinstall.ts.** The auth bundle threads through `InstallCloneCacheSeam` by name; the provider registry + `initiateDeviceFlow` are domain imports, not the git surface. The token-grep gate fails the build otherwise.
- **Adding a new REASONS token for the no-provider case.** D-79-03: the row reason STAYS `authentication required`; the distinction is a single cause-chain line, not a new closed-set token.
- **Putting a supported-hosts list in the no-provider message.** D-79-03 explicitly rejects this — terse single cause line `no auth provider is registered for <host>`.
- **Retrying the clone in orchestrator code.** The retry-once is isomorphic-git-internal via onAuth/onAuthFailure. Re-invoking `clone()` from the orchestrator would double-clone and could loop. VERIFIED: the marketplace path does a SINGLE clone/fetch call; the callbacks handle the retry.
- **Persisting the provider registry to disk / adding a schema.** D-79-04: providers are in-code constants. No persistence surface, no migration, no typebox validator.
- **Making the credential mapping github-specific in the engine.** The `{ username: "x-access-token" }` mapping must move to a descriptor field (`credentialFrom`) so GitLab's `oauth2` username is a pure data addition (PROV-06 readiness).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Host-keyed credential fill/approve/reject | A new keychain wrapper | `CredentialOps` (already host-keyed; `platform/git-credential.ts`) | fill/approve/reject already take `host`; `buildAttributeBlock` writes `protocol=https\nhost=<host>`. Callers just stop hardcoding "github.com". [VERIFIED] |
| 401→flow→retry-once + stale-cred rotation | A retry loop in the orchestrator | `buildAuthCallbacks` (`platform/git.ts`) + isomorphic-git's onAuth/onAuthFailure | The fill→onAuthRequired→approve loop and CP-9 no-inline-retry guard already exist and are host-agnostic. D-79-05's reject→flow→approve→retry IS the current onAuthFailure→next-onAuth behavior. [VERIFIED: git.ts:385-436] |
| Device Flow state machine (poll, slow_down, deadline) | A per-provider poll loop | The existing `runPollLoop`/`initiateDeviceFlow`, parameterized by a descriptor | RFC-8628 machine is already generic except 4 constants. GitLab shares the RFC. [VERIFIED: github-auth.ts:292-379] |
| Extract host from a clone URL | Regex/string-split munging | `new URL(cloneUrl).host` (node:url) | Built-in, handles port/userinfo correctly. github sources canonicalize to "github.com" without a URL parse. |
| Public-vs-authed clone branching | A boolean flag threaded everywhere | Spread `...(auth !== undefined && { auth })` (the existing `addGitClonedInGuard` idiom) | `platform/git.ts::clone` already attaches onAuth ONLY when `opts.auth` is defined; omitting the bundle IS the public path. [VERIFIED: git.ts:137] |
| No-provider clean 401 (no retry loop) | A custom "give up" guard | Omit the auth bundle → no onAuth attached → isomorphic-git can't retry | Fail-clean is structural: no callback = no loop. [VERIFIED: git.ts:145-148] |
| Credential-leak prevention in provider files | Ad-hoc code review | Extend `no-credential-leak.test.ts`'s file list; keep the AUTH-09 notify/Error discipline | The gate + regex already exist; add new files to the scanned arrays. [VERIFIED: no-credential-leak.test.ts:47-52,104-135] |

**Key insight:** Phase 79 writes almost no new logic. The engine, the host-keyed credential surface, the retry/rotation callbacks, and both clone seams already exist. The phase is (1) promote 5 github constants to a descriptor + add a lookup function, (2) replace two inline `host = "github.com"` blocks with `buildAuthForHost(extractedHost, ...)`, (3) thread an `auth?` param through `materializePluginClone` + the install seam + the once-per-host memo, (4) add the no-provider cause line, (5) extend the gate's file list. The hard problems (RFC-8628 conformance, retry-loop guarding, credential leak discipline, atomic clone) were all solved in prior phases.

## Runtime State Inventory

> This phase adds NO state schema field and stores NO new persisted artifact. Credentials live in the OS keychain via `CredentialOps` (already host-keyed) — the same store used for github.com today, now keyed by additional hosts when a provider matches.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | OS keychain entries via `git credential`, keyed `protocol=https;host=<host>`. Today only `github.com` is written. Phase 79 lets other provider-matched hosts write entries under their own host key. NO change to `state.json` (AUTH-09 forbids tokens in state; the no-credential-leak gate enforces it). | Code edit only: callers pass the extracted host instead of literal "github.com". No data migration — existing github.com keychain entries are untouched (same host key, same `x-access-token` username mapping). |
| Live service config | The GitHub OAuth App client_id (`Ov23liNcyK08uGdU0mMl`) is a compile-time constant, not external config. GitLab v2 would add a second app registration — out of scope. | None. The descriptor carries today's exact client_id → byte-identity. |
| OS-registered state | None. | None. |
| Secrets/env vars | `GIT_TERMINAL_PROMPT=0` + `GCM_INTERACTIVE=never` are set by `gitCredentialIO` (git-credential.ts:85-87) — unchanged. The PUBLIC client_id is committed per D-32-03 (Device Flow has no client_secret). No new secret. | None. |
| Build artifacts | If `github-auth.ts` is renamed/split (e.g. to `device-flow.ts` + `auth-registry.ts`), the no-credential-leak gate's hardcoded `GITHUB_AUTH_FILE` path must be updated to the new path(s). | Code edit: update the gate's scanned-file constant if the file is renamed. |

**Nothing found in categories 2 (external service), 3, 5 (no new secret):** verified — the client_id is a committed public constant; no external service config holds provider state (D-79-04 explicitly rejects any user-editable/persisted provider surface).

## Common Pitfalls

### Pitfall 1: Credential intended for one host sent to another (cross-host leak)
**What goes wrong:** A generic auth bundle is built for every clone regardless of host, so a github Device Flow token gets `approve`'d under (or `onAuth`-returned for) a non-github host, or a private third-party host receives a github OAuth flow.
**Why it happens:** treating "clone needs auth" as global rather than per-host-provider.
**How to avoid:** `buildAuthForHost` returns `undefined` when `findProviderForHost(host)` misses. NO provider → NO bundle → authless clone → clean 401 (PROV-04). The bundle's `host` field is the extracted host, so `approve`/`fill` key on the right host. `addUrlInGuard` already documents this exact hazard for the public-url path (add.ts:741-745).
**Warning signs:** a test cloning a private non-github host observes a github Device Flow prompt, or a keychain entry appears under the wrong host.

### Pitfall 2: install.ts/reinstall.ts trip the no-orchestrator-network gate
**What goes wrong:** wiring auth into the plugin path by importing `gitOps` or `platform/git` into install.ts to build the bundle.
**Why it happens:** the auth bundle FEELS like a git concern.
**How to avoid:** the bundle is built from domain (`findProviderForHost`, `initiateDeviceFlow`) + shared (`makeRawNotifyFn`) + `CredentialOps` (platform/git-credential, NOT platform/git) — none matches the forbidden patterns. The bundle threads to the clone through `InstallCloneCacheSeam.materializePluginClone` BY NAME. install.ts never names `gitOps`.
**Warning signs:** `tests/architecture/no-orchestrator-network.test.ts` fails with `install.ts matches forbidden gitOps reference`.

### Pitfall 3: Bulk-install prompt storm on a private host (D-79-02 violation)
**What goes wrong:** installing 10 plugins from the same private host prompts Device Flow 10 times.
**Why it happens:** relying solely on keychain `fill` reuse, but `approve` is best-effort (swallows failures) — a keychain write miss makes every subsequent `fill` miss too, re-triggering the flow.
**How to avoid:** an explicit once-per-host memo (`Map<host, AuthAttemptResult>`) at command scope, consulted inside `onAuthRequired` before running the flow. First success stores; subsequent calls reuse. A first FAILURE also stores → subsequent items fail with `authentication required` and NO re-prompt (D-79-02 exact text).
**Warning signs:** a bulk-install test with a failing mock `approve` (keychain unavailable) observes >1 Device Flow prompt for the same host.

### Pitfall 4: Byte-identity regression for github.com
**What goes wrong:** refactoring the engine changes the prompt string, the scope, the credential username, the slow_down math, or the client_id → github.com behavior drifts.
**Why it happens:** moving constants into a descriptor and accidentally changing a value or reordering the poll logic.
**How to avoid:** the GitHub descriptor supplies the EXACT current literals (`repo`, `x-access-token`, `Ov23liNcyK08uGdU0mMl`, the two URLs, the `"Open <uri> and enter: <code>"` prompt). The existing tests (`tests/domain/github-auth.test.ts`, `tests/integration/auth-e2e.test.ts`, `tests/shared/device-flow-prompt.test.ts`) MUST pass UNCHANGED — that is the byte-identity gate. Do NOT edit those tests to accommodate the refactor.
**Warning signs:** any of the three existing auth tests requires a diff to pass.

### Pitfall 5: Unpinned private-repo HEAD resolution 401s before the clone
**What goes wrong:** an unpinned git-source plugin on a private host calls `resolveRemoteRef({ url })` (via `resolvePluginPin`) which is AUTHLESS (git.ts:209-238, D-77-06) → 401 before any auth bundle is consulted → the plugin fails with `authentication required` even though a provider IS registered.
**Why it happens:** `resolveRemoteRef` (`listServerRefs`) has no auth surface today.
**How to avoid:** see Open Q1 — either (a) thread auth into `resolveRemoteRef`/`listServerRefs` (isomorphic-git's `listServerRefs` accepts `onAuth`/`onAuthFailure`), or (b) accept the limitation for v1 (unpinned private repos require a sha pin) and document it. A pinned private repo does NOT hit this — `resolvePluginPin` short-circuits on `source.sha` (clone-cache.ts:153) and only the clone 401s (which the bundle handles). Confirm scope at planning.
**Warning signs:** a private unpinned git-source plugin install fails at pin-resolution, not at clone.

### Pitfall 6: The no-credential-leak gate misses a new provider file
**What goes wrong:** the engine is split into new files (e.g. `device-flow.ts`, `auth-registry.ts`) but the gate still only scans the old `github-auth.ts` path → a token interpolation in a new file goes uncaught (PROV-05 violation).
**Why it happens:** the gate uses a hardcoded file-list, not a directory walk.
**How to avoid:** add every new provider file to the gate's scanned arrays (mirror the `GITHUB_AUTH_FILE`/`PHASE_35_ORCHESTRATOR_FILES` pattern) and apply the existing `errorOrNotifyWithToken` regex. If the engine file is renamed, update `GITHUB_AUTH_FILE` to the new path.
**Warning signs:** a provider file interpolating `cred.password`/`access_token` into a `notifyFn`/`new Error` compiles clean and the gate stays green (false pass).

## Code Examples

### Parameterize the engine's HTTP impl by descriptor URLs (PROV-01)
```typescript
// domain/github-auth.ts (or a renamed device-flow.ts) — requestCodeImpl gains a URL param.
// The descriptor supplies the URL; github's is the current literal → byte-identity.
async function requestCodeImpl(url: string, clientId: string, scope: string): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({ client_id: clientId, scope }).toString();
  const res = await fetch(url, {                       // was: GITHUB_DEVICE_CODE_URL constant
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Device code request failed: HTTP ${res.status}`);  // AUTH-09: status only
  // ... field validation unchanged ...
}
```

### `initiateDeviceFlow` takes a provider descriptor (PROV-01, byte-identical for github)
```typescript
export interface InitiateDeviceFlowOpts {
  provider: GitAuthProvider;   // NEW — supplies endpoints/client_id/scope/credentialFrom
  host: string;
  credentialOps: CredentialOps;
  notifyFn: NotifyFn;
  http?: DeviceFlowHttp;
  signal?: AbortSignal;
}
// runPollLoop's success arm now maps via the descriptor (was hardcoded x-access-token):
//   const cred = opts.provider.credentialFrom(r.accessToken);
//   await opts.credentialOps.approve(opts.host, cred);
// The prompt string, deadline, slow_down math stay EXACTLY as today.
```

### Replace the inline github host block at a clone call site (PROV-02/03/04)
```typescript
// add.ts addGithubInGuard / addUrlInGuard converge on ONE helper.
// github source: host = "github.com"; url source: host = new URL(source.url).host.
const host = source.kind === "github" ? "github.com" : new URL(cloneUrl).host;
const auth = buildAuthForHost({ host, credentialOps, ctx, ...(deviceFlowHttp !== undefined && { deviceFlowHttp }) });
// auth is undefined for a no-provider host → addGitClonedInGuard clones authless → clean 401 (PROV-04).
return addGitClonedInGuard({ state, locations, source, gitOps, cloneUrl, ...(auth !== undefined && { auth }), cwd });
```

### No-provider cause line (D-79-03)
```typescript
// Where the auth bundle would have been built but findProviderForHost missed AND the clone
// then 401s: the classifier already returns "authentication required"; append the cause line.
// Simplest: attach it at the point host is known and provider is absent, as an Error.cause chain
// entry, so causeChainTrailer renders "... -> no auth provider is registered for <host>".
// No new REASONS token; the row reason stays `authentication required`.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auth hardcoded to github.com at every clone call site (`const host = "github.com"`) | Host extracted from the clone URL; provider looked up in a registry; bundle built only when a provider matches | D-79-01..05 (this phase) | Private/self-hosted hosts with a registered provider authenticate; unknown hosts fail clean; public repos on any host clone authless. |
| Device Flow engine coupled to 4 github constants | Engine parameterized by a `GitAuthProvider` descriptor; GitHub is one descriptor constant | D-79-04 (this phase) | GitLab v2 = add one descriptor (PROV-06); no engine change. |
| Plugin clone-cache path public-only (no auth threaded) | `materializePluginClone` forwards an optional `auth` bundle through the install seam | D-77-06 → D-79-01 (this phase) | Private git-source plugins install; the once-per-host memo prevents bulk-install prompt storms. |

**Deprecated/outdated by this phase:** the two inline `host = "github.com"` auth blocks in `add.ts` and `update.ts` are replaced by the registry lookup. The hardcoded credential mapping inside `runPollLoop`'s success arm moves to the descriptor's `credentialFrom`. No public API is removed — `initiateDeviceFlow` gains a `provider` field.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | isomorphic-git's `listServerRefs` (used by `resolveRemoteRef`) accepts `onAuth`/`onAuthFailure` so private unpinned HEAD resolution CAN be authed if the planner chooses. | Pitfall 5 / Open Q1 | Medium — if `listServerRefs` does NOT accept auth callbacks, option (a) is impossible and v1 must document "unpinned private repos require a sha pin" (option b). Verify against `node_modules/isomorphic-git/index.d.ts` at planning. The clone path itself is unaffected (pinned repos never hit this). |
| A2 | Extracting host via `new URL(source.url).host` yields the exact string `CredentialOps` keys on (`buildAttributeBlock` writes `host=<host>`). | Pattern 2 / Architecture Map | Low — `URL.host` includes port if present; github/gitlab standard https has none. Confirm `.host` vs `.hostname` (host includes `:port`; hostname does not). Recommend `.host` to match git-credential's whole-host key, but verify against how git credential stores the entry. |
| A3 | The existing three auth tests (`github-auth.test.ts`, `auth-e2e.test.ts`, `device-flow-prompt.test.ts`) pass UNCHANGED after the descriptor refactor, proving byte-identity. | Pattern 1 / Pitfall 4 | Low — the refactor only moves constants into a descriptor supplying the same literals; the poll logic is untouched. If a test references a private module-level constant (`GITHUB_OAUTH_CLIENT_ID`) directly, that import may need repointing — a test-mechanics fix, not a behavior change. Verify the tests' import surface at planning. |
| A4 | The once-per-host memo belongs in the bulk-install caller's closure (command scope), not in domain. | Pattern 5 / Architecture Map | Low — domain is stateless (D-79-04); command-lifetime state lives at the orchestrator loop. If bulk install is not yet a single orchestrator (each install is a separate command), the memo degrades to keychain-only reuse — still correct, just not storm-proof against approve failures. Confirm the bulk-install entry shape at planning. |

**A1 is the one design-affecting assumption** (private unpinned HEAD resolution). A2–A4 are verification steps, not design risks.

## Open Questions (RESOLVED)

1. **Does unpinned private-repo HEAD resolution need auth, and can `resolveRemoteRef` carry it?**
   - What we know: `resolvePluginPin` short-circuits on `source.sha` (no network); an unpinned or ref-only source calls `resolveRemoteRef({ url })` which wraps `listServerRefs` AUTHLESS (git.ts:209-238, D-77-06 public-only). A private unpinned repo 401s here BEFORE the clone.
   - What's unclear: (a) thread `onAuth`/`onAuthFailure` into `listServerRefs` (if it accepts them) so unpinned private resolution works; OR (b) accept that v1 requires a sha pin for private unpinned sources and route the 401 to `authentication required` + the no-provider/needs-pin cause line.
   - Recommendation: check `node_modules/isomorphic-git/index.d.ts` for `listServerRefs` auth params. If present, thread the bundle (small change, full parity). If absent, choose (b) and document — the marketplace path is unaffected (marketplace add/update clone the whole repo, no pre-resolution). Pin at planning.

2. **`URL.host` vs `URL.hostname` for the credential key?**
   - What we know: `buildAttributeBlock` writes `host=<host>` verbatim; git credential matches on the whole attribute set. `URL.host` includes `:port`; `URL.hostname` does not.
   - What's unclear: whether git credential stores/matches on host-with-port or host-only, and which the exact-host `hostMatch` predicate should compare.
   - Recommendation: for standard https (no explicit port), `.host` === `.hostname` === `"github.com"`, so it is moot for v1 (github.com only). Use `.host` for forward-consistency but verify the credential round-trip has no port surprise. Pin at planning.

3. **Does reinstall's cold-cache re-clone thread auth?**
   - What we know: reinstall materializes from `oldRecord.resolvedSha` (warm cache → offline, PURL-07). A cold cache re-clones and could 401 on a private repo.
   - What's unclear: whether Phase 79 wires the auth bundle into reinstall's cold-cache path or leaves reinstall public-only (a cold-cache private reinstall would then fail `authentication required`).
   - Recommendation: thread the bundle for consistency (costs nothing on the warm path; the once-per-host memo isn't needed since reinstall is single-target). Confirm reinstall's clone-seam wiring (Phase 78) is compatible. Pin at planning.

## Environment Availability

> Skipped for external tooling — this phase adds no new external dependencies, tools, or services. `isomorphic-git@1.38.x` is already installed; `git` (for `CredentialOps` subprocess) is an OPTIONAL runtime dependency whose absence is already handled (ENOENT → fill returns null, approve/reject silently no-op; git-credential.ts:196-251). Network is touched only by the clone/fetch/HEAD-resolution paths that already exist. Node/TypeScript toolchain unchanged.

## Validation Architecture

> nyquist_validation is enabled (config.json: `workflow.nyquist_validation: true` — the absent-key default; 78-RESEARCH confirms it enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node --test` (TS via native strip) |
| Config file | none (globs in `package.json` scripts) |
| Quick run command | `node --test "tests/domain/github-auth.test.ts"` (byte-identity gate) |
| Full suite command | `npm run check` (typecheck + eslint + prettier + tests + integration) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROV-01 | GitHub descriptor drives the engine with byte-identical github.com output; registry lookup returns the github provider for github.com and undefined otherwise | unit | `node --test "tests/domain/github-auth.test.ts"` (unchanged) + `node --test "tests/domain/auth-registry.test.ts"` (NEW) | ✅ unchanged + ⚠️ NEW (Wave 0) |
| PROV-02 | A public repo on a non-github host clones with NO auth bundle attached (no provider lookup / no onAuth) | unit + integration | `node --test "tests/orchestrators/plugin/clone-cache.test.ts"` (extend) + `tests/integration/auth-e2e.test.ts` | ✅ (extend) |
| PROV-03 | A 401 on a provider-registered host runs the flow, `approve(host, cred)` fires host-keyed, clone retries once and succeeds | integration | `node --test "tests/integration/auth-e2e.test.ts"` (extend) + `node --test "tests/platform/git-auth-callbacks.test.ts"` | ✅ (extend) |
| PROV-04 | A 401 on a no-provider host fails clean with `authentication required` + the `no auth provider is registered for <host>` cause line, and NO onAuth/onAuthFailure loop runs | orchestrator | `node --test "tests/orchestrators/marketplace/add.test.ts"` + plugin install test (extend) | ✅ (extend) |
| PROV-05 | Every provider file appears in the no-credential-leak gate's scanned list; a token interpolation in a provider file is caught | architecture | `node --test "tests/architecture/no-credential-leak.test.ts"` | ✅ (extend file list) |
| D-79-02 | Bulk install on one private host prompts Device Flow at most once even with a failing mock `approve` | orchestrator | plugin bulk-install test (NEW or extend) | ⚠️ verify bulk-install test exists |

### Sampling Rate
- **Per task commit:** `node --test "tests/domain/github-auth.test.ts"` (byte-identity canary) + the touched orchestrator's test.
- **Per wave merge:** `node --test "tests/domain/**" "tests/platform/**" "tests/integration/auth-e2e.test.ts" "tests/architecture/no-credential-leak.test.ts"`.
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/domain/auth-registry.test.ts` — covers PROV-01 (lookup returns github for github.com; undefined for unknown host) + descriptor shape.
- [ ] Extend `tests/orchestrators/plugin/clone-cache.test.ts` — covers PROV-02 (authless clone) + PROV-03 (auth bundle threaded to `materializePluginClone`).
- [ ] Extend `tests/integration/auth-e2e.test.ts` — covers PROV-03 host-keyed approve on a non-github (mock) provider host + retry-once.
- [ ] Extend `tests/architecture/no-credential-leak.test.ts` — add every new provider file to the scanned arrays (PROV-05).
- [ ] Confirm/author a bulk-install once-per-host test (D-79-02) with a failing mock `approve`.

*Existing infrastructure covers most cases; the auth mocks (`tests/helpers/device-flow-mock.ts`, `credential-mock.ts`, `git-mock.ts`) already exist and are reusable.*

## Security Domain

> `security_enforcement` is enabled (absent = enabled). This phase is auth/credential-handling — security is central.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | RFC-8628 OAuth Device Flow (`initiateDeviceFlow`), parameterized per provider. No password prompts; PUBLIC client_id only (no secret). |
| V3 Session Management | no | No sessions — a per-clone credential fetched from keychain or Device Flow, held in-memory only. |
| V4 Access Control | no | No authorization tier; the OAuth scope (`repo`) gates repo access at the provider. |
| V6 Cryptography | no (delegated) | Token storage delegated to the OS keychain via `git credential`; no crypto hand-rolled. TLS via isomorphic-git's `http/node`. |
| V7 Errors & Logging | yes | AUTH-09: access tokens MUST NEVER be interpolated into `notifyFn`/`new Error`/state.json. Enforced by `no-credential-leak.test.ts` — extend to every provider file (PROV-05). |
| V5 Input Validation | yes | `DeviceCodeResponse` fields are validated before use (`requestCodeImpl` throws on missing fields); `buildAttributeBlock` sanitizes host/username/password against control chars (WR-01, git-credential.ts:130-136). |

### Known Threat Patterns for provider-auth registry

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Access token leaked into user-visible output or state.json | Information Disclosure | AUTH-09 discipline + `no-credential-leak.test.ts` grep gate over EVERY provider file (PROV-05); tokens in-memory only. |
| Credential intended for host A sent to host B (cross-host leak) | Information Disclosure / Spoofing | Per-host provider lookup; NO bundle for a no-provider host (Pitfall 1); `approve`/`fill` key on the extracted host. |
| Infinite auth-retry loop against a challenging host | Denial of Service | CP-9: `onAuthFailure` always returns `{ cancel: true }`; no-provider path attaches NO onAuth (fail-clean, PROV-04). [VERIFIED: git.ts:420-433] |
| Credential-helper miss falls through to a TTY/browser prompt | Elevation / hang | `GIT_TERMINAL_PROMPT=0` + `GCM_INTERACTIVE=never` (git-credential.ts:85-87) — unchanged. Pi shows the Device Flow URL in its own UI. |
| Wire-format injection via a malicious host/token (newline-injected attribute) | Tampering | `sanitizeAttrValue` rejects `\r\n\0` in host/username/password (git-credential.ts:130-136) — unchanged, and now protects the extracted (non-literal) host. |
| Malicious provider descriptor pointing endpoints at an attacker | Spoofing | Descriptors are COMPILE-TIME constants (D-79-04, no user-editable config) — no injection surface in v1. PROV-07 (per-source declarations) is explicitly deferred. |

## Sources

### Primary (HIGH confidence — read end-to-end this session)
- `extensions/pi-claude-marketplace/domain/github-auth.ts` — the RFC-8628 engine; identified the 4 github-specific constants + the hardcoded credential mapping.
- `extensions/pi-claude-marketplace/platform/git-credential.ts` — `CredentialOps` is already host-keyed (fill/approve/reject take `host`; `buildAttributeBlock` writes `protocol=https\nhost=<host>`).
- `extensions/pi-claude-marketplace/platform/git.ts` — `buildAuthCallbacks` (fill→onAuthRequired→approve, CP-9 no-retry guard), `CloneOptions.auth?` (spread only when defined = public path when omitted), `resolveRemoteRef` (authless HEAD resolution).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` — the inline `host = "github.com"` auth block (:726-737); the `HttpError` 401/403 → `authentication required` classifier (:262); `addGitClonedInGuard`'s `...(auth !== undefined && { auth })` idiom; the cross-host-leak hazard note (:741-745).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` — the second inline `host = "github.com"` block (:375-395) threading `GitAuthBundle` into `refreshGitHubClone`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` — `GitAuthBundle` type, `GitOps` interface, `refreshGitHubClone` (auth forwarded to fetch).
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — `materializePluginClone` (NO auth param today — the single new seam); `resolvePluginPin`/`canonicalCloneUrl`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `InstallCloneCacheSeam` (typeof-import by name), `makeInstallCloneProbe` (:456), the git-source resolve wiring (:637).
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `resolveGitPluginRoot` seam + `GitPluginRootResult` union.
- `extensions/pi-claude-marketplace/domain/source.ts` — `UrlSource`/`GitSubdirSource` carry only `url` (no host field); github sources canonicalize to github.com.
- `tests/architecture/no-credential-leak.test.ts` — hardcoded file-list gate + `errorOrNotifyWithToken` regex (extend for PROV-05).
- `tests/architecture/no-orchestrator-network.test.ts` — the forbidden-symbol gate over install/reinstall/list/info.
- `.planning/workstreams/url-source/phases/78-plugin-git-source-lifecycle/78-RESEARCH.md` — network-gate map, seam patterns, `InstallCloneCacheSeam` precedent.

### Secondary (MEDIUM confidence)
- `.planning/workstreams/url-source/phases/79-provider-auth-registry/79-CONTEXT.md` — D-79-01..05 locked decisions.
- `.planning/workstreams/url-source/REQUIREMENTS.md` — PROV-01..05 texts; PROV-06 GitLab descriptor shape (device-flow config: endpoints, client_id, scope `read_repository`, credential mapping `oauth2`).

### Tertiary (LOW confidence — verify at planning)
- isomorphic-git `listServerRefs` auth-callback support (Open Q1 / A1) — must be checked against `node_modules/isomorphic-git/index.d.ts`.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; every touched file read this session.
- Architecture (parameterize engine + registry + thread auth): HIGH — the engine, credential surface, retry callbacks, and both clone seams all exist and were verified.
- Pitfalls: HIGH — the cross-host-leak, gate-trip, and byte-identity hazards are grounded in read source (add.ts hazard note, the two architecture gates, the three existing auth tests).
- Open Q1 (unpinned private HEAD resolution): MEDIUM — depends on unverified `listServerRefs` auth support.

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 (30 days — stable in-tree domain; no fast-moving external deps).
