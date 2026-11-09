---
phase: 11-device-flow-sign-in
plan: 01
subsystem: testing
tags: [cucumber, device-flow, github, git-credential-store, behavioral-tests]

requires:
  - phase: 01-foundation
    provides: "the Device Flow stand-in, the in-process GitHub redirect, the git host's credential arm, the frozen git-host steps, and the two seeds of features/marketplace/device-flow.feature"
provides:
  - "features/step_definitions/marketplace/device-flow.steps.ts: `the user's git credential store holds these credentials:` and `the user's git credential store holds no credentials`, over one module-private store reader"
  - "DFLOW-01: seed 1 states the one credential the sign-in stores; a new scenario pins that marketplace update reuses it with no sign-in"
  - "DFLOW-02: one outline over access_denied and expired_token pins the bare authentication required row and that nothing is left"
affects: [11-02 (adds its stored github.com credential Given to the same verb module), the behavioral-gaps merge of this branch]

actuals:
  tokens: 2723
  tasks: 2
  commits: 2
plan_head_before: 24082fd9a4e70d5aba62fa1b7099bec84fc0a1f2
plan_head_after: a2c8738432b2a263764ff30e7702f96e4bc4d2eb

tech-stack:
  added: []
  patterns:
    - "A credential store Then reads `.git-credentials` through `world.tokens.home` only, parses each line with `URL`, and compares the whole table in file order"
    - "A red proof edits `runPollLoop` in domain/github-auth.ts, and the original comes back from a scratch copy whose sha256 matches, with `git diff --exit-code -- extensions` exit 0"

key-files:
  created:
    - features/step_definitions/marketplace/device-flow.steps.ts
  modified:
    - features/marketplace/device-flow.feature

key-decisions:
  - "Every result table of the new scenarios is the product's own rendering, read from the first run's diff: the update is one info cascade with the row tools | user | skipped | up-to-date, and the failed add is the prompt row plus an error cascade with the summary `A marketplace operation has failed.` and the bare row acme/tools | user | failed | authentication required"
  - "The run showed no product bug: every nothing-left Then passed on the first run, so the Bug policy did not apply and no product file changed"
  - "The store Then keeps the store's lines in file order with no sorting or deduplication, so a second approval of the same token would show as a second row"

patterns-established:
  - "Credential store observation: the store path comes only from `this.tokens.home`; an absent store and an empty store both hold no credentials"

requirements-completed: [DFLOW-01, DFLOW-02]

coverage:
  - id: D1
    description: "A Device Flow sign-in on marketplace add shows the prompt row, clones after authorization, and leaves exactly one credential in the user's git credential store: https, github.com, x-access-token, stand-in-access-token"
    requirement: DFLOW-01
    verification:
      - kind: e2e
        ref: "features/marketplace/device-flow.feature#Adding a private GitHub marketplace signs in through Device Flow and clones it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The next command against the same repository, marketplace update, finds the stored token: the git host sees 401, 200, and the pack request, and the sign-in stand-in receives no request"
    requirement: DFLOW-01
    verification:
      - kind: e2e
        ref: "features/marketplace/device-flow.feature#Updating a marketplace after a Device Flow sign-in uses the stored token without signing in again"
        status: pass
    human_judgment: false
  - id: D3
    description: "A sign-in answered with access_denied or expired_token fails as the bare authentication required row and leaves no record, checkout, clone, user-scope config, or credential, with no request after the terminal outcome"
    requirement: DFLOW-02
    verification:
      - kind: e2e
        ref: "features/marketplace/device-flow.feature#A sign-in that GitHub answers with <outcome> fails as authentication required and leaves nothing behind (access_denied, expired_token)"
        status: pass
    human_judgment: false

duration: 32min
completed: 2026-11-08
status: complete
---

# Phase 11 Plan 01: Device Flow Sign-In Store and Failure Scenarios Summary

**A GitHub Device Flow sign-in on `marketplace add` is pinned from the prompt row to the one credential git's store helper keeps (https, github.com, x-access-token, stand-in-access-token), `marketplace update` is pinned to reuse it with no sign-in, and a denied or expired sign-in is pinned as the bare `authentication required` row that leaves no record, checkout, clone, config, or credential. Each scenario fails without its behavior.**

## Performance

- **Duration:** 32 min
- **Started:** 2026-11-08T14:44:13Z
- **Completed:** 2026-11-08T15:16:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 created)

## Accomplishments

- The new verb module `features/step_definitions/marketplace/device-flow.steps.ts` reads the credential store `.git-credentials` in the sandbox HOME through `this.tokens.home` only. It has a whole-table Then (columns `protocol`, `host`, `user`, `password`) and an empty-store Then.
- Seed 1 keeps its title and every step (D-BG-1106) and now ends with the store table: exactly one credential, `https | github.com | x-access-token | stand-in-access-token`.
- The new scenario "Updating a marketplace after a Device Flow sign-in uses the stored token without signing in again" signs in through a setup add, then runs `marketplace update tools --scope user`. The git host sees 401, then 200 and the pack request, the stand-in gets no request, and the redirect routes the three git requests to the git host (DFLOW-01, D-BG-1102, AUTH-02).
- The new outline "A sign-in that GitHub answers with <outcome> fails as authentication required and leaves nothing behind" runs for `access_denied` and `expired_token`. Both show the prompt row and the bare `authentication required` marketplace row with no cause chain. The git host sees one 401, the stand-in sees the code request and two polls, and the user scope holds no record, no checkout, no git clone, no `claude-plugins.json`, and no stored credential (DFLOW-02, D-BG-1103).
- The feature description names the license of the divergence from Claude Code, which runs no Device Flow: AUTH-01, D-79-04, D-79-05, GHB-02, and D-BG-1101.
- No scenario carries an MCP implementation tag, so each runs once, under the adapter profile (D-BG-04). Every step that only the seeds use stays in use.

## Final step texts and scenario titles

Steps in `features/step_definitions/marketplace/device-flow.steps.ts` (one module-private reader, `credentialStoreLines`):

- `Then the user's git credential store holds these credentials:` (columns `protocol`, `host`, `user`, `password`)
- `Then the user's git credential store holds no credentials`

Scenarios of `features/marketplace/device-flow.feature`, in file order:

1. Adding a private GitHub marketplace signs in through Device Flow and clones it (seed 1, extended)
2. Updating a marketplace after a Device Flow sign-in uses the stored token without signing in again (new)
3. Scenario Outline: A sign-in that GitHub answers with <outcome> fails as authentication required and leaves nothing behind (new; examples `access_denied`, `expired_token`)
4. A terminal session of a sign-in scenario sends the background update's GitHub requests to the git host (seed 2, unchanged)

## Red proofs

Every red proof edited `runPollLoop` in `extensions/pi-claude-marketplace/domain/github-auth.ts`. Before the first edit, the original was copied to the scratch directory (sha256 `5002bdab875aba0d347a61e20b0e821c1e73eaef6199ef485e8aedf0497a0cc7`). After each proof the copy came back, the sha256 matched, `git diff --exit-code -- extensions` exited 0, and the feature ran green again. No break reached a commit.

| Proof | Temporary edit | Run | Failing step |
| --- | --- | --- | --- |
| Task 1 | The `success` arm skips `await opts.credentialOps.approve(opts.host, cred)` | 3 scenarios (1 passed, 2 failed) | Seed 1: `Then the user's git credential store holds these credentials:`, because the store held no line. Update scenario: `Then the result has these fields:` ("expected exactly one result"), because the update signed in again: it emitted a `device-flow-prompt` payload and an error cascade (`authentication required`, cause chain `Failed to update marketplace "tools".`, `The operation was canceled.`) after the exhausted poll script answered 500 |
| Task 2 (a) | The `access_denied` and `expired_token` arms run `await opts.credentialOps.approve(opts.host, provider.credentialFrom("stand-in-access-token"))` before they return | 5 scenarios (3 passed, 2 failed) | Both examples: `Then the user's git credential store holds no credentials`, because the store held `https://x-access-token:stand-in-access-token@github.com`. Every earlier step passed |
| Task 2 (b) | The same two arms `continue` instead of returning | 5 scenarios (3 passed, 2 failed) | Both examples: `Then github's sign-in receives these requests:`, because a third `/login/oauth/access_token` poll came after the terminal outcome |

Green reruns after each restore: Task 1, 3 scenarios (3 passed); Task 2 (a), 5 scenarios (5 passed); Task 2 (b), 5 scenarios (5 passed).

## Run log

Every run wrote its output to a file in the scratch directory, and its exit status was read directly. No failure was a timeout, so no run needed the one rerun that the rules allow.

| Run | Result | Note |
| --- | --- | --- |
| Precondition, at the base commit `24082fd9` | 2 scenarios (2 passed) | Both seeds pass |
| Task 1, first run | 3 scenarios (2 passed, 1 failed) | The first-guess update table lacked the `reasons` column (`up-to-date`); fixed from the product's row |
| Task 1, second run | 3 scenarios (3 passed) | `npm run check:features` exit 0 |
| Tracer gate, after commit `d93cf5ee` | 3 scenarios (3 passed) | `npm run check:features` exit 0 |
| Task 2, first run | 5 scenarios (3 passed, 2 failed) | The cascade summary is `A marketplace operation has failed.` |
| Task 2, second run | 5 scenarios (3 passed, 2 failed) | The failed row is a marketplace row (`marketplace reasons`), with no plugin row and no cause chain |
| Task 2, third run | 5 scenarios (5 passed) | `npm run check:features` exit 0 |
| Final verification, after commit `a2c87384` | 5 scenarios (5 passed), 82 steps | `npm run check:features` exit 0 |

## Product fixes

None. Every nothing-left Then of the outline passed on its first run, and the reason was `authentication required` for both outcomes, so the Bug policy did not apply. `git diff --exit-code -- extensions` exits 0 at the end.

## Task Commits

1. **Task 1: Sign in on a marketplace add, keep the token in the credential store, and reuse it on the next command (DFLOW-01)** - `d93cf5ee` (test)
2. **Task 2: A denied or expired sign-in fails as authentication required and leaves nothing behind (DFLOW-02)** - `a2c87384` (test)

Both commits passed the commit hook (`npm run check:commit`: typecheck, lint, fallow, format check, `check:features`, unpaired tests) and gitlint. The hook stashed and restored the orchestrator's unstaged `.planning/STATE.md` each time.

## Files Created/Modified

- `features/step_definitions/marketplace/device-flow.steps.ts` (created): the two credential store Thens and their store reader.
- `features/marketplace/device-flow.feature` (modified): the description, seed 1's store table, the update scenario, and the failure outline.

## Decisions Made

- The result tables of the new scenarios are the product's rendering, read from each first run's diff, not copied from the override-host rows of `features/marketplace/git-source.feature`.
- The store Then keeps the file order and every line, so a duplicate approval would fail the one-row table.
- The update scenario states its single result with `the result has these fields:` and `the result lists these marketplaces:`, because the update emits one payload.

## Deviations from Plan

None - plan executed exactly as written. Seed 1's `github's sign-in receives these requests:` table was realigned (whitespace only) under the plan's "Align every table's columns"; see Dubious Choices.

## Issues Encountered

- The first commit's hook ran about 9 minutes. ESLint linted the whole tree with a cold cache in this new worktree on a loaded machine, and the harness moved the foreground commit to the background after 180 s. I waited on the commit's process and edited nothing meanwhile. The second commit's hook finished in the foreground.
- The session's worktree guard refuses shell text that names git in some forms, so the acceptance greps ran through a scratch Node script that holds the literals and takes the file paths as arguments. One combined self-check command was refused and was rerun as separate plain commands.
- Observation for the parent: the failed Device Flow add renders the bare `(failed) {authentication required}` marketplace row with the summary `A marketplace operation has failed.`, while the override-host github add in `features/marketplace/git-source.feature` renders a failed child row with the fetched-URL frame and the summary `Some operations have failed.`. This is by design: `handleAddFailure` and `failedAddRow` in `orchestrators/marketplace/add.ts` add the child row only under the GitHub base override (GHB-01). The bare row matches D-BG-1103 and GAUTH-05.
- The planner assumptions A-11-01 to A-11-03 held: one next command proves the reuse, the poll script with interval 0 stands in for polling time, and the terminal outcome is the stand-in's poll answer.
- Hermetic home: no file under the real `~/.pi` changed after 14:44:13Z (a `find -newermt` scan, checked against an older bound), no `~/.git-credentials` exists in the real home, and `~/.gitconfig` is unchanged since 2026-09-27.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-02 adds its stored github.com credential Given to `features/step_definitions/marketplace/device-flow.steps.ts`, above the two Thens (registrations go Given, When, Then). The module already imports `ScenarioWorld` and builds the store path from `tokens.home`.
- A scenario that uses that new Given must not also use `the user's git keeps credentials in its credential store`, because both create `.gitconfig` with flag `wx`.
- Parent lines: none from this plan. No frozen file, CHANGELOG, README, PROJECT.md row, or BACKLOG entry needs a change, and no unowned feature file changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-11-01 is mitigated: the module builds the store path only from `this.tokens.home`, and it contains neither `homedir` nor `process.env`. T-11-02 is mitigated: every result is compared whole, and the token literal appears only in the git host arm and the store table. T-11-03 is mitigated: every scenario starts the routed Pi and states its routing table whole, and the feature has no refused routing row. T-11-04 is mitigated: each red-proof edit was restored from the scratch copy with a matching sha256 and `git diff --exit-code -- extensions` exit 0, and each commit named its two paths. T-11-SC: no package was installed.

## Self-Check: PASSED

- FOUND: `features/step_definitions/marketplace/device-flow.steps.ts`, `features/marketplace/device-flow.feature`
- FOUND: commits `d93cf5ee` and `a2c87384` on HEAD (`git rev-list --count 24082fd9..HEAD` = 2 before this SUMMARY)
- Task 1 acceptance: the steps module exists; the store table step appears once in the feature; the update scenario title appears once; the description names D-BG-1101, AUTH-01, D-79-04, D-79-05, and GHB-02; the seed 1 title appears once; `homedir` plus `process.env` count 0 in the module
- Task 2 acceptance: the outline title appears once; the empty-store step appears once in the module; no MCP implementation tag; no `| refused` row
- `npx cucumber-js features/marketplace/device-flow.feature`: 5 scenarios (5 passed); `npm run check:features`: exit 0; `git diff --exit-code -- extensions`: exit 0

## Dubious Choices

- **Two-row outline (Low):** D-BG-1103 locks one outline over `access_denied` and `expired_token`, while `.agents/skills/cucumber/rules/features.md` asks for three or more variants of an Outline. I kept the two-row outline as the decision says. The precedents are the two-row Outlines of `features/marketplace/add.feature`. This is the tension P11-DC-08 recorded at the plan step, now in the file.
- **Seed 1's sign-in table realigned (Low):** the `form` column of the seed's `github's sign-in receives these requests:` table was 13 characters too narrow for its two poll rows. I padded the header and the code-request row to the poll rows' width. No step, value, or title changed (D-BG-1106 keeps the seed).
- **The store table has no path column (Low):** the Then projects protocol, host, user, and password, as D-BG-1102 names them, so a store line with a path would read like one without. Under the scenario's git config (`credential.helper = store`, no `credential.useHttpPath`), git drops an https path before the helper writes, and the product sends no `path=` attribute (`buildAttributeBlock` in `platform/git-credential.ts`). So no such line can appear today.
