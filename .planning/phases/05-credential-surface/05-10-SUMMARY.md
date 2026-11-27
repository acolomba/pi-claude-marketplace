---
phase: 05-credential-surface
plan: 10
subsystem: credentials
tags: [system-git, credentials, removal, platform, gates]

requires:
  - phase: 05-credential-surface
    provides: "05-08 left `GitAuthBundle` with one arm and `runWithAuthBundle` reading only `auth.host`; 05-09 made `authBundleFor` the one bundle function, with `DEFAULT_CREDENTIAL_OPS` and `hostFromCloneUrl` private"
provides:
  - "`GitAuthBundle` is `{ readonly host: string }`, declared in `platform/git.ts` and re-exported by `orchestrators/marketplace/shared.ts`"
  - "`platform/git-credential.ts` and every test double of it are deleted"
  - "`GIT_PROCESS_IMPORTERS` holds `platform/git.ts` alone, and `orchestrators/auth-host.ts` is out of `NETWORK_SEAMS`"
affects: [05-11, 05-12, 05-13, credential surface]

actuals:
  tokens: 28947
  tasks: 2
  commits: 2
plan_head_before: 672db01f7456de1b5ee8a53d89ee4ebc12bc03e9
plan_head_after: d1cf12500d4523207076a3e93ce4b17405861919

tech-stack:
  added: []
  patterns:
    - "An auth bundle is the host a request is bound to; tests assert the whole bundle, `{ host: \"<host>\" }`"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - eslint.config.js
    - test/architecture/gate-targets.ts
    - test/architecture/no-credential-leak.test.ts
    - test/architecture/no-shell-out.test.ts
    - extensions/pi-claude-marketplace/platform/git-process.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
    - extensions/pi-claude-marketplace/bridges/hooks/exec-timer.ts
    - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
    - extensions/pi-claude-marketplace/shared/fs-utils.ts

key-decisions:
  - "OQ3 applied: `orchestrators/auth-host.ts` left `NETWORK_SEAMS`. It now imports only `shared/github-base-url.ts`, `domain/source.ts` (type), and the `GitAuthBundle` type through `orchestrators/marketplace/shared.ts`, and it names no git surface, so BLOCK F lints it from this commit and `npm run lint` passes"
  - "The leak test's `ERROR_LITERAL_CALL_SITE` was deleted with the credential module's Error scan, because that scan was its only reader"
  - "`withBundleFields` in `test/orchestrators/marketplace/update.test.ts` was deleted. It only cut a bundle down to `{ kind, host }`, and the recorded calls are now compared whole"

patterns-established:
  - "Bundle assertions compare the whole bundle, with no field projection"

requirements-completed: [SG-AUTH-01, SG-AUTH-03]

coverage:
  - id: D1
    description: "GitAuthBundle is `{ readonly host }`, declared in platform/git.ts, and a refused credential at the bundle's host still fails as StoredCredentialRejectedError(host, { cause })"
    requirement: SG-AUTH-01
    verification:
      - kind: unit
        ref: "test/platform/git.test.ts#GAUTH-04 and D-1-03: an auth failure of a remote request"
        status: pass
      - kind: other
        ref: "GUARD MUTATION: StoredCredentialRejectedError mapping replaced by `throw error`; --test-name-pattern GAUTH-04 fails 3 of 8"
        status: pass
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile adapter features/marketplace/git-source.feature features/marketplace/credentials.feature features/plugin/credentials.feature"
        status: pass
    human_judgment: false
  - id: D2
    description: "platform/git-credential.ts, its test, the credential-ops contract, the fake, and the fake's test are deleted; no extension module holds a credential surface"
    requirement: SG-AUTH-03
    verification:
      - kind: other
        ref: "test ! -e on the five files; grep -rl credentialOps extensions test = 0; grep -rlE 'git-credential\\.ts|CredentialOps|DeviceFlowHttp' extensions = 0"
        status: pass
      - kind: other
        ref: "npm run check:static (typecheck, lint, fallow, format, pairing, features)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gates name only modules that exist: GIT_PROCESS_IMPORTERS = [platform/git.ts], auth-host out of NETWORK_SEAMS, the leak registry and scans without the credential module"
    verification:
      - kind: unit
        ref: "test/architecture/no-shell-out.test.ts, test/architecture/no-credential-leak.test.ts"
        status: pass
      - kind: other
        ref: "npm run lint (BLOCK F over auth-host)"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 10: The auth bundle is its host, and the credential module is gone Summary

**`GitAuthBundle` is `{ readonly host: string }`, declared in `platform/git.ts`. `platform/git-credential.ts` is deleted with its test, the credential-ops contract, the fake, and the fake's test. `authBundleFor` returns `{ host }`, and auth-host composes no credential surface. `GIT_PROCESS_IMPORTERS` holds `platform/git.ts` alone, auth-host is out of `NETWORK_SEAMS`, and a refused credential at the bundle's host still fails as `StoredCredentialRejectedError`.**

## Performance

- **Duration:** about 47 min
- **Started:** 2026-11-27T20:38:00Z (approximate; worktree base `672db01`)
- **Completed:** 2026-11-27T21:25:00Z
- **Tasks:** 2 (2 commits)
- **Files modified:** 33 (0 created, 28 modified, 5 deleted)

PLAN_BASE: `672db01f7456de1b5ee8a53d89ee4ebc12bc03e9` (the worktree base).

## Accomplishments

- `platform/git.ts` declares `export interface GitAuthBundle { readonly host: string }`. Its doc cites GAUTH-03, D-1-03, D-SG-27, and GAUTH-04: the bundle is the host whose stored credential a request to it uses, a refusal maps to `StoredCredentialRejectedError` only for a request to that host, and an omitted bundle is the public-only path. The import from the credential module is gone. `GitCredentials` and its doc are deleted, because no reader is left. The header's "NOT exposed" bullet now points at the bundle declared in this module. `runWithAuthBundle` keeps its one mapping (`StoredCredentialRejectedError(auth.host, { cause: error })`).
- `orchestrators/marketplace/shared.ts` imports the bundle type from `platform/git.ts`, beside `ListRemotesResult` and `SshProbeResult`, and still re-exports it. Its doc says the type is declared in `platform/git.ts`, that git asks the user's own helpers, and that the bundle decides only what a refused credential leads to.
- `orchestrators/auth-host.ts`: `authBundleFor` returns `{ host: hostFromCloneUrl(cloneUrl, kind) }`. `DEFAULT_CREDENTIAL_OPS`, `CREDENTIAL_TIMEOUT_MS`, the `createCredentialOps` composition, and both imports from the credential module are deleted. The bundle type comes from `./marketplace/shared.ts`. The module doc describes the host binding (GHB-02 included), the GAUTH-04 hint, and the new gate status. The `NO_STORED_CREDENTIAL_CAUSE` doc no longer cites `buildAttributeBlock` or `credentialFill`. It now explains the pipeline and the word "obtained" in terms of git's own helper lookup. The hint text itself is unchanged.
- `eslint.config.js`: `GIT_PROCESS_IMPORTERS` is `["./extensions/pi-claude-marketplace/platform/git.ts"]`, and its comment says every other module reaches git through `platform/git.ts` behind `GitOps`. The `GIT_PROCESS_ZONE` message reads "only ... may import platform/git-process.ts". The comment of the block that ignores the importers no longer says "two". `NETWORK_SEAMS` drops the auth-host entry and its D-79-05 reason.
- `test/architecture/no-shell-out.test.ts`: the `platform/git-credential.ts` importer row is gone. The `platform/other.ts` row still proves that a platform file not on the list is refused, and the `orchestrators/auth-host.ts` row still proves auth-host is refused. The spawn-site doc names `platform/git.ts` as the only importer and no longer names a credential launch.
- `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`: the module is removed from `CREDENTIAL_LEAK_TARGETS`, from the destructuring (`GIT_CREDENTIAL_FILE`), and from `DECLARED_MODULE_ORDER`, all together. The credential module's Error scan and its only helper constant, `ERROR_LITERAL_CALL_SITE`, are deleted. The hookDebugLog scan's `SCANNED` is `[GIT_PLATFORM_FILE]`, its `scannedCallSites > 0` check stays, and its comment says `platform/git.ts` carries the calls (the ssh probe and settings reads) and the scan keeps a credential field out of them. The header's second point names `platform/git.ts` and `platform/git-process.ts`.
- Test sweep: every bundle literal is `{ host: "<host>" }`, and every `{ kind, host }` projection is a whole-bundle `{ host }` assertion. Every credential fake, its import, and the options that carried it are gone (see "Deleted and changed cases").
- Task 2: the comments in `platform/git-process.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/exec-timer.ts`, `bridges/hooks/async-rewake/registry.ts`, and `shared/fs-utils.ts` name only what exists. The git process module may be imported by `platform/git.ts` alone. The three hooks comments list the five spawn sites that `child-process-chokepoint` admits, with `platform/git-process.ts` as the one that starts every git process. fs-utils names `GitOps`, `GitHubSshOps`, and `RenameOps` as the optional ports that still travel with a `?? DEFAULT_*` fallback.

### OQ3 as applied

auth-host leaves `NETWORK_SEAMS`. After Task 1 its imports are `shared/github-base-url.ts` (value), `domain/source.ts` (type), and `./marketplace/shared.ts` (type `GitAuthBundle`). It names no `platform/git*` specifier, no `gitOps`, no `DEFAULT_GIT_OPS`, no `DEFAULT_GITHUB_SSH_OPS`, and no `refreshCloneBySwap`. So BLOCK F lints it from this commit, and `npm run lint` passed both in `check:static` and in the commit hook. ARCHITECTURE.md's seam count (19) is still stale. 05-13 corrects it, as the plan's flagged assumption says.

### Deleted files

- `extensions/pi-claude-marketplace/platform/git-credential.ts`
- `test/platform/git-credential.test.ts`
- `test/platform/credential-ops-contract.ts`
- `test/platform/credential-ops-fake.ts`
- `test/platform/credential-ops-fake.test.ts`

### Deleted symbols

`CredentialOps`, `CredentialGit`, `CreateCredentialOpsOptions`, `createCredentialOps`, `NODE_CREDENTIAL_GIT`, and the module's private helpers (`sanitizeAttrValue`, the attribute-block builder, the fill/approve/reject bodies). Also `GitCredentials` (`platform/git.ts`), `DEFAULT_CREDENTIAL_OPS` and `CREDENTIAL_TIMEOUT_MS` (auth-host), and the bundle's `kind` and `credentialOps` members. Test-side: `createCredentialOpsFake`, `CredentialOpsFake`, `registerCredentialOpsContract`, `storedCredentials` (`git.test.ts`), `withBundleFields` (`marketplace/update.test.ts`), and `ERROR_LITERAL_CALL_SITE` (`no-credential-leak.test.ts`).

### Deleted and changed cases

Deleted whole modules (every case in them):

- `test/platform/git-credential.test.ts`: `describe("NODE_CREDENTIAL_GIT")` with `D-SG-04, WR-05: runs git credential through this process's git`. Then `describe("createCredentialOps")` with `binds the git process without running git`, `AUTH-08: fills a credential from the complete git wire response`, `AUTH-08: returns null when the fill run rejects`, `returns null without a username`, `returns null without a password`, `` sends a complete credential with the complete wire request to ${action} `` (approve and reject), `` AUTH-09: swallows a failed ${action} run and logs only its message `` (approve and reject), `omits absent credential fields from an approve request`, and the registered credential-ops contract cases. It also held the type-level checks for the retired composed default, the `CredentialOps` shape, and the `CredentialGit` action set.
- `test/platform/credential-ops-fake.test.ts`: `describe("createCredentialOpsFake")` with `keeps the source-defined contract case order`, `requires the explicit memory boundary`, `detects only the mutable returned-credential alias defect`, and the contract cases.
- `test/platform/credential-ops-contract.ts` (the contract both registered): `returns null for a missing credential`, `returns an approved credential`, `approves without returning a value`, `copies an approved credential before storing it`, `returns a credential copy that cannot mutate stored state`, `overwrites a credential for the same host`, `keeps credentials for different hosts independent`, `rejects the matching credential`, `keeps a credential when rejection attributes do not match`, `treats repeated rejection as an idempotent no-op`, and the 21 `rejects {newline|carriage return|NUL} in {fill host|approve host|approve username|approve password|reject host|reject username|reject password}` cases.

Deleted cases in kept modules:

- `test/orchestrators/auth-host.test.ts`: `gives every address the same production credential surface`. Its only point was the bundle's credential surface.
- `test/architecture/no-credential-leak.test.ts`: `AUTH-09: platform/git-credential.ts never interpolates a password in an Error message`.
- `test/architecture/no-shell-out.test.ts`: the `platform/git-credential.ts` row of `` D-SG-01: the git process import gate reports ${violations.length} violations for ${importer} ``.
- `test/platform/git.test.ts`: the type-level line `satisfies GitCredentials`.

No case asserting that a public clone never consults the helper existed as its own test. `clone-cache.test.ts`'s `publicCloneAuth` helper held throwing helper stubs. It is now `{ host: "example.com" }`, and its 55 call sites are unchanged.

Retitled:

- `git.test.ts`: `GAUTH-04: a missing credential under a stored-credential bundle is thrown as it failed, and git runs once` is now `GAUTH-04: a missing credential under a bundle is thrown as it failed, and git runs once`. `D-1-03: a stored-credential bundle for another host throws a refused credential's failure unchanged` is now `D-1-03: a bundle for another host throws a refused credential's failure unchanged`.
- `marketplace/add.test.ts`: `AUTH-01 add: the clone carries the stored-credential bundle of github.com` is now `AUTH-01 add: the clone carries the bundle of github.com`.
- `marketplace/update.test.ts`: `AUTH-02 update: the re-clone carries the stored-credential bundle of github.com` is now `AUTH-02 update: the re-clone carries the bundle of github.com`.
- `plugin/fetch.test.ts`: `a pinned GitHub clone's bundle carries the production credential surface by reference` is now `a pinned GitHub clone's bundle is bound to github.com`.
- `plugin/update-flow.test.ts`: `PUP-2 / AUTH-02: the github marketplace sync check carries a github.com bundle over the production credential surface` is now `PUP-2 / AUTH-02: the github marketplace sync check carries the github.com bundle`. `plugin update authentication: a pinned provider update gives the clone a github.com bundle over the production credential surface` is now `... gives the clone the github.com bundle`. `plugin update authentication: an unpinned provider update gives the mirror a github.com bundle over the production credential surface` is now `... gives the mirror the github.com bundle`.
- `plugin/install-flow-ledger.test.ts`: `plugin install authentication: threads a github.com bundle over the production credential surface to the pinned clone` is now `plugin install authentication: threads the github.com bundle to the pinned clone`. `plugin install authentication: threads a gitlab.com bundle over the production credential surface onto the canonical clone` is now `plugin install authentication: threads the gitlab.com bundle onto the canonical clone`.
- `plugin/update-preflight.test.ts`: `D-3-04: gives the autoupdate cascade a github.com stored-credential bundle when it has no notification context` is now `D-3-04: gives the autoupdate cascade the github.com bundle when it has no notification context`.

Changed assertions (no title change): the bundle rows of `auth-host.test.ts` (`GAUTH-03 / D-SG-17 / D-SG-23`, `GHB-02 / D-SG-21`, `D-04`, `GHB-04`) assert `{ host }` for the whole bundle. Whole-bundle `{ host }` assertions replaced the `{ kind, host }` projections in `marketplace/{add,update,clone-swap}.test.ts`, `plugin/{fetch,reinstall-flow,install-outcome,dependency-tag-probe,install-clone-probe,marketplace-tag-probe,update-flow,install-flow-ledger,update-preflight,clone-cache}.test.ts`, `platform/git-ops-fake.test.ts`, and `platform/git.test.ts`. `clone-cache.test.ts`'s OQ-4 warm-mirror case compares the recorded bundles (`auths`) where it compared their kinds (`authKinds`).

### Suite counts

- Task 1 `check:static`: typecheck, lint, lint:workflows, fallow, test:corresponding, and check:features passed. The first run's format:check flagged `test/orchestrators/auth-host.test.ts` and `test/platform/git.test.ts`. Prettier fixed both, and the hook's `check:static` passed on the commit.
- Task 1 unit verify (the plan's 16 modules plus `reinstall-flow`, `dependency-tag-probe`, and `install-clone-probe`): 2129 tests, 2129 passed. Tracer gate re-run on the committed tree (interactive, `end-of-phase`, automated-only verify), the plan's 16 modules: 1907 tests, 1907 passed.
- Task 1 cucumber verify, adapter (`marketplace/git-source`, `marketplace/credentials`, `plugin/credentials`): 55 scenarios, 55 passed (710 steps).
- Direct coverage (`npm run test:coverage:direct --` `platform/git.ts`, `orchestrators/auth-host.ts`, `orchestrators/marketplace/shared.ts`): exit 0, all at 100%.
- Mutation (GUARD on `StoredCredentialRejectedError(auth.host`): with the mapping replaced by `throw error`, `--test-name-pattern GAUTH-04` on `test/platform/git.test.ts` fails 3 of 8 cases. The file was restored, and `git diff` on it is empty.
- Task 2 verify: `grep -rlE 'git-credential\.ts|CredentialOps|DeviceFlowHttp' extensions | wc -l` is 0. `npm run --silent format:check` exit 0.
- Commit hooks: `npm run check:commit` passed on `1ae11e7` and `d1cf125`. On `1ae11e7` it ran every pair's direct coverage, because the commit stages `test/architecture/gate-targets.ts` and deletes support files under `test/`.
- Plan verification, `features/marketplace features/plugin`: adapter 1539 scenarios, 1539 passed (18456 steps). Builtin 42 scenarios, 42 passed (544 steps). `git diff --stat 672db01..HEAD -- features` is empty. `test:unpaired` ran inside both commit hooks and passed.

## Task Commits

1. **Task 1: A git request carries only the host whose stored credential it uses, and the credential module is gone, end to end** - `1ae11e7` (refactor)
2. **Task 2: No comment names the deleted credential module or its seam types** - `d1cf125` (docs)

Neither task is a TDD task, so there is no RED commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts`: declares `GitAuthBundle { host }`. `GitCredentials` is gone
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`: `authBundleFor` returns `{ host }`. No credential composition
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`: re-exports the bundle from `platform/git.ts`
- `eslint.config.js`: one git process importer. auth-host is out of `NETWORK_SEAMS`
- `test/architecture/{gate-targets.ts,no-credential-leak.test.ts,no-shell-out.test.ts}`: registry, scans, and importer rows without the module
- 16 test modules under `test/orchestrators/` and `test/platform/`: `{ host }` bundles
- `extensions/pi-claude-marketplace/{platform/git-process.ts,bridges/hooks/dispatch-exec.ts,bridges/hooks/exec-timer.ts,bridges/hooks/async-rewake/registry.ts,shared/fs-utils.ts}`: comments name only existing modules and ports
- Deleted: the five files under "Deleted files"

## Decisions Made

- OQ3: auth-host left `NETWORK_SEAMS` (see "OQ3 as applied").
- `ERROR_LITERAL_CALL_SITE` and `withBundleFields` were deleted with their only readers, so no unused local is left behind.
- `test/architecture/gate-targets.ts`'s `git-process.ts` comments still mention the `git credential` request that module can run. That is still true until 05-11 removes the subcommand, so they were left alone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three test modules outside the file list carried `{ kind, host }` projections**
- **Found during:** Task 1 (the sweep grep)
- **Issue:** `test/orchestrators/plugin/reinstall-flow.test.ts`, `dependency-tag-probe.test.ts`, and `install-clone-probe.test.ts` held `"stored-credential"` literals and `.kind` projections that no longer typecheck, and the acceptance grep requires 0.
- **Fix:** Swept like the listed modules: each is a whole-bundle `{ host }` assertion.
- **Files modified:** the three modules
- **Verification:** tsc exit 0, and 2129 of 2129 unit tests passed
- **Committed in:** `1ae11e7`

**2. [Rule 3 - Blocking] Credential-surface wording in test titles**
- **Found during:** Task 1 (step 5's comment rule)
- **Issue:** Eight test titles still named the "production credential surface" or a "stored-credential bundle", which the bundle no longer has.
- **Fix:** Retitled (see "Retitled").
- **Committed in:** `1ae11e7`

---

**Total deviations:** 2 auto-fixed (both blocking)
**Impact on plan:** Three more test modules were swept, and several cases were retitled. No behavior, scenario, or user-visible text changed.

## Issues Encountered

None beyond the deviations.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-18 (mitigate): the module that ran `git credential fill`, `approve`, and `reject` is deleted, and `GIT_PROCESS_IMPORTERS` admits only `platform/git.ts`. No extension module can erase or overwrite a stored credential (D-SG-28). The `credential` subcommand in `platform/git-process.ts` is 05-11's. T-05-19 (mitigate): auth-host is out of `NETWORK_SEAMS`, so BLOCK F lints it, and a later `platform/git` import or `gitOps` name in it fails `npm run lint`. T-05-SC (mitigate): no package was added, removed, or upgraded.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and this plan leaves no stub, skipped test, or unrun verify.

## Next Phase Readiness

- 05-11 can remove the `credential` subcommand from `platform/git-process.ts`. It has no caller left, because `NODE_CREDENTIAL_GIT` is deleted. The `gate-targets.ts` comments on the git process module's credential stdin and stdout go with it.
- 05-13: ARCHITECTURE.md still lists auth-host among the 19 `NETWORK_SEAMS` and names `platform/git-credential.ts` as a git process importer.

## Self-Check: PASSED

- The five deleted files are absent. `platform/git.ts` holds `export interface GitAuthBundle` once.
- Commits `1ae11e7` and `d1cf125` are ancestors of HEAD. `git rev-list --count 672db01..HEAD` is 2 before this SUMMARY commit.
- Acceptance: `"stored-credential"` literals 0; files naming `credentialOps` 0; files naming `createCredentialOpsFake` 0; `platform/git-credential.ts` in `eslint.config.js` 0; `orchestrators/auth-host.ts` in `eslint.config.js` 0; `GIT_CREDENTIAL_FILE` 0; `StoredCredentialRejectedError(auth.host` in `git.ts` 1; Task 2 grep 0.

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*
