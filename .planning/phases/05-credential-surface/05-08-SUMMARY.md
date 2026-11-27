---
phase: 05-credential-surface
plan: 08
subsystem: credentials
tags: [system-git, credentials, device-flow, removal, platform]

requires:
  - phase: 05-credential-surface
    provides: "05-06 removed Device Flow, so no builder makes a `device-flow` bundle"
provides:
  - "`GitAuthBundle` with the stored-credential arm only"
  - "`runWithAuthBundle` with one failure mapping and no second git run"
  - "`lacksStoredCredential(err)`, which reads only the failure"
  - "The credential leak registry without the deleted one-shot module"
affects: [05-10, 05-12, credential surface]

actuals:
  tokens: 16026
  tasks: 2
  commits: 1
plan_head_before: eb5241222cd76b96531994580683b8a16b6565c3
plan_head_after: 6d196d4434876b8eefbd3a739a97515f6e3c7fee

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/platform/git-credential.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - test/platform/git.test.ts
    - test/platform/git-ops-fake.test.ts
    - test/orchestrators/marketplace/shared.test.ts
    - test/architecture/gate-targets.ts
    - test/architecture/no-credential-leak.test.ts
  deleted:
    - extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts
    - test/platform/git-one-shot-credential.test.ts

key-decisions:
  - "Tasks 1 and 2 share one commit: with the module deleted and the registry unchanged, the hook's architecture run fails `AUTH-09: the git hookDebugLog calls never interpolate a credential field`"
  - "`GitAuthBundle` is now an interface with one arm (`kind`, `credentialOps`, `host`); 05-10 shrinks it to its host"
  - "`bundleOrigin` stays as it was; `runWithAuthBundle` maps a `rejected` https-auth failure only when it returns an origin (D-1-03)"

patterns-established: []

requirements-completed: [SG-AUTH-01, SG-AUTH-03]

coverage:
  - id: D1
    description: "`runWithAuthBundle` runs a request once; a `rejected` https-auth failure of a request to the bundle's own host becomes `StoredCredentialRejectedError(host, { cause })`, and every other failure is thrown as it failed"
    requirement: SG-AUTH-03
    verification:
      - kind: unit
        ref: "test/platform/git.test.ts#GAUTH-04 and D-1-03: an auth failure of a remote request (7 cases)"
        status: pass
      - kind: unit
        ref: "test/platform/git.test.ts#RESV-03, GAUTH-04: the supplied bundle maps an auth failure of the listing"
        status: pass
      - kind: other
        ref: "mutation: replacing the StoredCredentialRejectedError throw with `throw error` fails 3 GAUTH-04 cases"
        status: pass
    human_judgment: false
  - id: D2
    description: "The one-shot helper module and its test are deleted, and no extension or test code names it, the `device-flow` arm, `OnAuthRequiredFn`, or `AuthAttemptResult`"
    requirement: SG-AUTH-01
    verification:
      - kind: other
        ref: "acceptance greps (scratch accept.sh): both files absent; retry names in git.ts 0; sign-in names in git-credential.ts 0; mapping 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "`lacksStoredCredential` takes only the failure, and its two callers pass only the failure"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/shared.test.ts#lacksStoredCredential (4 cases)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- the five Task 1 sources (exit 0, 100%)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The credential leak registry, its destructuring, and `DECLARED_MODULE_ORDER` drop the one-shot module; the hookDebugLog scan covers `platform/git.ts` and `platform/git-credential.ts` and still counts call sites"
    verification:
      - kind: unit
        ref: "node --test test/architecture/no-credential-leak.test.ts (114 passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No user-visible behavior changes: every git-source and stored-credential scenario passes, and no feature file changed"
    verification:
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile adapter features/marketplace features/plugin (1539 passed)"
        status: pass
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile builtin features/marketplace features/plugin (42 passed)"
        status: pass
      - kind: other
        ref: "git diff --stat eb52412..HEAD -- features (empty)"
        status: pass
    human_judgment: false

duration: 23min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 08: The sign-in retry removed Summary

**`GitAuthBundle` has only the stored-credential arm, `runWithAuthBundle` runs each request once and maps only a refused credential at the bundle's own host to `StoredCredentialRejectedError`, and `platform/git-one-shot-credential.ts` is deleted with its test. No extension code can hand git a token of its own.**

## Performance

- **Duration:** about 23 min
- **Started:** 2026-11-27T19:26:45Z
- **Completed:** 2026-11-27T19:49:57Z
- **Tasks:** 2 (one commit)
- **Files modified:** 12 (0 created, 10 modified, 2 deleted)

PLAN_BASE: `eb5241222cd76b96531994580683b8a16b6565c3` (the worktree base).

## Accomplishments

- `platform/git.ts`: `runWithAuthBundle` has one mapping. A `GitCommandError` with `{ kind: "https-auth", detail: "rejected" }` under a bundle, for a request whose wire URL is an https URL of the bundle's host (`bundleOrigin`), throws `StoredCredentialRejectedError(auth.host, { cause: error })`. Every other failure is rethrown. `retryAfterSignIn`, its `hookDebugLog` line, and the `withOneShotCredential` import are deleted. The module header, the `CloneOptions.auth`, `FetchCommitOptions.auth`, `clone`, `resolveRemoteRef`, and `GitCredentials` docs now describe one run per request and the GAUTH-04 mapping (D-SG-27).
- `platform/git-credential.ts`: `GitAuthBundle` is an interface with `kind: "stored-credential"`, `credentialOps`, and `host`. `AuthAttemptResult` and `OnAuthRequiredFn` are deleted. The bundle doc says git asks the user's helpers itself and the bundle names the host whose refusal maps to `StoredCredentialRejectedError`. The `CredentialOps` doc no longer says the sign-in stores its token through `approve`.
- `orchestrators/marketplace/shared.ts`: `lacksStoredCredential(err)` drops the bundle parameter and the kind test. `marketplace/update.ts` and `plugin/update-flow.ts` pass only the failure. The `attachStoredCredentialCause` doc drops its "a Device Flow bundle gains nothing" sentence.
- `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`: the one-shot module leaves `CREDENTIAL_LEAK_TARGETS`, the destructuring, and `DECLARED_MODULE_ORDER` together. The hosted-fetch entry's comment now states its own reason for being appended last. The hookDebugLog scan's `SCANNED` is `[GIT_PLATFORM_FILE, GIT_CREDENTIAL_FILE]`, its comment names the ssh probe and settings reads in `git.ts` and the keychain failures in `git-credential.ts`, and the `scannedCallSites > 0` check stays (git.ts holds three call sites).

### Deleted files

- `extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts`
- `test/platform/git-one-shot-credential.test.ts`

### Deleted and changed cases

`test/platform/git.test.ts`, describe renamed from `D-SG-14 and GAUTH-04: an auth failure of a remote request` to `GAUTH-04 and D-1-03: an auth failure of a remote request`. Deleted:

- `D-SG-14: a missing credential under a Device Flow bundle signs in once and the retry succeeds through a removed one-shot helper`
- `D-SG-14: a clone that needs a credential signs in once and the retry clones into the same target`
- `D-SG-14: a request that succeeds signs in no time`
- `D-SG-14: a failed sign-in throws the first failure with the sign-in's reason as its cause`
- `D-SG-14: the retry runs once, and its own failure is the one thrown`
- `D-SG-14: a sign-in that Pi cannot show rejects with DeviceFlowUnavailableError and runs no retry`
- `GAUTH-04: a refused credential under a Device Flow bundle is thrown unchanged, with no sign-in`
- `D-SG-14: a fetchCommit rung retries with the one-shot helper after its sign-in`
- `D-1-03: a Device Flow bundle for another host signs in no time, offers no token, and throws the first failure`
- `D-1-03: a user's insteadOf that sends a github.com request to another host gets no token from the retry`

Kept, retitled, or reworked to a stored-credential bundle:

- `D-SG-14: a missing credential under a stored-credential bundle is thrown with no retry` is now `GAUTH-04: a missing credential under a stored-credential bundle is thrown as it failed, and git runs once`. Its bundle is bound to the stand-in's host, so the detail check decides, not the host check.
- `GAUTH-04: a refused stored credential throws StoredCredentialRejectedError with the git failure as its cause` is kept and now also asserts one git run (`..., and git runs once`).
- New: `GAUTH-04: a refused credential of a fetchCommit rung in a clone of the bundle's host throws StoredCredentialRejectedError`. It replaces the deleted fetchCommit retry case as the proof that a fetch rung carries the bundle. Without it, the other-host fetch case below would still pass if `fetchCommit` dropped its bundle.
- `D-1-03: a stored-credential bundle for another host throws a refused credential's failure unchanged`: unchanged.
- `D-1-03: a fetchCommit rung in a clone whose origin is another host signs in no time and throws its failure` is now `... throws its refused credential's failure unchanged` (stored bundle, `rejected`).
- `` D-1-03: a request to ${url} is no https request to the bundle's host, so it signs in no time `` (two cases) is now `..., so its refused credential's failure is thrown unchanged` (stored bundle, `rejected`). These two keep the `URL.canParse` and `https:` branches of `bundleOrigin` covered.
- `RESV-03, GAUTH-04: the supplied bundle maps an auth failure of the listing`: unchanged and passing.
- Helpers deleted: `tracingGitProcess`, `captureDebugLines`, `oneShotDirectoriesLeft`, `deviceFlowBundle`, `oneShotHelper`, `assertOneShotPairs`. `RETRY_TOKEN` is now `HOST_PASSWORD` (`"stand-in-password"`). Imports dropped: `strong-mock`, `getAgentDir`, `DeviceFlowUnavailableError`, `OnAuthRequiredFn`.

`test/orchestrators/marketplace/shared.test.ts`: deleted `storedCredentialAuth`, `deviceFlowAuth`, the `createCredentialOpsFake` and `GitAuthBundle` imports, and the case `lacksStoredCredential does not report a no-credential failure on a Device Flow host`. `lacksStoredCredential GAUTH-04: reports a no-credential failure on a stored-credential host` is now `lacksStoredCredential GAUTH-04: reports a no-credential failure`.

`test/platform/git-ops-fake.test.ts`: `records callable authentication on every remote operation` is now `records the auth bundle of every remote operation`. It records a stored-credential bundle, and the `onAuthRequired` rejection check is deleted.

`test/platform/git-one-shot-credential.test.ts` (deleted): `withOneShotCredential` with its 11 cases (`D-SG-14: gives run an empty helper, then a get-only helper over a 0600 file in a fresh 0700 directory, both keyed to the origin`, `D-SG-14: removes the directory once run resolves, and answers what run answered`, `D-SG-14: removes the directory once run rejects, and rethrows the same error`, `D-SG-14: git's credential fill reads the file through the helper, quoting a path that holds a quote`, `D-SG-14: git's credential approve and reject leave the file alone`, `D-1-03: git offers the file to the origin only, and another host keeps the user's own helper`, `D-1-03: the helper itself prints nothing for a host other than the origin's`, `D-1-03: refuses an origin holding an equals sign without naming it, and writes nothing`, `D-SG-14: leaves an absent value out of the file`, `` AUTH-09: refuses a value holding ${...} without naming it, and writes nothing ``, `NFR-10: the default parent is the user scope's extension root`).

### Suite counts

- Task 1 verify before the commit (`git`, `git-ops-fake`, `git-credential`, `marketplace/shared`, `marketplace/update`, `plugin/update-flow` tests): 752 tests, 752 passed.
- Task 1 cucumber verify, adapter, `features/marketplace/git-source.feature features/plugin/git-source.feature features/marketplace/credentials.feature`: 85 scenarios, 85 passed (1127 steps).
- Direct coverage, `npm run test:coverage:direct --` `platform/git.ts`, `platform/git-credential.ts`, `orchestrators/marketplace/shared.ts`, `orchestrators/marketplace/update.ts`, `orchestrators/plugin/update-flow.ts`: exit 0, no shortfall (100%).
- Task 2 verify, `test/architecture/no-credential-leak.test.ts`: 114 tests, 114 passed.
- Commit hook: `npm run check:commit` Passed. It runs `check:static` and `test:unpaired`, and all pairs' direct coverage, because `test/architecture/gate-targets.ts` is shared test support.
- Tracer gate on the committed tree (interactive, `end-of-phase`, automated-only verify): the Task 1 and Task 2 unit tests re-ran, 866 tests, 866 passed.
- Plan verification: `features/marketplace features/plugin`, adapter: 1539 scenarios, 1539 passed (18456 steps). Builtin: 42 scenarios, 42 passed (544 steps). `git diff --stat eb52412..HEAD -- features`: empty.
- Mutation (T1.4 guard): with `throw new StoredCredentialRejectedError(auth.host, { cause: error })` replaced by `throw error`, `--test-name-pattern GAUTH-04` fails 3 of 8 cases. The file was restored afterwards.

## Task Commits

1. **Task 1 and Task 2 in one commit: the sign-in retry and the one-shot helper removed, and the leak registry re-aimed** - `6d196d4` (refactor)

Tasks 1 and 2 share one commit (see Deviations). Neither task is a TDD task, so there is no RED commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts`: one failure mapping, no retry, docs for one run per request
- `extensions/pi-claude-marketplace/platform/git-credential.ts`: one bundle arm, sign-in types deleted
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`: `lacksStoredCredential(err)`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`: callers pass only the failure
- `test/platform/git.test.ts`, `test/platform/git-ops-fake.test.ts`, `test/orchestrators/marketplace/shared.test.ts`: cases deleted or reworked as listed above
- `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`: registry and scan without the deleted module
- Deleted: `extensions/pi-claude-marketplace/platform/git-one-shot-credential.ts`, `test/platform/git-one-shot-credential.test.ts`

## Decisions Made

- `GitAuthBundle` is written as an interface now that it has one arm, with the same three members. 05-10 moves it to `platform/git.ts` as `{ readonly host: string }`.
- `bundleOrigin` keeps its signature. Only its doc changed: the sentence about a sign-in's token is gone.
- The kept missing-credential case binds its bundle to the stand-in's host. That way the case shows that the `detail` check, not the host check, keeps a helper miss from becoming `StoredCredentialRejectedError`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tasks 1 and 2 committed together**
- **Found during:** Task 1, before its commit
- **Issue:** With the module deleted and the registry unchanged, `node --test test/architecture/no-credential-leak.test.ts` gave 113 of 114 passed. The failing case was `AUTH-09: the git hookDebugLog calls never interpolate a credential field`, because it reads `platform/git-one-shot-credential.ts`. The hook runs every architecture test, so Task 1 could not pass `check:commit` alone. The plan's flagged assumption covers this case.
- **Fix:** Task 2's registry change went into the Task 1 commit. The commit message says so.
- **Files modified:** `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`
- **Verification:** 114 of 114 passed, and the hook passed.
- **Committed in:** `6d196d4`

**2. [Rule 2 - Missing critical] A fetchCommit mapping case added**
- **Found during:** Task 1
- **Issue:** The only case that showed a `fetchCommit` rung carries its bundle to the bundle's host was the deleted D-SG-14 retry case. The remaining other-host fetch case would still pass if `fetchCommit` dropped `opts.auth`.
- **Fix:** Added `GAUTH-04: a refused credential of a fetchCommit rung in a clone of the bundle's host throws StoredCredentialRejectedError`.
- **Files modified:** `test/platform/git.test.ts`
- **Verification:** It passes, and it fails under the mapping mutation.
- **Committed in:** `6d196d4`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** One commit instead of two, and one added unit case. No behavior or scenario change.

## Issues Encountered

None.

### Left for later plans

- `orchestrators/marketplace/add.ts:2087` still describes Device Flow as "the onAuthRequired closure" with the D-SG-14 rerun. 05-12's wording sweep owns `add.ts`. The `refreshAuthFor` doc in `orchestrators/marketplace/update.ts` (Device Flow, `onDeviceCode`) belongs to the same sweep.
- The `platform/git-credential.ts` header and the `credentialApprove` doc still mention Device Flow. 05-10 deletes the module.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-15 (mitigate): the one-shot module, its import, and the retry are deleted, and the acceptance greps find no reference. `runWithAuthBundle` keeps `bundleOrigin`, so a refusal on another host is not reported as the bundle host's (D-1-03 cases pass). T-05-SC (mitigate): no package was added, removed, or upgraded.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and this plan leaves no stub, skipped test, or unrun verify.

## Next Phase Readiness

- 05-10 can shrink `GitAuthBundle` to `{ readonly host: string }` and delete `platform/git-credential.ts`. `runWithAuthBundle` reads only `auth.host` now. The hookDebugLog scan then needs only `GIT_PLATFORM_FILE`, which has three call sites.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/platform/git.ts`, `extensions/pi-claude-marketplace/platform/git-credential.ts`: present. `git-one-shot-credential.ts` and its test: absent.
- Commit `6d196d4`: an ancestor of HEAD.
- Acceptance: both deleted files absent; `retryAfterSignIn|withOneShotCredential|onAuthRequired` in `git.ts`: 0; `kind: "device-flow"|OnAuthRequiredFn|AuthAttemptResult` in `git-credential.ts`: 0; `StoredCredentialRejectedError(auth.host` in `git.ts`: 1; `git-one-shot-credential` in `gate-targets.ts`: 0; `GIT_ONE_SHOT_CREDENTIAL_FILE` in `no-credential-leak.test.ts`: 0.

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*
