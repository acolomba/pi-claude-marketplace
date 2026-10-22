---
phase: 06-marketplace-update-and-c-10-fix
plan: "02"
subsystem: marketplace
tags: [marketplace-update, semantic-comparison, failure-recovery, cucumber]

requires:
  - phase: 06-marketplace-update-and-c-10-fix
    plan: "01"
    provides: Exact-source refresh and durable complete-manifest comparison baselines
provides:
  - Whole-result behavioral coverage for unchanged and changed marketplace manifests
  - Semantic comparison coverage for unknown fields, object order, and array order
  - Invalid and missing local-source recovery coverage through real Pi
  - Scenario-owned deletion and conventional-decoy fixtures
affects: [marketplace-update, manifest-loading, behavioral-tests, failure-recovery]

actuals:
  tokens: 17300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - Complete parsed JSON remains the comparison view while normalized data remains the resolver view
    - Failure scenarios verify the result before reading retained public state

key-files:
  created: []
  modified:
    - features/lib/published-marketplace.ts
    - features/marketplace/file-source-update.feature
    - features/marketplace/update.feature
    - features/step_definitions/marketplace/update.steps.ts
    - tests/domain/manifest.test.ts
    - tests/orchestrators/marketplace/update.test.ts

key-decisions:
  - "Use the bare marketplace update command for one-record behavioral checks because its plural result includes the required tally while the named form does not."
  - "Derive every destructive fixture target from the recorded PublishedMarketplace and reject filesystem-root or out-of-root targets."
  - "Assert a prior failed refresh inside Given for the repair scenario so all setup remains before the action under test."

patterns-established:
  - "Semantic update fixtures carry explicit baseline and refreshed JSON strings; expected status never comes from the production comparator."
  - "Negative-cache repair fixtures always change byte length and retry in the same Pi process."

requirements-completed: [UPD-01, UPD-02, UPD-10, UPD-14]

coverage:
  - id: D1
    description: "Unchanged and formatting-only manifests stay up to date across local source kinds."
    requirement: UPD-01
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#An unchanged marketplace is up to date"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#Whitespace and object key order do not change a marketplace"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#semantic comparison ignores object key order"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changed complete-manifest data, including unknown fields and array order, reports an update with no plugin rows when autoupdate is off."
    requirement: UPD-02
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A changed marketplace refreshes without plugin rows"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#An unknown manifest field changes the marketplace"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#Reordering a manifest array changes the marketplace"
        status: pass
      - kind: unit
        ref: "tests/domain/manifest.test.ts#retains changed comparison fields from an isolated dependency entry"
        status: pass
    human_judgment: false
  - id: D3
    description: "Malformed and schema-invalid refreshes retain registration, plugin state, config, and baseline, then recover without restarting Pi."
    requirement: UPD-10
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#An invalid refreshed manifest leaves installed plugins unchanged"
        status: pass
      - kind: e2e
        ref: "features/marketplace/update.feature#A repaired marketplace can be updated again"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#keeps durable update state until a repaired retry succeeds"
        status: pass
    human_judgment: false
  - id: D4
    description: "Missing directories and exact external files report source missing while retaining registration and rejecting a conventional decoy."
    requirement: UPD-14
    verification:
      - kind: e2e
        ref: "features/marketplace/update.feature#A missing marketplace directory leaves its registration intact"
        status: pass
      - kind: e2e
        ref: "features/marketplace/file-source-update.feature#A missing original manifest does not use a conventional decoy"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/update.test.ts#a missing local source keeps its registration, baseline, config, and plugins"
        status: pass
    human_judgment: false

duration: 50 min
completed: 2026-10-18
status: complete
---

# Phase 6 Plan 02: Semantic Change and Failure Recovery Summary

**Marketplace refresh now has real-Pi coverage for structural equality, complete-manifest changes, fail-clean local-source errors, and same-process repair.**

## Performance

- **Duration:** 50 min
- **Started:** 2026-10-18T20:24:00-04:00
- **Completed:** 2026-10-18T21:13:05-04:00
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Added complete update envelopes and rows for unchanged, changed, formatting-only, unknown-field, and array-order behavior through the public command.
- Proved dependency normalization does not erase comparison-only fields and that production reads leave source bytes untouched.
- Added malformed, schema-invalid, missing-directory, exact-file-decoy, and repair scenarios that preserve registration, configuration, installed versions, enabled state, and the prior successful baseline.
- Added guarded fixture helpers that remove only a recorded scenario publication or its exact manifest.

## Task Commits

Each task was committed atomically:

1. **Task 1: Distinguish unchanged and changed manifests through the public command** - `16f8e833` (test)
2. **Task 2: Preserve unknown fields and array order in semantic comparison** - `06dd4ca4` (test)
3. **Task 3: Keep invalid and missing sources registered and repairable** - `90505060` (test)

**Plan metadata:** this commit (docs)

## Flagged assumptions from the spec-less probe

- `UPD-01 / unclassified / unresolved`: The named unchanged-content whole-result scenario is the manual-review target; no unseen edge is claimed resolved.
- `UPD-02 / unclassified / unresolved`: The changed-content/no-plugin-row scenario is the manual-review target; the probe remains explicitly unclassified.
- `UPD-10 / unclassified / unresolved`: Malformed JSON, invalid schema, and repair cover the stated contract; the probe's additional unspecified edge remains flagged.
- `UPD-14 / unclassified / unresolved`: Owned-directory loss and retained registration cover the stated contract; the probe's unspecified edge remains flagged.

## Checks run

- Task 1 focused Cucumber command passed: 10 scenarios and 84 steps.
- Task 2 focused Cucumber command passed: 7 scenarios and 63 steps.
- Task 3 focused Cucumber command passed: 7 scenarios and 89 steps.
- Marketplace manifest and update owner suites passed.
- Direct coverage for `extensions/pi-claude-marketplace/domain/manifest.ts` and `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` passed at 100%.
- `npm run check:features` passed with remote update examples bound and excluded by their source-kind tags.
- Required Fallow audits passed with no findings before every task commit.
- Full `npm run check` passed, including 173 scenarios, 1,802 steps, and 280 direct-coverage records.

## Decisions Made

- Used the bare marketplace update form in one-record scenarios because the plural form exposes the tally required by the whole-result contract.
- Kept resolver normalization and semantic comparison independent: invalid dependency entries can normalize to the same resolver data while their original fields still trigger an update.
- Limited fixture deletion to paths derived from each scenario's recorded publication and checked those paths before removal.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first semantic-data commit attempt repeated a legacy internal sentinel literal that a vocabulary guard permits only once. The existing owner test already pinned that literal, so the new test now compares the two resolver views directly.
- The first failure-recovery commit attempt found one missing lint-required blank line. The line was added and the full hook passed on retry.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 06-03 can build autoupdate cascade coverage on the now-pinned semantic refresh and fail-clean baseline behavior.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- All three task commits descend from the recorded plan head `a1531d81`.
- Every named behavioral scenario, owner suite, direct-coverage pair, feature check, and the combined repository gate passed.
- No package, production source, network behavior, or out-of-scope filesystem target was added.

---

*Phase: 06-marketplace-update-and-c-10-fix*
*Completed: 2026-10-18*
