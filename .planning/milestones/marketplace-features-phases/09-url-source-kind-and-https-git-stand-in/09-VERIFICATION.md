---
phase: 09-url-source-kind-and-https-git-stand-in
verified: 2026-10-21T17:00:00Z
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
  - "tests/architecture/https-git-host-server.test.ts"
  - "tests/e2e/_rpc.ts"
covered_digest: "v3:sha256:6d95fdafdc3971a4fa4acd50cb21429fd367974b4f9b94e4b409a69fda79adcd"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "The url rows are proven on this machine only (OpenSSL 4.0.3, Node 26, git 2.55); the CI runner (OpenSSL 3.0.13, Node 24) is exercised only when the PR's behavioral tests job runs (RESEARCH assumptions A1, A2, A4)"
    category: other
    reason: "Environment portability of the run-time certificate command, the `socket hang up` and status-phrase strings, and `git http-backend` on ubuntu-latest. Not a phase truth; the PR job resolves it."
    evidence_status: "none provided until CI runs"
---

# Phase 9: URL Source Kind and HTTPS Git Stand-In Verification Report

**Phase Goal:** A loopback HTTPS git stand-in serves bare marketplace repositories to Pi for the worker's run, url-only failure and no-request behaviors have scenarios, and removing `@url` from the exclusion turns on every url row the verb phases wrote.
**Verified:** 2026-10-21
**Status:** passed
**Re-verification:** Yes. The prior report (HEAD `c43fa8ca`, 373 scenarios) went stale because phase 10 changed covered files. Every truth was re-judged against HEAD `ab287305`.

## What changed since the prior report

Phase 10 touched 35 files in the covered surface (`git diff c43fa8ca..HEAD`). None of it breaks a phase 9 truth:

- `cucumber.json` lost its `tags` line altogether (was `not @github`), so `@url` and `@github` rows both run. SC5 asked only that `@url` leave the exclusion, which still holds.
- The 401 scenarios moved from `url-source.feature` into `git-source.feature` as `@url` and `@github` Examples blocks and a plain url scenario; the url half of ADD-11 is still proven there.
- The url missing-ref row now uses `#missing` (the repository carries `main` and a `stable` branch on every publication); the info row uses `#stable`, so it proves the ref and not the default branch (IN-11).
- The stand-in gained EPIPE tolerance, decoded-path arm matching, a 500 path with a `dropped` status, and `--atomic` pushes (new unit file `tests/architecture/https-git-host-server.test.ts`).
- `pi-process.ts` gained start-up and teardown cleanup (`settleInOrder`) and the GitHub base override (`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`). The hermetic variables, the CA file, the start order and the per-scenario reset assertion are unchanged.
- `git-failure-classifiers.ts` gained the `StoredCredentialRejectedError` arm (phase 10). `isRemoteNotFound` and the D-16 `source missing` path are untouched.
- `09-REVIEW-DISPOSITION.md` is closed: `open: 0`, 14 of 14 findings `fixed`. This closes the two advisory items of the prior report (IN-05, the weak no-request proof for two refused-form rows; and IN-06, raw-path arm matching).

## Goal Achievement

### Behavioral evidence

- Full gate at `0110a355` (log `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-cucumber-behavioral-tests/e37b84b9-da30-433b-a2eb-65b65d26c976/scratchpad/regression-gate.log`): `npm run check` green end to end, `433 scenarios (433 passed)`, `4050 steps (4050 passed)`, `16 hooks (16 passed)`, `Merged LCOV: coverage/direct.lcov (280 records)`. Only planning Markdown changed since.
- Verifier runs at HEAD: `npx cucumber-js --dry-run` gives 433 scenarios, 4050 steps, all resolved (no undefined or ambiguous step). `npx cucumber-js --parallel 1` over the four url-owned features (`url-source`, `url-source-update`, `unsupported-source`, `git-source`): **51 scenarios (51 passed), 444 steps (444 passed)**. `node --test` over the three stand-in unit files: **21 tests, 21 pass**. The worktree stayed clean.

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| SC1 | Url add cloned over HTTPS from the stand-in on `127.0.0.1` with a run-time certificate trusted through `NODE_EXTRA_CA_CERTS`, TLS verification never off; log shows the clone; stand-in starts before Pi, lives for the worker's run, is reset before every scenario and asserted empty; exact `{git host}` token | VERIFIED | `features/lib/https-git-host/server.ts`: `node:https` `createServer`, `listen(0, "127.0.0.1")`, `openssl` certificate made in `start()` with a minimal `{ PATH }` env. `features/support/pi-process.ts`: `BeforeAll` calls `HttpsGitHost.start` before `PiProcess.start` and passes `NODE_EXTRA_CA_CERTS: gitHost.certificatePath`; `Before()` calls `gitHost.reset()` then `assert.deepStrictEqual` against `{ repositories: [], arms: [], requests: [], connections: 0, children: 0 }`; `AfterAll` stops Pi, closes the host and removes the root. `grep NODE_TLS_REJECT features tests/e2e extensions scripts` finds nothing. The first `url-source.feature` scenario asserts `GET ...info/refs?service=git-upload-pack 200` then `POST .../git-upload-pack 200` and passes. |
| SC2 | Pi, the stand-in and every fixture `git` hermetic (`GIT_CONFIG_NOSYSTEM=1`, sandbox global config, no inherited `GIT_*`); 401 fails `add` as `authentication required` with no stored credential, without reaching an outside helper, and succeeds with a credential stored in the sandbox | VERIFIED | `hermetic-git.ts` sets `GIT_CONFIG_NOSYSTEM: "1"`, `GIT_CONFIG_GLOBAL: "/dev/null"` and builds the environment from scratch (`PATH` only from `process.env`); the stand-in's CGI and every fixture `runGit` use it. Pi gets `GIT_CONFIG_NOSYSTEM=1` and `GIT_CONFIG_GLOBAL=<sandbox HOME>/.gitconfig` (`pi-process.ts`), and `rpcChildEnvironment` in `tests/e2e/_rpc.ts` copies only the typed keys onto an allowlist (no `process.env` spread). Unit half (D-11): `hermetic-git-environment.test.ts` and `https-git-host-cgi.test.ts` pass. The 401 scenarios now live in `git-source.feature` and pass: no credential gives `authentication required` with one `401` in the log; a credential written to the sandbox gives `401, 200, POST 200`. The by-hand isolation control (hostile `GIT_CONFIG_SYSTEM` helper ignored with `NOSYSTEM`, runs without it) was reproduced by the prior verifier on `_rpc.ts`; phase 10 changed that file by one added key and the `NOSYSTEM` assignment is intact. |
| SC3 | 404 add is `source missing`; 5xx add is `network error` with a cause line naming status and URL; a drop is `network unreachable`; `update` against 5xx or 404 is `network error` with the status/URL cause line; a drop on update is `network unreachable` | VERIFIED | `url-source.feature`: 404 scenario (`source missing`, log `404`), drop scenario (`network unreachable`, log `dropped`), 500/502/503 Outline (`network error`, cause chain `<status> on https://{git host}/acme/tools.git, HTTP Error: <status> <phrase>`). `url-source-update.feature`: 500/502/503/404 Outline (`network error`, same cause frame, log shows the status) and the bare-update drop scenario (`network unreachable`, `socket hang up`, second marketplace `up-to-date`). All pass in the verifier's run. |
| SC4 | Url cloned at exactly the URL typed (no `.git` appended); removed git marketplace re-addable; `list`, `info` and `remove` leave the log empty; every refused form fails as `unsupported source` with no request; re-add, empty-log and refused GitHub-form scenarios carry `@github` blocks | VERIFIED | `A url source is cloned at exactly the url typed` types `https://{git host}/acme/tools` and the log shows `GET /acme/tools/info/refs...` and `POST /acme/tools/git-upload-pack`. `git-source.feature` holds four Outlines (re-add, list, info, remove), each with `@url` and `@github` Examples blocks; list, info and remove assert `the git host receives no request`. `unsupported-source.feature`: `http://`, `ssh://`, `git@127.0.0.1:...`, `~other/...` run in the plain block with `the git host receives no request`; the four GitHub forms sit in an `@github` block. All pass. |
| SC5 | The last plan removes `@url` from the `cucumber.json` exclusion and every `@url` row passes | VERIFIED | Plan 09-08 commit `63d05924` removed `@url`; phase 10 later removed the whole `tags` line, so `cucumber.json` now has no exclusion. 35 `@url` tag lines remain in `features/` and all run: 433 of 433 scenarios passed in the gate log. |
| SC6 | The `@url` rows Phase 3.2 wrote for LAYER-07 run and pass (the cross-scope install row and the three user-scope remove Outline rows), each remove row first shown failing on a behavioral assertion on the reuse-the-record code | VERIFIED | The rows exist and are untagged-for-exclusion: `cross-scope-install.feature` has an `@url` Examples block (`url | https://{git host}/acme/tools.git`); `remove.feature` has `@url` blocks at lines 31, 692, 732, 764. They pass at HEAD (433 of 433). The red proof is historical evidence: `09-08-RED.json` (commit `a1dcfbfe`) records exit 1, 3 of 6 failed, each failure at the `Then the result has these fields:` assertion after every Given and When step passed, with `RED_EVIDENCE_OK`. The prior verifier re-applied the planted diff and reproduced the 3 failed and 3 passed outcome, then restored the file. Phase 10 changed no plugin install ledger file (`git log c43fa8ca..HEAD` over `install-outcome.ts` is empty), so the plant would behave the same. The plant was never committed. |

**Score:** 6/6 truths verified (0 behavior-unverified).

### CONTEXT.md Decisions D-01..D-19 (current status)

| Decision | Status | Evidence at HEAD |
| -------- | ------ | ---------------- |
| D-01 log row = method, path+query, status | VERIFIED | `the git host receives these requests:` tables in all four url-owned features |
| D-02 window = last command | VERIFIED | `features/support/https-git-host.ts` `BeforeStep` hook |
| D-03 log steps only in git-host-owned files | VERIFIED | `git host receives` appears in `url-source`, `url-source-update`, `unsupported-source`, `git-source` and now `github-source.feature` (phase 10 owns the github-kind rows; same stand-in, same steps). No verb-phase feature uses it. |
| D-04 no uncompared-log enforcement | VERIFIED | no log-compared marker exists; the feature gate (`check:features`) is green in the gate log |
| D-05 per-repository arms | VERIFIED | the update drop scenario arms only `tools`; `extras` is served and reports `up-to-date` |
| D-06 one credential arm | VERIFIED | `Given the git host requires the user "alice" ...` used by the 401 scenarios |
| D-07 Outline over 500/502/503 | VERIFIED | add Outline; update Outline adds 404 |
| D-08 drop on first request | VERIFIED | `dropped` log status; `network unreachable`. Phase 10 routes server-error cut-offs through the same `dropped` status (IN-09 fixed) |
| D-09 credential Given writes files directly | VERIFIED | `git-host.steps.ts` writes `.gitconfig` and `.git-credentials`; no git process |
| D-10 hermetic Pi git env; `Before()` empties HOME | VERIFIED | `pi-process.ts` lines 85-90, 128-135 |
| D-11 unit test plus by-hand control | VERIFIED | 21 unit cases pass; control recorded in 09-04-SUMMARY and reproduced by the prior verifier |
| D-12 CGI/fixture git on its own scratch HOME | VERIFIED | `hermetic-git.ts` scratch-HOME environment |
| D-13 failing `@url` rows triaged | VERIFIED | 09-03-SUMMARY; every product fix has RED evidence and unit tests |
| D-14 exclusion kept until last plan | VERIFIED | `63d05924` is the plan 09-08 commit |
| D-15 SC6 plant, RED json, restore | VERIFIED | see SC6 |
| D-16 missing `#ref` add is typed `source missing` | VERIFIED | `isRemoteNotFound` in `git-failure-classifiers.ts` (line 118, used at 145); scenario `...at a ref the repository lacks fails as source missing` with `#missing` passes; `09-06-RED.json` |
| D-17 info url row at a ref the repo has | VERIFIED | `info.feature` types `.../acme/tools.git#stable`; the repository carries a `stable` branch with the same files (changed from `#main` by phase 10 so the row proves the ref) |
| D-18 unreadable-skill Outline local only | VERIFIED | unchanged; passes |
| D-19 failed git add child row id is the bare source | VERIFIED | `marketplaceSubject: true` at `add.ts:783`, consumed at `notification-json.ts:430`; the 5xx Outline asserts `id` = the url; `09-05-RED.json` has `RED_EVIDENCE_OK` |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `features/lib/https-git-host/server.ts` | HTTPS CGI stand-in, request log, arms, reset | VERIFIED | `node:https`, loopback bind, run-time certificate; wired from `support/pi-process.ts` and `published-marketplace.ts`; now unit-tested (`https-git-host-server.test.ts`, passes) |
| `features/lib/https-git-host/cgi.ts` | CGI env, spawn, parser | VERIFIED | unit-tested |
| `features/lib/hermetic-git.ts` | hermetic env and `runGit` | VERIFIED | used by `cgi.ts` and `git-marketplace.ts` |
| `features/lib/git-marketplace.ts`, `published-marketplace.ts` | url arms for every operation | VERIFIED | github arms now also publish to the stand-in (phase 10) |
| `features/step_definitions/marketplace/git-host.steps.ts` | arm, credential, log steps | VERIFIED | dry-run resolves every step |
| `features/support/https-git-host.ts` | request window hook | VERIFIED | `BeforeStep` hook |
| `tests/e2e/_rpc.ts` | typed extra git env | VERIFIED | no `process.env` spread |
| `tests/architecture/hermetic-git-environment.test.ts`, `https-git-host-cgi.test.ts`, `https-git-host-server.test.ts` | unit half of D-11 and the stand-in | VERIFIED | 21 pass |
| `cucumber.json` | no `@url` exclusion | VERIFIED | no `tags` key |
| `09-05-RED.json`, `09-06-RED.json`, `09-08-RED.json` | RED evidence | VERIFIED | each contains `RED_EVIDENCE_OK` |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `BeforeAll` | `HttpsGitHost.start` then `PiProcess.start` | host first, Pi gets `NODE_EXTRA_CA_CERTS` | WIRED |
| `Before()` | `gitHost.reset()` and snapshot assert | after Pi replacement, before the sandbox is emptied | WIRED |
| `BeforeStep` (Action) | `gitHost.mark()` and the request window | log steps | WIRED |
| `published-marketplace.ts` url arms | `git-marketplace.ts` publish and push into the bare repo under the host root | `publicationSites.gitHost` | WIRED |
| `add.ts` failed git row | `marketplaceSubject` then `notification-json.ts` id | bare id | WIRED |
| `classifyGitSourceAccessFailure` | `marketplace add` only | `isRemoteNotFound` | WIRED |

### Data-Flow Trace (Level 4)

Every logged status comes from the CGI response or an arm, and the scenarios assert it against the real Pi-to-host traffic. The 433-scenario run is the end-to-end flow. No static or hardcoded stand-in found. FLOWING.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole default profile | gate log, `npm run check` at `0110a355` | 433 of 433 scenarios, 4050 of 4050 steps | PASS |
| Step resolution | `npx cucumber-js --dry-run` | 433 scenarios, 4050 steps, no undefined step | PASS |
| Url-owned features | `npx cucumber-js --parallel 1 features/marketplace/{url-source,url-source-update,unsupported-source,git-source}.feature` | 51 of 51 scenarios, 444 of 444 steps | PASS |
| Stand-in and hermetic-env units | `node --test tests/architecture/{hermetic-git-environment,https-git-host-cgi,https-git-host-server}.test.ts` | 21 pass, 0 fail | PASS |

### Probe Execution

SKIPPED: the phase declares no probe scripts.

### Requirements Coverage

All 14 IDs in the ROADMAP `**Requirements:**` line are claimed by the plans' frontmatter and are marked `[x]` and `Complete` in REQUIREMENTS.md. None is orphaned.

| Requirement | Source Plan(s) | Status | Evidence |
| ----------- | -------------- | ------ | -------- |
| HOST-01 | 09-01, 09-02, 09-03, 09-08 | SATISFIED | stand-in serves bare repos; clone and fetch proven by the url rows |
| HOST-02 | 09-01, 09-02, 09-08 | SATISFIED | lifetime, reset, empty assertion in `pi-process.ts` |
| HOST-03 | 09-04 | SATISFIED | 404, 500, 502, 503, drop and credential arms |
| HOST-04 | 09-01, 09-07 | SATISFIED | exact log table and `receives no request` |
| DRV-03 | 09-01, 09-02, 09-04 | SATISFIED | hermetic env, 21 unit cases, control |
| ADD-08 | 09-07 | SATISFIED | four host-reachable and local forms run; GitHub forms in `@github` block, which phase 10 now also runs |
| ADD-09 | 09-04 | SATISFIED | 404 scenario |
| ADD-10 | 09-04, 09-05 | SATISFIED | drop and 5xx scenarios, bare id fix |
| ADD-12 | 09-07, 09-08 | SATISFIED | re-add Outline |
| RM-09 | 09-07, 09-08 | SATISFIED | remove no-request Outline |
| LS-05 | 09-07, 09-08 | SATISFIED | list no-request Outline |
| INFO-07 | 09-07, 09-08 | SATISFIED | info no-request Outline |
| UPD-11 | 09-06 | SATISFIED | update Outline and bare-update drop scenario |
| SRC-01 | 09-03 | SATISFIED | verbatim-url scenario; CHANGELOG #221 |

### Anti-Patterns Found

None blocking. No `TBD`, `FIXME` or `XXX` markers were added to the covered files in the phase 10 diff. The only remaining `noStandIn`-style throws from phase 9 (the `github` arms) were replaced by phase 10. `09-REVIEW-DISPOSITION.md`: `open: 0`, 14 of 14 fixed. `09-SECURITY.md`: `threats_open: 0`.

### Human Verification Required

None. CI-runner portability (advisory above) is resolved by the PR's behavioral tests job and is not a phase truth.

### Gaps Summary

No gaps. Phase 10's changes to the stand-in, the run lifecycle, the feature files and `cucumber.json` strengthen or widen what phase 9 delivered and break none of its six success criteria or its 14 requirements.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_
