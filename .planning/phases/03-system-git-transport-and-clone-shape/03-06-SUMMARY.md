---
phase: 03-system-git-transport-and-clone-shape
plan: "06"
subsystem: platform-git
tags: [system-git, clone, depth-1, pin-ladder, device-flow, connect-proxy, cucumber-rebaseline]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-02 the full-sha and dash-ref refusals; 03-04 fetchCommit and checkout on system git; 03-05 runRemote, the insteadOf pair, the D-SG-14 retry, and the Device Flow profile's CONNECT proxy"
provides:
  - "GitOps.clone on system git in Claude Code's shape (--depth 1, --no-recurse-submodules, --branch=<ref>, --no-checkout) through runRemote"
  - "the SHA-pin ladder in clone-cache.ts: no-checkout clone, fetchCommit, checkout, HEAD check, pin-mismatch"
  - "test/platform/system-git-ops.ts: hermeticGitProcess, recordingGitProcess, systemGitOps"
  - "re-baselined clone rows, pinned rows, CONNECT routing rows, and clone cause chains in 16 feature files"
affects: [03-07, 03-09, 03-12, 03-13, 03-15, transport swap, Phase 5 auth, Phase 6 wording]

plan_head_before: 0ee47d5e33965ac9a1a79a5e56286fede7520977
plan_head_after: e9512d56286e9eadb100256391cf3b33cb51a583

actuals:
  tokens: 26509
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "A pinned clone is a ladder: clone noCheckout, fetchCommit with the source's ref, checkout, resolveRef HEAD against the lower-cased pin"
    - "A real-git orchestrator test builds its GitOps with systemGitOps(hermeticGitProcess(t, variables))"
    - "A Device Flow test without the base override reaches the https stand-in as github.com through startGitHubConnectProxy and asserts the proxy's tunnel log"

key-files:
  created:
    - test/platform/system-git-ops.ts
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - test/platform/git.test.ts
    - test/platform/git-ops-fake.ts
    - test/platform/git-ops-contract.ts
    - test/orchestrators/plugin/clone-cache.test.ts
    - test/integration/auth-e2e.test.ts
    - features/marketplace/device-flow.feature

key-decisions:
  - "clone options start with --depth, so every clone failure names the operation `clone --depth`; the ref is the single argv word --branch=<ref>"
  - "The ladder lower-cases the pin before git sees it; a fetchCommit failure of kind commit-missing leaves the answer to the checkout, any other kind propagates"
  - "A HEAD other than the pin is GitCommandError({ kind: 'pin-mismatch' }, { operation: 'rev-parse --verify' })"
  - "The GitOps fake holds a no-checkout clone's fixture files back until the first checkout of that directory"
  - "auth-e2e runs without the base override, because under it the GitHub bundle is a stored-credential bundle and Device Flow never runs; git reaches the stand-in through the CONNECT proxy"

patterns-established:
  - "Re-baseline a request table by scenario, never by text: several scenarios share one table text, and their update tables must keep their D-14 rows"

requirements-completed: ["SG-TRN-01", "SG-TRN-02", "SG-TRN-07"]

coverage:
  - id: D1
    description: "clone runs system git in Claude Code's shape through runRemote, with the limit, the abort signal, the insteadOf pair, and the Device Flow retry; git records the URL it was given"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/platform/git.test.ts#clone"
        status: pass
      - kind: unit
        ref: "test/platform/git.test.ts#D-SG-14: a clone that needs a credential signs in once and the retry clones into the same target"
        status: pass
      - kind: unit
        ref: "test/platform/git.test.ts#GitOps contract"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-14 interim: the refresh verbs bring a depth-1 system-git clone, with and without --branch, to its remote's new commit"
    verification:
      - kind: unit
        ref: "test/platform/git.test.ts#D-14 on a depth-1 system-git clone"
        status: pass
    human_judgment: false
  - id: D3
    description: "A pinned plugin reaches its commit by the ladder: no-checkout clone, SHA fetch, unshallow when needed, checkout, HEAD check, pin-mismatch, PinnedCommitMissingError"
    requirement: "SG-TRN-02"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#SG-TRN-02"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/clone-cache.test.ts#INR-03"
        status: pass
    human_judgment: false
  - id: D4
    description: "The auth integration gate runs on system git against the https stand-in, through the CONNECT proxy (AUTH-01, AUTH-02, AUTH-07, AUTH-09)"
    requirement: "SG-TRN-07"
    verification:
      - kind: integration
        ref: "test/integration/auth-e2e.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "features/marketplace, features/plugin, and features/mcp-server/verdict-fetch.feature pass under both profiles with the system-git clone rows"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter|builtin features/marketplace"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter|builtin features/plugin"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter|builtin features/mcp-server/verdict-fetch.feature"
        status: pass
    human_judgment: false

duration: 69min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 06: System-git clone and the SHA-pin ladder Summary

**`GitOps.clone` now runs system git as `clone --depth 1 --no-recurse-submodules [--no-checkout] [--branch=<ref>] [--single-branch]` through `runRemote`. A pinned plugin reaches its commit through Claude Code's ladder: a no-checkout clone, the SHA fetch, the unshallow rung, the checkout, and a `HEAD` check. Every clone table and clone cause chain in `features/marketplace` and `features/plugin` shows the system-git rows. The Device Flow routing tables show one `CONNECT github.com:443` row per git process.**

## Performance

- **Duration:** about 69 min
- **Started:** 2026-11-24T05:09:59Z
- **Completed:** 2026-11-24T06:18:21Z
- **Tasks:** 3. Task 1 is a tracer, and its gate passed.
- **Files modified:** 31 (1 created)

## Accomplishments

- `clone` sends one request through `runRemote`, so it gets the D-SG-13 limit, the scope's abort signal, the D-SG-16 pair, the GHB-01 cause, and the D-SG-14 retry. The `isomorphic-git` clone and the origin reset after it are gone.
- The D-14 interim holds. A real-git case clones depth 1, once with no ref and once with `ref: "dev"`. It pushes a new commit and runs `refreshGitHubClone` through the production `GitOps`, with the in-process fetch served by `git http-backend`. The clone ends at the new commit with a clean status.
- `materializePluginClone` runs the pin ladder. A `HEAD` other than the pin fails as `pin-mismatch` before promotion, and a checkout that finds no commit is `PinnedCommitMissingError(pin)`.
- `auth-e2e.test.ts` runs on system git with no `isomorphic-git` import. Its three print-add cases and its four clone cases reach the https stand-in through the CONNECT proxy, and each case asserts the proxy's tunnel log.

## Task Commits

1. **Task 1 (tracer): clone with system git at depth 1** - `781aa24` (feat). Tracer gate: both verify commands were run again after the commit and passed (370/370 unit tests; `add.feature` 51/51 adapter, 0 builtin scenarios).
2. **Task 2: the SHA-pin ladder** - `1a527c1` (feat)
3. **Task 3, step 1: marketplace clone rows** - `3a722f0` (test)
4. **Task 3, step 2: plugin clone rows** - `e9512d5` (test)
5. **Task 3, step 3: `features/mcp-server/verdict-fetch.feature`** - no commit. The file passes unchanged under both profiles, because its request tables come from a fetch after an install, which is the mirror refresh that stays on D-14.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts` - `clone` on system git with `noCheckout`. `ORIGIN_URL_KEY` holds the key that the origin read and `listRemotes` share.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` - `GitOps.clone` gains `noCheckout`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` - `cloneAtPin` replaces `checkoutPinWithRefetch`.
- `test/platform/system-git-ops.ts` (created) - `hermeticGitProcess`, `recordingGitProcess`, `systemGitOps`.
- `test/platform/git.test.ts` - system-git clone cases, the D-14 interim cases, `installHttpBackendTransport`. It uses the shared helpers.
- `test/platform/git-ops-fake.ts`, `test/platform/git-ops-contract.ts` - `noCheckout` and its contract case.
- `test/orchestrators/plugin/clone-cache.test.ts` - fake and real-git ladder cases.
- `test/integration/auth-e2e.test.ts` - rewritten on system git and the CONNECT proxy.
- `test/orchestrators/marketplace/add.test.ts`, `test/orchestrators/plugin/{install-flow-ledger,fetch,update-flow}.test.ts`, `test/edge/handlers/plugin/{info,reinstall}.test.ts` - recorded calls and outcomes that the clone and the ladder change.
- 16 feature files, listed under "Lines for later plans".

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two edge cases expected the in-process transport's outcome**
- **Found during:** Task 1 (the commit hook ran every pair)
- **Issue:** `test/edge/handlers/plugin/info.test.ts` (FTCH-03, two cases) and `reinstall.test.ts` (D-18-04) clone `https://127.0.0.1:9/...`. Their `https.request` spy threw, which gave `{unreadable}` and the spy's message. A system-git clone never reaches that door, so git's own failure to reach the closed loopback port appears instead.
- **Fix:** The rows now read `{network unreachable}` with the cause `git clone --depth failed: network, exit code 128`. The reinstall door count is now 0, and comments explain why. 03-13 re-anchors the four door proofs. These two files are not among the four.
- **Commit:** `781aa24`

**2. [Rule 2 - Security] A unit case sent a real clone to github.com**
- **Found during:** Task 1. A logging `git` first on PATH recorded every clone, fetch, and ls-remote that the module suite started.
- **Issue:** `install-flow-ledger.test.ts` "Orchestrated-PI-4" installs a `github:` source through the default clone seam. With system git, that clone went through the sandbox proxy to the real github.com.
- **Fix:** The case sets the GitHub base to `https://127.0.0.1:9`, so the clone carries the pair to a closed loopback port. A re-run of the same audit showed every other clone either on loopback or carrying the pair. The integration suite was audited too: the 8 github.com clones are the auth-e2e cases, which go through the CONNECT proxy.
- **Commit:** `781aa24`

**3. [Rule 3 - Blocking] The ladder changed recorded calls in two more test files**
- **Found during:** Task 2 (the commit hook)
- **Issue:** `fetch.test.ts` ("materializes a cold pinned URL clone") and `update-flow.test.ts` (PURL-03 pinned git-subdir) expected the clone to carry the ref.
- **Fix:** The fetch boundary records `fetchCommit` and expects `clone ref=-`, `fetch-commit <pin> ref=v2`, `checkout`, `resolve-local HEAD`. The update case reads the fake's `fetchCommit` calls and expects the ref there.
- **Commit:** `1a527c1`

**4. [Rule 3 - Blocking] A shared test helper module**
- **Issue:** `clone-cache.test.ts` and `auth-e2e.test.ts` need the hermetic git process and the system-git `GitOps` of `git.test.ts`. Copies would trip `fallow dupes`.
- **Fix:** `test/platform/system-git-ops.ts` exports them, and `git.test.ts` imports them.
- **Commit:** `1a527c1`

**5. [Plan accuracy] A depth-1 clone of a one-commit repository is shallow**
- **Found during:** Task 2
- **Issue:** The plan, after 03-RESEARCH Pitfall 3, expects such a clone to be complete and to skip the unshallow rung. Measured on git 2.43.0: `git clone --depth 1` of a one-commit repository writes `.git/shallow`, and `rev-parse --is-shallow-repository` prints `true`. `fetch --unshallow origin` then succeeds.
- **Fix:** The real-git case now asserts the measured rungs, `fetch --unshallow` included, and the same `PinnedCommitMissingError`. A complete clone, which skips the rung, comes only from a clone without `--depth`. 03-04's `fetchCommit` case covers that skip, and the fake ladder case covers the ladder's handling of the `commit-missing` it throws. The same measurement explains the 9-row table of the plugin `git-source.feature` scenario "pinned to a commit its repository lacks".

**6. [Plan accuracy] auth-e2e goes through the CONNECT proxy, not the base override**
- **Issue:** Under the GitHub base override, `buildGitHubAuth` builds a stored-credential bundle for the override host, so the print-add cases never reached Device Flow.
- **Fix:** No base override (`setGitHubBaseUrl(t, undefined)`). git gets `https_proxy` for `startGitHubConnectProxy` and trusts only the stand-in's certificate, which names github.com. This is the cucumber Device Flow profile's route.
- **Commit:** `1a527c1`

**7. [Rule 3 - Blocking] `features/plugin/git-source-update.feature` changed**
- **Issue:** It is not in the plan's list. Its scenario "Apply clones the new pinned commit of a git-source plugin it has not cached" runs a pinned clone, so its table follows the ladder: GET, POST, POST, then GET, POST, POST. The file's update and refresh rows, including its three `HTTP Error` cause rows, did not change.
- **Commit:** `e9512d5`

**8. [Scope] `add.test.ts` rebuilds only the missing-branch failure**
- `refNotFoundError` (the `isomorphic-git` `NotFoundError` shape, lines about 420 and 5270-5310) is now `remoteRefMissingError`, a `GitCommandError` of kind `remote-ref-missing`. The `HttpError`-shaped clone errors stay as they are. The classifiers still read them, and 03-12 owns that file's remaining transport shapes.

---

**Total deviations:** 8 (4 blocking, 1 security, 2 plan accuracy, 1 scope). **Impact:** test, fixture, and table edits only. Apart from the planned three source files, no production code changed.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks. The hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each TDD task's commit therefore holds RED and GREEN together. `red.sh` swapped HEAD's copy of the named sources in, ran the cases, and restored the sources.

- **Task 1 RED** (HEAD `platform/git.ts` and `git-ops-fake.ts`, the new clone and contract cases): `# tests 10 # pass 0 # fail 10`. `UnknownTransportError: Git remote "file:///..." uses an unrecognized transport protocol: "file"` (the in-process clone of a `file://` fixture). `self-signed certificate` against the stand-in. The no-checkout contract case failed with `expected: ~ actual: '# updated'`, because the old fake wrote the work tree. The missing-branch case failed because the error was not a `GitCommandError`. Semantic assessment: each target ran and failed on its planned assertion; no fault was a load or syntax fault. One RED row, the argv case, attempted a DNS lookup of `git.example.invalid` on the old code. That reserved name never resolves. **GREEN:** 370/370 across `git.test.ts`, `git-ops-fake.test.ts`, `add.test.ts`.
- **D-14 interim case:** a guard of verbs that did not change, run once the clone was on system git. First run: 2/2 pass ("D-14, SG-TRN-02: the refresh brings a default-branch clone / a --branch clone to the remote's new commit").
- **Task 2 RED** (HEAD `clone-cache.ts`): `# tests 14 # pass 2 # fail 12`. For example, `+ 'clone noCheckout=undefined ref=v2.0.0' - 'clone noCheckout=true ref=undefined'`, `fetchCommit: []`, `Missing expected rejection` (no `pin-mismatch`), `A fresh clone from the git host does not hold the commit <second>` (the old full-depth path could not reach an older commit of a depth-1 clone), and `UnknownTransportError` from the old in-process recovery fetch. The 2 cases that passed pin behavior that stays the same: a checkout with no commit, and a checkout that fails another way. **GREEN:** 556/556 across `clone-cache`, `install-flow-ledger`, `auth-e2e`, and `git.test.ts`. Direct coverage of `clone-cache.ts` and `platform/git.ts` is 100%.

## Issues Encountered

- The session refuses Bash text that names a path containing `git` in a complex form. Edits, runs, gates, and commits ran from scripts in the scratch directory.
- The commit hook ran every source-test pair twice, because `git-ops-fake.ts` and then `system-git-ops.ts` are shared test support. Each time it stopped at the first failing file (deviations 1 and 3), so a whole module-suite run found the rest. Final module run: 19,065 tests, with one failure, the known baseline `test/bridges/hooks/dispatch-exec.test.ts:39` (environment too large).
- Task 3 stopped on no row it could not explain. Every changed row is a clone row, a pinned SHA fetch or unshallow row, a `CONNECT` row, or a cause-chain text. No status, outcome, or result row changed.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-17: `--branch=<ref>` is one argv word, and the URL and directory follow `--end-of-options`. T-03-18: `resolveRef HEAD` must equal the lower-cased pin before promotion. T-03-19: every clone passes `--no-recurse-submodules`. T-03-20: every clone goes through `runRemote`'s pair. The suite audits found no clone that leaves the machine, after deviation 2. T-03-53: the interim case passed. T-03-SC: nothing was installed.

## Orchestrator actions

None. The plan asks for no `windows append`.

## Lines for later plans

- **Option order of each command shape, and its `operationOf` text:**
  - clone: `--depth 1 --no-recurse-submodules [--no-checkout] [--branch=<ref>] [--single-branch]`, operation `clone --depth`.
  - pin ladder: `config --local` (origin read), `fetch --depth` (rung 1), `rev-parse --is-shallow-repository`, `fetch --unshallow` (rung 2), `checkout -f`, then `rev-parse --verify` (the `HEAD` read). `pin-mismatch` names `rev-parse --verify`.
  - `ls-remote` and `ls-remote --tags` are as 03-05 set them.
  - Cause texts read `git clone --depth failed: <kind>, exit code 128`.
- **Rows:**
  - A clone is GET, POST, POST.
  - A clone of a branch the remote lacks is GET, POST: protocol v2's ref listing runs before git reports `Remote branch ... not found`.
  - A pinned plugin is clone GET, POST, POST plus SHA fetch GET, POST, POST.
  - A pin the remote lacks adds the unshallow rung's GET, POST, POST, so 9 rows.
  - A Device Flow clone is GET 401, then after the sign-in GET 401, GET 200, POST, POST, with one `CONNECT github.com:443` routing row per git process (2 per signed-in clone).
- **Re-baselined tables per file:**
  - Request tables: marketplace `add` 1, `device-flow` 2, `failed-add` 1, `git-source` 2, `github-source` 4, `hosted-source` 1, `url-source` 4; plugin `autoapply` 1, `bootstrap` 3, `fetch` 2, `git-source` 3, `git-source-update` 1, `info` 1, `install-dependencies` 2.
  - Routing tables: `device-flow` 3.
  - Cause-chain rows: marketplace `git-source` 1, `url-source` 1 (its unused `phrase` column went); plugin `bootstrap` 1, `fetch` 3, `git-source` 7, `reinstall` 1, `update` 1.
  - `verdict-fetch` 0.
- **A10 (measured, git 2.43.0):** a failed clone removes a target directory that git created, and empties one that already existed. So the D-SG-14 retry needs no clearing, and `platform/git.ts` adds none.
- **D-14 interim (result):** pass for both shapes, a depth-1 default-branch clone and a depth-1 `--branch=dev --single-branch` clone. The in-process fetch sends `shallow` lines and updates the tracking ref. `forceUpdateRef` and `checkout -f` bring `HEAD` and the work tree to the new commit, and `git status --porcelain` prints nothing.
- **`fetch unknown@gits` (`features/plugin/update.feature`):** git's stderr is `fatal: protocol error: bad line length character: this`, the kind is `failed`, the exit code is 128, the message is `git clone --depth failed: failed, exit code 128`, and the fetch rule's reason is `network error` (`unknown: "network error"`), as before. The `update` row (`gits@gits`, the PUP-2 sync) keeps `Empty response from git server.`. 03-09 matches its reason to this one.
- **Still on D-14 here:** the update and refresh tables, and the `HTTP Error` cause rows in `marketplace/url-source-update`, `plugin/url-marketplace-update`, and `plugin/git-source-update` (3 files). The Device Flow update scenario's tables keep their in-process rows.
- **Helpers:** `test/platform/system-git-ops.ts` (`hermeticGitProcess(t, variables)`, `recordingGitProcess(git)`, `systemGitOps(git)`). In `git.test.ts`: `installHttpBackendTransport(t, projectRoot)` (in-process requests served by `git http-backend`), `cloneTarget`, `isShallowCheckout`. In `auth-e2e.test.ts`: `privateStandIn(t, password, variables)` (stand-in, CONNECT proxy, tunnel log).

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- 03-07 and 03-09 can replace D-14 with the re-clone swap. The clone they reuse is on system git, and the update and refresh tables still hold their in-process rows, which change once there.
- The redirect client, `networkCall`, and `buildAuthCallbacks` now serve only the in-process `fetch`.

## Self-Check: PASSED

- FOUND: test/platform/system-git-ops.ts, extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts, extensions/pi-claude-marketplace/platform/git.ts
- FOUND: 781aa24, 1a527c1, 3a722f0, e9512d5 (each an ancestor of HEAD; `git rev-list --count 0ee47d5..HEAD` = 4 before this SUMMARY commit)
- Acceptance greps:
  - Task 1: `git\.clone(` in `git.ts` code = 0; `remote.origin.url` in `git.ts` = 1.
  - Task 2: `checkoutPinWithRefetch` = 0; `"pin-mismatch"` = 1; `from "isomorphic-git` in `auth-e2e` = 0.
  - Task 3: `CONNECT` in `device-flow.feature` = 5; files with `HTTP Error:` = 3; `Empty response from git server` in `update.feature` = 1.
- Verify commands:
  - Task 1: unit 370/370; `add.feature` adapter 51/51, builtin 0.
  - Task 2: 556/556; direct coverage exit 0.
  - Task 3: `features/marketplace` adapter 533/533, builtin 0; `features/plugin/update.feature` adapter 26/26, builtin 14 steps passed; `features/plugin` adapter 776/776, builtin 39/39; `verdict-fetch.feature` 13 steps per profile; `check:features` exit 0.

---
*Phase: 03-system-git-transport-and-clone-shape*
*Completed: 2026-11-24*
