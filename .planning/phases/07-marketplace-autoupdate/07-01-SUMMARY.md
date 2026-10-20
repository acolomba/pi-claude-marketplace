---
phase: 07-marketplace-autoupdate
plan: "01"
subsystem: testing
tags: [cucumber, marketplace, autoupdate, notification, catalog]

requires:
  - phase: 03.2-marketplace-layer-partition
    provides: the layer rules for autoupdate flips and the existing autoupdate.feature scenarios
  - phase: 06-marketplace-update-and-c-10-fix
    provides: the test-first RED evidence format (06-01-RED.json)
provides:
  - An unscoped autoupdate or noautoupdate miss reports marketplace-not-added with no scope (D-08, AU-08)
  - Behavioral scenarios for AU-08, the D-07 scoped misses, and the AU-07 empty nameless result
  - Unit cases for the scoped miss in both directions and a nameless flip over one empty scope (AU-06)
  - The catalog S2 block, its fixture, the byte total, and the cross-op bare-form matrix in the scopeless form
  - 07-01-RED.json, the failing run of the AU-08 Outline before the fix
affects: [07-02, 07-03, 07-04, json-output, output-catalog]

actuals:
  tokens: 6600
  tasks: 2
  commits: 2
plan_head_before: c06547fa5edbf45645a658dfed933ea23c7ca779
plan_head_after: f377b98a65e67fc84f2bafebc88c1b0438aa1056

tech-stack:
  added: []
  patterns:
    - "Optional message field through the house conditional spread: ...(opts.scope !== undefined && { scope: opts.scope })"
    - "RED evidence for a cucumber Outline: one JUnit run, classified per example name (` - #1.N`)"

key-files:
  created:
    - .planning/phases/07-marketplace-autoupdate/07-01-RED.json
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - features/marketplace/autoupdate.feature
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/architecture/cross-op-convergence.test.ts
    - tests/architecture/catalog-uat/fixtures/marketplace-autoupdate.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - docs/output-catalog.md

key-decisions:
  - "D-08 landed: notifyNamedMiss sets scope on the not-added message only when --scope was given; the refusal branch is unchanged."
  - "autoupdate joins OPS_BARE in the cross-op convergence matrix; install is the only op without a bracketless bare form."
  - "The catalog byte total drops from 46_633 to 46_623, the 10 bytes of `[project] ` in the S2 block."

patterns-established:
  - "An Outline RED run is recorded once; gsd-tools tdd-red-evidence matches each example by its JUnit name with the ` - #1.N` suffix, so the per-example verdicts are stored beside the Outline-level record."

requirements-completed: [AU-07, AU-08]

coverage:
  - id: D1
    description: "An unscoped autoupdate or noautoupdate of a name neither scope holds fails as marketplace-not-added with no scope, through the real Pi, for both verbs and the non-ASCII name 工具"
    requirement: AU-08
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#A flip of a marketplace neither scope holds fails as not added without a scope"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#AU-08: reports a named marketplace absent from both implicit scopes"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#SCOPE-01: an unscoped flip both scopes miss names no scope, even when one scope records the marketplace"
        status: pass
    human_judgment: false
  - id: D2
    description: "The catalog S2 block, its fixture, the byte total, and the cross-op bare-form matrix carry the scopeless form"
    requirement: AU-08
    verification:
      - kind: unit
        ref: "node --test tests/architecture/cross-op-convergence.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "A --scope that does not hold the marketplace fails as not added to that scope, for both verbs in both directions, and changes no config"
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#A flip with a scope that does not hold the marketplace reports it not added to that scope"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#SCOPE-01: a flip with --scope user while only the project scope records the marketplace reports it not added to the user scope"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#SCOPE-01: a flip with --scope project while only the user scope records the marketplace reports it not added to the project scope"
        status: pass
    human_judgment: false
  - id: D4
    description: "A nameless flip with nothing added reports an empty cascade and creates no config; a nameless flip over one empty scope reports only the populated scope"
    requirement: AU-07
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate for every marketplace with none added reports an empty result"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#AU-06: an unscoped unnamed flip reports only the scope that holds a marketplace and creates nothing in the other"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-20
status: complete
---

# Phase 7 Plan 01: Unscoped autoupdate miss without a scope Summary

**`notifyNamedMiss` now omits the scope on an unscoped autoupdate/noautoupdate miss, proven red-then-green through the real Pi, with the catalog S2 block, its fixture, the byte total (46_623), and the cross-op bare-form matrix moved in the same commit, plus pinned D-07 scoped misses and the AU-07 empty result.**

## Performance

- **Duration:** about 10 min
- **Started:** 2026-10-20T03:52:29Z
- **Completed:** 2026-10-20T04:02:20Z
- **Tasks:** 2
- **Files modified:** 7, plus the new 07-01-RED.json

## Accomplishments

- D-08 / AU-08: an unscoped `marketplace autoupdate <name>` or `noautoupdate <name>` for a name neither scope holds emits one `marketplace-not-added` payload with the typed name, the reason `marketplace not added`, and no `scope` field (`⊘ <name> (failed) {marketplace not added}`), as `remove`, `info`, and `update` do. An explicit `--scope` miss keeps its scope, and a layer refusal is still reported as the first scope's refusal.
- The catalog S2 block and prose, the `autoupdate-missing-not-added-bare` fixture, `EXPECTED_UTF8_BYTES = 46_623`, and `OPS_BARE` (now with `autoupdate`) agree with the scopeless form.
- D-07: both verbs, both directions, `--scope` miss reports `marketplace not added to <scope> scope` with the requested scope, and the holding scope's base config is unchanged while the requested scope gains none.
- AU-07: a nameless flip with nothing added is an empty `cascade` at `info` with no tally and no config in either scope. AU-06 empty: a nameless unscoped flip over one populated and one empty scope reports only the populated scope and creates nothing in the other.

## Task Commits

1. **Task 1: Report an unscoped miss of both verbs without a scope, end to end (D-08, AU-08)** - `a7ff6db7` (fix)
2. **Task 2: Pin the scoped misses in both directions and the empty nameless result (D-07, AU-07, AU-06 empty)** - `f377b98a` (test)

**Plan metadata:** the `docs(planning)` commit that carries this SUMMARY and 07-01-RED.json.

## RED evidence (D-06)

- **Cucumber RED:** before any production edit, the AU-08 Outline ran on base commit `c06547fa` (`autoupdate.ts` still held `opts.scope ?? "project"`):
  `npm run --silent test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^A flip of a marketplace neither scope holds fails as not added without a scope$' --format summary --format junit:<scratch>/07-01-red.xml`
  Exit 1, `3 scenarios (3 failed)`, `24 steps (15 passed, 6 skipped, 3 failed)`. Every example (`autoupdate tools`, `noautoupdate tools`, `autoupdate 工具`) passed Pi startup and both Givens, then failed at `the result has these fields:` on exactly one extra `[scope, project]` row; every other field matched.
- **Classifier:** `gsd-tools check tdd-red-evidence` on the Outline-level record returns `INVALID_RED no_target_test_failure`, because cucumber names each Outline example `<title> - #1.N` in JUnit. Each example name submitted as the target returns `RED_EVIDENCE_OK target_test_failed`; the three verdicts are stored in the record's `classifierVerdicts`.
- **Semantic assessment:** the target scenario ran and failed on the planned assertion for the intended reason (the defaulted `project` scope), with no setup, load, or unrelated failure.
- **Unit RED:** with only the two expectations changed, `node --test tests/orchestrators/marketplace/autoupdate.test.ts` reported `tests 45, pass 43, fail 2`; the two failures were exactly `AU-08: reports a named marketplace absent from both implicit scopes` and `SCOPE-01: an unscoped flip both scopes miss names no scope, even when one scope records the marketplace`.
- **GREEN:** after the fix the Outline reports `3 scenarios (3 passed)` and the unit file 45/45.

## Verification

Node v26.11.1, branch `features/cucumber-behavioral-tests`, scope: the focused checks this plan names (the combined-tree `npm run check` belongs to 07-04).

| Command | Exit | Result | At |
|---|---|---|---|
| `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^A flip of a marketplace neither scope holds fails as not added without a scope$'` | 0 | 3 scenarios (3 passed) | `a7ff6db7` tree |
| `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/architecture/cross-op-convergence.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts` | 0 | 125 tests, 0 fail | `a7ff6db7` tree |
| `npx cucumber-js features/marketplace/autoupdate.feature` | 0 | 12 scenarios (12 passed) | `a7ff6db7` tree |
| `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(A flip with a scope ...|Enabling autoupdate for every marketplace with none added ...)$'` | 0 | 5 scenarios (5 passed) | `f377b98a` tree |
| `node --test tests/orchestrators/marketplace/autoupdate.test.ts` | 0 | 48 tests, 0 fail | `f377b98a` tree |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | 0 | no shortfall line | both tasks |
| `npm run check:features` | 0 | no `Feature gate failed` | both tasks |
| `npx fallow dupes --fail-on-issues` | 0 | no new clone group | `f377b98a` tree |
| `npm run test:cucumber` | 0 | 216 scenarios (216 passed), 2321 steps | `f377b98a` tree |
| `node --test tests/architecture/cross-op-convergence.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts` | 0 | 80 tests, 0 fail | `f377b98a` |
| commit hook `npm run check:commit` | 0 | Passed on both commits | both |

Acceptance greps after Task 1: the conditional spread 1, `opts.scope ?? "project"` 0, the bracketless S2 line 1, the `[project]` S2 line 0, `EXPECTED_UTF8_BYTES = 46_623` 1, `"autoupdate"` inside `OPS_BARE` 1. After Task 2: both new scenario titles 1 each, the AU-06 title 1, `marketplace not added to user scope` 1, `marketplace not added to project scope` 1.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` - `notifyNamedMiss` spreads `scope` only when `--scope` was given; JSDoc restated.
- `features/marketplace/autoupdate.feature` - the AU-08 Outline, the D-07 Outline, and the AU-07 scenario.
- `tests/orchestrators/marketplace/autoupdate.test.ts` - two retitled scopeless expectations, the AU-06 one-empty-scope case, and the two-row SCOPE-01 scoped-miss case.
- `tests/architecture/cross-op-convergence.test.ts` - `autoupdate` in `OPS_BARE`; header and `OPS_BARE` comments state that install alone has no bracketless bare form.
- `tests/architecture/catalog-uat/fixtures/marketplace-autoupdate.ts` - the S2 fixture message has no scope.
- `tests/architecture/catalog-uat/catalog-contract.test.ts` - `EXPECTED_UTF8_BYTES` is `46_623`.
- `docs/output-catalog.md` - the S2 prose and block are bracketless.
- `.planning/phases/07-marketplace-autoupdate/07-01-RED.json` - the failing run before the fix.

## Decisions Made

- The RED record keeps the Outline title as `targetTest` (the plan's target) and adds `reportPath`, `runStartedAt`, `reportModifiedAt`, and `classifierVerdicts` beside the 06-01 fields, so the per-example classifier result is on file.
- The D-07 unit case runs `enable: true` for both rows; the verb does not change the miss path, and the Outline covers both verbs end to end.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The TDD classifier cannot match an Outline title to cucumber's per-example JUnit names (` - #1.N`). Resolved by classifying each example name and recording the verdicts; no evidence was edited.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 07-02 (the inherited local value, D-02 to D-05), which repeats this red-then-green flow.
- AU-08 is shared with 07-03, so it stays open in REQUIREMENTS.md until 07-03 finishes.

---
*Phase: 07-marketplace-autoupdate*
*Completed: 2026-10-20*

## Self-Check: PASSED

- FOUND: 07-01-RED.json, 07-01-SUMMARY.md, and the seven modified files.
- FOUND: commits `a7ff6db7` and `f377b98a` on `features/cucumber-behavioral-tests`.
