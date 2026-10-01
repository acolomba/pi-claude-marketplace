# Phase 1: Private repos on any git host - Context

**Gathered:** 2026-09-25
**Status:** Ready for planning
**Mode:** Interactive discuss (autonomous run)

<domain>
## Phase Boundary

A Pi user can clone a private marketplace or plugin source over https from any git host using a
credential already in their git credential helper — no hostname is added to any registry for it to
work — and that credential is never offered to a host other than the one it was resolved for.

In scope: `domain/auth-registry.ts`, `orchestrators/auth-host.ts`,
`platform/git-auth-callbacks.ts`, and the `NO_PROVIDER_CAUSE` consumer in
`orchestrators/marketplace/update.ts`.

Out of scope: the `.git`-suffix URL fallback (Phase 2) and `marketplace add` leftover-clone
adoption (Phase 3). No new hostname literal enters `domain/auth-registry.ts` — not now, not as a
"temporary" test fixture in production code.

</domain>

<decisions>
## Implementation Decisions

### D-1-01 — `buildAuthForHost` always returns a bundle (operator decision)

The provider registry stops gating whether auth is attempted and gates only the Device Flow
closure:

- provider found -> `onAuthRequired` runs that provider's Device Flow, exactly as today;
- no provider -> `onAuthRequired` resolves `{ ok: false, reason: NO_STORED_CREDENTIAL_CAUSE(host),
  authAttempted: true }`.

Either way the bundle exists, so `buildAuthCallbacks` runs and its fill-first path consults
`credentialOps.fill(host)` before anything else. That fill path is already written, already
non-interactive (`GIT_TERMINAL_PROMPT=0`, `GCM_INTERACTIVE=never`) and already returns null on a
miss — GAUTH-03 is reaching it, not building it.

### D-1-02 — the no-credential miss surfaces as an ERROR with a cause line (operator decision)

The operation was not carried out, so under the project's tri-state severity model that is `error`,
not `warning`. PR #153 used `notifyFn(..., "warning")` from inside `buildAuthForHost`; both the
severity and the seam are wrong here.

Follow the existing house mechanism instead of adding a notify: `update.ts:418` already attaches
`NO_PROVIDER_CAUSE(host)` as `err.cause` on an auth-challenge error, as the chain TAIL, keeping the
transport error at cause-depth 1 where `transportReason` classifies it. `NO_STORED_CREDENTIAL_CAUSE`
rides the same path. `auth-host.ts` stays a state producer and emits no notification of its own.

### D-1-03 — the host guard lives in `onAuth` (operator decision)

`buildAuthCallbacks.onAuth` compares `new URL(url).host` against `opts.host` and returns
`{ cancel: true }` on a mismatch, routing the reason through `hookDebugLog` like the other
non-success paths. This makes the `url` parameter — ignored today, named `_url` — load-bearing.

### D-1-04 — `NO_PROVIDER_CAUSE` is retired, not kept alongside

After D-1-01 the sentence "no auth provider is registered for {host}" no longer describes what
happens: authentication IS attempted, through the credential helper. Keeping both cause lines would
leave one that can never be true. Retire `NO_PROVIDER_CAUSE` and its test, and replace its one call
site. If planning finds a residual case where it is still accurate, say so explicitly rather than
keeping it by default.

### Claude's discretion

Naming, file placement within the existing tiers, test layout, and how the cause line is worded
beyond "names `git credential approve`".

</decisions>

<code_context>
## Existing Code Insights

**The defect.** `orchestrators/auth-host.ts:106-110` returns `undefined` when
`findProviderForHost(host)` misses. `platform/git.ts::clone|fetch|resolveRemoteRef` build auth
callbacks only when `opts.auth !== undefined`, so a miss means `buildAuthCallbacks` never runs and
`credentialOps.fill(host)` is never called. The registry holds two hosts.

**Why removing PROV-04 is safe — verified during scoping, not assumed.**

- `onAuth(url, ...)` is invoked by isomorphic-git only from `discover` on a 401/203, always with the
  caller's own URL (`node_modules/isomorphic-git/index.cjs:9470`). Redirects never reach it.
- `simple-get@4.0.1` deletes `authorization` and `cookie` before following a cross-host redirect
  (`node_modules/simple-get/index.js:57-60`).
- `credentialFill` emits `protocol=https` + `host=` and explicitly never a `path=` line
  (`platform/git-credential.ts:194-199`), so `git credential fill` is strictly host-keyed.

So PROV-04 / T-79-04 was never what prevented a transport-level leak. What it did do is cap at two
hosts the blast radius of a bundle whose bound `host` disagrees with the URL being cloned. D-1-03
replaces that cap with a direct check. Record this reasoning in the docstrings — the next reader
will otherwise see a security guard being deleted with no replacement rationale.

**Known hazard — the cause line can silently stop attaching.** `update.ts:418` guards on
`auth === undefined && isAuthChallengeError(err)`. Both halves break under D-1-01:

1. `auth` is never `undefined` any more, so the condition is dead as written.
2. `isAuthChallengeError` (`update.ts:375-383`) matches only `code === "HttpError"` with
   statusCode 401/403. When `onAuth` returns `{ cancel: true }`, isomorphic-git throws
   `UserCanceledError` instead — a different error identity. A fix that only swaps the cause
   constant will compile, pass a naive test, and attach nothing at runtime.

The plan must show the cause line arriving on the real failure path, not just that the constant
exists. The same question applies to the `add` and `install` paths, which have no equivalent
attachment site today.

**Tier rules that constrain the fix.** `auth-host.ts` may not import `platform/git.ts` as a VALUE
(no-orchestrator-network gate; type-only is fine). `platform/git-auth-callbacks.ts` may import from
`shared/` only — it declares `AuthAttemptResult` locally rather than importing the structurally
identical `DeviceFlowResult` from `domain/`, and that must stay true.

**AUTH-09.** `tests/architecture/no-credential-leak.test.ts` forbids interpolating any credential
field into an `Error` or a notification. The new cause line names only a host and a command.

</code_context>

<specifics>
## Specific Ideas

- Keep `GitAuthProvider` a single interface if nothing needs a discriminant. PR #153 split it into
  `DeviceFlowProvider | StoredCredentialProvider` on a `kind` field only because it needed a
  registry entry for the no-Device-Flow case. D-1-01 removes that need: the absence of a provider
  IS the stored-credential case. Introduce a discriminant only if something else forces it.
- `GITHUB_PROVIDER` / `GITLAB_PROVIDER` and the Device Flow engine should not change at all.
  GAUTH-05 is a no-regression requirement; the smaller the diff there, the easier it is to show.
- The `authMemo` currently caches per host across a command. Confirm a no-provider failure memoizes
  the same way a Device Flow failure does, so one command does not re-run `git credential fill`
  once per source.

</specifics>

<deferred>
## Deferred Ideas

- Per-source or runtime provider configuration (PROV-07) stays deferred.
- SSH transport stays out — isomorphic-git is https-only here by D-18/D-21.

</deferred>
