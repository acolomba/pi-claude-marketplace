---
phase: 09-url-source-kind-and-https-git-stand-in
verified: 2026-10-21T06:10:00Z
status: passed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-01-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-01-SUMMARY.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-02-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-02-SUMMARY.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-03-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-03-SUMMARY.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-04-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-04-SUMMARY.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-05-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-05-SUMMARY.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-06-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-06-SUMMARY.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-07-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-07-SUMMARY.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-08-PLAN.md"
  - ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-08-SUMMARY.md"
  - "cucumber.json"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
  - "extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts"
  - "extensions/pi-claude-marketplace/shared/notification-json.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "extensions/pi-claude-marketplace/shared/notification-wire.ts"
  - "features/lib/git-marketplace.ts"
  - "features/lib/hermetic-git.ts"
  - "features/lib/https-git-host/cgi.ts"
  - "features/lib/https-git-host/server.ts"
  - "features/lib/pi-process.ts"
  - "features/lib/published-marketplace.ts"
  - "features/lib/run-tokens.ts"
  - "features/marketplace/git-source.feature"
  - "features/marketplace/info.feature"
  - "features/marketplace/unsupported-source.feature"
  - "features/marketplace/update.feature"
  - "features/marketplace/url-source-update.feature"
  - "features/marketplace/url-source.feature"
  - "features/step_definitions/marketplace/git-host.steps.ts"
  - "features/support/https-git-host.ts"
  - "features/support/pi-process.ts"
  - "features/support/world.ts"
  - "tests/architecture/hermetic-git-environment.test.ts"
  - "tests/architecture/https-git-host-cgi.test.ts"
  - "tests/e2e/_rpc.ts"
covered_digest: "v3:sha256:31c451c7c28d5815f8d2fa24cf8d152ae0c0379f0cdc9f690c4dff0ac2fc9b32"
behavior_unverified: 0
overrides_applied: 0
advisory:
  - finding: "The url rows are proven on this machine only (OpenSSL 4.0.3, Node 26, git 2.55); the CI runner (OpenSSL 3.0.13, Node 24) is not exercised until the PR's behavioral tests job runs (RESEARCH assumptions A1, A2, A4)"
    category: other
    reason: "Environment portability of the run-time certificate command, the `socket hang up` and status-phrase strings, and `git http-backend` on ubuntu-latest. Not a phase truth; the PR job resolves it."
    evidence_status: "none provided until CI runs"
  - finding: "IN-05 (09-REVIEW.md): the `git@127.0.0.1:acme/tools.git` and `~other/marketplaces/tools` rows of the refused-form Outline cannot reach the git host's port even if the product accepted them, so `the git host receives no request` cannot fail for those two rows; the unsupported-source reason still can"
    category: other
    reason: "ADD-08 is met in form (all rows assert `unsupported source`; the host-addressed forms http:// and ssh:// can fail the log check). The two rows give a weaker no-request proof."
    evidence_status: "09-REVIEW.md IN-05 (open, info)"
---

# Phase 9: URL Source Kind and HTTPS Git Stand-In Verification Report

**Phase Goal:** A loopback HTTPS git stand-in serves bare marketplace repositories to Pi for the worker's run, url-only failure and no-request behaviors have scenarios, and removing `@url` from the exclusion turns on every url row the verb phases wrote.
**Verified:** 2026-10-21
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

All verification below was re-run by the verifier against HEAD (`c43fa8ca`), not read from the SUMMARYs. The worktree was clean before and after each experiment.

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| SC1 | Url add cloned over HTTPS from the stand-in on `127.0.0.1`, run-time certificate trusted via `NODE_EXTRA_CA_CERTS`, TLS verification never off; log shows the clone; stand-in starts before Pi, lives for the worker's run, reset before every scenario and asserted empty; `{git host}` exact token | VERIFIED | `features/lib/https-git-host/server.ts`: `node:https` server, `listen(0, "127.0.0.1")`, `openssl req -x509` P-256 certificate made in `start()` under the run root; `features/support/pi-process.ts` `BeforeAll` starts `HttpsGitHost` before `PiProcess.start`, passes `NODE_EXTRA_CA_CERTS: gitHost.certificatePath`; `Before()` calls `gitHost.reset()` then `assert.deepStrictEqual` on `{ repositories: [], arms: [], requests: [], connections: 0, children: 0 }`; `AfterAll` stops Pi then closes the host. `grep` for `NODE_TLS_REJECT_UNAUTHORIZED` over `features`, `tests/e2e`, `extensions`, `scripts` finds nothing. `url-source.feature` first scenario asserts `GET /acme/tools.git/info/refs?service=git-upload-pack 200` then `POST /acme/tools.git/git-upload-pack 200`. `world-and-stand-ins.md` line 11 amends the lifetime rule. Full cucumber run: 373 scenarios passed. |
| SC2 | Pi, the stand-in, and every fixture `git` run with `GIT_CONFIG_NOSYSTEM=1`, a sandbox global config, no inherited `GIT_*`; 401 fails `add` as `authentication required` with no stored credential and without reaching an outside helper, and succeeds with a credential stored in the sandbox | VERIFIED | `tests/e2e/_rpc.ts` `rpcChildEnvironment` is an object literal of `HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH` plus the three git keys, no spread of `process.env`; `GIT_CONFIG_GLOBAL` is `<sandbox HOME>/.gitconfig`. `hermeticGitEnvironment` (hermetic-git.ts) sets `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`, scratch HOME, built from scratch; the CGI (`cgiEnvironment`) and every fixture `runGit` use it with the host's own `gitHome`. `node --test tests/architecture/hermetic-git-environment.test.ts tests/architecture/https-git-host-cgi.test.ts`: 17 tests, 17 pass. The two 401 scenarios in `url-source.feature` pass (no credential: bare `authentication required`, log one `401`; credential written to sandbox `.gitconfig`/`.git-credentials` by the Given with no git process: `401, 200, POST 200`). **D-11 control reproduced by the verifier:** with a hostile `GIT_CONFIG_SYSTEM` helper added to `rpcChildEnvironment` and `NOSYSTEM` kept, the 401 scenario passed and the helper's marker file was never written; with the `NOSYSTEM` line also removed the scenario failed and the marker was written (positive control). `tests/e2e/_rpc.ts` restored (`git status` clean). |
| SC3 | 404 add is `source missing`; 5xx add is `network error` with a cause line naming status and URL; a drop is `network unreachable`; `update` against 5xx or 404 is `network error` with the status/URL cause line, a drop is `network unreachable` | VERIFIED | `url-source.feature`: 404 scenario (`source missing`, log `404`), drop scenario (`network unreachable`, log `dropped`), 500/502/503 Outline (`network error`, cause chain `<status> on https://{git host}/acme/tools.git, HTTP Error: <status> <phrase>`). `url-source-update.feature`: 500/502/503/404 Outline (`network error`, same cause frame, log shows the status) and the bare-update drop scenario (`network unreachable`, `socket hang up`, second marketplace `up-to-date`). All pass in the default run. |
| SC4 | Url cloned at exactly the typed URL (no `.git` appended); removed git marketplace re-addable; `list`/`info`/`remove` leave the log empty; refused forms fail as `unsupported source` with no request; re-add, empty-log, refused GitHub-form scenarios carry `@github` blocks | VERIFIED | `A url source is cloned at exactly the url typed` types `https://{git host}/acme/tools`, config declares that exact source, log `GET /acme/tools/info/refs...`, `POST /acme/tools/git-upload-pack`. `git-source.feature`: four Outlines (re-add, list, info, remove) each with `@url` and `@github` Examples blocks; list/info/remove assert `the git host receives no request` (window = the `When` only, asserts zero requests and zero connections). `unsupported-source.feature`: `http://`, `ssh://`, `git@127.0.0.1:...`, `~other/...` run now; `https://github.com/acme/tools/tree/main`, `https://github.com/acme`, `tools`, `acme/tools/extra` sit in an `@github` block for Phase 10, as the roadmap allows. See advisory on IN-05. |
| SC5 | The last plan removes `@url` from the `cucumber.json` exclusion and every `@url` row passes | VERIFIED | `cucumber.json` `tags` is `not @github`; commit `63d05924` is the only change to the exclusion, after every other plan. `npx cucumber-js` (verifier run): **373 scenarios (373 passed), 3413 steps, seed 17387**. `npx cucumber-js --tags @url`: **39 scenarios (39 passed)**. `npm run check:features` exits 0. |
| SC6 | LAYER-07 `@url` rows run and pass: the cross-scope install row and the three user-scope remove Outline rows; each remove row first shown failing on a behavioral assertion on the reuse-the-record code, then passing | VERIFIED | `09-08-RED.json` records exit 1, 3 failed / 3 passed, each failure at `Then the result has these fields:` after every Given/When passed, with `RED_EVIDENCE_OK` for the three remove rows and the planted diff in `diff`; the `f78907bf` plant is recorded as tried first (loads but crashes in the Given install with an internal error, so not behavioral). **Verifier reproduced it:** applied the recorded diff to `install-outcome.ts`, ran `remove.feature` + `cross-scope-install.feature` with `--tags @url --parallel 1`: `6 scenarios (3 passed, 3 failed)`, failures at `command.steps.ts:128` (the fields table) with `error`/`A marketplace operation has failed.`/`A plugin operation has failed.`/`Some operations have failed.` as actual values; `git checkout --` restored the file (`git status` clean); the install Outline's row passed on both. Current code: all 39 `@url` rows green. The plant was never committed. |

**Score:** 6/6 truths verified (0 behavior-unverified).

### CONTEXT.md Decisions D-01..D-19

| Decision | Status | Evidence |
| -------- | ------ | -------- |
| D-01 log row = method, path+query, status | VERIFIED | `GitHostRequest` + `the git host receives these requests:` table columns `method / path / status` |
| D-02 window = last command | VERIFIED | `features/support/https-git-host.ts` `BeforeStep` opens `this.gitHost.mark()` at each `Action` step; `requestsOfLastCommand()` |
| D-03 log steps only in url-owned files | VERIFIED | `grep -ln "git host receives"` finds only `unsupported-source`, `git-source`, `url-source`, `url-source-update` features |
| D-04 no uncompared-log enforcement | VERIFIED | no `markRowsCompared` analogue for the log; `steps.md` line 62 states it |
| D-05 per-repository arms | VERIFIED | `arms: Map<repository, GitHostArm>`, `armFor`; `update` drop scenario arms only `tools` while `extras` is served |
| D-06 one credential arm | VERIFIED | `kind: "credential"`, `basicAuthorization`, 401 + `WWW-Authenticate` otherwise |
| D-07 Outline over 500/502/503 | VERIFIED | add Outline; update Outline adds 404 |
| D-08 drop on first request | VERIFIED | `req.socket.destroy()`, log `dropped`, `network unreachable` (IN-03 notes it drops every request, harmless) |
| D-09 credential Given writes files directly | VERIFIED | `git-host.steps.ts` writes `.gitconfig` (`helper = store`) and `.git-credentials` mode 0600, no git process, `wx` flag, reads back |
| D-10 Pi `GIT_CONFIG_GLOBAL` at sandbox HOME, NOSYSTEM, no inherited `GIT_*`; `Before()` empties HOME | VERIFIED | `pi-process.ts` + `_rpc.ts` as above |
| D-11 unit test + by-hand control | VERIFIED | 17 unit cases pass; control reproduced by the verifier including positive control; recorded in 09-04-SUMMARY lines 156-169; nothing committed |
| D-12 CGI/fixture git on own scratch HOME | VERIFIED | `gitHome = <root>/home`, `GIT_CONFIG_GLOBAL=/dev/null`, distinct from the sandbox HOME |
| D-13 failing `@url` rows triaged | VERIFIED | 09-03-SUMMARY triage; product fixes carry RED evidence, unit tests, CHANGELOG |
| D-14 exclusion kept until last plan | VERIFIED | `git log -- cucumber.json`: `63d05924` is the plan 09-08 commit |
| D-15 SC6 plant, RED json, restore | VERIFIED | see SC6 |
| D-16 missing `#ref` add is typed `source missing` | VERIFIED | `42fdef4a` (`isRemoteNotFound` in `classifyGitSourceAccessFailure` only), scenario `...at a ref the repository lacks fails as source missing`, `09-06-RED.json` (internal-error payload on old code, `RED_EVIDENCE_OK`), unit cases in `tests/shared/git-failure-classifiers.test.ts` and `tests/orchestrators/marketplace/add.test.ts`, CHANGELOG bullet, catalog trigger text |
| D-17 info url row at a ref the repo has | VERIFIED | `info.feature` line 39 types `...tools.git#main`, expects `source ref` `main` (github row also `acme/tools#main` after review fix `37da6163`) |
| D-18 unreadable-skill Outline local only | VERIFIED | `Autoupdate continues in installed order after a plugin fails` has the untagged `source kind` x `scope` rows only; no `@url`/`@github` block |
| D-19 failed git add child row id is the bare source | VERIFIED | `marketplaceSubject: true` set only at `add.ts:783`; `notification-json.ts:430`; `09-05-RED.json` shows `<url>@<url>` id on old code with `RED_EVIDENCE_OK`; `tools@tools` rows unchanged (all existing scenarios pass); CHANGELOG bullet, `docs/json-output.md` row, BACKLOG `ROWID-01`, WINDOWS 98 waived |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `features/lib/https-git-host/server.ts` | HTTPS CGI stand-in, request log, arms, reset | VERIFIED | 450 lines, substantive, wired via `support/pi-process.ts` (`HttpsGitHost.start`) and `PublicationSites.gitHost` |
| `features/lib/https-git-host/cgi.ts` | CGI env, spawn, parser | VERIFIED | `CONTENT_LENGTH` from buffered body, `GIT_PROTOCOL` only when header present, parser splits at first blank line, unit-tested |
| `features/lib/hermetic-git.ts` | hermetic env + `runGit` | VERIFIED | used by `cgi.ts` and `git-marketplace.ts` |
| `features/lib/git-marketplace.ts`, `published-marketplace.ts` | url arms for every operation | VERIFIED | only `github` arms still throw `noStandIn` (Phase 10) |
| `features/step_definitions/marketplace/git-host.steps.ts` | arm, credential, log steps | VERIFIED | all steps used (feature gate exits 0) |
| `features/support/https-git-host.ts` | request window hook | VERIFIED | wired as a `BeforeStep` hook |
| `tests/e2e/_rpc.ts` | typed extra git env | VERIFIED | no `process.env` spread |
| `tests/architecture/hermetic-git-environment.test.ts`, `https-git-host-cgi.test.ts` | unit half of D-11 | VERIFIED | 17 pass |
| `cucumber.json` | exclusion `not @github` | VERIFIED | |
| `09-05-RED.json`, `09-06-RED.json`, `09-08-RED.json` | RED evidence | VERIFIED | all contain `RED_EVIDENCE_OK`; 09-08 reproduced |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `BeforeAll` | `HttpsGitHost.start` -> `PiProcess.start` | host first, Pi receives `NODE_EXTRA_CA_CERTS` | WIRED |
| `Before()` | `gitHost.reset()` + snapshot assert | after Pi replacement, before sandbox empty | WIRED |
| `BeforeStep` (Action) | `gitHost.mark()` -> `requestsOfLastCommand()` | log steps | WIRED |
| `published-marketplace.ts` url arms | `git-marketplace.ts` publish/push -> bare repo under host root | `publicationSites.gitHost` | WIRED |
| `add.ts` failed git row | `marketplaceSubject` -> `notification-json.ts` id | bare id | WIRED |
| `classifyGitSourceAccessFailure` | `marketplace add` only | `isRemoteNotFound` | WIRED |

### Data-Flow Trace (Level 4)

Request log and arm state are real: every logged status comes from the CGI response or an arm, and the scenarios assert them against the actual Pi-to-host traffic. The 373-scenario run is the end-to-end flow; no static or hardcoded stand-ins found. Status: FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole default profile | `npx cucumber-js` | 373 scenarios (373 passed), seed 17387 | PASS |
| Url rows alone | `npx cucumber-js --tags @url` | 39 (39 passed) | PASS |
| Unit half of D-11 / CGI | `node --test tests/architecture/hermetic-git-environment.test.ts tests/architecture/https-git-host-cgi.test.ts` | 17 pass, 0 fail | PASS |
| Static gate | `npm run check:static` (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features) | exit 0 | PASS |
| SC6 red | recorded diff applied, six `@url` rows | 3 failed / 3 passed at the fields assertion; restored clean | PASS |
| D-11 control | planted `GIT_CONFIG_SYSTEM` helper | ignored with NOSYSTEM; runs without it | PASS |

Not re-run by the verifier: `test:integration` and `test:coverage:direct:all` (orchestrator reports `npm run check` exit 0 on HEAD; the pieces this phase touches were run above).

### Probe Execution

SKIPPED: the phase declares no probe scripts.

### Requirements Coverage

Every requirement ID declared in the plans' frontmatter, cross-referenced against REQUIREMENTS.md (all 14 phase IDs are claimed; none orphaned):

| Requirement | Source Plan(s) | Status | Evidence |
| ----------- | -------------- | ------ | -------- |
| HOST-01 | 09-01, 09-02, 09-03, 09-08 | SATISFIED | stand-in serves bare repos; clone and fetch both proven by 39 `@url` rows |
| HOST-02 | 09-01, 09-02, 09-08 | SATISFIED | lifetime, reset, empty assertion, rule amendment |
| HOST-03 | 09-04 | SATISFIED | 404/500/502/503 status, drop, credential arms |
| HOST-04 | 09-01, 09-07 | SATISFIED | exact log table and `receives no request` |
| DRV-03 | 09-01, 09-02, 09-04 | SATISFIED | hermetic env, unit test, control |
| ADD-08 | 09-07 | SATISFIED (see advisory) | 4 forms run now; 4 GitHub forms in `@github` block per roadmap SC4 |
| ADD-09 | 09-04 | SATISFIED | 404 scenario |
| ADD-10 | 09-04, 09-05 | SATISFIED | drop and 5xx scenarios, bare id fix |
| ADD-12 | 09-07, 09-08 | SATISFIED | re-add Outline (`@url` runs; `@github` for Phase 10) |
| RM-09 | 09-07, 09-08 | SATISFIED | remove no-request Outline |
| LS-05 | 09-07, 09-08 | SATISFIED | list no-request Outline |
| INFO-07 | 09-07, 09-08 | SATISFIED | info no-request Outline |
| UPD-11 | 09-06 | SATISFIED | update Outline + bare-update drop |
| SRC-01 | 09-03 | SATISFIED | verbatim URL scenario |

ADD-11 (url half implemented here per SC2; REQUIREMENTS keeps it Pending for Phase 10) and UPD-12/SRC-02/SRC-03 are outside this phase's ID list and correctly remain unchecked.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX` in the files this phase touched. No stubs: the only remaining `noStandIn` throws are the `github` arms, owned by Phase 10. `09-REVIEW.md`: 0 critical, 3 warnings fixed (`37da6163`, `962f57b1`, `5acaac75`), 11 info findings open and non-blocking (IN-01..IN-11, recorded in `09-REVIEW-DISPOSITION.md`). Notable infos: IN-05 (two refused-form rows give a weak no-request proof), IN-06 (arm path matching uses the raw request path; no current scenario affected), IN-10 (no test drives the host's new 500 path). `09-SECURITY.md`: `threats_open: 0`.

### Human Verification Required

None. The only unproven item is CI-runner portability (advisory above), which the PR's `behavioral tests` job resolves automatically and is not a phase truth.

### Deviations judged

- SC6 plant: the roadmap licenses the local edit "if they no longer load". The `f78907bf` files now load but crash in the Given install (internal error, never reaching an assertion). That is the same non-behavioral situation, the SUMMARY records it, and the local edit is behaviorally equivalent (project record copied from the user record). Accepted.
- Manual-only evidence (D-11 control, SC6 red): both were independently reproduced by the verifier, so the recorded evidence is sufficient.

### Gaps Summary

No gaps. The stand-in exists, is wired into the worker lifecycle, and is exercised end to end; the url-only behaviors have scenarios that fail for the right reasons (RED evidence for the three test-first fixes, reproduced for SC6); `@url` is out of the exclusion and all 39 url rows pass within a 373-scenario default run; the 14 requirement IDs are accounted for.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_
