---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "06"
subsystem: marketplace
tags: [cucumber, url-source, git-http-backend, classifier, d-16, upd-11]

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: plan 09-04's per-repository status and drop arms on the git host, and plan 09-05's bare child id and RED-record shape
provides:
  - A module-private isRemoteNotFound check in git-failure-classifiers.ts; classifyGitSourceAccessFailure maps a git NotFoundError to source missing
  - The scenario "Adding a url marketplace at a ref the repository lacks fails as source missing"
  - features/marketplace/url-source-update.feature with the UPD-11 status Outline (500, 502, 503, 404) and the bare-update drop scenario
  - 09-06-RED.json, the recorded failing run of the missing-ref scenario on the code before the fix
affects: [09-07, 09-08, phase-10-github-source]

actuals:
  tokens: 5092
  tasks: 2
  commits: 2

plan_head_before: 294a8030834cb91d198ab6e724c59215d42507f5
plan_head_after: 70a5a09ff4a3298cc69ba61db3d9c710b69e3120

tech-stack:
  added: []
  patterns:
    - "A source-access-only classification arm sits in classifyGitSourceAccessFailure after the shared transport ladder, so add-only verdicts never leak into update, install, fetch, or info"

key-files:
  created:
    - features/marketplace/url-source-update.feature
    - .planning/phases/09-url-source-kind-and-https-git-stand-in/09-06-RED.json
  modified:
    - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
    - features/marketplace/url-source.feature
    - tests/shared/git-failure-classifiers.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - docs/output-catalog.md
    - CHANGELOG.md

key-decisions:
  - "D-16 uses the existing source missing token: ADD-09 already uses it for a repository the host lacks, and the row's subject (the source as typed) carries the #ref, so no new reason and no checkpoint were needed"
  - "The CHANGELOG bullet also names the orchestrated side effect (reload and import rows read source missing instead of unparseable) in the same sentence, so the reader sees both changes"

patterns-established:
  - "An add-only unit case for a git source runs under createHermeticEnvironment, like the ADD-10 cases"

requirements-completed: [UPD-11]

coverage:
  - id: D1
    description: "A url add at a #ref the repository lacks fails in one error cascade (A marketplace operation has failed.) with the bare row https://{git host}/acme/tools.git#stable project failed {source missing}, and the git host log is exactly GET /acme/tools.git/info/refs?service=git-upload-pack 200"
    requirement: UPD-11
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace at a ref the repository lacks fails as source missing"
        status: pass
    human_judgment: false
  - id: D2
    description: "classifyGitSourceAccessFailure maps a NotFoundError to source missing; classifyGitTransportFailure leaves it unclassified"
    requirement: UPD-11
    verification:
      - kind: unit
        ref: "tests/shared/git-failure-classifiers.test.ts#classifies a ref the remote does not have as source missing"
        status: pass
      - kind: unit
        ref: "tests/shared/git-failure-classifiers.test.ts#leaves a ref the remote does not have to the caller"
        status: pass
    human_judgment: false
  - id: D3
    description: "A standalone addMarketplace whose clone throws NotFoundError notifies the (failed) {source missing} row named by the typed source; an orchestrated one returns the source-missing outcome without notifying"
    requirement: UPD-11
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#ADD-09: a clone of a ref the remote lacks renders (failed) {source missing} named by the typed source"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#ADD-09 orchestrated mode -- a clone of a ref the remote lacks returns the source-missing outcome without notifying"
        status: pass
    human_judgment: false
  - id: D4
    description: "A named url update the git host answers 500, 502, 503, or 404 fails as network error with the cause chain <status> on https://{git host}/acme/tools.git, HTTP Error: <status> <phrase> and the single info/refs log row"
    requirement: UPD-11
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source-update.feature#Updating a url marketplace the git host answers with an HTTP error fails as network error"
        status: pass
    human_judgment: false
  - id: D5
    description: "A bare update reports the url marketplace whose connection drops as network unreachable (Failed to update marketplace \"tools\"., socket hang up) and the second url marketplace on the same host as skipped up-to-date"
    requirement: UPD-11
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source-update.feature#A bare update continues past a url marketplace whose connection drops"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 06: Missing-ref Add and Url Update Failures Summary

**A url `marketplace add` at a `#ref` the repository lacks now fails as a typed `{source missing}` row named by the source as typed, shown red then green through a real Pi; and the url update failures (500, 502, 503, 404 as `network error`, a dropped connection as `network unreachable` in a bare update) are pinned with exact cause frames and logs.**

## Performance

- **Duration:** 7 min (execution; reading the context came before)
- **Started:** 2026-10-21T04:24:38Z
- **Completed:** 2026-10-21T04:31:26Z
- **Tasks:** 2
- **Files modified:** 8 (2 created, 6 modified)
- **Node:** v26.11.1

## Accomplishments

- D-16: `classifyGitSourceAccessFailure`, whose one caller is `classifyAddError` in `marketplace add`, maps an isomorphic-git `NotFoundError` (`code === "NotFoundError"`) to `source missing`. It checks after the shared transport ladder and before the HTTP status. `classifyGitTransportFailure` has no changed line, so update, plugin install, fetch, and info still leave a missing ref unclassified.
- The scenario `Adding a url marketplace at a ref the repository lacks fails as source missing` pins one error cascade, the bare row `https://{git host}/acme/tools.git#stable project failed {source missing}`, and the log `GET /acme/tools.git/info/refs?service=git-upload-pack 200`. The host answered, and the ref is what is missing.
- UPD-11: `features/marketplace/url-source-update.feature` pins a named update answered 500, 502, 503, and 404 (`network error`, cause `<status> on https://{git host}/acme/tools.git`, `HTTP Error: <status> <phrase>`, log `GET ... <status>`). It also pins a bare update where only `tools` drops (`network unreachable`, `Failed to update marketplace "tools".`, `socket hang up`) and `extras` on the same host is skipped as `up-to-date` (D-05, D-08).
- Records: the `add-source-missing` catalog trigger text names the git cases (no `#ref` the repository has; the host answers 404 or 410). The example block and `EXPECTED_UTF8_BYTES = 46_623` are unchanged. One CHANGELOG bullet is under `[Unreleased]` (15 top-level bullets now).

## RED evidence (D-16)

- **Command:** `npm run --silent test:cucumber -- features/marketplace/url-source.feature --parallel 1 --name '^Adding a url marketplace at a ref the repository lacks fails as source missing$' --format summary --format junit:<scratchpad>/09-06-red.xml` on base `294a8030` with only the scenario added.
- **Exit:** 1; 1 scenario (1 failed), 7 steps (4 passed, 2 skipped, 1 failed).
- **Failure:** at `Then the result has these fields`. `kind` read `internal-error` (expected `cascade`), `summary` read `Command failed unexpectedly.` (expected `A marketplace operation has failed.`), and the payload carried the cause chain `Could not find stable.` and `cause truncated false`. Severity and needs reload matched.
- **Classifier:** `gsd-tools check tdd-red-evidence` on a temporary copy returned `RED_EVIDENCE_OK` (`target_test_failed`, junit, 1 test, 1 fail). The copy was deleted. The verdict is in `09-06-RED.json` `classifierVerdicts`.
- **Semantic assessment:** the planned assertion failed for the intended reason. The add rethrew the unclassified `NotFoundError`, and Pi rendered `internal-error`. There was no start error, load fault, or undefined step.
- **Unit cases before the fix:** `node --test tests/shared/git-failure-classifiers.test.ts tests/orchestrators/marketplace/add.test.ts` exited 1 with 167 passed and 3 failed. The 3 failures were `classifies a ref the remote does not have as source missing` (got `undefined`), `ADD-09: a clone of a ref the remote lacks renders ...` (the standalone add rethrew `NotFoundError: Could not find stable.`), and `ADD-09 orchestrated mode -- ...` (got `reason: 'unparseable'`). `leaves a ref the remote does not have to the caller` passed before and after the fix, as planned. It guards the other surfaces.

## Measured bare-update tallies (Task 2)

The bare-update scenario passed on its first run with these values, so they are pinned as measured:

| cascade | severity | summary | tally label | tally failures | tally warnings | tally success count |
|---------|----------|---------|-------------|----------------|----------------|---------------------|
| tools | error | Some operations have failed. | Marketplace update | 2 | 0 | (empty) |
| extras | info | (empty) | Marketplace update | 0 | 0 | 1 |

The failed cascade counts 2 failures: the failed block and its child row. This is the same shape `features/marketplace/update.feature` pins for a bare update with one failed marketplace. Every update cause frame and log row matched the 09-RESEARCH.md measured table.

## Task Commits

1. **Task 1: Classify a missing ref on a url add as source missing, test-first (D-16)**: `42fdef4a` (fix)
2. **Task 2: Pin the url update failures (UPD-11, D-05, D-08)**: `70a5a09f` (test)

**Plan metadata:** the `docs(planning)` commit that carries this SUMMARY and `09-06-RED.json`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts`: the `isRemoteNotFound` predicate and the `source missing` arm in `classifyGitSourceAccessFailure`, with its JSDoc extended.
- `tests/shared/git-failure-classifiers.test.ts`: one source-access row and one transport-ladder row for `NotFoundError`.
- `tests/orchestrators/marketplace/add.test.ts`: a `refNotFoundError` helper and the standalone and orchestrated ADD-09 missing-ref cases (whole notifications array, whole outcome).
- `features/marketplace/url-source.feature`: the missing-ref scenario.
- `features/marketplace/url-source-update.feature`: the new feature (Outline with 4 rows, plus the bare-update drop scenario).
- `docs/output-catalog.md`: the `add-source-missing` trigger paragraph.
- `CHANGELOG.md`: one `[Unreleased]` bullet.
- `.planning/phases/09-url-source-kind-and-https-git-stand-in/09-06-RED.json`: the RED record.

## Verification

| Command | Exit | Result |
|---------|------|--------|
| RED run of the missing-ref scenario (pre-fix) | 1 | 1 scenario failed on the fields table (intended) |
| `node --test tests/shared/git-failure-classifiers.test.ts tests/orchestrators/marketplace/add.test.ts` (pre-fix) | 1 | 167 pass, 3 fail (intended) |
| `node --test tests/shared/git-failure-classifiers.test.ts tests/orchestrators/marketplace/add.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | 0 | 174 pass, 0 fail |
| `npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1` | 0 | 10 scenarios (10 passed) |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` | 0 | no shortfall reported (100%) |
| commit hook for `42fdef4a` (`npm run check:commit`) | 0 | Passed |
| `npm run test:cucumber -- features/marketplace/url-source-update.feature --parallel 1` | 0 | 5 scenarios (5 passed) |
| `npm run test:cucumber` | 0 | 330 scenarios (330 passed), 2999 steps |
| `npm run check:features` | 0 | no "Feature gate failed" |

Acceptance greps: `acme/tools.git#stable` appears 2 times in url-source.feature. `NotFoundError` appears 2 times in the classifier. `git diff 72cb280f` changes no line in `classifyGitTransportFailure`. `#ref` appears 1 time in the catalog. `socket hang up` appears 1 time and the status rows 4 times in url-source-update.feature. `git status` was clean for each task's paths after its commit.

The combined-tree `npm run check` runs after this wave (orchestrator).

## Flagged assumptions

- 09-RESEARCH.md A2: `socket hang up` and the reason phrases come from the worker's Node. They were measured identical on Node 22 and 26, and are assumed the same on Node 24 (CI). This run used Node v26.11.1.
- D-16 side effect: an orchestrated missing-ref add (reconcile, import) now returns `source missing` instead of `unparseable`. This follows from the typed result. The CHANGELOG bullet states it.

## Decisions Made

- `source missing` fits D-16 without a new token, so the plan ran without the D-16 checkpoint (see key-decisions).
- The predicate matches `code === "NotFoundError"` only, as T-09-14 requires. It does not also test `name`, which `orchestrators/marketplace/shared.ts` uses for its stored-ref check, so the arm stays as narrow as the plan states.

## Deviations from Plan

**1. [Wording] The CHANGELOG bullet names the orchestrated side effect**
- **Found during:** Task 1
- **Issue:** The plan's bullet named only the standalone change (`Command failed unexpectedly.` becomes `{source missing}`). The orchestrator's repo rules ask the SUMMARY and the CHANGELOG to state the reconcile and import side effect.
- **Fix:** The same single sentence ends with `, or `{unparseable}` during a reload or an import.`. It is 33 words, one sentence, still one bullet.
- **Files modified:** `CHANGELOG.md`
- **Committed in:** `42fdef4a`

**2. [Safety] The new add cases run under `createHermeticEnvironment`**
- **Found during:** Task 1
- **Issue:** The D-76-09 analog runs without a hermetic home. The repo rules require one for any case that can reach user scope.
- **Fix:** Both new ADD-09 cases call `createHermeticEnvironment(t, ...)`, like the ADD-10 cases.
- **Committed in:** `42fdef4a`

**Total deviations:** 2 minor (wording, safety). **Impact:** no scope change. The behavior and assertions are as planned.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-07 (refused forms, re-add, empty logs) can start. The url add, update, and failure arms are pinned.
- No blockers.

## Self-Check: PASSED

- FOUND: features/marketplace/url-source-update.feature, 09-06-RED.json, git-failure-classifiers.ts
- FOUND: commits 42fdef4a, 70a5a09f on HEAD; no temporary RED copy left
