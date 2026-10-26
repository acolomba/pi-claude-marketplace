---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "08"
subsystem: testing
tags: [cucumber, url-source, git-http-backend, layer-07, phase-gate]

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: the https git host stand-in (09-01..09-04) and every @url row of the verb phases and of plans 09-05..09-07
provides:
  - cucumber.json runs `not @github`, so all 39 @url scenarios run in every default run and in npm run check
  - 09-08-RED.json, the SC6 behavioral RED evidence for the three LAYER-07 user-scope remove Outlines
  - the phase gate record (npm run check green on the final tree, two more random-order runs green)
affects: [phase-10-github-source]

actuals:
  tokens: 7400
  tasks: 3
  commits: 1

plan_head_before: ec2562905e827df5c9bee40fda50a37efb46ffe8
plan_head_after: 63d0592455652eef7828fc5eada79ad71f33d8d0

tech-stack:
  added: []
  patterns:
    - "A tag-gated source kind is switched on by deleting its tag from the cucumber.json exclusion, with no feature-file edit"

key-files:
  created:
    - .planning/phases/09-url-source-kind-and-https-git-stand-in/09-08-RED.json
  modified:
    - cucumber.json
    - .agents/skills/cucumber/rules/features.md
    - scripts/check-features.mjs

key-decisions:
  - "The feature gate's header names 'the profile's tag exclusion' instead of quoting today's tags, so the comment stays true when Phase 10 removes @github"
  - "The f78907bf plant now loads but crashes in the Given install with an internal error; that is still not behavioral RED, so the SC6 evidence uses the equivalent local edit in resolveTargetScopeMarketplace"

patterns-established: []

requirements-completed: [HOST-01, HOST-02, ADD-12, RM-09, LS-05, INFO-07]

coverage:
  - id: D1
    description: "cucumber.json excludes only @github; the default run executes 373 scenarios (334 untagged plus 39 @url), all passing"
    requirement: HOST-01
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (373 scenarios, 373 passed)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber -- --tags @url (39 scenarios, 39 passed)"
        status: pass
      - kind: other
        ref: "npm run check:features"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three LAYER-07 user-scope remove Outlines' @url rows fail at Then the result has these fields: when a project install copies the user-scope record, and pass on the current code"
    requirement: RM-09
    verification:
      - kind: other
        ref: ".planning/phases/09-url-source-kind-and-https-git-stand-in/09-08-RED.json (exit 1, 3 failed, 3 passed; RED_EVIDENCE_OK x3)"
        status: pass
      - kind: e2e
        ref: "npm run test:cucumber -- features/marketplace/remove.feature features/plugin/cross-scope-install.feature --parallel 1 --tags @url (6 scenarios, 6 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The per-scenario git host reset holds across every row with url rows in the same workers"
    requirement: HOST-02
    verification:
      - kind: e2e
        ref: "npm run test:cucumber x2 more, random order (seeds 683096 and 304198), 373 passed each"
        status: pass
      - kind: other
        ref: "npm run check (exit 0, cucumber seed 80242, 373 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The url rows pass on CI's ubuntu-latest (OpenSSL 3.0.13, Node 24, git http-backend path)"
    requirement: HOST-01
    human_judgment: true
    rationale: "Proven only when the branch is pushed and the PR's behavioral tests job runs (09-RESEARCH.md A1, A2, A4)"

duration: 8min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 08: Run Every Url Row and Close the Phase Summary

**The default cucumber profile now excludes only `@github`, so all 39 url rows run beside the 334 untagged scenarios (373 of 373 pass). The three LAYER-07 user-scope remove rows are shown failing on behavior when a project install copies the user-scope record, and `npm run check` is green on the final tree.**

## Performance

- **Duration:** 8 min (execution)
- **Started:** 2026-10-21T04:48:49Z
- **Completed:** 2026-10-21T04:57Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)
- **Tools:** Node v26.11.1, git version 2.55.0, OpenSSL 4.0.3 (29 Sep 2026)

## Accomplishments

- `cucumber.json`: `"tags": "not @url and not @github"` became `"tags": "not @github"`. That one line turns on every `@url` Examples block: add, info, remove, list through re-add, update with fetch, autoupdate, the cross-scope install, the url-source rows, and the git-source rows.
- `.agents/skills/cucumber/rules/features.md`: the exclusion paragraph now says `cucumber.json` runs `not @github` until the github kind has its stand-in, that the run's https git host runs every `@url` row, and that removing a tag turns on every row of that kind with no feature-file edit.
- `scripts/check-features.mjs`: the header comment says "the profile's tag exclusion" instead of quoting the tags.
- SC6 (D-15): `09-08-RED.json` records the failing run on the local edit, and the GREEN run after the restore.

## Task Commits

1. **Task 1: Remove @url from the exclusion and run every url row (SC5, D-14)**: `63d05924` (test)
2. **Task 2: Show the LAYER-07 remove rows red on reused records and green on the current code (SC6, D-15)**: no code commit. The local edit was never staged. `09-08-RED.json` lands in the plan metadata commit.
3. **Task 3: Run the phase gate**: no code commit. The record is this SUMMARY.

**Plan metadata:** the `docs(planning)` commit that carries this SUMMARY, `09-08-RED.json`, STATE.md, and ROADMAP.md.

## SC6 Evidence (D-15)

1. **Plant tried first.** `install-outcome.ts`, `plugin/shared.ts`, and `plugin/install-flow.ts` were written from `f78907bf`, and the remove row "keeps the plugins the project installed from it" was run. The research measured an import failure (`does not provide an export named 'MarketplaceDeclaredLocallyError'`). Today the planted files load, but the `Given the user has run "/claude:plugin install demo@tools --scope project"` step fails with an `internal-error` cascade: `The "path" argument must be of type string. Received undefined`. The scenario never reaches its assertions, so this is not behavioral RED (09-RESEARCH.md Pitfall 6). It licenses the equivalent local edit. The three files were restored with `git checkout --`, and `git diff --quiet -- extensions` exited 0.
2. **Local edit.** At the end of `resolveTargetScopeMarketplace`, the `return addTargetScopeMarketplace(...)` became `void marketplaceAdd;`, a `copy` of `source.sourceRecord` with `scope: opts.scope` and `plugins: {}`, `setOwn(state.marketplaces, marketplace, copy);`, and `return copy;`. The diff is in `09-08-RED.json` and touches only that function.
3. **RED run** (`--parallel 1 --tags @url` over `remove.feature` and `cross-scope-install.feature`): exit 1, 6 scenarios (3 passed, 3 failed). Each of these fails at `Then the result has these fields:`, after every `Given` and `When` passed:
   - `remove.feature:685` "…keeps the plugins the project installed from it": severity `error`, tally failures `1`, summary `A marketplace operation has failed.`
   - `remove.feature:725` "…keeps the info of a plugin the project installed from it": plugin status `failed`, reasons `source missing`, summary `A plugin operation has failed.`
   - `remove.feature:757` "…keeps the marketplace updatable in the project scope": severity `error`, summary `Some operations have failed.`
   These pass: the empty-remove Outline's two `@url` rows and the cross-scope install Outline's `@url` row.
4. **Classifier.** `gsd-tools check tdd-red-evidence` printed `RED_EVIDENCE_OK` for each of the three testcase names. Each name was checked from its own temporary copy in the phase directory, and each copy was deleted. The tool refuses a record path outside the project, so the copies could not live in the scratchpad.
5. **Restore and GREEN.** `git checkout -- extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`. `git diff --quiet -- extensions` exited 0. The same command reports 6 scenarios (6 passed). `git log -3 -- extensions/pi-claude-marketplace/orchestrators/plugin/` shows no commit from this plan.

## Verification

| Command | Exit | Result |
|---------|------|--------|
| `npm run test:cucumber` (Task 1) | 0 | 373 scenarios (373 passed), 3413 steps |
| `npm run test:cucumber -- --tags @url` | 0 | 39 scenarios (39 passed), 390 steps |
| `npm run check:features` | 0 | no "Feature gate failed" |
| commit hook for `63d05924` (`npm run check:commit`) | 0 | Passed |
| plant run (`remove.feature --parallel 1 --tags @url --name 'keeps the plugins the project installed'`) | 1 | internal error in the Given install, see SC6 step 1 |
| RED run on the local edit | 1 | 6 scenarios (3 passed, 3 failed) |
| GREEN run on the restored code | 0 | 6 scenarios (6 passed), 59 steps |
| `npm run check` on `63d05924` (phase gate) | 0 | every static step passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features); unpaired, integration, cucumber (seed 80242, 373 passed), and direct coverage (280 records) passed |
| `npm run test:cucumber` random run 1 | 0 | seed 683096, 373 scenarios (373 passed) |
| `npm run test:cucumber` random run 2 | 0 | seed 304198, 373 scenarios (373 passed) |

The gate ran on commit `63d05924`. After it, the only changes are planning files (`09-08-RED.json`, this SUMMARY, STATE.md, ROADMAP.md), which are not build inputs.

## Phase 10 Hand-off

- **Refused GitHub forms that do not run yet (ADD-08, SC4).** The `@github` block of `features/marketplace/unsupported-source.feature` holds four typed forms: `https://github.com/acme/tools/tree/main`, `https://github.com/acme`, the bare word `tools`, and the `a/b/c` form `acme/tools/extra`. Today `cucumber.json` excludes them, so only `check:features` dry-runs them. They become meaningful once Phase 10's GitHub base override sends a regression in them to the git host instead of github.com.
- **git-source `@github` blocks.** Each of the four Outlines of `features/marketplace/git-source.feature` (re-add, list, info, and remove) has an `@github` block with two rows, project and user. They assume that the override serves a GitHub repository at `/acme/tools.git` with no path prefix. The re-add Outline keeps that path in a `repository path` column.
- **The info Outline's `@github` row** (`features/marketplace/info.feature:44`) still types `acme/tools#stable`. Under the stand-in, a missing `stable` ref meets the missing-ref classification, so Phase 10 must publish that ref or change the row.
- **Open CI assumptions** (09-RESEARCH.md): A1 (the openssl command works on CI's OpenSSL 3.0.13; local is 4.0.3), A2 (Node 24 gives the same `socket hang up` and status phrases; local is Node 26), and A4 (`git http-backend` is reachable on ubuntu-latest). Only the PR's `behavioral tests` job proves them.
- **BACKLOG `ROWID-01`:** marketplace-level failure rows carry a plugin-shaped JSON id (`<mp>@<mp>`). The scenarios pin the current value.
- **WINDOWS entries:** entry 98 (`[marketplace-features]` refusal-row id) was waived in this phase, and its reason names `ROWID-01`. Entry 100 (`[marketplace-features]` add-authentication-required catalog state vs the measured bare 401 row) was added in this phase and is open.

## Flagged assumptions

- 09-RESEARCH.md A1, A2, and A4 remain open until CI runs (see the hand-off).

## Decisions Made

- See key-decisions: the gate header names the exclusion without its tags, and the SC6 evidence uses the local edit because the plant crashes before the behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan inaccuracy] `grep -c 'not @url'` on `scripts/check-features.mjs` prints 1, not 0**
- **Found during:** Task 1
- **Issue:** The acceptance criterion assumed one match at HEAD. There were two: the header comment (line 15) and the gate's own error message at line 338, `tag ${tag.name} on an Examples block is not @url or @github`. That message is a gate finding text, not the exclusion.
- **Fix:** Only the header comment changed, as the action asks. The error message stays, because changing it is outside the task. The criterion's intent holds: no text in the three files quotes the old exclusion. `cucumber.json` and `features.md` print 0.
- **Files modified:** none beyond the plan
- **Commit:** `63d05924`

**2. [Rule 3 - Blocking] The plant no longer fails at import**
- **Found during:** Task 2, step 1
- **Issue:** The plan expected the `f78907bf` plant to fail at load. It now loads and fails in the `Given` install step with an internal error (`The "path" argument must be of type string. Received undefined`).
- **Fix:** Recorded the actual failure in `plantedFrom`. Like a load failure, it never reaches the behavior, so it still licenses the equivalent local edit.
- **Files modified:** `09-08-RED.json` (record only)

**3. [Rule 3 - Blocking] The RED classifier refuses scratchpad paths**
- **Found during:** Task 2, step 4
- **Issue:** `gsd-tools check tdd-red-evidence` exits with "path escapes its allowed directory" for a record copy in the scratchpad.
- **Fix:** Wrote each temporary copy in the phase directory, as the plan says, and deleted it after the check. No copy remains.

**Total deviations:** 3 (1 plan-count inaccuracy, 2 blocking measurement changes). **Impact:** none on the delivered behavior. The evidence matches the plan's expected RED shape exactly.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase complete, ready for verification. Every url row runs by default. Phase 10 removes `@github` once the github kind has its stand-in (see the hand-off).
- No blockers.

## Self-Check: PASSED

- FOUND: cucumber.json (`"tags": "not @github"`), .agents/skills/cucumber/rules/features.md, scripts/check-features.mjs, .planning/phases/09-url-source-kind-and-https-git-stand-in/09-08-RED.json
- FOUND: commit 63d05924 on HEAD
- `git diff --quiet -- extensions` exits 0; no `09-08-red-copy-*` file in the phase directory
