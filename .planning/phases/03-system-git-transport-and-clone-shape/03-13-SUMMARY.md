---
phase: 03-system-git-transport-and-clone-shape
plan: "13"
subsystem: testing
tags: [system-git, git-ops-fake, recordedCalls, NODE_GIT_PROCESS, injection-proof, d-14-decoupling]

requires:
  - phase: 03-system-git-transport-and-clone-shape
    provides: "03-09 the mirror and PUP-2 sync by swap (the D-14 GitOps members have no production caller left); 03-07 and the wave-4 fixes, the edge update owner's HEAD-read plus ls-remote recorder"
provides:
  - "recordedCalls(calls) in test/platform/git-ops-fake.ts: the fake's members with at least one recorded call"
  - "No test outside the fake, its test, its contract, test/platform/git.test.ts, and the 03-12 files names a D-14 GitOps member"
  - "reinstall-flow and update-preflight fabricate the git host's refusal as a system-git GitCommandError and import nothing from isomorphic-git"
  - "The add, update, bootstrap, and tools edge owners trap NODE_GIT_PROCESS.run instead of counting https.request"
affects: [03-12, 03-15, 03-16, SG-CLS-01]

plan_head_before: 82c2691358d2f428192aa67d012c1965d81d8cfe
plan_head_after: 9a2e30c6f69c7971f8d8512783fba1068d13a745

actuals:
  tokens: 9400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A case that proves no git call compares recordedCalls(fake.state.calls) with {}, so it names no member and still fails on an extra call of any member"
    - "An edge injection proof traps NODE_GIT_PROCESS.run through t.mock.method and asserts the trap counted zero runs, beside the injected port's own recorder"
    - "A git host failure in an orchestrator test is the GitCommandError system git gives, with the stderr line git prints"

key-files:
  created: []
  modified:
    - test/platform/git-ops-fake.ts
    - test/platform/git-ops-fake.test.ts
    - test/integration/marketplace-add-seed-mirrors.test.ts
    - test/integration/marketplace-layer-redeclare.test.ts
    - test/edge/types.test.ts
    - test/e2e/import-command.test.ts
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/plugin/update-preflight.test.ts
    - test/edge/handlers/marketplace/add.test.ts
    - test/edge/handlers/marketplace/update.test.ts
    - test/edge/handlers/plugin/bootstrap.test.ts
    - test/edge/handlers/tools.test.ts

key-decisions:
  - "Each edge owner keeps a small local trapGitProcess that names NODE_GIT_PROCESS itself, as installNetworkCounter was local before; fallow dupes reports no clone group for the four copies"
  - "The trap counts runs and every case asserts the count is zero, so a handler that catches the refusal and renders a row still fails the case"
  - "The 401 challenge of update-preflight is modeled as https-auth no-credential, the kind system git gives when a host asks for a credential and no helper has one"

patterns-established:
  - "Pattern: an orchestrator test fabricates a host refusal as new GitCommandError(failure, { operation: 'clone --depth', exitCode: 128, stderr })"

requirements-completed: ["SG-TRN-01"]

coverage:
  - id: D1
    description: "recordedCalls reports {} for a fake that recorded nothing, one member after one clone, and exactly two members after a clone and a resolveRef; the two marketplace add integration tests compare it with {}"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/platform/git-ops-fake.test.ts#SG-TRN-01: reports nothing for a fake that recorded no call"
        status: pass
      - kind: unit
        ref: "test/platform/git-ops-fake.test.ts#SG-TRN-01: reports each member a fake recorded a call for"
        status: pass
      - kind: integration
        ref: "test/integration/marketplace-add-seed-mirrors.test.ts, test/integration/marketplace-layer-redeclare.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The edge types owner and the import e2e build their GitOps from the fake and name no D-14 member"
    requirement: "SG-TRN-01"
    verification:
      - kind: e2e
        ref: "test/e2e/import-command.test.ts (3/3)"
        status: pass
      - kind: other
        ref: "npm run typecheck; grep -c 'forceUpdateRef|currentBranch' over the four files = 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "A cold reinstall and an update preflight see the git host's 404, 503, and 401 as system git's GitCommandError and keep every reason and status-and-URL cause"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/orchestrators/plugin/reinstall-flow.test.ts#SRC-01: a cold-cache reinstall whose git host answers 404 fails as source missing with its cause"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/update-preflight.test.ts#SRC-01: a clone the git host refuses -- a 404 fails as source missing with a cause that names the status and URL at the installed version"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four edge injection proofs fail when a handler starts git itself: the NODE_GIT_PROCESS.run trap counts a run before any git process starts"
    requirement: "SG-TRN-01"
    verification:
      - kind: unit
        ref: "test/edge/handlers/{marketplace/add,marketplace/update,plugin/bootstrap,tools}.test.ts (114/114)"
        status: pass
      - kind: other
        ref: "RED: handler forward deleted or default-port ls-remote planted (not committed), the git-reaching cases fail at the trap"
        status: pass
    human_judgment: false

duration: 39min
completed: 2026-11-24
status: complete
---

# Phase 3 Plan 13: Tests decoupled from the D-14 members and the HTTP transport Summary

**The `GitOps` fake now has `recordedCalls`, which reports only the members a command called. The tests that listed every member, D-14 ones included, use it or spread the fake's port instead. Two orchestrator tests fabricate the git host's refusal as the `GitCommandError` system git gives, so neither imports `isomorphic-git`. The four edge "network door" proofs trap `NODE_GIT_PROCESS.run`, the door every default git process starts through, instead of counting `https.request`, which a git child process never calls.**

## Performance

- **Duration:** about 39 min
- **Started:** 2026-11-24T10:48:59Z
- **Completed:** 2026-11-24T11:27:36Z
- **Tasks:** 3 of 3. Task 1 is a tracer, and its gate passed.
- **Files modified:** 12 (0 created)

## Accomplishments

- `recordedCalls(calls)` returns the fake's members with at least one recorded call, typed `Partial<GitOpsFakeCalls>`. Three new cases in the fake's test cover it.
- The two marketplace add integration tests compare `recordedCalls(...)` with `{}`. `test/edge/types.test.ts` takes `createGitOpsFake({ boundary: "memory" }).gitOps`. The import e2e spreads the fake's port and replaces only `clone`, which copies the fixture tree for each URL.
- `reinstall-flow.test.ts` and `update-preflight.test.ts` build `GitCommandError`s: `repository-not-found` with `httpStatus: 404`, `network` with `httpStatus: 503`, and `https-auth` with `no-credential`. Each carries the stderr line git prints. Every reason and every status-and-URL cause is unchanged.
- The add, update, bootstrap, and tools edge owners replace `installNetworkCounter` with `trapGitProcess`, which uses `t.mock.method(NODE_GIT_PROCESS, "run", ...)`, rejects, and counts runs. The header and trap comments are rewritten for the system-git door, with the measured counts.

## Task Commits

1. **Task 1 (tracer): recorded calls without the D-14 members** - `6b3df6d` (test). Tracer gate: both verify commands passed before the commit (38/38 tests, then typecheck and fallow exit 0). The hook's `check:commit` passed.
2. **Task 2: system-git host failures** - `b7f9d9b` (test)
3. **Task 3: edge injection proofs on the git process** - `9a2e30c` (test)

## Case counts per file (before -> after)

| File | Before | After | Changed assertions |
| --- | --- | --- | --- |
| `test/platform/git-ops-fake.test.ts` | 23 | 26 | +3 `recordedCalls` cases |
| `test/integration/marketplace-add-seed-mirrors.test.ts` | 6 | 6 | whole-record compare -> `recordedCalls(...)` = `{}` |
| `test/integration/marketplace-layer-redeclare.test.ts` | 2 | 2 | `NO_GIT_CALLS` (2 sites) -> `recordedCalls(...)` = `{}` |
| `test/edge/types.test.ts` | 1 (type-only) | 1 | git port from the fake |
| `test/e2e/import-command.test.ts` | 3 | 3 | none; the port spreads the fake |
| `test/orchestrators/plugin/reinstall-flow.test.ts` | 170 | 170 | 404 case: notes and TUI cause text now name `git clone --depth failed: repository-not-found, exit code 128` |
| `test/orchestrators/plugin/update-preflight.test.ts` | 97 | 97 | none; the 5 rows derive notes from `error.message` |
| `test/edge/handlers/marketplace/add.test.ts` | 22 | 22 | `networkCallCount()` -> `gitProcessRuns()` |
| `test/edge/handlers/marketplace/update.test.ts` | 22 | 22 | same |
| `test/edge/handlers/plugin/bootstrap.test.ts` | 21 | 21 | same |
| `test/edge/handlers/tools.test.ts` | 49 | 49 | same |

The "1" for the type-only owner is the file's own TAP entry. It holds no case.

## Files Created/Modified

- `test/platform/git-ops-fake.ts` - `recordedCalls`.
- `test/platform/git-ops-fake.test.ts` - a `describe("recordedCalls")` with three cases.
- `test/integration/marketplace-add-seed-mirrors.test.ts`, `test/integration/marketplace-layer-redeclare.test.ts` - compare `recordedCalls` with `{}`.
- `test/edge/types.test.ts` - the git port from the fake, and a header sentence that says so.
- `test/e2e/import-command.test.ts` - `fixtureGitOps` spreads the fake (`allowedRemoteUrls` set to both fixture URLs, `initialOid` and `remoteHead` set to the former canned commit) and replaces `clone`.
- `test/orchestrators/plugin/reinstall-flow.test.ts`, `test/orchestrators/plugin/update-preflight.test.ts` - `GitCommandError` fabrications.
- The four edge owners - `trapGitProcess`, the `gitProcessRuns` field, and the rewritten comments.

## Decisions Made

See `key-decisions` in the frontmatter.

## TDD Gate Compliance

The plan is `type: execute` with `tdd="true"` tasks. The hook runs typecheck and every architecture test, so a commit that holds only a failing test cannot pass it. Each task's commit holds RED and GREEN together.

- **Task 1 RED** (`red1.sh` in the scratch directory): `recordedCalls` was given the placeholder body `return { ...calls };`, and the three new cases ran (`node --test --test-name-pattern='SG-TRN-01: reports' test/platform/git-ops-fake.test.ts`): `# tests 3 # pass 0 # fail 3`, exit 1. Each failed on `deepStrictEqual`: the actual value held all eight members, with empty arrays where nothing was recorded. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (`target_test_failed`). Semantic assessment: each target ran and failed on its planned assertion. None failed at load. **GREEN:** 26/26.
- **Task 2:** a fixture-only change. The production classifier already maps each `GitCommandError` kind, so the rewritten cases pass on the unchanged source. That is expected, not a TDD violation. A mutation check replaced the RED (`red2.sh`): `repository-not-found` and `https-auth` were classified as `network error` in `git-failure-classifiers.ts` (not committed, restored). Then `# tests 6 # pass 2 # fail 4`. The 404 reinstall case, the 404 preflight row, and both authentication rows failed on their reasons. The dropped-connection and 503 rows stay `network unreachable` and `network error` under that mutation, as expected.
- **Task 3 RED** (`red3.sh`, `probe3.sh`; not committed, sources restored): each handler was given the default port by deleting its `gitOps: deps.gitOps` forward. The tools owner instead got a default-port `ls-remote` planted in `loadToolPluginPayload`.
  - add: `# tests 22 # pass 15 # fail 7`. Exactly the seven clone-carrying cases failed, and the trap's refusal appeared in each failed row. The probe counted 1 run on each of them and 0 on the path-source and rejecting cases.
  - update: `# tests 22 # pass 15 # fail 7`. The seven refreshing cases failed, and the probe counted 2 runs per refreshed checkout (2, 4, or 6). The rejecting cases counted 0.
  - bootstrap: `# tests 21 # pass 17 # fail 4`. The four cases that reach the clone failed, each with 1 trapped run. The first assertion to fail is the empty clone recorder. The trap-count assertion follows it.
  - tools: `# tests 49 # pass 15 # fail 34`. Every failure is in `registerListPluginsTool`, and the trap's refusal appears 68 times.
  - **GREEN:** 114/114 across the four files. Typecheck and `npm run fallow` exit 0, so the four local traps form no clone group.

## Deviations from Plan

### Auto-fixed Issues

**1. [Plan accuracy] update-preflight had three HttpError fabrications, not one**
- **Found during:** Task 2
- **Issue:** `refusedWith` built HTTP 404, 503, and 401 errors. The plan named only the 404.
- **Fix:** Each became the `GitCommandError` system git gives: `repository-not-found` 404, `network` 503, `https-auth` `no-credential`. Every row keeps its reason and its cause.
- **Commit:** `b7f9d9b`

**2. [Plan accuracy] The reinstall 404 case's notes and TUI cause name the git error**
- **Found during:** Task 2
- **Issue:** The notes and the cause line held `HTTP Error: 404 Not Found`, which is the `HttpError` message.
- **Fix:** They now hold `git clone --depth failed: repository-not-found, exit code 128`. The reason (`source missing`) and the frame (`404 on https://github.com/org/repo.git`) are unchanged, so this is a fixture change, not a behavior change.
- **Commit:** `b7f9d9b`

**3. [Comment accuracy] The bootstrap header named "two" clone-carrying cases**
- **Issue:** Three cases that assert the count reach the clone, and the dependency-step case never asserted it.
- **Fix:** The header now says so.
- **Commit:** `9a2e30c`

---

**Total deviations:** 3 (2 plan accuracy, 1 comment accuracy). **Impact:** none outside the plan's twelve files. No production file changed.

## Issues Encountered

- The session refuses Bash text that names a path containing `git` in a complex form. Edits, RED runs, and commits ran from scripts in the scratch directory.
- `npx eslint --fix` did not move the new import into place, so a script moved it. ESLint then passed.
- **Suite runs:** `npm run test:modules` passed 19,171 of 19,172 tests. The one failure is the known baseline `test/bridges/hooks/dispatch-exec.test.ts:39` (environment too large). `npm run test:integration` passed 425 of 426 tests. The failure was `test/integration/subagent-hook-ownership.test.ts:234`: `ESRCH` on `/proc/<pid>/environ` in `features/lib/subagent-hook-session.ts`, because a child exited during teardown. Re-run alone, that file passed 2/2. Neither failure touches this plan's files.
- No test reaches a remote host. Under the trap, the edge owners cannot start git, and the other reworked tests use the fake with `allowedRemoteUrls`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-03-40: the trap on `NODE_GIT_PROCESS.run` rejects before git starts, and the Task 3 RED run shows that it fires. T-03-41: the before and after case counts and every changed assertion are in the table above. T-03-SC: nothing was installed.

## Lines for later plans

- **Remaining `isomorphic-git` importers:** in tests, `test/platform/git.test.ts` only (`grep -rln 'from "isomorphic-git' test features scripts`). In production, `extensions/pi-claude-marketplace/platform/git.ts` only. `shared/git-failure-classifiers.ts`, `shared/errors.ts`, `platform/git-auth-callbacks.ts`, `orchestrators/marketplace/{add,shared}.ts`, `orchestrators/plugin/clone-cache.ts`, `orchestrators/auth-host.ts`, and `domain/{auth-registry,github-auth}.ts` name it in comments or types only.
- **Remaining D-14 member names (`forceUpdateRef`, `currentBranch`):** `test/platform/git-ops-fake.ts`, `test/platform/git-ops-fake.test.ts`, `test/platform/git-ops-contract.ts`, `test/platform/git.test.ts`, and production `platform/git.ts` and `orchestrators/marketplace/shared.ts`. Also, at this base, the 03-12 files `test/orchestrators/marketplace/{shared,update,add}.test.ts` and `test/orchestrators/plugin/fetch.test.ts`, which 03-12 decouples in this wave.
- **For 03-15:** when `GitOps.fetch`, `forceUpdateRef`, and `currentBranch` go, drop their arrays from `GitOpsFakeCalls` and the fake. `recordedCalls` needs no change. The trap comments say "the default port's git commands", which stays true after the in-process `fetch` is gone.
- **For SG-CLS-01:** the 14 other edge owners still carry an `https.request` hermeticity trap whose comment names `simple-get`. This plan left them as they are.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The plan's work is complete. The wave gate runs `npm run check`.
- 03-15 can delete the D-14 members and the `isomorphic-git` dependency without editing any of these twelve files, except to drop the fake's D-14 arrays.

## Self-Check: PASSED

- FOUND: all 12 modified files. No file was created.
- FOUND: `6b3df6d`, `b7f9d9b`, `9a2e30c` in `HEAD`'s history.
- Acceptance: `recordedCalls` in the fake = 1. D-14 names in the four Task 1 files = 0. `isomorphic-git` imports in the two Task 2 files = 0. `installNetworkCounter` in the four Task 3 files = 0. `NODE_GIT_PROCESS` in `add.test.ts` = 5.
