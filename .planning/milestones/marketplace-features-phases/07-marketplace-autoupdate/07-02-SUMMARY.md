---
phase: 07-marketplace-autoupdate
plan: "02"
subsystem: testing
tags: [cucumber, marketplace, autoupdate, config-layers, tdd]

requires:
  - phase: 07-marketplace-autoupdate
    provides: 07-01's scopeless unscoped miss, the autoupdate.feature scenarios, and the RED record format for this phase
  - phase: 06-marketplace-update-and-c-10-fix
    provides: the test-first RED evidence format (06-01-RED.json)
provides:
  - A local-config entry without an autoupdate value is judged by the value it inherits (D-02), in named and nameless flips, with and without --local
  - A named --local flip writes a local value only when it changes the value that applies (D-03)
  - A nameless flip without --local writes the base config and leaves a valueless local entry to inherit it (D-04)
  - A lazy fail-closed base read; an invalid base fails a flip only when a valueless local entry needs it, and --local never writes the base (D-05, unit-proven)
  - Scenarios for D-03a/b/c, the rewritten D-04 scenario, and two explicit-value pins
  - 07-02-RED.json, the failing run of the four scenarios on the code before the fix
affects: [07-03, 07-04, output-catalog, readme, changelog]

actuals:
  tokens: 9450
  tasks: 2
  commits: 2
plan_head_before: a3c371982140b75b0fd9e61a82f4ef12ee5926de
plan_head_after: 8e9a8cccc34dc575696e353fae90d3115c74c236

tech-stack:
  added: []
  patterns:
    - "Inherited value as a lazily called closure (`InheritedValue`): the base config is read once, and an invalid read throws only when a valueless local entry calls it"
    - "RED evidence for several plain scenarios: one JUnit run, a `targets` array, and one classifier record per target"

key-files:
  created:
    - .planning/phases/07-marketplace-autoupdate/07-02-RED.json
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts
    - features/marketplace/autoupdate.feature
    - tests/orchestrators/marketplace/autoupdate.test.ts
    - tests/integration/marketplace-layer-autoupdate.test.ts
    - tests/edge/handlers/marketplace/autoupdate.test.ts

key-decisions:
  - "Every flip that can target a local entry reads the base config once with loadConfig; the flip fails with the CFG-03 invalid-manifest row only when a valueless local entry asks for the inherited value, so a --local flip over local entries that all carry values still succeeds over a broken base."
  - "A base-target named flip passes inheritFrom({ status: \"absent\" }); the closure is never called because a base layer never inherits."
  - "planEveryFlip delegates to a module-private everyFlipLayers helper that returns { layers, inherited } per form, keeping both complexity gates green."

patterns-established:
  - "A lazy InheritedValue closure keeps a fail-closed read from failing callers that do not need its value."

requirements-completed: [AU-02, AU-03, AU-06]

coverage:
  - id: D1
    description: "A named --local flip of a local entry without a value reports already when the inherited value matches, writes nothing, and writes an explicit false only over a base that is on"
    requirement: AU-02
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Disabling autoupdate with --local on a marketplace only the local layer declares skips it as already no autoupdate"
        status: pass
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Disabling autoupdate with --local skips a local entry without a value while the base layer has it off"
        status: pass
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate with --local skips a local entry without a value while the base layer has it on"
        status: pass
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Disabling autoupdate with --local writes the setting to the local config only"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#LAYER-02: a named --local disable of a local entry without a value inherits off from a base config that does not declare it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#LAYER-02: a named --local disable of a local entry without a value and no base config reports already no autoupdate"
        status: pass
    human_judgment: false
  - id: D2
    description: "A nameless flip without --local writes the base config and leaves a valueless local entry to inherit it, with one row per marketplace per scope"
    requirement: AU-06
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate for every marketplace sets the base config and leaves a local entry without a value to inherit it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#D-06: an unnamed flip sets the base value and leaves a local entry without a value to inherit it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#D-MF-03: an unnamed disable writes the base entry and leaves a local entry without a value to inherit it"
        status: pass
      - kind: integration
        ref: "tests/integration/marketplace-layer-autoupdate.test.ts#D-07: the list reads the base value a local entry without one inherits, then the local override"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/autoupdate.test.ts#flips every marketplace in both scopes when no scope flag narrows the command"
        status: pass
    human_judgment: false
  - id: D3
    description: "A local entry with its own value is judged and written by that value, for named --local and nameless flips"
    requirement: AU-03
    verification:
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate with --local writes a local entry that has it off while the base layer has it on"
        status: pass
      - kind: e2e
        ref: "features/marketplace/autoupdate.feature#Enabling autoupdate for every marketplace writes a local entry that has it off"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#D-07: an unnamed enable over a base value that is on writes a local entry whose own value is off"
        status: pass
    human_judgment: false
  - id: D4
    description: "An invalid base config fails a named or nameless --local flip of a valueless local entry with the CFG-03 row and writes nothing; a local entry with a value still flips and the base keeps its bytes"
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#CFG-03: a named --local flip that needs the value of an invalid base config fails and writes nothing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#CFG-03: an unnamed --local flip that needs the value of an invalid base config fails and writes nothing"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#CFG-03: a named --local flip of a local entry with a value ignores an invalid base config"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/autoupdate.test.ts#CFG-03: an unnamed --local flip of a local entry with a value ignores an invalid base config"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-20
status: complete
---

# Phase 7 Plan 02: Inherited autoupdate value for a local entry Summary

**A local-config marketplace entry without an `autoupdate` value is now judged by the value it inherits from the base config (`inheritFrom` / `inheritAfterFlip` closures in `autoupdate.ts`), so a flip writes a local value only when it changes the effective value, and an unreadable base fails closed only when that inherited value is needed; proven red-then-green through the real Pi.**

## Performance

- **Duration:** about 11 min
- **Started:** 2026-10-20T04:07:17Z
- **Completed:** 2026-10-20T04:18:34Z
- **Tasks:** 2
- **Files modified:** 5, plus the new 07-02-RED.json

## Accomplishments

- D-02 / D-03: a named `--local` flip compares a valueless local entry with the base entry's value, or off when the base does not declare it or has no value (MAU-4). `noautoupdate tools --scope project --local` after a local-only add, or over a base that is off, reports `skipped` / `already no autoupdate` and writes nothing; `autoupdate ... --local` over a base that is on reports `already autoupdate`; `noautoupdate ... --local` over a base that is on still writes an explicit local `false`.
- D-04: a nameless flip without `--local` writes the base config and leaves a valueless local entry unwritten, because it inherits the new base value. A local entry whose own value differs is still written, and a local-only valueless entry inherits off, so an enable writes it.
- D-05: the base config is read once with `loadConfig`. An invalid base fails a named or nameless `--local` flip only when a valueless local entry asks, with the CFG-03 row `Config file "claude-plugins.json" failed schema validation.`; a `--local` flip never writes the base. `requireTargetDeclares` is synchronous and takes the other layer's `ConfigLoadResult`.
- AU-06 adjacency: in a nameless flip a marketplace both layers of a scope declare still gets one row.
- Every test that pinned the old always-writes rule now states the inherited rule: 11 owner cases, the layer integration case, and the edge handler's bare and `--scope` footprints.

## Task Commits

1. **Task 1: Judge a valueless local entry by the value it inherits, end to end (D-02, D-03, D-04, D-05)** - `fc43090a` (fix). This is the commit that holds the inheritance fix; 07-03 plants its parent (`a3c37198`) to show the D-05 scenario's RED.
2. **Task 2: Pin that a local entry with its own value is judged and written by that value (D-03, D-04)** - `8e9a8ccc` (test)

**Plan metadata:** the `docs(planning)` commit that carries this SUMMARY and 07-02-RED.json.

## RED evidence (D-06)

- **Cucumber RED:** before any production edit, on base commit `a3c37198` (`autoupdate.ts` still held `!layer.local && !enable`), with only the feature file changed:
  `npm run --silent test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(<the four titles>)$' --format summary --format junit:<scratch>/07-02-red.xml`
  Exit 1, `4 scenarios (4 failed)`, `42 steps (32 passed, 6 skipped, 4 failed)`.
  - D-03a (local-only add, `noautoupdate --local`): failed at `the result lists these marketplaces:`; the diff is exactly `autoupdate disabled` in place of `skipped` / `already no autoupdate`.
  - D-03b (base off, valueless local, `noautoupdate --local`): same assertion, same diff.
  - D-03c (base on, valueless local, `autoupdate --local`): failed at the row step; the diff is exactly `autoupdate enabled` in place of `skipped` / `already autoupdate`.
  - D-04 (rewritten nameless both-layer scenario): every step passed up to the local-config table, which failed on exactly one extra `autoupdate` column holding `true`.
- **Classifier:** `gsd-tools check tdd-red-evidence` on one record per target over the same JUnit report returned `RED_EVIDENCE_OK target_test_failed` for each of the four; the verdicts are in the record's `classifierVerdicts`.
- **Semantic assessment:** each target ran and failed on the assertion its decision names, for the intended reason (a valueless local entry was always treated as stale), with no setup, load, or unrelated failure.
- **Unit RED:** with only the test expectations changed, `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/integration/marketplace-layer-autoupdate.test.ts tests/edge/handlers/marketplace/autoupdate.test.ts` reported `tests 94, pass 81, fail 13`. The 13 failures were exactly the cases that state the inherited rule:
  - edge: `flips every marketplace in both scopes when no scope flag narrows the command`, `flips the project scope alone when --scope project is supplied`, `flips the user scope alone when --scope user is supplied`
  - integration: `D-07: the list reads the base value a local entry without one inherits, then the local override`
  - owner: the three `LAYER-02: a named --local ... of a local entry without a value inherits ...` rows, `LAYER-02: ... and no base config reports already no autoupdate`, `D-06: an unnamed flip sets the base value and leaves a local entry without a value to inherit it`, `D-07: an unnamed enable over a base value that is on leaves a local entry without a value to inherit it`, `D-MF-03: an unnamed disable writes the base entry and leaves a local entry without a value to inherit it`, and both `CFG-03: ... --local flip that needs the value of an invalid base config fails and writes nothing` cases.
  - Passing before and after, as planned: the `writes an explicit off over a base entry that has it on` row, the reseeded D-06 write-failure case, `writes a local entry whose own value is off`, `D-MF-03: an unnamed enable writes a local entry the base config does not declare`, the reseeded D-09 `--local` case, and both `CFG-03: ... with a value ignores an invalid base config` cases.
- **GREEN:** after the fix the four scenarios report `4 scenarios (4 passed)` and the three test files 94/94.

## Verification

Node v26.11.1, branch `features/cucumber-behavioral-tests`, scope: the focused checks this plan names (the combined-tree `npm run check` belongs to 07-04).

| Command | Exit | Result | At |
|---|---|---|---|
| `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(<the four Task 1 titles>)$'` | 0 | 4 scenarios (4 passed) | `fc43090a` tree |
| `node --test tests/orchestrators/marketplace/autoupdate.test.ts tests/integration/marketplace-layer-autoupdate.test.ts tests/edge/handlers/marketplace/autoupdate.test.ts` | 0 | 94 tests, 0 fail | `fc43090a` tree |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | 0 | no shortfall line | `fc43090a` tree |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` | 0 | no shortfall line | `fc43090a` tree |
| `npm run test:cucumber` | 0 | 219 scenarios (219 passed), 2351 steps | `fc43090a` tree |
| `npm run test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^(<the two Task 2 titles>)$'` | 0 | 2 scenarios (2 passed) | `8e9a8ccc` tree |
| `npx cucumber-js features/marketplace/autoupdate.feature` | 0 | 22 scenarios (22 passed) | `8e9a8ccc` tree |
| `npm run check:features` | 0 | no `Feature gate failed` | both tasks |
| `npm run test:cucumber` | 0 | 221 scenarios (221 passed), 2375 steps | `8e9a8ccc` |
| `node --test tests/integration/marketplace-layer-autoupdate.test.ts` | 0 | 6 tests, 0 fail | `8e9a8ccc` |
| `npx fallow dupes --fail-on-issues` | 0 | no new clone group | `8e9a8ccc` |
| commit hook `npm run check:commit` | 0 | Passed on both commits | both |

Acceptance greps after Task 1: `function inheritFrom` 1, `function inheritAfterFlip` 1, `type InheritedValue` 1, `!layer.local && !enable` 0, `NEVER touched` 0, `sets it in each config that declares the marketplace` 0, each of the four Task 1 titles 1. After Task 2: both new titles 1 each. `git status --short` on each task's paths was empty after its commit.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` - `InheritedValue`, `inheritFrom`, `inheritAfterFlip`, and `everyFlipLayers`; `layerAlreadySet` and `planFlip` take `inherited`; `requireTargetDeclares` is synchronous over a `ConfigLoadResult`; `planNamedFlip` reads the other layer once; docs state the inherited rule and that `--local` never writes the base.
- `features/marketplace/autoupdate.feature` - the rewritten D-04 scenario, three D-03 scenarios, and two explicit-value pins.
- `tests/orchestrators/marketplace/autoupdate.test.ts` - the LAYER-02 inherited rows and the no-base case, the reseeded D-06 write-failure and D-09 `--local` cases, the retitled D-06 case, the new `baseOnUnnamedCases` row, two D-MF-03 cases, and four CFG-03 invalid-base cases.
- `tests/integration/marketplace-layer-autoupdate.test.ts` - the retitled D-07 case with `afterEnable.local` undefined.
- `tests/edge/handlers/marketplace/autoupdate.test.ts` - the bare and `--scope` footprints leave the local layers as seeded.
- `.planning/phases/07-marketplace-autoupdate/07-02-RED.json` - the failing run before the fix.

## Decisions Made

- The base config is read once per flip that can target a local entry, and the read fails the flip only when a valueless local entry calls the closure (D-05's "when the inherited value is needed").
- The four CFG-03 invalid-base cases are two data-row tests with a literal `title` per row, so each planned title stays greppable.
- `planEveryFlip` keeps its shape and delegates the per-form layer and inheritance choice to a module-private `everyFlipLayers` helper.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The tracer feedback gate ran in the interactive `end-of-phase` mode with an automated-only `<verify>`: every Task 1 verify command passed on the committed tree, so Task 2 proceeded without a checkpoint.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 07-03, which proves D-05 through the real Pi; it plants `a3c37198` (the parent of `fc43090a`) for its RED.
- The docs that still state the old rule (docs/output-catalog.md "Config files" paragraph, README.md and README.es.md, the CHANGELOG bullet) belong to a later plan of this phase.
- AU-02, AU-03, and AU-06 are shared with 07-03 or 07-04, so they stay open in REQUIREMENTS.md until those plans finish.

---
*Phase: 07-marketplace-autoupdate*
*Completed: 2026-10-20*

## Self-Check: PASSED

- FOUND: 07-02-RED.json, 07-02-SUMMARY.md, and the five modified files.
- FOUND: commits `fc43090a` and `8e9a8ccc` on `features/cucumber-behavioral-tests`.
