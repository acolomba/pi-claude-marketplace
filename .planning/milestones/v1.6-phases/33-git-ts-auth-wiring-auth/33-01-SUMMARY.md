---
phase: 33-git-ts-auth-wiring-auth
plan: "01"
subsystem: platform/git
tags:
  [
    auth,
    device-flow,
    isomorphic-git,
    onauth,
    onauthfailure,
    cp-9,
    cp-10,
    platform-boundary,
    auth-attempted,
    discriminated-union,
    structural-typing,
    tdd,
  ]
dependency_graph:
  requires:
    - "Phase 31: CredentialOps interface (platform/git-credential.ts)"
    - "Phase 32: DeviceFlowResult shape (domain/github-auth.ts) -- structurally compatible target"
  provides:
    - buildAuthCallbacks
    - BuildAuthCallbacksOpts
    - AuthAttemptResult
    - OnAuthRequiredFn
    - CloneOptions.auth?
    - FetchOptions.auth?
  affects:
    - extensions/pi-claude-marketplace/platform/git.ts (modified -- additive only; existing exports unchanged)
    - tests/platform/git-auth-callbacks.test.ts (created)
tech_stack:
  added: []
  patterns:
    - "Discriminated AuthAttemptResult union (structurally identical to DeviceFlowResult; declared locally to honor platform/README.md boundary)"
    - "Closure-scoped deviceFlowAttempted flag (set on DF success; reference-only -- onAuthFailure cancels unconditionally per CP-9)"
    - "Try/catch-to-cancel CP-10 discipline at every callback boundary (no raw exception escape into isomorphic-git)"
    - "Conditional spread on optional auth bundle (prevailing platform/git.ts idiom -- mirrors opts.ref / opts.singleBranch handling)"
    - "Function-parameter contravariance bridge via `as git.AuthFailureCallback` cast at the isomorphic-git boundary (GitAuth uses `string | undefined`; GitCredentials uses `string?` -- runtime shapes identical)"
key_files:
  created:
    - tests/platform/git-auth-callbacks.test.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
decisions:
  - "Local AuthAttemptResult discriminated union (NOT imported from domain/github-auth.ts) to honor platform/README.md import boundary -- structural typing covers the structural equivalence to DeviceFlowResult"
  - "Closure-scoped deviceFlowAttempted flag set on DF success only; onAuthFailure cancels unconditionally regardless of the flag value (CP-9 retry-loop guard is not gated on the flag because inline DF retry from this seam would re-enter the same code path)"
  - "Cast onAuthFailure to git.AuthFailureCallback at the isomorphic-git boundary -- required by exactOptionalPropertyTypes + function-parameter contravariance; the cast is mechanical (runtime shapes identical) and ESLint accepts the single-step `as` form for onAuthFailure; onAuth needs no cast (no contravariant GitAuth slot in its signature)"
  - "Phase 33 ships only the surface -- no GitOps threading (Phase 34) and no orchestrator call-site wiring (Phase 35). Acceptance criterion enforces the leak-free invariant via grep."
metrics:
  duration: "~10 minutes"
  completed: "2026-06-01"
  tasks_completed: 3
  files_modified: 1
  files_created: 1
  test_count_added: 8
  npm_run_check_test_count: "1301 / 1301"
---

# Phase 33 Plan 01: platform/git.ts auth-callback assembly Summary

Phase 33 ships the isomorphic-git auth-callback factory inside
`platform/git.ts`. `buildAuthCallbacks(opts)` returns the
`{ onAuth, onAuthFailure }` pair consumed by `git.clone` / `git.fetch`,
with CP-9 (no infinite retry) and CP-10 (no raw exception escape)
discipline locked in unit tests. `CloneOptions.auth?` and
`FetchOptions.auth?` extend the existing surface as an additive optional
bundle; behavior is byte-identical to the pre-v1.6 public-only path when
`opts.auth` is omitted.

## Tasks Completed

| Task | Name                                                                  | Status   | Commit  |
| ---- | --------------------------------------------------------------------- | -------- | ------- |
| 1    | platform/git.ts -- types + buildAuthCallbacks + CloneOptions.auth?    | Complete | 80606f2 |
| 2    | tests/platform/git-auth-callbacks.test.ts -- 8 unit tests             | Complete | 80606f2 |
| 3    | `npm run check` GREEN gate                                            | Complete | 80606f2 |

All three tasks land in a single atomic commit. The TypeScript RED
window across Tasks 1 + 2 (the test file imports the production types
that Task 1 introduces) is bridged by the atomic commit, matching the
Phase 31 / 32 pattern.

## Public Surface (for Phase 34 readers)

```ts
// extensions/pi-claude-marketplace/platform/git.ts

/**
 * Phase 33 discriminated result returned by an `onAuthRequired` closure.
 * Both arms carry `authAttempted: true` so onAuthFailure can detect that
 * interactive auth has already happened (CP-9 retry-loop guard).
 *
 * Structurally identical to `domain/github-auth.ts::DeviceFlowResult`.
 * Declared LOCALLY here to honor platform/README.md (no platform ->
 * domain import). Phase 35 passes `initiateDeviceFlow` directly as
 * `onAuthRequired`; structural typing accepts the assignment.
 */
export type AuthAttemptResult =
  | { ok: true; cred: GitCredentials; authAttempted: true }
  | { ok: false; reason: string; authAttempted: true };

/** Caller-supplied closure -- Phase 35 binds host/credentialOps/notifyFn upstream. */
export type OnAuthRequiredFn = () => Promise<AuthAttemptResult>;

export interface BuildAuthCallbacksOpts {
  credentialOps: CredentialOps;
  host: string;
  onAuthRequired: OnAuthRequiredFn;
}

/**
 * Build the { onAuth, onAuthFailure } pair consumed by isomorphic-git.
 *
 * - onAuth: fill -> hit returns cred (AUTH-02 silent reuse); miss invokes
 *   onAuthRequired and returns its cred on ok, { cancel: true } on !ok.
 * - onAuthFailure: rejects the stale cred and ALWAYS returns
 *   { cancel: true } (CP-9 -- retrying inline would re-enter the same
 *   code path and loop forever).
 * - CP-10: try/catch wraps both bodies; any throw becomes { cancel: true }.
 *   Error messages are dropped on the floor (AUTH-09 -- a credential
 *   could be interpolated into an upstream Error).
 */
export function buildAuthCallbacks(opts: BuildAuthCallbacksOpts): {
  onAuth: (url: string) => Promise<GitCredentials>;
  onAuthFailure: (url: string, cred: GitCredentials) => Promise<GitCredentials>;
};

// Existing CloneOptions / FetchOptions interfaces extended with one
// optional bundle field (additive; pre-v1.6 callers byte-identical):
export interface CloneOptions {
  dir: string;
  url: string;
  ref?: string;
  singleBranch?: boolean;
  auth?: { credentialOps: CredentialOps; host: string; onAuthRequired: OnAuthRequiredFn };
}

export interface FetchOptions {
  auth?: { credentialOps: CredentialOps; host: string; onAuthRequired: OnAuthRequiredFn };
  dir: string;
  remote?: string;
  ref?: string;
}
```

## Phase 34 consumer pattern (preview)

Phase 34 will widen `GitOps` (in `orchestrators/marketplace/shared.ts`)
to accept an `onAuthRequired` closure and a host, building the
`opts.auth` bundle inside `DEFAULT_GIT_OPS.clone` / `.fetch`. The
mechanical pattern looks like:

```ts
// orchestrators/marketplace/shared.ts (Phase 34 -- NOT this plan)
export interface GitOps {
  clone(opts: {
    dir: string;
    url: string;
    ref?: string;
    singleBranch?: boolean;
    onAuthRequired?: OnAuthRequiredFn;
    host?: string;            // bare host for credentialOps key
  }): Promise<void>;
  fetch(opts: {
    dir: string;
    remote?: string;
    ref?: string;
    onAuthRequired?: OnAuthRequiredFn;
    host?: string;
  }): Promise<void>;
  // ... existing forceUpdateRef / checkout / resolveRef / currentBranch unchanged
}

export const DEFAULT_GIT_OPS: GitOps = {
  clone: async (o) => {
    await defaultGit.clone({
      dir: o.dir,
      url: o.url,
      ...(o.ref !== undefined && { ref: o.ref }),
      ...(o.singleBranch !== undefined && { singleBranch: o.singleBranch }),
      ...(o.onAuthRequired !== undefined &&
        o.host !== undefined && {
          auth: {
            credentialOps: DEFAULT_CREDENTIAL_OPS,
            host: o.host,
            onAuthRequired: o.onAuthRequired,
          },
        }),
    });
  },
  // ... fetch mirrors clone
};
```

Phase 35 then wires `add.ts` and `update.ts` to build the
`onAuthRequired` closure via
`() => initiateDeviceFlow({ host, credentialOps, notifyFn })`. The
local `AuthAttemptResult` type is structurally identical to
`DeviceFlowResult`, so the assignment `onAuthRequired: initiateDeviceFlow`
type-checks with no adapter.

## Requirements -> Test Map

| Requirement | Phase 33 Behavior                                                                                | Test                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| AUTH-01     | onAuth invokes Device Flow (`onAuthRequired`) on credentialOps.fill miss                         | Test 2 -- "fill-miss + DF ok returns Device-Flow credential (SC-1)"                   |
| AUTH-01     | onAuth returns { cancel: true } when Device Flow declines                                        | Test 3 -- "fill-miss + DF !ok returns { cancel: true }"                               |
| AUTH-02     | onAuth returns stored credential silently when credentialOps.fill hits (no Device Flow)          | Test 1 -- "fill-hit returns stored credential without invoking onAuthRequired (SC-1)" |
| CP-9 / SC-2 | onAuthFailure ALWAYS returns { cancel: true } and calls credentialOps.reject (post-DF case)      | Test 5 -- "onAuthFailure post-DF-attempt rejects + cancels (CP-9 / SC-2)"             |
| CP-9        | onAuthFailure cancels and rejects even when no Device Flow has run yet (stale-keychain case)     | Test 6 -- "onAuthFailure pre-DF stale-keychain rejects + cancels (CP-9)"              |
| CP-10 / SC-3 | onAuth converts a thrown credentialOps.fill error into { cancel: true } (no propagation)        | Test 4 -- "fill throws -- onAuth returns { cancel: true } (CP-10)"                    |
| CP-10 / SC-3 | onAuthFailure converts a thrown credentialOps.reject error into { cancel: true }                | Test 7 -- "reject throws -- onAuthFailure still returns { cancel: true } (CP-10)"     |
| CP-10 / SC-3 | onAuth converts a thrown `onAuthRequired` closure error into { cancel: true }                   | Test 8 -- "onAuthRequired throws -- onAuth returns { cancel: true } (CP-10)"          |

## Architecture Boundary Compliance

- `platform/git.ts` imports:
  - `node:fs` (built-in)
  - `isomorphic-git` + `isomorphic-git/http/node` (existing platform-tier surface)
  - `./git-credential.ts` (sibling platform/ file -- type-only, for `CredentialOps`)
- `platform/git.ts` does NOT import from `domain/`, `orchestrators/`,
  `edge/`, `bridges/`, `transaction/`, `persistence/`, `presentation/`.
  Verified via `grep -v '^[[:space:]]*\(//\|\*\|/\*\)' ... | grep -cE 'from\s+"\.\./(domain|orchestrators|edge|bridges|transaction|persistence|presentation)/'` -> 0.
- `extensions/pi-claude-marketplace/platform/README.md` byte-unchanged.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`
  byte-unchanged. `GitOps` interface retains the Phase-32 shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript contravariance bridge cast at isomorphic-git boundary**

- **Found during:** Task 1 (initial tsc --noEmit run)
- **Issue:** Passing `cbs.onAuthFailure: (url, cred: GitCredentials) -> Promise<GitCredentials>` directly into `git.clone({ onAuthFailure })` failed type-check under `exactOptionalPropertyTypes: true`. isomorphic-git's `AuthFailureCallback` expects `auth: GitAuth` where optional fields are `string | undefined` (explicit-undefined); our `GitCredentials` uses `string?` (optional, no `| undefined`). Function-parameter contravariance forbids the assignment.
- **Fix:** Added `as git.AuthFailureCallback` cast at the call site inside `clone()` and `fetch()` only -- the public `buildAuthCallbacks` signature stays exactly as the plan specifies. `onAuth` needed no cast (it takes only `url: string`, no contravariant slot). ESLint accepts the single-step `as` form (rejected `as unknown as` as over-cast). Comment in the file documents why the cast is structural-only.
- **Files modified:** extensions/pi-claude-marketplace/platform/git.ts (`clone()` / `fetch()` wiring)
- **Commit:** 80606f2

### Rule 4 (architectural changes)

None. The plan's surface design held without modification.

## Self-Check

- [x] `extensions/pi-claude-marketplace/platform/git.ts` exists and exports `buildAuthCallbacks`, `BuildAuthCallbacksOpts`, `AuthAttemptResult`, `OnAuthRequiredFn` (4 grep hits exactly).
- [x] `CloneOptions.auth?` and `FetchOptions.auth?` are optional bundles (`auth?:` grep hits 2).
- [x] `tests/platform/git-auth-callbacks.test.ts` exists with 8 `test(...)` blocks (>=7 required).
- [x] `node --test tests/platform/git-auth-callbacks.test.ts` -> 8 pass / 0 fail.
- [x] `npm run check` exits 0 -- 1301 / 1301 tests pass (full suite: typecheck + lint + format + tests).
- [x] `npx tsc --noEmit` exits 0.
- [x] `npx eslint extensions/pi-claude-marketplace/platform/git.ts tests/platform/git-auth-callbacks.test.ts` exits 0.
- [x] `npx prettier --check extensions/pi-claude-marketplace/platform/git.ts tests/platform/git-auth-callbacks.test.ts` exits 0.
- [x] `platform/git.ts` has zero non-comment imports from `../domain/`, `../orchestrators/`, `../edge/`, `../bridges/`, `../transaction/`, `../persistence/`, `../presentation/`.
- [x] `orchestrators/marketplace/shared.ts` is byte-unchanged (`git diff --stat` empty).
- [x] `platform/README.md` is byte-unchanged.
- [x] No production call site outside `platform/git.ts` references `buildAuthCallbacks`, `AuthAttemptResult`, or `OnAuthRequiredFn` (the one grep hit in `domain/github-auth.ts` is the pre-existing Phase 32 forward-reference comment, not an import).
- [x] Trufflehog scan clean (run from main checkout per CLAUDE.md; worktree run is blocked by the auto-updater spawn issue but the underlying scan passes).
- [x] Commit subject + body follow Conventional Commits + reference AUTH-01 / AUTH-02 / CP-9 / CP-10.
- [x] Commit SHA: 80606f2 (single atomic commit).
- [x] Diff scope: exactly the two files in `files_modified`.

## Self-Check: PASSED
