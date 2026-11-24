---
phase: 03-system-git-transport-and-clone-shape
plan: "15"
subsystem: platform-git
tags: [system-git, isomorphic-git, gitops, rule-pack, auth-09, sg-trn-01]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-09 moved every refresh to the re-clone swap; 03-12 moved the auth bundle types to platform/git-credential.ts; 03-13 moved every test but test/platform/git.test.ts off isomorphic-git"
provides:
  - "GitOps with six system-git members: clone, fetchCommit, checkout, resolveRef, resolveRemoteRef, listRemotes"
  - "platform/git.ts with no isomorphic-git import, no HTTP redirect client, and no in-process fetch"
  - "isomorphic-git removed from package.json and package-lock.json"
  - "the isomorphic-git-chokepoint rule as a total ban over extensions/pi-claude-marketplace/**"
  - "the AUTH-09 credential-leak gate aimed at platform/git-one-shot-credential.ts in the deleted callback module's slot"
  - "network verbs that find git through their own first run, with no separate lookup (IN-01)"
affects: [03-16, SG-CLS-01]

actuals:
  tokens: 55293
  tasks: 3
  commits: 3
plan_head_before: 386afd2d1499272756e6fd5769b2af5cedc48792
plan_head_after: bc4fdb740ab056bdeba0c2691302e795043be346

tech-stack:
  added: []
  patterns:
    - "A missing-git gate test injects a real git process whose own PATH is an empty directory, so the test process's PATH never changes"
    - "withFetchedUrlCause leaves a git-missing failure without a cause, because git fetched nothing"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/platform/git.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - rule-packs/architecture.json
    - package.json
    - package-lock.json
    - test/platform/git.test.ts
    - test/platform/git-ops-fake.ts
    - test/platform/git-ops-fake.test.ts
    - test/platform/git-ops-contract.ts
    - test/platform/system-git-ops.ts
    - test/shared/errors.test.ts
    - test/architecture/gate-targets.ts
    - test/architecture/no-credential-leak.test.ts
    - test/architecture/partial-vocabulary-guard.test.ts
    - test/integration/standalone-prune.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
  deleted:
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - test/platform/git-auth-callbacks.test.ts

key-decisions:
  - "The isomorphic-git-chokepoint rule was KEPT as a total ban: with no exclude it still matches every extension file, and `fallow rule-pack test` prints no WARN."
  - "withFetchedUrlCause skips a git-missing failure, so dropping the separate lookup keeps SG-PRC-06's 'git-missing with no cause' output under the GitHub base override."
  - "GitCredentials keeps only username and password; headers and cancel were isomorphic-git callback fields that nothing sets now."
  - "The AUTH-09 debug-log scan covers git.ts, git-credential.ts, and git-one-shot-credential.ts (3 hookDebugLog calls in the set: 1 in git.ts, 2 in git-credential.ts)."

patterns-established:
  - "Gate tests for a missing git inject a GitProcess; none rewrites process.env.PATH."

requirements-completed: ["SG-TRN-01"]

coverage:
  - id: D1
    description: "GitOps has no fetch, forceUpdateRef, or currentBranch member, and every remaining contract case passes against the fake and real system git"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/platform/git-ops-fake.test.ts#createGitOpsFake"
        status: pass
      - kind: unit
        ref: "test/platform/git.test.ts#GitOps contract"
        status: pass
    human_judgment: false
  - id: D2
    description: "platform/git.ts imports nothing from isomorphic-git; the redirect client, the callback module, and TooManyRedirectsError are gone"
    requirement: "SG-TRN-01"
    verification:
      - kind: other
        ref: "grep -rn 'from \"isomorphic-git' extensions test features scripts | wc -l == 0; grep -c isomorphic platform/git.ts == 0"
        status: pass
      - kind: other
        ref: "npm run --silent fallow"
        status: pass
    human_judgment: false
  - id: D3
    description: "isomorphic-git is gone from package.json and package-lock.json, and no file imports it"
    requirement: "SG-TRN-01"
    verification:
      - kind: other
        ref: "npx fallow dead-code --trace-dependency isomorphic-git (0 imports); npm ls isomorphic-git (empty)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The rule pack bans isomorphic-git in every extension file, with no WARN from fallow rule-pack test"
    requirement: "SG-TRN-01"
    verification:
      - kind: other
        ref: "node -e (isomorphic-git-chokepoint has no exclude) exit 0; fallow rule-pack test"
        status: pass
    human_judgment: false
  - id: D5
    description: "The AUTH-09 gate scans the one-shot credential module position for position, and its debug-log scan counts at least one call"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/architecture/no-credential-leak.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "A missing git fails each network verb in its own first request with no separate lookup, and the SG-PRC-06 scenarios pass unchanged"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/platform/git.test.ts#SG-PRC-06: the git-required gate"
        status: pass
      - kind: e2e
        ref: "cucumber --profile adapter features/marketplace/without-git.feature features/plugin/without-git.feature"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 15: One git transport Summary

**GitOps runs on system git only: the D-14 fetch, ref update, and branch read, the HTTP redirect client, `platform/git-auth-callbacks.ts`, `TooManyRedirectsError`, and the `isomorphic-git` dependency are deleted, and the rule pack bans `isomorphic-git` in every extension file.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-11-24T11:55:14Z
- **Completed:** 2026-11-24T12:42:36Z
- **Tasks:** 3
- **Files modified:** 20 (18 modified, 2 deleted)

## Accomplishments

- `GitOps` has six members, each on system git: `clone`, `fetchCommit`, `checkout`, `resolveRef`, `resolveRemoteRef`, `listRemotes`.
- `platform/git.ts` has no `isomorphic-git` import and no "isomorphic" in its text. The redirect client (`nextHop`, `sendHop`, `requestWithinOrigin`, `raceAbort`, `abortableBody`, `const http`), `networkCall`, and `fetch` are deleted. The abort scope and `withFetchedUrlCause` stay.
- `isomorphic-git` is out of `package.json` and `package-lock.json` (`npm uninstall` removed 53 packages and added none). `npm ls isomorphic-git` is empty.
- The `isomorphic-git-chokepoint` rule has no `exclude`. Its message cites D-SG-01 and SG-TRN-01.
- The AUTH-09 gate scans `platform/git-one-shot-credential.ts` in the deleted module's slot. Its debug-log scan covers `git.ts`, `git-credential.ts`, and the one-shot module, and counts 3 calls.
- A network verb no longer runs `locate()` before its request (IN-01). A missing git still fails as `git-missing` with no cause, and the SG-PRC-06 scenarios pass unchanged.

## Task Commits

1. **Task 1: GitOps loses the D-14 ref update and branch read, end to end** - `3e7dda8` (refactor)
2. **Task 2: One git transport: the fetch verb, the HTTP client, the callback module, and the dependency are gone** - `367e56c` (feat!)
3. **Task 3: The chokepoint bans isomorphic-git everywhere, and git's absence is the git process module's to report** - `bc4fdb7` (chore)

**Plan metadata:** recorded in the SUMMARY commit.

## TDD Gate Compliance

The commit hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each RED ran locally, and RED and GREEN were committed together. So the task commits are `refactor`, `feat`, and `chore`, not `test` then `feat`. Each RED record went to `.gsd/tdd-evidence/03-15/` (ignored), and `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`) for each.

- **Task 1 RED** (`red1.sh`): the updated `git-ops-fake.test.ts` ran against the base fake (`git show HEAD:test/platform/git-ops-fake.ts`), with `--test-name-pattern='records complete public operation calls|records callable authentication'`. Result: `# tests 2 # pass 0 # fail 2`, exit 1. Both failed on `deepStrictEqual`: the base fake's `calls` held `forceUpdateRef: []` and `currentBranch: []`. Semantic assessment: the target ran and failed on its planned assertion, not at load. **GREEN:** the three task 1 test files ran 201/201.
- **Task 2 RED** (`red2.sh`): the edited `no-credential-leak.test.ts` ran against the base `gate-targets.ts`, with `--test-name-pattern='no credential field name appears in any state-write code path'`. Result: `# tests 1 # pass 0 # fail 1`, exit 1. Position 10 of the registry was `'platform/git-auth-callbacks.ts'` where `DECLARED_MODULE_ORDER` expects `'platform/git-one-shot-credential.ts'`. Semantic assessment: the D-07-03 position pin failed as planned. **GREEN:** the five task 2 test files ran 388/388.
- **Task 3 RED** (`red3.sh`): the new SG-PRC-06 cases ran against `git.ts` with `locate()` still in `runRemote` (`--test-name-pattern='SG-PRC-06'`). Result: `# tests 5 # pass 2 # fail 3`, exit 1. The clone, `resolveRemoteRef`, and `listRemoteTags` cases failed on `{ lookups: 1, subcommands: [] }` against the expected `{ lookups: 0, subcommands: [<verb>] }`. `fetchCommit` passed, because its first request was already its own local `config` read. Semantic assessment: each target failed on the planned lookup-count assertion. **GREEN:** `git.test.ts` and the fake test ran 112/112.

## Files Created/Modified

- `extensions/pi-claude-marketplace/platform/git.ts`: system git only. A new module header; `GitAuthBundle` from `git-credential.ts`; no `FetchOptions` or `fetch`; no redirect client; no lookup in `runRemote`; `isGitMissing` keeps a missing-git failure free of a fetched-URL cause; `GitCredentials` holds `username` and `password`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`: `GitOps` and `DEFAULT_GIT_OPS` lose `fetch`, `forceUpdateRef`, and `currentBranch`. The doc comments describe six system-git members.
- `extensions/pi-claude-marketplace/shared/errors.ts`: `TooManyRedirectsError` deleted. `CrossOriginChallengeError` stays for 03-16.
- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts`, `test/platform/git-auth-callbacks.test.ts`: deleted.
- `rule-packs/architecture.json`: `isomorphic-git-chokepoint` with no `exclude`.
- `package.json`, `package-lock.json`: `isomorphic-git` removed. `base64-js` and `safe-buffer` stay as dev-only packages.
- `test/platform/git-ops-fake.ts`, `git-ops-fake.test.ts`, `git-ops-contract.ts`: no D-14 member, no `fetchError`. The broken-participant check uses a `fetchCommit` that does nothing.
- `test/platform/git.test.ts`: no `isomorphic-git` import and no `process.env.PATH`. The SG-PRC-06 gate runs on an injected git process with an empty search path.
- `test/platform/system-git-ops.ts`: `systemGitOps` binds all six members and no longer spreads `DEFAULT_GIT_OPS`.
- `test/architecture/gate-targets.ts`, `no-credential-leak.test.ts`: the one-shot credential module in the callback module's slot, and the three-module debug-log subject set.
- `test/architecture/partial-vocabulary-guard.test.ts`: the `writeRef` clause is dropped. The `rm({ force: true })` and `options?.force` clauses and every absence check stay.
- `test/integration/standalone-prune.test.ts`, `test/orchestrators/plugin/reinstall-flow.test.ts`, `test/orchestrators/plugin/info.test.ts`: the "no network" assertions read `fetchCommit` instead of `fetch`. The `info.test.ts` wrapper loses its `fetch` override.

## Deleted test cases

Contract cases (`test/platform/git-ops-contract.ts`, run against the fake and real system git):

- "force-updates a ref to the requested commit": `forceUpdateRef` is gone; D-SG-10 replaced the in-place refresh that used it.
- "returns the attached current branch": `currentBranch` is gone, for the same reason.
- "returns undefined for a detached HEAD": `currentBranch` is gone, for the same reason.
- "fetches updated remote state without moving the worktree": `GitOps.fetch` is gone (SG-TRN-01). `fetchCommit` keeps its own case.
- The "checks out the requested branch and worktree" case lost its `currentBranch` assertion. Its HEAD and README assertions stay.

Fake test (`test/platform/git-ops-fake.test.ts`):

- "the no-force-update fake fails only the force-update invariant" became "the no-fetch-commit fake fails only the fetch-commit invariant". The proof that the contract catches a member that does nothing is kept, on a member that still exists.

`test/platform/git.test.ts`, local operations:

- "reports the current branch after the initial commit": `currentBranch` is gone.
- "force-updates the requested local ref": `forceUpdateRef` is gone.
- "SG-PRC-06: the in-process local verbs read and write a clone with no git on the path": no in-process local verb remains. Every local verb runs system git.
- "checks out an existing branch", "SG-TRN-01: checks out the files of a commit the current branch moved to", and "checks out a detached commit" stay. They read the branch with `git rev-parse --abbrev-ref HEAD` and make the branch with `git branch`.

`test/platform/git.test.ts`, `describe("fetch")`. The in-process fetch is gone (SG-TRN-01), and `fetchCommit` and `clone` carry the system-git equivalents (GHB-01, D-SG-16, GAUTH-04):

- "preserves a typed auth refusal from the real fetch operation"
- "uses the default remote without auth"
- "forwards an explicit remote, ref, and auth bundle"
- "GHB-01 / D-02: fetches a canonical github.com origin from the base and keeps the recorded origin"
- "INR-06: a fetch asked for tags also fetches the remote's tags"
- "D-10: a failed fetch from the base names the fetched URL"
- "a fetch whose remote records no url passes none and fails as before"
- "D-10: a rewritten fetch failure keeps a cause it already carries"
- "GHB-04: an unrewritten failed fetch carries no fetched cause"

`test/platform/git.test.ts`, `describe("the redirect client")`. The HTTP client is gone, and git follows redirects itself (`http.followRedirects=initial`):

- "Q-02: fails a challenge after a redirect to ${kind} without a credential lookup" (rows: another port of the same host, http on the same host, another host)
- "Q-02: fails a cross-origin challenge without starting a Device Flow"
- "Q-02: fails a 203 from another origin the same way as a 401"
- "Q-02: fails a challenge back on the original origin after a detour through another origin"
- "WR-03: keeps only protocol headers on a hop to another origin"
- "GAUTH-06: forwards the credential on a redirect within its origin (${kind})" (rows: another path, a relative location, an explicit default port)
- the POST redirect rows (`test(title)`): "re-sends a POST answered with 302 as a GET without its body", "re-sends a POST answered with 307 with its body"
- "GAUTH-06: does not forward the credential on a git-upload-pack POST redirect to ${kind}" (rows: another port of the same host (POST kept, 307), http on the same host, another host)
- "GAUTH-06: does not forward the credential on a git-upload-pack POST redirect to another port (302, POST->GET)"
- "GAUTH-06: forwards the credential on a git-upload-pack POST redirect within its origin (307)"
- "WR-04: returns a redirect with ${kind} to isomorphic-git as an HttpError" (rows: no Location header, an empty Location, a Location that is not a URL)
- "IN-03: rejects an eleventh consecutive redirect with TooManyRedirectsError"

`test/platform/git.test.ts`, `describe("runWithGitAbortSignal")`. These tests drove the in-process HTTP client's abort handling, which is gone. The system-git abort is covered by the `clone` argv case ("... with the limit and the scope's signal"), the `fetchCommit` cases "D-PL8-24: an aborted first rung is thrown at once, with no second rung" and "D-SG-13 / D-PL8-24: each rung reads its own limit and carries the scope's signal", and the `ls-remote` signal cases:

- "D-PL8-24: a fetch whose request never answers rejects with the abort reason and leaves the refs as they were"
- "D-PL8-24: a fetch whose pack stalls rejects with the abort reason and destroys the pack stream"
- "D-PL8-24: an already-aborted signal rejects before any request is sent"
- "D-PL8-24: a response that arrives after its request was aborted has its body ended"
- "D-PL8-24: a late response whose body fails to end raises no unhandled rejection"
- "D-PL8-24: a request that fails after its abort still rejects with the abort reason"
- "D-PL8-24: a call that already failed for another reason rejects with that error when the abort lands afterwards"
- "D-PL8-24: a call that already completed returns its result when the abort lands afterwards"
- "D-PL8-24: a fetch whose advertisement is cut off by the abort rejects instead of reporting an empty remote"
- "D-PL8-24: a pack read that starts after the abort ends the body and rejects"
- "D-PL8-24: a scope whose signal never aborts fetches with the same requests"
- "D-PL8-24: a response without a body reaches isomorphic-git unchanged inside a scope"

`test/platform/git.test.ts`, SG-PRC-06 gate:

- "D-SG-01: fetch fails as git missing and sends no request": `fetch` is gone. The rewritten gate adds a `fetchCommit` row instead.
- The three other rows became "D-SG-01: <verb> fails as git missing in its first request and looks git up no other way". They run on an injected git process and assert `{ lookups: 0, subcommands: [<first request>] }`.
- "D-SG-04: a clone succeeds once git is back on the path" became "D-SG-04: a clone succeeds once git is back", on an injected process that switches from the gitless process to the hermetic one.
- The `listRemotes` origin-shape table dropped its `libraryRemotes` proof (isomorphic-git's per-section enumeration). `git config --local --null --list` now proves the fixture's `fileUrls`.

`test/platform/git-auth-callbacks.test.ts`: deleted with its module, which only the in-process fetch used.

`test/shared/errors.test.ts`: "TooManyRedirectsError > reports the redirect cap" was deleted with its class, which only the redirect client threw.

## fallow dead-code --trace-dependency isomorphic-git

```
loaded config: /home/user/pi-claude-marketplace/.claude/worktrees/agent-a533659ef30fcb05f/.fallowrc.json

  UNUSED isomorphic-git (0 import(s))
```

## Decisions Made

- The chokepoint rule was kept as a total ban. `fallow rule-pack test` lists `architecture/isomorphic-git-chokepoint` with no WARN, so the rule was not dropped.
- `GitCredentials` lost `headers` and `cancel`. Only the deleted callback module set `cancel`. Nothing sets `headers`.
- The debug-log scan's subject set is `[GIT_PLATFORM_FILE, GIT_CREDENTIAL_FILE, GIT_ONE_SHOT_CREDENTIAL_FILE]`. `git-credential.ts` joins it because two of the three credential-adjacent `hookDebugLog` calls now live there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three test files outside the plan read the fake's `fetch` member**
- **Found during:** Task 2
- **Issue:** Typecheck failed. `test/integration/standalone-prune.test.ts` (11 assertions) and `test/orchestrators/plugin/reinstall-flow.test.ts` (3 assertions) read `calls.fetch` to prove that no network call ran. `test/orchestrators/plugin/info.test.ts` overrode `GitOps.fetch` in a wrapper.
- **Fix:** The "no network" assertions now read `fetchCommit`, the remaining fetch member. The `info.test.ts` wrapper lost its `fetch` override.
- **Files modified:** the three files above
- **Verification:** typecheck, and `check:commit` with every direct-coverage pair
- **Committed in:** `367e56c`

**2. [Rule 1 - Bug] Dropping the lookup would have given a missing git a fetched-URL cause**
- **Found during:** Task 3
- **Issue:** `runRemote` wraps the run in `withFetchedUrlCause`. Without the separate `locate()`, a `git-missing` failure under the GitHub base override would have gained a `FetchedUrlCause`, and SG-PRC-06's "no cause" output would have changed.
- **Fix:** `withFetchedUrlCause` skips a `git-missing` `GitCommandError` (`isGitMissing`).
- **Files modified:** `extensions/pi-claude-marketplace/platform/git.ts`
- **Verification:** the gate cases set the base override and assert `cause === undefined`; the without-git features pass
- **Committed in:** `bc4fdb7`

**3. [Rule 1 - Bug] Comments that the deletion made false**
- **Found during:** Tasks 1 to 3
- **Issue:** The `git.ts` header said other local verbs run in-process. The `GitOps` doc named `buildAuthCallbacks`. `systemGitOps` said the in-process D-14 verbs stay the production ones.
- **Fix:** The comments were rewritten. `systemGitOps` no longer spreads `DEFAULT_GIT_OPS`, because it binds all six members.
- **Files modified:** `platform/git.ts`, `orchestrators/marketplace/shared.ts`, `test/platform/system-git-ops.ts`
- **Committed in:** `3e7dda8`, `367e56c`, `bc4fdb7`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All three keep the plan's meaning. No user-visible output changes.

## Issues Encountered

- **The commit hook skips `npm run check:commit` in this checkout.** The repo-wide `exclude: ^(\.agents/(?!skills/)|\.claude/(?!skills/)|...)` in `.pre-commit-config.yaml` matches every path inside `.claude/worktrees/`. So at commit time the hook reports `npm run check:commit ... (no files to check) Skipped`, and also skips prettier. The 03-14 commits show the same line. The commit script therefore runs `npm run --silent check:commit` on the staged index first, with the same trimmed environment as the commit. Task 1 was committed before this change, so its checks ran after the commit: `check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), `test:unpaired`, and direct coverage of `platform/git.ts` and `orchestrators/marketplace/shared.ts`, all passing. Tasks 2 and 3 ran `check:commit` before the commit. Both stage shared test support or a dependency file, so every direct-coverage pair ran.
- The first Task 2 `check:commit` run failed only at the known baseline `test/bridges/hooks/dispatch-exec.test.ts:39` ("environment too large"), because the script trimmed the environment after the check. The trim now comes first, and the rerun passed.
- The `builtin` cucumber profile selects no scenario in the two without-git features, because they carry no `@mcp` or `@builtin-only` tag. The `adapter` profile ran 11 of 11.

## Wider verification

These ran on the final tree (`bc4fdb7`) with the trimmed environment the commit uses. No test reached a remote host. The suites use the hermetic git process, loopback stand-ins, and `file://` remotes.

- `npm run test:modules`: exit 0, no failure. `dispatch-exec.test.ts:39` also passed in the trimmed environment.
- `npm run test:integration`: exit 0, no failure.
- `cucumber --profile adapter features/marketplace features/plugin`: 1330 scenarios (1330 passed), 15556 steps (15556 passed).
- `cucumber --profile builtin features/plugin`: 39 scenarios (39 passed), 515 steps (515 passed).
- The first cucumber attempt did not start: the environment trim had unset `PWD`, so `$PWD/node_modules/.bin` named no directory (`spawn cucumber-js ENOENT`). The rerun used the absolute path.

`npm run check` was not run here. The wave gate runs it.

## Lines for later plans

- **Final `GitOps` members:** `clone`, `fetchCommit`, `checkout`, `resolveRef`, `resolveRemoteRef`, `listRemotes`.
- **Final `CREDENTIAL_LEAK_TARGETS` order:** `persistence/state-io.ts`, `persistence/migrate.ts`, `transaction/with-state-guard.ts`, `platform/git-credential.ts`, `domain/github-auth.ts`, `platform/git.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts`, `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`, `platform/git-one-shot-credential.ts`, `platform/hosted-manifest-fetch.ts`, `platform/git-process.ts`.
- **Debug-log scan subject set:** `GIT_PLATFORM_FILE`, `GIT_CREDENTIAL_FILE`, `GIT_ONE_SHOT_CREDENTIAL_FILE`. It counts 3 `hookDebugLog` calls (1 in `git.ts`, 2 in `git-credential.ts`).
- **Chokepoint rule:** kept, with no `exclude`, as a total ban.
- **For 03-16 (comment sweep, classifier clean-up):** comments that still name the deleted module or `buildAuthCallbacks`: `shared/git-failure-classifiers.ts:85`, `platform/git-credential.ts:237`, `orchestrators/marketplace/add.ts:1887,1903`, `domain/auth-registry.ts:8,82`, and `domain/github-auth.ts:5`. `CrossOriginChallengeError` (`shared/errors.ts`) and its doc still describe the deleted HTTP client. The classifier and `lacksStoredCredential` read it. The `@ts-expect-error` retired-export guard for `buildAuthCallbacks` stays in `test/platform/git.test.ts`.
- **`GitProcess.locate`** (`platform/git-process.ts`) has no production caller now. Test doubles still implement it. A later plan may drop it from the interface.
- **`GitOpsFakeState.branch`** in `test/platform/git-ops-fake.ts` is written by the fake and by `test/orchestrators/plugin/clone-cache.test.ts`, and nothing reads it. It was left in place, because the clone-cache test lies outside this plan.
- **For SG-CLS-01:** the dependency removal was pulled forward here by orchestrator decision 1. Phase 8 still checks the success criterion and the README text.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- SG-TRN-01 holds: one git transport, no `isomorphic-git` anywhere. 03-16 can clean the comments and the classifier rungs listed above.
- The wave gate runs `npm run check`.

## Self-Check: PASSED

- FOUND: `platform/git.ts`, `rule-packs/architecture.json`, `test/architecture/gate-targets.ts`, `platform/git-one-shot-credential.ts`. DELETED: `platform/git-auth-callbacks.ts`, `test/platform/git-auth-callbacks.test.ts`.
- FOUND: `3e7dda8`, `367e56c`, `bc4fdb7` in `HEAD`'s history (`git rev-list --count 386afd2..HEAD` = 3 before this SUMMARY commit).
- Acceptance: D-14 names in code lines = 0. `isomorphic-git` in `package.json` = 0, in `package-lock.json` = 0. `from "isomorphic-git` imports = 0. `isomorphic` in `git.ts` = 0. `TooManyRedirectsError` in `errors.ts` = 0. `git-one-shot-credential` in `gate-targets.ts` = 1. `git-auth-callbacks` in the two gate files = 0. The chokepoint has no `exclude` (node check exit 0). `NODE_GIT_PROCESS.locate()` in `git.ts` = 0. `process.env.PATH` in `git.test.ts` = 0.
