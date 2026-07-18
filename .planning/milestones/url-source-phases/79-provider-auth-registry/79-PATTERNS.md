# Phase 79: Provider-auth registry - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 9 (2 new, 7 modified)
**Analogs found:** 9 / 9

All analogs are IN-TREE and were read this session. Phase 79 is a
parameterization + wiring phase: every file it touches copies from a sibling
that already exists. There are NO no-analog files.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `domain/auth-registry.ts` (NEW) | domain data/lookup | transform (host→descriptor) | `domain/source.ts` (const table + parse/lookup fn) | role-match |
| `domain/github-auth.ts` (MODIFY: engine parameterized by descriptor) | domain service | request-response (RFC-8628 poll) | itself (in-place refactor; constants → descriptor fields) | exact (self) |
| orchestrator auth helper `buildAuthForHost` (NEW, likely in `clone-cache.ts` or a domain/orch sibling) | orchestrator helper | transform (host→GitAuthBundle) | `add.ts::addGithubInGuard` (:711-737) | exact |
| `orchestrators/marketplace/add.ts` (MODIFY: replace inline `host="github.com"`) | orchestrator | request-response | itself (:726-737 inline block) | exact (self) |
| `orchestrators/marketplace/update.ts` (MODIFY: replace inline `host="github.com"`) | orchestrator | request-response | itself (:375-385 inline block) | exact (self) |
| `orchestrators/plugin/clone-cache.ts` (MODIFY: add `auth?` to `materializePluginClone`) | orchestrator seam | file-I/O + request-response (clone) | `add.ts::addGitClonedInGuard` (:632-637 auth spread) | exact |
| `orchestrators/plugin/install.ts` (MODIFY: thread `auth?` through seam + memo) | orchestrator | request-response | itself (`makeInstallCloneProbe` :456-492 + `InstallCloneCacheSeam` :378-380) | exact (self) |
| no-provider cause line (in `add.ts` classifier region + plugin equiv) | orchestrator classifier | request-response | `add.ts` classifier (:261-264) + `shared/errors.ts` cause-chain (:99-119) | exact |
| `tests/architecture/no-credential-leak.test.ts` (MODIFY: extend file list) | test (architecture gate) | batch (file scan) | itself (:47-52 file constants, :104-135 gate) | exact (self) |

## Pattern Assignments

### `domain/auth-registry.ts` (NEW — domain data/lookup)

**Analog:** `domain/source.ts` — a const-driven parse/lookup module in the same
tier (a discriminated-union table + a pure lookup function, no I/O). The
descriptor interface + `GITHUB_PROVIDER` const + `findProviderForHost` shape is
fully specified in 79-RESEARCH.md §"Pattern 1" (lines 148-187) — copy that
verbatim.

**Descriptor-field source (what to promote from `github-auth.ts`):**
```typescript
// github-auth.ts current github-specific constants → become descriptor fields:
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";       // :136
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"; // :137
const GITHUB_OAUTH_CLIENT_ID = "Ov23liNcyK08uGdU0mMl";                        // :144
const REQUESTED_SCOPE = "repo";                                                // :147
// hardcoded credential mapping in runPollLoop success arm (:315):
const cred: GitCredentials = { username: "x-access-token", password: r.accessToken };
```
These five values are the ONLY github-specific surface. Promote to
`{ deviceCodeUrl, tokenUrl, clientId, scope, credentialFrom }`. The `GITHUB_PROVIDER`
descriptor supplies the EXACT literals above → byte-identity (success criterion 1).

**GitCredentials type import** (from `platform/git.ts`, as github-auth.ts:47 does):
```typescript
import type { GitCredentials } from "../platform/git.ts";
```

---

### `domain/github-auth.ts` (MODIFY — engine parameterized by descriptor)

**Analog:** itself. In-place refactor; the poll loop, deadline math, slow_down
+5, notify string stay UNCHANGED (byte-identity, Pitfall 4).

**Where the four constants are read today (thread the descriptor here instead):**
- `requestCodeImpl` (:149-178) reads `GITHUB_DEVICE_CODE_URL`; parameterize the URL arg (79-RESEARCH §"Code Examples" :356-370).
- `pollTokenImpl` (:180-254) reads `GITHUB_ACCESS_TOKEN_URL`; parameterize the URL.
- `safePollToken` (:283) + `initiateDeviceFlow` (:365) pass `GITHUB_OAUTH_CLIENT_ID` + `REQUESTED_SCOPE` → read from descriptor.
- `runPollLoop` success arm (:315) hardcodes the credential mapping → replace with `opts.provider.credentialFrom(r.accessToken)`.

**Add `provider` to the opts interface** (mirror the existing `InitiateDeviceFlowOpts` at :114-125):
```typescript
export interface InitiateDeviceFlowOpts {
  provider: GitAuthProvider;   // NEW — supplies endpoints/client_id/scope/credentialFrom
  host: string;
  credentialOps: CredentialOps;
  notifyFn: NotifyFn;
  http?: DeviceFlowHttp;
  signal?: AbortSignal;
}
```

**The `approve` call already host-keyed** (:316) — no change:
```typescript
await opts.credentialOps.approve(opts.host, cred);
```

**AUTH-09 discipline (KEEP):** every `notifyFn(...)`/`new Error(...)` interpolates
only status codes / user_code / verification_uri — NEVER `access_token`/`cred.*`/
`r.accessToken` (:315, :376). The no-credential-leak gate enforces this.

---

### orchestrator auth helper `buildAuthForHost` (NEW)

**Analog:** `add.ts::addGithubInGuard` (:711-738) — the EXACT block being generalized.

**Current inline block to copy the shape from** (add.ts:726-737):
```typescript
const host = "github.com";
const notifyFn = makeRawNotifyFn(ctx);
const onAuthRequired = async (): Promise<AuthAttemptResult> =>
  initiateDeviceFlow({
    host,
    credentialOps,
    notifyFn,
    ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
  });
const auth: GitAuthBundle = { credentialOps, host, onAuthRequired };
```

**Generalize to** (79-RESEARCH §"Pattern 2" :199-221): swap the literal `host`
for the extracted host, gate the whole bundle on `findProviderForHost(host)`, and
add `provider` to the `initiateDeviceFlow` call. Return `undefined` when no
provider matches (PROV-04 — Pitfall 1: NO bundle for a no-provider host).

**GitAuthBundle type** (from `marketplace/shared.ts` :76-80):
```typescript
export interface GitAuthBundle {
  readonly credentialOps: CredentialOps;
  readonly host: string;
  readonly onAuthRequired: OnAuthRequiredFn;
}
```

**Host extraction** (79-RESEARCH: `new URL(cloneUrl).host`; github sources
canonicalize to `"github.com"` without a URL parse — `UrlSource`/`GitSubdirSource`
carry only `url`, no host field, verified at `domain/source.ts` :39-51).

**Gate compliance:** this helper imports only `findProviderForHost` (domain),
`initiateDeviceFlow` (domain), `makeRawNotifyFn` (shared), `CredentialOps`
(platform/git-credential — NOT platform/git). It must NEVER name `gitOps`/
`platform/git`/`DEFAULT_GIT_OPS` if it lives in / is imported by install.ts
(Pitfall 2).

---

### `orchestrators/marketplace/add.ts` + `update.ts` (MODIFY — replace inline blocks)

**Analog:** self. Replace the inline `const host = "github.com"; ...` at
add.ts:726-737 and update.ts:375-385 with a `buildAuthForHost(...)` call, then
spread the result (undefined = authless):
```typescript
const auth = buildAuthForHost({ host, credentialOps, ctx, ...(deviceFlowHttp !== undefined && { deviceFlowHttp }) });
// then, at the clone/refresh call:
...(auth !== undefined && { auth })
```

**The auth-spread idiom already in place** (add.ts::addGitClonedInGuard :632-637):
```typescript
await gitOps.clone({
  dir: stagingDir,
  url: cloneUrl,
  ...(source.ref !== undefined && { ref: source.ref, singleBranch: true }),
  ...(auth !== undefined && { auth }),
});
```

---

### `orchestrators/plugin/clone-cache.ts` (MODIFY — add `auth?` to materializePluginClone)

**Analog:** `add.ts::addGitClonedInGuard` (:632-637 auth spread) — the identical
`...(auth !== undefined && { auth })` idiom.

**Current signature** (clone-cache.ts:54-79, `auth` intentionally omitted, D-77-06):
```typescript
export async function materializePluginClone(args: {
  locations: ScopedLocations;
  cloneUrl: string;
  pin: string;
  ref?: string;
  gitOps?: GitOps;
}): Promise<string> {
  // ...
  await gitOps.clone({
    dir: stagingDir,
    url: args.cloneUrl,
    ...(args.ref !== undefined && { ref: args.ref, singleBranch: true }),
  });
```

**Add** `auth?: GitAuthBundle` to the args and spread it into the clone
(79-RESEARCH §"Pattern 4" :241-260). `undefined` = byte-identical to today.
`GitAuthBundle` is already re-exported from `marketplace/shared.ts` (clone-cache
already imports `GitOps` from there — same import site).

---

### `orchestrators/plugin/install.ts` (MODIFY — thread auth through seam + memo)

**Analog:** self. `InstallCloneCacheSeam` (:378-380) + `makeInstallCloneProbe`
(:456-492) already forward args to `materializePluginClone` BY NAME. Add an
optional `auth?` param that `makeInstallCloneProbe` forwards:
```typescript
// current call (install.ts :468-473):
const cloneRoot = await seam.materializePluginClone({
  locations,
  cloneUrl,
  pin,
  ...(ref !== undefined && { ref }),
  // NEW: ...(auth !== undefined && { auth })
});
```
`install.ts` builds the bundle via `buildAuthForHost` (domain/shared imports
only — NEVER `gitOps`, Pitfall 2). The bundle reaches the clone through the
seam, not through a git import.

**Once-per-host memo (D-79-02):** a command-scope `Map<host, AuthAttemptResult>`
captured in the bulk-install caller closure, consulted inside `onAuthRequired`
BEFORE running the flow (79-RESEARCH §"Pattern 5" :270-276). First success/failure
stores; subsequent items reuse — no re-prompt. Belt-and-braces against the
best-effort `approve` swallow (git-credential.ts approve is best-effort).

---

### No-provider cause line (MODIFY — add.ts classifier region + plugin equivalent)

**Analog:** the existing classifier + cause-chain helper.

**The 401/403 → `authentication required` classifier already exists** (add.ts:261-264):
```typescript
const statusCode = (err as { data?: { statusCode?: number } }).data?.statusCode;
if (code === "HttpError" && (statusCode === 401 || statusCode === 403)) {
  return "authentication required";
}
```
D-79-03: KEEP this token unchanged (no new REASONS token). Append ONE cause line
`no auth provider is registered for <host>` via `Error.cause`, so the depth-5
`causeChainTrailer` walker (`shared/errors.ts` :43-119) renders it. Attach it at
the point host is known and `findProviderForHost` missed (where the bundle would
have been built). No supported-hosts list (D-79-03).

**Cause-chain composition helper** (`shared/errors.ts` :99-119):
```typescript
export function composeErrorWithCauseChain(err: unknown): string { /* trailer walk */ }
// and the Error.cause attach idiom:
return new Error(`${baseError.message} (additionally: ${leak})`, { cause: baseError });
```

---

### `tests/architecture/no-credential-leak.test.ts` (MODIFY — extend file list)

**Analog:** self. The gate uses hardcoded file constants + the
`errorOrNotifyWithToken` regex (:104-135). Add every NEW provider file to the
scanned list (PROV-05, Pitfall 6).

**File constants to extend** (:45-52):
```typescript
const GITHUB_AUTH_FILE = "extensions/pi-claude-marketplace/domain/github-auth.ts";
const PHASE_35_ORCHESTRATOR_FILES = [ "...add.ts", "...update.ts" ];
```
Add `domain/auth-registry.ts` (+ any split engine file, e.g. `device-flow.ts`)
to a scanned array and apply the same `errorOrNotifyWithToken` regex (:128-134).
If `github-auth.ts` is renamed, update `GITHUB_AUTH_FILE`.

**The gate's regex to reuse** (:128-129):
```typescript
const errorOrNotifyWithToken =
  /(new\s+Error\s*\(|notifyFn\s*\()(?:[^)]*\$\{[^}]*(access_?token|cred\.[a-z]+|r\.accessToken)|[^)]*\+\s*(access_?token|cred\.[a-z]+|r\.accessToken))/i;
```

## Shared Patterns

### Host-keyed credentials (already satisfied)
**Source:** `platform/git-credential.ts` `CredentialOps` (:60-67)
**Apply to:** every auth call site
```typescript
fill(host: string): Promise<GitCredentials | null>;
approve(host: string, cred: GitCredentials): Promise<void>;
reject(host: string, cred: GitCredentials): Promise<void>;
```
Already host-parameterized. Callers just stop hardcoding `"github.com"`. NO change
to this file; D-79-05 rotation (`reject→flow→approve→retry-once`) is already the
`onAuthFailure→next-onAuth` behavior in `platform/git.ts::buildAuthCallbacks`.

### Auth-spread public/authed branching
**Source:** `add.ts::addGitClonedInGuard` (:636)
**Apply to:** every clone/fetch call site (marketplace + plugin)
```typescript
...(auth !== undefined && { auth })
```
Omitting the bundle IS the public path — `platform/git.ts::clone` attaches
`onAuth`/`onAuthFailure` ONLY when `opts.auth` is defined. No-provider host → no
bundle → authless → clean 401 (PROV-04, no retry loop — structural).

### AUTH-09 no-credential-leak discipline
**Source:** `github-auth.ts` (:159-163 status-only Error; :374-376 user_code/uri-only notify)
**Apply to:** every provider file (engine, registry, orch helper)
Interpolate ONLY status codes / user_code / verification_uri into `notifyFn`/
`new Error`. NEVER `access_token`/`cred.*`/`r.accessToken`. Enforced by the gate.

### No-orchestrator-network gate compliance
**Source:** `clone-cache.ts` header (:1-9) + `InstallCloneCacheSeam` (install.ts:378-380)
**Apply to:** install.ts / reinstall.ts auth wiring
`install.ts` MUST NOT name `gitOps`/`platform/git`/`DEFAULT_GIT_OPS`. The auth
bundle reaches the clone through the seam BY NAME; the bundle is built from
domain + shared + `platform/git-credential` imports (none forbidden).

## No Analog Found

None. Every file copies from an in-tree sibling.

## Open Items for Planner (from RESEARCH Open Questions)

- **Q1 (design-affecting):** unpinned private-repo HEAD resolution — does
  `resolveRemoteRef`/`listServerRefs` accept `onAuth`? Check
  `node_modules/isomorphic-git/index.d.ts`. If yes, thread the bundle; if no,
  document "unpinned private repos require a sha pin" (Pitfall 5). Pinned repos
  are unaffected.
- **Q2:** `URL.host` vs `URL.hostname` for the credential key (moot for github.com;
  use `.host`, verify no port surprise).
- **Q3:** does reinstall's cold-cache re-clone thread auth? (Recommend yes;
  costs nothing on warm path.)

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,platform,orchestrators}`, `tests/architecture`
**Files scanned:** github-auth.ts, auth-registry (spec'd in RESEARCH), clone-cache.ts, add.ts, update.ts, marketplace/shared.ts, install.ts, git-credential.ts, source.ts, errors.ts, no-credential-leak.test.ts
**Pattern extraction date:** 2026-07-11
