---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "04"
subsystem: testing
tags: [cucumber, git-http-backend, hermetic-git, url-source, credentials]

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: plan 09-01's HttpsGitHost, request log, and Pi git environment; plan 09-03's url publication arms
provides:
  - Per-repository arms on HttpsGitHost (status 404/500/502/503, drop, one credential), the exported ArmedStatus, GitHostArm, and armedStatus
  - arms in GitHostSnapshot, cleared by reset() and asserted empty by Before()
  - The steps "the git host answers {int} for the marketplace {string}", "the git host drops the connection for the marketplace {string}", "the git host requires the user {string} with the password {string} for the marketplace {string}", and "the user has stored a credential for the git host with the user {string} and the password {string}"
  - Four url add scenarios (404, drop, 401 without and with a stored credential) with exact request logs
affects: [09-05, 09-06, 09-08, phase-10-github-source]

actuals:
  tokens: 4455
  tasks: 2
  commits: 2

plan_head_before: d6a95bd3d4ebf2c27765c459229bf2402cbd74bc
plan_head_after: 32e5d5a18ce1117783862a7a7f6abecb3765dea9

tech-stack:
  added: []
  patterns:
    - "An arm is looked up by request path (/acme/<repo>/ or /acme/<repo>.git/) before the body is buffered, and answered by one small switch, so an armed request never reaches the CGI"
    - "A credential arm compares the Authorization header in memory and logs only the status (HOST-04)"
    - "A sandbox file a Given writes uses flag wx, registers its removal only after the write succeeds, and is read back whole"

key-files:
  created: []
  modified:
    - features/lib/https-git-host/server.ts
    - features/support/pi-process.ts
    - features/step_definitions/marketplace/git-host.steps.ts
    - features/marketplace/url-source.feature

key-decisions:
  - "GitHostSnapshot.arms lists the armed repository names (the directory under acme/) in arming order, from a Map's insertion order"
  - "The stored-credential step URL-encodes the user and password in the .git-credentials line; for alice/s3cret the line is exactly https://alice:s3cret@{git host}"
  - "The catalog's add-authentication-required child-row shape differs from the measured url add; the scenario pins the code and WINDOWS #100 records the difference, the catalog is unchanged"

patterns-established:
  - "A git-kind arm step narrows the published marketplace to a git publication and fails with 'the marketplace <name> is not published as a git source' for dir or file"

requirements-completed: [HOST-03, ADD-09, ADD-10, DRV-03]

coverage:
  - id: D1
    description: "A scenario arms one published repository to answer 404/500/502/503, drop the connection, or require one credential; an unpublished or already armed repository, or another status, fails the Given; reset() clears the arms and Before() asserts arms: []"
    requirement: HOST-03
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (321 scenarios, 321 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A url add answered 404 fails as source missing with the bare row https://{git host}/acme/tools.git project failed, and the log is exactly GET /acme/tools.git/info/refs?service=git-upload-pack 404"
    requirement: ADD-09
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace the git host answers with 404 fails as source missing"
        status: pass
    human_judgment: false
  - id: D3
    description: "A url add whose connection drops on the first request fails as network unreachable with no cause, and the log is exactly GET /acme/tools.git/info/refs?service=git-upload-pack dropped"
    requirement: ADD-10
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace whose connection drops fails as network unreachable"
        status: pass
    human_judgment: false
  - id: D4
    description: "With the credential arm and no stored credential the add fails as authentication required (one 401); with the credential stored only in the sandbox HOME it is added (401, 200, POST 200); random order with the stored-credential scenario first in the same worker still fails the no-credential add"
    requirement: DRV-03
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace that needs a credential fails as authentication required without one"
        status: pass
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace with a stored credential clones it"
        status: pass
    human_judgment: false
  - id: D5
    description: "By-hand D-11 control: a hostile GIT_CONFIG_SYSTEM helper outside the sandbox is ignored while GIT_CONFIG_NOSYSTEM is set, and runs (marker written, add succeeds) once it is removed"
    requirement: DRV-03
    verification:
      - kind: manual_procedural
        ref: "D-11 control record in this SUMMARY (runs b, c, d)"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 04: Git host arms and url add failures Summary

**The git host now arms one repository to answer 404/5xx, drop the connection, or demand one Basic credential. Four url add scenarios pin `source missing`, `network unreachable`, and `authentication required` without a credential, plus a clone with a credential stored only in the sandbox HOME, each with its exact request log. A by-hand control showed that a planted system credential helper never runs while `GIT_CONFIG_NOSYSTEM` is set.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-21T03:48:25Z
- **Completed:** 2026-10-21T04:00:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `features/lib/https-git-host/server.ts`: `ArmedStatus`, `GitHostArm`, `armedStatus()`, and `HttpsGitHost.arm()`. `arm()` throws when nothing is published at `repositoryPath(repository)` or when the repository is armed already. `armFor()` matches `/acme/<repo>/` and `/acme/<repo>.git/`, so only that repository fails. `failArmed()` runs before the body is buffered. A `drop` arm logs `dropped` and destroys `req.socket`. A `status` arm logs and answers the status with no body. A `credential` arm answers 401 with `WWW-Authenticate: Basic realm="git host"` unless the header matches exactly. `GitHostRequest.status` gains `"dropped"`, `GitHostSnapshot` gains `arms`, and `reset()` clears them.
- `features/support/pi-process.ts`: the `Before()` assertion includes `arms: []`.
- `features/step_definitions/marketplace/git-host.steps.ts`: three arm Givens and the stored-credential Given. That Given writes `<sandbox HOME>/.gitconfig` (`[credential]\n\thelper = store\n`) and `<sandbox HOME>/.git-credentials` (mode 0600), both with `flag: "wx"`. It registers their removal and compares both files' whole text. No git process runs.
- `features/marketplace/url-source.feature`: four new scenarios, so the file now has 6.

## Task Commits

1. **Task 1: Arm a repository to answer 404 or drop the connection, and pin both add failures** - `7c641452` (test)
2. **Task 2: Require one credential, store it in the sandbox, pin both 401 adds** - `32e5d5a1` (test)

**Plan metadata:** the `docs(planning)` commit that adds this SUMMARY.

## Files Created/Modified

- `features/lib/https-git-host/server.ts` - per-repository arms and their answers
- `features/support/pi-process.ts` - `arms: []` in the reset assertion
- `features/step_definitions/marketplace/git-host.steps.ts` - arm steps and the stored-credential step
- `features/marketplace/url-source.feature` - the 404, drop, and two 401 scenarios

## Verification evidence

Environment: Node v26.11.1, git version 2.55.0, cucumber-js 13.3.0.

| Stage | Command | Exit | Result |
| --- | --- | --- | --- |
| Task 1 | `npm run typecheck` | 0 | clean (after deviation 1) |
| Task 1 | `npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1` | 0 | `4 scenarios (4 passed)` |
| Task 1 | `npm run test:cucumber` | 0 | `319 scenarios (319 passed)`, seed 271263 |
| Task 1 | `npm run check:features` | 0 | no "Feature gate failed" |
| Task 1 | `npx eslint` (3 files), `npm run fallow` | 0, 0 | clean |
| Task 1 | `SKIP=npm-check pre-commit run --files` (4 files), then commit hook | 0, 0 | `7c641452` |
| Task 2 | `npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1` | 0 | `6 scenarios (6 passed)` |
| Task 2 | same file, three random seeds (734836, 27641, 944067) | 0 each | `6 scenarios (6 passed)`; in all three, the stored-credential scenario ran before the no-credential one in the same worker (D-10) |
| Task 2 | `npm run test:cucumber` | 0 | `321 scenarios (321 passed)`, seed 844784 |
| Task 2 | `npm run check:features` | 0 | no "Feature gate failed" |
| Task 2 | `npx eslint` (3 files), `npm run fallow`, `npm run typecheck` | 0, 0, 0 | clean (after deviation 2) |
| Task 2 | `SKIP=npm-check pre-commit run --files` (3 files), then commit hook | 0, 0 | `32e5d5a1` |

Acceptance greps: `export type GitHostArm` and `export function armedStatus` print 2 lines. `arms: \[\]` in `pi-process.ts` prints 1 line. `| dropped |` = 1. `source missing` = 2. `WWW-Authenticate` = 1 line. `authentication required` = 2. `stored a credential` = 1. The only `authorization` reference under `features/` is the in-memory comparison in `failArmed()`, so no step reads a header, and the stored-credential log table has exactly the columns method, path, and status (HOST-04). `git status --short -- features tests/e2e/_rpc.ts` printed nothing after each commit and after the control.

Every measured value matched the `<interfaces>` table, so no value differed from the plan.

## D-11 control (by hand, never committed)

Planted in the session scratchpad (`.../scratchpad/d11/`), outside the sandbox and the repository:

- `hostile-helper.sh` (mode 0755): `#!/bin/sh`, `cat >/dev/null`, `touch <scratchpad>/d11/marker`, and for `$1 = get` it prints `username=alice` and `password=s3cret`.
- `hostile-gitconfig`: `[credential]` with `helper = <absolute path of hostile-helper.sh>`.

| Run | Local edit of `tests/e2e/_rpc.ts` (git branch of `rpcChildEnvironment`) | Command | Exit | Result | Marker |
| --- | --- | --- | --- | --- | --- |
| b | added `environment.GIT_CONFIG_SYSTEM = "<hostile-gitconfig>"` | `npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1 --name 'fails as authentication required without one'` | 0 | `1 scenario (1 passed)`, `8 steps (8 passed)`: still `authentication required` | absent |
| c | b, plus removed `environment.GIT_CONFIG_NOSYSTEM = git.GIT_CONFIG_NOSYSTEM;` | same | 1 | `1 scenario (1 failed)` at `Then the result has these fields:`, actual severity `info` instead of `error`: the add succeeded through the planted helper (positive control) | present |
| d | restored with `git checkout -- tests/e2e/_rpc.ts`; `git diff --quiet -- tests/e2e/_rpc.ts` exit 0 | same | 0 | `1 scenario (1 passed)` | absent |

The marker was deleted before each run. After run d, the scratch helper, config, and marker were removed (`rm -rf <scratchpad>/d11`). `git status --short -- features tests/e2e/_rpc.ts` printed nothing. Nothing read or wrote the real `~/.gitconfig`, `~/.git-credentials`, or system git config.

## WINDOWS ledger

- **#100** (`deviation`, open): `[marketplace-features]` The `add-authentication-required` catalog state (`docs/output-catalog.md:2563`, fixture `tests/architecture/catalog-uat/fixtures/marketplace-add.ts:222`) shows the 401 reason on a synthetic child row with a cause. A real url `marketplace add` answered 401 renders a bare failed row with no cause, which `url-source.feature` pins. The catalog is unchanged.

## Decisions Made

- `GitHostSnapshot.arms` holds repository directory names in arming order (a `Map` keeps insertion order).
- The stored-credential line URL-encodes the user and password, so a value with `@` or `:` still forms a valid store line. For `alice` / `s3cret` the line is the plain `https://alice:s3cret@{git host}` the plan names.
- The credential release is registered only after its `wx` write succeeds, so a failed write never removes a file the step did not create.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `assert.fail` did not narrow the publication union**
- **Found during:** Task 1
- **Issue:** `if (kind is dir or file) assert.fail(...); return published.repository;` failed `tsc` with TS2339, because the call did not narrow `PublishedMarketplace` here.
- **Fix:** Inverted the check: return `published.repository` for `url` or `github`, then `assert.fail(...)` with the same message.
- **Files modified:** features/step_definitions/marketplace/git-host.steps.ts
- **Verification:** `npm run typecheck` exit 0
- **Committed in:** 7c641452

**2. [Rule 1 - Lint] Nested template literal in `basicAuthorization`**
- **Found during:** Task 2
- **Issue:** `sonarjs/no-nested-template-literals` rejected `` `Basic ${Buffer.from(`${user}:${password}`)...}` ``.
- **Fix:** Computed the base64 token in a local first.
- **Files modified:** features/lib/https-git-host/server.ts
- **Verification:** `npx eslint` exit 0; the url-source file and the full suite re-ran green
- **Committed in:** 32e5d5a1

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 lint)
**Impact on plan:** None on behavior or scope.

## Issues Encountered

- `gsd-tools check evaluation-scope --plan 09-04` cannot match these commits, because the repository's commit policy keeps plan IDs out of commit subjects. The commits are `7c641452` and `32e5d5a1` on `features/cucumber-behavioral-tests`.
- `requirements.ready-ids` reports ADD-10 blocked until plan 09-05 (which also declares it) has a SUMMARY, so only HOST-03, ADD-09, and DRV-03 are marked complete now.

## Flagged assumptions (carried from the plan)

- `ADD-09 / unclassified / unresolved` (spec-less probe): the armed-404 scenario is the manual-review target. A repository that was never published also gets a natural 404 from `git http-backend` and behaves the same for `add`. It is not pinned separately.
- The catalog's `add-authentication-required` child-row shape differs from the measured url add. This plan pins the code and records the difference as WINDOWS #100. It does not change the catalog.
- ADD-10 (edge: concurrency, backstop): a dropped clone writes no record. Nothing here asserts this directly. The cascade row is `failed`, and `Before()` asserts an empty `list` before the next scenario.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-05 can arm 500/502/503 with `the git host answers {int} for the marketplace {string}` (`armedStatus` accepts all three) for the 5xx Outline and the D-19 row id fix.
- Plan 09-06 can use the same status and drop arms for UPD-11.
- The orchestrator's post-wave `npm run check` on the combined tree is still owed (AGENTS.md, Build verification). This executor ran the hook's `check:commit` on both commits plus the cucumber runs above.

## Self-Check: PASSED

- FOUND: features/lib/https-git-host/server.ts, features/support/pi-process.ts, features/step_definitions/marketplace/git-host.steps.ts, features/marketplace/url-source.feature
- FOUND: 7c641452 and 32e5d5a1 are ancestors of HEAD
- `git diff --quiet -- tests/e2e/_rpc.ts` exit 0 after the control
- All `<acceptance_criteria>` and `<verify>` commands re-ran green on the committed tree

---
*Phase: 09-url-source-kind-and-https-git-stand-in*
*Completed: 2026-10-21*
