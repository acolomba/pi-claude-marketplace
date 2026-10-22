---
phase: 10-github-source-kind-and-suite-close
verified: 2026-10-21T18:10:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/10-github-source-kind-and-suite-close/10-01-PLAN.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-01-SUMMARY.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-02-PLAN.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-02-SUMMARY.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-03-PLAN.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-03-SUMMARY.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-04-PLAN.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-04-SUMMARY.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-05-PLAN.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-05-SUMMARY.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-06-PLAN.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-06-SUMMARY.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-07-PLAN.md"
  - ".planning/phases/10-github-source-kind-and-suite-close/10-07-SUMMARY.md"
  - "cucumber.json"
  - "extensions/pi-claude-marketplace/domain/source.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts"
  - "features/lib/https-git-host/cgi.ts"
  - "features/lib/https-git-host/server.ts"
  - "features/lib/published-marketplace.ts"
  - "features/marketplace/git-source.feature"
  - "features/marketplace/github-source.feature"
  - "features/marketplace/remove.feature"
  - "features/plugin/cross-scope-install.feature"
  - "features/support/pi-process.ts"
covered_digest: "v3:sha256:18e7d93bd913179e289bd9daf0f5776e4adae479e8889d90b4fe055ba050f7c3"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 10: GitHub Source Kind and Suite Close Verification Report

**Phase Goal:** GitHub sources run end to end against the stand-in through the override, 401 is covered with and without a stored credential on url and gh sources, and the suite closes with no tag excluded and a clean review.
**Verified:** 2026-10-21
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | With the override pointed at the stand-in and `@github` out of the exclusion, every GitHub row runs and passes; `list`, `info`, and `claude-plugins.json` show github.com terms | VERIFIED | `cucumber.json` has no `tags` key (read it). `features/support/pi-process.ts:90` sets `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` to `https://${gitHost.address}`; `tests/e2e/_rpc.ts:197` threads it. Re-ran `npm run test:cucumber`: `433 scenarios (433 passed)`, `4050 steps`. Re-ran `--tags @github`: `48 scenarios (48 passed)`. `@github` rows exist in add, update (15), git-source (8), info, list/remove/autoupdate, unsupported-source, remove, cross-scope-install. The `list` and `info` `@github` rows compare owner `acme`, repo `tools`, empty url; declarations read `acme/tools`. The `noStandIn` throws are gone from `features/lib/published-marketplace.ts` (no match; github arms at lines 121, 154, 197, 278, 340). |
| 2 | `GitHub.com`, `www.github.com`, `.git`, trailing slash resolve to one source; `owner/repo@ref` and `#ref` clone that ref | VERIFIED | `github-source.feature` SRC-02 Outline: five spellings, each asserts the same `/acme/tools.git` GET and POST at 200 and `info` identity github/acme/tools. SRC-03 Outline: `@stable`, `#stable`, and `https://github.com/acme/tools#stable` assert `source ref stable` and `description Stable tools` (the `stable` branch differs from `main`), so a clone of `main` fails. Production: `domain/source.ts` splits `owner/repo#ref` (D-MF-07, recorded in `.planning/PROJECT.md:1315`); unit rows in `tests/domain/source.test.ts` cover `#stable`, `#`, `#x@y`. `10-03-RED.json` shows the `#stable` row failing before the fix (`RED_EVIDENCE_OK`). |
| 3 | `add` on a 401 repository fails as `authentication required` without a credential and succeeds with a sandbox credential; `update` of a url or github marketplace now answering 401 fails as `authentication required` with the `git credential approve` cause for that host | VERIFIED | `git-source.feature` holds the url scenario and a three-row `@github` Outline for add-without-credential (cause chain `The operation was canceled., fetched …`, log `401`); an Outline for add-with-credential (`@url` row and `@github` rows; log 401, 200, POST 200); an update-401 Outline (`@url` and two `@github` rows) whose cause chain includes the `no credential was obtained for {git host}; store one with: printf … \| git credential approve` line, with `fetched …` last for github; plus a rejected-stored-credential Outline. All run and pass in the 433/433 run. `10-04-RED.json` shows the github update rows failing before the P-2 fix (`RED_EVIDENCE_OK`). Production change is in `orchestrators/marketplace/update.ts` and `shared.ts`; unit cases in `tests/orchestrators/marketplace/{update,shared}.test.ts`. |
| 4 | Suite closes clean: dry-run usage report has no unused/undefined/ambiguous step; whole suite passes on Node 24 and 26; CI timing recorded; hostile-config control run by hand changes no result; skill review finds no BLOCKER | VERIFIED | Source-walk item dropped by D-07 (not counted). `npx cucumber-js --dry-run --format usage` exited 0 and `npm run check:features` passed. I re-ran the whole suite on the final tree on Node 26 (`433 passed`) and on Node 24.21.0 via `npx -p node@24.21.0` (`433 passed`); the SUMMARY's earlier Node 24/26 runs were at a 429-scenario tree, so this is fresh evidence. Local timing and the by-hand hostile control (positive control bit on four settings; 429/429 under the hostile config, marker absent) are recorded in `10-07-SUMMARY.md`; CI duration deferred to PR time by D-08. `10-06-SUMMARY.md` records the review: no open BLOCKER, 15 BLOCKER scenarios fixed, 8 WARNINGs as WINDOWS 102-109. `10-REVIEW-DISPOSITION.md` is at `open: 0` (IN-04 deferred, a user decision). Phase 9 ledger `09-REVIEW-DISPOSITION.md` is at `open: 0`; the five fixing SHAs resolve to commits. |
| 5 | The `@github` rows of the LAYER-07 cross-scope install Outline and the three user-scope remove Outlines run through the override and pass; each remove row was shown failing on a behavioral assertion on the old behavior | VERIFIED | `@github` blocks present at `cross-scope-install.feature:68` and `remove.feature:697, 737, 769` (and :37 for the empty-remove Outline). They pass in the default and `@github` runs. `10-05-RED.json` records 6 scenarios, 3 failures, all at `Then the result has these fields:` on the three remove rows (`RED_EVIDENCE_OK` each), with the uncommitted local edit to `resolveTargetScopeMarketplace` diffed in the record; the install row and empty-remove rows pass on both. |

**Score:** 5/5 truths verified (0 behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `cucumber.json` | no tag exclusion | VERIFIED | profile has no `tags` key |
| `features/marketplace/github-source.feature` | tracer, SRC-02, SRC-03 | VERIFIED | 3 scenarios, 9 example rows, substantive compared values |
| `features/marketplace/git-source.feature` | 401 add/update, url and github | VERIFIED | Outlines with `@url`/`@github` blocks |
| `features/lib/published-marketplace.ts` | github arms | VERIFIED | arms present, no stand-in throw |
| `features/support/pi-process.ts` | override env into Pi | VERIFIED | line 90 |
| `features/lib/https-git-host/cgi.ts` | EPIPE fix (D-14) | VERIFIED | live-host architecture cases in `tests/architecture/https-git-host-server.test.ts`; passed in `npm run check` |
| `extensions/.../domain/source.ts` | `#ref` shorthand (D-12) | VERIFIED | split at line 437, comment cites D-MF-07 |
| `extensions/.../orchestrators/marketplace/update.ts` | remedy line before fetched URL (D-13) | VERIFIED | red/green recorded; unit cases |
| `10-03/04/05-RED.json` | red evidence | VERIFIED | exit code 1, classifier verdicts `RED_EVIDENCE_OK` |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `pi-process.ts` | Pi child env | `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (also `tests/e2e/_rpc.ts`) | WIRED |
| github arms in `published-marketplace.ts` | git host repository | shorthand `owner/repo` through override | WIRED (request logs assert `/acme/tools.git`) |
| git-source 401 Outlines | `update.ts` remedy | cause chain cell | WIRED (RED then GREEN) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| whole cucumber suite, Node 26 | `npm run test:cucumber` | 433/433 | PASS |
| `@github` rows alone | `npm run test:cucumber -- --tags @github` | 48/48 | PASS |
| whole suite, Node 24.21.0 | `npx -p node@24.21.0 -- node node_modules/@cucumber/cucumber/bin/cucumber.js` | 433/433 | PASS |
| usage report | `npx cucumber-js --dry-run --format usage` | exit 0, no UNUSED | PASS |
| feature gate | `npm run check:features` | exit 0 | PASS |
| full gate at HEAD | `npm run check` (orchestrator log) | all stages passed, 433/433 | PASS (log read, not re-run) |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| ADD-11 | 10-02, 10-04, 10-05, 10-06, 10-07 | 401 add fails as `authentication required`; with a stored credential it succeeds (url, gh) | SATISFIED | git-source.feature add Outlines |
| UPD-12 | 10-02, 10-04, 10-05, 10-06, 10-07 | update of a 401 host fails with `git credential approve` cause (url, gh) | SATISFIED | git-source.feature update Outline |
| SRC-02 | 10-01, 10-05, 10-06, 10-07 | GitHub spellings resolve to one source | SATISFIED | github-source.feature spelling Outline |
| SRC-03 | 10-03, 10-05, 10-06, 10-07 | `@ref` and `#ref` clone that ref | SATISFIED | github-source.feature ref Outline, unit rows |

All four IDs in the phase's plans appear in REQUIREMENTS.md (checked, traceability rows "Complete"). REQUIREMENTS.md maps no other ID to Phase 10: none orphaned.

### Anti-Patterns Found

None blocking. No TBD/FIXME/XXX markers introduced in the covered files (check passes lint and fallow). No stubs: the former `noStandIn` github arms are real.

### Open Items (not gaps)

- IN-04 of 10-REVIEW (the `@` arm repo half can still contain `#`) is deferred by user decision as a parser tightening away from upstream; recorded in `10-REVIEW-DISPOSITION.md`.
- Carry-overs per D-05: BACKLOG ROWID-01, WINDOWS #100, #101 (plugin update remedy gap), #102-#109 (review WARNINGs in files outside this phase). Each has a carrier.
- CI duration is read at PR time (D-08); macOS credential isolation is unverified (A2, Linux-only CI).
- The Node 24/26 and hostile-config runs in `10-07-SUMMARY.md` were on an earlier 429-scenario tree; the final tree added review fixes (including the `51a1937a` auth change). I re-ran both Node versions on the final tree; the hostile control was not repeated, and the hermetic-env code it exercises (`features/support/pi-process.ts`) changed only in env threading and cleanup.

### Human Verification Required

None.

### Gaps Summary

No gaps. The phase goal is achieved: github sources run through the override against the loopback git host, 401 is covered for add and update on url and github, SRC-02 and SRC-03 are proven by request paths and cloned content, no tag is excluded, and the suite passes on both Node versions with a clean review.

---

_Verified: 2026-10-21_
_Verifier: Claude (gsd-verifier)_
