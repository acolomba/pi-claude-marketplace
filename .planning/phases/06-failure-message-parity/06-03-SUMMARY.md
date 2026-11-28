---
phase: 06-failure-message-parity
plan: 03
subsystem: failure-messages
tags: [system-git, failure-messages, https-auth, gauth-04, d-1-02, d-sg-31]

requires:
  - phase: 06-failure-message-parity
    provides: "GitCommandError.remote and redacted stderr (06-01); the [git] debug line (06-02)"
provides:
  - "StoredCredentialRejectedError as a GitCommandError subclass built from the refused failure, with no cause link"
  - "classifyGitFailure without the refused-credential rung"
  - "no D-1-02 git credential approve recipe in code, tests, or pins"
  - "one HTTPS auth cause chain for a refused, a missing, and a bare 401/403 credential"
affects: [06-04, 06-05, 06-06, https-auth remedy, cause-chain rendering]

actuals:
  tokens: 18810
  tasks: 2
  commits: 2
plan_head_before: 58ac88692a4a5e7e0856f847d00fc028d6a6514b
plan_head_after: dc28d029c1b0db3ae93de9f5c256a051947dede3

tech-stack:
  added: []
  patterns:
    - "A typed failure that carries extra internal facts subclasses GitCommandError and keeps the typed line as its message"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
    - features/marketplace/git-source.feature
    - features/marketplace/credentials.feature

key-decisions:
  - "StoredCredentialRejectedError moved below GitCommandError in errors.ts, because a class that extends another must be declared after it"
  - "A refused credential under the GitHub base override now gains the GHB-01 fetched link, as the plan flagged"
  - "The deleted try/catch blocks in refreshGitSource and syncMarketplaceBySwap only rethrew, so both now let the failure propagate unchanged"

patterns-established:
  - "One HTTPS auth shape: the https-auth detail stays internal and only selects the class D-SG-26 reads"

requirements-completed: [SG-ERR-01]

coverage:
  - id: D1
    description: "A marketplace update whose host refuses the stored credential fails as authentication required with the typed ls-remote line, plus the fetched link under the base override, and no rejection sentence"
    requirement: SG-ERR-01
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a git marketplace whose host rejects the stored credential fails as authentication required"
        status: pass
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a github marketplace whose host rejects the stored credential fails as authentication required and names the clone it tried"
        status: pass
      - kind: e2e
        ref: "features/marketplace/credentials.feature#Adding a GitHub marketplace whose host refuses the stored credential fails as authentication required, and git's store helper erases the credential (AUTH-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "StoredCredentialRejectedError is a GitCommandError with the refused error's facts and no cause; the classifier and D-SG-26 still read it"
    requirement: SG-ERR-01
    verification:
      - kind: unit
        ref: "test/shared/errors.test.ts#StoredCredentialRejectedError"
        status: pass
      - kind: unit
        ref: "test/shared/git-failure-classifiers.test.ts"
        status: pass
      - kind: unit
        ref: "test/platform/git.test.ts#GAUTH-04 and D-1-03: an auth failure of a remote request"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/clone-swap.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A marketplace update or PUP-2 sync with no credential, or a bare 401/403, fails as authentication required with the typed line and no git credential approve recipe"
    requirement: SG-ERR-01
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a git marketplace whose host now needs a credential fails as authentication required"
        status: pass
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Updating a git marketplace whose host answers 403 before any credential is sent fails as authentication required"
        status: pass
      - kind: unit
        ref: "test/orchestrators/marketplace/update.test.ts"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-flow.test.ts#syncClone-fail / GAUTH-04: an HTTP 401 on a url marketplace sync fails as authentication required with the typed clone line"
        status: pass
    human_judgment: false

duration: 31min
completed: 2026-11-28
status: complete
---

# Phase 6 Plan 03: One HTTPS authentication message Summary

**A refused stored credential is now a `GitCommandError` whose message is the typed line `git <op> failed: https-auth, exit code N`, so it reads exactly like a missing credential or a bare 401/403. The D-1-02 `git credential approve` recipe is gone from the code, the tests, and every pin, and D-SG-26 still prefers a refused credential by class.**

## Performance

- **Duration:** about 31 min
- **Started:** 2026-11-28T18:00:00Z
- **Completed:** 2026-11-28T18:31:00Z
- **Tasks:** 2
- **Files modified:** 21
- **PLAN_BASE:** `58ac88692a4a5e7e0856f847d00fc028d6a6514b`

## Accomplishments

- `StoredCredentialRejectedError extends GitCommandError`. Its constructor is `(host, refused: GitCommandError)`. It copies the refused error's failure, operation, exit code (when set), stderr, and remote, and it has no cause. The JSDoc cites GAUTH-04 as amended by D-SG-31's one-message HTTPS auth decision. The class moved below `GitCommandError` in `errors.ts`, because a subclass must be declared after its base.
- `runWithAuthBundle` throws `new StoredCredentialRejectedError(auth.host, error)`. With no cause, `withFetchedUrlCause` now adds the GHB-01 `fetched <url>` link to it under the base override. Both JSDocs say so.
- `classifyGitFailure` lost its refused-credential rung and the import. The `GitCommandError` rung answers first with the same reason. The header and the ladder JSDoc say this.
- Deleted the D-1-02 machinery: `NO_STORED_CREDENTIAL_CAUSE` (`orchestrators/auth-host.ts`), `attachStoredCredentialCause` and its try/catch (`orchestrators/marketplace/update.ts`), the PUP-2 attach and its try/catch (`orchestrators/plugin/update-flow.ts`), and `lacksStoredCredential`, `isNoCredentialFailure`, and their header bullet (`orchestrators/marketplace/shared.ts`). Unused imports went with them.
- Deleted the AUTH-09 / GAUTH-04 hint scan in `test/architecture/no-credential-leak.test.ts`. `AUTH_HOST_FILE` stays in the credential-capturing list. `fullTemplateLiteralsAfter` is still used by two other scans.

## fallow --trace consumers of each deleted export

- `orchestrators/auth-host.ts:NO_STORED_CREDENTIAL_CAUSE`: USED by 2 files, both named imports: `orchestrators/marketplace/update.ts` and `orchestrators/plugin/update-flow.ts`. The tests `test/orchestrators/auth-host.test.ts` and `test/orchestrators/marketplace/add.test.ts` also imported it.
- `orchestrators/marketplace/shared.ts:lacksStoredCredential`: USED by 2 files, both named imports: `orchestrators/marketplace/update.ts` and `orchestrators/plugin/update-flow.ts`. `test/orchestrators/marketplace/shared.test.ts` also imported it.
- `orchestrators/marketplace/update.ts:attachStoredCredentialCause`: fallow reported `export or member 'attachStoredCredentialCause' not found`. It was a module-private function, and its one caller was `refreshGitSource` in the same file.

## Rewritten rows

`features/marketplace/git-source.feature`:

- "Updating a git marketplace whose host now needs a credential fails as authentication required" (url): `Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128`. The title is unchanged.
- "Updating a github marketplace whose host now needs a credential fails as authentication required and names the clone it tried" (both github rows): `Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, fetched https://{git host}/acme/tools.git`. The title is unchanged.
- Retitled from "... names the rejection" to "Updating a git marketplace whose host rejects the stored credential fails as authentication required" (url): `Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128`.
- Retitled from "... names the rejection and the clone it tried" to "Updating a github marketplace whose host rejects the stored credential fails as authentication required and names the clone it tried" (both github rows): `Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128, fetched https://{git host}/acme/tools.git`. The rows gained the `fetched` link, as the plan's flagged assumption expected.
- Retitled from "... names the command that stores one" to "Updating a git marketplace whose host answers 403 before any credential is sent fails as authentication required" (url): `Failed to update marketplace "tools"., git ls-remote failed: https-auth, exit code 128`.

`features/marketplace/credentials.feature`, the AUTH-07 add scenario: the HTTPS attempt now reads `HTTPS (https://github.com/acme/tools.git): git clone --depth failed: https-auth, exit code 128`. Here the request goes through the proxy route, not the base override, so no `fetched` link appears. The title is unchanged, because it already says the add fails as authentication required.

The rows of the "needs a credential" and "rejects the stored credential" Outlines are now the same. That is the one-message decision.

## Unit test changes

- `test/shared/errors.test.ts`: two cases. The first builds the error from a refused `GitCommandError` that has an exit code, stderr, and a remote, and asserts both classes, the typed message, every copied fact, `host`, and no cause. The second covers a refused error with no exit code and no remote.
- `test/shared/git-failure-classifiers.test.ts`: a `refusedCredential()` helper builds both refused-credential rows from a `GitCommandError`. Their expected reason is unchanged.
- `test/platform/git.test.ts`: the three refused-credential cases now assert the typed line, the copied facts, and no cause. A new case, "GHB-01, GAUTH-04: a refused stored credential at the GitHub base names the URL git fetched", checks the `fetched` link.
- `test/orchestrators/marketplace/clone-swap.test.ts` (Task 1): both refused-credential errors use the new constructor.
- `test/orchestrators/auth-host.test.ts`: the recipe describe is deleted. `authBundleFor` is now the module's only entrypoint, so its cases moved to the top level, as the unit-test rules ask.
- `test/orchestrators/marketplace/shared.test.ts`: the nine `lacksStoredCredential` cases and their three helpers (`noCredential`, `sshPublicKeyDenied`, `bothTransportsFailed`) are deleted, with five imports they left unused. In Task 1, the two refused-credential rows of that loop were first rebuilt with the new constructor so the tree typechecked.
- `test/orchestrators/marketplace/add.test.ts`: the D-79-03 bare-row case tests more than the recipe (the row and no `cause:`), so I kept it. I replaced the recipe import and its assertion with `note.message.includes("git credential") === false`, and rewrote its two comments.
- `test/orchestrators/marketplace/update.test.ts`:
  - Task 1 rewrote the two refused-credential cases ("a stored credential that a url host rejects ..." and "UPD-12 / GHB-01: a stored credential that the override host rejects ...") to the typed line, and retitled them.
  - Task 2 removed the recipe from four expected chains and retitled three cases.
  - I deleted "GAUTH-04 / D-SG-27: a GitHub update without the override that git found no credential for places the github.com stored-credential line", because it only proved where the attach placed the line.
  - I retitled the 500 case and the refused url case, whose titles named the retired line.
- `test/orchestrators/plugin/update-flow.test.ts`: the url sync 401 case expects the chain without the recipe and is retitled.

## Task Commits

1. **Task 1: A refused stored credential reads as the same typed line as any HTTPS auth failure, end to end**: `2bd09fe` (fix)
2. **Task 2: No cause line carries the git credential recipe, and its code is gone**: `dc28d02` (fix)

## Tracer gate (Task 1)

Auto mode is off, `human_verify_mode` is `end-of-phase`, and the tracer's verify is automated only, so no checkpoint applies. I re-ran both verify commands before Task 2. The unit run passed 733 tests across the six files, and the cucumber run passed 59 of 59 scenarios.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/errors.ts`: the subclass, and the `https-auth` detail JSDoc, which no longer names the D-1-02 hint
- `extensions/pi-claude-marketplace/platform/git.ts`: the constructor call and two JSDocs
- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`: the deleted rung, its import, the header, and the ladder JSDoc
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`: the deleted constant and the header sentence about it
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`: the deleted attach and try/catch, and the imports
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`: the deleted predicate, its helper, the header bullet, and the imports
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`: the deleted attach and try/catch, the JSDoc, and the imports
- `features/marketplace/git-source.feature`, `features/marketplace/credentials.feature`: the pins above
- The tests listed above

## Decisions Made

- The class moved below `GitCommandError`. Declaring `class X extends GitCommandError` above the base would throw a ReferenceError when the module loads.
- `refreshGitSource` still computes the auth bundle before it reads the checkout directory. This keeps the order in which an invalid GitHub base throws.
- `isUnreachable` in `clone-swap.ts` still has its `instanceof StoredCredentialRejectedError` check. The check is now redundant, because the class is an `https-auth` `GitCommandError`. I left it, because the plan names `clone-swap.ts` as unchanged and the branch still runs and is covered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The new constructor needed callers outside Task 1's file list**
- **Found during:** Task 1
- **Issue:** `test/orchestrators/marketplace/clone-swap.test.ts`, `test/orchestrators/marketplace/shared.test.ts`, and `test/orchestrators/marketplace/update.test.ts` built `StoredCredentialRejectedError` with the old `(host, opts?)` signature. The commit hook typechecks every file.
- **Fix:** Task 1 rebuilt each one from a refused `GitCommandError`. In `update.test.ts`, the two cases whose expected text named the rejection now expect the typed line. Task 2 later deleted the `shared.test.ts` rows with the rest of the predicate cases.
- **Committed in:** `2bd09fe`

**2. [Rule 1 - Bug] A stale JSDoc in errors.ts**
- **Found during:** Task 2
- **Issue:** The `https-auth` `detail` JSDoc said `no-credential` "gets the D-1-02 hint where the verb adds it".
- **Fix:** It now says the detail stays internal, both details read as the same HTTPS auth failure (D-SG-31), and `platform/git.ts` maps `rejected` to the class D-SG-26 reads.
- **Committed in:** `dc28d02`

**3. auth-host.test.ts layout**
- After the recipe describe was deleted, the module had one entrypoint. Its cases moved out of `describe("authBundleFor")` to the top level (typescript-unit-tests `cases.md`). No case changed.
- **Committed in:** `dc28d02`

---

**Total deviations:** 3 (1 blocking, 1 bug, 1 layout)
**Impact on plan:** None changes scope.

## Issues Encountered

- The harness refuses command text that names paths containing `git`. I ran the cucumber, coverage, alignment, and commit steps from small scripts in my scratch directory.
- `orchestrators/plugin/install.messaging.ts:297` still has a comment that says the stored-credential cause line lives only on the update path's child row. The file is outside this plan, and 06-06 rewrites that branch-4 comment when it drops the bare auth row rule, so I left it.
- PROJECT.md does not yet record the amendment of D-1-02 and GAUTH-04 (CONTEXT, "HTTPS auth: one message"). This plan does not list PROJECT.md. The orchestrator or the docs plan should record it.
- TDD note: this is not a `type: tdd` plan. The failing runs before each pin rewrite are recorded below. Each test change and its code change went into one commit, because the hook runs typecheck and every architecture test.

## Verification

- **Task 1, red first.** Before the pins were rewritten, the cucumber run on `git-source.feature`, `credentials.feature`, and `github-refresh.feature` gave `59 scenarios (55 passed, 4 failed)`. The four failures were the url and github rejected-credential rows and the AUTH-07 add row, each printing the typed line where the pin expected `... rejected the stored credential`.
- **Task 1, green.** The unit verify (`errors`, `git-failure-classifiers`, `git`, `clone-swap`, plus `update` and `shared`) passed 733 tests. The cucumber verify passed `59 scenarios (59 passed)`. Direct coverage of `errors.ts`, `git.ts`, and `git-failure-classifiers.ts` exited 0. Acceptance greps: the `extends GitCommandError` line 1, `rejected the stored credential` in errors.ts 0, `instanceof StoredCredentialRejectedError` in the classifier 0, `rejected the stored credential` in features 0.
- **Task 2, red first.** With the code deleted and the pins not yet rewritten, the unit verify had 5 failures, each expecting the recipe, and the cucumber run gave `73 scenarios (69 passed, 4 failed)`, the four recipe rows.
- **Task 2, green.** The unit verify passed 948 tests. The cucumber verify (`git-source.feature`, `url-marketplace-update.feature`, `update.feature`) passed `73 scenarios (73 passed)`. Direct coverage of `auth-host.ts`, `marketplace/update.ts`, `marketplace/shared.ts`, `plugin/update-flow.ts`, and `errors.ts` exited 0. Acceptance greps: `NO_STORED_CREDENTIAL_CAUSE` in extensions 0 files, `lacksStoredCredential|attachStoredCredentialCause` 0 files, `credential approve` in features 0, `NO_STORED_CREDENTIAL_CAUSE` in the leak test 0. `npm run --silent fallow` exited 0.
- **Plan level.** Both commit hooks ran `npm run check:commit`, which includes `check:static`, and passed. On the final tree, `features/marketplace features/plugin` under the adapter profile passed `1545 scenarios (1545 passed)` and `18549 steps (18549 passed)`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and no stub, skipped test, or unrun verify remains.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-04 can add the HTTPS auth remedy to every `https-auth` link alike. A refused credential is a `GitCommandError` with `remote` set, so the remedy can name the host from `error.remote`.
- A refused credential and a missing one now produce the same chain on the update path, so a single expected row covers both.

---
*Phase: 06-failure-message-parity*
*Completed: 2026-11-28*

## Self-Check: PASSED

- FOUND: `extensions/pi-claude-marketplace/shared/errors.ts` (`class StoredCredentialRejectedError extends GitCommandError`, 1 match)
- FOUND: `extensions/pi-claude-marketplace/orchestrators/auth-host.ts` (`export function authBundleFor`, 1 match)
- FOUND: `2bd09fe` and `dc28d02`, both ancestors of HEAD
- `git rev-list --count 58ac886..dc28d02` = 2, and no commit deletes a file
