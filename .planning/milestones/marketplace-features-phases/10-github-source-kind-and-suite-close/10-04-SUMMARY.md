---
phase: 10-github-source-kind-and-suite-close
plan: "04"
subsystem: testing
tags: [cucumber, github-source, url-source, auth, ADD-11, UPD-12, GAUTH-04, GHB-01, GHB-04]
status: complete

requires:
  - phase: 10-github-source-kind-and-suite-close
    provides: "10-01: the github kind through the base override; 10-02: the git host EPIPE fix; 10-03: refs and the owner/repo#ref shorthand"
provides:
  - "The 401 add family in git-source.feature: the url no-credential scenario (moved), the github no-credential Outline (three spellings), and the stored-credential Outline over url and github"
  - "The UPD-12 Outline: a 401 on marketplace update for url and github, with the whole cause chain"
  - "refreshGitHubSource in update.ts: under the override, a github update 401 names git credential approve for the override's host before the fetched-URL link"
  - "Five unit cases in update.test.ts (remedy, 500, cross-origin challenge, non-Error rejection, GHB-04 Device Flow)"
  - "10-04-RED.json with RED_EVIDENCE_OK for both github rows; the CHANGELOG sub-bullet; WINDOWS entry 101 for the same gap in plugin update"
affects: [10-05, 10-07]

actuals:
  tokens: 6600
  tasks: 2
  commits: 4
plan_head_before: 8fd74e9e87d9e1bfdfb33fd51e5d115e01bcdcad
plan_head_after: 16c4d977aedbda0631ea48055872c8b6588333ce

tech-stack:
  added: []
  patterns:
    - "A module-private refresh wrapper catches the fetch failure and inserts a cause link between the error and its FetchedUrlCause, through a type-guard predicate"

key-files:
  created:
    - .planning/phases/10-github-source-kind-and-suite-close/10-04-RED.json
  modified:
    - features/marketplace/git-source.feature
    - features/marketplace/url-source.feature
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - tests/orchestrators/marketplace/update.test.ts
    - CHANGELOG.md
    - .planning/WINDOWS.md

key-decisions:
  - "The github remedy is a new Error whose cause is the old cause (the FetchedUrlCause), so the fetched URL stays the last link and the code-bearing error stays at depth 0"
  - "The predicate lacksStoredCredential checks Error, stored-credential bundle, not CrossOriginChallengeError, and authentication required, in that order, so each short-circuit has its own unit case (149/149 branches)"
  - "The github arm's catch lives in update.ts, not shared.ts, because the plan pins shared.ts and plugin/update-flow.ts unchanged; plugin update's gap is WINDOWS entry 101"

patterns-established:
  - "A 401 update row pins the whole cause chain, with `\\n` and `\\|` escapes in the Examples cell"

requirements-completed: [ADD-11, UPD-12]

duration: 19min
completed: 2026-10-21
---

# Phase 10 Plan 04: 401 on both git kinds Summary

**A 401 add is pinned for url (bare row) and three github spellings (child row with the fetched URL), a stored credential clones on both kinds, and a 401 update is pinned on both with its whole cause chain. Under the GitHub base override, the github update chain now names `git credential approve` for the override's host before the fetched URL, shown red then green.**

## Performance

- **Duration:** about 19 min
- **Started:** 2026-10-21T14:35Z
- **Completed:** 2026-10-21T14:54Z
- **Tasks:** 2
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- ADD-11 / D-11: `Adding a url marketplace that needs a credential fails as authentication required without one` moved unchanged into `git-source.feature`, as a single scenario.
- ADD-11 / D-11: the Outline `Adding a github marketplace that needs a credential fails as authentication required without one` runs `acme/tools`, `https://github.com/acme/tools`, and `https://github.com/acme/tools.git` in one `@github` block. Each gives `Some operations have failed.` and one failed child row named as typed, with `{authentication required}` and the cause chain `The operation was canceled., fetched https://{git host}/acme/tools.git`.
- ADD-11 / D-09: the Outline `Adding a git marketplace with a stored credential clones it` replaces the url-only scenario. It has one `@url` row and two `@github` rows. Each logs `GET info/refs 401`, `GET info/refs 200`, `POST git-upload-pack 200`.
- UPD-12 / D-09 / D-10: the Outline `Updating a git marketplace whose host now needs a credential fails as authentication required` has one `@url` row and two `@github` rows, each with the whole cause chain. The github chain ends with `fetched https://{git host}/acme/tools.git` (GHB-01).
- D-13 (P-2): `update.ts` now calls the module-private `refreshGitHubSource`. It catches the github fetch failure, and the predicate `lacksStoredCredential` checks four things: the failure is an Error, the bundle is `stored-credential`, it is not a `CrossOriginChallengeError`, and it reads as `authentication required`. When all hold, the function replaces the cause with `new Error(NO_STORED_CREDENTIAL_CAUSE(auth.host), { cause: err.cause })`. No git or network import was added.
- The `git-source.feature` description now says that the add uses the user's stored credential when the host asks for one, and fails without it (three lines).
- The CHANGELOG has one sub-bullet under the override bullet. The top-level count stays 14.
- WINDOWS entry **101** (`deviation`, open): the github marketplace sync of `plugin update` (`orchestrators/plugin/update-flow.ts`) under the override still fails a 401 without the `git credential approve` line.

## Task Commits

| Commit | Type | Content |
|--------|------|---------|
| `dbab9f73` | test | Task 1: the url no-credential scenario moved, the github no-credential Outline, the stored-credential Outline, the description |
| `8e776b49` | fix | Task 2: the UPD-12 Outline, `refreshGitHubSource` and `lacksStoredCredential`, and five unit cases, in one commit |
| `06e1300a` | docs | Task 2: the CHANGELOG sub-bullet |
| `16c4d977` | docs | Task 2: WINDOWS entry 101 |

**Plan metadata:** the `docs(planning)` commit that follows this SUMMARY, with `10-04-RED.json`.

## RED Evidence (D-13, on the unchanged update arm)

Precondition: `git diff --quiet 3bc84b58 -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` exited 0.

**Cucumber, `@url` row.** `npm run --silent test:cucumber -- features/marketplace/git-source.feature --parallel 1 --name '^Updating a git marketplace whose host now needs a credential fails as authentication required$'`: exit 0, `1 scenario (1 passed)`. The url arm already had the remedy.

**Cucumber, `@github` rows.** The scratch `@github` config plus `features/marketplace/git-source.feature --parallel 1 --name '<same pattern>' --format summary --format junit:<scratchpad>/10-04-red.xml`: exit 1, `2 scenarios (2 failed)`, `18 steps (14 passed, 2 skipped, 2 failed)`.

| junit testcase | Source | Result |
|----------------|--------|--------|
| `- #2.1` | `acme/tools` | **fail** at `Then the result lists these plugins:`, on the cause chain cell only |
| `- #2.2` | `https://github.com/acme/tools` | **fail** at `Then the result lists these plugins:`, on the cause chain cell only |

The actual chain was `Failed to update marketplace "tools"., The operation was canceled., fetched https://{git host}/acme/tools.git`. The remedy link was missing. `gsd-tools check tdd-red-evidence` gave `RED_EVIDENCE_OK` (`target_test_failed`) for a copy with each testcase name as `targetTest`. Both copies were deleted. The verdicts are in `10-04-RED.json` under `classifierVerdicts`.

**Unit.** `node --test tests/orchestrators/marketplace/update.test.ts` with the five new cases on the unchanged code: exit 1, `ℹ tests 106`, `ℹ pass 105`, `ℹ fail 1`.

| Case | Before the fix | After the fix |
|------|----------------|---------------|
| UPD-12 / GHB-01: a cancelled credential lookup under the override names git credential approve before the fetched URL (`mirror.example:8443`) | **fail** (chain `cancelled -> fetched ...`, no remedy) | pass |
| UPD-12 / GHB-01: a 500 under the override keeps its chain (`{network error}`, no remedy) | pass | pass |
| UPD-12 / GHB-01: a cross-origin challenge under the override keeps its chain | pass | pass |
| UPD-12: a non-Error rejection under the override reaches the row unchanged (`socket closed`) | pass | pass |
| GHB-04: a declined Device Flow without the override keeps its chain (`cancelled`, no remedy) | pass | pass |

## Verification Evidence

Tools: Node `v26.11.1`.

| Command | When | Exit | Result |
|---------|------|------|--------|
| `npm run test:cucumber -- features/marketplace/git-source.feature features/marketplace/url-source.feature --parallel 1` | Task 1 | 0 | `18 scenarios (18 passed)` |
| `npm run test:cucumber` | Task 1 | 0 | `382 scenarios (382 passed)`, `3501 steps (3501 passed)` |
| `@github` triage (scratch config, relative path) | Task 1 | 0 | `44 scenarios (44 passed)` |
| `npm run check:features` | Task 1 and Task 2 | 0 | no "Feature gate failed" |
| `node --test tests/orchestrators/marketplace/update.test.ts tests/architecture/no-credential-leak.test.ts` | Task 2 | 0 | `ℹ tests 218`, `ℹ fail 0` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` | Task 2 | 0 | 100% lines, branches, functions (branches 149/149, functions 20/20, lines 925/925) |
| `npx eslint` on `update.ts` and `update.test.ts`, `npx fallow dupes`, `npx fallow health` | Task 2 | 0 | clean |
| `npm run test:cucumber -- features/marketplace/git-source.feature --parallel 1` | Task 2 | 0 | `11 scenarios (11 passed)` |
| `npm run test:cucumber` | Task 2 | 0 | `383 scenarios (383 passed)` |
| `@github` triage | Task 2 | 0 | `46 scenarios (46 passed)` |
| `node .claude/gsd-core/bin/gsd-tools.cjs windows status` | Task 2 | 0 | entry 101 open, `[marketplace-features]`, names `update-flow.ts` |
| `SKIP=npm-check pre-commit run --files ...` | each commit | 0 | every hook Passed |
| Commit hook `npm run check:commit` | `dbab9f73`, `8e776b49` | 0 | Passed, no `--no-verify` |

Acceptance greps: scenarios in `url-source.feature` 6 (was 8), in `git-source.feature` 7 after Task 1 (was 4), 8 after Task 2. `stored a credential` in `git-source.feature`: 1. The no-credential github chain: 1. `git credential approve` in `git-source.feature`: 3. `NO_STORED_CREDENTIAL_CAUSE` in `update.ts`: 2. `shared.ts` and `plugin/update-flow.ts` are unchanged since `3bc84b58`. `git credential approve` under `## [Unreleased]`: 1, with 14 top-level bullets. `git status --short -- extensions tests features CHANGELOG.md .planning/WINDOWS.md` was empty after the last commit. No temporary RED copy is left in the phase directory.

## Flagged Assumptions (carried from the plan)

- `ADD-11 / unclassified / unresolved`: the probe supplied no edge shape. The github no-credential Outline and the stored-credential Outline are the manual-review targets.
- `UPD-12 / unclassified / unresolved`: the probe supplied no edge shape. The update Outline is the manual-review target.
- Placement: the github no-credential Outline lives in `git-source.feature` beside the url scenario, so the whole 401 family sits in one file (D-09). Its rows run in the default profile once plan 10-05 removes the exclusion.
- P-2 stays in `marketplace update` (D-13). Plugin update's marketplace sync has the same github arm without the remedy. It is WINDOWS entry 101, not fixed here.
- The cause cells write `\\n` and `\|` for Gherkin. No Examples column is named `user` or `token`.

## Deviations from Plan

None in scope or code. Small notes:

- The unit cases build the auth failure as the plan says (a `UserCanceledError` code whose cause is a `FetchedUrlCause`). The fake git ops do not add a `FetchedUrlCause` themselves, so each override case sets it on the thrown error.
- The non-Error case asserts the rendered row (`cause: Failed to update marketplace "mirror-mp". -> socket closed`), because `refreshRecord` wraps every failure in `MarketplaceUpdateError`. The string arrives unchanged as the second link.
- The WINDOWS entry uses kind `deviation`, because the plan did not name a kind.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Next Phase Readiness

Ready for 10-05. The `@github` rows pass 46 of 46 under the scratch config, and the default run passes 383 of 383. `cucumber.json` still runs `not @github`.

## Self-Check: PASSED

- FOUND: `features/marketplace/git-source.feature`, `features/marketplace/url-source.feature`, `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `tests/orchestrators/marketplace/update.test.ts`, `CHANGELOG.md`, `.planning/WINDOWS.md`, `.planning/phases/10-github-source-kind-and-suite-close/10-04-RED.json`
- FOUND commits: `dbab9f73`, `8e776b49`, `06e1300a`, `16c4d977`
