---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "01"
subsystem: testing
tags: [cucumber, https, git-http-backend, openssl, node-https, hermetic-git]

requires:
  - phase: 08
    provides: the cucumber harness with the run's one headless Pi, the published-marketplace dispatch by source kind, and the run tokens
provides:
  - A per-worker loopback HTTPS git host (HttpsGitHost) started before Pi, reset and asserted empty before every scenario, closed after Pi
  - The typed Pi git and trust environment (RpcGitEnvironment, rpcChildEnvironment) on startRpcPi
  - The hermetic git environment and async runner of the CGI and the fixture git (hermeticGitEnvironment, runGit)
  - The url arm of requireFreeRoot / publishMarketplace / publishMarketplaceIn and the PublishedMarketplace path|git union
  - The {git host} run token, the per-When request window, and the step "the git host receives these requests:"
  - features/marketplace/url-source.feature with the walking-skeleton scenario
affects: [09-02, 09-03, 09-04, phase-10-github-source]

actuals:
  tokens: 11800
  tasks: 1
  commits: 2

plan_head_before: 5f5ea81cc6791a60f4dd42900a37da294ff0299f
plan_head_after: 02e69d6a17bc81c46afb2662c145427f159d1459

tech-stack:
  added: []
  patterns:
    - "Stand-in lifetime on PiRun: the git host shares Pi's run state, starts before Pi, is reset before the sandbox is emptied, and is closed after Pi"
    - "Request window: a BeforeStep hook keyed on Action steps opens a window, and a log step reads only the requests since the last When"
    - "Every git and openssl call in features/ is an async child process (a blocking call would deadlock the worker that serves the host)"

key-files:
  created:
    - features/lib/https-git-host/server.ts
    - features/lib/https-git-host/cgi.ts
    - features/lib/hermetic-git.ts
    - features/lib/git-marketplace.ts
    - features/support/https-git-host.ts
    - features/step_definitions/marketplace/git-host.steps.ts
    - features/marketplace/url-source.feature
  modified:
    - tests/e2e/_rpc.ts
    - features/lib/pi-process.ts
    - features/lib/published-marketplace.ts
    - features/lib/run-tokens.ts
    - features/support/pi-process.ts
    - features/support/world.ts
    - features/step_definitions/marketplace/publishing.steps.ts
    - features/step_definitions/marketplace/add.steps.ts
    - features/step_definitions/marketplace/info.steps.ts

key-decisions:
  - "The checkpoint commit leaves runGit out of hermetic-git.ts and the final commit adds it, because fallow fails a commit on an export with no consumer; hermetic-git.ts is therefore in both commits"
  - "PathPublication and GitPublication are exported, because fallow reports an exported union of same-file private types as a private-type leak"
  - "rpcChildEnvironment copies the three RpcGitEnvironment keys by name onto the four-key allowlist object; nothing spreads git or process.env"

patterns-established:
  - "PublicationSites: publishing functions take { marketplacesRoot, gitHost } so features/lib never imports features/support"
  - "GitRepositoryHost: the structural interface HttpsGitHost satisfies, so published-marketplace.ts does not import the server"

requirements-completed: [HOST-01, HOST-02, HOST-04, DRV-03]

coverage:
  - id: D1
    description: "A url marketplace added through the real offline Pi RPC child clones over HTTPS from the per-worker loopback git host; the scenario pins the add result, the base config, and the exact two-request log"
    requirement: HOST-01
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace clones it from the git host"
        status: pass
      - kind: other
        ref: "npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each worker starts its own host before Pi; Before() replaces a busy Pi with the same environment, resets the host, and asserts the snapshot { repositories: [], requests: [], connections: 0, children: 0 }; AfterAll() closes it after Pi"
    requirement: HOST-02
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (314 scenarios, parallel 8, order random)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The request log keeps every request in arrival order with its final status, and the log step compares the whole method/path/status table of the window that the last When opened"
    requirement: HOST-04
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace clones it from the git host"
        status: pass
    human_judgment: false
  - id: D4
    description: "Pi's environment is the four-key allowlist plus NODE_EXTRA_CA_CERTS, GIT_CONFIG_NOSYSTEM=1, and GIT_CONFIG_GLOBAL under the sandbox HOME; the CGI and fixture git use a scratch HOME and GIT_CONFIG_GLOBAL=/dev/null, built from scratch"
    requirement: DRV-03
    verification:
      - kind: other
        ref: "rg -n '\\.\\.\\.\\s*(git|process)\\b' tests/e2e/_rpc.ts (no match); rg -c 'NODE_EXTRA_CA_CERTS|GIT_CONFIG_NOSYSTEM|GIT_CONFIG_GLOBAL' tests/e2e/_rpc.ts (6)"
        status: pass
    human_judgment: true
    rationale: "The grep proves the shape only; plan 09-02 pins the whole environment objects with unit cases and plan 09-04 runs the by-hand leak control"

duration: 14min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 01: Url source walking skeleton Summary

**A loopback `node:https` git host per cucumber worker (openssl certificate made at run time, `git http-backend` CGI, full request log) that the offline Pi RPC child clones a url marketplace from with TLS verification on, proven by one scenario that pins the exact request log.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-21T02:56:24Z
- **Completed:** 2026-10-21T03:09:55Z
- **Tasks:** 1 (a tracer task landed in two green commits)
- **Files modified:** 16

## Accomplishments

- `HttpsGitHost` (`features/lib/https-git-host/server.ts`) binds `127.0.0.1` on an OS-picked port, makes a one-day P-256 certificate under the run root with async `openssl`, serves `repositories/acme/*.git` through `git http-backend`, counts connections, tracks CGI children, and offers `mark`, `requestsSince`, `snapshot`, `reset`, and `close`. Error handlers on `req`, `res`, the child, and `child.stdin` keep a dropped socket from crashing the worker.
- `features/lib/https-git-host/cgi.ts` builds the CGI environment from the hermetic git environment (body buffered, so `CONTENT_LENGTH` is always set), spawns the backend, and parses its output (first blank line, `Status` header, binary body).
- `PiRun` now holds `gitHost` and `piEnvironment`. `BeforeAll` starts the host before Pi. `Before` replaces a busy Pi with the same environment, resets the host before it empties the sandbox, and asserts the host snapshot empty after the session and the `list`. `AfterAll` closes the host after Pi.
- `startRpcPi(sandbox, git)` and the exported `rpcChildEnvironment` add exactly the three typed keys to Pi's allowlist. `runRpcSession` is unchanged, so `tests/e2e/adapter-detection-rpc.test.ts` keeps today's environment.
- The url arm of `publishMarketplaceIn` writes the dir files on a work tree and publishes them as a bare repository through `publishGitRepository`. `requireFreeRoot` checks that both the work tree and the bare repository are absent.
- The `{git host}` token, the `BeforeStep` request window, the step `the git host receives these requests:`, and `features/marketplace/url-source.feature`.

## Task Commits

1. **Task 1, checkpoint: start an https git host before pi in each worker** - `a139fedc` (test)
2. **Task 1, final: clone a url marketplace from the loopback git host** - `02e69d6a` (test)

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `features/lib/https-git-host/server.ts` - the host: certificate, server, log, connections, children, reset, snapshot, close
- `features/lib/https-git-host/cgi.ts` - CGI environment, `git http-backend` spawn, response parser
- `features/lib/hermetic-git.ts` - scratch-HOME git environment and async `runGit`
- `features/lib/git-marketplace.ts` - first publication of a work tree into a bare repository
- `features/support/https-git-host.ts` - the `BeforeStep` hook that opens the request window at each `When`
- `features/step_definitions/marketplace/git-host.steps.ts` - the request-log step
- `features/marketplace/url-source.feature` - the walking-skeleton scenario
- `tests/e2e/_rpc.ts` - `RpcGitEnvironment`, `rpcChildEnvironment`, `startRpcPi(sandbox, git)`
- `features/lib/pi-process.ts` - `PiProcess.start(sandbox, git)` and the re-exported type
- `features/lib/published-marketplace.ts` - `GitRepositoryHost`, `PublicationSites`, the path|git publication union, the url arms
- `features/lib/run-tokens.ts` - `RunTokens.gitHost` and `{git host}`
- `features/support/pi-process.ts` - host lifetime on `PiRun`
- `features/support/world.ts` - `gitHost`, `publicationSites`, `requestWindow`, `requestsOfLastCommand()`
- `features/step_definitions/marketplace/{publishing,add,info}.steps.ts` - pass `this.publicationSites`

## Verification evidence

Environment: Node v26.11.1, git version 2.55.0, OpenSSL 4.0.3 (29 Sep 2026). Precondition `test -x "$(git --exec-path)/git-http-backend" && openssl version` exited 0.

| Stage | Command | Exit | Result |
| --- | --- | --- | --- |
| Checkpoint | `npm run typecheck` | 0 | no `error TS` line |
| Checkpoint | `npm run check:features` | 0 | no "Feature gate failed" |
| Checkpoint | `npm run test:cucumber` | 0 | `313 scenarios (313 passed)`, 16 hooks passed |
| Checkpoint | commit hook (`check:commit`) | 0 on retry | see deviation 1 |
| Final | `npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1` | 0 | `1 scenario (1 passed)` |
| Final | `npm run test:cucumber` | 0 | `314 scenarios (314 passed)` |
| Final | `npm run check:features` | 0 | no "Feature gate failed" |
| Final | `npm run typecheck` | 0 | no `error TS` line |
| Final | commit hook (`check:commit`) | 0 on retry | see deviation 2 |
| Tracer gate | all four `<verify>` commands, again on the committed tree | 0 | 1/1 and 314/314 passed |

Negative control (not committed): changing the expected POST status to `404` in the feature made the scenario fail at the log step with a `'200'` vs `'404'` diff, so the log step compares the real statuses.

Acceptance greps: `rg -c` of the three Pi keys in `tests/e2e/_rpc.ts` = 6. No spread of `git` or `process` there. `PATH: process` = 1. `GIT_CONFIG_NOSYSTEM` appears once in each of `hermetic-git.ts` and `support/pi-process.ts`. `http-backend` is in `cgi.ts`, and exactly one `listen(0, "127.0.0.1"` line is in `server.ts`. No `execFileSync`/`spawnSync` under `features/lib`. The TLS/private-key prohibition grep finds nothing. `{git host}` appears 4 times in `run-tokens.ts`. `this.marketplacesRoot` counts: 1 in publishing, none in info, 2 in add. `git host receives` appears only in `url-source.feature`. The checkpoint commit lists exactly the six planned paths.

## Decisions Made

- The checkpoint version of `hermetic-git.ts` has no `runGit`; the final commit adds it (deviation 1).
- `PathPublication` and `GitPublication` are exported (deviation 2).
- `rpcChildEnvironment` assigns the three keys onto the allowlist object by name instead of building one literal per branch. This keeps a single allowlist builder (`PATH: process` = 1), and no spread is involved.
- The snapshot lists repositories two levels deep (`acme/<name>.git`), so it does not walk repository internals.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] fallow rejected the checkpoint commit for an export with no consumer**
- **Found during:** Task 1 checkpoint commit
- **Issue:** The plan puts `hermetic-git.ts` (with `runGit`) in the checkpoint, but `runGit`'s only consumer, `git-marketplace.ts`, lands in the final commit. The commit hook's `fallow dead-code` failed with `Unused exports: features/lib/hermetic-git.ts:34 runGit`.
- **Fix:** Committed the checkpoint without `runGit` (and its `execFile` import), then restored it in the final commit. The checkpoint still holds exactly the six planned paths. The final commit holds the ten planned paths plus `hermetic-git.ts`, 11 in all.
- **Files modified:** features/lib/hermetic-git.ts
- **Verification:** checkpoint hook passed; the final commit hook passed; the cucumber suite is unaffected, because `runGit` had no caller at the checkpoint
- **Committed in:** a139fedc, 02e69d6a

**2. [Rule 3 - Blocking] fallow reported the publication union as a private-type leak**
- **Found during:** Task 1 final commit
- **Issue:** `export type PublishedMarketplace = PathPublication | GitPublication` with non-exported members fails `fallow dead-code` (private-type-leaks).
- **Fix:** Exported `PathPublication` and `GitPublication`.
- **Files modified:** features/lib/published-marketplace.ts
- **Verification:** `npm run fallow` exit 0; the commit hook passed
- **Committed in:** 02e69d6a

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both were needed to pass the commit gate. No scope change, and nothing runs differently.

## Issues Encountered

- `gsd-tools check evaluation-scope --plan 09-01 --commits-only` returns `no-matching-commits`, because this repository's commit policy forbids plan IDs in commit subjects. The commits are `a139fedc` and `02e69d6a` on `features/cucumber-behavioral-tests`.

## Flagged assumptions (carried from the plan)

- 09-RESEARCH.md A1 / A4: the `openssl` flags and `git http-backend` were verified on Fedora only (OpenSSL 4.0.3, git 2.55.0, Node 26.11.1). CI (`ubuntu-latest`, OpenSSL 3.0.13) first runs them when the branch is pushed. The PR's behavioral tests job is the proof. Nothing was pushed.
- 09-RESEARCH.md A3: the host starts only inside `BeforeAll()`, never at module load. `npm run check:features` (a dry run) passed with the new support module.
- Estimate: the plan's 90k uncalibrated estimate covered the executor's whole context. The `actuals.tokens` value of 11.8k is chars/4 over the realized diff (47,171 chars), as the summary contract defines it.

## Known Stubs

None. The other url arms (`republishMarketplace`, `rewritePublishedManifest`, `invalidateManifest`, and the rest) still throw `noStandIn` by design until plan 09-03, and no default-profile scenario reaches them.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 09-02: pin `parseCgiResponse`, `cgiEnvironment`, `hermeticGitEnvironment`, and `rpcChildEnvironment` with unit cases, and amend the cucumber rules for the git host's run lifetime, the request window, and `{git host}`.
- The orchestrator's post-wave `npm run check` on the combined tree is still owed (AGENTS.md, Build verification). This executor ran the hook's `check:commit`, not the full gate.

## Self-Check: PASSED

- FOUND: all seven created files on disk
- FOUND: a139fedc and 02e69d6a are ancestors of HEAD
- All `<acceptance_criteria>` and the four `<verify>` commands re-ran green on the committed tree

---
*Phase: 09-url-source-kind-and-https-git-stand-in*
*Completed: 2026-10-21*
