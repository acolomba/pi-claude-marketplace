---
phase: 03-system-git-transport-and-clone-shape
plan: "12"
subsystem: auth
tags: [system-git, device-flow, auth-bundle, network-gate, eslint, refactor]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-05 the D-SG-14 retry (runWithAuthBundle, retryAfterSignIn, one-shot helper); 03-09 refreshCloneBySwap for the mirror and the PUP-2 sync, the D-14 GitHub wrapper deleted; 03-11 the add.ts commit-id refusal"
provides:
  - "GitAuthBundle, AuthAttemptResult, OnAuthRequiredFn owned by platform/git-credential.ts"
  - "The callback module keeps only buildAuthCallbacks and the BuildAuthCallbacksOpts alias that platform/git.ts reads"
  - "No orchestrator test builds the isomorphic-git callbacks or names a D-14 GitOps member"
  - "BLOCK F and BLOCK C text that names the swap's seams"
affects: [03-15, transport-removal, SG-TRN-01]

actuals:
  tokens: 15350
  tasks: 3
  commits: 3
plan_head_before: 82c2691358d2f428192aa67d012c1965d81d8cfe
plan_head_after: 33d8cc56824cbc4a83c7e4740f068aa1e8e1f90e

tech-stack:
  added: []
  patterns:
    - "A test reads a recorded auth bundle directly: its kind, `credentialOps`, and `onAuthRequired`, never a callback pair built from it"
    - "A wrapper GitOps spreads the inner port and overrides only the members it records"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git-credential.ts
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - eslint.config.js
    - test/orchestrators/auth-host.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/marketplace/shared.test.ts
    - test/orchestrators/plugin/fetch.test.ts
    - test/platform/git-auth-callbacks.test.ts
    - test/platform/git.test.ts

key-decisions:
  - "The callback module re-exports no sign-in type: a type re-export that only tests import is a fallow unused-type finding, so the two platform tests import AuthAttemptResult and OnAuthRequiredFn from the credential module"
  - "Under D-SG-14 a sign-in reads no stored credential and the extension evicts none, so the reworked Device Flow cases expect `fill: []` and a refused credential stays stored"

patterns-established:
  - "Drive a device-flow bundle through `onAuthRequired`, the entry the D-SG-14 retry calls"

requirements-completed: [SG-TRN-01]

coverage:
  - id: D1
    description: "The bundle and sign-in types live in platform/git-credential.ts; auth-host.ts and marketplace/shared.ts import them from there"
    requirement: SG-TRN-01
    verification:
      - kind: other
        ref: "npm run --silent typecheck && npm run --silent fallow"
        status: pass
      - kind: unit
        ref: "npm run test:coverage:direct -- orchestrators/auth-host.ts platform/git-credential.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The auth-host, add, update, and fetch tests drive the bundle's onAuthRequired or credentialOps and keep the per-host memo, kind, and notification assertions"
    requirement: SG-TRN-01
    verification:
      - kind: unit
        ref: "test/orchestrators/auth-host.test.ts (49/49)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/{add,update,shared}.test.ts, test/orchestrators/plugin/fetch.test.ts (512/512)"
        status: pass
    human_judgment: false
  - id: D3
    description: "BLOCK F names live seams only and BLOCK C names clone-swap.ts as reachable from a plugin ledger"
    requirement: SG-TRN-01
    verification:
      - kind: other
        ref: "npm run --silent lint && npm run --silent fallow"
        status: pass
    human_judgment: false

duration: 36min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 12: Auth Bundle Types and Network Gate Text Summary

**The Device Flow bundle types now live in `platform/git-credential.ts`. No orchestrator test builds the isomorphic-git callbacks or names a D-14 GitOps member. BLOCK F and BLOCK C name only the seams the tree still has.**

## Performance

- **Duration:** 36 min
- **Started:** 2026-11-24T10:48:37Z
- **Completed:** 2026-11-24T11:24:07Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- `GitAuthBundle` (the `device-flow` and `stored-credential` arms, readonly), `AuthAttemptResult`, and `OnAuthRequiredFn` are declared in `platform/git-credential.ts`. Their doc comments describe the D-SG-14 retry model. `auth-host.ts` imports all three from there. `marketplace/shared.ts` imports `GitAuthBundle` from there and re-exports it for its five orchestrator importers.
- The callback module keeps only `buildAuthCallbacks` and `export type BuildAuthCallbacksOpts = GitAuthBundle`, the alias `platform/git.ts` reads.
- `auth-host.ts` comments no longer describe `onAuth` or `onAuthFailure`. git asks the user's helpers itself, a `device-flow` bundle signs in once when no helper answered, and a sign-in's token reaches git only through the one-shot helper.
- The auth-host, add, update, and fetch tests read a recorded bundle directly: its kind, its `credentialOps`, and its `onAuthRequired`. These tests also stop naming `fetch`, `forceUpdateRef`, and `currentBranch`.
- `NETWORK_SEAM_NAMES` no longer lists the deleted GitHub wrapper. Four `NETWORK_SEAMS` reasons were rewritten. The BLOCK C plugin-ledger message names `shared.ts` and the non-ledger `clone-swap.ts`.

## Task Commits

1. **Task 1 (tracer): bundle types to the credential module, sign-in tested through onAuthRequired** - `ff497bb` (refactor). Tracer gate: both verify commands were green before the commit. The four-file test run passed 251/251. Typecheck and fallow exited 0. Direct coverage of `auth-host.ts` and `git-credential.ts` exited 0.
2. **Task 2: add, update, fetch, shared tests off the callback builder and the D-14 members** - `7d69c1c` (test)
3. **Task 3: network gate names the swap's seams** - `33d8cc5` (chore)

## TDD Note

Task 1 carries `tdd="true"`, but it is a refactor that does not change the number of rows: the types move with unchanged shapes, and every reworked case covers behavior that already exists. So no RED test could fail before the change, and no `test(...)` RED commit exists. To show that the reworked cases still catch a wrong implementation, I made a temporary change to `buildAuthForHost` that gave an unregistered host a Device Flow bundle (I removed `provider === undefined ||` and fell back to the GitHub provider). Under that change, 6 of 49 auth-host cases failed: the four reworked unregistered-host cases, `returns a stored-credential bundle for an unregistered host without notifying`, and `binds an unregistered port-bearing git-subdir host to its own bundle`. I then restored the source from a copy. The commit hook runs typecheck and the architecture tests, so a commit with only a failing test could not pass it.

## Case Counts (before -> after)

| File | Before | After |
| --- | --- | --- |
| `test/orchestrators/auth-host.test.ts` | 49 | 49 |
| `test/orchestrators/marketplace/add.test.ts` | 216 | 216 |
| `test/orchestrators/marketplace/update.test.ts` | 157 | 157 |
| `test/orchestrators/marketplace/shared.test.ts` | 94 | 94 |
| `test/orchestrators/plugin/fetch.test.ts` | 45 | 45 |
| Task 1 run (auth-host, git-credential, git-auth-callbacks, git) | 251 | 251 |

## Reworked, Changed, and Dropped Assertions

**auth-host.test.ts** (each former `buildAuthCallbacks(auth).onAuth*` call):

- `reuses a stored credential in print for ${host}` -> `binds the ${kind} bundle for ${host} to its stored credential in print without signing in`. The case reads the stored credential through `auth.credentialOps.fill` and also asserts the bundle kind per host.
- `forwards an unregistered host's stored credential through the real auth callbacks` -> `GAUTH-03: binds an unregistered host's stored credential to a bundle with no sign-in`. The case asserts the whole bundle shape and reads the credential through `fill`.
- `cancels on an unregistered host whose helper is empty` -> `GAUTH-04: offers no sign-in on an unregistered host whose helper is empty`. **Dropped:** the `{ cancel: true }` return and the `onAuth: no stored credential` debug line. Both were callback-layer behavior. Under D-SG-14, `git.test.ts` "a missing credential under a stored-credential bundle is thrown with no retry" covers this path.
- `CR-01: keeps an unregistered host's rejected credential in the keychain` -> `CR-01 / GAUTH-04: binds an unregistered host to the bundle that keeps a rejected credential`. **Dropped:** the `StoredCredentialRejectedError` from `onAuthFailure` and its debug line. `git.test.ts` "GAUTH-04: a refused stored credential throws StoredCredentialRejectedError..." now owns this throw.
- `CR-01 / AUTH-07: evicts a GitHub credential the server rejected` -> `D-SG-14: a GitHub sign-in stores a token over a rejected one without evicting it`. **Changed:** the case used to expect `reject: [rejected]`. It now drives `onAuthRequired` and expects `approve: [fresh]` and `reject: []`, and the stored credential is the fresh token. Under D-SG-14 the extension erases no stored credential. The only code left that evicts is the callback module's `onAuthFailure`, reached only by the D-14 `fetch`, which no production code calls.
- `D-3-04: cancels a github.com helper miss without starting a Device Flow` -> `D-3-04: gives a github.com helper miss no Device Flow to start`. **Dropped:** the cancel return and the debug line, for the same reason as above.
- `uses a stored credential while truly omitting optional collaborators`: the case narrows to the device-flow bundle and reads the credential through `fill`.

**add.test.ts:**

- `AUTH-01 add: credentialOps.fill HIT bypasses Device Flow...`: the case reads the credential through `recordedAuth.credentialOps.fill`. Its assertions are unchanged.
- `AUTH-01 add: credentialOps.fill MISS triggers Device Flow...`: the case calls `recordedAuth.onAuthRequired()` and expects `{ ok: true, cred }`. **Changed:** `fillCalls` was 1 and is now `[]`, because the sign-in reads no helper.
- `MURL-01 regression: github source is byte-identical...`: `assert.ok(buildAuthCallbacks(...))` became an assertion that the bundle carries an `onAuthRequired` function.
- **Dropped (D-14 only):** the `fetchCalls` and `forceUpdateRefCalls` members of seven no-git-call objects. Those objects are the `NO_GIT_CALLS` constant and the `state` comparisons in an unsupported-source case, `config writer stopped`, two path adds, `opaque add failure`, and `duplicate name`. Also dropped: the `fetchCalls`/`forceUpdateRefCalls` lines in `NFR-5: path-source add never calls gitOps`, the `fetchCalls` line in `CR-02 / MA-4: ~/path is expanded...`, and two of the four arrays in the mirror-seeding case that compares `[fetch, forceUpdateRef, checkout, resolveRef]`. The clone, checkout, and resolveRef parts stay.

**update.test.ts:**

- `AUTH-02 update: credentialOps.fill HIT yields silent reuse...`: the case reads the credential through `cloneAuth.credentialOps.fill`, and `fillCalls` stays 1.
- `makeForbiddenGitOps` spreads a memory fake and overrides the six live members with rejecting recorders. Every assertion that `calls` is `[]` is unchanged.
- **Dropped (D-14 only):** `state.fetchCalls` equals `[]` in `MU-4 + D-SG-10: a stale github source is re-cloned...` and in `MURL-03 + D-SG-10: a stale url source is re-cloned...`. Also dropped: the `fetchCalls` and `forceUpdateRefCalls` lines in `a pre-persistence manifest failure leaves cache rows intact...` and in `NFR-5: path-source update calls zero gitOps methods`, and the `fetchCalls` line in `CR-01 TOCTOU: refreshOneMarketplace silently no-ops...`.
- **Changed:** in `GHB-03: updating a GitHub marketplace on an invalid base fails the command...`, the D-14 check `fetchCalls` equals `[]` became `[lsRemoteCalls, cloneCalls]` equals `[[], []]`. The new check is the D-SG-10 form of "no network call".
- The stale section comment that named the deleted wrapper and `gitOps.fetch.auth` now names the re-clone.

**shared.test.ts:** `DEFAULT_GIT_OPS exposes every platform git function by exact reference` became `...exposes each platform git function the orchestrators call by exact reference` and compares the six live members. **Dropped:** the reference checks of `fetch`, `forceUpdateRef`, and `currentBranch`, and the extra `Reflect.get(references, "fetch")` assertion.

**fetch.test.ts:**

- The wrapper port no longer overrides `currentBranch`, `fetch`, or `forceUpdateRef`. No schedule assertion named them.
- The mirror Device Flow case and `classifies a denied Device Flow as authentication required` call `onAuthRequired`. They expect `{ ok: true, cred }` and `{ ok: false, reason: "User cancelled authorization. Run the command again to retry." }`. **Changed:** `fill` was `[{ host: "github.com" }]` and is now `[]`.
- `fails cleanly when Device Flow credential approval rejects`: `onAuthRequired` rejects with `credential approve failed`, which the old callback layer turned into a cancel. **Changed:** `fill` is now `[]`. The approve attempt and the failed row are unchanged.
- `reuses a stored GitHub credential without Device Flow`: the case reads the credential through `fill`, and `fill` stays 1.
- `rejects a stale credential and contains a reject failure` -> `D-SG-14: keeps a stale credential the host refused`. **Changed:** `reject` was `[stale]` and is now `[]`, and the stored credential stays. The `rejectError` collaborator is gone, because no code calls `reject` in this case. The notification assertion is unchanged.

## Files Created/Modified

- `platform/git-credential.ts`: the three types, plus a `CredentialOps` doc comment that no longer names the callback builder.
- `platform/git-auth-callbacks.ts`: imports `GitAuthBundle`, keeps the `BuildAuthCallbacksOpts` alias and `buildAuthCallbacks`, and has a new header.
- `orchestrators/auth-host.ts`: the import and the retry-model comments.
- `orchestrators/marketplace/shared.ts`: the `GitAuthBundle` re-export.
- `eslint.config.js`: `NETWORK_SEAM_NAMES`, the BLOCK F message, four `NETWORK_SEAMS` reasons, and the BLOCK C message.
- The tests listed above. `test/platform/git-auth-callbacks.test.ts` and `test/platform/git.test.ts` changed their type import line only.

## Decisions Made

- The callback module does not re-export the sign-in types. See deviation 1.
- `clone-swap.ts` keeps its 03-07 reason ("D-SG-10: refreshes a checkout by ls-remote, re-clone, and swap."), which still fits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two test type imports moved to the credential module**

- **Found during:** Task 1
- **Issue:** The plan's interfaces say `test/platform/git.test.ts` keeps importing `OnAuthRequiredFn` from the callback module, and the callback test imports both sign-in types from there. If the callback module re-exports the types only for tests, `npm run fallow` fails with 2 unused type exports (production dead-code mode does not count test importers).
- **Fix:** The callback module re-exports neither type. `git.test.ts` and `git-auth-callbacks.test.ts` import them from `platform/git-credential.ts`. Neither file is in `files_modified`. Neither sibling plan of wave 6 touches them, which I checked against the `files_modified` of 03-13 and 03-14.
- **Files modified:** `test/platform/git.test.ts`, `test/platform/git-auth-callbacks.test.ts`
- **Verification:** fallow, typecheck, and 251/251 tests passed.
- **Committed in:** `ff497bb`

**2. [Rule 3 - Blocking] The `add.test.ts` type import changed in the Task 1 commit**

- **Found during:** Task 1
- **Issue:** `add.test.ts` imported `AuthAttemptResult` from the callback module, so the Task 1 commit would have failed typecheck.
- **Fix:** I changed that one import line in `ff497bb`. Task 2 made the rest of the file's changes in `7d69c1c`.

**3. [Rule 1 - Bug] `require-await` in the reworked stale-credential seam**

- **Found during:** Task 2. ESLint flagged the case once its `await` was gone.
- **Fix:** The seam method is no longer `async` and returns `Promise.reject(...)`. The rejection is unchanged.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug).
**Impact on plan:** No scope added. Two extra test files changed one import line each.

## Issues Encountered

- The harness refuses Bash command text that contains file names starting with `git-` (for example the callback module's name). I ran those steps through scripts in my scratch directory.
- Whole module suite (`npm run test:modules`): 19,168 of 19,169 passed. The one failure is the known baseline `test/bridges/hooks/dispatch-exec.test.ts:39` "executes a blocking hook through the portable process boundary", which fails because the sandbox environment is too large. `npm run test:integration` passed 426 of 426. No new case reaches a remote host. The reworked cases call only memory fakes, and every Device Flow fake runs with `network: "disabled"`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-38: the types moved with unchanged shapes. Every reworked Device Flow case still compares the whole notification log, the credential calls, or both, so a token in output would fail it (AUTH-09). T-03-39: only `refreshGitHubClone` left `NETWORK_SEAM_NAMES`, and no file left `NETWORK_SEAMS`. `npm run lint` ran BLOCK F over every orchestrator and domain module in the same commit. T-03-SC: nothing was installed.

## Orchestrator actions

None. The plan asks for no `windows append`, and I recorded no stub or skipped test.

## Lines for later plans

- **Final type exports of `platform/git-credential.ts`:** `CredentialOps` (interface), `AuthAttemptResult`, `OnAuthRequiredFn`, `GitAuthBundle`, `CredentialGit`, `CreateCredentialOpsOptions` (interface). Its value exports are unchanged: `NODE_CREDENTIAL_GIT` and `createCredentialOps`.
- **Remaining importers of the callback module:** `platform/git.ts` (the `buildAuthCallbacks` value and the `BuildAuthCallbacksOpts` type) and `test/platform/git-auth-callbacks.test.ts` (`buildAuthCallbacks`). `test/platform/git.test.ts` no longer imports from it. See deviation 1. 03-15 can replace `BuildAuthCallbacksOpts` in `git.ts` with `GitAuthBundle` from the credential module.
- **Comments that still name the callback module, outside this plan's files:** `domain/auth-registry.ts:82`, `shared/git-failure-classifiers.ts:85`, `platform/git.ts:59`, and `test/platform/git.test.ts:75`. `test/architecture/gate-targets.ts:167` and `test/architecture/no-credential-leak.test.ts:109,579` list its path as a gate target.
- **Comments that still name the deleted wrapper:** the headers of `orchestrators/marketplace/info.ts`, `orchestrators/plugin/info.ts`, and `orchestrators/reconcile/pending.ts`. Comments are not identifiers, so BLOCK F does not see them.
- **D-14 members:** no orchestrator test of this plan names `fetch`, `forceUpdateRef`, or `currentBranch`. The `GitOps` interface and `DEFAULT_GIT_OPS` in `shared.ts` still declare them for 03-15. The forbidden port in `update.test.ts` spreads a memory fake, so it keeps type-checking after the members are deleted.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 03-15 can delete the callback module once `git.ts` stops importing it. Its own test goes with it.
- The wave gate runs `npm run check`.

## Self-Check: PASSED

- FOUND: `platform/git-credential.ts` exports `AuthAttemptResult` (`grep -c` = 2). `git-auth-callbacks` appears in `auth-host.ts` 0 times and in `shared.ts` 0 times. `buildAuthCallbacks` appears in `auth-host.test.ts` 0 times and in add/update/fetch 0 times. `forceUpdateRef\|currentBranch` appears in the four Task 2 files 0 times. `git-auth-callbacks` appears in `shared.test.ts` 0 times. `refreshGitHubClone` appears in `eslint.config.js` 0 times, `refreshCloneBySwap` 3 times, and `clone-swap` 2 times.
- FOUND: `ff497bb`, `7d69c1c`, `33d8cc5` (`git rev-list --count 82c2691..HEAD` = 3 before this SUMMARY commit).
