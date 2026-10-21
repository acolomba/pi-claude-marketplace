---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "07"
subsystem: testing
tags: [cucumber, url-source, git-http-backend, request-log, host-04]

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: plan 09-01's request window (requestsOfLastCommand), plan 09-04's git-host steps, and the url publication arms
provides:
  - The step "the git host receives no request" (zero requests and zero connections in the last When's window)
  - features/marketplace/unsupported-source.feature with the ADD-08 refused-form Outline (4 untagged rows, 4 @github rows)
  - features/marketplace/git-source.feature with the ADD-12 re-add Outline and the LS-05, INFO-07, RM-09 no-request Outlines, each with @url and @github blocks over project and user scope
affects: [09-08, phase-10-github-source]

actuals:
  tokens: 2100
  tasks: 2
  commits: 2

plan_head_before: 6ca47db4ab9ac3683a5c0b3e818afa292d3f0fd3
plan_head_after: 3f72f2c1d47ec1896ac58a176bb4d7f62d7f626d

tech-stack:
  added: []
  patterns:
    - "An empty request log is asserted as the whole traffic record { requests: [], connections: 0 }, so a kept-alive request or a non-TLS attempt fails it"

key-files:
  created:
    - features/marketplace/unsupported-source.feature
    - features/marketplace/git-source.feature
  modified:
    - features/step_definitions/marketplace/git-host.steps.ts

key-decisions:
  - "The empty-log step compares the whole GitHostTraffic record with deepStrictEqual instead of two separate checks, so any new field on the record also has to be empty"

patterns-established:
  - "A git-only behavior that must also run for github varies the scope (project, user) to reach three or more variants across its @url and @github blocks"

requirements-completed: [ADD-08, ADD-12, RM-09, LS-05, INFO-07, HOST-04]

coverage:
  - id: D1
    description: "The step 'the git host receives no request' fails when the last When made any request or opened any connection"
    requirement: HOST-04
    verification:
      - kind: e2e
        ref: "features/marketplace/unsupported-source.feature#Adding a refused source form fails as unsupported source and reaches no host"
        status: pass
      - kind: other
        ref: "by-hand control: a scratch scenario that clones a url marketplace and then asserts the empty log fails with connections 1 and two requests (not committed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "http://, ssh://, git@ scp-form, and ~other/ sources fail in one error cascade (A marketplace operation has failed.) with the row <source> project failed {unsupported source} and no request or connection at the git host"
    requirement: ADD-08
    verification:
      - kind: e2e
        ref: "features/marketplace/unsupported-source.feature#Adding a refused source form fails as unsupported source and reaches no host"
        status: pass
    human_judgment: false
  - id: D3
    description: "The GitHub-shaped refused forms (/tree/ URL, https://github.com/acme, a bare word, a/b/c) sit in an @github block that cucumber.json excludes; check:features dry-runs them"
    requirement: ADD-08
    verification:
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false
  - id: D4
    description: "A removed url marketplace added again in the project or the user scope reports tools <scope> added, and the git host log is exactly the discovery GET and the pack POST"
    requirement: ADD-12
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#A removed git marketplace can be added again from the same source (@url rows, scratch config)"
        status: pass
    human_judgment: false
  - id: D5
    description: "marketplace list, info, and remove of a url marketplace compare the whole result and leave the request log empty in both scopes"
    requirement: LS-05
    verification:
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Listing git marketplaces makes no request to the git host (@url rows, scratch config)"
        status: pass
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Info on a git marketplace makes no request to the git host (@url rows, scratch config)"
        status: pass
      - kind: e2e
        ref: "features/marketplace/git-source.feature#Removing a git marketplace makes no request to the git host (@url rows, scratch config)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 07: Refused Forms, Git Re-add, and No-Request Verbs Summary

**A new step asserts an exactly empty git host log (zero requests and zero connections). With it, every refused `marketplace add` source form is pinned as `{unsupported source}` with no host contact, and a url marketplace's re-add, list, info, and remove are pinned for both scopes. Each Outline carries an `@github` block for Phase 10.**

## Performance

- **Duration:** 6 min (execution; reading the context came before)
- **Started:** 2026-10-21T04:37:38Z
- **Completed:** 2026-10-21T04:43:15Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)
- **Node:** v26.11.1

## Accomplishments

- `git-host.steps.ts`: `Then("the git host receives no request")` compares `this.requestsOfLastCommand()` with `{ requests: [], connections: 0 }`. A short comment says why connections count (09-RESEARCH.md Pitfall 3, E12).
- `unsupported-source.feature`: one Outline. The untagged block has `http://{git host}/acme/tools.git`, `ssh://{git host}/acme/tools.git`, `git@127.0.0.1:acme/tools.git`, and `~other/marketplaces/tools`. The `@github` block has `https://github.com/acme/tools/tree/main`, `https://github.com/acme`, `tools`, and `acme/tools/extra`. That covers each of the eight forms REQUIREMENTS.md ADD-08 lists once. The 4 untagged rows run in every commit now.
- `git-source.feature`: four Outlines (re-add, list, info, remove). Each has an `@url` block and an `@github` block with project and user rows. The re-add keeps the repository path in a `repository path` column, so Phase 10 can change its own rows.
- Every measured value matched the plan's `<interfaces>` on the first run. Nothing had to be re-pinned.

## Task Commits

1. **Task 1: Assert an empty request log and pin every refused source form (ADD-08, HOST-04)**: `3488672e` (test)
2. **Task 2: Pin the git re-add and the no-request list, info, and remove (ADD-12, LS-05, INFO-07, RM-09)**: `3f72f2c1` (test)

**Plan metadata:** the `docs(planning)` commit that carries this SUMMARY.

## Files Created/Modified

- `features/step_definitions/marketplace/git-host.steps.ts`: the empty-log `Then`, after the request-table `Then`.
- `features/marketplace/unsupported-source.feature`: new, `Feature: Marketplace unsupported source`.
- `features/marketplace/git-source.feature`: new, `Feature: Marketplace git source`.

## Verification

| Command | Exit | Result |
|---------|------|--------|
| `npm run test:cucumber -- features/marketplace/unsupported-source.feature --parallel 1` | 0 | 4 scenarios (4 passed) |
| by-hand control: scratch feature (url add, then `the git host receives no request`) | 1 | fails as intended: `connections: 1` and two requests against the expected empty record |
| `npm run check:features` (after Task 1) | 0 | no "Feature gate failed" |
| commit hook for `3488672e` (`npm run check:commit`) | 0 | Passed |
| `npx cucumber-js -c <relative scratch config, tags @url> features/marketplace/git-source.feature` | 0 | 8 scenarios (8 passed) |
| `npx cucumber-js -c <relative scratch config, tags @url>` | 0 | 39 scenarios (39 passed), 390 steps |
| `npm run check:features` (after Task 2) | 0 | no "Feature gate failed" |
| `npx cucumber-js --dry-run features/marketplace/git-source.feature` (default profile) | 0 | 0 scenarios (every row is tagged) |
| `npm run test:cucumber` | 0 | 334 scenarios (334 passed), 3023 steps |
| commit hook for `3f72f2c1` (`npm run check:commit`) | 0 | Passed |

The scratch config was passed by a path relative to the cwd, not the absolute `mktemp` path in the plan's `<verify>`, because cucumber-js 13.3.0 joins an absolute `-c` path onto the cwd (finding from 09-03). The config text is the plan's. It lives in the session scratchpad, outside the repository.

Acceptance greps: `receives no request` appears 1 time in the steps module and `the git host receives no request` 1 time in unsupported-source.feature. The `| github |` rows number 4 there. git-source.feature has 4 `@url` lines, 4 `@github` lines, and 3 `the git host receives no request` lines. A column-alignment check over both new feature files reported no misaligned table. `git status --short -- features` printed nothing after each commit.

The combined-tree `npm run check` runs after this wave (orchestrator).

## Flagged assumptions

- `ADD-12 / unclassified / unresolved` (spec-less probe): the probe supplied no edge shape. The re-add Outline is the manual-review target.
- The `@github` rows assume that Phase 10 sets the GitHub base override to the stand-in's origin with no path prefix, so a GitHub repository is served at `/acme/tools.git`. The re-add Outline keeps that path in a `repository path` column, so Phase 10 can change its own rows without touching the url rows.
- RM-09 idempotency (a repeated remove reports `marketplace not added` with no request) is a backstop truth. The plan pins no scenario for it, and none was added.

## Decisions Made

- The empty-log step compares the whole traffic record in one `deepStrictEqual` (see key-decisions).

## Deviations from Plan

None - plan executed exactly as written. (The relative scratch-config path is how the orchestrator's repo rules say to run the plan's `<verify>` command. The command itself did not change.)

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-08 can remove `@url` from the `cucumber.json` exclusion. The scratch run shows all 39 `@url` scenarios passing, including the 8 new git-source rows.
- No blockers.

## Self-Check: PASSED

- FOUND: features/marketplace/unsupported-source.feature, features/marketplace/git-source.feature, features/step_definitions/marketplace/git-host.steps.ts
- FOUND: commits 3488672e, 3f72f2c1 on HEAD
