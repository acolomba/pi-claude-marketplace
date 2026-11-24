---
phase: 03-system-git-transport-and-clone-shape
plan: "16"
subsystem: shared-git-failures
tags: [system-git, classifier, git-failure-classifiers, cross-origin, device-flow, comments, sg-trn-01]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-15 removed the in-process transport, the redirect client, and the callback module; 03-05 added the https-auth details no-credential and rejected and StoredCredentialRejectedError"
provides:
  - "classifyGitFailure with one rung per live producer: GitCommandError, PinnedCommitMissingError, StoredCredentialRejectedError, HostedManifestHttpError, and the rule.unknown fallback"
  - "HostedManifestHttpError without the HttpError code and without the HttpStatusError interface"
  - "CrossOriginChallengeError deleted, with its classifier arm and its lacksStoredCredential exclusion"
  - "no 'isomorphic' in extensions/pi-claude-marketplace"
  - "unit fixtures that throw the GitCommandError system git gives instead of the old library's error shapes"
affects: [SG-CLS-01, ssh-phase, credential-phase, failure-message-phase]

actuals:
  tokens: 34535
  tasks: 3
  commits: 3
plan_head_before: 6fdf73effddfa06a48778aaaf30dd4a7cd9971cb
plan_head_after: 9f888ef803b3b6eef8f26157b092fc777a58e3a7

tech-stack:
  added: []
  patterns:
    - "A test that needs a failed git command builds `new GitCommandError(failure, { operation, exitCode: 128 })` with the kind platform/git-failure-kind.ts reads from git's stderr, never a duck-typed library error"
    - "A failed Device Flow sign-in is the run's own https-auth no-credential failure, with the sign-in's reason as its cause (D-SG-14)"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - extensions/pi-claude-marketplace/domain/auth-registry.ts
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/platform/git-credential.ts
    - extensions/pi-claude-marketplace/shared/github-base-url.ts
    - features/lib/github-device-flow/extension.ts
    - features/marketplace/device-flow.feature
    - test/shared/git-failure-classifiers.test.ts
    - test/shared/errors.test.ts
    - test/orchestrators/marketplace/shared.test.ts
    - test/orchestrators/marketplace/update.test.ts
    - test/orchestrators/marketplace/add.test.ts
    - test/orchestrators/import/execute.test.ts
    - test/orchestrators/plugin/bootstrap.test.ts
    - test/orchestrators/plugin/dependency-tag-probe.test.ts
    - test/orchestrators/plugin/fetch.test.ts
    - test/orchestrators/plugin/info.test.ts
    - test/orchestrators/plugin/install-cascade.messaging.test.ts
    - test/orchestrators/plugin/install-flow-ledger.test.ts
    - test/orchestrators/plugin/install.messaging.test.ts
    - test/orchestrators/plugin/update-flow.test.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - test/orchestrators/reconcile/apply-outcomes.test.ts
    - test/orchestrators/reconcile/apply.test.ts

key-decisions:
  - "The hosted catalog's HTTP status stays a classifier rung, read from HostedManifestHttpError by class instead of the duck-typed HttpError code: the hosted download is a live producer (T-03-48)."
  - "HostedManifestHttpError lost its `code = \"HttpError\"` field and the `HttpStatusError` interface, which existed only so the old library's duck-typing would read it."
  - "The errno ladder (ENETUNREACH, ECONNREFUSED, ENOTFOUND, ETIMEDOUT, ECONNRESET, EAI_AGAIN) is gone: system git reports an unreachable host as GitCommandError kind network, and the hosted download wraps its fetch failure in HostedManifestFetchError, which every caller reads before the classifier."
  - "The rule.unknown fallback and its filesystem-errno guard stay: filesystem errors still reach the classifier and must fall through to each caller's own ladder."
  - "84 unit tests in 14 files outside the plan threw the old library's error shapes through fakes; they now throw the GitCommandError system git gives, with no expected reason changed."

patterns-established:
  - "Fixture for a failed git request: GitCommandError with the kind git-failure-kind.ts gives (401 -> https-auth, 403 -> https-auth rejected, 404/410 -> repository-not-found with the status, other status -> network with the status, unreachable host -> network with a curl code)."

requirements-completed: ["SG-TRN-01"]

coverage:
  - id: D1
    description: "classifyGitFailure reads only GitCommandError, PinnedCommitMissingError, StoredCredentialRejectedError, and HostedManifestHttpError; the HttpError, UserCanceledError, NotFoundError, and errno rungs are gone, and every live answer is unchanged"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/shared/git-failure-classifiers.test.ts#classifyGitFailure"
        status: pass
      - kind: other
        ref: "npm run --silent test:coverage:direct -- shared/git-failure-classifiers.ts shared/errors.ts orchestrators/marketplace/shared.ts (100%)"
        status: pass
      - kind: other
        ref: "grep -c 'HttpError\"' shared/git-failure-classifiers.ts == 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "CrossOriginChallengeError is deleted with its classifier arm, its lacksStoredCredential exclusion, and its test cases; lacksStoredCredential answers as before for a no-credential failure and a refused stored credential"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/orchestrators/marketplace/shared.test.ts#lacksStoredCredential"
        status: pass
      - kind: other
        ref: "grep -c CrossOriginChallengeError over errors.ts, git-failure-classifiers.ts, marketplace/shared.ts == 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "No extension comment says isomorphic or names the deleted callback module"
    requirement: "SG-TRN-01"
    verification:
      - kind: other
        ref: "grep -rn isomorphic extensions/pi-claude-marketplace | wc -l == 0"
        status: pass
      - kind: other
        ref: "npm run check:commit (typecheck, lint, format:check) on the comment commit"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Device Flow harness header and the device-flow feature description describe the D-SG-14 retry and the CONNECT proxy; no scenario changed"
    requirement: "SG-TRN-01"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber:profile -- --profile adapter features/marketplace/device-flow.feature (9 passed); --profile builtin (0 selected, rc 0); npm run check:features"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every classified reason of a live failure is unchanged across the unit, integration, and behavioral suites"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "npm run test:modules"
        status: pass
      - kind: integration
        ref: "npm run test:integration"
        status: pass
      - kind: e2e
        ref: "cucumber --profile adapter features/marketplace features/plugin (1330 passed); --profile builtin features/plugin (39 passed)"
        status: pass
    human_judgment: false

duration: 46min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 16: The classifier and error set for system git Summary

**`classifyGitFailure` now has one rung per live producer (`GitCommandError`, `PinnedCommitMissingError`, `StoredCredentialRejectedError`, `HostedManifestHttpError`). The old library's `HttpError`, `UserCanceledError`, `NotFoundError`, and errno rungs are deleted, `CrossOriginChallengeError` is deleted, and no extension comment says `isomorphic`.**

## Performance

- **Duration:** 46 min
- **Started:** 2026-11-24T13:19:11Z
- **Completed:** 2026-11-24T14:05:14Z
- **Tasks:** 3
- **Files modified:** 30

## Accomplishments

- The classifier ladder is: `GitCommandError` (by kind, SG-PRC-05), `PinnedCommitMissingError` (INR-03), `StoredCredentialRejectedError` (GAUTH-04), `HostedManifestHttpError` (D-PL5-10, through the new `classifyHostedStatus`), then the `rule.unknown` fallback. Each rung's comment names its producer.
- `HostedManifestHttpError` keeps only `data.statusCode`. Its `code = "HttpError"` field and the `HttpStatusError` interface are gone.
- `CrossOriginChallengeError` is deleted from `shared/errors.ts`, with its classifier arm, its `lacksStoredCredential` exclusion, and its cases in four test files.
- `grep -rn isomorphic extensions/pi-claude-marketplace` finds nothing. The comments of eight production modules now describe the system git transport.
- The Device Flow harness header and the device-flow feature description explain the D-SG-14 retry and the CONNECT proxy.

## Task Commits

1. **Task 1: A git failure is classified from GitCommandError alone, and the redirect challenge class is gone**: `6e098f1` (refactor)
2. **Task 2: Production comments describe the system git transport**: `648cfea` (docs)
3. **Task 3: The Device Flow harness and feature say why the sign-in runs now**: `9f888ef` (docs)

**Plan metadata:** the SUMMARY commit that follows.

## Traced rungs and verdicts

Each rung was traced before removal. Error classes were traced with `grep -rn "new <Class>" extensions/`. Codes and errno values were traced with a grep of the code that builds the shape (`grep -rnE "ECONNREFUSED|ENETUNREACH|ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|UserCanceled|NotFoundError" extensions/`):

| Rung | Producer in the tree | Verdict |
| --- | --- | --- |
| `GitCommandError` arm (`GIT_FAILURE_ANSWERS`) | `platform/git-process.ts` through `platform/git.ts` | kept |
| `PinnedCommitMissingError` | `orchestrators/plugin/clone-cache.ts:188` (a `commit-missing` fetch of a pin) | kept |
| `StoredCredentialRejectedError` | `platform/git.ts:327` (`runWithAuthBundle`, GAUTH-04) | kept, moved out of the transport helper into its own rung |
| `HostedManifestHttpError` status (401/403, 404/410, other) | `platform/hosted-manifest-fetch.ts:298` | kept, read by class through `classifyHostedStatus` instead of the `HttpError` code |
| `HttpError` code (duck-typed) | none except `HostedManifestHttpError`, now read by class | deleted |
| `CrossOriginChallengeError` | none (`new CrossOriginChallengeError` had no match; the redirect client went in 03-15) | deleted, with the class |
| `UserCanceledError` code and name | none (a failed sign-in is now the run's own `https-auth` failure, D-SG-14) | deleted |
| `NotFoundError` code (`rule.missingRef`) | none (a missing remote ref is `GitCommandError` kind `remote-ref-missing`) | deleted |
| network errno ladder (6 codes) | none (git reports `network`; the hosted download wraps its fetch failure in `HostedManifestFetchError`, which `add.ts` and `update.ts` read before the classifier) | deleted |
| `rule.unknown` fallback with the filesystem-errno guard | any unclassified error, filesystem errors among them | kept |

## TDD Gate Compliance

The commit hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. The RED ran locally, and RED and GREEN went into one commit, `6e098f1`.

- **RED** (`exec-03-16/red1.sh`): the edited `test/shared/errors.test.ts` ran in a copy of the base tree (`git archive HEAD extensions scripts package.json`), with `--test-name-pattern='carries the status the classifier reads'`. Result: `tests 1, pass 0, fail 1`, exit 1. The failure was `ownFields: [ 'code', 'data', 'name' ]` where the test expects `[ 'data', 'name' ]`. The base `HostedManifestHttpError` still carried the old library's `code` field. Semantic assessment: the target ran and failed on its planned assertion, not at load.
- **GREEN:** the four task 1 test files ran 484 of 484, and direct coverage of the three task 1 sources was 100%.
- The other rung removals delete behavior and add none, so no other new test can fail on the base. The corpus rows that faked the old shapes were rewritten on live shapes, and they pass on both trees.

## Files Created/Modified

- `shared/git-failure-classifiers.ts`: the new ladder and module header. `classifyGitTransportFailure`, `httpStatus`, `isRemoteNotFound`, `isHttpStatusError`, `NETWORK_ERRNO_CODES`, and `classifyNetworkErrno` are deleted. `classifyHostedStatus` is added.
- `shared/errors.ts`: `CrossOriginChallengeError` and `HttpStatusError` are deleted. `HostedManifestHttpError` has no `code`.
- `orchestrators/marketplace/shared.ts`: `lacksStoredCredential` excludes only `StoredCredentialRejectedError`. Its comment names the `no-credential` case.
- Comment-only changes: `domain/auth-registry.ts`, `domain/github-auth.ts`, `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/info.ts`, `platform/git-credential.ts`, `shared/github-base-url.ts`, `features/lib/github-device-flow/extension.ts`, `features/marketplace/device-flow.feature`.
- Test fixtures: the 18 test files listed in `key-files` (see the deviation below).

## Deleted test cases

- `test/shared/errors.test.ts`: "CrossOriginChallengeError > names the challenging origin and why no credential is sent".
- `test/orchestrators/marketplace/shared.test.ts`: "lacksStoredCredential does not report a cross-origin challenge".
- `test/orchestrators/marketplace/update.test.ts`: "Q-02: a challenge after a cross-origin redirect keeps its own cause without the stored-credential line" and "UPD-12 / GHB-01: a challenge after a cross-origin redirect on a GitHub update under the override keeps its chain without the stored-credential line".
- `test/shared/git-failure-classifiers.test.ts` lost these rows, which faked the old library's shapes: the `HttpError` status rows (rebuilt on `HostedManifestHttpError`), "leaves an HTTP error without a status unclassified", "leaves an HTTP error with a string status unclassified", "classifies a non-integer 401 status as network error", the two `NotFoundError` rows, the six errno rows, "frames nothing for a network code with a URL", "classifies a direct network code on an error with a cause", "classifies a transport failure behind a cleanup leak", the cross-origin row, and the five cancellation rows. Also gone: `classifyGitSourceAccessFailure`'s "classifies a ref the remote does not have as source missing", because the ADD-09 `remote-ref-missing` row already covers it. Added rows: refused stored credential behind a cleanup leak, a filesystem error under the unknown rule, and a non-errno code under the unknown rule.

## Decisions Made

See `key-decisions`. The main one: the hosted catalog status is a live producer, so its rung stays, read by class. This follows the plan's prohibition against removing a rung that a live producer reaches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 84 unit tests in 14 files outside the plan faked the old library's error shapes**
- **Found during:** Task 1. The first `npm run test:modules` after the rung removal failed 84 tests.
- **Issue:** Test fakes threw `{ code: "HttpError", data: { statusCode } }`, `{ code: "UserCanceledError" }`, `{ code: "NotFoundError" }`, or an errno code. No producer in the tree throws these now, so the removed rungs no longer classified them.
- **Fix:** Each fake now throws the `GitCommandError` that system git gives, with the kind `platform/git-failure-kind.ts` reads: 401 is `https-auth` `no-credential`, 403 is `https-auth` `rejected`, 404/410 is `repository-not-found` with the status, another status is `network` with the status, and an unreachable host is `network` with a curl code. A failed Device Flow is `https-auth` `no-credential`, with the sign-in's reason as its cause where the case had one (D-SG-14). No expected reason changed. Where a case printed the error's message, the expected cause text now has the `GitCommandError` message, such as `git clone failed: repository-not-found, exit code 128`. The D-PL10-11 redaction case uses a `HostedManifestHttpError` whose URL is an absolute path, because a `GitCommandError` message carries no path. Two `.code === "HttpError"` assertions in `add.test.ts` MURL-09 now compare `failure`.
- **Files modified:** `test/orchestrators/{marketplace/add,import/execute,plugin/bootstrap,plugin/dependency-tag-probe,plugin/fetch,plugin/info,plugin/install-cascade.messaging,plugin/install-flow-ledger,plugin/install.messaging,plugin/update-flow,plugin/update-preflight,reconcile/apply-outcomes,reconcile/apply}.test.ts`, plus the plan's own `update.test.ts`.
- **Verification:** `npm run test:modules` exit 0, and the commit's `check:commit` passed.
- **Committed in:** `6e098f1`

**2. [Rule 1 - Bug] Comments that the rung removal made false, outside the plan's comment list**
- **Found during:** Task 2
- **Issue:** `orchestrators/plugin/info.ts` described the fetch fold as "HttpError 401/403 and a denied/expired Device Flow's `UserCanceledError`... network errnos". `orchestrators/marketplace/update.ts` described "authentication, network errno, and the host's HTTP status". `platform/git-credential.ts` named `buildAuthCallbacks`. `shared/github-base-url.ts` named the deleted `onAuth` compare.
- **Fix:** Each sentence now describes the system git kinds. The changes are comment-only (checked: no non-comment line in the diff).
- **Committed in:** `648cfea`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both are direct results of the plan's removals. No user-visible output changes. Every feature passes unchanged.

## Issues Encountered

- **The commit hook.** In the first pass of each commit, the hook reported `npm run check:commit ... Skipped`, because `commit.sh` runs `pre-commit run` with `SKIP=npm-check`. The commit's own pre-commit stage then reported `npm run check:commit ... Passed`, so the hook ran it in this worktree. The commit script also ran `npm run --silent check:commit` on the staged index before each commit, in the trimmed environment. All three runs passed: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features, test:unpaired, and direct coverage of the staged pairs.
- The `builtin` cucumber profile selects no scenario in `device-flow.feature`, because the feature has no `@mcp` or `@builtin-only` tag. That run exits 0 with 0 scenarios.

## Wider verification

These ran on the final tree (`9f888ef`) in the trimmed environment that the commit uses. No test reached a remote host. The suites use the hermetic git process, loopback stand-ins, and `file://` remotes.

- `npm run test:modules`: exit 0, no failure (`dispatch-exec.test.ts:39` also passed in the trimmed environment).
- `npm run test:integration`: exit 0.
- `cucumber --profile adapter features/marketplace features/plugin`: 1330 scenarios (1330 passed), 15556 steps (15556 passed).
- `cucumber --profile builtin features/plugin`: 39 scenarios (39 passed), 515 steps (515 passed).
- Task 1 verify: the four test files 484/484, direct coverage of the three sources at 100% (exit 0), `npm run typecheck` and `npm run fallow` exit 0.
- Task 2 verify: `grep -rn isomorphic extensions/pi-claude-marketplace | wc -l` = 0. The commit's `check:commit` passed typecheck, lint, and format:check.
- Task 3 verify: `device-flow.feature` passed under adapter (9 scenarios) and builtin (0 selected, exit 0), and `npm run check:features` exited 0.

`npm run check` was not run here. The wave gate runs it.

## Carried to the close phase (SG-CLS-01)

**Test and feature files that still say `isomorphic`** (`grep -rln isomorphic test features`):

- `features/lib/git-clones.ts`
- `features/step_definitions/marketplace/checkout.steps.ts`
- `features/step_definitions/plugin/git-source.steps.ts`
- `test/edge/completions/data.test.ts`
- `test/edge/completions/provider.test.ts`
- `test/edge/handlers/marketplace/info.test.ts`
- `test/edge/handlers/marketplace/list.test.ts`
- `test/edge/handlers/marketplace/remove.test.ts`
- `test/edge/handlers/plugin/enable-disable.test.ts`
- `test/edge/handlers/plugin/import.test.ts`
- `test/edge/handlers/plugin/info.test.ts`
- `test/edge/register.test.ts`
- `test/platform/git.test.ts`

**Vacuous `https.request` traps.** The `https.request` traps of nine edge tests are now vacuous against git child processes. A git child never calls the test process's `https.request`, so these traps no longer prove that a command reached the network only through its injected port. The nine files are `test/edge/completions/data.test.ts`, `test/edge/completions/provider.test.ts`, `test/edge/handlers/marketplace/remove.test.ts`, `test/edge/handlers/marketplace/info.test.ts`, `test/edge/handlers/marketplace/list.test.ts`, `test/edge/handlers/plugin/enable-disable.test.ts`, `test/edge/handlers/plugin/import.test.ts`, `test/edge/handlers/plugin/info.test.ts`, and `test/edge/register.test.ts`. The four edge tests that 03-13 moved to a trap on the git process module are not among them.

**Old-library shapes in fakes that classify nothing.** These fakes still throw `{ code: "HttpError", ... }`. Their cases pass because no classifier reads the error on their path, so they were left alone: `test/orchestrators/plugin/clone-cache.test.ts:1136,1227,1323`, `test/orchestrators/plugin/install-outcome.test.ts:1589`, and `test/orchestrators/import/execute.test.ts:2567`. The close phase may move them to `GitCommandError`.

**Titles that name deleted members.** `update.test.ts` "CR-05 / MU-5: url-source pre-fetch failure (gitOps.fetch throws)..." names `GitOps.fetch`, which 03-15 removed. The case now fails `resolveRemoteRef` with a `GitCommandError`.

## Orchestrator actions

None required. The plan asks for no `windows append`, and this plan left no stub, skipped test, or unrun verify. To record the fixture conversion as a documented deviation, the orchestrator may run:

```bash
gsd-tools windows append --kind deviation --phase 3 --file test/orchestrators --description "[system-git] 84 unit fixtures moved from the old library's error shapes to GitCommandError when the classifier dropped those rungs (03-16)"
```

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-03-48 is mitigated: every rung's producer was traced, and the hosted-catalog status rung was kept. T-03-49 is mitigated: the extension tree's `isomorphic` mentions are at zero, and the remaining test mentions are listed above.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The classifier and the error set describe only system git and hosted catalog failures, so the SSH, credential, and failure-message phases start from the tree as it is.
- The wave gate runs `npm run check`.

## Self-Check: PASSED

- FOUND: `6e098f1`, `648cfea`, `9f888ef` in `HEAD`'s history (`git rev-list --count 6fdf73e..HEAD` = 3 before this SUMMARY commit).
- FOUND: `shared/git-failure-classifiers.ts`, `shared/errors.ts`, `orchestrators/marketplace/shared.ts`, `features/marketplace/device-flow.feature`.
- Acceptance: `CrossOriginChallengeError` in the three sources = 0. `HttpError"` in the classifier = 0. `isomorphic` under `extensions/pi-claude-marketplace` = 0. `isomorphic` in the harness extension and the device-flow feature = 0. Every `verify` command exited 0, and each commit passed its hook and a `check:commit` run on the staged index.
