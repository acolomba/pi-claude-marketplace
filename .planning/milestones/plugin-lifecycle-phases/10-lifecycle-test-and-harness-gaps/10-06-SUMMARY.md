---
phase: 10-lifecycle-test-and-harness-gaps
plan: "06"
subsystem: testing
tags: [cucumber, lifecycle, recovery, completion-cache, coverage-ledger]
requires:
  - phase: 10-lifecycle-test-and-harness-gaps
    plan: "02"
    provides: fail-closed Cucumber and completion harnesses
  - phase: 10-lifecycle-test-and-harness-gaps
    plan: "05"
    provides: aligned update failure diagnostics and raw cascade normalization
provides:
  - Discriminating command scenarios for the remaining update, enable, list, prune, apply, fetch, alias, and failed-add gaps
  - Byte-for-byte proof that a no-op apply leaves configuration and state unchanged
  - Owner proof that an already-added standalone marketplace does not invalidate completion caches
  - A classified TST-01 ledger for the four retained unit-only behaviors
affects: [phase-10-coverage-ledger, phase-10-verification, phase-11-install-flow-split]
actuals:
  tokens: 5690
  tasks: 3
  commits: 3
plan_head_before: 45d642099bfffb8751e93dea5485977e326e2e1d
plan_head_after: 07a8b54a00c7e9de717e546b7c96b2382eaa88f5
tech-stack:
  added: []
  patterns:
    - Complete Cucumber row and persisted-file assertions for every lifecycle transition
    - WeakMap-scoped byte snapshots that cannot leak between Cucumber worlds
    - Completion-cache recorders reused across one command owner's consecutive calls
key-files:
  created: []
  modified:
    - features/plugin/update-dependencies.feature
    - features/plugin/update.feature
    - features/plugin/apply.feature
    - features/plugin/fetch.feature
    - features/marketplace/failed-add.feature
    - features/step_definitions/config.steps.ts
    - test/orchestrators/marketplace/add.test.ts
key-decisions:
  - "A no-op apply is write-free only when the raw config and state bytes both remain identical."
  - "The four retained unit-only behaviors need a concrete public-harness limitation and an exact owner test; inconvenience alone is not a disposition."
  - "Owner gaps already supplied by the combined dependency tree are verified and cited instead of duplicated."
requirements-completed: [TST-01, XPH-01]
coverage:
  - id: D1
    description: Update, enable, list, and prune lifecycle gaps have complete command-surface assertions.
    requirement: TST-01
    verification:
      - kind: e2e
        ref: "features/plugin/{update-dependencies,update,enable,list,prune}.feature#Plan 10-06 lifecycle gap scenarios"
        status: pass
    human_judgment: false
  - id: D2
    description: Apply, fetch, alias, and failed-add recovery gaps are proven, including byte-stable no-op apply.
    requirement: TST-01
    verification:
      - kind: e2e
        ref: "features/plugin/{apply,fetch}.feature and features/marketplace/{usage-errors,failed-add}.feature#Plan 10-06 recovery scenarios"
        status: pass
    human_judgment: false
  - id: D3
    description: Import rollback detail, completion-cache stability, project tokens, and raw cascade normalization have owner cases.
    requirement: XPH-01
    verification:
      - kind: unit
        ref: "node --test test/orchestrators/import/execute.test.ts test/orchestrators/marketplace/add.test.ts test/orchestrators/plugin/update-flow.test.ts"
        status: pass
    human_judgment: false
duration: 28min
completed: 2026-10-27
status: complete
---

# Phase 10 Plan 06: Lifecycle Coverage Gap Closure Summary

**The remaining reachable lifecycle gaps now have complete command-surface assertions, no-op apply is proven byte-stable, and every retained unit-only behavior has an evidence-backed harness limit.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-28T02:13:38Z
- **Completed:** 2026-10-28T02:41:34Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added five discriminating scenarios for joined update ranges, physical-replace failure recovery, already-enabled roots with newly missing dependencies, partial upgrade listing, and retained prune declarations.
- Added complete recovery coverage for a mixed failed apply, bare fetch continuation, `rm`/`ls` usage errors, clean invalid-JSON add retry, and byte-for-byte no-op apply.
- Closed the standalone marketplace completion-cache assertion and verified the three owner cases already present on the combined dependency tree.
- Classified all four retained unit-only items against concrete public-harness limits and exact unit owners.

## Task Commits

1. **Task 1: Add update, enable, list, and prune discriminators** - `854c022f`
2. **Task 2: Add apply, fetch, alias, and failed-add discriminators** - `54d1fee0`
3. **Task 3: Close the remaining owner-test gaps and record harness limits** - `07a8b54a`

## Verification

| Check                           | Result                                |
| ------------------------------- | ------------------------------------- |
| Task 1 focused Cucumber         | 81 scenarios, 1,109 steps passed      |
| Task 2 focused Cucumber         | 131 scenarios, 1,245 steps passed     |
| Task 3 owner suites             | 568 tests passed                      |
| `npm run check:features`        | Passed                                |
| TypeScript typecheck            | Passed                                |
| Fallow audit against `45d64209` | Passed, no findings                   |
| Commit hooks                    | Passed on all three task commits      |
| Full Wave 5 `npm run check`     | Exit 0 on Node v26.12.1 at `07a8b54a` |
| Full Cucumber suite             | 1,119 scenarios, 11,392 steps passed  |
| Direct coverage aggregate       | 304 LCOV records merged               |

## TST-01 Coverage Ledger

| Gap                                                          | Disposition           | Exact evidence                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Joined ranges on an update cause                             | Scenario              | `features/plugin/update-dependencies.feature` — “Updating a dependency names every joined range and requiring plugin”                                                                                                                                                                                                                                                                                                           |
| Post-swap update failure and reinstall hint                  | Scenario              | `features/plugin/update.feature` — “A bridge failure after an update starts replacing files reports the reinstall remedy”                                                                                                                                                                                                                                                                                                       |
| Already-enabled root plus missing dependency                 | Scenario              | `features/plugin/enable.feature` — “Enabling an enabled plugin whose new declaration has a missing dependency is skipped”                                                                                                                                                                                                                                                                                                       |
| Partially upgradable list row                                | Scenario              | `features/plugin/list.feature` — “The list shows an installed plugin as partially upgradable when its new version adds an unsupported component”                                                                                                                                                                                                                                                                                |
| Prune keeps the base declaration                             | Scenario              | `features/plugin/prune.feature` — “Pruning keeps a dependency that an installed plugin still needs”, including the complete base-config table                                                                                                                                                                                                                                                                                   |
| Failed apply also uninstalls and disables                    | Scenario              | `features/plugin/apply.feature` — “Apply that cannot install one hand-declared plugin still makes every other hand edit”                                                                                                                                                                                                                                                                                                        |
| Bare fetch continues after one failure                       | Scenario              | `features/plugin/fetch.feature` — “A bare fetch continues through every marketplace after one plugin fails”                                                                                                                                                                                                                                                                                                                     |
| `rm` and `ls` alias usage failures                           | Scenario outline rows | `features/marketplace/usage-errors.feature` covers missing, surplus, invalid-flag, invalid-scope, and missing-scope-value forms                                                                                                                                                                                                                                                                                                 |
| Invalid-JSON URL add leaves no record and retries            | Scenario              | `features/marketplace/failed-add.feature` — “A url marketplace add whose manifest is not valid json leaves no record and retries cleanly”                                                                                                                                                                                                                                                                                       |
| No-op apply writes no bytes                                  | Scenario              | `features/plugin/apply.feature` — “Apply with nothing to change reports so and changes nothing”, comparing raw config and state bytes                                                                                                                                                                                                                                                                                           |
| Import re-enable carries rollback detail                     | Unit                  | `test/orchestrators/import/execute.test.ts` — “D-PL6-03: an enable whose rollback could not finish lists the rollback phases”                                                                                                                                                                                                                                                                                                   |
| Standalone already-added skip leaves completion caches alone | Unit                  | `test/orchestrators/marketplace/add.test.ts` — “MPA-01: a same-source add into the declaring layer is skipped as already added before any clone”                                                                                                                                                                                                                                                                                |
| Project-scope update substitutes project tokens              | Unit                  | `test/orchestrators/plugin/update-flow.test.ts` — “SUB-02: project-scope update substitutes ${CLAUDE_PROJECT_DIR}…”                                                                                                                                                                                                                                                                                                             |
| Raw cascade throw is normalized                              | Unit                  | `test/orchestrators/plugin/update-flow.test.ts` — “D-PL10-11: normalizes a non-Error cascade failure without inventing a cause”                                                                                                                                                                                                                                                                                                 |
| Load autoapply uses stored credentials without Device Flow   | Unit-only             | The real load delegates into apply, but the Pi-process scenario boundary cannot inject or observe apply's in-memory auth factory. Building a load-time Device Flow negative stand-in is explicitly declined by D-PL10-29. `AAP-02 / D-05` proves delegation; update-flow's `GHB-02` and `PUP-2 / GAUTH-03` cases prove the stored-credential bundles used by the delegated paths.                                               |
| Migration before a base file exists                          | Unit-only             | A public install creates the base config while it records a plugin, so the Cucumber surface cannot create the required recorded-plugin/no-base precondition. `test/orchestrators/reconcile/pending.test.ts` — “MIG-01 / NFR-5: the pre-migration projection is read-only and never writes the base config” owns it.                                                                                                             |
| Dependency closure after a tag update lands                  | Unit-only             | The step library can publish tags but cannot attach changed dependency declarations to a tagged revision. `test/orchestrators/plugin/update-flow.test.ts` — “D-10-18: a tag published between two cascade runs is visible to the second” owns the tag refresh and constrained dependent.                                                                                                                                        |
| Install root carries `rootCommit`                            | Unit-only             | A git-source root reaches dependency planning only when its catalog entry or existing clone exposes dependencies; no current scenario fixture supplies that git-root shape. `test/orchestrators/plugin/install-flow.test.ts` — “D-PL4-01: a git plugin installed after a dependency move installs the commit its own preview resolved, resolving it once” plus the `dependency-plan.test.ts` root-member case own the hand-off. |

## Decisions Made

- Compared the complete result rows and persisted declarations for each scenario; no sample-only assertions were introduced.
- Reused owner cases already present from prior work. The dependency tree had already closed import rollback detail and project-token coverage, while Plan 10-05 supplied raw cascade normalization.
- Kept the four unit-only classifications narrow and tied to public-harness limitations, as required by D-PL10-29 and the earlier `rootCommit` decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical test support] Added a post-swap MCP failure fixture and complete update-row comparison**

- **Found during:** Task 1
- **Issue:** The existing directory-block fixture failed before physical replacement and could not reach the planned post-swap recovery path. The generic row comparator also could not ignore only the nondeterministic atomic temporary suffix.
- **Fix:** Added one read-only scope-root fixture and one update-specific complete-row comparator that projects only stable fields.
- **Files modified:** `features/step_definitions/mcp-configuration.steps.ts`, `features/step_definitions/plugin/update.steps.ts`
- **Verification:** Task 1 focused Cucumber, feature gate, full Cucumber suite, and commit hook passed.
- **Committed in:** `854c022f`

**2. [Rule 2 - Missing critical test support] Added byte snapshots and marketplace-record absence assertions**

- **Found during:** Task 2
- **Issue:** Existing steps could assert parsed config/state content and checkout absence, but could not prove a no-op wrote zero bytes or that a failed add left no `state.json` marketplace entry.
- **Fix:** Added scenario-scoped raw-byte snapshots for the base config and state record, plus a read-only marketplace-record absence step.
- **Files modified:** `features/step_definitions/config.steps.ts`, `features/step_definitions/marketplace/checkout.steps.ts`
- **Verification:** Task 2 focused Cucumber, feature gate, typecheck, Fallow, full suite, and commit hook passed.
- **Committed in:** `54d1fee0`

**3. [Rule 3 - Dependency-tree convergence] Verified three planned owner cases instead of duplicating them**

- **Found during:** Task 3
- **Issue:** Import rollback detail and project-token cases were already present on the inherited tree; Plan 10-05 had also added raw cascade normalization before Plan 10-06 executed.
- **Fix:** Verified those exact cases and changed only the still-missing completion-cache assertion.
- **Files modified:** `test/orchestrators/marketplace/add.test.ts`
- **Verification:** All three owner suites passed 568 tests; full gate passed.
- **Committed in:** `07a8b54a`

**Total deviations:** 3 auto-fixed (2 missing test-support seams, 1 dependency-tree convergence adjustment).
**Impact on plan:** All additions are read-only test support or missing assertions. No production behavior changed.

## TDD Gate Compliance

Task 3 was marked `tdd="true"`, but its only missing work was an assertion over already-correct production behavior. The new completion-cache assertion passed immediately, and the other three named cases already existed. Workflow TDD enforcement was not enabled. No RED or GREEN production commit was fabricated; the test-only commit records the coverage closure truthfully.

## Issues Encountered

- `check:features` caught a retry repair step written with `Given` after assertions. Changing only that transition keyword to `When` restored the feature grammar before commit.
- The feature-only Task 2 file list omitted the two shared read-only assertions required by its own byte-stability and no-record success criteria; deviation 2 records the minimal support.

## Known Stubs

None.

## User Setup Required

None.

## Next Phase Readiness

Plan 10-07 can build the exhaustive cross-plan coverage artifact from this ledger, retain the package process-tree unit-only disposition, and run the final clean-tree phase gate. There are no Plan 10-06 blockers.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The failed-add tampering fixture remains loopback/local and now proves both record absence and clean retry.

## Self-Check: PASSED

- All 14 modified files exist.
- Task commits `854c022f`, `54d1fee0`, and `07a8b54a` are ancestors of HEAD.
- The committed tree passed the full Wave 5 gate.
