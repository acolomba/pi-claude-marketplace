---
phase: 05-credential-surface
plan: 12
subsystem: credentials
tags: [system-git, device-flow, removal, harness, comments]

requires:
  - phase: 05-credential-surface
    provides: "05-06 deleted the sign-in stand-in and its steps; 05-07 to 05-11 removed the last product code of the removed flow, so only names and comments were left"
provides:
  - "The GitHub redirect harness at `features/lib/github-redirect/` (extension, routing, CONNECT proxy) and its request window `features/support/github-redirect.ts`"
  - "`routeRequest` with one target: every https request for `github.com` goes to the git host"
  - "No comment or test title under `extensions/` or `test/` describes the removed sign-in or cites the retired retry decision"
affects: [05-13, credential surface, cucumber skill]

actuals:
  tokens: 23000
  tasks: 3
  commits: 4
plan_head_before: 6840999b954fa740af7177609c33de0b23a29cae
plan_head_after: bcd58f5238fed3b92d4a3a9bb7cea4085253d6f2

tech-stack:
  added: []
  patterns:
    - "A wording item that is data (a sample string, an assertion message, a table `title:` field, a test-local helper name) goes in its own commit before a comment-only task, so the comment-only diff gate checks only comments"

key-files:
  created: []
  modified:
    - features/lib/github-redirect/routing.ts
    - features/lib/github-redirect/extension.ts
    - features/lib/github-redirect/connect-proxy.ts
    - features/support/github-redirect.ts
    - features/step_definitions/git-host.steps.ts
    - test/architecture/github-redirect.test.ts
    - .agents/skills/cucumber/rules/world-and-stand-ins.md
    - .agents/skills/cucumber/rules/layout.md
    - .agents/skills/cucumber/rules/steps.md
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - test/edge/completions/data.test.ts

key-decisions:
  - "The redirect routes a `/login/` path of github.com to the git host like any other path. No product code sends one, and if one came back the routes table of its scenario would show the extra row"
  - "The non-comment wording items (the two `credential fill` samples 05-11 left, a sample cause, three assertion messages, one table title, and the `signInFailed` helper name) went in a separate commit before Task 3, so Task 3's comment-only gate passes on its own commit"
  - "The shared network-trap comment keeps each file's own claim about the hosted catalog download (`which no removal enters` and so on). For the two completion tests it now says `which no completion lookup calls`, because fallow traces a type-only import path from `edge/completions/data.ts` to `platform/hosted-manifest-fetch.ts`, so `not in this module's closure` no longer holds word for word"

patterns-established:
  - "A comment says why something is absent by citing D-SG-27, without naming the removed flow"

requirements-completed: [SG-AUTH-02]

coverage:
  - id: D1
    description: "The routed GitHub scenarios run through `features/lib/github-redirect/`, whose rule sends every https github.com request to the git host, passes loopback, and refuses everything else"
    requirement: SG-AUTH-02
    verification:
      - kind: unit
        ref: "test/architecture/github-redirect.test.ts, github-connect-proxy.test.ts, hermetic-git-environment.test.ts, https-git-host-server.test.ts (62 of 62)"
        status: pass
      - kind: e2e
        ref: "node scripts/cucumber.mjs --profile adapter on the credentials, github-refresh, and github-transport feature files (77 of 77)"
        status: pass
      - kind: e2e
        ref: "features/marketplace features/plugin: adapter 1539 of 1539, builtin 42 of 42"
        status: pass
    human_judgment: false
  - id: D2
    description: "No extension source comment describes the removed sign-in or cites D-SG-14, and the sweep changed comments only"
    requirement: SG-AUTH-02
    verification:
      - kind: other
        ref: "grep gates (0 files) and the comment-only diff gate against TASK_BASE 75b3006 (0 lines); npm run check:static passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "No test title, comment, or sample string describes the removed sign-in or cites D-SG-14, and every test still passes"
    requirement: SG-AUTH-02
    verification:
      - kind: other
        ref: "grep gates (0 files) and the comment-only diff gate against TASK_BASE b06228f (0 lines)"
        status: pass
      - kind: unit
        ref: "npm run --silent test:unpaired and npm run --silent test:modules (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The cucumber skill describes the redirect harness as it is after the rename"
    verification: []
    human_judgment: true
    rationale: "Prose accuracy of the skill rules is a reading judgment; no test reads the skill text"

duration: 34min
completed: 2026-11-27
status: complete
---

# Phase 5 Plan 12: The GitHub redirect harness and the credential wording sweep Summary

**The Device Flow harness directory is now `features/lib/github-redirect/`. Its rule has one target: every https request for `github.com` goes to the run's git host, `/login/` paths included. The cucumber skill describes that harness. No comment, test title, or sample string under `extensions/` or `test/` describes the removed sign-in or cites the retired retry decision.**

## Performance

- **Duration:** about 34 min
- **Started:** 2026-11-27T22:15:54Z
- **Completed:** 2026-11-27T22:49:34Z
- **Tasks:** 3 (4 commits: one per task, plus one deviation commit before Task 3)
- **Files modified:** 51 (0 created, 45 modified, 6 renamed, 0 deleted)

PLAN_BASE: `6840999b954fa740af7177609c33de0b23a29cae` (the worktree base).
TASK_BASE for Task 2: `75b3006` (the Task 1 commit). TASK_BASE for Task 3: `b06228f` (the deviation commit).

## Accomplishments

- Task 1 (D-BG-01, D-SG-27): the harness is renamed with `git mv`, and every import follows. `RedirectConfig` holds `gitHost` only. `RouteTarget` is the one value `git host`. `routeRequest` routes every https `github.com` request to the git host with its path and query kept, passes loopback, and refuses any other host, and `github.com` too when there is no config. The extension's config check reads only `gitHost`. Its module doc says such a Pi runs GitHub's transport rules and the ssh probe, says the product's only `fetch` (the hosted catalog download) goes through the replaced global, and says git reaches the git host through the CONNECT proxy. The proxy doc names a credential stored for `github.com`, as the credential steps store one. Every D-SG-14 citation in the harness now cites D-BG-01: `world.ts`, `pi-rpc.ts`, `hermetic-git.ts`, `https-git-host/server.ts`, `connect-proxy.ts`, and `extension.ts`. `pi-rpc.ts` now calls it the routed profile. The comment above the routed step says every github.com request goes to the git host.
- Task 1 tests: `github-redirect.test.ts` drops the sign-in cases and the config's second address. It keeps the git-host, loopback (3), refusal (5), and no-config cases, and adds `routes a request for a /login/ path of github.com to the git host like any other path`. `hermetic-git-environment.test.ts`, `https-git-host-server.test.ts`, and `github-connect-proxy.test.ts` cite D-BG-01 and the routed profile in their titles and docs.
- Task 1 skill: `world-and-stand-ins.md` drops the sign-in stand-in paragraph. It rewrites the redirect paragraph: the new path, the one route, the CONNECT proxy and its test, the three routed steps (the environment-variables form included), and the new test name. It also rewrites the `withoutGitHubBaseOverride` paragraph: that profile runs GitHub's transport rules and signs in nowhere (D-BG-01, D-SG-27). `steps.md` names `features/support/github-redirect.ts` and the redirect log only. `layout.md` lists `features/lib/github-redirect/**` and `test/architecture/github-redirect.test.ts`. It keeps its Phase 11 rows, with one added note: D-SG-27 removed the files those rows name, `platform/git-auth-callbacks.ts` went with the move to system git (D-SG-01), and `orchestrators/auth-host.ts` stays.
- Task 2 (D-SG-27): ten extension files, comments only. The https-auth detail docs in `shared/errors.ts`, `platform/git-failure-kind.ts`, `shared/git-failure-classifiers.ts`, and `orchestrators/marketplace/shared.ts` cite D-1-02 and GAUTH-04. The `no-credential` detail gets the D-1-02 hint where the verb adds it, and `rejected` is GAUTH-04's error. `hosted-manifest-fetch.ts` is the only module that calls `fetch`. The background pass gives git stored credentials only (D-PL8-12). The D-76-02 reason in `domain/source.ts` (two places) is now one canonical identity per repo, so the GitHub transport and tag-read rules apply (D-SG-18, D-SG-20). The `info.ts` fold cites GAUTH-04. In `update-flow.ts`, the sync doc says git asks the user's own credential helpers, and a miss fails as `authentication required` (D-1-02). The converge doc says cascade mode gives git stored credentials only (D-3-04). The `update-swap.ts` `preflightNotification` doc says the move's tag queries run as the command's do, with git asking the user's own helpers (D-SG-05).
- Task 3 (D-SG-27): 21 test files, titles and comments only. The shared comment above `installNetworkTrap` (eight edge tests) and the matching prose in `pending`, `reinstall`, `uninstall`, and `list` (plugin) say three things: the door is Node's in-process HTTPS client, git runs as a child process that `platform/git-process.ts` starts (D-SG-01) and the trap does not see it, and `platform/hosted-manifest-fetch.ts` is the only production `fetch` caller. The `trapGitProcess` docs of the marketplace add, update, and bootstrap handler tests name the hosted catalog download as the one `fetch` caller. The provider-registry sentences in the edge marketplace add and update tests are gone.

### Renamed files (Task 1, `git mv`)

- `features/lib/github-device-flow/connect-proxy.ts` -> `features/lib/github-redirect/connect-proxy.ts`
- `features/lib/github-device-flow/extension.ts` -> `features/lib/github-redirect/extension.ts`
- `features/lib/github-device-flow/routing.ts` -> `features/lib/github-redirect/routing.ts`
- `features/support/github-device-flow.ts` -> `features/support/github-redirect.ts`
- `test/architecture/github-device-flow-connect-proxy.test.ts` -> `test/architecture/github-connect-proxy.test.ts`
- `test/architecture/github-device-flow-redirect.test.ts` -> `test/architecture/github-redirect.test.ts`

### Deleted files

None. The directory `features/lib/github-device-flow/` no longer exists because its three files moved.

### Deleted and added cases (Task 1, `test/architecture/github-redirect.test.ts`, 14 to 11 runs)

- Deleted: `routes https://github.com${path} to the sign-in stand-in` (2 rows), `routes a git request to the git host when the config names no sign-in stand-in`, and `refuses a sign-in request when the config names no sign-in stand-in`.
- Added: `routes a request for a /login/ path of github.com to the git host like any other path`.

### Retitled cases

- `test/architecture/hermetic-git-environment.test.ts`: `D-SG-14: adds the Device Flow profile's https_proxy ...` is now `D-BG-01: adds the routed profile's https_proxy and no_proxy, not the shell's`.
- `test/architecture/https-git-host-server.test.ts` and `test/architecture/github-connect-proxy.test.ts`: the trailing `(D-SG-14)` is now `(D-BG-01)`.
- `test/orchestrators/marketplace/update.test.ts`: three GAUTH-04 titles say `a url host` instead of `a host with no Device Flow`. `GAUTH-02: a declined/failed Device Flow on refresh ...` is now `GAUTH-04: a github refresh whose git found no credential renders {authentication required}, not the lying {network unreachable}`.
- `test/orchestrators/marketplace/add.test.ts`:
  - `GAUTH-02: a declined/failed Device Flow renders ...` is now `GAUTH-04: a github add whose git found no credential renders ...`.
  - `GAUTH-02 orchestrated mode -- a failed Device Flow returns ...` is now `GAUTH-04 orchestrated mode -- a github add whose git found no credential returns ...`.
  - `D-79-03: a url add that 401s renders the bare (failed) {authentication required} row with NO cause line`.
  - `D-76-02: an add whose host case-folds to github.com clones as a github source with a github.com auth bundle` (was `PROV-01 / D-76-02 ... the provider auth bundle`).
  - `GAUTH-03 / MURL-08: a gitlab.com url add clones the URL as typed WITH an auth bundle bound to gitlab.com on the same clone call` (was `GAUTH-02 / MURL-08 ... the GitLab provider's auth bundle ...`).
- `test/orchestrators/plugin/fetch.test.ts`: `D-SG-14: a clone the host refused ...` is now `GAUTH-04: ...`.
- `test/orchestrators/plugin/info.test.ts`: `FTCH-06: info --fetch folds a clone with no credential to {authentication required}`.
- `test/orchestrators/plugin/install.messaging.test.ts`: `classifies a cancelled credential lookup without exposing its cause`.
- `test/shared/git-failure-classifiers.test.ts` (table `title:` field, in the deviation commit): `SG-PRC-05: classifies ${label} failure as authentication required with no frame`.
- Every changed test file was checked for duplicate literal titles: none.

### Suite counts

- Task 1 unit verify (4 architecture tests): 62 of 62, before the commit and again on the committed tree (tracer gate: interactive, `end-of-phase`, automated-only verify, so it re-ran the verify and continued).
- Task 1 cucumber verify, adapter (the 7 credentials, github-refresh, and github-transport feature files): 77 scenarios, 77 passed (1190 steps).
- Task 1 `npm run --silent check:static`: all seven steps passed. No `.feature` file changed since PLAN_BASE (`git diff --name-only 6840999 -- '*.feature'` is empty).
- Task 2 gates: 0 files with the gate words, 0 with the seam words, 0 non-comment changed lines against TASK_BASE `75b3006`. `npm run --silent check:static` passed.
- Deviation commit owner tests (`add`, `install.messaging`, `git-failure-kind`, `errors`, `git-failure-classifiers`): 728 of 728.
- Task 3 gates: 0 files with the gate words, 0 with the seam words, 0 non-comment changed lines against TASK_BASE `b06228f`. `npm run --silent test:unpaired` exit 0. `npm run --silent test:modules` exit 0.
- Commit hooks: `npm run check:commit` passed on `75b3006`, `f5cb025`, `b06228f`, and `bcd58f5`.
- Plan verification, `features/marketplace features/plugin`: adapter 1539 scenarios, 1539 passed (18456 steps). Builtin 42 scenarios, 42 passed (544 steps).

## Task Commits

1. **Task 1: Routed GitHub scenarios run through the renamed redirect harness** - `75b3006` (test)
2. **Task 2: No extension source describes the removed sign-in or cites the retired retry decision** - `f5cb025` (docs)
3. **Deviation (before Task 3): sign-in names in test data and messages** - `b06228f` (test)
4. **Task 3: No test describes the removed sign-in or cites the retired retry decision** - `bcd58f5` (test)

No task is a TDD task, so there is no RED commit.

## Files Created/Modified

- `features/lib/github-redirect/{routing,extension,connect-proxy}.ts`: renamed. The rule has one target, the config check reads only `gitHost`, and the docs match.
- `features/support/github-redirect.ts`: renamed, and its doc names the harness logs.
- `features/support/world.ts`, `features/lib/pi-rpc.ts`, `features/lib/hermetic-git.ts`, `features/lib/https-git-host/server.ts`, `features/step_definitions/git-host.steps.ts`: imports and comments.
- `test/architecture/{github-redirect,github-connect-proxy,hermetic-git-environment,https-git-host-server}.test.ts`: cases, titles, docs.
- `.agents/skills/cucumber/rules/{world-and-stand-ins,steps,layout}.md`: the harness as it is.
- Task 2 (comments only): `domain/source.ts`, `orchestrators/marketplace/{background-pass,shared}.ts`, `orchestrators/plugin/{info,update-flow,update-swap}.ts`, `platform/{git-failure-kind,hosted-manifest-fetch}.ts`, `shared/{errors,git-failure-classifiers}.ts` (under `extensions/pi-claude-marketplace/`).
- Deviation commit: `test/shared/errors.test.ts`, `test/platform/git-failure-kind.test.ts`, `test/orchestrators/plugin/install.messaging.test.ts`, `test/orchestrators/marketplace/add.test.ts`, `test/shared/git-failure-classifiers.test.ts`.
- Task 3 (titles and comments only): `test/edge/completions/{data,provider}.test.ts`, `test/edge/handlers/marketplace/{add,info,list,remove,update}.test.ts`, `test/edge/handlers/plugin/{bootstrap,enable-disable,import,list,pending,reinstall,uninstall}.test.ts`, `test/edge/register.test.ts`, `test/orchestrators/marketplace/{add,update}.test.ts`, `test/orchestrators/plugin/{fetch,info,install.messaging,update-flow}.test.ts`.

Many files in the plan's `files_modified` list needed no change. 05-02 to 05-11 had already cleaned them, so the read-first greps listed 13 lines in `extensions/` and 34 in `test/` at this plan's base.

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The test gate words also sat in data lines, which Task 3's comment-only gate forbids changing**
- **Found during:** Task 3 (the read-first grep)
- **Issue:** Some hits were not comments or `test(` titles. They were the `device flow cancelled` sample cause in `install.messaging.test.ts`, the assertion message `a declined Device Flow must render ...` in `add.test.ts`, and the `D-SG-14` in a table `title:` field of `git-failure-classifiers.test.ts`. Task 3's grep gate needs them gone. Its diff gate fails on any non-comment line. The orchestrator also assigned the two `credential fill` samples that 05-11 left, `errors.test.ts:815` and `git-failure-kind.test.ts:57`, and 05-02 and 05-09 listed the `signInFailed` helper and the provider assertion messages in `add.test.ts`.
- **Fix:** One separate commit before Task 3, with 11 line edits. The timeout sample's operation became `ls-remote`, and its expected message follows it (`git ls-remote timed out after 5000 ms`). The label is `a username prompt with no helper`. The sample cause is `credential lookup cancelled`. The helper is `noCredentialFailure`. The assertion messages are `a clone with no credential must render ...`, `a github.com host must attach an auth bundle`, and `gitlab.com must attach the auth bundle of its host`. The table title drops `D-SG-14`. Then TASK_BASE was set to that commit, so Task 3's commit is comments and titles only.
- **Files modified:** `test/shared/errors.test.ts`, `test/platform/git-failure-kind.test.ts`, `test/orchestrators/plugin/install.messaging.test.ts`, `test/orchestrators/marketplace/add.test.ts`, `test/shared/git-failure-classifiers.test.ts`
- **Verification:** owner tests 728 of 728. `check:commit` passed in the hook. Each edit keeps what its test proves: the timeout case still checks that the message names the operation and the limit, and the cause case still checks that the cause is not shown.
- **Committed in:** `b06228f`

**2. [Rule 1 - Bug] Stale transport and provider wording next to the swept lines**
- **Found during:** Task 3
- **Issue:** The shared network-trap comment said the git transport opens `https.request` through `isomorphic-git/http/node`. That has been false since D-SG-01. The edge marketplace add and update tests still described the provider registry, a "device / flow" split across two lines that the one-line grep missed, and a `structuredClone` failure of credential-bundle functions that no bundle has now.
- **Fix:** As the plan asks, the shared comment says git runs as a child process that `platform/git-process.ts` starts (D-SG-01). The provider, line-split, and bundle-function sentences were rewritten or deleted (comments only, in the Task 3 commit).
- **Files modified:** the Task 3 files listed above
- **Committed in:** `bcd58f5`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 stale wording)
**Impact on plan:** No product code, assertion logic, scenario, or user-visible text changed. The deviation commit changes only test data that no assertion compares with product output, apart from the timeout message, whose input changed with it.

## Issues Encountered

None.

## Deferred Issues

- `eslint.config.js:148`: the GHB-02 `no-github-literal` rule message still lists "a Device Flow endpoint" as a reason to disable the rule. No source carries such a disable. This file is outside this plan's trees and is not in 05-13's file list either. Dropping the clause is a one-line build-input change for whoever owns ESLint messages.
- `README.md:246` and `README.es.md:246` still say a private repository triggers Device Flow. 05-13 owns both READMEs.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-22 (mitigate): `routeRequest` still refuses every non-loopback host except `github.com`, and it routes `github.com` only to the run's git host. `github-redirect.test.ts` pins the refusal (5 hosts, http `github.com` among them), loopback (3), no-config, and `/login/` cases. `usePiWithProfile` still refuses a no-override Pi without the redirect, and the CONNECT proxy still tunnels only `github.com:443` to the git host (its 62-case architecture run passed). T-05-SC (mitigate): no package was added, removed, or upgraded. No test reached a host other than a loopback stand-in, and no test ran a real ssh: every routed scenario ran the profile Pi with the ssh stand-in first on its path.

## Orchestrator actions

None. The plan asks for no `gsd-tools windows append`, and this plan leaves no stub, skipped test, or unrun verify. The two deferred wording items above are outside the plan's files. They are not defects of the ship gate's kinds, so no ledger entry is proposed.

## Next Phase Readiness

- 05-13 can record the rename in the codebase map: `features/lib/github-redirect/` and the two renamed architecture tests. It owns the README wording above.

## Self-Check: PASSED

- The renamed files exist: `features/lib/github-redirect/{routing,extension,connect-proxy}.ts`, `features/support/github-redirect.ts`, `test/architecture/github-redirect.test.ts`, `test/architecture/github-connect-proxy.test.ts`. The old paths are absent.
- `75b3006`, `f5cb025`, `b06228f`, and `bcd58f5` are ancestors of HEAD. `git rev-list --count 6840999..HEAD` is 4 before this SUMMARY commit.
- Task 1 acceptance: old names in `features test .agents`: 0 files. `signIn`/`"sign-in"`/`SIGN_IN` in the harness: 0. `D-SG-14` in `features`: 0.
- Task 2 acceptance: gate words in `extensions`: 0 files. Seam words: 0.
- Task 3 acceptance: gate words in `test`: 0 files. Seam words: 0. `credential fill` in `test`: 0.

---
*Phase: 05-credential-surface*
*Completed: 2026-11-27*
